const app = getApp();

Page({
  data: {
    loading: true,
    error: '',
    header: null, // { paperName, totalScore, maxScore, pct, pctClass, statusLabel }
    items: [],
    passageOpen: false,
    passage: '',
    passageTitle: '',
  },

  onLoad(query) {
    const submissionId = query.submissionId;
    const name = query.name;
    if (!submissionId || !name) {
      this.setData({ loading: false, error: '参数缺失，请返回重试' });
      return;
    }
    this.load(submissionId, name);
  },

  togglePassage() {
    this.setData({ passageOpen: !this.data.passageOpen });
  },

  load(submissionId, name) {
    const path =
      '/api/morning-quiz/history-detail?submissionId=' +
      encodeURIComponent(submissionId) +
      '&name=' +
      encodeURIComponent(name);
    app
      .apiGet(path)
      .then((d) => {
        const max = d.maxScore || 0;
        const total = d.totalScore != null ? d.totalScore : (d.autoScore || 0);
        const pct = max > 0 ? Math.round((total / max) * 100) : 0;
        const pctClass = pct >= 70 ? 'pct-good' : pct >= 50 ? 'pct-mid' : 'pct-low';

        let passage = '';
        let passageTitle = '';

        const items = (d.items || []).map((it) => {
          const sc = it.snapshotContent || {};
          if (!passage && sc.passage) {
            passage = sc.passage;
            passageTitle = sc.passageTitle || '';
          }
          // correctness: isCorrect can be true/false/null (pending marking)
          let mark = 'pending';
          if (it.isCorrect === true) mark = 'right';
          else if (it.isCorrect === false) mark = 'wrong';
          const awarded = it.awardedMarks == null ? null : it.awardedMarks;
          const pendingMark =
            awarded == null &&
            (it.questionType === 'short_answer' ||
              it.questionType === 'structured' ||
              it.questionType === 'essay');
          // Surface a friendly comment; hide the internal [ai-grade]/[ai-pending] tag.
          let comment = it.markerComment || '';
          comment = comment.replace(/^\[ai-grade\]\s*/, '');
          let commentKind = '';
          if (/\[ai-pending\]/.test(comment)) {
            comment = '老师待批改';
            commentKind = 'pending';
          } else if (/\[AI-ERROR\]|\[AI-NO-VERDICT\]/.test(comment)) {
            comment = '老师待批改';
            commentKind = 'pending';
          } else if (comment) {
            commentKind = 'note';
          }
          return {
            paperQuestionId: it.paperQuestionId,
            sortOrder: it.sortOrder,
            questionType: it.questionType,
            marks: it.marks,
            awarded,
            pendingMark,
            mark, // right | wrong | pending
            stem: (sc.stem || '').trim(),
            studentAnswer: it.studentAnswer || '(未作答)',
            correctAnswer: it.correctAnswer || '',
            comment,
            commentKind,
          };
        });

        this.setData({
          loading: false,
          header: {
            paperName: d.paperName,
            total,
            max,
            pct,
            pctClass,
            statusLabel: d.status === 'marked' ? '已批改' : '已提交',
          },
          items,
          passage,
          passageTitle,
        });
      })
      .catch((err) => {
        this.setData({ loading: false, error: err.message || '加载失败' });
      });
  },
});
