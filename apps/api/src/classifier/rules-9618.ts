// Keyword-based topic classifier for CIE 9618 Computer Science.
// Each rule lists strong indicators (weight 3) and optional weak hints
// (weight 1). When a paperHint matches the question's paper number, a
// +2 bias kicks in — this disambiguates topics that share vocabulary
// across papers (e.g. assembly basics in P1 vs advanced addressing
// modes in P4).
//
// Output is the highest-scoring topic; confidence scales with the
// margin over the runner-up so a tied result returns lower confidence.
// Anything below MIN_SCORE returns null and the question is left
// untagged for the teacher to handle in the UI.

export interface ClassifierRule {
  topicCode: string;
  keywords: RegExp[];
  hints?: RegExp[];
  paperHint?: Array<'1' | '2' | '3' | '4'>;
}

const r = (s: string, flags = 'i') => new RegExp(s, flags);
// Boundary helper for word-style matches that should not fire mid-token.
const w = (s: string) => r(`\\b${s}\\b`);

export const RULES_9618: ClassifierRule[] = [
  // ---------- P1 / P3 — Information representation ----------
  {
    topicCode: 'CS.1',
    paperHint: ['1', '3'],
    keywords: [
      w('binary'), w('denary'), w('decimal'), w('hexadecimal'), w('hex'),
      r("two['’]s complement"),
      w('BCD'), w('ASCII'), w('Unicode'), w('character set'),
      w('overflow'), w('underflow'),
      w('bitmap'), w('vector'), w('pixel'), w('resolution'),
      w('compression'), w('lossy'), w('lossless'),
      w('JPEG'), w('PNG'), w('MP3'),
      w('sample rate'), w('sampling resolution'), w('bit depth'),
    ],
    hints: [w('image'), w('audio'), w('sound'), w('file size')],
  },
  // ---------- P1 / P3 — Communication, Networks ----------
  {
    topicCode: 'CS.2',
    paperHint: ['1', '3'],
    keywords: [
      w('router'), w('switch'), w('hub'),
      w('topology'), w('bus'), w('star'), w('mesh'), w('ring'),
      w('LAN'), w('WAN'),
      w('IPv4'), w('IPv6'), w('IP address'),
      w('MAC address'),
      w('client.{0,5}server'), w('peer.{0,3}to.{0,3}peer'),
      w('bandwidth'),
    ],
    hints: [w('network'), w('internet'), w('packet'), w('frame')],
  },
  // ---------- P1 — Hardware: logic gates + embedded / control systems ----------
  {
    topicCode: 'CS.3',
    paperHint: ['1'],
    keywords: [
      w('logic gate'),
      r('\\b(AND|OR|NOT|NAND|NOR|XOR)\\s+gate'),
      w('truth table'),
      w('logic circuit'),
      w('fetch.execute cycle'),
      // Hardware-application questions that didn't match the gate
      // vocabulary live here too: embedded systems, monitoring/control
      // loops, 3D printers, sensors / actuators, memory buffers.
      w('embedded system'),
      w('control system'),
      w('monitoring system'),
      r('3.?D\\s+print'),
      w('actuator'),
      w('sensor'),
      r('\\bDRAM\\b'),
      r('\\bSRAM\\b'),
      r('\\bROM\\b'),
      w('memory buffer'),
    ],
    hints: [w('gate'), w('Boolean'), w('feedback'), w('hardware'), w('device')],
  },
  // ---------- P1 / P4 — Processor fundamentals ----------
  {
    topicCode: 'CS.4',
    paperHint: ['1'],
    keywords: [
      w('CPU'), w('arithmetic logic unit'), w('ALU'),
      w('control unit'),
      r('\\bMAR\\b'), r('\\bMDR\\b'), r('\\bPC\\b\\s*\\('),
      r('\\bCIR\\b'), r('\\bACC\\b'),
      w('address bus'), w('data bus'), w('control bus'),
      w('LMC'),
      r('\\b(LDA|STA|ADD|SUB|INP|OUT|HLT|DAT|BRA|BRP|BRZ)\\b'),
      w('logical shift'), w('arithmetic shift'),
      w('bit manipulation'), w('mask'),
    ],
    hints: [w('register'), w('instruction set'), w('opcode')],
  },
  // ---------- P1 / P3 — System software ----------
  {
    topicCode: 'CS.5',
    paperHint: ['1', '3'],
    keywords: [
      w('operating system'), w('kernel'),
      w('device driver'), w('utility software'),
      w('compiler'), w('interpreter'), w('assembler'),
      w('language translator'), w('linker'), w('loader'),
      w('source code'), w('object code'),
      w('intermediate code'),
    ],
    hints: [w('translation'), w('execute')],
  },
  // ---------- P1 / P3 — Security ----------
  {
    topicCode: 'CS.6',
    paperHint: ['1', '3'],
    keywords: [
      w('password'), w('biometric'),
      r('two.{0,3}factor'), w('2FA'),
      w('encryption'), w('encrypted'), w('decrypt'),
      w('symmetric'), w('asymmetric'),
      w('public key'), w('private key'),
      w('digital signature'),
      w('firewall'),
      w('malware'), w('virus'), w('worm'), w('trojan'), w('phishing'),
      w('checksum'), w('parity'), w('check digit'),
      w('hash'), w('hashing'),
      r('\\bSQL injection\\b'),
    ],
    hints: [w('security'), w('integrity')],
  },
  // ---------- P1 — Ethics ----------
  {
    topicCode: 'CS.7',
    paperHint: ['1'],
    keywords: [
      w('ethic'), w('ethical'),
      w('copyright'), w('intellectual property'),
      w('licence'), w('license'),  // British + American spellings
      w('GDPR'), w('data protection'),
      w('whistleblow'),
      r('software\\s+licen[cs]e'),
    ],
    hints: [w('privacy'), w('professional')],
  },
  // ---------- P1 — Databases ----------
  {
    topicCode: 'CS.8',
    paperHint: ['1'],
    keywords: [
      w('database'), w('DBMS'),
      w('primary key'), w('foreign key'), w('candidate key'),
      // SQL keywords are dangerous on their own — bare `JOIN` matched
      // the English word "join" in "join a professional ethical body"
      // and stole 50+ ethics questions to CS.8. Anchor every SQL token
      // to another SQL token so context confirms it. The two-keyword
      // forms are still common in any real SQL question.
      r('SELECT\\s+[^\\n]{1,80}\\s+FROM\\b'),
      r('INSERT\\s+INTO\\b'),
      r('DELETE\\s+FROM\\b'),
      r('UPDATE\\s+\\w+\\s+SET\\b'),
      r('INNER\\s+JOIN|LEFT\\s+JOIN|RIGHT\\s+JOIN|OUTER\\s+JOIN'),
      r('JOIN\\s+\\w+\\s+ON\\b'),
      r('GROUP\\s+BY|ORDER\\s+BY'),
      w('CREATE TABLE'), w('ALTER TABLE'),
      w('normalisation'), w('normalization'),
      w('1NF'), w('2NF'), w('3NF'),
      w('DDL'), w('DML'),
    ],
    // 'transaction' and standalone SQL keywords moved to hints — they
    // appear frequently in non-DB contexts ("commit a transaction" in
    // version control questions, "select" in everyday English).
    hints: [w('table'), w('record'), w('field'), w('SQL'), w('transaction')],
  },

  // ---------- P2 — Algorithm design ----------
  {
    topicCode: 'CS.9',
    paperHint: ['2'],
    keywords: [
      w('pseudocode'), w('flowchart'),
      w('trace table'),
      w('linear search'), w('binary search'),
      w('bubble sort'), w('insertion sort'),
      w('decomposition'),
      w('algorithm'),
      r('state.transition\\s+diagram'),
      r('state.transition\\s+table'),
    ],
    hints: [w('search'), w('sort'), w('iterate')],
  },
  // ---------- P2 — Data types and structures ----------
  {
    topicCode: 'CS.10',
    paperHint: ['2'],
    keywords: [
      r('\\bARRAY\\b'), r('\\bRECORD\\b'), r('\\bFILE\\b'),
      w('1D array'), w('2D array'), w('two.dimensional'),
      w('OPENFILE'), w('READFILE'), w('WRITEFILE'), w('CLOSEFILE'),
      w('text file'), w('binary file'),
    ],
    hints: [w('data type'), w('field')],
  },
  // ---------- P2 — Programming constructs ----------
  {
    topicCode: 'CS.11',
    paperHint: ['2'],
    keywords: [
      r('\\b(FOR|WHILE|REPEAT|IF|CASE)\\b\\s'),
      w('PROCEDURE'), w('FUNCTION'),
      w('RETURN'),
      w('BYREF'), w('BYVAL'),
      r('parameter\\s+(?:passing|by\\s+(?:value|reference))'),
      w('local variable'), w('global variable'),
    ],
    hints: [w('iteration'), w('selection'), w('condition')],
  },
  // ---------- P2 / P4 — Software development & testing ----------
  {
    topicCode: 'CS.12',
    paperHint: ['2'],
    keywords: [
      w('test data'),
      w('normal data'), w('abnormal data'), w('boundary data'), w('extreme data'),
      w('syntax error'), w('logic error'), w('runtime error'),
      w('dry run'),
    ],
    hints: [w('debug'), w('error')],
  },

  // ---------- P3 — Advanced data representation ----------
  {
    topicCode: 'CS.13',
    paperHint: ['3'],
    keywords: [
      w('floating.{0,3}point'), w('mantissa'), w('exponent'),
      w('normalised'), w('normalized'),
      w('indexed sequential'),
      w('hashing function'), w('hash function'),
      w('user.defined data type'), w('composite type'),
      w('composite data type'), w('non.composite data type'),
      w('enumerated type'),
      w('pointer'),
    ],
    hints: [w('precision'), w('range')],
  },
  // ---------- P3 — Internet protocols ----------
  {
    topicCode: 'CS.14',
    paperHint: ['3'],
    keywords: [
      w('TCP/IP'), r('\\bOSI\\b'),
      w('HTTP'), w('HTTPS'), w('FTP'), w('SMTP'), w('POP3'), w('IMAP'),
      r('\\bDNS\\b'),
      w('circuit switching'), w('packet switching'),
    ],
    hints: [w('protocol'), w('layer')],
  },
  // ---------- P3 — Hardware advanced ----------
  {
    topicCode: 'CS.15',
    paperHint: ['3'],
    keywords: [
      w('pipelining'), w('parallel processing'), w('multi.core'),
      w('virtual machine'), w('emulation'),
      w('Karnaugh'), w('K.map'),
      w('half adder'), w('full adder'),
      w('flip.flop'), r('\\bSR\\s+flip'),
      w('Boolean algebra'),
      // CIE 9618 Paper 3 hardware questions consistently ask about
      // RISC/CISC and Flynn's taxonomy (SISD/SIMD/MISD/MIMD). Without
      // these the questions fell straight to "uncategorised".
      r('\\bRISC\\b'), r('\\bCISC\\b'),
      r('\\bSISD\\b'), r('\\bSIMD\\b'), r('\\bMISD\\b'), r('\\bMIMD\\b'),
      w('massively parallel'),
      r('Flynn.{0,3}taxonomy'),
    ],
    hints: [w('parallelism'), w('logic'), w('processor architecture')],
  },
  // ---------- P3 — System software advanced ----------
  {
    topicCode: 'CS.16',
    paperHint: ['3'],
    keywords: [
      w('interrupt'), w('ISR'), w('interrupt handler'),
      w('paging'), w('segmentation'),
      w('scheduling'), w('round robin'),
      r('first.come.{0,3}first.served'),
      w('lexical analysis'), w('syntax analysis'), w('semantic analysis'),
      w('code generation'), w('optimisation'), w('optimization'),
    ],
    hints: [w('memory management'), w('process')],
  },
  // ---------- P3 — Security advanced ----------
  {
    topicCode: 'CS.17',
    paperHint: ['3'],
    keywords: [
      r('\\bSSL\\b'), r('\\bTLS\\b'),
      w('handshake'),
      w('digital certificate'), w('certificate authority'),
    ],
    hints: [w('certificate')],
  },
  // ---------- P3 — Artificial intelligence ----------
  {
    topicCode: 'CS.18',
    paperHint: ['3'],
    keywords: [
      r('\\bAI\\b'), w('artificial intelligence'),
      w('machine learning'),
      w('neural network'), w('deep learning'),
      w('reinforcement learning'),
      w('supervised learning'), w('unsupervised learning'),
      w('training data'),
    ],
    hints: [w('algorithm'), w('model')],
  },

  // ---------- P4 — ADTs and Big-O ----------
  {
    topicCode: 'CS.19',
    paperHint: ['4'],
    keywords: [
      w('stack'), w('queue'),
      w('linked list'),
      w('binary tree'), w('binary search tree'),
      w('hash table'), w('dictionary'),
      r('\\bBig.O\\b'),
      r('\\bO\\(\\s*(?:n|log\\s*n|n\\s*log\\s*n|n\\^?2|1)\\s*\\)'),
      w('complexity analysis'),
    ],
    hints: [w('abstract data type'), w('ADT')],
  },
  // ---------- P4 — Recursion ----------
  {
    topicCode: 'CS.20',
    paperHint: ['4'],
    keywords: [
      w('recursion'), w('recursive'),
      w('base case'),
      w('call stack'),
    ],
    hints: [w('factorial'), w('Fibonacci')],
  },
  // ---------- P4 — Further programming / paradigms ----------
  {
    topicCode: 'CS.21',
    paperHint: ['4'],
    keywords: [
      w('paradigm'),
      w('imperative'), w('declarative'), w('functional'),
      w('exception'),
      r('\\btry\\b'), r('\\bcatch\\b'), r('\\bexcept\\b'),
      r('\\braise\\b'), r('\\bthrow\\b'),
    ],
    hints: [w('error handling')],
  },
  // ---------- P4 — OOP ----------
  {
    topicCode: 'CS.22',
    paperHint: ['4'],
    keywords: [
      w('class'), w('object'),
      w('attribute'), w('method'),
      w('encapsulation'),
      w('inheritance'), w('polymorphism'),
      w('abstract class'), w('interface'),
      r('\\bUML\\b'),
      w('constructor'),
      r('public|private|protected'),
    ],
    hints: [w('subclass'), w('superclass')],
  },
  // ---------- P4 — Low-level programming ----------
  {
    topicCode: 'CS.23',
    paperHint: ['4'],
    keywords: [
      r('\\b(LDR|STR|MOV|BNE|BEQ|CMP|LSL|LSR)\\b'),
      w('addressing mode'),
      w('immediate'), w('indirect addressing'), w('indexed addressing'),
      w('symbolic addressing'),
    ],
    hints: [w('register'), w('instruction')],
  },
  // ---------- P4 — Declarative / Prolog ----------
  {
    topicCode: 'CS.24',
    paperHint: ['4'],
    keywords: [
      w('Prolog'),
      w('unification'), w('backtracking'),
      r(':-'),
    ],
    hints: [w('fact'), w('rule'), w('query')],
  },
  // ---------- P4 — Software development advanced ----------
  {
    topicCode: 'CS.25',
    paperHint: ['4'],
    keywords: [
      w('waterfall'), w('iterative'),
      r('\\bRAD\\b'), w('rapid application'),
      w('agile'), w('scrum'), w('sprint'),
      w('unit test'), w('integration test'),
      w('system test'), w('acceptance test'),
      w('lifecycle'),
    ],
    hints: [w('testing strategy')],
  },
];

export interface ClassifyResult {
  topicCode: string | null;
  confidence: number;
  scores: Array<{ code: string; score: number }>;
}

const MIN_SCORE = 3;

export function classifyText(
  text: string,
  paperNumber: string | null | undefined,
): ClassifyResult {
  const paperFirst = paperNumber ? paperNumber.charAt(0) : null;
  const ranked = RULES_9618
    .map((rule) => {
      const strong = rule.keywords.filter((re) => re.test(text)).length;
      const weak = rule.hints?.filter((re) => re.test(text)).length ?? 0;
      const paperBonus = paperFirst && rule.paperHint?.includes(paperFirst as any) ? 2 : 0;
      const score = strong * 3 + weak + paperBonus;
      return { code: rule.topicCode, score };
    })
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return { topicCode: null, confidence: 0, scores: [] };
  }
  const top = ranked[0];
  const runnerUp = ranked[1]?.score ?? 0;
  // Confidence = base + margin over runner-up, capped at 0.95.
  const margin = top.score - runnerUp;
  const confidence = Math.min(0.95, 0.4 + 0.05 * top.score + 0.04 * margin);
  return { topicCode: top.code, confidence, scores: ranked.slice(0, 3) };
}
