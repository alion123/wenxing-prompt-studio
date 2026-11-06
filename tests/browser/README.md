# 浏览器验证

这里的测试导出异步函数，接受已有 Playwright 的 `{page, expect, baseUrl}`，不包含真实邮箱密码或服务端密钥。

先运行 `npm run build:pages`，然后 `node scripts/preview-registration.mjs`，默认地址 `http://127.0.0.1:5199`。此预览仅用于隔离测试，API返回模拟配置，不是生产服务器。

- `registration-password.mjs` 导出 `testRegistrationPassword`：验证注册密码保留、确认密码和模式切换。
- `daily-quota.mjs` 导出 `testDailyQuota`：验证剩余3次提醒、避免重复提醒、用尽通知、剩余次数展示和已有项目保留。

在独立浏览器上下文中调用测试函数，例如 `await testDailyQuota({page,expect})`；可传入正式站点 `baseUrl` 验证已发布前端。测试拦截身份和模型请求，不发真实邮件，不消耗真实模型次数。不要与用户正在操作的页面共用上下文。数据库额度原子性由 `supabase/daily-quota-test.sql` 另行验证。

- `admin-dashboard.mjs` 导出 `testAdminDashboard`：验证管理员账号列表、搜索、手机布局、选择框边界及不扣次数的额度读取。
- `password-rules.mjs` 导出 `testPasswordRules`：验证弱密码注册与重设拦截、有效新密码及旧密码登录兼容性。
- `service-backup.mjs` 导出 `testServiceBackup`，在隔离账号登录后调用（可接在 `testAdminDashboard` 后）：验证文件选择框边界、已选文件名和损坏备份拦截。测试不会合并真实用户工作区。
