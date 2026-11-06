# 问形 · AI 提示词工作室

通过中文问答，把想法整理成可以复制使用的提示词。支持代码、图片、视频、文案和自定义任务，提供「轻松入门」与「进阶创作」两种模式。应用生成提示词；图片、视频和代码的实际执行交给你选择的工具。

体验地址：[wenxingprompt.cn](https://wenxingprompt.cn/)

## 功能

- 根据目标动态提问，提供可选回答、遗漏补充与「问形帮我决定」。
- 生成可编辑初稿，继续优化，保留历史版本、需求变化和待确认假设。
- 提示词评估、需求检查、回答建议补齐、复制与 Markdown 下载。
- 本浏览器自动保存、多项目管理、工作区 JSON 备份及导入。
- Supabase 邮箱账号（工作区功能须注册并验证后登录）：注册验证、登录退出、找回密码、账号独立本地工作区，以及手动云端保存和读取。云端版本冲突会阻止覆盖。
- 常用提示词：手动收藏、复制和在新项目中复用；同一提示词在第 4 个不同项目中复制或导出时询问收藏，同项目反复操作不重复计数，使用记录随备份保存。
- 最多 3 张 PNG / JPG / WebP 参考图，单张原图不超过 10 MB；浏览器压缩后保存，可填写参考说明并预览。参考图会随相关模型请求发送，识别结果需要自行确认。

## 本地运行

需要 Node.js >= 22.13.0 与 npm。建议使用当前 Node.js 22 LTS。

```sh
npm ci
```

将 `.env.example` 复制为 `.dev.vars`，只在这个本地文件填写自己的服务端密钥：

```dotenv
DEEPSEEK_API_KEY=填写你自己的密钥
DEEPSEEK_MODEL=deepseek-flash
```

不要把 `.dev.vars` 提交到 Git；不要将密钥放入前端代码、`VITE_*` 或 `NEXT_PUBLIC_*` 变量。模型接口地址固定为 `https://api.deepseek.com/chat/completions`。带参考图的请求当前固定使用 `deepseek-flash`；其他请求可通过 `DEEPSEEK_MODEL` 调整。

开发界面支持热更新：

```sh
npm run dev
```

默认打开 `http://localhost:5173`；以终端显示的地址为准。修改 `.dev.vars` 后重启服务。没有密钥时开发界面可展示未配置状态，模型操作需要有效密钥和可用额度。

也可以直接预览实际 Pages 产物：

```sh
npm run build:pages
npm run preview:pages
```

在 `http://127.0.0.1:5173` 查看。Pages Worker 未配置密钥时会显示配置说明。

## Cloudflare Pages 部署

推荐使用随仓库提供的独立 Pages 构建，不依赖任何私人 Sites 身份配置：

```sh
npm ci
npm run build:pages
```

输出目录为 `dist-pages/`，包含静态资源、`_routes.json` 和服务端 `_worker.js`。上传时保留整个目录结构以及 `_worker.js`；仅上传 HTML 和静态资源无法提供模型接口。

在 Cloudflare Pages 创建 Direct Upload 项目，上传 `dist-pages/` 目录或将其**目录内容**压缩为 ZIP 后上传。在项目的「设置 → 变量和机密」为生产环境添加机密 `DEEPSEEK_API_KEY`，按需添加 `DEEPSEEK_MODEL`，保存后重新部署同一份产物。也可以使用 Wrangler 命令上传：

```sh
npx wrangler pages deploy dist-pages --project-name 你的项目名
```

访问首页并检查 `/api/status` 返回 `{"configured":true}`。本版本不需要共享访问密码，工作区及模型功能要求已验证账号登录，必须配置下述 Supabase 账号和额度数据库。每个账号每天7次模型请求，剩余3次及用尽时弹窗提醒；全站每天200次，同账号至少间隔10秒，按北京时间零点恢复。提问、生成、优化、评估及补齐建议共用次数；请求发出即预留额度，模型失败可能已产生成本，不自动退回。查看、编辑、复制和下载已有内容不消耗次数。

## 账号登录与云端工作区

按 [账号接入说明](docs/accounts.md) 顺序执行全部迁移，配置 `SUPABASE_URL` 和 `SUPABASE_PUBLISHABLE_KEY`（只用 publishable 或 anon key），然后重新部署。数据库通过 RLS 限制账号所有权，云端保存检查版本以避免覆盖其他设备的更新。

公众注册和找回密码需要在 Supabase 配置自定义 SMTP，并将正式域名加入验证邮件允许跳转地址。未配置邮件服务前，不保证公众邮箱能收到验证邮件。完整步骤、旧工作区导入、共享设备缓存和测试说明见 [账号接入说明](docs/accounts.md)。

## 数据与隐私

项目、回答、版本、常用提示词及使用记录和压缩后的参考图片默认保存在当前浏览器 `localStorage`。访客与每个登录账号使用独立本地工作区；可通过“我的账号”手动保存或合并云端工作区。登录不会自动上传或迁移访客数据。清理浏览器数据、切换域名或更换设备不会保留原工作区；请及时下载备份。备份包含输入内容和参考图，分享前请检查。

提问、生成、评估和建议补齐会将相关需求、提示词、回答及参考图发送到 DeepSeek。密钥只由服务端读取，不会返回浏览器。模型输出可能存在理解偏差，需要人工检查后使用。

## 验证与目录

```sh
npm test
npm run typecheck
npm run build:pages
```

- `app/`、`components/studio/`：界面和交互。
- `lib/`：需求、问答、生成、版本、存储和模型请求逻辑。
- `deployment/pages/`：独立前端构建和 Pages Worker。
- `tests/`：行为与服务端契约测试；隔离浏览器验证见 [测试说明](tests/browser/README.md)。
- `vendor/`：随附样式及其第三方许可。

仓库还保留原模板中的通用 UI、可选数据库和连接器工具；当前 Pages 应用不需要配置 D1、R2 或连接器。`npm run build` 同样调用 Pages 构建，`npm start` 预览 Pages 产物；开发热更新仍使用 Vinext。

## 许可

本项目尚未指定整体开源许可证；公开源码不等同于授予任意再许可权。第三方组件继续遵守各自许可证，请保留 `vendor/shadcn-tailwind-4.13.0.LICENSE.md`、`scripts/vite/sites-vite-plugin.LICENSE` 以及依赖包的许可声明。
