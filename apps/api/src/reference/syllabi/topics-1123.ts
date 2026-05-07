// CIE O-Level English Language 1123 — chapter tree mirroring the published
// Cambridge syllabus structure. Single component covering both Paper 1
// (Writing) and Paper 2 (Reading); the morning quiz uses the Reading-side
// topics (comprehension + summary) for objective items, since Writing is
// out of MVP scope. Source: school internal taxonomy (no copyrighted CIE
// past-paper content reproduced here).

export const SYLLABUS_1123 = {
  examBoardCode: 'CIE',
  subjectCode: '1123',
  subjectName: 'English Language',
  level: 'O_LEVEL',
  components: [
    {
      code: 'OL',
      name: 'O-Level English Language',
      topics: [
        {
          code: 'EL.1',
          name: 'Reading comprehension',
          children: [
            { code: 'EL.1.1', name: 'Literal — finding stated facts' },
            { code: 'EL.1.2', name: 'Inferential — drawing conclusions' },
            { code: 'EL.1.3', name: "Author's purpose and tone" },
            { code: 'EL.1.4', name: 'Vocabulary in context' },
            { code: 'EL.1.5', name: 'Reference / pronoun resolution' },
          ],
        },
        {
          code: 'EL.2',
          name: 'Information transfer / non-fiction',
          children: [
            { code: 'EL.2.1', name: 'Locating specific information' },
            { code: 'EL.2.2', name: 'Comparing texts and viewpoints' },
            { code: 'EL.2.3', name: 'Distinguishing fact from opinion' },
          ],
        },
        {
          code: 'EL.3',
          name: 'Summary writing (objective: matching, sequencing)',
          children: [
            { code: 'EL.3.1', name: 'Identifying main ideas' },
            { code: 'EL.3.2', name: 'Excluding redundant detail' },
            { code: 'EL.3.3', name: 'Logical sequencing' },
          ],
        },
        {
          code: 'EL.4',
          name: 'Grammar and usage',
          children: [
            { code: 'EL.4.1', name: 'Tense and aspect' },
            { code: 'EL.4.2', name: 'Articles, determiners, quantifiers' },
            { code: 'EL.4.3', name: 'Connectives and discourse markers' },
            { code: 'EL.4.4', name: 'Subject-verb agreement' },
            { code: 'EL.4.5', name: 'Modals and conditionals' },
            { code: 'EL.4.6', name: 'Active vs passive voice' },
          ],
        },
        {
          code: 'EL.5',
          name: 'Vocabulary',
          children: [
            { code: 'EL.5.1', name: 'Synonyms and antonyms' },
            { code: 'EL.5.2', name: 'Collocations and fixed phrases' },
            { code: 'EL.5.3', name: 'Word formation (prefixes, suffixes)' },
            { code: 'EL.5.4', name: 'Idioms and phrasal verbs' },
          ],
        },
      ],
    },
  ],
};
