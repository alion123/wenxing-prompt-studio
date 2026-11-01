export const base = { prompt: '2D水墨淡彩动画，雪地山巅，两名成年武者克制地交锋，背景留白。', summary: '50秒水墨对决', constraints: ['50秒','两名成年武者'], assumptions: ['未指定角色细节，采用以下可修改初稿'], conflicts: [] };
export function fixture() {
  return { ...base, visualPlan: { style: '2D水墨淡彩，宣纸纹理，黑白灰与暗红点缀', setting: '积雪覆盖的山巅石台，远处淡墨山脊，天光从左上方照入', composition: '两人分站画面左右，石台边缘固定在远景上方', totalSeconds: 50,
    characters: [
      { id:'A', name:'执刀者', identity:'约30岁成年男子，沉稳克制的旧日同门', appearance:'黑发高束，窄长脸，左眉有浅色旧疤', costume:'深灰窄袖武服，暗红布腰带，黑色布靴', props:'右手持窄刃直刀，刀柄缠黑色布条' },
      { id:'B', name:'执剑者', identity:'约28岁成年女子，警觉而决断的旧日同门', appearance:'银白高马尾，细长眉，圆形银色耳坠', costume:'青灰交领武服，月白短披风，灰色布靴', props:'右手持细长直剑，剑穗为浅青色' },
    ], continuity: ['执刀者始终位于屏幕左侧，执剑者位于右侧；兵器均由右手持握，镜头保持在两人轴线南侧'], negativePrompt:'无文字水印，不使用3D写实渲染，不更换服装与兵器',
    shots: [
      { id:'S01', start:0, end:20, characters:['A','B'], framing:'全景', camera:'低机位固定相机', startState:'执刀者站左侧，执剑者站右侧，相距四步', action:'执刀者向前踏一步，右手直刀从身侧抬至胸前；执剑者右手长剑斜立护住胸前', endState:'二人距离三步，两把兵器尚未接触', transition:'在直刀抬至胸前时切到下一镜', prompt:'风卷细雪掠过脚边，二人由静止对峙进入试探，动作清楚，不添加额外攻击。' },
      { id:'S02', start:20, end:50, characters:['A','B'], framing:'中景', camera:'从轴线南侧缓慢横移半米，不越轴', startState:'双方距离三步，执刀者刀尖朝向对手胸前', action:'执刀者右脚前踏以直刀横切；执剑者右手长剑斜向上格挡，接触后各退一步', endState:'二人回到三步距离，刀剑分别收至身侧，衣物兵器保持一致', transition:'在双方收势后停住，风雪留白收尾', prompt:'直刀从左向右横切，长剑向上格挡，接触只激起细雪与淡墨拖尾，双方后撤并平稳收势。' },
    ] } };
}
