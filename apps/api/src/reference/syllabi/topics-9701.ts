// CIE A-Level Chemistry 9701 — runtime seed.
// Five paper components per the published CIE 9701 specification:
//   P1 — MCQ (40 multiple-choice items)
//   P2 — AS Structured Questions
//   P3 — Advanced Practical Skills
//   P4 — A2 Structured Questions
//   P5 — Planning, Analysis and Evaluation (PAE)
// Topic tree mirrors the official syllabus learning objectives grouped
// into Physical / Inorganic / Organic / Analysis. Source: school
// internal taxonomy (no copyrighted CIE content reproduced).

export const SYLLABUS_9701 = {
  examBoardCode: 'CIE',
  subjectCode: '9701',
  subjectName: 'Chemistry',
  level: 'A_LEVEL',
  components: [
    {
      code: 'P1',
      name: 'Multiple Choice',
      topics: [
        { code: 'P1.MCQ', name: 'AS-level multiple choice across all 9701 topics', children: [] },
      ],
    },
    {
      code: 'P2',
      name: 'AS Structured Questions',
      topics: [
        { code: 'CH.1', name: 'Atomic structure', children: [
          { code: 'CH.1.1', name: 'Sub-atomic particles' },
          { code: 'CH.1.2', name: 'Electronic configuration' },
          { code: 'CH.1.3', name: 'Ionisation energies' },
        ]},
        { code: 'CH.2', name: 'Atoms, molecules and stoichiometry', children: [
          { code: 'CH.2.1', name: 'Relative masses, the mole' },
          { code: 'CH.2.2', name: 'Empirical and molecular formulae' },
          { code: 'CH.2.3', name: 'Equations and reacting masses' },
        ]},
        { code: 'CH.3', name: 'Chemical bonding', children: [
          { code: 'CH.3.1', name: 'Ionic / covalent / metallic bonding' },
          { code: 'CH.3.2', name: 'Shapes of molecules (VSEPR)' },
          { code: 'CH.3.3', name: 'Intermolecular forces' },
        ]},
        { code: 'CH.4', name: 'States of matter', children: [
          { code: 'CH.4.1', name: 'Ideal gas equation pV = nRT' },
          { code: 'CH.4.2', name: 'Liquid / solid lattices' },
        ]},
        { code: 'CH.5', name: 'Chemical energetics', children: [
          { code: 'CH.5.1', name: 'Enthalpy changes; Hess\'s law' },
          { code: 'CH.5.2', name: 'Bond energies' },
        ]},
        { code: 'CH.6', name: 'Electrochemistry', children: [
          { code: 'CH.6.1', name: 'Redox; oxidation numbers' },
          { code: 'CH.6.2', name: 'Electrolysis' },
        ]},
        { code: 'CH.7', name: 'Equilibria', children: [
          { code: 'CH.7.1', name: 'Dynamic equilibrium; Kc / Kp' },
          { code: 'CH.7.2', name: 'Brønsted-Lowry acids and bases' },
        ]},
        { code: 'CH.8', name: 'Reaction kinetics', children: [
          { code: 'CH.8.1', name: 'Rate, activation energy, catalysts' },
        ]},
        { code: 'CH.9', name: 'Periodicity', children: [
          { code: 'CH.9.1', name: 'Group trends and period 3' },
        ]},
        { code: 'CH.10', name: 'Group 2 elements', children: [] },
        { code: 'CH.11', name: 'Group 17 elements (halogens)', children: [] },
        { code: 'CH.12', name: 'Nitrogen and sulfur chemistry', children: [] },
        { code: 'CH.13', name: 'Introduction to organic chemistry', children: [
          { code: 'CH.13.1', name: 'Functional groups; nomenclature' },
          { code: 'CH.13.2', name: 'Isomerism' },
          { code: 'CH.13.3', name: 'Reaction mechanisms' },
        ]},
        { code: 'CH.14', name: 'Hydrocarbons', children: [
          { code: 'CH.14.1', name: 'Alkanes' },
          { code: 'CH.14.2', name: 'Alkenes' },
        ]},
        { code: 'CH.15', name: 'Halogen derivatives', children: [] },
        { code: 'CH.16', name: 'Hydroxy compounds (alcohols / phenols)', children: [] },
        { code: 'CH.17', name: 'Carbonyl compounds', children: [] },
        { code: 'CH.18', name: 'Carboxylic acids and derivatives', children: [] },
        { code: 'CH.19', name: 'Nitrogen compounds (amines / amides / amino acids)', children: [] },
        { code: 'CH.20', name: 'Polymerisation', children: [] },
        { code: 'CH.21', name: 'Analytical techniques', children: [
          { code: 'CH.21.1', name: 'Mass spectrometry' },
          { code: 'CH.21.2', name: 'IR / NMR spectroscopy' },
          { code: 'CH.21.3', name: 'Chromatography' },
        ]},
      ],
    },
    {
      code: 'P3',
      name: 'Advanced Practical Skills',
      topics: [
        { code: 'P3.1', name: 'Volumetric analysis (titration)', children: [] },
        { code: 'P3.2', name: 'Qualitative inorganic analysis', children: [] },
        { code: 'P3.3', name: 'Reaction kinetics experiments', children: [] },
        { code: 'P3.4', name: 'Enthalpy determination', children: [] },
      ],
    },
    {
      code: 'P4',
      name: 'A2 Structured Questions',
      topics: [
        { code: 'CH.A1', name: 'Lattice energy and Born-Haber cycles', children: [] },
        { code: 'CH.A2', name: 'Electrochemistry (electrode potentials)', children: [] },
        { code: 'CH.A3', name: 'Equilibria (Ksp, Ka, Kb, buffers)', children: [] },
        { code: 'CH.A4', name: 'Reaction kinetics (orders of reaction)', children: [] },
        { code: 'CH.A5', name: 'Entropy and Gibbs free energy', children: [] },
        { code: 'CH.A6', name: 'Transition elements', children: [
          { code: 'CH.A6.1', name: 'Electronic configuration; ligands' },
          { code: 'CH.A6.2', name: 'Coloured ions; complex stability' },
        ]},
        { code: 'CH.A7', name: 'Organic synthesis (multi-step)', children: [] },
        { code: 'CH.A8', name: 'Aromatic chemistry (benzene, phenol)', children: [] },
        { code: 'CH.A9', name: 'Stereochemistry', children: [] },
      ],
    },
    {
      code: 'P5',
      name: 'Planning, Analysis & Evaluation',
      topics: [
        { code: 'P5.1', name: 'Experimental planning', children: [] },
        { code: 'P5.2', name: 'Data analysis and graph drawing', children: [] },
        { code: 'P5.3', name: 'Evaluation of procedures and uncertainties', children: [] },
      ],
    },
  ],
};
