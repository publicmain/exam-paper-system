// CIE A-Level Computer Science 9618 — full syllabus topic tree (first exam 2021).
// Spans Paper 1 (AS Theory) / Paper 2 (AS Programming) / Paper 3 (A2 Advanced
// Theory) / Paper 4 (A2 Practical). Topic codes are stable across paper
// boundaries so cross-paper revision and the rule classifier can address
// them with a single namespace (CS.<section>.<sub>).

export const SYLLABUS_9618 = {
  examBoardCode: 'CIE',
  subjectCode: '9618',
  subjectName: 'Computer Science',
  level: 'A_LEVEL',
  components: [
    // -------- AS: Paper 1 — Theory Fundamentals --------
    {
      code: 'P1',
      name: 'Paper 1 — Theory Fundamentals (AS)',
      topics: [
        { code: 'CS.1', name: 'Information representation', children: [
          { code: 'CS.1.1', name: 'Number bases, two\'s complement, BCD, hex' },
          { code: 'CS.1.2', name: 'Character sets (ASCII, Unicode)' },
          { code: 'CS.1.3', name: 'Multimedia: sound, bitmap & vector images, compression' },
        ]},
        { code: 'CS.2', name: 'Communication', children: [
          { code: 'CS.2.1', name: 'Networks (LAN/WAN, topologies, hardware)' },
          { code: 'CS.2.2', name: 'IP addressing (IPv4, IPv6, public/private)' },
          { code: 'CS.2.3', name: 'Client–server and peer-to-peer' },
        ]},
        { code: 'CS.3', name: 'Hardware', children: [
          { code: 'CS.3.1', name: 'Computer architecture and the fetch–execute cycle' },
          { code: 'CS.3.2', name: 'Logic gates and logic circuits' },
        ]},
        { code: 'CS.4', name: 'Processor fundamentals', children: [
          { code: 'CS.4.1', name: 'CPU architecture (registers, buses)' },
          { code: 'CS.4.2', name: 'Assembly language (LMC instructions)' },
          { code: 'CS.4.3', name: 'Bit manipulation' },
        ]},
        { code: 'CS.5', name: 'System software', children: [
          { code: 'CS.5.1', name: 'Operating systems' },
          { code: 'CS.5.2', name: 'Language translators (compilers, interpreters, assemblers)' },
        ]},
        { code: 'CS.6', name: 'Security, privacy and data integrity', children: [
          { code: 'CS.6.1', name: 'Data security (threats, malware, authentication)' },
          { code: 'CS.6.2', name: 'Data integrity (parity, checksums, check digits)' },
          { code: 'CS.6.3', name: 'Encryption (symmetric, asymmetric, digital signatures)' },
        ]},
        { code: 'CS.7', name: 'Ethics and ownership', children: [
          { code: 'CS.7.1', name: 'Ethics' },
          { code: 'CS.7.2', name: 'Ownership and copyright' },
        ]},
        { code: 'CS.8', name: 'Databases', children: [
          { code: 'CS.8.1', name: 'Database concepts (DBMS, DDL, DML, transactions)' },
          { code: 'CS.8.2', name: 'Normalisation (1NF, 2NF, 3NF)' },
          { code: 'CS.8.3', name: 'Structured Query Language (SQL)' },
        ]},
      ],
    },

    // -------- AS: Paper 2 — Fundamental Problem-solving & Programming --------
    {
      code: 'P2',
      name: 'Paper 2 — Problem-solving & Programming (AS)',
      topics: [
        { code: 'CS.9',  name: 'Algorithm design and problem-solving', children: [
          { code: 'CS.9.1',  name: 'Computational thinking (decomposition, abstraction)' },
          { code: 'CS.9.2',  name: 'Pseudocode and flowcharts' },
          { code: 'CS.9.3',  name: 'Standard algorithms: linear/binary search, bubble/insertion sort' },
          { code: 'CS.9.4',  name: 'Trace tables and dry runs' },
        ]},
        { code: 'CS.10', name: 'Data types and structures', children: [
          { code: 'CS.10.1', name: 'Primitive data types and records' },
          { code: 'CS.10.2', name: '1D and 2D arrays' },
          { code: 'CS.10.3', name: 'File handling (text and binary)' },
        ]},
        { code: 'CS.11', name: 'Programming', children: [
          { code: 'CS.11.1', name: 'Variables, constants, operators, expressions' },
          { code: 'CS.11.2', name: 'Selection (IF / CASE)' },
          { code: 'CS.11.3', name: 'Iteration (FOR / WHILE / REPEAT)' },
          { code: 'CS.11.4', name: 'Procedures, functions, parameters (by value/reference)' },
          { code: 'CS.11.5', name: 'Built-in string and numeric functions' },
        ]},
        { code: 'CS.12', name: 'Software development (AS)', children: [
          { code: 'CS.12.1', name: 'Program design (modular structure, top-down)' },
          { code: 'CS.12.2', name: 'Program testing (dry run, normal/abnormal/boundary data)' },
          { code: 'CS.12.3', name: 'Program correction (syntax, runtime, logic errors)' },
        ]},
      ],
    },

    // -------- A2: Paper 3 — Advanced Theory --------
    {
      code: 'P3',
      name: 'Paper 3 — Advanced Theory (A2)',
      topics: [
        { code: 'CS.13', name: 'Data representation (advanced)', children: [
          { code: 'CS.13.1', name: 'User-defined data types (composite, enumerated, pointer)' },
          { code: 'CS.13.2', name: 'File organisation: sequential, random, indexed-sequential, hash' },
          { code: 'CS.13.3', name: 'Floating-point representation and normalisation' },
        ]},
        { code: 'CS.14', name: 'Communication and Internet technologies', children: [
          { code: 'CS.14.1', name: 'Protocols (TCP/IP stack, HTTP, FTP, SMTP)' },
          { code: 'CS.14.2', name: 'Circuit switching vs packet switching' },
        ]},
        { code: 'CS.15', name: 'Hardware and virtual machines', children: [
          { code: 'CS.15.1', name: 'Processors: pipelining, parallel processing, multi-core' },
          { code: 'CS.15.2', name: 'Virtual machines and emulation' },
          { code: 'CS.15.3', name: 'Boolean algebra, Karnaugh maps, half/full adders, flip-flops' },
        ]},
        { code: 'CS.16', name: 'System software (advanced)', children: [
          { code: 'CS.16.1', name: 'OS purposes: memory management, paging, segmentation, scheduling' },
          { code: 'CS.16.2', name: 'Interrupts and interrupt handling' },
          { code: 'CS.16.3', name: 'Compilation stages: lexical, syntax, semantic, code generation, optimisation' },
        ]},
        { code: 'CS.17', name: 'Security (advanced)', children: [
          { code: 'CS.17.1', name: 'Encryption protocols (SSL/TLS, handshake)' },
          { code: 'CS.17.2', name: 'Digital signatures and digital certificates' },
        ]},
        { code: 'CS.18', name: 'Artificial Intelligence', children: [
          { code: 'CS.18.1', name: 'AI background: rule-based, machine learning, deep learning' },
          { code: 'CS.18.2', name: 'Neural networks and reinforcement learning' },
        ]},
      ],
    },

    // -------- A2: Paper 4 — Practical --------
    {
      code: 'P4',
      name: 'Paper 4 — Practical (A2)',
      topics: [
        { code: 'CS.19', name: 'Computational thinking and problem-solving (advanced)', children: [
          { code: 'CS.19.1', name: 'Abstract data types: stacks, queues, linked lists, dictionaries, trees, hash tables' },
          { code: 'CS.19.2', name: 'Big-O notation, time complexity analysis' },
        ]},
        { code: 'CS.20', name: 'Recursion', children: [
          { code: 'CS.20.1', name: 'Base case, recursive case, call stack' },
          { code: 'CS.20.2', name: 'Iterative vs recursive equivalents' },
        ]},
        { code: 'CS.21', name: 'Further programming', children: [
          { code: 'CS.21.1', name: 'Programming paradigms (imperative, OO, declarative, functional)' },
          { code: 'CS.21.2', name: 'File processing and exception handling' },
        ]},
        { code: 'CS.22', name: 'Object-oriented programming (OOP)', children: [
          { code: 'CS.22.1', name: 'Classes, attributes, methods, encapsulation' },
          { code: 'CS.22.2', name: 'Inheritance, polymorphism, abstract classes, interfaces' },
          { code: 'CS.22.3', name: 'Class diagrams (UML)' },
        ]},
        { code: 'CS.23', name: 'Low-level programming', children: [
          { code: 'CS.23.1', name: 'Assembly: addressing modes, jumps, comparisons' },
          { code: 'CS.23.2', name: 'Bit manipulation and masking' },
        ]},
        { code: 'CS.24', name: 'Declarative programming', children: [
          { code: 'CS.24.1', name: 'Prolog: facts, rules, queries, unification, backtracking' },
        ]},
        { code: 'CS.25', name: 'Software development (advanced)', children: [
          { code: 'CS.25.1', name: 'Lifecycle models: waterfall, iterative, RAD, agile' },
          { code: 'CS.25.2', name: 'Testing strategies: unit, integration, system, acceptance' },
        ]},
      ],
    },
  ],
};
