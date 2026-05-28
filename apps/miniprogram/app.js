const config = require('./config.js');

App({
  globalData: {
    apiBase: config.API_BASE,
  },

  onLaunch() {
    // Migrate / read the remembered student name once at launch.
    try {
      const name = wx.getStorageSync('studentName');
      if (name) this.globalData.studentName = name;
    } catch (e) {
      // storage unavailable — ignore, index page will prompt for name
    }
  },

  /** Centralised GET helper. Resolves with parsed JSON, rejects with a
   *  { code, message } shape the pages can branch on. */
  apiGet(path) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.apiBase + path,
        method: 'GET',
        header: { 'content-type': 'application/json' },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else if (res.statusCode === 429) {
            reject({ code: 'rate_limited', message: '查询太频繁，请稍后再试' });
          } else {
            const code = (res.data && res.data.code) || 'http_' + res.statusCode;
            reject({ code, message: (res.data && res.data.message) || '查询失败' });
          }
        },
        fail: () => reject({ code: 'network', message: '网络错误，请检查网络后重试' }),
      });
    });
  },
});
