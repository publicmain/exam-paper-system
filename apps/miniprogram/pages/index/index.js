const app = getApp();

Page({
  data: {
    name: '',          // committed name (the one we query with)
    inputName: '',     // bound to the text field
    loading: false,
    error: '',
    student: null,     // { name, matchedCount, classes }
    submissions: [],   // decorated rows
    summary: null,     // { avgPct, count }
  },

  onLoad() {
    const remembered = app.globalData.studentName;
    if (remembered) {
      this.setData({ name: remembered, inputName: remembered });
      this.load(remembered);
    }
  },

  onPullDownRefresh() {
    if (this.data.name) {
      this.load(this.data.name).then(() => wx.stopPullDownRefresh());
    } else {
      wx.stopPullDownRefresh();
    }
  },

  onInput(e) {
    this.setData({ inputName: e.detail.value });
  },

  onQuery() {
    const name = (this.data.inputName || '').trim();
    if (!name) {
      this.setData({ error: '请输入你的姓名' });
      return;
    }
    wx.setStorageSync('studentName', name);
    app.globalData.studentName = name;
    this.setData({ name });
    this.load(name);
  },

  onSwitch() {
    wx.removeStorageSync('studentName');
    app.globalData.studentName = '';
    this.setData({
      name: '', inputName: '', student: null, submissions: [], summary: null, error: '',
    });
  },

  // Format helpers ----------------------------------------------------
  pctClass(pct) {
    if (pct >= 70) return 'pct-good';
    if (pct >= 50) return 'pct-mid';
    return 'pct-low';
  },
  dateLabel(iso) {
    if (!iso) return '';
    // "2026-05-28T00:00:00.000Z" → "2026-05-28"
    return String(iso).slice(0, 10);
  },

  load(name) {
    this.setData({ loading: true, error: '' });
    return app
      .apiGet('/api/morning-quiz/history-by-name?name=' + encodeURIComponent(name))
      .then((data) => {
        const subs = (data.submissions || []).map((s) => {
          const max = s.maxScore || 0;
          const total = s.totalScore != null ? s.totalScore : (s.autoScore || 0);
          const pct = max > 0 ? Math.round((total / max) * 100) : 0;
          return {
            submissionId: s.submissionId,
            dateLabel: this.dateLabel(s.date),
            paperName: s.paperName,
            level: s.level,
            className: s.className,
            total,
            max,
            pct,
            pctClass: this.pctClass(pct),
            status: s.status,
            statusLabel: s.status === 'marked' ? '已批改' : '已提交',
            statusClass: s.status === 'marked' ? 'badge-marked' : 'badge-submitted',
          };
        });
        // Summary across all papers with a denominator.
        const scored = subs.filter((s) => s.max > 0);
        const avgPct = scored.length
          ? Math.round(scored.reduce((a, s) => a + s.pct, 0) / scored.length)
          : null;
        this.setData({
          loading: false,
          student: data.student || { name },
          submissions: subs,
          summary: { avgPct, count: subs.length },
        });
      })
      .catch((err) => {
        this.setData({
          loading: false,
          error: err.message || '查询失败',
          student: null,
          submissions: [],
          summary: null,
        });
      });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url:
        '/pages/detail/detail?submissionId=' +
        encodeURIComponent(id) +
        '&name=' +
        encodeURIComponent(this.data.name),
    });
  },
});
