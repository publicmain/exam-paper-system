// IELTS Academic — Reading-focused topic tree for the morning quiz. Two
// components correspond to the EnglishLevel enum:
//
//   AUTH  — sourced from authentic Cambridge IELTS past papers (1-19),
//           ingested via the existing PDF pipeline once admin completes
//           the SourceRepository compliance memo for the school's
//           IELTS-prep authorisation.
//
//   HARD  — AI-generated IELTS-style items targeting Band 7+ difficulty,
//           produced by AiQuestionGeneratorService with the prompt template
//           in ai-question-generator.service.ts (system message tagged
//           ielts_hard).
//
// The exam board "CAE" (Cambridge Assessment English) is the legitimate
// publisher of IELTS in partnership with British Council and IDP; we
// register it as a separate ExamBoard from CIE so compliance and reporting
// stay scoped per-licence.
//
// Source: school internal taxonomy (no copyrighted Cambridge IELTS
// past-paper content reproduced here — the structure mirrors the publicly
// described IELTS Reading task types).

const IELTS_TOPICS = [
  {
    code: 'IR.1',
    name: 'Multiple choice (single answer)',
    children: [
      { code: 'IR.1.1', name: 'Locating specific information' },
      { code: 'IR.1.2', name: 'Identifying main idea of a paragraph' },
      { code: 'IR.1.3', name: 'Detail vs distractor discrimination' },
    ],
  },
  {
    code: 'IR.2',
    name: 'Identifying information (True/False/Not Given)',
    children: [
      { code: 'IR.2.1', name: 'Stated explicitly (True)' },
      { code: 'IR.2.2', name: 'Contradicted explicitly (False)' },
      { code: 'IR.2.3', name: 'Information not addressed (Not Given)' },
    ],
  },
  {
    code: 'IR.3',
    name: "Identifying writer's views (Yes/No/Not Given)",
    children: [
      { code: 'IR.3.1', name: 'Distinguishing claim from fact' },
      { code: 'IR.3.2', name: 'Tone and attitude markers' },
    ],
  },
  {
    code: 'IR.4',
    name: 'Matching headings',
    children: [
      { code: 'IR.4.1', name: 'Paragraph main-idea identification' },
      { code: 'IR.4.2', name: 'Paraphrase recognition' },
    ],
  },
  {
    code: 'IR.5',
    name: 'Matching information / sentence endings',
    children: [
      { code: 'IR.5.1', name: 'Cause and effect' },
      { code: 'IR.5.2', name: 'Definition and example' },
      { code: 'IR.5.3', name: 'Comparison and contrast' },
    ],
  },
  {
    code: 'IR.6',
    name: 'Sentence / summary completion (objective)',
    children: [
      { code: 'IR.6.1', name: 'Word from text (≤ 3 words)' },
      { code: 'IR.6.2', name: 'Word from list (matching)' },
      { code: 'IR.6.3', name: 'Number / date completion' },
    ],
  },
  {
    code: 'IR.7',
    name: 'Diagram / table / flow-chart label completion',
    children: [
      { code: 'IR.7.1', name: 'Reading a process diagram' },
      { code: 'IR.7.2', name: 'Filling table with text-extracted values' },
    ],
  },
];

export const SYLLABUS_IELTS = {
  examBoardCode: 'CAE',
  subjectCode: 'IELTS',
  subjectName: 'IELTS Academic Reading',
  level: 'PROFICIENCY',
  components: [
    {
      code: 'AUTH',
      name: 'IELTS authentic (Cambridge 1-19 past papers)',
      topics: IELTS_TOPICS,
    },
    {
      code: 'HARD',
      name: 'IELTS-style hard (AI-generated, Band 7+)',
      topics: IELTS_TOPICS,
    },
  ],
};
