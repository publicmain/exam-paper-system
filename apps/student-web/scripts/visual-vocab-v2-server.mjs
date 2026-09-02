import http from 'node:http';

const card = {
  headword: 'decline', phonetic: '/dɪˈklaɪn/', pos: 'verb', senseKey: 'verb:01',
  translation: '下降；减少', definition: 'to become smaller or weaker',
  sentence: 'Sales may decline when customers lose confidence.',
  sentenceTranslation: '顾客失去信心时，销量可能下降。',
  collocations: ['decline sharply', 'a steady decline'], wordFamily: ['decline', 'declining'],
  confusionWords: ['decrease'], memoryHint: 'de- 向下 + cline- 倾斜', imageUrl: null,
  audioText: 'decline', list: 'ngsl', rank: 1180, attribution: 'NGSL Project',
};
const wordCards = [
  card,
  { ...card, headword: 'volcanic', phonetic: '/vɒlˈkænɪk/', pos: 'adjective', translation: '火山的', definition: 'connected with a volcano', sentence: 'A volcanic ash layer covered the town.', sentenceTranslation: '一层火山灰覆盖了小镇。', audioText: 'volcanic' },
  { ...card, headword: 'independently', phonetic: '/ˌɪndɪˈpendəntli/', pos: 'adverb', translation: '独立地', definition: 'without being controlled by another person', sentence: 'The dates were checked independently.', sentenceTranslation: '这些日期经过了独立核查。', audioText: 'independently' },
  ...['recognise', 'survey', 'evidence', 'suspension', 'accurate', 'ordinary', 'confidence'].map((headword) => ({ ...card, headword, audioText: headword })),
];
const learning = {
  id: 'daily-1', version: 'V2-20260901-001', date: '2026-09-01', type: 'daily_learning',
  mode: 'adaptive_coach', status: 'in_progress', target: 10, cursor: 2, completed: 2,
  sourceSummary: { review: 4, reading_lookup: 3, level_gap: 3 }, settings: { audioAccent: 'en-GB' }, deferredUntil: null,
  items: wordCards.map((itemCard, index) => ({ id: `learn-${index}`, position: index + 1, source: index < 3 ? 'reading_lookup' : 'level_gap', masteryBefore: 1, status: index < 2 ? 'completed' : 'pending', card: itemCard })),
};
const formalTest = {
  id: 'visual-test', version: 'V2-20260901-001-test-001', date: '2026-09-01', type: 'formal_test', status: 'in_progress', total: 12, answered: 0, correct: null, retry: null,
  items: Array.from({ length: 12 }, (_, index) => ({
    id: `test-${index + 1}`, position: index + 1, status: 'pending', response: null, isCorrect: null, card: null,
    question: index % 2 === 0
      ? { type: 'spelling', prompt: '根据中文、词性或发音，写出英文单词。', cue: { pos: 'verb', translation: '下降；减少', audioText: 'decline' }, options: [] }
      : { type: 'meaning_choice', prompt: 'decline', cue: null, options: ['下降；减少', '独立地', '火山的', '证据'] },
  })),
};
const center = {
  stats: { total: 86, new: 12, learning: 34, mastered: 40, due: 9, weak: 16, spellingWeak: 7, listeningWeak: 5, speakingWeak: 8 },
  growth: [{ date: '2026-08-27', added: 8, total: 8 }, { date: '2026-08-28', added: 12, total: 20 }, { date: '2026-08-29', added: 18, total: 38 }, { date: '2026-08-30', added: 15, total: 53 }, { date: '2026-08-31', added: 16, total: 69 }, { date: '2026-09-01', added: 17, total: 86 }],
  filters: { sources: ['reading_lookup', 'level_gap', 'teacher_list'], stages: ['new', 'learning', 'due', 'mastered'], articles: ['Birds on the Eleventh Floor'], topics: ['science', 'daily life'], lists: ['ngsl'] },
  total: 3, page: 1, pageSize: 30,
  items: [
    { studentSenseId: 'ss1', senseId: 's1', headword: 'decline', phonetic: '/dɪˈklaɪn/', pos: 'verb', translation: '下降；减少', definition: card.definition, masteryStage: 3, due: '2026-09-01', source: 'reading_lookup', sourceTitle: 'Birds on the Eleventh Floor', firstSeenAt: '2026-08-31', skills: { recognition: .8, context: .6, recall: .4, spelling: .3, listening: .5, speaking: .2, usage: .2 }, context: { sentence: card.sentence, translation: card.sentenceTranslation } },
    { studentSenseId: 'ss2', senseId: 's2', headword: 'volcanic', phonetic: '/vɒlˈkænɪk/', pos: 'adjective', translation: '火山的', definition: 'connected with a volcano', masteryStage: 5, due: '2026-09-02', source: 'level_gap', sourceTitle: null, firstSeenAt: '2026-09-01', skills: { recognition: 1, context: .8, recall: .7, spelling: .6, listening: .4, speaking: .3, usage: .2 }, context: { sentence: 'A volcanic ash layer covered the town.', translation: '一层火山灰覆盖了小镇。' } },
    { studentSenseId: 'ss3', senseId: 's3', headword: 'science', phonetic: '/ˈsaɪəns/', pos: 'noun', translation: '科学', definition: 'the study of the natural world', masteryStage: 8, due: '2026-09-20', source: 'teacher_list', sourceTitle: '本周核心词', firstSeenAt: '2026-08-27', skills: { recognition: 1, context: 1, recall: 1, spelling: 1, listening: .9, speaking: .8, usage: .8 }, context: { sentence: 'Science helps us understand the world.', translation: '科学帮助我们了解世界。' } },
  ],
};

function bodyFor(url, method) {
  if (url === '/api/student-auth/login' && method === 'POST') return { token: 'visual-test-token', student: { id: 'visual-student', name: '验收学生', nickname: '林思远', avatar: null } };
  if (url === '/api/student-auth/me') return { id: 'visual-student', name: '验收学生', nickname: '林思远', avatar: null };
  if (url.startsWith('/api/vocab-v2/center')) return center;
  if (url === '/api/vocab-v2/profile') return { dailyTarget: 10, taskMinutes: 8, audioAccent: 'en-GB', allowedDailyTargets: [5, 10, 15, 20] };
  if (url === '/api/vocab-v2/overview') return { today: learning, pendingTests: [{ dailySessionId: 'yesterday', testSessionId: null, date: '2026-08-31', total: 12, status: 'not_started' }] };
  if (url === '/api/vocab-v2/daily' || url === '/api/vocab-v2/daily/start') return learning;
  if (url === '/api/vocab-v2/test/start' && method === 'POST') return formalTest;
  if (url.startsWith('/api/vocab-v2/test?sessionId=')) return formalTest;
  if (url === '/api/lesson/today') return { student: { id: 'visual-student', name: '林思远' }, date: '2026-09-01', nextAction: { kind: 'vocab', label: '开始词汇', href: null }, rulesVersion: 1, completed: 1, total: 2, allDone: false, streakDays: 9, targetsFrozenAt: null, stage: 'vocab', stageAt: null, vocabCursor: 0, pendingVocabTest: null, segments: [{ key: 'read', status: 'done', label: 'Birds', questionCount: 8, typicalMinutes: 20, score: null, maxScore: 8, scoresPending: true, submissionId: 'sub1', sessionId: 'read1', autoClosed: false }, { key: 'vocab', status: 'partial', progress: 2, target: 10, typicalMinutes: 8, quizScore: { status: 'not_started' } }, { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 0, available: false, unavailableReason: '暂未开放' }] };
  return null;
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const value = bodyFor(req.url ?? '/', req.method ?? 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.writeHead(value == null ? 404 : 200);
  res.end(JSON.stringify(value ?? { code: 'visual_mock_missing', url: req.url }));
}).listen(5274, '127.0.0.1', () => process.stdout.write('visual vocab v2 api http://127.0.0.1:5274\n'));
