// CIE A-Level Physics 9702 — representative topic tree
// Source: school internal taxonomy mirroring published syllabus structure

export const SYLLABUS_9702 = {
  examBoardCode: 'CIE',
  subjectCode: '9702',
  subjectName: 'Physics',
  level: 'A_LEVEL',
  components: [
    {
      code: 'AS',
      name: 'AS Physics',
      topics: [
        { code: 'PH.1', name: 'Physical quantities and units', children: [
          { code: 'PH.1.1', name: 'SI units' },
          { code: 'PH.1.2', name: 'Errors and uncertainties' },
        ]},
        { code: 'PH.2', name: 'Kinematics', children: [
          { code: 'PH.2.1', name: 'Equations of motion' },
          { code: 'PH.2.2', name: 'Projectile motion' },
        ]},
        { code: 'PH.3', name: 'Dynamics', children: [
          { code: 'PH.3.1', name: "Newton's laws" },
          { code: 'PH.3.2', name: 'Linear momentum' },
        ]},
        { code: 'PH.4', name: 'Forces, density and pressure', children: [] },
        { code: 'PH.5', name: 'Work, energy and power', children: [] },
        { code: 'PH.6', name: 'Deformation of solids', children: [] },
        { code: 'PH.7', name: 'Waves', children: [
          { code: 'PH.7.1', name: 'Progressive waves' },
          { code: 'PH.7.2', name: 'Stationary waves' },
          { code: 'PH.7.3', name: 'Doppler effect (basic)' },
        ]},
        { code: 'PH.8', name: 'Superposition', children: [
          { code: 'PH.8.1', name: 'Diffraction' },
          { code: 'PH.8.2', name: 'Interference' },
        ]},
        { code: 'PH.9', name: 'Electricity', children: [
          { code: 'PH.9.1', name: 'Current, voltage, resistance' },
          { code: 'PH.9.2', name: 'D.C. circuits' },
        ]},
        { code: 'PH.10', name: 'Particle physics (intro)', children: [] },
      ],
    },
    {
      code: 'A2',
      name: 'A2 Physics',
      topics: [
        { code: 'PH.11', name: 'Motion in a circle', children: [] },
        { code: 'PH.12', name: 'Gravitational fields', children: [] },
        { code: 'PH.13', name: 'Temperature', children: [] },
        { code: 'PH.14', name: 'Ideal gases', children: [] },
        { code: 'PH.15', name: 'Thermodynamics', children: [] },
        { code: 'PH.16', name: 'Oscillations', children: [] },
        { code: 'PH.17', name: 'Electric fields', children: [] },
        { code: 'PH.18', name: 'Capacitance', children: [] },
        { code: 'PH.19', name: 'Magnetic fields', children: [] },
        { code: 'PH.20', name: 'Electromagnetic induction', children: [] },
        { code: 'PH.21', name: 'Alternating currents', children: [] },
        { code: 'PH.22', name: 'Quantum physics', children: [] },
        { code: 'PH.23', name: 'Nuclear physics', children: [] },
        { code: 'PH.24', name: 'Medical physics', children: [] },
        { code: 'PH.25', name: 'Astronomy and cosmology', children: [] },
      ],
    },
  ],
};
