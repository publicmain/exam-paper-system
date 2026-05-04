// CIE A-Level Mathematics 9709 — runtime seed.
// Mirror of apps/api/prisma/seed-data/topics-9709.ts but expanded to include
// Pure Math 2 (P2), Mechanics 2 (M2), and Probability & Statistics 2 (S2)
// so paperVariant 2x / 5x / 7x past papers can resolve a component.
//
// Source: school internal taxonomy (no copyrighted CIE content reproduced).

export const SYLLABUS_9709 = {
  examBoardCode: 'CIE',
  subjectCode: '9709',
  subjectName: 'Mathematics',
  level: 'A_LEVEL',
  components: [
    {
      code: 'P1',
      name: 'Pure Mathematics 1',
      topics: [
        { code: 'P1.1', name: 'Quadratics', children: [
          { code: 'P1.1.1', name: 'Completing the square' },
          { code: 'P1.1.2', name: 'Discriminant' },
          { code: 'P1.1.3', name: 'Quadratic inequalities' },
        ]},
        { code: 'P1.2', name: 'Functions', children: [
          { code: 'P1.2.1', name: 'Domain and range' },
          { code: 'P1.2.2', name: 'Composite functions' },
          { code: 'P1.2.3', name: 'Inverse functions' },
        ]},
        { code: 'P1.3', name: 'Coordinate geometry', children: [
          { code: 'P1.3.1', name: 'Equation of a line' },
          { code: 'P1.3.2', name: 'Equation of a circle' },
        ]},
        { code: 'P1.4', name: 'Circular measure', children: [
          { code: 'P1.4.1', name: 'Arc length and sector area' },
        ]},
        { code: 'P1.5', name: 'Trigonometry', children: [
          { code: 'P1.5.1', name: 'Trig graphs and equations' },
          { code: 'P1.5.2', name: 'Trig identities' },
        ]},
        { code: 'P1.6', name: 'Series', children: [
          { code: 'P1.6.1', name: 'Binomial expansion' },
          { code: 'P1.6.2', name: 'Arithmetic progressions' },
          { code: 'P1.6.3', name: 'Geometric progressions' },
        ]},
        { code: 'P1.7', name: 'Differentiation', children: [
          { code: 'P1.7.1', name: 'Power rule' },
          { code: 'P1.7.2', name: 'Stationary points' },
        ]},
        { code: 'P1.8', name: 'Integration', children: [
          { code: 'P1.8.1', name: 'Indefinite integration' },
          { code: 'P1.8.2', name: 'Area under curve' },
        ]},
      ],
    },
    {
      code: 'P2',
      name: 'Pure Mathematics 2',
      topics: [
        { code: 'P2.1', name: 'Algebra (modulus, polynomials)', children: [] },
        { code: 'P2.2', name: 'Logarithmic and exponential functions', children: [] },
        { code: 'P2.3', name: 'Trigonometry (R sin form)', children: [] },
        { code: 'P2.4', name: 'Differentiation (chain / product / quotient)', children: [] },
        { code: 'P2.5', name: 'Integration (substitution, by parts)', children: [] },
        { code: 'P2.6', name: 'Numerical solution of equations', children: [] },
      ],
    },
    {
      code: 'P3',
      name: 'Pure Mathematics 3',
      topics: [
        { code: 'P3.1', name: 'Algebra', children: [
          { code: 'P3.1.1', name: 'Modulus function' },
          { code: 'P3.1.2', name: 'Polynomial division' },
          { code: 'P3.1.3', name: 'Partial fractions' },
        ]},
        { code: 'P3.2', name: 'Logarithmic and exponential functions', children: [] },
        { code: 'P3.3', name: 'Trigonometry (advanced)', children: [
          { code: 'P3.3.1', name: 'Compound angle formulae' },
          { code: 'P3.3.2', name: 'R sin(x+a) form' },
        ]},
        { code: 'P3.4', name: 'Differentiation (advanced)', children: [
          { code: 'P3.4.1', name: 'Chain / product / quotient rule' },
          { code: 'P3.4.2', name: 'Implicit differentiation' },
          { code: 'P3.4.3', name: 'Parametric differentiation' },
        ]},
        { code: 'P3.5', name: 'Integration (advanced)', children: [
          { code: 'P3.5.1', name: 'Integration by substitution' },
          { code: 'P3.5.2', name: 'Integration by parts' },
        ]},
        { code: 'P3.6', name: 'Numerical solutions', children: [] },
        { code: 'P3.7', name: 'Vectors', children: [] },
        { code: 'P3.8', name: 'Differential equations', children: [] },
        { code: 'P3.9', name: 'Complex numbers', children: [] },
      ],
    },
    {
      code: 'M1',
      name: 'Mechanics',
      topics: [
        { code: 'M1.1', name: 'Forces and equilibrium', children: [] },
        { code: 'M1.2', name: 'Kinematics', children: [] },
        { code: 'M1.3', name: 'Momentum', children: [] },
        { code: 'M1.4', name: "Newton's laws of motion", children: [] },
        { code: 'M1.5', name: 'Energy, work and power', children: [] },
      ],
    },
    {
      code: 'M2',
      name: 'Mechanics 2',
      topics: [
        { code: 'M2.1', name: 'Centre of mass', children: [] },
        { code: 'M2.2', name: 'Moments and equilibrium of rigid bodies', children: [] },
        { code: 'M2.3', name: 'Uniform motion in a circle', children: [] },
        { code: 'M2.4', name: 'Hooke\'s law and elastic strings', children: [] },
        { code: 'M2.5', name: 'Linear motion under variable force', children: [] },
      ],
    },
    {
      code: 'S1',
      name: 'Probability & Statistics 1',
      topics: [
        { code: 'S1.1', name: 'Representation of data', children: [] },
        { code: 'S1.2', name: 'Permutations and combinations', children: [] },
        { code: 'S1.3', name: 'Probability', children: [] },
        { code: 'S1.4', name: 'Discrete random variables', children: [] },
        { code: 'S1.5', name: 'Normal distribution', children: [] },
      ],
    },
    {
      code: 'S2',
      name: 'Probability & Statistics 2',
      topics: [
        { code: 'S2.1', name: 'Poisson distribution', children: [] },
        { code: 'S2.2', name: 'Linear combinations of random variables', children: [] },
        { code: 'S2.3', name: 'Continuous random variables', children: [] },
        { code: 'S2.4', name: 'Sampling and estimation', children: [] },
        { code: 'S2.5', name: 'Hypothesis testing', children: [] },
      ],
    },
  ],
};
