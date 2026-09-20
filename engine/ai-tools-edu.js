/**
 * The AI tools for schools and colleges: the paperwork a teacher does at
 * ten at night — question papers and their marking schemes, lesson plans
 * and worksheets, report card comments, marking rubrics, the message home,
 * and the textbook question a pupil is stuck on.
 *
 * Same shape as engine/ai-tools.js, which also holds the mount code; this
 * file only adds specs to window.AI_TOOLS and never touches the DOM, so the
 * builder can run it in Node. Every prompt that expects structure says
 * "return only JSON" and names the keys.
 */
(function () {
  'use strict';
  window.AI_TOOLS = window.AI_TOOLS || {};
  const COMMON = ['/engine/zip.js', '/engine/sheet.js', '/engine/pdf-text.js', '/engine/pii.js', '/engine/render-ai.js', '/engine/ai-tools.js', '/engine/ai-tools-edu.js'];
  const JSON_ONLY = 'Return only JSON, with no explanation before or after it and no markdown fences. Inside JSON strings write line breaks as \\n, never as a raw newline. Use null for anything not present; never invent a value.';

  const csvDownload = (name) => (data, ctx) => {
    const list = Array.isArray(data) ? data : (data.rows || data.items || [data]);
    const rows = ctx.sheet.objectsToRows(list);
    return [
      { name: name + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
      { name: name + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, name) }
    ];
  };
  /** A download built from the parsed answer: markdown or plain text. */
  const fileDownload = (name, type, build) => (data, ctx) => [{ name, blob: () => new Blob([build(data, ctx)], { type }) }];
  const arr = (v) => Array.isArray(v) ? v : [];
  const line = (v) => v == null || v === '' ? '' : String(v);

  const BOARDS = [
    { value: 'CBSE', label: 'CBSE' }, { value: 'ICSE / ISC', label: 'ICSE / ISC' }, { value: 'State board', label: 'State board' },
    { value: 'IGCSE (Cambridge)', label: 'IGCSE (Cambridge)' }, { value: 'IB', label: 'IB (MYP / DP)' },
    { value: 'A-level', label: 'A-level / AS' }, { value: 'University', label: 'University / college' }, { value: 'No board — school scheme of work', label: 'No board — our own scheme' }
  ];
  const LANGUAGES = [
    { value: '', label: 'English only' }, { value: 'Hindi', label: 'Hindi' }, { value: 'Marathi', label: 'Marathi' }, { value: 'Gujarati', label: 'Gujarati' },
    { value: 'Tamil', label: 'Tamil' }, { value: 'Telugu', label: 'Telugu' }, { value: 'Kannada', label: 'Kannada' }, { value: 'Bengali', label: 'Bengali' }, { value: 'Urdu', label: 'Urdu' }
  ];

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['question-paper-writer'] = {
    title: 'Question Paper Generator',
    short: 'Question Paper',
    description: 'A full question paper from your blueprint — sections, general instructions, marks against every question — with a separate marking scheme that gives the model answer and where each mark is earned.',
    keywords: ['question paper generator', 'cbse question paper maker', 'sample paper generator with answers', 'exam paper generator ai', 'blueprint based question paper', 'marking scheme generator', 'unit test paper maker', 'icse igcse question paper'],
    glyph: 'i-ai-paper',
    glyphSvg: '<symbol id="i-ai-paper" viewBox="0 0 24 24">\n  <path d="M5.5 2.8h8L18.5 8v13.2H5.5z"/>\n  <path d="M13.5 2.8V8h5" class="thin"/>\n  <path d="M8 12h5M8 15h5M8 18h3.5" class="thin"/>\n  <path d="M14.8 11.4h2.2M14.8 14.4h2.2M14.8 17.4h2.2" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Write the paper', resultTitle: 'Paper and marking scheme',
    privacy: 'The topics, the blueprint and the options you set are sent to the model. No pupil names or marks are involved in this one.',
    inputs: [{ key: 'topics', label: 'Topics or chapters, and anything to leave out', type: 'text+file', accept: '.txt,.md,.pdf,.csv', rows: 9, placeholder: 'List the chapters or topics the paper must cover, in the words your syllabus uses. Say plainly what has not been taught yet, so it stays out of the paper. Add any format the board insists on — internal choice, a case-study question, a diagram.' }],
    options: [
      { key: 'subject', label: 'Subject', type: 'text', default: 'Science' },
      { key: 'grade', label: 'Class or year', type: 'text', default: 'Class 10' },
      { key: 'board', label: 'Board or syllabus', type: 'select', default: 'CBSE', options: BOARDS },
      { key: 'marks', label: 'Total marks', type: 'number', default: 40 },
      { key: 'duration', label: 'Duration', type: 'text', default: '90 minutes' },
      { key: 'blueprint', label: 'Blueprint', type: 'text', default: '5 questions of 1 mark, 5 of 2 marks, 5 of 3 marks, 2 of 5 marks', hint: 'How many of each mark value. The paper is checked against the total.' },
      { key: 'bloom', label: 'Split across thinking levels', type: 'text', default: '30% remember, 30% understand, 25% apply, 15% analyse', hint: 'Remember / understand / apply / analyse' },
      { key: 'choice', label: 'Internal choice', type: 'select', default: 'some', options: [{ value: 'none', label: 'None — every question compulsory' }, { value: 'some', label: 'On the long questions only' }, { value: 'all', label: 'Throughout, one from two' }] }
    ],
    system: (o) => 'You are an experienced ' + (o.subject || 'subject') + ' teacher and examiner writing a question paper for ' + (o.grade || 'a school class') + ' under ' + (o.board || 'the school’s own') + ' assessment rules, in British English.\n\nRules you must follow:\n1. Every question must be answerable from the topics the teacher lists, and from nothing else. A topic named as not taught must not appear, not even inside a longer question.\n2. Print the marks for every question in square brackets at the end of the question, like [3].\n3. Group questions into sections by mark value, with a one-line instruction at the head of each section, and give each section its own mark total.\n4. The arithmetic must be right. Work out the blueprint total before you write anything and put it on the first line as "Blueprint check: 5×1 + 5×2 + … = N marks" against the stated total. If the blueprint does not come to the stated total, say so in that same line and adjust the last section so the paper does add up — never silently.\n5. ' + ({ none: 'No internal choice: every question is compulsory.', all: 'Give internal choice throughout: each question is one of two alternatives of the same mark value and the same difficulty, written as "OR".' }[o.choice] || 'Give internal choice on the longest questions only, written as "OR", the alternatives of equal mark value and difficulty.') + '\n6. After the paper, write the marking scheme: for every question, the model answer and the mark-by-mark breakdown — "1 mark for the balanced equation, 1 for naming the type of reaction" — so a second marker would award the same. Keep answers to the point; a marking scheme is not an essay. Marks are whole numbers everywhere: never award half a mark, split the marks a different way instead.\n7. Every question is one finished question. Never leave a discarded draft, a correction to yourself or a note about what you decided not to ask inside a question — decide, then write the question you have chosen and nothing else.\n8. Use # and ## headings. No preamble, no commentary, no notes to the teacher outside the paper itself.',
    prompt: (i, o) => 'Write a question paper and its marking scheme.\n\nSubject: ' + (o.subject || '') + '\nClass: ' + (o.grade || '') + '\nBoard or syllabus: ' + (o.board || '') + '\nTotal marks: ' + (o.marks || '') + '\nDuration: ' + (o.duration || '') + '\nBlueprint: ' + (o.blueprint || '') + '\nSpread across thinking levels: ' + (o.bloom || '') + '\n\nStructure, in this order:\n# ' + (o.subject || 'Question paper') + ' — ' + (o.grade || '') + '\nBlueprint check: the arithmetic line.\n## General instructions — numbered, covering time, total marks, sections, choice, and anything the board requires.\n## Section A, ## Section B and so on, one per mark value, questions numbered continuously through the paper, marks in brackets, section total at the end of each section.\n# Marking scheme\n## Section A … with every question number, the model answer, and the mark-by-mark breakdown.\nEnd with one line giving the mark distribution actually achieved across the thinking levels.\n\nTOPICS AND CHAPTERS TO EXAMINE:\n' + i.topics,
    output: 'text', maxTokens: 6000,
    sample: {
      inputs: { topics: 'Half-yearly unit test. Chapters taught and examinable:\n1. Chemical reactions and equations — types of reaction, balancing, corrosion and rancidity.\n2. Acids, bases and salts — pH, indicators, preparation and uses of washing soda, bleaching powder and plaster of Paris.\n3. Life processes — nutrition in plants and humans, respiration, transportation, excretion.\n4. Light — reflection and refraction, mirror and lens formulae, ray diagrams, power of a lens.\n\nNot taught yet, so it must not appear anywhere: Metals and non-metals, Carbon and its compounds, Electricity, Magnetic effects of electric current, Human eye.\n\nThe board asks for at least one ray diagram to be drawn by the pupil, and one question set in a real situation (a case or a short passage).' },
      opts: { subject: 'Science', grade: 'Class 10', board: 'CBSE', marks: 40, duration: '90 minutes', blueprint: '5 questions of 1 mark, 5 of 2 marks, 5 of 3 marks, 2 of 5 marks', bloom: '30% remember, 30% understand, 25% apply, 15% analyse', choice: 'some' }
    },
    tips: [
      'Check every question against the syllabus you have actually taught before you print it. The model works from the chapter names you type; it does not hold your board’s current syllabus, your school’s scheme of work or what you had to skip in September. This is the one check nobody else can do for you.',
      'Name the topics that are not to appear as plainly as the ones that are. "Not taught yet: Electricity" keeps electricity out of the paper far more reliably than leaving it off the list.',
      'The blueprint check on the first line is the arithmetic done in the open. If your blueprint does not add up to the total you asked for, the paper says so rather than quietly writing a 38-mark paper you photocopy forty times.',
      'The marking scheme is written to be handed to a second marker: model answer, then where each mark sits. Read it before the exam, not after — that is when you find the question with two defensible answers.',
      'Paste the same topics twice with a different seed of wording and you get a different paper. That is how to make set A and set B for alternate rows, or a retest for the pupils who were away.'
    ],
    faq: [
      { q: 'Will the questions match my board’s exact pattern?', a: 'It follows the blueprint and the instructions you give it, and it knows the general shape of CBSE, ICSE, IGCSE, IB and A-level papers. It does not have this year’s specimen paper in front of it. Set the blueprint from the specimen and the shape follows; check the wording of the rubric against the real thing before an exam that counts.' },
      { q: 'Are the answers in the marking scheme correct?', a: 'Usually, and for numerical work you should still do the sums. The scheme is written to be checked: the breakdown shows the reasoning step by step, so an error is visible rather than hidden inside a final answer. Mark one question yourself before you trust the rest.' },
      { q: 'Can I get it as a Word file or a PDF?', a: 'Copy the text and paste it into your school’s paper template, or into the Text to PDF tool on this site, which lays it out on a page you can print. Keeping it as text means you can edit a question before it is set in a layout.' },
      { q: 'Can pupils use this to guess my paper?', a: 'They can generate practice papers on the same chapters, which is a good thing for them and no threat to you — the questions will not be yours. Do not paste a paper you have already set into any AI tool, here or anywhere else, before the exam is over.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  const lessonMd = (d) => {
    const L = [];
    L.push('# ' + (line(d.title) || 'Lesson plan'));
    const head = [line(d.class_and_subject), d.duration_minutes ? line(d.duration_minutes) + ' minutes' : '', d.class_size ? 'class of ' + line(d.class_size) : ''].filter(Boolean);
    if (head.length) L.push('', head.join(' · '));
    const list = (title, items, fmt) => { const xs = arr(items); if (!xs.length) return; L.push('', '## ' + title, ''); xs.forEach(x => L.push('- ' + (fmt ? fmt(x) : line(x)))); };
    const para = (title, v) => { if (!line(v)) return; L.push('', '## ' + title, '', line(v)); };
    list('Learning objectives', d.learning_objectives);
    list('Success criteria', d.success_criteria);
    para('Prior knowledge assumed', d.prior_knowledge_assumed);
    list('Resources needed', d.resources_needed);
    const seq = arr(d.lesson_sequence);
    if (seq.length) {
      L.push('', '## Lesson sequence', '');
      seq.forEach(s => {
        L.push('### ' + line(s.phase) + (s.minutes ? ' — ' + line(s.minutes) + ' min' : ''));
        if (line(s.teacher_does)) L.push('- Teacher: ' + line(s.teacher_does));
        if (line(s.pupils_do)) L.push('- Pupils: ' + line(s.pupils_do));
        if (line(s.purpose)) L.push('- Why: ' + line(s.purpose));
        L.push('');
      });
    }
    list('Key questions', d.key_questions);
    const mis = arr(d.common_misconceptions);
    if (mis.length) { L.push('', '## Common misconceptions', ''); mis.forEach(m => L.push('- **' + line(m.misconception) + '** — ' + line(m.why_it_happens) + ' Address it by: ' + line(m.how_to_address))); }
    const diff = d.differentiation && typeof d.differentiation === 'object' ? d.differentiation : null;
    if (diff) {
      L.push('', '## Differentiation', '');
      if (line(diff.support)) L.push('- Support: ' + line(diff.support));
      if (line(diff.stretch)) L.push('- Stretch: ' + line(diff.stretch));
      if (line(diff.sen_note)) L.push('- SEN note: ' + line(diff.sen_note));
    }
    para('Assessment for learning', d.assessment_for_learning);
    para('Plenary check', d.plenary_check);
    para('Homework', d.homework);
    para('Safety or practical notes', d.safety_or_practical_notes);
    const w = d.worksheet && typeof d.worksheet === 'object' ? d.worksheet : null;
    if (w) {
      L.push('', '---', '', '# ' + (line(w.title) || 'Worksheet'), '');
      if (line(w.instructions)) L.push(line(w.instructions), '');
      arr(w.questions).forEach(q => L.push(line(q.number) + '. ' + line(q.question) + (q.marks ? ' [' + line(q.marks) + ']' : ''), ''));
    }
    const key = arr(d.answer_key);
    if (key.length) { L.push('', '---', '', '# Answer key', ''); key.forEach(a => L.push(line(a.number) + '. ' + line(a.answer) + (line(a.marking_note) ? '  \n   _' + line(a.marking_note) + '_' : ''), '')); }
    return L.join('\n') + '\n';
  };

  window.AI_TOOLS['lesson-plan-writer'] = {
    title: 'Lesson Plan & Worksheet Writer',
    short: 'Lesson Plan',
    description: 'A lesson plan you could hand to a cover teacher — objectives in observable verbs, a timed sequence, the misconceptions to expect and what to say to each — with a printable worksheet and its answer key.',
    keywords: ['lesson plan generator', 'lesson plan template ai', 'worksheet generator with answers', 'differentiated lesson plan', 'lesson objectives success criteria', 'teacher planning tool', 'cover lesson plan'],
    glyph: 'i-ai-lesson',
    glyphSvg: '<symbol id="i-ai-lesson" viewBox="0 0 24 24">\n  <rect x="3.5" y="3.8" width="17" height="11.5" rx="1.5"/>\n  <path d="M12 15.3v4.2M8.3 20.8l3.7-1.3 3.7 1.3" class="thin"/>\n  <path d="M6.8 7.6h7M6.8 10.6h4.5" class="thin"/>\n  <path d="M16.6 9.6l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" class="fill"/>\n</symbol>',
    scripts: COMMON, action: 'Plan the lesson', resultTitle: 'Lesson plan and worksheet',
    privacy: 'The topic, the class details and the resources you type are sent to the model. Describe the class in general terms — "six pupils need reading support" — rather than naming anyone.',
    inputs: [{ key: 'brief', label: 'The lesson', type: 'text', rows: 8, placeholder: 'What the lesson is about, in as much detail as you have. What they already know and what they got wrong last time. What is in the room — a projector, one set of textbooks, no lab. Anything that must happen in this lesson.' }],
    options: [
      { key: 'subject', label: 'Subject', type: 'text', default: 'Mathematics' },
      { key: 'grade', label: 'Class or year', type: 'text', default: 'Class 8' },
      { key: 'minutes', label: 'Length in minutes', type: 'number', default: 45 },
      { key: 'size', label: 'Class size', type: 'number', default: 38 },
      { key: 'diff', label: 'Differentiation', type: 'select', default: 'both', options: [{ value: 'both', label: 'Support and stretch' }, { value: 'support', label: 'Support for weaker learners only' }, { value: 'stretch', label: 'Stretch for stronger learners only' }, { value: 'none', label: 'None — one task for all' }] },
      { key: 'sen', label: 'SEN note', type: 'select', default: 'yes', options: [{ value: 'yes', label: 'Include a general SEN note' }, { value: 'no', label: 'No SEN note' }] },
      { key: 'worksheet', label: 'Worksheet', type: 'select', default: '8', options: [{ value: '6', label: '6 questions' }, { value: '8', label: '8 questions' }, { value: '12', label: '12 questions' }] }
    ],
    system: (o) => 'You are an experienced ' + (o.subject || 'subject') + ' teacher writing a lesson plan for ' + (o.grade || 'a school class') + ' in British English, for a real classroom of about ' + (o.size || 'thirty') + ' pupils with ' + (o.minutes || 45) + ' minutes.\n\nRules: learning objectives use observable verbs — state, calculate, explain, compare, construct — never "understand" or "know about". Success criteria are what a pupil can point to in their own book. The timed sequence must add up to the lesson length exactly. Every activity must be possible with the resources named and no others. Misconceptions are the ones this topic actually produces, each with the words or the question that unpicks it, not "revise the concept". ' + ({ support: 'Give support for pupils who find it hard; no stretch section.', stretch: 'Give stretch for pupils who finish early; no support section.', none: 'One task for the whole class; set differentiation to null.' }[o.diff] || 'Give both support for pupils who find it hard and stretch for those who finish early, as different questions rather than more of the same.') + ' ' + (o.sen === 'no' ? 'No SEN note.' : 'Add one general SEN note about access — reading load, board contrast, instructions given one at a time — written for a class you have not met, naming no pupil and diagnosing nobody.') + ' The worksheet must be printable as it stands and every worksheet question must have an answer in the key. ' + JSON_ONLY,
    prompt: (i, o) => 'Write the lesson plan. Return JSON with exactly these keys: title, class_and_subject, duration_minutes, class_size, learning_objectives (array of 2–4 strings, each beginning with an observable verb), success_criteria (array of 3–5 strings beginning "I can…"), prior_knowledge_assumed, resources_needed (array), lesson_sequence (array of objects {phase, minutes, teacher_does, pupils_do, purpose} covering starter, exposition, activity and plenary, with the minutes adding to ' + (o.minutes || 45) + '), key_questions (array of 4–6), common_misconceptions (array of {misconception, why_it_happens, how_to_address}), differentiation ({support, stretch, sen_note}' + (o.diff === 'none' ? ', or null' : '') + '), assessment_for_learning, plenary_check, homework, safety_or_practical_notes, worksheet ({title, instructions, questions: array of ' + (o.worksheet || 8) + ' objects {number, question, marks}}), answer_key (array of {number, answer, marking_note}, one per worksheet question).\n\nTHE LESSON:\n' + i.brief,
    output: 'fields', maxTokens: 5000,
    downloads: fileDownload('lesson-plan.md', 'text/markdown', lessonMd),
    sample: {
      inputs: { brief: 'Introducing solving linear equations with the unknown on both sides, for example 5x + 3 = 2x + 18. They can already solve one-step and two-step equations with the unknown on one side, and they are reasonably confident with negative numbers. Last week a third of the class subtracted the wrong term and lost the sign; several of them still "move the number across and change the sign" as a rule they cannot explain. The room has a whiteboard and a visualiser, one textbook between two, no tablets. Mini-whiteboards are available. By the end they must be able to solve an equation with the unknown on both sides, including one with a negative solution, and check their answer by substitution.' },
      opts: { subject: 'Mathematics', grade: 'Class 8', minutes: 45, size: 38, diff: 'both', sen: 'yes', worksheet: '8' }
    },
    tips: [
      'The plan is only as good as what you tell it about the class. "A third of them lost the sign last week" produces a starter aimed at that; "teach equations" produces a plan for nobody.',
      'Name the resources honestly, including what you do not have. A plan that assumes a tablet each is useless in a room with one visualiser, and the tool will not know unless you say.',
      'The timings are made to add up to the lesson length, which means they are tight. Treat the plenary as the part you protect and the activity as the part that gives.',
      'The misconceptions section is the part worth reading twice. It is where a plan earns its keep for a topic you have taught for years — occasionally it names the one you had stopped noticing.',
      'Download the .md and it opens in Word, Google Docs or any markdown editor with the worksheet and answer key already separated by a rule, ready to print the worksheet on its own.',
      'The SEN note is general by design: it is written for a class the tool has never met. Your school’s pupil passports and the SENCO override it, always.'
    ],
    faq: [
      { q: 'Is this good enough for an observed lesson?', a: 'It is a strong first draft that saves the hour of typing, not a plan you should walk into an observation with unread. Put your own class’s names, prior data and seating into it, cut whatever will not fit your forty minutes, and make the objectives match the ones on your scheme of work.' },
      { q: 'Does it know my curriculum?', a: 'It knows the shape of the subject at that age, not your board’s current specification or your department’s scheme. Paste the objective from your scheme into the brief and it plans to that objective rather than to a general one.' },
      { q: 'Should I put pupils’ names or SEN details in?', a: 'No. Describe needs in general terms — "six pupils need the reading load kept low", "one wheelchair user at the front" — and the plan adapts without a named pupil’s data leaving your device. Named SEN information is special category data under UK GDPR and the DPDP Act, and should not be pasted into any cloud tool without your school’s decision behind it.' },
      { q: 'Can it make the worksheet harder or easier?', a: 'Say so in the brief — "the worksheet should start with two one-step equations before the unknown appears on both sides". The differentiation setting changes the support and stretch tasks; the brief changes the worksheet itself.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['student-comment-writer'] = {
    title: 'Report Card Comment Writer',
    short: 'Report Comments',
    description: 'Paste the class list with marks, attendance and a few words about each pupil, and get a report card comment for every one of them — in their own name, about their own term, with the next step spelt out.',
    keywords: ['report card comment generator', 'school report comments', 'student report writer ai', 'teacher report comments bank', 'progress report comments', 'report writing for teachers', 'end of term report comments'],
    glyph: 'i-ai-report',
    glyphSvg: '<symbol id="i-ai-report" viewBox="0 0 24 24">\n  <rect x="4" y="3.5" width="16" height="17" rx="1.5"/>\n  <circle cx="9" cy="9" r="2.2" class="thin"/>\n  <path d="M5.9 14.2a3.4 3.4 0 0 1 6.2 0" class="thin"/>\n  <path d="M14.5 7.6h3.6M14.5 10.6h3.6M7 17.4h10" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Write comments', resultTitle: 'Comments written',
    pii: true,
    privacy: 'Pupil names are sent to the model, because the comments are written in their names and cannot be written without them. Phone numbers and email addresses anywhere in the sheet are swapped for placeholders on your device before anything leaves it, and put back in the answer. Take out addresses, ID numbers, medical notes and anything from a pupil passport before you paste — comments do not need them. Check your school’s data protection policy before putting a class list into any cloud tool.',
    inputs: [{ key: 'pupils', label: 'The class', type: 'text+file', accept: '.csv,.xlsx,.txt', rows: 12, maxRows: 60, placeholder: 'Paste a table with a header row — name, pronouns, mark, attendance, and a few keywords each — or choose the CSV or Excel export from your mark book. Up to 60 pupils a run.' }],
    options: [
      { key: 'subject', label: 'Subject or class', type: 'text', default: 'Science' },
      { key: 'term', label: 'Term or period', type: 'text', default: 'Autumn term' },
      { key: 'tone', label: 'Tone', type: 'select', default: 'warm', options: [{ value: 'warm', label: 'Warm — for parents to read' }, { value: 'formal', label: 'Formal — school report register' }, { value: 'board', label: 'Board report — plain and factual' }] },
      { key: 'length', label: 'Length', type: 'select', default: 'medium', options: [{ value: 'short', label: 'Short — about 35 words' }, { value: 'medium', label: 'Medium — about 60 words' }, { value: 'long', label: 'Long — about 100 words' }] },
      { key: 'next', label: 'Next steps', type: 'select', default: 'named', options: [{ value: 'named', label: 'Name a specific next step' }, { value: 'none', label: 'No next step — comment only' }] }
    ],
    system: (o) => 'You write school report card comments for ' + (o.subject || 'a class') + ', ' + (o.term || 'this term') + ', in British English, ' + ({ formal: 'in a formal school report register', board: 'plainly and factually, for a board or governors’ report' }[o.tone] || 'warmly, for a parent to read') + '. Each comment is about ' + ({ short: '35', long: '100' }[o.length] || '60') + ' words.\n\nRules, and they matter more than the prose:\n1. Use the pupil’s name as given and the pronouns given in their row. Where the pronouns column is empty for a pupil, the words he, his, him, she, her and hers must not appear anywhere in that pupil’s comment: use the name, or a neutral construction such as "the written work is a strength", or singular they. Never infer a pronoun from a name.\n2. Use only what that pupil’s row says. Never invent an incident, a conversation, a test, a hobby or a parent’s evening. If a row says little, write a short honest comment rather than a padded one.\n3. No two comments may be interchangeable. Each must name something true of that pupil — the mark, the attendance, the keyword — in words that would not fit the pupil above.\n4. Difficulty is described, not diagnosed and not judged. "Attendance of 71% has cost her the practical work" is fair; "lazy", "weak", "does not care" and anything about a pupil’s home are not.\n5. ' + (o.next === 'none' ? 'No next step: describe the term only.' : 'End with one specific, doable next step — a thing to practise, a habit to change, a piece of work to redo — not "keep it up" or "try harder".') + '\n6. Attendance and marks are quoted exactly as the row gives them; never round, never soften.\n' + JSON_ONLY,
    prompt: (i, o) => 'Write one comment for every pupil in this list, in the order given, none missed and none merged. Return a JSON array of objects with exactly these keys: name (exactly as given), comment, next_step (' + (o.next === 'none' ? 'null for every pupil' : 'the single next step, repeated here on its own') + '), based_on (a short phrase naming the facts from that row you used), flag (a short string where the row is too thin to write a fair comment, or the data contradicts itself, otherwise null).\n\nCLASS LIST:\n' + i.pupils,
    output: 'table', maxTokens: 4000,
    transform: (data) => {
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.rows) ? data.rows : data && Array.isArray(data.items) ? data.items : null);
      if (!list) return data;
      list.forEach(r => { if (r && typeof r === 'object') r.words = String(r.comment == null ? '' : r.comment).trim().split(/\s+/).filter(Boolean).length; });
      return data;
    },
    downloads: csvDownload('report-comments'),
    sample: {
      inputs: { pupils: 'Name\tPronouns\tMark\tAttendance\tKeywords\nAarav Deshmukh\the/him\t78\t96%\tstrong in practicals, rushes written answers, helpful in group work\nSaanvi Iyer\tshe/her\t91\t99%\ttop of the class, asks excellent questions, handwriting hard to read\nMohammed Rizwan\the/him\t54\t71%\tmissed most of the light unit, works hard when present, needs catch-up on ray diagrams\nDiya Patel\tshe/her\t66\t93%\tquiet, accurate calculations, rarely volunteers, improved since September\nKabir Nair\the/him\t39\t88%\tstruggles with equations, good recall of definitions, homework often incomplete\nAnanya Roy\tshe/her\t84\t97%\tvery neat, excellent diagrams, loses marks on the "explain why" questions\nIshaan Gupta\t\t72\t90%\tbetter at written work than practicals, careless with units' },
      opts: { subject: 'Science', term: 'Autumn term', tone: 'warm', length: 'medium', next: 'named' }
    },
    tips: [
      'Three or four honest keywords per pupil is the whole trick. "Rushes written answers, strong practicals" gives a comment that reads like you wrote it; an empty keyword column gives seven comments about effort that could belong to anybody.',
      'Add a pronouns column and the comments use it. Where the column is blank the comment is written around pronouns using the name, rather than a guess from the name — which is what you want for Ishaan, Sam or Kiran.',
      'The words column is counted here in your browser after the answer comes back, not claimed by the model, so it is the real count. Use it to catch the comment that ran long before you paste it into a report template with a character limit.',
      'The flag column is honest: a row with a mark and nothing else gets flagged rather than padded into a paragraph of pleasant nothing. Those are the pupils to write about yourself.',
      'Read every comment before it goes out. A report is a document parents keep for years, and one sentence about the wrong child does more damage than a whole evening of typing saves.',
      'Do not paste SEN notes, medical information, safeguarding notes or anything from a pupil passport into the keywords. Those do not belong in a cloud tool, and they do not belong in a report card comment either.'
    ],
    faq: [
      { q: 'Are pupil names really sent?', a: 'Yes, and there is no honest way round it: a comment addressed to a parent has to name the child. The names go to the model through our gateway to write the comment and come straight back; we store neither the list nor the comments, only the fact that a call was made. Phone numbers and email addresses in the sheet are masked on your device before it leaves and restored afterwards. Whether a class list may go to a cloud service at all is your school’s decision under its data protection policy — ask before the first run, not after.' },
      { q: 'Will the comments all sound the same?', a: 'They are written in one pass, so they share a register, which is what a report set should do. They are told not to be interchangeable and each must name something true of that pupil. Where they do start to rhyme it is nearly always because the keywords were thin — the fix is two more words per pupil, not a longer prompt.' },
      { q: 'Can it invent something nice about a pupil I have nothing to say about?', a: 'It is told not to, and it will flag the row instead. That is deliberate. A report is a record; an invented incident in one is a problem for you at parents’ evening and a small betrayal of the child.' },
      { q: 'How many pupils in one run?', a: 'Sixty rows read reliably and a class of thirty is comfortable. For a year group, run it a class at a time — the comments stay sharper, and if one run goes wrong you have lost one class, not two hundred pupils.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  const rubricMd = (d) => {
    const L = ['# Marking rubric — ' + (line(d.task_title) || line(d.subject) || 'assessment'), ''];
    if (line(d.task_summary)) L.push(line(d.task_summary), '');
    const meta = [line(d.subject), line(d.level), d.total_marks != null ? line(d.total_marks) + ' marks' : '', line(d.framework)].filter(Boolean);
    if (meta.length) L.push(meta.join(' · '), '');
    const bands = arr(d.bands);
    if (bands.length) { L.push('## Bands', ''); bands.forEach(b => L.push('- **' + line(b.band) + '** ' + line(b.label) + (line(b.marks) ? ' — ' + line(b.marks) : ''))); L.push(''); }
    const crit = d.criteria && typeof d.criteria === 'object' && !Array.isArray(d.criteria) ? d.criteria : null;
    if (crit) { L.push('## Criteria', ''); Object.entries(crit).forEach(([name, bandMap]) => { L.push('### ' + name, ''); Object.entries(bandMap || {}).forEach(([b, desc]) => L.push('- **' + b + '** — ' + line(desc))); L.push(''); }); }
    const alloc = arr(d.mark_allocation);
    if (alloc.length) { L.push('## Mark allocation', ''); alloc.forEach(a => L.push('- ' + line(a.criterion) + ': ' + line(a.marks) + ' marks')); L.push(''); }
    if (line(d.marks_check)) L.push('> ' + line(d.marks_check), '');
    if (line(d.what_a_top_answer_does)) L.push('## What a top answer does', '', line(d.what_a_top_answer_does), '');
    const bd = arr(d.borderline_calls);
    if (bd.length) { L.push('## Borderline calls', ''); bd.forEach(x => L.push('- ' + line(x))); L.push(''); }
    if (line(d.moderation_note)) L.push('## Moderation', '', line(d.moderation_note), '');
    return L.join('\n');
  };

  window.AI_TOOLS['rubric-writer'] = {
    title: 'Marking Rubric & Assessment Criteria Builder',
    short: 'Rubric Builder',
    description: 'A marking rubric for a task you set — criteria against bands, with descriptors that actually tell a 7 from a 5, the marks allotted to each criterion, and a note on what a top answer does.',
    keywords: ['rubric generator', 'marking criteria builder', 'assessment rubric maker', 'ib myp rubric generator', 'grading rubric for teachers', 'assessment criteria descriptors', 'moderation rubric'],
    glyph: 'i-ai-rubric',
    glyphSvg: '<symbol id="i-ai-rubric" viewBox="0 0 24 24">\n  <rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/>\n  <path d="M3.5 9h17M9 9v10.5M14.5 9v10.5" class="thin"/>\n  <path d="M5.4 12.2h2.2M5.4 15.8h2.2" class="thin"/>\n  <circle cx="11.75" cy="12.2" r="1.1" class="fill"/>\n  <circle cx="17.25" cy="15.8" r="1.1" class="fill"/>\n</symbol>',
    scripts: COMMON, action: 'Build the rubric', resultTitle: 'Rubric built',
    privacy: 'The task description and the options you set are sent to the model. No pupil work and no names go with it.',
    inputs: [{ key: 'task', label: 'The task', type: 'text+file', accept: '.txt,.md,.pdf', rows: 9, placeholder: 'What you set: the question or brief as the pupils received it, what they had to produce, how long they had, what you told them would be assessed. The more of the real task you paste, the less generic the descriptors.' }],
    options: [
      { key: 'subject', label: 'Subject', type: 'text', default: 'History' },
      { key: 'level', label: 'Level', type: 'text', default: 'Class 11 / A-level year 1' },
      { key: 'bands', label: 'Number of bands', type: 'number', default: 4 },
      { key: 'marks', label: 'Total marks', type: 'number', default: 20 },
      { key: 'criteria', label: 'Number of criteria', type: 'number', default: 4 },
      { key: 'framework', label: 'Align to a framework', type: 'text', placeholder: 'e.g. IB MYP criterion B, AQA AO1–AO3, or leave blank', hint: 'Named only if you name it' }
    ],
    system: (o) => 'You build marking rubrics for ' + (o.subject || 'a subject') + ' at ' + (o.level || 'school level') + ', in British English.\n\nRules:\n1. The descriptors must genuinely differentiate. Each band must name what is present or absent — the number of sources used, whether the counter-argument is answered, whether the conclusion follows — so two markers reading the same script land in the same band. Never write a band as the one above with "less" or "some" in front of it, and never use "good", "satisfactory" or "excellent" as the whole descriptor.\n2. Exactly ' + (o.bands || 4) + ' bands and about ' + (o.criteria || 4) + ' criteria. Every criterion has a descriptor for every band; none may be missing.\n3. The marks given to the criteria must add up to ' + (o.marks || 20) + ' exactly, and the band mark ranges within a criterion must cover its marks without gaps or overlaps.\n4. ' + (o.framework ? 'Align it to ' + o.framework + ' and name that alignment against each criterion. Where you are not certain what that framework says, say so in the criterion name rather than inventing a strand.' : 'No external framework is named, so do not claim one. Write the criteria from the task itself.') + '\n5. Criteria come back as a keyed object, never as a wide table.\n' + JSON_ONLY,
    prompt: (i, o) => 'Build the rubric. Return JSON with exactly these keys:\ntask_title, task_summary (1–2 sentences), subject, level, total_marks (number, ' + (o.marks || 20) + '), framework (the framework named, or null),\nbands: an array of exactly ' + (o.bands || 4) + ' objects {band, label, marks} ordered from highest to lowest, where band is a short identifier such as "Band 4" and marks is the mark range for that band across the whole task,\ncriteria: an OBJECT, not an array — its keys are the criterion names, each written as "Name (N marks)", and each value is an OBJECT whose keys are exactly the band identifiers from bands, in the same order, and whose values are that criterion’s descriptor at that band as one sentence,\nmark_allocation: an array of {criterion, marks} adding to ' + (o.marks || 20) + ',\nwhat_a_top_answer_does (3–5 sentences describing the top-band script in concrete terms),\nborderline_calls (array of 3–5 strings, each naming a decision markers will disagree on and how to settle it),\nmoderation_note (one short paragraph on using this rubric across a department).\n\nTHE TASK AS SET:\n' + i.task,
    output: 'fields', maxTokens: 4500,
    transform: (data) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
      const alloc = arr(data.mark_allocation);
      if (alloc.length) {
        const sum = alloc.reduce((a, r) => a + (Number(r && r.marks) || 0), 0);
        const total = Number(data.total_marks);
        data.marks_check = !isFinite(total) ? 'The criteria add to ' + sum + ' marks; no total was returned to check them against.'
          : sum === total ? 'Checked here: the criteria add to ' + sum + ' marks, which matches the total.'
            : 'Checked here: the criteria add to ' + sum + ' marks but the total says ' + total + '. Fix the allocation before you mark with it.';
      }
      const crit = data.criteria && typeof data.criteria === 'object' && !Array.isArray(data.criteria) ? data.criteria : null;
      const bands = arr(data.bands).map(b => b && b.band).filter(Boolean);
      if (crit && bands.length) {
        const gaps = [];
        Object.entries(crit).forEach(([name, map]) => {
          const has = map && typeof map === 'object' ? Object.keys(map) : [];
          const missing = bands.filter(b => !has.includes(b));
          if (missing.length) gaps.push(name + ' has no descriptor for ' + missing.join(', '));
        });
        data.bands_check = gaps.length ? 'Checked here: ' + gaps.join('; ') + '.' : 'Checked here: every criterion has a descriptor in all ' + bands.length + ' bands.';
      }
      return data;
    },
    downloads: fileDownload('marking-rubric.md', 'text/markdown', rubricMd),
    sample: {
      inputs: { task: 'Class 11 History, end of unit assessment, written in 45 minutes under test conditions, books closed.\n\n"To what extent was the failure of the 1857 revolt caused by a lack of unified leadership? Use at least three of the sources studied in class and your own knowledge. [20 marks]"\n\nThey were told in advance that the question would be an extended response, that they must use sources, and that a conclusion is required. We have spent the unit on: the immediate causes, the regional pattern of the revolt, the roles of Bahadur Shah Zafar, Rani Lakshmibai, Nana Sahib and Kunwar Singh, the British response, and historians’ disagreement about whether it was a mutiny, a rebellion or a first war of independence.\n\nI want a rubric I can hand to the other two teachers in the department so that all three of us mark the same way.' },
      opts: { subject: 'History', level: 'Class 11 / A-level year 1', bands: 4, marks: 20, criteria: 4, framework: '' }
    },
    tips: [
      'Paste the task exactly as the pupils saw it, including the mark count and what you told them would be assessed. A rubric written from the real question differentiates; a rubric written from "an essay about 1857" does not.',
      'Read down a single criterion, band by band, before you use it. That is where a weak rubric shows itself: if band 3 is band 4 with "some" in front of it, the descriptors do not differentiate and you should say so in the task box and run it again.',
      'The mark arithmetic and the missing-descriptor check at the bottom of the result are done here in your browser after the answer arrives, not claimed by the model. If the criteria do not add up to the total, you will be told in plain numbers.',
      'The borderline calls are the part to take to a department meeting. Agreeing three of those in advance does more for consistent marking than another page of descriptors.',
      'Name your framework only if you know what it says. Asked for "IB MYP criterion B" it will align to it as it understands it — check that against the real criterion before a moderated assessment, because a subject guide is not something it has in front of it.'
    ],
    faq: [
      { q: 'Can I use this for an official moderated assessment?', a: 'Not as it stands. For anything that counts towards a qualification the awarding body’s own criteria are the criteria, and no generated rubric can replace them. This is for your own assessments, your department’s common tasks, and for turning an official criterion into something pupils can read.' },
      { q: 'Why are criteria an object instead of a table?', a: 'Because a rubric read as a grid on paper is read as a list when you are marking: you take one criterion and work down its bands. The keyed shape puts each criterion’s four descriptors together where you can compare them, and the markdown download lays them out the same way.' },
      { q: 'Will pupils understand it?', a: 'The descriptors are written for a marker. Ask in the task box for a pupil-facing version — "also write each band in the second person for pupils" — and you get both, which is usually the version that improves the next piece of work.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  const PURPOSES = [
    { value: 'absence', label: 'Absence — concern about attendance' }, { value: 'progress', label: 'Progress update' }, { value: 'behaviour', label: 'Behaviour incident' },
    { value: 'fee', label: 'Fee reminder' }, { value: 'event', label: 'Event invitation' }, { value: 'trip', label: 'Trip — consent and details' },
    { value: 'exam', label: 'Exam schedule' }, { value: 'closure', label: 'Closure or holiday notice' }
  ];
  const CHANNELS = [
    { value: 'letter', label: 'Letter on school paper' }, { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS — 160 characters' }, { value: 'whatsapp', label: 'WhatsApp broadcast' }
  ];

  window.AI_TOOLS['parent-message-writer'] = {
    title: 'Parent Communication Writer',
    short: 'Parent Messages',
    description: 'The message home, written properly — absence, progress, behaviour, fees, trips, exams, closures — in the shape of the channel you are sending it on, and in a second language if the family reads one more easily.',
    keywords: ['letter to parents from school', 'parent communication templates', 'school sms to parents', 'fee reminder letter to parents', 'absence letter to parents', 'school whatsapp broadcast message', 'parent letter in hindi marathi'],
    glyph: 'i-ai-parent',
    glyphSvg: '<symbol id="i-ai-parent" viewBox="0 0 24 24">\n  <path d="M3.5 4.2h17v11.6h-9.6L6.6 19.6v-3.8H3.5z"/>\n  <path d="M8.6 12.4V9.5L12 6.8l3.4 2.7v2.9z" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Write the message', resultTitle: 'Message ready',
    privacy: 'The facts you type are sent to the model. Phone numbers and email addresses are masked on your device and restored in the answer; a pupil’s name is not, so use a placeholder such as [pupil] if the name does not need to travel.',
    inputs: [{ key: 'facts', label: 'The facts', type: 'text', rows: 8, placeholder: 'Who it is to and about; exactly what happened or what is being announced; dates, times, places, amounts; what you want the parent to do and by when; who they should contact. Anything you must not say.' }],
    options: [
      { key: 'purpose', label: 'Purpose', type: 'select', default: 'absence', options: PURPOSES },
      { key: 'channel', label: 'Channel', type: 'select', default: 'letter', options: CHANNELS },
      { key: 'tone', label: 'Tone', type: 'select', default: 'warm-formal', options: [{ value: 'warm', label: 'Warm' }, { value: 'warm-formal', label: 'Warm but formal' }, { value: 'formal', label: 'Formal — for the file' }, { value: 'brief', label: 'Brief and businesslike' }] },
      { key: 'language', label: 'Also in', type: 'select', default: '', options: LANGUAGES },
      { key: 'school', label: 'School', type: 'text', placeholder: 'Name of the school' },
      { key: 'from', label: 'Sign off as', type: 'text', placeholder: 'Name and role' }
    ],
    system: (o) => 'You write messages from a school to parents and guardians, in British English, ' + ({ warm: 'warmly', formal: 'formally, in a register suitable for a pupil’s file', brief: 'briefly and businesslike' }[o.tone] || 'warmly but formally') + '.\n\nThe channel is ' + ({ email: 'an email: a subject line, a short greeting, two or three short paragraphs, a clear closing action', sms: 'an SMS: one message of 160 characters or fewer including the school’s name, no greeting, no sign-off, one instruction', whatsapp: 'a WhatsApp broadcast: under 90 words, short lines, no hashtags, no emoji unless the facts ask for them, one clear call to action, and it must read correctly to a parent who has never saved the school’s number' }[o.channel] || 'a letter on school paper: date line, the parent’s address block as [Parent name] and [Address], a greeting, the body in short paragraphs, a closing action, and a sign-off') + '.\n\nRules:\n1. Use only the facts given. Anything missing is a [placeholder in square brackets], never an invention — no invented dates, amounts, policies or incidents.\n2. ' + (o.purpose === 'behaviour' || o.purpose === 'fee' ? 'This message carries consequences for a family, so it must be factual and non-accusatory. State what happened or what is outstanding, with the date and the amount, in neutral words. Do not characterise the child or the parent, do not attribute motive, do not use "failed", "refused" or "repeatedly" unless the facts use them, and make no threat of any kind — no exclusion, no withheld results, no name on a list, no legal step — unless the facts state that decision has already been taken, in which case report it as the school’s decision and name who to talk to about it. Invite a conversation and give a way to have one.' : 'Be clear about what the parent must do and by when, and give someone to contact.') + '\n3. Say nothing about another child, and nothing about a teacher by name unless the facts name them as the contact.\n4. Write at a reading level a parent who left school at sixteen will find easy. No jargon, no "effective immediately", no "as per".\n' + (o.language ? '5. Also give the whole message in ' + o.language + ' — a real translation a native speaker would write, in ' + o.language + ' script, keeping names, dates, amounts and times exactly as they are. Not a transliteration of the English.\n' : '5. No translation is wanted; set translation fields to null.\n') + JSON_ONLY,
    prompt: (i, o) => 'Write the message. Purpose: ' + ((PURPOSES.find(p => p.value === o.purpose) || {}).label || o.purpose) + '. Channel: ' + ((CHANNELS.find(c => c.value === o.channel) || {}).label || o.channel) + '.' + (o.school ? ' School: ' + o.school + '.' : '') + (o.from ? ' Signed by: ' + o.from + '.' : '') + '\n\nReturn JSON with exactly these keys: channel, subject_line (for an email or a letter’s reference line; null for SMS and WhatsApp), message (the whole message as it will be sent, line breaks written as \\n), translation_language (' + (o.language || 'null') + '), translated_message (the same message in ' + (o.language || 'null — leave it null') + '), facts_used (array of the facts from the input that appear in the message), placeholders (array of every [bracketed placeholder] the message contains), tone_check (one sentence saying how it would read to a parent having a hard week), follow_up (one sentence on what to do if there is no reply).\n\nFACTS:\n' + i.facts,
    output: 'fields', maxTokens: 3000,
    transform: (data, ctx) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
      const msg = String(data.message == null ? '' : data.message);
      data.character_count = msg.length;
      data.word_count = msg.trim().split(/\s+/).filter(Boolean).length;
      const channel = (ctx && ctx.opts && ctx.opts.channel) || data.channel;
      if (channel === 'sms') data.length_check = msg.length <= 160 ? 'Counted here: ' + msg.length + ' characters — one SMS.' : 'Counted here: ' + msg.length + ' characters — over 160, so it will go as ' + Math.ceil(msg.length / 153) + ' linked messages and cost accordingly. Shorten it or send it another way.';
      else if (channel === 'whatsapp') data.length_check = 'Counted here: ' + data.word_count + ' words.';
      return data;
    },
    downloads: fileDownload('parent-message.txt', 'text/plain', (d) => [line(d.subject_line) ? 'Subject: ' + line(d.subject_line) : '', line(d.message), line(d.translated_message) ? '\n\n--- ' + (line(d.translation_language) || 'Translation') + ' ---\n\n' + line(d.translated_message) : ''].filter(Boolean).join('\n\n') + '\n'),
    sample: {
      inputs: { facts: 'To the parents of a Class 7 pupil. Attendance from 1 June to 15 September 2026 is 68 per cent — 21 days missed, of which 14 were not explained. The school has had no message about most of them. She has now missed the whole of the fractions unit and the class moves on to ratio next week, which builds on it.\n\nWe are not accusing anyone of anything and we do not know what is going on at home. We want the parents to come and talk to us. The class teacher, Mrs Kulkarni, is free between 3 and 4 on any weekday and can be reached on the school number. If getting to school is the problem we can talk about that too.\n\nCatch-up classes for fractions run on Tuesdays and Thursdays after school for the next three weeks; she is welcome and there is no charge.\n\nDo not mention exclusion or any penalty. Nothing has been decided and nothing is being threatened.' },
      opts: { purpose: 'absence', channel: 'letter', tone: 'warm-formal', language: 'Marathi', school: 'Sunrise English Medium School, Pune', from: 'Mrs A. Kulkarni, Class Teacher, Class 7B' }
    },
    tips: [
      'Write the facts as a list, including the ones you must not say. "Do not mention exclusion; nothing has been decided" is an instruction the tool follows, and it is exactly the sentence a tired teacher writes by accident at nine at night.',
      'Behaviour and fee messages are written factually and without threat on purpose. A letter about money or conduct is a letter a family may keep, show to someone, or read as the school taking a side — the plainer it is, the better it holds up.',
      'The SMS length is counted here in your browser, not claimed by the model, so 158 means 158. Over 160 the tool tells you how many linked messages it will become, because a school sending two thousand of them notices.',
      'The translation is a real one into the script, not a transliteration, and names, dates and amounts are carried across unchanged. Have someone who speaks the language read it once before it goes to two hundred families — a translation nobody checked is a translation nobody should send.',
      'The placeholders list is your pre-send checklist. Anything in square brackets is something the tool did not know; search for "[" before it goes out.',
      'For a whole-class message, send it about the class and never about one child. A broadcast that names a pupil is a broadcast that tells forty families about that pupil.'
    ],
    faq: [
      { q: 'Can it send the message?', a: 'No. It writes the text; you paste it into your school’s SMS gateway, mail merge or WhatsApp Business account. Nothing here connects to a parent contact list, which is deliberate — that list is the most sensitive thing a school holds.' },
      { q: 'Is the translation good enough to send?', a: 'It is good enough to be understood and usually good enough to send, and it is not good enough to send unread to hundreds of families. Have a colleague or a parent who speaks the language read it once. The tool keeps names, dates, times and amounts identical across both versions, so what you are checking is the tone, not the facts.' },
      { q: 'Why will it not write a stronger letter about unpaid fees?', a: 'Because a demand with a threat in it is a legal document as much as a letter, and the consequences belong to the school that has decided them, not to a writing tool. State a decision the school has already taken and it will report that decision plainly. Ask it to invent pressure and it will not.' },
      { q: 'Should I put the pupil’s name in?', a: 'Only if you want it in the letter. Type [pupil] instead and the message comes back with the placeholder in place for your mail merge to fill in — which is also how you send the same letter to thirty families without thirty runs.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  const solutionsMd = (d) => {
    const L = ['# Worked solutions' + (line(d.subject) ? ' — ' + line(d.subject) : '') + (line(d.class_or_level) ? ', ' + line(d.class_or_level) : ''), ''];
    const sol = d.solutions && typeof d.solutions === 'object' && !Array.isArray(d.solutions) ? d.solutions : {};
    Object.entries(sol).forEach(([key, s]) => {
      if (!s || typeof s !== 'object') return;
      L.push('## ' + key, '');
      if (line(s.question)) L.push('**Question.** ' + line(s.question), '');
      if (line(s.short_answer)) L.push('**Answer.** ' + line(s.short_answer), '');
      const steps = arr(s.method);
      if (steps.length) { L.push('**Method.**', ''); steps.forEach((st, n) => L.push((n + 1) + '. ' + line(st))); L.push(''); }
      if (line(s.concept)) L.push('**The idea behind it.** ' + line(s.concept), '');
      if (line(s.common_mistake)) L.push('**Where people go wrong.** ' + line(s.common_mistake), '');
      if (line(s.practice_question)) L.push('**Try this one.** ' + line(s.practice_question), '');
      if (line(s.practice_answer)) L.push('**Its answer.** ' + line(s.practice_answer), '');
      L.push('');
    });
    if (line(d.study_note)) L.push('---', '', line(d.study_note), '');
    return L.join('\n');
  };

  window.AI_TOOLS['ncert-solution-writer'] = {
    title: 'Textbook Question Explainer',
    short: 'Question Explainer',
    description: 'Paste the question you are stuck on — one, or a whole exercise — and get the method worked through step by step, the idea it rests on, the mistake most people make, and a similar question to try with its answer.',
    keywords: ['ncert solutions explained', 'textbook question solver step by step', 'maths question explained ai', 'homework help step by step', 'exercise solutions with method', 'physics numerical solved step by step', 'study help tool'],
    glyph: 'i-ai-textbook',
    glyphSvg: '<symbol id="i-ai-textbook" viewBox="0 0 24 24">\n  <path d="M3.5 5.4c2.8-1 5.6-1 8.5 0v13c-2.9-1-5.7-1-8.5 0z"/>\n  <path d="M20.5 5.4c-2.8-1-5.6-1-8.5 0v13c2.9-1 5.7-1 8.5 0z"/>\n  <path d="M12 5.4v13" class="thin"/>\n  <path d="M16.8 9.8l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" class="fill"/>\n</symbol>',
    scripts: COMMON, action: 'Explain', resultTitle: 'Worked through',
    privacy: 'The questions you paste are sent to the model. Do not paste anything with your name, your school’s name or a photograph of a person on it.',
    inputs: [{ key: 'questions', label: 'The question, or the whole exercise', type: 'text+file', accept: '.txt,.md,.pdf', rows: 10, placeholder: 'Paste one question or a page of them, numbered as the book numbers them. Include any data, diagram description or table the question refers to — the tool cannot see the picture in your book.' }],
    options: [
      { key: 'subject', label: 'Subject', type: 'text', default: 'Mathematics' },
      { key: 'grade', label: 'Class or level', type: 'text', default: 'Class 10' },
      { key: 'book', label: 'Textbook or board', type: 'text', default: 'NCERT', hint: 'So the method matches the one taught' },
      { key: 'depth', label: 'How much detail', type: 'select', default: 'full', options: [{ value: 'full', label: 'Every step, nothing skipped' }, { value: 'brief', label: 'The key steps only' }, { value: 'exam', label: 'As it should be written in an exam' }] }
    ],
    system: (o) => 'You explain textbook questions to a ' + (o.grade || 'school') + ' pupil studying ' + (o.subject || 'a subject') + (o.book ? ' from ' + o.book : '') + ', in British English. You are a patient teacher, not an answer key.\n\nRules:\n1. Show the method the way it is taught at this level, using the notation and the vocabulary of ' + (o.book || 'the standard textbook') + '. Do not solve a Class 10 question with a Class 12 technique.\n2. ' + ({ brief: 'Give the key steps only — enough for someone who has understood the topic to get unstuck.', exam: 'Write the method exactly as it should appear in an exam script: the steps a marker expects, with the working shown and the final statement written out.' }[o.depth] || 'Show every step, including the ones that feel obvious. State what is given, what is asked, and the formula or rule used before using it.') + ' Each step is one line of working with at most one sentence of explanation; do not restate the whole equation in every step.\n3. Arithmetic and algebra must be correct. Work each step through, and make the last step a check that substitutes the answer back into the question.\n4. Write the keys of each solution in the order named, which puts the method before the short answer. Do the working first; then read the last step of your own method and copy the short answer from it. The short answer is the answer to the question as it was asked — never an intermediate value, never a root you rejected, never a quantity the question only mentions in passing.\n5. Every step is a step of the solution as a pupil would write it. Never narrate your own process inside a step: no "wait", no "let me check", no "recheck this", no "this is not required". If a step comes out wrong, delete it and write the correct step in its place; the reader must never see a correction. A verification step is written as "Check: …".\n6. If the question is missing information, or a value given makes the question impossible, say so plainly instead of producing a number.\n7. The idea behind it explains why the method works, in two or three sentences a pupil could repeat to someone else.\n8. The common mistake is the specific one this question produces — a sign, a unit, a formula used the wrong way round — not "be careful".\n9. The practice question must be genuinely similar, of the same type and level, with different numbers, and you must give its answer.\n10. If the question depends on a diagram, a graph or a table that is not in the text, say so and answer only what can be answered without it.\n' + JSON_ONLY,
    prompt: (i, o) => 'Explain every question below, none skipped. Return JSON with exactly these keys: subject, class_or_level, book, solutions, study_note.\n\n"solutions" is an OBJECT, not an array. Its keys are the question numbers exactly as the input gives them — "Q1", "Exercise 4.3 Q7", "2(ii)" — in the order given. Each value is an object with exactly these keys, in exactly this order: question (the question restated in one line), method (an array of steps, each one step, with the working written out' + (o.depth === 'brief' ? '; the key steps only' : '') + ', the last step checking the answer against the question), short_answer (the final answer alone, copied from the last step of the method above, or null if the question has no single answer), concept (2–3 sentences on why the method works), common_mistake (the specific error this question invites and how to avoid it), practice_question (a similar question with different numbers), practice_answer (its answer), needs_diagram (a short string if the question cannot be fully answered without a picture or table that was not given, otherwise null).\n\n"study_note" is one short paragraph to the pupil about what to do next with this topic.\n\nQUESTIONS:\n' + i.questions,
    output: 'fields', maxTokens: 4000,
    downloads: fileDownload('worked-solutions.md', 'text/markdown', solutionsMd),
    sample: {
      inputs: { questions: 'Q1. Find two numbers whose sum is 27 and product is 182.\n\nQ2. A train travels 360 km at a uniform speed. If the speed had been 5 km/h more, it would have taken 1 hour less for the same journey. Find the speed of the train.\n\nQ3. The altitude of a right triangle is 7 cm less than its base. If the hypotenuse is 13 cm, find the other two sides.' },
      opts: { subject: 'Mathematics', grade: 'Class 10', book: 'NCERT — Chapter 4, Quadratic Equations', depth: 'full' }
    },
    tips: [
      'This is a study aid. Copying the worked solution into your homework and handing it in is not learning, and your teacher set the exercise to find out what you cannot do yet — which this hides from both of you. Read the method, shut the screen, do the question again on paper, then do the practice question. That is the part that works.',
      'The practice question at the end of each solution is the point of the tool. If you can do it without looking back, you have learnt the method; if you cannot, read the steps again rather than moving on.',
      'Type the question exactly as the book has it, including the numbers, the units and any table. The tool cannot see the diagram in your book, and it will tell you when a question needs one instead of guessing what the picture showed.',
      'Check the arithmetic. The method is nearly always the method your teacher wants; a number in step four occasionally is not. Substituting the answer back into the original question takes twenty seconds and catches it.',
      'Name the textbook and the chapter and you get the method your class was taught. "NCERT Chapter 4" gives you factorisation and the quadratic formula; leave it blank and you may get a technique from two years ahead that earns no marks in your exam.',
      'A whole exercise at once works, but long questions can run past the length limit and stop mid-answer — the page says so plainly when that happens. Three or four at a time is comfortable; run the rest in a second go.'
    ],
    faq: [
      { q: 'Is it all right to use this for my homework?', a: 'To understand a question you are stuck on, yes — that is what a teacher at your elbow would do. To produce work you hand in as your own, no: that is cheating your school and, more to the point, yourself, because the exam hall has no textbook explainer in it. The honest use is to get unstuck, then redo the question closed-book.' },
      { q: 'Are the answers always right?', a: 'The method is reliable at school level; the arithmetic is right in the large majority of cases and not in all of them. Always substitute the answer back into the question. Where a solution disagrees with your textbook’s answer, work through the steps and find the point where they part — that is a better piece of learning than either answer on its own.' },
      { q: 'Can it read the diagram in my book?', a: 'No. This tool reads text only; a photograph of the page is not sent. Describe the figure in words — "right triangle, right angle at B, AB = 5 cm, angle C = 30°" — or the tool will tell you the question needs a picture it has not got.' },
      { q: 'Does it follow NCERT’s own solutions?', a: 'It follows the method taught at that level in that book, which is usually the same route the textbook takes, but it is not reproducing an official solution manual. Where your teacher has taught a particular layout, follow your teacher — the marks are awarded by them.' }
    ]
  };
})();
