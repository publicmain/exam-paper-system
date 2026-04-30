// CIE O-Level Mathematics 4024 — chapter tree mirroring the published
// Cambridge syllabus structure. Single component since Paper 1 (short
// answers) and Paper 2 (structured) draw from the same content; we
// preserve the strand-level chapters that teachers use for unit
// planning. Source: school internal taxonomy (no copyrighted CIE
// past-paper content reproduced here).

export const SYLLABUS_4024 = {
  examBoardCode: 'CIE',
  subjectCode: '4024',
  subjectName: 'Mathematics',
  level: 'O_LEVEL',
  components: [
    {
      code: 'OL',
      name: 'O-Level Mathematics',
      topics: [
        {
          code: 'OL.1',
          name: 'Number',
          children: [
            { code: 'OL.1.1', name: 'Integers, fractions, decimals' },
            { code: 'OL.1.2', name: 'Indices and standard form' },
            { code: 'OL.1.3', name: 'Ratio, proportion, rate' },
            { code: 'OL.1.4', name: 'Percentages' },
            { code: 'OL.1.5', name: 'Estimation and approximation' },
          ],
        },
        {
          code: 'OL.2',
          name: 'Algebra',
          children: [
            { code: 'OL.2.1', name: 'Algebraic manipulation and factorisation' },
            { code: 'OL.2.2', name: 'Algebraic fractions' },
            { code: 'OL.2.3', name: 'Linear equations and inequalities' },
            { code: 'OL.2.4', name: 'Simultaneous equations' },
            { code: 'OL.2.5', name: 'Quadratic equations' },
            { code: 'OL.2.6', name: 'Sequences' },
          ],
        },
        {
          code: 'OL.3',
          name: 'Coordinate geometry',
          children: [
            { code: 'OL.3.1', name: 'Gradient and equation of a line' },
            { code: 'OL.3.2', name: 'Distance and midpoint' },
          ],
        },
        {
          code: 'OL.4',
          name: 'Functions and graphs',
          children: [
            { code: 'OL.4.1', name: 'Function notation' },
            { code: 'OL.4.2', name: 'Linear, quadratic, reciprocal, exponential graphs' },
            { code: 'OL.4.3', name: 'Graphical solution of equations' },
          ],
        },
        {
          code: 'OL.5',
          name: 'Geometry',
          children: [
            { code: 'OL.5.1', name: 'Angles and polygons' },
            { code: 'OL.5.2', name: 'Congruence and similarity' },
            { code: 'OL.5.3', name: 'Circle properties and theorems' },
            { code: 'OL.5.4', name: 'Symmetry' },
          ],
        },
        {
          code: 'OL.6',
          name: 'Mensuration',
          children: [
            { code: 'OL.6.1', name: 'Perimeter and area of plane figures' },
            { code: 'OL.6.2', name: 'Arc length and sector area' },
            { code: 'OL.6.3', name: 'Volume and surface area of solids' },
          ],
        },
        {
          code: 'OL.7',
          name: 'Trigonometry',
          children: [
            { code: 'OL.7.1', name: 'Pythagoras and right-angled triangles' },
            { code: 'OL.7.2', name: 'Sine, cosine, tangent ratios' },
            { code: 'OL.7.3', name: 'Sine rule and cosine rule' },
            { code: 'OL.7.4', name: 'Bearings' },
            { code: 'OL.7.5', name: 'Trigonometry in 3D' },
          ],
        },
        {
          code: 'OL.8',
          name: 'Vectors in two dimensions',
          children: [
            { code: 'OL.8.1', name: 'Vector notation and magnitude' },
            { code: 'OL.8.2', name: 'Position vectors and geometry proofs' },
          ],
        },
        {
          code: 'OL.9',
          name: 'Matrices',
          children: [
            { code: 'OL.9.1', name: 'Matrix arithmetic (2×2)' },
            { code: 'OL.9.2', name: 'Determinant and inverse (2×2)' },
          ],
        },
        {
          code: 'OL.10',
          name: 'Transformations',
          children: [
            { code: 'OL.10.1', name: 'Translation, reflection, rotation' },
            { code: 'OL.10.2', name: 'Enlargement (positive, negative, fractional)' },
            { code: 'OL.10.3', name: 'Combined transformations' },
          ],
        },
        {
          code: 'OL.11',
          name: 'Statistics',
          children: [
            { code: 'OL.11.1', name: 'Data presentation (bar, pie, histogram, stem-and-leaf)' },
            { code: 'OL.11.2', name: 'Mean, median, mode, range' },
            { code: 'OL.11.3', name: 'Cumulative frequency, quartiles, box plots' },
          ],
        },
        {
          code: 'OL.12',
          name: 'Probability',
          children: [
            { code: 'OL.12.1', name: 'Single-event probability' },
            { code: 'OL.12.2', name: 'Combined events and tree diagrams' },
          ],
        },
      ],
    },
  ],
};
