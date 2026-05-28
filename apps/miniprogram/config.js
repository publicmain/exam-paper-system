// ─────────────────────────────────────────────────────────────────────
// 早测查询小程序 · 配置
//
// 部署前你需要做的三件事（只有你本人能做）：
//
//   1. 在「微信公众平台 mp.weixin.qq.com」注册一个【小程序】账号，拿到
//      AppID，填进 project.config.json 的 "appid" 字段。
//
//   2. 在小程序后台「开发 → 开发管理 → 开发设置 → 服务器域名」里，把下面
//      API_BASE 的域名加入【request 合法域名】白名单。
//
//   3. ⚠️ 微信要求 request 合法域名做过 ICP 备案。当前 API 在
//      exam-paper-system-production.up.railway.app（Railway，境外），
//      没法备案。上线前必须换成一个【已 ICP 备案的国内域名】反代到这个
//      API，然后把 API_BASE 改成那个域名。
//
//   开发阶段：微信开发者工具右上角「详情 → 本地设置 → 勾选『不校验合法
//   域名…』」可以先用 Railway 域名联调，但这只在开发者工具/真机预览里
//   生效，正式发布必须用备案域名。
// ─────────────────────────────────────────────────────────────────────

module.exports = {
  // 改成你备案后的域名，例如 https://zaoce.yourschool.edu.cn
  API_BASE: 'https://exam-paper-system-production.up.railway.app',
};
