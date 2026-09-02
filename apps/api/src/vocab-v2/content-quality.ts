export interface ContentCandidate {
  definition: string;
  shortExample: string;
  shortTranslation: string;
  alternateExample: string;
  alternateTranslation: string;
  alternateTopic: string;
  collocations: string[];
  wordFamily: string[];
  confusionWords: string[];
  memoryHint: string | null;
}

export interface ContentValidation {
  publishable: boolean;
  errors: string[];
  metrics: { shortWords: number; alternateWords: number };
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function inflectedForms(headword: string) {
  const base = headword.trim().toLowerCase();
  if (!base) return [];
  const forms = new Set([base, `${base}s`, `${base}es`, `${base}ed`, `${base}ing`]);
  if (base.endsWith('e')) {
    forms.add(`${base}d`);
    forms.add(`${base.slice(0, -1)}ing`);
  }
  if (/[^aeiou]y$/.test(base)) {
    forms.add(`${base.slice(0, -1)}ies`);
    forms.add(`${base.slice(0, -1)}ied`);
  }
  return [...forms];
}

export function containsTarget(sentence: string, headword: string) {
  const escaped = inflectedForms(headword)
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return escaped.length > 0 && new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i').test(sentence);
}

function normalise(sentence: string) {
  return sentence.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
}

export function learningAssetQuality(input: {
  headword: string;
  translation: string;
  definition: string;
  contexts: Array<{ sentence: string; translation: string; qualityStatus?: string }>;
}) {
  const contexts = input.contexts.filter((context) => {
    const words = wordCount(context.sentence);
    return (context.qualityStatus ?? 'ready') === 'ready'
      && words >= 4
      && words <= 35
      && containsTarget(context.sentence, input.headword)
      && context.translation.trim().length > 0;
  });
  const errors: string[] = [];
  if (!input.translation.trim()) errors.push('missing_translation');
  if (!input.definition.trim()) errors.push('missing_definition');
  if (!contexts.length) errors.push('missing_focused_translated_context');
  return { publishable: errors.length === 0, errors, focusedContextCount: contexts.length };
}

/**
 * Publication gate for background-generated teaching content. A candidate is
 * never shown to a student merely because an API returned HTTP 200.
 */
export function validateContentCandidate(headword: string, candidate: ContentCandidate): ContentValidation {
  const errors: string[] = [];
  if (!candidate.definition.trim()) errors.push('missing_definition');
  const shortWords = wordCount(candidate.shortExample);
  const alternateWords = wordCount(candidate.alternateExample);
  if (shortWords < 4 || shortWords > 16) errors.push('short_example_length');
  if (alternateWords < 5 || alternateWords > 22) errors.push('alternate_example_length');
  if (!containsTarget(candidate.shortExample, headword)) errors.push('short_example_missing_target');
  if (!containsTarget(candidate.alternateExample, headword)) errors.push('alternate_example_missing_target');
  if (normalise(candidate.shortExample) === normalise(candidate.alternateExample)) errors.push('duplicate_examples');
  if (!candidate.shortTranslation.trim() || !candidate.alternateTranslation.trim()) errors.push('missing_translation');
  if (!candidate.alternateTopic.trim()) errors.push('missing_topic');
  if (candidate.collocations.length > 6) errors.push('collocation_count');
  if (candidate.confusionWords.some((word) => word.toLowerCase() === headword.toLowerCase())) errors.push('self_confusion');
  for (const [key, values] of Object.entries({
    collocations: candidate.collocations,
    wordFamily: candidate.wordFamily,
    confusionWords: candidate.confusionWords,
  })) {
    const clean = values.map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (new Set(clean).size !== clean.length) errors.push(`duplicate_${key}`);
  }
  return { publishable: errors.length === 0, errors, metrics: { shortWords, alternateWords } };
}
