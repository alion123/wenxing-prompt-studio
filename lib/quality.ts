import type { StudioContext } from './studio.ts';
import { z } from 'zod';
export type QualityProfile = { kind: 'general'|'image'|'video'; needsCharacters: boolean; expectedSeconds: number | null; singleShot: boolean;forbidCharacters?:boolean };
function peopleChoice(text:string):boolean|undefined{
  if(/(?:不含|不要|不需要|没有|无需|无|不出现)\s*(?:任何|可识别的?)?(?:人物|角色|人像)/.test(text))return false;
  if(/角色|人物|人像|武者|武侠|剑客|主角|男女|男子|女子|男孩|女孩|少女|少年|老人|模特|机器人|吉祥物|拟人/.test(text))return true;
}
function metaChoice(text: string): boolean | undefined {
  if (/(?:不要|不需要|不是要|无需|避免|别)[^，。；\n]{0,8}元提示词/.test(text)) return false;
  if (/元提示词|(?:不要|不需要|不写|无需)具体分镜/.test(text)) return true;
}
function singleChoice(text: string): boolean | undefined {
  if (/(?:不要|不需要|不采用|不用|避免|别)[^，。；\n]{0,8}(?:一镜到底|单镜头|一个镜头|single[ -]?shot)|多镜头|拆成[^，。；\n]{0,8}镜头/i.test(text)) return false;
  if (/一镜到底|单镜头|一个镜头|单一镜头|single[ -]?shot/i.test(text)) return true;
}
function secondsIn(text: string, onlyExplicit = false): number | null {
  // A rejected change is not a new timing requirement. Keep the positive clause after 但/而是.
  text = text.replace(/(?:不要|不需要|无需|别|不是|并非)(?:(?!但是|不过|但|而是)[^，,。；;\n])*/g,'');
  text = text.replace(/(?:每镜|每个镜头|每一镜|单个镜头|镜头时长)[^，。；\n]*/g,'');
  const unit = '(\\d+(?:\\.\\d+)?)\\s*(秒|分钟|分|s\\b)';
  const changed = text.match(new RegExp('(?:改成|改为|调整为|缩短为|延长到|延长至|而是)\\s*'+unit,'i'));
  const explicit = text.match(new RegExp('(?:总时长|全片时长|总片长|视频时长|片长|时长)(?:改成|改为|保持|为|是|约|要求|[:：\\s])*\\s*'+unit,'i'));
  const bare = onlyExplicit ? null : text.match(new RegExp(unit,'i'));
  const found = changed || explicit || bare;
  return found ? Number(found[1]) * (/分/.test(found[2]) ? 60 : 1) : null;
}
export function profileFor(context: StudioContext): QualityProfile {
  const general: QualityProfile = { kind: 'general', needsCharacters: false, expectedSeconds: null, singleShot: false };
  const current=[context.feedback,context.omissions,...Object.values(context.answers)];
  const confirmed=[...(context.confirmedRequirements??[])].reverse().map(r=>r.text);
  const decisions=[...current,...confirmed];
  const intent = [context.goal,...decisions].join('\n');
  const meta = [...decisions,context.goal].map(metaChoice).find(x=>x !== undefined);
  if (context.type === 'code' || context.type === 'copy' || meta === true) return general;
  const kind = context.type === 'video' || (context.type === 'custom' && /分镜|视频|动画短片/.test(intent)) ? 'video'
    : context.type === 'image' || (context.type === 'custom' && /角色设定图|三视图|人像|插画|海报/.test(intent)) ? 'image' : 'general';
  if (kind === 'general') return general;
  const all = [intent, context.currentPrompt, context.summary, ...Object.values(context.answers)].join('\n');
  const people=decisions.map(peopleChoice).find(x=>x!==undefined)??peopleChoice(context.goal);
  const previousPeople=/^## 角色设定\s*$/m.test(context.currentPrompt)?true:peopleChoice(all);
  const needsCharacters=people??previousPeople??false;
  const canonical = context.currentPrompt.match(/## 分镜表（合计\s*(\d+(?:\.\d+)?)\s*秒）/);
  const answeredSeconds=context.questions.flatMap(q=>{
    const total=/总时长|全片|片长|(?:整条|整段)(?:视频|短片)?(?:的)?时长/.test(q.text);
    const shotScoped=/每镜|每个镜头|每一镜|单个镜头|单镜头|镜头(?:的)?时长/;
    if(shotScoped.test(q.text)||(!total&&shotScoped.test(q.hint))||!/时长|片长|多长|多久|多少秒|多少分钟/.test(q.text))return [];
    const answer=Object.hasOwn(context.answers,q.id)?context.answers[q.id]:'';
    const seconds=secondsIn(answer);return seconds===null?[]:[seconds];
  })[0];
  const expectedSeconds = current.map(s=>secondsIn(s,true)).find(x=>x!==null) ?? answeredSeconds ?? confirmed.map(s=>secondsIn(s)).find(x=>x!==null)
    ?? (canonical ? Number(canonical[1]) : null) ?? secondsIn(context.currentPrompt, true)
    ?? secondsIn([context.summary, ...context.constraints].join('\n'), true) ?? secondsIn(context.goal);
  const previousShots = context.currentPrompt.match(/^\|\s*S\w*\s*\|/gm)?.length;
  const singleShot = decisions.map(singleChoice).find(x=>x!==undefined)
    ?? (previousShots ? previousShots === 1 : undefined) ?? singleChoice(context.currentPrompt)
    ?? singleChoice(context.goal) ?? false;
  return { kind, needsCharacters, expectedSeconds: kind === 'video' ? expectedSeconds : null, singleShot,...(people===false?{forbidCharacters:true}:{}) };
}
const field = (min: number, max = 1000) => z.string().trim().min(min).max(max);
const characterSchema = z.object({ id: field(1,40), name: field(1,80), identity: field(4,400), appearance: field(8,600), costume: field(8,600), props: field(1,400) });
const shotSchema = z.object({ id: field(1,40), start: z.number().finite().nonnegative(), end: z.number().finite().positive(), characters: z.array(field(1,40)).max(10),
  framing: field(1,100), camera: field(4,500), startState: field(6,700), action: field(8,1200), endState: field(6,700), transition: field(2,400), prompt: field(12,1800) });
const planSchema = z.object({ style: field(4,600), setting: field(6,1000), composition: field(6,800), totalSeconds: z.number().finite().min(0).max(86400),
  characters: z.array(characterSchema).max(10), continuity: z.array(field(4,1000)).max(20), shots: z.array(shotSchema).max(40), negativePrompt: z.string().max(1200) });
export class QualityError extends Error {}
const escape = (value: string) => value.replace(/\|/g, '／').replace(/\r?\n/g,' ');
export function materialize(result: {prompt:string; visualPlan?:unknown}, profile: QualityProfile): string {
  if (profile.kind === 'general') return result.prompt;
  const parsed = planSchema.safeParse(result.visualPlan);
  if (!parsed.success) throw new QualityError('视觉计划缺少具体的外形、服装、构图或镜头动作字段，不能仅返回“请输出分镜表”等要求。');
  const p = parsed.data;
  if (profile.needsCharacters && p.characters.length === 0) throw new QualityError('有角色的任务必须给出具体角色设定，或给出明确标注的可修改初稿。');
  if(profile.forbidCharacters&&p.characters.length)throw new QualityError('用户明确要求不含人物，不能加入角色设定。');
  const ids = new Set(p.characters.map(c => c.id));
  if (ids.size !== p.characters.length) throw new QualityError('角色编号重复，无法保证跨镜头一致性。');
  if (profile.kind === 'video') {
    if (!p.shots.length || (profile.singleShot && p.shots.length !== 1)) throw new QualityError('请按用户要求给出实际镜头；一镜到底只能有一个镜头。');
    if (p.totalSeconds <= 0 || (profile.expectedSeconds !== null && Math.abs(p.totalSeconds - profile.expectedSeconds) > .05)) throw new QualityError(`分镜总时长应符合用户要求${profile.expectedSeconds === null ? '' : `（${profile.expectedSeconds}秒）`}。`);
    let end = 0; const shotIds = new Set<string>(); const seen = new Set<string>();
    for (const shot of p.shots) {
      if (shotIds.has(shot.id) || Math.abs(shot.start-end) > .05 || shot.end <= shot.start) throw new QualityError('镜头编号必须唯一，时间轴从0开始连续、不重叠、不留空档。');
      if (shot.characters.some(id=>!ids.has(id))) throw new QualityError('镜头引用了未定义的角色。');
      shotIds.add(shot.id); shot.characters.forEach(id=>seen.add(id)); end=shot.end;
    }
    if (Math.abs(end-p.totalSeconds) > .05) throw new QualityError('最后一镜结束时间与总时长不符。');
    if (p.characters.some(c=>!seen.has(c.id))) throw new QualityError('已定义的出场角色没有分配到任何镜头。');
    if (p.shots.length > 1 && !p.continuity.length) throw new QualityError('多镜头任务必须明确服装、兵器/道具、站位或轴线等连续性规则。');
  }
  const sections = [result.prompt.trim().replace(/\bvisualPlan\b/g, '下方具体设定与镜头'), `## 统一视觉设定\n\n风格：${p.style}\n\n场景：${p.setting}\n\n构图：${p.composition}`];
  const describe = (c: z.infer<typeof characterSchema>) => `${c.name}（${c.id}）：${c.identity}；外形：${c.appearance}；服装/外壳：${c.costume}；道具：${c.props}`;
  if (p.characters.length) sections.push(`## 角色设定\n\n${p.characters.map(c=>`- ${describe(c)}`).join('\n')}`);
  if (p.continuity.length) sections.push(`## 连续性约束\n\n${p.continuity.map(c=>`- ${c}`).join('\n')}`);
  if (profile.kind === 'video') {
    sections.push(`## 分镜表（合计 ${p.totalSeconds} 秒）\n\n| 镜头 | 时间 / 秒 | 景别 | 机位与运镜 | 具体动作 | 转场 |\n| --- | --- | --- | --- | --- | --- |\n${p.shots.map(s=>`| ${escape(s.id)} | ${s.start}–${s.end}（${Number((s.end-s.start).toFixed(2))}秒） | ${escape(s.framing)} | ${escape(s.camera)} | ${escape(s.action)} | ${escape(s.transition)} |`).join('\n')}`);
    sections.push(`## 逐镜头可复制提示词\n\n${p.shots.map(s=>{
      const visible = p.characters.filter(c=>s.characters.includes(c.id));
      return `### ${s.id} · ${s.start}–${s.end} 秒\n\n${p.style}。场景：${p.setting}。${visible.length ? `本镜人物固定设定（保持身份，不改变本镜景别或可见范围）：${visible.map(describe).join('；')}。` : '本镜不出现可识别人物。'}\n\n景别：${s.framing}；机位与运镜：${s.camera}。\n起始状态：${s.startState}。\n动作过程：${s.action}。\n结束状态：${s.endState}。\n画面与运动细节：${s.prompt}\n衔接：${s.transition}。${p.negativePrompt.trim() ? `\n避免项：${p.negativePrompt}` : ''}`;
    }).join('\n\n')}`);
  }
  if (p.negativePrompt.trim()) sections.push(`## 避免项\n\n${p.negativePrompt}`);
  const output = sections.join('\n\n');
  if (output.length > 24000) throw new QualityError('镜头细节超出单份提示词长度，请精简重复描述但保留角色锚点和实际镜头。');
  return output;
}

export function qualityInstructions(profile: QualityProfile): string {
  const common = `【具体性与提问原则】先确定用户真正要交给哪种工具执行，问题优先覆盖会改变结果的缺口。不要重复询问已给出的时长、风格、角色设定；未指定不等于冲突，用户让你决定时给出具体初稿，并在assumptions逐条说明你补定的选择。conflicts只写真正互相矛盾的要求，不写“还没选”。每轮仍保持2至3题（新手）或2至4题（进阶）。角色、视觉、分镜等缺口优先于泛泛询问“想要什么感觉”。
代码任务必须具体化功能、输入输出、运行环境、数据存储、异常与验收场景；文案任务必须具体化受众、场景、核心信息、文体与篇幅，不空喊“专业、高质量”。尊重明确只要元提示词或分析任务的要求。`;
  if (profile.kind === 'general') return common;
  return `${common}
【当前任务：${profile.kind === 'video' ? '视频/分镜' : '图片'}；需要角色：${profile.forbidCharacters?'明确不允许人物，characters必须为空':profile.needsCharacters ? '是' : '不强制'}】
核心交付是已经具体化的可执行提示词。禁止仅返回“请设计角色/请输出分镜表/请保持一致”及其字段清单，把创作决策全部再推给下游。此处写具体视觉计划是编写提示词的必要部分，不是调用工具生成图片或视频。
提问时先处理缺失的人物身份/数量/关系、可见外形与服装道具、空间和动作，再处理镜头节奏与生成方式；若角色细节已经明确则不要重问。人物的“帅气、漂亮、神秘”不能代替可见锚点。生成时将合理补定的年龄段、发型、衣服颜色材质、标志物、持物方式明确写入assumptions，不谎称用户已确认。无人物的产品/风景不得强塞角色。
generate 输出在原有prompt、summary、constraints、assumptions、conflicts字段之外，必须增加visualPlan对象，严格格式：
{"style":"具体画风/光线/色调","setting":"具体地点与固定空间关系","composition":"具体构图","totalSeconds":${profile.kind === 'video' ? profile.expectedSeconds ?? '正数' : 0},"characters":[{"id":"A","name":"稳定称呼","identity":"年龄段、身份、关系及行为气质","appearance":"具体脸部、发型或非人主体的可见识别特征，至少8字","costume":"明确颜色、形制、材质或外壳特征，至少8字","props":"道具形态、握持手；没有则写无道具"}],"continuity":["具体的服装/道具/持物手/画面左右/轴线等不变事实"],"shots":[{"id":"S01","start":0,"end":5,"characters":["A"],"framing":"全景/中景等","camera":"实际机位与一项主要运镜","startState":"镜头开始时的站位与持物状态","action":"谁以哪只手/朝哪个方向完成什么具体动作，起因与接触对象清楚","endState":"镜头结束时的姿态、距离与持物状态","transition":"如何衔接下一镜","prompt":"这一镜实际发生的画面、动作、环境运动，不能是要求下游再写提示词"}],"negativePrompt":"只写相关避免项，无则空字符串"}。
prompt只写整体创作指令与重要限制，不重复要求下游输出方案，也不要自己重复拼接角色表、分镜表；服务端会把visualPlan中的实际内容展开。summary与constraints要累计明确的角色锚点与动作/时长决定，后续优化保留已存在的识别特征，除非用户明确改动。
${profile.kind === 'video' ? `必须实际填出每个镜头，start/end为秒数，首镜从0开始，各镜连续无重叠，最后结束于totalSeconds${profile.expectedSeconds === null ? '（未给总时长时合理补定并标为假设）' : `=${profile.expectedSeconds}`}。${profile.singleShot ? '用户要求一镜到底，shots只能有1项；同一镜里写清动作分段，不虚构切镜。' : '按动作职责分镜，不固定套用镜数；不要把50秒整段动作压成一条笼统的“精彩打斗”。'}只引用characters中已定义的id，每个实际出场人物都要在对应镜头的characters列出。每镜动作必须能看见、能执行；多人打斗明确攻守、武器与方向，避免堆砌多个不连续动作。startState、endState、action与prompt指同一镜头，后一镜承接前一镜。不要臆造任何厂商的原生时长或能力上限。` : '图片任务shots必须为[]，totalSeconds=0；使用具体的主体、姿态/表情、构图、光线和场景。角色图要写出能跨图复用的身份锚点；产品图准确写材质、形状、位置与包装，不无故加入人物。'}
返回前自查：相邻镜头景别/机位改变时应写清切镜，不能一边写不切镜一边切到另一景别；动作起止与衔接不能互相矛盾；不能让角色、持物手、兵器和固定场景锚点无因变化。近景只表现本镜可见部位，完整角色设定是身份依据，不要求把全身都画进特写。prompt里不要出现visualPlan、JSON字段等实现术语，改为“下方具体设定与镜头”。
结构不能代替内容：每个字段都填具体事实，不得以待补、按需、详见上文或“请自行设计”占位。没有指定且可合理补定的地方填可修改初稿并明示假设；若有明确冲突，保留用户已定事实并在conflicts中说明。
`;
}
