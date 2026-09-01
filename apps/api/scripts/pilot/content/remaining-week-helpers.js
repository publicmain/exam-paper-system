'use strict';

const TFNG = [
  { key: 'A', text: 'TRUE' },
  { key: 'B', text: 'FALSE' },
  { key: 'C', text: 'NOT GIVEN' },
];

const P = (...paras) => paras.join('\n\n');

function tf(answer, stem, evidence, explanation) {
  return {
    taskType: 'true_false_not_given',
    questionType: 'mcq',
    marks: 1,
    options: TFNG,
    answer,
    stem,
    evidence,
    explanation,
  };
}

function choice(taskType, answer, stem, evidence, explanation, texts) {
  return {
    taskType,
    questionType: 'mcq',
    marks: 1,
    options: texts.map((text, i) => ({ key: String.fromCharCode(65 + i), text })),
    answer,
    stem,
    evidence,
    explanation,
  };
}

function written(taskType, marks, answer, stem, evidence, rubric, explanation, accept = null) {
  return {
    taskType,
    questionType: 'short_answer',
    marks,
    options: null,
    answer,
    ...(accept ? { accept } : {}),
    stem,
    evidence,
    rubric,
    explanation,
  };
}

function contextFor(passage, surfaceForm) {
  const sentences = passage
    .split(/\n\s*\n/)
    .flatMap((paragraph) => paragraph.match(/[^.!?]+[.!?]/g) ?? [paragraph])
    .map((sentence) => sentence.trim());
  const found = sentences.find((sentence) => sentence.includes(surfaceForm));
  if (!found) throw new Error(`No context sentence contains ${surfaceForm}`);
  return found;
}

function wordsFor(passage, rows) {
  return rows.map(([headword, surfaceForm, phonetic, pos, translation, definition]) => ({
    headword,
    surfaceForm,
    phonetic,
    pos,
    translation,
    definition,
    context: contextFor(passage, surfaceForm),
  }));
}

module.exports = { P, tf, choice, written, wordsFor };
