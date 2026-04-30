// Edexcel International GCSE Mathematics A (4MA1) — strand-based
// chapter tree following the published Pearson specification.
// 4MA1 is offered at Foundation and Higher tier; the topics below are
// the Higher-tier content that international schools most commonly
// teach (Foundation is a strict subset). Single component since the
// content is shared across Paper 1H and Paper 2H. Source: school
// internal taxonomy (no copyrighted Pearson past-paper content
// reproduced here).

export const SYLLABUS_4MA1 = {
  examBoardCode: 'Edexcel',
  subjectCode: '4MA1',
  subjectName: 'Mathematics A',
  level: 'IGCSE',
  components: [
    {
      code: 'H',
      name: 'IGCSE Mathematics A — Higher Tier',
      topics: [
        {
          code: 'IG.1',
          name: 'Number',
          children: [
            { code: 'IG.1.1', name: 'Integers, fractions, decimals, percentages' },
            { code: 'IG.1.2', name: 'Powers, roots, indices, standard form' },
            { code: 'IG.1.3', name: 'Ratio, proportion, rates of change' },
            { code: 'IG.1.4', name: 'Set notation and Venn diagrams' },
            { code: 'IG.1.5', name: 'Bounds and accuracy' },
          ],
        },
        {
          code: 'IG.2',
          name: 'Algebra',
          children: [
            { code: 'IG.2.1', name: 'Algebraic manipulation and factorisation' },
            { code: 'IG.2.2', name: 'Algebraic fractions' },
            { code: 'IG.2.3', name: 'Linear equations and inequalities' },
            { code: 'IG.2.4', name: 'Simultaneous equations (linear and non-linear)' },
            { code: 'IG.2.5', name: 'Quadratic equations and the discriminant' },
            { code: 'IG.2.6', name: 'Direct and inverse proportion' },
          ],
        },
        {
          code: 'IG.3',
          name: 'Sequences, functions and graphs',
          children: [
            { code: 'IG.3.1', name: 'Arithmetic and quadratic sequences' },
            { code: 'IG.3.2', name: 'Function notation and inverse functions' },
            { code: 'IG.3.3', name: 'Graphs of linear, quadratic, cubic, reciprocal, exponential' },
            { code: 'IG.3.4', name: 'Graph transformations' },
            { code: 'IG.3.5', name: 'Differentiation and stationary points' },
          ],
        },
        {
          code: 'IG.4',
          name: 'Geometry and measures',
          children: [
            { code: 'IG.4.1', name: 'Angles, polygons, parallel lines' },
            { code: 'IG.4.2', name: 'Congruence and similarity' },
            { code: 'IG.4.3', name: 'Circle theorems' },
            { code: 'IG.4.4', name: 'Mensuration: perimeter, area, surface area, volume' },
            { code: 'IG.4.5', name: 'Arc length and sector area' },
          ],
        },
        {
          code: 'IG.5',
          name: 'Trigonometry and Pythagoras',
          children: [
            { code: 'IG.5.1', name: 'Pythagoras and right-angled trigonometry' },
            { code: 'IG.5.2', name: 'Sine rule and cosine rule' },
            { code: 'IG.5.3', name: 'Area of a triangle (1/2 ab sin C)' },
            { code: 'IG.5.4', name: 'Trigonometry in 3D' },
            { code: 'IG.5.5', name: 'Trigonometric graphs and equations' },
          ],
        },
        {
          code: 'IG.6',
          name: 'Vectors and transformation geometry',
          children: [
            { code: 'IG.6.1', name: 'Vector notation, addition, magnitude' },
            { code: 'IG.6.2', name: 'Position vectors and geometric proof' },
            { code: 'IG.6.3', name: 'Translation, reflection, rotation, enlargement' },
            { code: 'IG.6.4', name: 'Combined transformations' },
          ],
        },
        {
          code: 'IG.7',
          name: 'Statistics',
          children: [
            { code: 'IG.7.1', name: 'Data presentation (bar, pie, histogram, frequency polygon)' },
            { code: 'IG.7.2', name: 'Averages and spread' },
            { code: 'IG.7.3', name: 'Cumulative frequency and box plots' },
            { code: 'IG.7.4', name: 'Histograms with unequal class widths' },
          ],
        },
        {
          code: 'IG.8',
          name: 'Probability',
          children: [
            { code: 'IG.8.1', name: 'Single and combined events' },
            { code: 'IG.8.2', name: 'Tree diagrams and conditional probability' },
            { code: 'IG.8.3', name: 'Probability with set notation' },
          ],
        },
      ],
    },
  ],
};
