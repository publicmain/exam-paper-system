// CIE A-Level Computer Science 9608 — 12 AS sections + A2 sections
// Mirrors the published CIE syllabus structure used by the school.

export const SYLLABUS_9608 = {
  examBoardCode: 'CIE',
  subjectCode: '9608',
  subjectName: 'Computer Science',
  level: 'A_LEVEL',
  components: [
    {
      code: 'AS',
      name: 'AS Computer Science',
      topics: [
        { code: 'CS.1', name: 'Information Representation', children: [
          { code: 'CS.1.1', name: 'Number representation' },
          { code: 'CS.1.2', name: 'Character & text encoding' },
          { code: 'CS.1.3', name: 'Sound, image and video representation' },
        ]},
        { code: 'CS.2', name: 'Communication & Networks', children: [
          { code: 'CS.2.1', name: 'Networks (LAN/WAN/topology)' },
          { code: 'CS.2.2', name: 'Internet, protocols & TCP/IP stack' },
        ]},
        { code: 'CS.3', name: 'Hardware', children: [
          { code: 'CS.3.1', name: 'Logic gates and Boolean algebra' },
          { code: 'CS.3.2', name: 'Computer architecture & memory' },
          { code: 'CS.3.3', name: 'Input, output and storage devices' },
        ]},
        { code: 'CS.4', name: 'Processor Fundamentals', children: [
          { code: 'CS.4.1', name: 'CPU architecture (registers, ALU, CU)' },
          { code: 'CS.4.2', name: 'Fetch–decode–execute cycle' },
          { code: 'CS.4.3', name: 'Assembly language & addressing modes' },
        ]},
        { code: 'CS.5', name: 'System Software', children: [
          { code: 'CS.5.1', name: 'Operating systems & kernel' },
          { code: 'CS.5.2', name: 'Utility software, compilers & interpreters' },
        ]},
        { code: 'CS.6', name: 'Security & Data Integrity', children: [
          { code: 'CS.6.1', name: 'Encryption, hashing & digital signatures' },
          { code: 'CS.6.2', name: 'Validation, verification, error checking' },
        ]},
        { code: 'CS.7', name: 'Ethics & Intellectual Property', children: [] },
        { code: 'CS.8', name: 'Databases', children: [
          { code: 'CS.8.1', name: 'Relational model, keys, normalisation' },
          { code: 'CS.8.2', name: 'SQL (SELECT/INSERT/UPDATE/DELETE)' },
          { code: 'CS.8.3', name: 'DBMS, transactions & concurrency' },
        ]},
        { code: 'CS.9', name: 'Algorithm Design & Problem Solving', children: [
          { code: 'CS.9.1', name: 'Decomposition, abstraction, structured design' },
          { code: 'CS.9.2', name: 'Algorithm tracing and complexity' },
        ]},
        { code: 'CS.10', name: 'Data Types & Structures', children: [
          { code: 'CS.10.1', name: 'Primitive types, records, arrays' },
          { code: 'CS.10.2', name: 'Linked lists, stacks, queues' },
          { code: 'CS.10.3', name: 'Trees and graphs (intro)' },
        ]},
        { code: 'CS.11', name: 'Programming', children: [
          { code: 'CS.11.1', name: 'Pseudocode constructs (selection, iteration)' },
          { code: 'CS.11.2', name: 'Procedures, functions, parameters' },
          { code: 'CS.11.3', name: 'File handling (text & random)' },
        ]},
        { code: 'CS.12', name: 'Software Development', children: [
          { code: 'CS.12.1', name: 'Lifecycle models (waterfall, agile, RAD)' },
          { code: 'CS.12.2', name: 'Testing strategies (white-box, black-box)' },
        ]},
      ],
    },
    {
      code: 'A2',
      name: 'A2 Computer Science',
      topics: [
        { code: 'CS.13', name: 'Data Representation (advanced)', children: [
          { code: 'CS.13.1', name: 'Floating-point representation & precision' },
        ]},
        { code: 'CS.14', name: 'Communication (advanced)', children: [
          { code: 'CS.14.1', name: 'Circuit, packet & message switching' },
          { code: 'CS.14.2', name: 'Protocols (HTTP, HTTPS, FTP, SMTP, TLS)' },
        ]},
        { code: 'CS.15', name: 'Hardware (advanced)', children: [
          { code: 'CS.15.1', name: 'Boolean algebra simplification (K-maps)' },
          { code: 'CS.15.2', name: 'Flip-flops and sequential logic' },
        ]},
        { code: 'CS.16', name: 'System Software (advanced)', children: [
          { code: 'CS.16.1', name: 'Process scheduling & memory management' },
          { code: 'CS.16.2', name: 'Virtual machines, intermediate code' },
        ]},
        { code: 'CS.17', name: 'Security (advanced)', children: [
          { code: 'CS.17.1', name: 'Asymmetric encryption, PKI, digital certificates' },
        ]},
        { code: 'CS.18', name: 'Artificial Intelligence', children: [
          { code: 'CS.18.1', name: 'Machine learning: supervised vs unsupervised' },
          { code: 'CS.18.2', name: 'Neural networks (intro), search algorithms' },
        ]},
        { code: 'CS.19', name: 'Computational Thinking & Problem Solving', children: [
          { code: 'CS.19.1', name: 'Recursion and divide & conquer' },
          { code: 'CS.19.2', name: 'Big-O analysis, sorting and searching' },
          { code: 'CS.19.3', name: 'Object-oriented programming concepts' },
        ]},
      ],
    },
  ],
};
