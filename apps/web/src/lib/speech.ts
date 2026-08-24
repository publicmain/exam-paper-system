/**
 * 单词发音（2026-08-24 研究性分析 #1）—— 浏览器自带 Web Speech API。
 *
 * 为什么是它：零成本、零网络依赖（本地语音引擎）、零 API 调用（铁律）。
 * 学生要考 O-Level 听力口试和雅思听说 —— 只认识字形的词在那两张卷子
 * 上等于没学；文献（Dherbey Chapuis & Berthele 2024）也表明语音形式
 * 缺失会形成错误的语音表征。
 *
 * 设计约束：
 *   · 发音失败**绝不影响学习流程**（全部 try/catch 吞掉）
 *   · 不支持的浏览器直接隐藏按钮（canSpeak 判定）
 *   · 音色偏好 en-GB（O-Level/雅思都是英式），退而求其次任意英语
 *   · 只在不泄题的位置放按钮：卡片背面 / 自测反馈框 / 生词本列表 /
 *     看词选义的题干（词就是题干，读出来不泄答案）
 */

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** 从候选音色里挑最合适的。导出为纯函数便于测试。 */
export function pickVoiceFrom(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = (lang: string) => (v: SpeechSynthesisVoice) => v.lang?.replace('_', '-').startsWith(lang);
  return (
    voices.find((v) => en('en-GB')(v) && v.localService) ??
    voices.find(en('en-GB')) ??
    voices.find((v) => en('en')(v) && v.localService) ??
    voices.find(en('en')) ??
    null
  );
}

/** 读一个词（或短句）。同一时刻只读一条 —— 新的打断旧的。 */
export function speak(text: string): void {
  if (!canSpeak() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoiceFrom(synth.getVoices());
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    } else {
      // Chrome 的音色列表异步加载，首次调用可能拿到空数组 ——
      // 不等它（等待逻辑是 bug 温床），直接用默认音色读，下次自然有
      u.lang = 'en-GB';
    }
    u.rate = 0.85; // 稍慢，学生要听清音节
    synth.speak(u);
  } catch {
    /* 发音失败绝不影响流程 */
  }
}
