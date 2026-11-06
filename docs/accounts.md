# 账号与云端工作区

工作区和模型功能要求邮箱注册、验证后登录。公开介绍页和帮助页无需登录。不配置 Supabase 时模型接口拒绝请求，不开放访客模型调用。

## 部署配置

1. 在自己的 Supabase SQL Editor 按顺序执行以下迁移；升级时只执行未应用的迁移，保留已有数据：
   - `supabase/migrations/20261101_accounts.sql`
   - `supabase/migrations/20261104_usage_stats.sql`
   - `supabase/migrations/20261105_generation_budget.sql`
   - `supabase/migrations/20261105_daily_seven_requests.sql`
   - `supabase/migrations/20261106_admin_dashboard.sql`
2. Cloudflare Pages 生产环境配置 `SUPABASE_URL` 和 `SUPABASE_PUBLISHABLE_KEY`，后者仅用 publishable 或旧版 anon key；绝对不要填写 secret/service_role key。`DEEPSEEK_API_KEY` 作为服务端机密保留。
3. Supabase Authentication → URL Configuration：Site URL 设置为正式站点，Redirect URLs 加入对应邮件跳转地址。换域名时同步修改，开发/预览域名需单独允许。
4. Authentication → Emails 配置自定义 SMTP，启用邮箱确认。使用发信服务提供的域名校验记录，完成 SPF/DKIM/DMARC。不要在源码或聊天中公开 SMTP 密钥。邮件是否进入收件箱由收件方判定，不能保证不被分入垃圾邮件。
5. 构建并部署；`/api/auth-config` 只能返回项目 URL 和公开 key，不能返回管理员密钥。
6. Authentication → Sign In / Providers → Email：Minimum password length 设置为8；Password requirements 选择“Lowercase, uppercase letters, digits and symbols”。前端与服务端同时要求至少8位，含大写字母、小写字母、数字及特殊符号（例如 ! @ # _）。既有账号仍可用原密码登录，新注册及重设密码使用新规则。
7. 用自己控制的真实邮箱验证注册、重发、登录、找回密码及邮件跳回正式域名。注册和重设密码需要重复确认。注册提交后原密码在本页内保留，关闭、切换账号或登录成功后清除，不写入工作区或浏览器存储。弱密码在发信及重发倒计时前拦截。

## 额度

每个已验证账号每天7次模型请求，全站每天200次，同账号至少间隔10秒，按北京时间00:00恢复。数据库统一计数，刷新、换浏览器或换设备不重置。第4次成功预留后剩余3次时提醒，第7次仍允许执行，随后礼貌提示用尽，第8次拒绝。旧计数达到或超过7时当天已无剩余额度，迁移不会清零。

提问、生成、优化、评估和补齐建议共用次数。请求发出即预留，模型失败可能已产生成本，不自动返还；复制、编辑、查看和下载已有结果不扣次数。全站保护额度或间隔限制也可能先阻止请求。

## 数据规则

- 每个账号使用独立的浏览器存储键，切换账号不会带入上一账号的数据。
- 工作区改动首先自动保存在当前浏览器。通过“我的账号”手动检查、合并及保存云端；新设备的空白工作区登录后会尝试恢复云端内容，修改不会实时上传。
- 云端合并保留本地内容；相同项目跳过，同编号存在差异时另存。其他设备已更新云端时，旧版本保存会被阻止，需先读取合并。
- 云端及JSON备份包含项目、常用提示词、问答、历史版本和压缩参考图，最大10MB。旧访客工作区可通过备份导入到登录账号，分享备份前自行检查内容。
- 数据库RLS限制账号数据所有权；额度函数使用 SECURITY DEFINER，仅向 authenticated 授予执行权，并在函数内校验已验证账号。浏览器不能直接修改计数表。
- 退出不会删除该账号在本设备的缓存。共享设备使用后应清理站点数据；清理前先保存云端或下载备份。

## 验证

运行 `npm test`、`npm run typecheck`、`npm run build:pages`。管理员可运行 `supabase/isolation-test.sql` 验证隔离和版本冲突，运行 `supabase/daily-quota-test.sql` 验证第4/7/8次、北京时间恢复、全站保护及权限。两个脚本在事务中操作临时测试数据并回滚，不调用模型或发信；应在明确授权的项目中运行。

隔离浏览器验证见 `tests/browser/README.md`。网络桩测试不能代替真实邮箱投递测试。

## 管理员后台

只有数据库 `auth.users.raw_app_meta_data.wenxing_admin` 为布尔 true 且邮箱已验证的账号可查看。在“我的账号 → 查看注册账号与用量明细”打开，支持邮箱/ID搜索、每页20条、注册/验证/角色/登录/活跃/今日额度和云端保存时间，以及最近30天请求总数。不包含密码、认证令牌、提示词或工作区正文。

管理员标记必须由可信项目管理员在服务端设置；用户可修改的 user_metadata 不具有授权作用。普通用户直接调用后台RPC也会被拒绝。管理员目前同样受每天7次模型请求限制；后台查询和查看自己的次数不扣模型额度。旧问题补齐建议改为主动点击，并明确说明消耗1次，不再自动调用。

`supabase/admin-dashboard-test.sql` 在事务回滚中检查权限、分页和只读次数查询；在线人数按最近两分钟心跳估算，请求数为预留次数而非成功生成数量。
