interface AnswerRecord {
  response?: unknown;
  isCorrect?: boolean | null;
  completedAt?: Date | null;
  firstResponse?: unknown;
  firstIsCorrect?: boolean | null;
  firstAnsweredAt?: Date | null;
}

/** New formal results use the immutable first answer as a whole. Legacy rows
 * without a first-answer timestamp retain their original stored result; reads
 * never manufacture historical evidence or regrade against today's dictionary. */
export function formalAnswerOf(item: AnswerRecord) {
  return item.firstAnsweredAt != null
    ? { response: item.firstResponse, isCorrect: item.firstIsCorrect, completedAt: item.firstAnsweredAt }
    : { response: item.response, isCorrect: item.isCorrect, completedAt: item.completedAt };
}
