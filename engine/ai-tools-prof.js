/**
 * The AI tools for professional practices: law firms, estate agents and
 * conveyancers, and the administrative side of a medical practice.
 *
 * These eight touch law, property transactions and health, so the rule that
 * governs the file is narrower than elsewhere on the site: nothing here
 * advises. Every tool produces a draft, a structured read or a checklist for
 * a qualified professional to check, and each says so in the first line of
 * its lede, in its privacy line, and — the part that matters — in the system
 * prompt, so the model does not slip into "you should" when nobody is
 * looking.
 *
 * The medical tools are administrative only. They write letters, restate a
 * clinician's own words and flag what the clinician has not said. They do
 * not diagnose, triage, dose or recommend treatment, hedged or otherwise,
 * and the prompts forbid it in terms.
 *
 * Nothing here states a rule of law, a limitation period, a rate of duty, a
 * court fee or a coding standard as current fact: the model has no way to
 * check what is in force today, so the rule is left to the professional and
 * the draft carries a square-bracketed instruction naming what to confirm.
 *
 * Same shape as engine/ai-tools.js, which also holds the mount code; this
 * file only adds specs to window.AI_TOOLS and never touches the DOM, so the
 * builder can run it in Node.
 */
(function () {
  'use strict';
  window.AI_TOOLS = window.AI_TOOLS || {};

  const COMMON = ['/engine/zip.js', '/engine/sheet.js', '/engine/pdf-text.js', '/engine/pii.js', '/engine/render-ai.js', '/engine/ai-tools.js', '/engine/ai-tools-prof.js'];
  const JSON_ONLY = 'Return only JSON, with no explanation before or after it and no markdown fences. Inside JSON strings write line breaks as \\n, never as a raw newline. Use null for anything not present; never invent a value.';

  /* The three standing instructions this batch exists to enforce. Every
     system prompt carries at least one of them, verbatim. */
  const NOT_ADVICE = 'What you produce is a draft for a qualified professional to check before it is used, never advice to the person operating the tool. Do not tell the user what to do: no "you should", no "we recommend", no "it would be sensible to", no view on whether to sign, accept, settle, publish, refer or proceed. Where a judgement has to be made, write it as a question for the professional rather than an answer.';
  const NO_RULES = 'You cannot check what the law says today, so never state a rule, a statutory time limit, a notice period, a limitation period, a rate of tax or duty, a court or registration fee, a professional standard or a coding rule as current fact. Where the work needs one, name the point and leave a square-bracketed instruction saying what must be confirmed and against which authority — for example [confirm the notice period against the law in force and cite it]. When in doubt, leave the figure out and say in the draft that it has been left out.';
  const NO_CLINICAL = 'You are not a clinician and you never practise. Add no clinical content of any kind: no diagnosis, no differential, no triage or urgency judgement, no investigation, no treatment, no medicine, no dose, no prognosis, no timescale and no advice about when to seek help. Every clinical statement must be one the clinician supplied, reproduced in their meaning and not strengthened or softened; anything they did not supply becomes a square-bracketed placeholder for them to fill, never a gap you close.';

  /* ---- shared output helpers ---- */

  const cell = (v) => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const heading = (k) => String(k).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  /** A generic Markdown view of a fields answer: headings, paragraphs, bullets. */
  function toMarkdown(title, data) {
    const out = ['# ' + title, ''];
    const put = (k, v, depth) => {
      const h = '#'.repeat(Math.min(6, depth + 1)) + ' ' + heading(k);
      if (v == null || v === '') { out.push(h, '', '—', ''); return; }
      if (Array.isArray(v)) {
        out.push(h, '');
        if (!v.length) out.push('—', '');
        else { v.forEach((x) => out.push(x && typeof x === 'object' ? '- ' + Object.entries(x).map(([k2, v2]) => heading(k2) + ': ' + cell(v2)).join('; ') : '- ' + cell(x))); out.push(''); }
        return;
      }
      if (typeof v === 'object') { out.push(h, ''); Object.entries(v).forEach(([k2, v2]) => put(k2, v2, depth + 1)); return; }
      out.push(h, '', String(v), '');
    };
    Object.entries(data || {}).forEach(([k, v]) => put(k, v, 1));
    return out.join('\n');
  }
  const docDownloads = (base, title) => (data) => [
    { name: base + '.md', blob: () => new Blob([toMarkdown(title, data)], { type: 'text/markdown' }) },
    { name: base + '.json', blob: () => new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }
  ];
  const withNotes = (i) => (i && i.notes && String(i.notes).trim() ? '\n\nNOTES FROM THE USER:\n' + String(i.notes).trim() : '');

  /* ================================================================== */
  /* 1. Legal — contract reviewer                                        */
  /* ================================================================== */

  const CR_KINDS = [
    { value: 'auto', label: 'Let the tool work it out' },
    { value: 'nda', label: 'Confidentiality agreement / NDA' },
    { value: 'services', label: 'Services or supply agreement' },
    { value: 'consultancy', label: 'Consultancy or contractor agreement' },
    { value: 'employment', label: 'Employment contract' },
    { value: 'lease', label: 'Lease, tenancy or licence of property' },
    { value: 'saas', label: 'Software, SaaS or licence' },
    { value: 'distribution', label: 'Distribution, agency or reseller' },
    { value: 'shareholders', label: 'Shareholders’, partnership or joint venture' },
    { value: 'settlement', label: 'Settlement or compromise agreement' },
    { value: 'other', label: 'Something else' }
  ];
  const CR_SIDES = {
    customer: 'the party receiving the goods or services',
    supplier: 'the party supplying the goods or services',
    employer: 'the employer or engager',
    worker: 'the employee or contractor',
    landlord: 'the landlord or licensor',
    tenant: 'the tenant or licensee'
  };
  const CR_LAWS = { ew: 'England and Wales', in: 'India', other: 'a jurisdiction the user has not named' };

  window.AI_TOOLS['contract-reviewer'] = {
    title: 'Contract Reviewer for Lawyers',
    short: 'Contract Reviewer',
    description: 'A structured first read of a contract for a qualified lawyer to check — a working note, not advice, and never a view on whether to sign. Parties, term, termination, liability caps, indemnities, governing law, assignment, change of control and payment; then the clauses that are unusual, the ones a document of this type normally has and this one has not, and the questions to put to the other side.',
    keywords: ['contract review ai', 'ai contract analysis for lawyers', 'clause extraction from contract', 'missing clauses contract checklist', 'contract review assistant', 'legal document review tool', 'contract summary for solicitors'],
    glyph: 'i-ai-contract-review',
    glyphSvg: '<symbol id="i-ai-contract-review" viewBox="0 0 24 24">\n  <path d="M4.5 2.8h7.6L17.1 8v3.8M4.5 2.8v18.4h8"/>\n  <path d="M12.1 2.8V8h5" class="thin"/>\n  <path d="M7.3 11.5h6.2M7.3 14.5h3.4" class="thin"/>\n  <circle cx="16.8" cy="16.4" r="3.1"/>\n  <path d="M19.1 18.7l2.1 2.1"/>\n</symbol>',
    scripts: COMMON, action: 'Review', resultTitle: 'First read — for a qualified lawyer to check',
    privacy: 'The text of the contract is sent to the model; the file itself is read on your device and never leaves it, and the shield masks emails, phone numbers, account, card and tax numbers before anything goes. Party names, addresses and figures are not masked, so send the clauses the review needs and no more. Legal professional privilege, your client’s confidentiality and your own SRA, bar or equivalent duties remain yours — running a document through this tool does not discharge any of them.',
    inputs: [{ key: 'doc', label: 'The contract', type: 'text+file', accept: '.pdf,.txt,.md', rows: 14, placeholder: 'Paste the contract, or choose the PDF above. A typed or exported PDF is read here; a scan has no text layer and cannot be read. Up to about 40 pages.' }],
    options: [
      { key: 'kind', label: 'What kind of document', type: 'select', default: 'auto', options: CR_KINDS },
      { key: 'side', label: 'Reading it for', type: 'select', default: 'neutral', options: [
        { value: 'neutral', label: 'Neither side — a neutral read' },
        { value: 'customer', label: 'The party receiving the goods or services' },
        { value: 'supplier', label: 'The party supplying them' },
        { value: 'employer', label: 'The employer or engager' },
        { value: 'worker', label: 'The employee or contractor' },
        { value: 'landlord', label: 'The landlord or licensor' },
        { value: 'tenant', label: 'The tenant or licensee' }
      ] },
      { key: 'law', label: 'Governing law', type: 'select', default: 'stated', options: [
        { value: 'stated', label: 'Whatever the document says' },
        { value: 'ew', label: 'England and Wales' },
        { value: 'in', label: 'India' },
        { value: 'other', label: 'Somewhere else' }
      ] },
      { key: 'depth', label: 'Depth', type: 'select', default: 'full', options: [{ value: 'full', label: 'Full read' }, { value: 'quick', label: 'Quick read — the headline terms only' }] }
    ],
    system: (o) => 'You prepare a structured first read of a contract for a qualified lawyer to check. ' + NOT_ADVICE + ' You never say whether the contract should be signed, whether a term is acceptable, or what any party ought to do about it. ' + NO_RULES
      + ' Report what the document says, with the clause number beside every observation, and quote the operative words where the wording is what matters. Where the document is silent, record that it is silent rather than filling the gap. Keep three things apart: what is written, what is unusual for a document of this kind, and what is simply absent. '
      + 'Be terse, because a long answer is a truncated answer: every string is at most 35 words, you quote at most eight consecutive words of the contract at a time, and no array holds more than five entries except questions_for_the_other_side, which holds five to eight. Do not restate an address, a company number or a whole clause you have already cited. '
      + (o.kind && o.kind !== 'auto' ? 'The user says this is a ' + ((CR_KINDS.find(k => k.value === o.kind) || {}).label || 'contract') + '; test that against the text and say in document_type if it reads as something else. ' : 'Work out from the text what kind of document this is. ')
      + (CR_SIDES[o.side] ? 'Read it from the position of ' + CR_SIDES[o.side] + ': set out where that party carries risk, cost, obligation or exposure, and where the document gives the other party a right it does not give this one — describing, never advising. ' : 'Read it neutrally, describing each side’s position in turn. ')
      + (o.law === 'stated' ? 'Take the governing law from the document itself and record what it says. ' : 'The user says the governing law is ' + (CR_LAWS[o.law] || 'unstated') + '; record what the document says about governing law and note any conflict with that, without stating what the law of that place provides. ')
      + (o.depth === 'quick' ? 'This is a quick read: at most three entries in every array, each one sentence. ' : '')
      + JSON_ONLY,
    prompt: (i) => 'Read this contract. Return JSON with exactly these keys: document_type, document_type_confidence (high|medium|low), parties (array of {name, role}), term_and_renewal, termination (array of {who_may_terminate, ground, notice, clause}), payment_and_charges, liability_and_caps (array of {what, as_written, clause}), indemnities (array of {who_indemnifies_whom, what_for, clause}), governing_law_and_jurisdiction, assignment_and_subcontracting, change_of_control, confidentiality_data_and_ip, other_key_terms (array of {term, as_written, clause}), unusual_clauses (array of {clause, what_it_says, why_it_stands_out}), clauses_normally_present_but_absent (array of {clause, what_a_document_of_this_type_usually_says}), ambiguities_and_drafting_points (array of {clause, the_problem}), questions_for_the_other_side (array of strings), questions_for_the_reviewer (array: the points a qualified lawyer must decide, including every point that turns on a rule of law this tool must not state), not_covered (array: what this read did not look at, such as schedules, annexes or documents referred to but not supplied). Keep every string short. Do not include any view on whether the contract should be signed.\n\nCONTRACT:\n' + i.doc,
    output: 'fields', maxTokens: 5000,
    downloads: docDownloads('contract-review', 'Contract review — a first read for a lawyer to check'),
    sample: { inputs: { doc: 'DATED 1 OCTOBER 2026\n\nSERVICES AGREEMENT\nbetween HARROWGATE MILLS LIMITED (company number 11223344) of Unit 7, Calder Works, Halifax HX1 2AB (the “Customer”)\nand VERITY SYSTEMS LIMITED (company number 55667788) of 4 Pinfold Street, Leeds LS1 5AA (the “Supplier”)\n\n2. SERVICES. The Supplier shall provide the stock-control and despatch software described in Schedule 1 and shall use reasonable endeavours to maintain availability of 99.0% measured monthly, excluding planned maintenance. Schedule 1 is not attached to this copy.\n\n3. TERM. This Agreement begins on 1 October 2026 and continues for 36 months and thereafter renews automatically for successive periods of 24 months unless either party gives written notice not less than 6 months before the end of the then current period.\n\n4. CHARGES. £4,250 per month, payable quarterly in advance, plus VAT. The Supplier may increase the Charges once in any 12 month period on 30 days’ written notice by an amount not exceeding the increase in the Retail Prices Index plus 4%.\n\n5. PAYMENT. Invoices are payable within 14 days. Interest accrues on sums overdue at 8% above the base rate of the Supplier’s bank.\n\n6. CUSTOMER OBLIGATIONS. The Customer shall supply data in the format the Supplier specifies from time to time and shall not permit access to the Services by any third party.\n\n7. LIABILITY. The Supplier’s total liability in any 12 month period is limited to the Charges paid in the 3 months preceding the claim. The Supplier excludes all liability for loss of profit, loss of data and business interruption. Nothing in this clause limits liability for death or personal injury caused by negligence, or for fraud.\n\n8. INDEMNITY. The Customer shall indemnify and hold harmless the Supplier against all claims, losses, costs and expenses arising from the Customer Data or from any use of the Services by the Customer’s personnel, without limit.\n\n9. ASSIGNMENT. The Customer may not assign, novate or otherwise transfer this Agreement without the Supplier’s prior written consent. The Supplier may assign or subcontract freely.\n\n10. CHANGE OF CONTROL. If the Customer undergoes a change of control the Supplier may terminate on 30 days’ notice, and the Charges for the remainder of the then current period become immediately payable.\n\n11. TERMINATION. Either party may terminate for material breach not remedied within 30 days of written notice. The Customer may not terminate for convenience.\n\n12. DATA. The Supplier may use Customer Data in anonymised and aggregated form for any purpose, including the improvement of its own products.\n\n14. GOVERNING LAW. This Agreement is governed by the law of England and Wales and the parties submit to the exclusive jurisdiction of its courts.' }, opts: { kind: 'services', side: 'customer', law: 'stated', depth: 'full' } },
    tips: [
      'It reads and organises; it does not advise, and it will not tell you whether to sign. That judgement is the lawyer’s, and this is the note they read first.',
      'The two lists worth reading before anything else are the unusual clauses and the clauses normally present but absent. A missing clause leaves no trace in the text, which is exactly why a first read misses it.',
      'Every observation carries the clause number so you can go straight to the words. Where the model has misread a clause the number tells you at once — check the caps, the indemnities and the notice periods against the paper every time.',
      'It has no way of knowing what the law says today, so it never states a rule, a limitation period, a statutory cap or a fee. Anything that turns on one lands in questions for the reviewer instead, which is where it belongs.',
      'Schedules, annexes and documents referred to but not attached are listed under not covered. A liability cap that refers to a schedule you did not paste has not been reviewed.'
    ],
    faq: [
      { q: 'Is this legal advice?', a: 'No, and it is built so that it cannot become it. It reports what the document says, flags what is unusual or absent and turns everything else into a question. It expresses no view on whether to sign, whether a term is acceptable or what anyone should do, and it owes you no duty of care. A qualified lawyer in the relevant jurisdiction reviews the contract; this is the note that makes that review faster.' },
      { q: 'Can I send a client’s contract to it?', a: 'That is your decision under your own obligations, not ours. The text goes to the model through our gateway to be read and comes back as fields; we store neither, and Anthropic’s API terms exclude API data from training. Privilege, confidentiality, your retainer and your regulator’s rules are unaffected by any of that. Where you are unsure, redact the names and the figures first — the structure of a contract reviews perfectly well without them.' },
      { q: 'Why does it not tell me whether a liability cap is reasonable?', a: 'Because reasonableness is a question of law and of the bargain, and the answer moves with the jurisdiction, the statute in force and the facts. The tool sets out what the cap says, how it sits against the indemnity and the term, and asks the question. The answer is the reviewer’s.' },
      { q: 'How long a contract can it read?', a: 'About forty pages of text in one run. A long agreement with schedules is better read in parts — the main body first, then each schedule — because a single run that runs out of room truncates the answer, and the page tells you when that has happened.' }
    ]
  };

  /* ================================================================== */
  /* 2. Legal — letter writer                                            */
  /* ================================================================== */

  const LL_TYPES = [
    { value: 'lba', label: 'Letter before action / letter of claim' },
    { value: 'client-care', label: 'Client care and engagement letter' },
    { value: 'counsel', label: 'Instructions to counsel' },
    { value: 'settlement', label: 'Settlement proposal' },
    { value: 'response', label: 'Response to a letter received' },
    { value: 'chaser', label: 'Chaser — no reply received' },
    { value: 'update', label: 'Update to the client' },
    { value: 'closing', label: 'Closing letter — the matter has ended' },
    { value: 'custom', label: 'Something else (describe it in the facts)' }
  ];
  const LL_SHAPE = {
    lba: 'the parties and the matter; what happened, as a numbered chronology drawn only from the facts given; the basis of the claim stated as the client’s position, with [the legal basis relied on: to be settled and cited by the fee-earner]; the sum claimed and how it is made up; what is required, and by when using whatever the facts give — a calendar date as given, or, where the facts give a period such as 21 days, exactly "[date — 21 days from the date of this letter]" so the period survives and only the date is left open, and a bare [date] only when the facts give neither; what documents are enclosed; what will happen if there is no reply — only if the facts say what the client intends, and otherwise the single line [the client’s intention if there is no reply, and anything to be said about costs: to be confirmed on instructions], never a procedural step or a costs consequence you have supplied yourself; and [confirm the applicable pre-action conduct requirements and refer to them here]',
    'client-care': 'who will do the work and who supervises; the scope of the retainer and what is outside it; what the client must do; how charges are calculated, with every rate and estimate as a [placeholder] unless the facts give it; how and when bills are rendered; [insert the firm’s complaints procedure and the details of the relevant ombudsman or regulator]; [insert the firm’s data protection and file-retention wording]; what the client should do next to confirm instructions',
    counsel: 'a heading with the parties and the court or tribunal if given; who instructs and whom; the documents enclosed and their tab references; the background as a numbered chronology; the issues; what counsel is asked to advise on or to draft, as numbered questions; the timetable and any hearing date; and a closing line inviting counsel to raise anything the instructions do not cover',
    settlement: 'the matter and what is in dispute; a short statement of the client’s position from the facts; the offer itself, its components and what it is in full and final settlement of; how long it stays open; what happens on acceptance; [decide and insert the correct privilege or offer marking — for example whether this is to be sent without prejudice, or without prejudice save as to costs, or under a formal offer regime — and confirm it before sending]',
    response: 'the letter being answered, by date and reference; a point-by-point reply following the other side’s numbering, answering only from the facts given and marking anything not covered as [not addressed — instructions needed]; the client’s position; what is asked of the other side and by when; reservation of the client’s position in general terms',
    chaser: 'the earlier letter by date and reference; what was asked and has not been answered; a short restatement of the position; a new date for a reply; what the client intends if there is none, from the facts only',
    update: 'where the matter has got to; what has happened since the last update; what happens next and who is doing it; what the client needs to do and by when; costs to date and the estimate, as [placeholders] unless the facts give them; when the client will next hear',
    closing: 'that the matter has concluded and on what terms, from the facts; the final position on costs; what is enclosed and what is being returned; [insert the firm’s file-retention and destruction wording]; how to instruct the firm again',
    custom: 'a heading, an opening that says why the letter is written, the substance in numbered paragraphs drawn only from the facts, what is asked for and by when, and a close'
  };

  window.AI_TOOLS['legal-letter-writer'] = {
    title: 'Legal Letter Writer',
    short: 'Legal Letters',
    description: 'A draft letter for the fee-earner responsible to check and sign — it is not advice, it takes no view on the merits, and every draft says so on its first line. Letter before action, client care letter, instructions to counsel, settlement proposal, chaser or update: give the facts, get a properly structured letter back, with a [placeholder] wherever you did not say.',
    keywords: ['letter before action template', 'client care letter drafting', 'instructions to counsel template', 'settlement proposal letter', 'legal letter generator', 'solicitor letter drafting ai', 'pre action letter draft'],
    glyph: 'i-ai-legal-letter',
    glyphSvg: '<symbol id="i-ai-legal-letter" viewBox="0 0 24 24">\n  <path d="M5 2.8h8.6L18.2 7.4v8.2M5 2.8v18.4h7.6"/>\n  <path d="M13.6 2.8v4.6h4.6" class="thin"/>\n  <path d="M7.6 8.6h4.4M7.6 11.6h6.2M7.6 14.6h3.2" class="thin"/>\n  <circle cx="16.6" cy="16.8" r="2.5" class="thin"/>\n  <path d="M14.9 18.7l-.6 2.5 2.3-1.1 2.3 1.1-.6-2.5" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Draft', resultTitle: 'Draft letter — to be checked and signed',
    privacy: 'The facts you type are sent to the model, with emails, phone numbers, account, card and tax numbers masked on your device first; names, addresses and dates are not masked. Legal professional privilege and your duties to your client are yours to protect and are not discharged by us — give the letter the facts it needs and nothing more, and use initials where a name adds nothing.',
    inputs: [{ key: 'facts', label: 'The facts', type: 'text', rows: 10, placeholder: 'Who it is to and from; the matter and any reference; what happened, with dates; sums and documents; what you want the letter to ask for and by when; anything that must not be said. Initials are fine — the letter can carry [placeholders] for names.' }],
    options: [
      { key: 'kind', label: 'What to write', type: 'select', default: 'lba', options: LL_TYPES },
      { key: 'jurisdiction', label: 'Jurisdiction', type: 'select', default: 'none', options: [
        { value: 'none', label: 'Do not name one — keep the letter general' },
        { value: 'ew', label: 'England and Wales' },
        { value: 'in', label: 'India' }
      ] },
      { key: 'tone', label: 'Tone', type: 'select', default: 'measured', options: [{ value: 'measured', label: 'Measured and professional' }, { value: 'firm', label: 'Firm' }, { value: 'conciliatory', label: 'Conciliatory' }, { value: 'formal', label: 'Formal — for a court file' }] },
      { key: 'length', label: 'Length', type: 'select', default: 'standard', options: [{ value: 'short', label: 'Short — under 250 words' }, { value: 'standard', label: 'Standard' }, { value: 'full', label: 'Full — every section' }] },
      { key: 'from', label: 'From', type: 'text', placeholder: 'Fee-earner, role, firm — or leave blank for placeholders' }
    ],
    system: (o) => 'You draft correspondence for a qualified lawyer to check and sign. ' + NOT_ADVICE + ' The letter states the client’s position from the facts given and asks for what the facts say is wanted; it never expresses your own view of the merits, the prospects or what anyone ought to do. ' + NO_RULES
      + ' Everything the letter asserts must come from the facts supplied. Anything not supplied — a date, a figure, a reference, a name, an address, a rate, an enclosure — is a square-bracketed placeholder naming what goes there, never an invention and never a plausible-looking guess. '
      + (o.jurisdiction === 'ew' ? 'The matter is in England and Wales; use the register of correspondence usual there, and still leave every rule, protocol step, time limit and cost consequence as a bracketed instruction to confirm. ' : o.jurisdiction === 'in' ? 'The matter is in India; use the register of correspondence usual there, and still leave every rule, statutory notice, time limit and fee as a bracketed instruction to confirm. ' : 'Do not name a jurisdiction, a court, a protocol or a statute: keep the letter general so the fee-earner inserts them. ')
      + 'Write in British English, in a ' + ({ firm: 'firm register — direct, unambiguous, with no threat beyond what the facts state the client intends', conciliatory: 'conciliatory register — courteous, leaving room to resolve the matter, conceding nothing', formal: 'formal register suitable for a court file: numbered paragraphs, no contractions, no rhetoric' }[o.tone] || 'measured, professional register') + '. '
      + ({ short: 'Keep it under 250 words. ', full: 'Write it in full, with every section the type of letter calls for. ' }[o.length] || '')
      + 'Output the letter and nothing else: no commentary before or after it, no options, no explanation of your choices. On its own first line, before the letter, write exactly: DRAFT — written by an AI tool from the facts supplied. Not legal advice. To be checked and signed by the fee-earner responsible for the matter.',
    prompt: (i, o) => 'Write a ' + ((LL_TYPES.find(t => t.value === o.kind) || {}).label || 'letter') + '. Its parts, in order: the date and any reference as [placeholders] unless the facts give them; the addressee block; a subject line; then ' + (LL_SHAPE[o.kind] || LL_SHAPE.custom) + '; then the sign-off' + (o.from ? ' as: ' + o.from + '.' : ' as [Name], [Role], [Firm].') + ' Use # for the subject line and ## for any section heading, and number the substantive paragraphs.\n\nFACTS:\n' + i.facts,
    output: 'text', maxTokens: 2500,
    sample: { inputs: { facts: 'Letter before action for our client Harrowgate Mills Limited, Unit 7 Calder Works, Halifax HX1 2AB. Our reference HML/0412.\nTo: the directors of Verity Systems Limited, 4 Pinfold Street, Leeds LS1 5AA.\nBackground: services agreement dated 1 October 2026 for stock-control software. Go-live was contracted for 1 April 2027 and did not happen until 19 June 2027. Our client logged 61 incidents between 19 June and 31 August 2027; the other side’s own ticket export shows 44 for the same period.\nOur client withheld the quarterly charge of £12,750 due on 1 September 2027. Verity suspended two modules on 3 October 2027 without notice under the agreement.\nOur client terminated on 12 January 2028 relying on clause 11 (material breach not remedied). Verity’s solicitors disputed the termination on 2 February 2028 and claim the balance of the term.\nWhat we want: repayment of £38,250 paid for the period of non-availability, confirmation that no further sums are claimed, and the return of our client’s data in a usable format. A reply within 21 days.\nEnclosures: the agreement, the incident schedule, the termination notice.\nDo not concede that the withheld charge was wrongly withheld. Do not name a figure for damages beyond the £38,250.' }, opts: { kind: 'lba', jurisdiction: 'ew', tone: 'firm', length: 'full', from: 'T. Okonjo, Associate, Calderbank & Vane LLP' } },
    tips: [
      'Give facts, not a half-written letter. Dates, sums, references, what you want and by when — the draft is better from a list than from prose you have already started.',
      'Search the draft for "[" before it goes anywhere. Every rule of law, protocol step, time limit, interest rate and court fee comes back as a bracketed instruction, because the tool has no way of knowing what is in force today and will not guess.',
      'Privilege markings are left to you on purpose. A settlement proposal comes back with a bracketed instruction to decide how it should be marked and to confirm it before sending; the tool will not choose for you.',
      'You should have the fee-earner responsible read every word before it is signed. The first line of the draft says the same thing, and it is there so that a draft mailed by mistake announces itself.',
      'Say what must not be said. "Do not concede X" and "do not name a figure beyond Y" are instructions the model follows, and they are easier to give up front than to unpick afterwards.'
    ],
    faq: [
      { q: 'Is this legal advice?', a: 'No. It is a letter drafted by a language model from the facts you typed, using the structure that kind of letter usually has. It takes no view on the merits, states no rule of law, and is not a substitute for reading the file. The fee-earner responsible for the matter checks it, completes the placeholders and signs it.' },
      { q: 'Why will it not cite the protocol or the limitation period?', a: 'Because it cannot check what is in force today, and a citation that is confidently wrong is worse in a letter before action than an obvious gap. Anything of that kind comes back as a bracketed instruction naming what to confirm and cite. If you paste the rule into the facts, the letter will use your words.' },
      { q: 'Can it write in Hindi, or in a regional language?', a: 'Ask for it in the facts ("write this in Hindi") and it will. A letter that may be read in a court or by a regulator is worth having checked by someone fluent before it is sent — a translation is a draft too.' }
    ]
  };

  /* ================================================================== */
  /* 3. Legal — case and bundle summariser                               */
  /* ================================================================== */

  const CS_MATTERS = [
    { value: 'auto', label: 'Let the papers say' },
    { value: 'civil', label: 'Civil or commercial dispute' },
    { value: 'employment', label: 'Employment' },
    { value: 'injury', label: 'Personal injury or clinical negligence' },
    { value: 'family', label: 'Family' },
    { value: 'property', label: 'Property or conveyancing' },
    { value: 'probate', label: 'Probate and estates' },
    { value: 'immigration', label: 'Immigration' },
    { value: 'regulatory', label: 'Regulatory or disciplinary' },
    { value: 'other', label: 'Something else' }
  ];

  window.AI_TOOLS['case-summariser'] = {
    title: 'Case & Bundle Summariser',
    short: 'Case Summariser',
    description: 'A chronology and an issues list for a qualified lawyer to check against the file — a working summary, not advice and not evidence. Dates and events with the party and the source, the issues the papers raise, every document referred to, the figures, the inconsistencies, and the gaps where the papers stop short.',
    keywords: ['case chronology generator', 'legal bundle summary ai', 'witness statement chronology', 'summarise court bundle', 'case summary for solicitors', 'chronology from documents', 'litigation document summary'],
    glyph: 'i-ai-case',
    glyphSvg: '<symbol id="i-ai-case" viewBox="0 0 24 24">\n  <path d="M6.5 3.2v17.6"/>\n  <circle cx="6.5" cy="7" r="1.7" class="thin"/>\n  <circle cx="6.5" cy="12" r="1.7" class="thin"/>\n  <circle cx="6.5" cy="17" r="1.7" class="thin"/>\n  <path d="M10.6 7h9M10.6 12h7M10.6 17h4.8" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Summarise', resultTitle: 'Working summary — to be checked against the file',
    privacy: 'The text of the document is sent to the model; the file is read on your device and never leaves it, and the shield masks emails, phone numbers, account, card and tax numbers first. Names, addresses, dates of birth and medical detail in the papers are not masked and travel as written. Privilege and your client’s confidentiality remain your responsibility — paste the passages the chronology needs, not the whole bundle because it is to hand.',
    inputs: [{ key: 'doc', label: 'The document or bundle extract', type: 'text+file', accept: '.pdf,.txt,.md', rows: 14, placeholder: 'Paste the statement, attendance note, correspondence run or bundle extract, or choose the PDF above. Up to about 40 pages a run; a long bundle reads better section by section.' }],
    options: [
      { key: 'matter', label: 'Kind of matter', type: 'select', default: 'auto', options: CS_MATTERS },
      { key: 'parties', label: 'Parties and roles (optional)', type: 'text', placeholder: 'e.g. Harrowgate Mills Ltd — claimant; Verity Systems Ltd — defendant', hint: 'So roles are labelled the way your file labels them' },
      { key: 'depth', label: 'What to produce', type: 'select', default: 'full', options: [{ value: 'full', label: 'Full — chronology, issues, documents, gaps' }, { value: 'chronology', label: 'Chronology only' }] }
    ],
    system: (o) => 'You prepare a working summary of legal papers for a qualified lawyer to check against the file. ' + NOT_ADVICE + ' You do not assess the merits, the strength of a case, the credibility of a witness or what any party ought to do; you record what the papers say and where they say it. ' + NO_RULES
      + ' Be terse, because a long answer is a truncated answer: the event in a chronology entry is at most 20 words, every other string is at most 30 words, and no array except chronology and undated_events holds more than six entries. '
      + 'Rules for the chronology: one entry per event; the date as YYYY-MM-DD where the text gives one, with the date exactly as written kept beside it; the event in one short factual sentence using the document’s own words for anything contentious; the party or person it concerns; the place in the text it comes from, such as a tab, a paragraph or a page. Where a date is approximate, disputed or absent, say so in certainty and never convert a vague reference into a firm date. Where two passages disagree, record both and list the disagreement; do not choose between them. Where the papers stop short, that is a gap and it goes in the gaps list rather than being filled. '
      + (o.matter && o.matter !== 'auto' ? 'The user says this is a ' + ((CS_MATTERS.find(m => m.value === o.matter) || {}).label || 'matter').toLowerCase() + ' matter; use the vocabulary that fits it, and correct the description in document_type if the papers read otherwise. ' : '')
      + (o.parties ? 'The parties and their roles, as the file has them: ' + o.parties + '. Label people accordingly. ' : '')
      + (o.depth === 'chronology' ? 'The user wants the chronology only: fill parties, chronology, undated_events and gaps_and_missing_information properly, and return empty arrays or null for the rest. ' : '')
      + JSON_ONLY,
    prompt: (i) => 'Summarise these papers. Return JSON with exactly these keys: document_type, what_this_is (one sentence), parties (array of {name, role}), people (array of {name, who_they_are}), chronology (array of {date, date_as_written, event, who, source_reference, certainty (stated|approximate|disputed|inferred)}), undated_events (array of {event, who, source_reference}), issues (array of {issue, what_the_papers_say, where}), documents_referred_to (array of {document, date, what_it_is, is_it_in_this_text (yes|no|unclear)}), figures_and_amounts (array of {amount, currency, what, where}), inconsistencies (array of {what_conflicts, first_version, second_version, where}), gaps_and_missing_information (array of strings), questions_for_the_file (array of 4–6 strings: what a fee-earner should check, find or ask about), not_covered (array: what this summary did not read or could not read). Keep the chronology in date order, undated events last, and every string short.\n\nPAPERS:\n' + i.doc,
    output: 'fields', maxTokens: 6000,
    downloads: (data, ctx) => {
      const chron = Array.isArray(data && data.chronology) ? data.chronology.filter(x => x && typeof x === 'object') : [];
      const out = docDownloads('case-summary', 'Case summary — to be checked against the file')(data);
      if (chron.length && ctx && ctx.sheet) out.unshift({ name: 'chronology.csv', blob: () => new Blob([ctx.sheet.toCSV(ctx.sheet.objectsToRows(chron))], { type: 'text/csv' }) });
      return out;
    },
    sample: { inputs: { doc: 'ATTENDANCE NOTE AND ENCLOSURES — extract from the bundle\nMatter: Harrowgate Mills Limited v Verity Systems Limited\nPrepared by: T. Okonjo, 14 August 2028\n\nOn 1 October 2026 Harrowgate Mills Limited (“Harrowgate”) and Verity Systems Limited (“Verity”) signed a services agreement for stock-control software (the Agreement, tab 4). It was signed for Harrowgate by Mrs D. Ellery, operations director, and for Verity by Mr K. Prasad, a director.\n\nGo-live was set for 1 April 2027. Verity’s project plan of 10 February 2027 (tab 7) records the same date.\n\nOn 28 March 2027 Verity emailed Harrowgate to say go-live would move to 6 May 2027. Mrs Ellery replied the same day asking for the reason. The file contains no reply.\n\nGo-live took place on 19 June 2027. Between 19 June and 31 August 2027 Harrowgate’s despatch team logged 61 incidents (schedule at tab 12). Verity’s own ticket export, produced on 2 September 2027, shows 44 for the same period. The two figures have never been reconciled.\n\nOn 4 September 2027 Harrowgate withheld the quarterly charge of £12,750 that had fallen due on 1 September 2027.\n\nVerity issued a late payment notice on 19 September 2027 and on 3 October 2027 suspended two modules.\n\nMrs Ellery and Mr Prasad met on 21 October 2027. There is no note of that meeting on the file. Mrs Ellery’s recollection, given on 11 August 2028, is that Verity offered a credit of £6,000. Mr Prasad’s letter of 30 October 2027 (tab 19) refers to “a gesture” but names no figure.\n\nHarrowgate gave notice terminating the Agreement on 12 January 2028, relying on clause 11.\n\nVerity’s solicitors wrote on 2 February 2028 disputing the termination and claiming the balance of the term. Their letter refers to a technical report of “late 2027” which has not been provided.\n\nCounsel is not yet instructed. The Agreement’s notice provisions at clause 11 have not been checked against the correspondence.' }, opts: { matter: 'civil', parties: 'Harrowgate Mills Ltd — claimant; Verity Systems Ltd — defendant', depth: 'full' } },
    tips: [
      'Download chronology.csv and it drops into a bundle index or a witness statement skeleton with the source reference already beside each entry.',
      'The certainty column is the one to read first: "inferred" means the model worked the date out rather than read it, and every inferred date needs checking against the paper before it goes anywhere near a court document.',
      'Inconsistencies are recorded, not resolved. Two figures for the same period appear as two figures with both sources; deciding which is right is the fee-earner’s job and usually needs a document neither passage contains.',
      'Gaps are the point of the exercise. A missing attendance note, a report referred to but never provided, a reply the file does not have — those turn into the questions for the file, which is the list you work from.',
      'Forty pages a run reads reliably. A full bundle is better fed a section at a time: the pleadings, then the correspondence, then each statement, and the chronologies pasted together afterwards.'
    ],
    faq: [
      { q: 'Can I rely on the chronology?', a: 'Not without checking it. It is a first pass over the text you gave it, with a source reference against every entry so that checking is quick. Dates are copied, not computed, and anything the model worked out rather than read is marked inferred. A chronology that goes on a court file is settled by a person.' },
      { q: 'Is this legal advice?', a: 'No. It records what the papers say and lists what they do not. It offers no view on the merits, no assessment of a witness, no prospects and no recommendation, and it states no rule of law — anything that turns on one becomes a question for the file.' },
      { q: 'What about privilege and confidentiality?', a: 'They are unaffected by this tool and remain entirely yours. The text goes to the model through our gateway and comes back as fields; we store neither. Whether a privileged document may be sent to a third-party processor is a question for your retainer, your client and your regulator — and often the answer is to paste the passages you need rather than the file.' }
    ]
  };

  /* ================================================================== */
  /* 4. Property — listing writer                                        */
  /* ================================================================== */

  const PL_MARKETS = { uk: 'the United Kingdom: square feet or square metres as the facts give them, £ sterling, tenure described as the facts describe it', in: 'India: square feet, ₹ with the Indian lakh and crore grouping where the facts use it, and the local vocabulary for carpet, built-up and super built-up area kept exactly as given', other: 'a market the user has not named: keep units and currency exactly as the facts give them' };

  window.AI_TOOLS['property-listing-writer'] = {
    title: 'Property Listing Writer',
    short: 'Property Listings',
    description: 'A draft listing for the agent to check and evidence before it is published — property particulars are regulated, nothing here has been verified, and no claim in it is a claim we make. Headline, description and key features from your facts, plus a list of every statement that needs proof on file before it goes live and every fact a buyer will ask for that you have not given.',
    keywords: ['property listing writer', 'estate agent description generator', 'property particulars draft', 'rightmove listing description', 'property advert copywriting', 'letting listing writer', 'real estate listing ai'],
    glyph: 'i-ai-property-listing',
    glyphSvg: '<symbol id="i-ai-property-listing" viewBox="0 0 24 24">\n  <rect x="4.2" y="3.8" width="15.6" height="9.4" rx="1"/>\n  <path d="M7.2 7h9.6M7.2 10h5.6" class="thin"/>\n  <path d="M12 13.2v7.1M9 20.3h6" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Write listing', resultTitle: 'Draft listing — evidence the claims before publishing',
    privacy: 'The facts about the property are sent to the model, with emails, phone numbers, account, card and tax numbers masked on your device first. A vendor’s or a tenant’s personal details are not needed to write a listing, so leave them out. What you publish is yours to make accurate and to evidence under the rules that bind you; this tool checks nothing and verifies nothing.',
    inputs: [{ key: 'facts', label: 'The property', type: 'text', rows: 12, placeholder: 'Address and type; for sale or to let, and the price or rent; tenure; rooms and their sizes; condition, age, works done and when; heating, glazing, parking, outside space; what you have measured and what the vendor told you; what you do not yet have (EPC, floor plan, council tax band, sign-off for works).' }],
    options: [
      { key: 'market', label: 'Market', type: 'select', default: 'uk', options: [{ value: 'uk', label: 'United Kingdom' }, { value: 'in', label: 'India' }, { value: 'other', label: 'Somewhere else' }] },
      { key: 'kind', label: 'Property', type: 'select', default: 'house', options: [
        { value: 'house', label: 'House' }, { value: 'flat', label: 'Flat or apartment' }, { value: 'newbuild', label: 'New build' },
        { value: 'land', label: 'Land or plot' }, { value: 'commercial', label: 'Commercial' }, { value: 'room', label: 'Room in a shared property' }
      ] },
      { key: 'purpose', label: 'For', type: 'select', default: 'sale', options: [{ value: 'sale', label: 'Sale' }, { value: 'let', label: 'Letting' }] },
      { key: 'tone', label: 'Voice', type: 'select', default: 'plain', options: [{ value: 'plain', label: 'Plain and factual' }, { value: 'warm', label: 'Warm' }, { value: 'premium', label: 'Premium, understated' }] },
      { key: 'length', label: 'Length', type: 'select', default: 'standard', options: [{ value: 'standard', label: 'Portal listing — standard' }, { value: 'short', label: 'Short — a window card or a post' }] }
    ],
    system: (o) => 'You draft property particulars for an estate or letting agent to check, evidence and publish. ' + NOT_ADVICE + ' You do not advise on price, on marketing strategy, on whether to publish, or on what the rules require. '
      + 'The rule that governs everything you write: you may use only the facts given, you must never invent or estimate a measurement, a tenure, a lease length, a service charge, a ground rent, a council tax band, an energy rating, an age, a distance, a journey time, a school, a permission or a sign-off, and you must never dress an unverified statement as a verified one. Where the facts attribute something to the vendor or landlord, the copy attributes it the same way in plain words. Where a fact is missing, it does not appear in the copy at all; it appears in facts_not_given. '
      + 'Then, separately, list every statement in the copy that a reader would take as a statement of fact and that needs something on file before publication, saying for each what would evidence it and where in the copy it sits. Treat superlatives and unprovable comparatives ("the best", "the largest in the area", "a short walk", "sought after", "investment opportunity", "will not be available long") as claims: either drop them or list them. ' + NO_RULES
      + ' Market: ' + (PL_MARKETS[o.market] || PL_MARKETS.other) + '. Write in British English, in a ' + ({ warm: 'warm voice — human, still precise', premium: 'premium, understated voice — restrained, no adjectives doing the work of facts' }[o.tone] || 'plain, factual voice') + ', for ' + (o.purpose === 'let' ? 'a letting' : 'a sale') + ' of ' + ({ flat: 'a flat or apartment', newbuild: 'a new build', land: 'land or a plot', commercial: 'a commercial property', room: 'a room in a shared property' }[o.kind] || 'a house') + '. '
      + (o.length === 'short' ? 'Keep the description to about 60 words in one paragraph and the key features to five. ' : '')
      + JSON_ONLY,
    prompt: (i, o) => 'Write a draft listing. Return JSON with exactly these keys: headline (under 70 characters, factual), summary_line (one sentence a portal would show under the headline), description (array of ' + (o.length === 'short' ? '1 paragraph' : '3–5 paragraphs') + ', each a string), key_features (array of ' + (o.length === 'short' ? '5' : '6–10') + ' short factual bullets, each traceable to a fact given), location_paragraph (string, or null if the facts give nothing about the location that can be stated without checking), claims_needing_evidence (array of {claim, where_it_appears, what_would_evidence_it}), attributed_to_the_vendor (array of strings: the statements the copy attributes to the vendor or landlord rather than to the agent), facts_not_given (array: what a buyer or tenant will ask that the facts do not answer), claims_left_out (array of {claim_or_phrase, why_it_was_not_used}), before_you_publish (array of 5–8 short checks, written as questions for the agent, naming no rule). Do not state anything the facts do not.\n\nFACTS:\n' + i.facts,
    output: 'fields', maxTokens: 3000,
    downloads: docDownloads('property-listing', 'Draft property listing — evidence before publishing'),
    sample: { inputs: { facts: 'Three-bedroom semi-detached house, 14 Calder Rise, Sowerby Bridge, West Yorkshire. For sale, guide price £285,000, freehold.\nBuilt about 1935. Two reception rooms, kitchen-diner refitted in 2023, downstairs WC, three bedrooms (two double, one single), family bathroom with a shower over the bath.\nGas central heating, boiler installed 2022, uPVC double glazing throughout.\nEPC: we have not received the certificate yet. Council tax band: not yet confirmed with the council.\nGarden to the rear, roughly 15 metres, south facing according to the vendor. Off-street parking for two cars on a block-paved drive. No garage.\nThe loft was boarded by the vendor. We have not seen building regulations sign-off for anything.\nThe vendor says the primary school is a five-minute walk and the railway station is “about ten minutes”. Neither has been measured.\nVendor is chain free and keen for a quick sale.\nPhotographs: 14 taken. Floor plan not yet drawn. All measurements were taken by the vendor, not by us.' }, opts: { market: 'uk', kind: 'house', purpose: 'sale', tone: 'plain', length: 'standard' } },
    tips: [
      'The claims needing evidence list is the reason this tool exists. Particulars are regulated in most markets, and the sentence that causes the trouble is usually the one nobody remembers writing — a distance, a measurement, a band, a rating.',
      'Anything the vendor told you is attributed to the vendor in the copy and listed separately, so you can see at a glance how much of the description is somebody else’s account rather than yours.',
      'Nothing is invented. No EPC rating, no council tax band, no lease length, no square footage and no "five minutes from the station" unless your facts say it — and if your facts say the vendor said it, the copy says so too.',
      'Superlatives come out. "Sought after", "a short walk", "must be seen" and "will not be available long" are claims a reader treats as facts, and they either go or they appear in the list with what would evidence them.',
      'Tell the tool what you do not yet have. "EPC not received" and "no sign-off seen" produce a better listing than silence does, because the gaps end up in the checklist rather than in the copy.'
    ],
    faq: [
      { q: 'Does this make my particulars compliant?', a: 'No, and nothing could. It drafts copy from your facts, attributes what the vendor said, refuses to invent anything, and hands you a list of every statement that needs evidence on file. Whether the finished particulars satisfy the rules that bind you is a judgement for you and, where it matters, for your compliance adviser or your lawyer.' },
      { q: 'Why will it not say the house is two minutes from the station?', a: 'Because it has no map, no timetable and no way to check, and a distance stated in particulars is a statement of fact a buyer may rely on. If you have measured it, put the measurement in the facts and the copy will use it. If the vendor said it, the copy will say the vendor said it.' },
      { q: 'Can it write listings for several properties at once?', a: 'One property a run. Each listing depends on the detail of that property and its evidence list, and a batch would flatten both. For a portfolio, run them one after another and keep the evidence lists together.' }
    ]
  };

  /* ================================================================== */
  /* 5. Property — tenancy and leave-and-licence drafter                 */
  /* ================================================================== */

  const TA_DOCS = [
    { value: 'ew-tenancy', label: 'England and Wales — residential tenancy' },
    { value: 'in-licence', label: 'India — leave and licence' },
    { value: 'in-rent', label: 'India — residential rent agreement' }
  ];
  const TA_CLAUSES = {
    'ew-tenancy': 'the parties and the property, with any included furniture, appliances and parking listed; the term and its start and end dates; the rent, when it is payable, how it is paid, and what happens if it is late; the deposit, its amount and [the scheme it will be protected in and the prescribed information to be given: to be settled by the solicitor]; outgoings — council tax, utilities, water, broadband, any service charge — and who bears each; the condition of the property and the inventory; the tenant’s obligations (use, care, reporting disrepair, no sub-letting, no business use, pets, smoking, alterations, insurance); the landlord’s obligations, including repairs, expressed as the parties have agreed them with [the repairing obligations implied by statute: to be settled and inserted]; access and notice before entry; assignment and sub-letting; how the tenancy ends, with every notice period as a [placeholder to be settled]; the position on rent review if the facts mention one; notices and addresses for service; a break clause if the facts mention one; general clauses (entire agreement, severability, joint and several liability where there is more than one tenant, counterparts, governing law); and the signature block',
    'in-licence': 'the parties and the licensed premises, with any furniture, fittings and parking listed; the licence period, any lock-in and the commencement date; the licence fee, when it is payable and how; the interest-free refundable security deposit and the terms and timing of its refund; outgoings — electricity, water, maintenance or society charges, property tax — and who bears each; the permitted use and the restrictions on the licensee (no sub-letting, no assignment, no structural change, no business use unless stated); the licensor’s right of entry on notice; maintenance and repairs, divided between the parties as the facts state; termination and the notice each side must give; the condition on handover and the inventory; [who bears stamp duty and registration, and the registration that this kind of document requires: to be confirmed and inserted by the advocate]; a plain statement that the document is intended to create a licence and not a tenancy, followed by [confirm that the substance of the arrangement matches that intention]; notices; general clauses; and the signature and witness block',
    'in-rent': 'the parties and the demised premises, with any furniture, fittings and parking listed; the term, the commencement date and any lock-in; the rent, when it is payable and how, and any escalation the facts state; the refundable security deposit and the terms of its refund; outgoings — electricity, water, maintenance or society charges, property tax — and who bears each; the permitted use and the tenant’s restrictions (no sub-letting, no assignment, no structural change); the landlord’s obligations and major repairs; access on notice; termination and the notice each side must give; the condition on handover and the inventory; [who bears stamp duty and registration, and what registration this document requires: to be confirmed and inserted by the advocate]; notices; general clauses; and the signature and witness block'
  };

  window.AI_TOOLS['tenancy-agreement-drafter'] = {
    title: 'Tenancy & Leave-and-Licence Drafter',
    short: 'Tenancy Drafter',
    description: 'A first draft for a solicitor or advocate to settle before anyone signs, and every draft opens with a banner that says exactly that — it is not advice and it is not a form you can rely on. A residential tenancy for England and Wales, or a leave and licence or rent agreement for India, built only from the terms you give, with a [placeholder] wherever you did not decide.',
    keywords: ['tenancy agreement draft', 'assured shorthold tenancy template', 'leave and licence agreement draft', 'rent agreement format india', 'landlord tenant agreement generator', 'residential tenancy drafting ai', 'letting agreement draft'],
    glyph: 'i-ai-tenancy',
    glyphSvg: '<symbol id="i-ai-tenancy" viewBox="0 0 24 24">\n  <path d="M5.5 2.8h8.6L18.7 7.4v13.8H5.5z"/>\n  <path d="M14.1 2.8v4.6h4.6" class="thin"/>\n  <path d="M8.2 11h7.8M8.2 13.8h7.8" class="thin"/>\n  <circle cx="9.9" cy="17.6" r="1.9" class="thin"/>\n  <path d="M11.8 17.6h4.3M14.5 17.6v1.8" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Draft', resultTitle: 'DRAFT — not for signature until a solicitor has settled it',
    privacy: 'The terms you type are sent to the model, with emails, phone numbers, account, card and tax numbers masked on your device first. Names and addresses are not masked, so use initials and [placeholders] until the draft is back and put the real details in yourself. The draft is not advice, and your own duties as a landlord, an agent or a lawyer are not discharged by us.',
    inputs: [{ key: 'facts', label: 'The parties and the terms', type: 'text', rows: 12, placeholder: 'Who the landlord or licensor is and who the tenant or licensee is; the property and what is included; the term and the start date; the rent or licence fee, when and how it is paid; the deposit; who pays which outgoings; pets, smoking, sub-letting, business use; the inventory; anything either side insisted on; anything still undecided — say so and it becomes a placeholder.' }],
    options: [
      { key: 'doc', label: 'Document', type: 'select', default: 'ew-tenancy', options: TA_DOCS },
      { key: 'length', label: 'Length', type: 'select', default: 'full', options: [{ value: 'full', label: 'Full draft' }, { value: 'short', label: 'Short form — the essential clauses' }] },
      { key: 'checklist', label: 'Close with a checklist for the solicitor', type: 'select', default: 'yes', options: [{ value: 'yes', label: 'Yes — list what must be settled before signature' }, { value: 'no', label: 'No — the draft only' }] }
    ],
    system: (o) => 'You draft residential occupation documents as a first draft for a qualified solicitor or advocate to settle. ' + NOT_ADVICE + ' You never say that the draft is ready, that a term is fair or enforceable, or that anyone may sign it. ' + NO_RULES
      + ' This applies with particular force here: never state a notice period, a deposit-protection requirement, a prescribed form, a rent-increase mechanism, a registration requirement, a stamp duty figure, a statutory repairing obligation or a court procedure as current fact. Each of those is a square-bracketed instruction naming what must be settled and by whom. '
      + 'Use only the facts given. Every fact not given is a square-bracketed placeholder saying what goes there — [landlord’s address for service], [deposit scheme and prescribed information], [date] — never an invented name, figure, date or address. '
      + 'Conventions: British English; defined terms with initial capitals, each defined once; every clause numbered, each sub-clause on its own line with a blank line between clauses; plain language and no Latin; parties described by role after they are first named. '
      + (o.length === 'short' ? 'Short form: the essential clauses only, each kept to a sentence or two. ' : '')
      + 'Begin with exactly these two lines, in this order and nothing before them:\nDRAFT — NOT FOR SIGNATURE.\nPrepared by an AI tool from the terms supplied. Not legal advice. Every bracketed item must be settled, and the whole document reviewed, by a qualified ' + (o.doc === 'ew-tenancy' ? 'solicitor' : 'advocate') + ' before anyone signs.\n'
      + (o.checklist === 'yes' ? 'End the document, after the signature block, with a section headed "## Before this is signed — for the solicitor" listing every bracketed item and every point of law that has been deliberately left open, each as one line. ' : '')
      + 'No commentary before or after the document beyond what is asked for here.',
    prompt: (i, o) => 'Draft a ' + (o.length === 'short' ? 'short-form ' : '') + ((TA_DOCS.find(d => d.value === o.doc) || {}).label || 'agreement') + '. Structure: the two banner lines; then the title; the date and the parties with their addresses as given or as [placeholders]; a short recital of what is being agreed; then numbered clauses covering ' + (TA_CLAUSES[o.doc] || TA_CLAUSES['ew-tenancy']) + '. Use # for the title and ## for each clause heading.\n\nTERMS:\n' + i.facts,
    output: 'text', maxTokens: 6000,
    sample: { inputs: { facts: 'England and Wales, residential tenancy.\nLandlord: Mrs D. Ellery, 4 Pinfold Street, Leeds LS1 5AA. No agent — the landlord manages it herself.\nTenants: Mr J. Ambrose and Ms P. Okafor, jointly.\nProperty: Flat 2, 14 Calder Rise, Sowerby Bridge HX6 2QT. Unfurnished apart from white goods — fridge-freezer, washing machine and cooker. One allocated parking space.\nTerm: 12 months from 1 November 2026. Rent £925 a month, payable on the 1st of each month by standing order to the landlord.\nDeposit £1,065. The landlord wants the agreement to say which scheme it will be protected in but has not chosen one yet.\nCouncil tax and utilities to the tenants. Water is metered. Broadband to the tenants.\nNo pets without written consent, which is not to be unreasonably refused. No smoking. No sub-letting. No business use.\nTenants to report disrepair promptly. Landlord to give notice before visiting except in an emergency.\nGarden: the tenants keep it tidy, the landlord cuts the hedge once a year.\nAn independent inventory clerk will take the inventory on the day of check-in.\nThe landlord wants a clause about reviewing the rent at the end of the term but has not decided the mechanism.\nNothing has been agreed about a break clause.' }, opts: { doc: 'ew-tenancy', length: 'full', checklist: 'yes' } },
    tips: [
      'The banner is not decoration. A tenancy is one of the documents most often signed from a draft nobody settled, so the first two lines say what this is, and they stay there when the text is pasted into a letter or a word processor.',
      'Search for "[" and deal with every one. Notice periods, deposit protection, prescribed information, registration and stamp duty all come back as bracketed instructions because the tool cannot check what is in force today and will not guess.',
      'Say what has not been decided. "No break clause agreed" and "scheme not chosen yet" give you a placeholder in the right place; silence gives you nothing at all.',
      'Writing a document does not stamp it, register it or protect a deposit. The draft says who is to do each of those; it does not do any of them, and it does not tell you what the requirement is.',
      'You should have a solicitor or an advocate settle this before anyone signs — not because the draft is poor, but because a tenancy is local, detailed and unforgiving, and the cost of settling a draft is far below the cost of the alternative.'
    ],
    faq: [
      { q: 'Can I use this as my tenancy agreement?', a: 'Not as it stands. It is a first draft written by a language model from the terms you typed; it can be wrong, incomplete or unsuitable, it deliberately leaves every point of law open, and it owes you no duty of care. A qualified solicitor or advocate settles it before anyone signs.' },
      { q: 'Why does it not fill in the notice period?', a: 'Because notice periods in residential tenancies change, they differ by document type and by where the property is, and a wrong one in a signed agreement is expensive in a way that an obvious gap is not. The draft names the point and leaves it bracketed for the person who can check it.' },
      { q: 'Does it handle a lodger, a company let or a commercial lease?', a: 'No. It drafts a residential tenancy for England and Wales, and a leave and licence or a residential rent agreement for India. Anything else — a lodger agreement, a company let, a commercial lease, a Scottish tenancy — is a different document with different law behind it, and this tool does not pretend to know it.' }
    ]
  };

  /* ================================================================== */
  /* 6. Property — document reader (photo or scan)                       */
  /* ================================================================== */

  const PD_KINDS = [
    { value: 'auto', label: 'Let the tool say what it is' },
    { value: 'title', label: 'Title register, title deed or khata' },
    { value: 'saledeed', label: 'Sale deed or conveyance' },
    { value: 'survey', label: 'Survey or condition report' },
    { value: 'epc', label: 'Energy certificate (EPC)' },
    { value: 'tenancy', label: 'Tenancy, rent or leave-and-licence agreement' },
    { value: 'search', label: 'Search result or encumbrance certificate' },
    { value: 'tax', label: 'Property tax receipt or demand' },
    { value: 'other', label: 'Something else' }
  ];

  window.AI_TOOLS['property-document-reader'] = {
    title: 'Property Document Reader (photo or scan)',
    short: 'Property Doc Reader',
    description: 'The typed fields from a photograph or scan, with a checklist of what to verify against the original — it reads, it does not verify, and nothing it returns is advice or a statement that the document is genuine. Title documents, surveys, energy certificates, sale deeds and rent agreements come back as names, dates, numbers and terms for a conveyancer or an agent to check.',
    keywords: ['read title deed scan', 'property document ocr', 'sale deed data extraction', 'epc certificate reader', 'tenancy agreement scan to fields', 'conveyancing document reader', 'title register extraction'],
    glyph: 'i-ai-property-doc',
    glyphSvg: '<symbol id="i-ai-property-doc" viewBox="0 0 24 24">\n  <path d="M3.4 7.8V5.3a1.9 1.9 0 0 1 1.9-1.9h2.4M16.3 3.4h2.4a1.9 1.9 0 0 1 1.9 1.9v2.5M20.6 16.2v2.5a1.9 1.9 0 0 1-1.9 1.9h-2.4M7.7 20.6H5.3a1.9 1.9 0 0 1-1.9-1.9v-2.5"/>\n  <path d="M7.4 12.6L12 8.9l4.6 3.7"/>\n  <path d="M8.9 13.6v3.9h6.2v-3.9" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Read document', resultTitle: 'Document read — verify against the original',
    privacy: 'The picture of the document is sent to the model, resized on your device first. The shield masks identifiers in the notes you type, but it cannot mask pixels: names, addresses, signatures and numbers printed on the page travel as they are, so cover what should not go before you photograph it. Read only a document you may lawfully hold, and remember that your duties to your client, and under UK GDPR or the DPDP Act, stay with you.',
    inputs: [{ key: 'notes', label: 'The document — photo, scan or PDF', type: 'image', rows: 3, placeholder: 'Optional notes for the model: which document it is if the photo shows only part of it, which pages belong together, what you need typed out.' }],
    options: [
      { key: 'kind', label: 'What it is', type: 'select', default: 'auto', options: PD_KINDS },
      { key: 'market', label: 'Where the property is', type: 'select', default: 'uk', options: [{ value: 'uk', label: 'United Kingdom' }, { value: 'in', label: 'India' }, { value: 'other', label: 'Somewhere else' }] }
    ],
    system: (o) => 'You read property documents that arrive as a picture — a photograph or a scan — and type out what is printed on them, for a conveyancer, solicitor or agent to check against the original. ' + NOT_ADVICE + ' You do not interpret the document, advise on it, or say what follows from it. ' + NO_RULES
      + ' Read directly from the pixels, including stamps, seals, handwriting, marginal notes and faint print. Copy names, numbers, references and measurements exactly as printed, character for character, keeping the units and the spelling of the original; dates as YYYY-MM-DD, with the date as printed kept beside them where the format is ambiguous. Where a value cannot be read with confidence, return null and name the field in unreadable_fields rather than guessing. '
      + 'You read; you do not verify. Never say that a document is genuine, current, registered, valid or complete, and never say that something it states is true. The checklist you return is what a person must verify by other means — against the register or the issuing authority, against the other documents in the file, and against the original paper. '
      + (o.kind && o.kind !== 'auto' ? 'The user says this is a ' + ((PD_KINDS.find(k => k.value === o.kind) || {}).label || 'property document').toLowerCase() + '; test that against the picture and say in document_type if it reads as something else. ' : '')
      + (o.market === 'in' ? 'The property is in India: expect vocabulary such as survey number, khata, sub-registrar, carpet and built-up area, and keep those words as printed. ' : o.market === 'uk' ? 'The property is in the United Kingdom: expect vocabulary such as title number, freehold and leasehold, registered proprietor, and keep those words as printed. ' : '')
      + JSON_ONLY,
    prompt: (i) => 'Read the attached picture — if there are several, they are pages or sides of one document, in order. Return JSON with exactly these keys: document_type (one of: Title register or deed, Sale deed or conveyance, Survey or condition report, Energy certificate, Tenancy or rent agreement, Search result or encumbrance certificate, Property tax document, Other property document, Not a property document), what_it_is (one sentence describing the document as seen), issuing_body_or_registry, reference_numbers (array of {label_as_printed, value}), property_address, property_description_as_printed, interest_or_tenure_as_printed, parties (array of {name, role_as_printed}), dates (array of {date, date_as_printed, what}), money (array of {amount, currency, what}), measurements (array of {value_as_printed, units_as_printed, what}), ratings_or_scores (array of {what, value_as_printed}), key_terms (array of {term, as_printed}), entries_charges_or_restrictions (array of {what, as_printed}), signatures_and_stamps (array of strings describing what is present, not whether it is valid), other_printed_fields (object of anything else that matters for this document type), legibility (high|medium|low), unreadable_fields (array of key names you could not read with confidence), verify_checklist (array of 5–9 short strings: what a person must check against the register, the issuing authority, the other documents on the file and the original paper), not_read (array: parts of the document visible but not transcribed, such as plans, maps, photographs or continuation pages). If the picture is not a property document, set document_type to "Not a property document", say what it is in what_it_is, leave the other fields null, and make verify_checklist one item saying that no fields were read.' + withNotes(i),
    output: 'fields', maxTokens: 3000,
    downloads: docDownloads('property-document', 'Property document — read from a picture, verify against the original'),
    sample: { inputs: { notes: 'One photograph of the first page of a residential tenancy agreement for a flat in West Yorkshire, taken flat on a desk in daylight. The print is clear. I need the parties, the address, the term and the rent typed out for the file.' } },
    tips: [
      'Try a sample fills the notes only — a sample cannot attach a picture. Add a photo, a scan or a PDF, then press Read document.',
      'Photograph the page straight on, in good light, with all four corners in frame. A crooked photo still reads; faint print, carbon copies, stamps over text and a folded page are where mistakes creep in.',
      'It reads; it does not verify. A title number that reads cleanly may belong to a superseded edition, a certificate may have expired, and a page may have been altered. The verify checklist says what to check and where, and that check is yours to make.',
      'Plans, maps and photographs are listed under not read rather than described. A plan is the part of a property document a machine is least able to help you with, and pretending otherwise would be worse than saying nothing.',
      'The picture itself goes to the model, so the shield cannot help: cover a signature, a bank detail or anything else that should not travel before you take the photograph.'
    ],
    faq: [
      { q: 'Does it tell me what the document means?', a: 'No. It types out what is printed and lists what to verify. Whether an entry binds your client, whether a restriction bites, whether a rating or a term matters to the transaction — those are questions for the conveyancer or the solicitor on the file, and the tool leaves them alone.' },
      { q: 'Is it accurate?', a: 'Good on a clean, well-lit page: names, references, addresses, dates and figures come back correctly most of the time. Handwriting, old deeds, carbon copies and stamps over text read worse, and the model is told to return null and name the field rather than guess. Check every number against the paper before it goes into a file or a form.' },
      { q: 'Can I run a client’s title documents through it?', a: 'That is your judgement under your own obligations. The resized picture goes to the model through our gateway and comes back as fields; we store neither the picture nor the answer. Whether a client’s document may be sent to a third-party processor is a question for your retainer, your client and your regulator, and the safe course is to send only the page you need.' }
    ]
  };

  /* ================================================================== */
  /* 7. Medical practice administration — clinic letters                 */
  /* ================================================================== */

  const CL_TYPES = [
    { value: 'referral', label: 'Referral cover letter' },
    { value: 'appointment', label: 'Appointment offer or confirmation' },
    { value: 'reminder', label: 'Appointment reminder' },
    { value: 'recall', label: 'Recall — a review is due' },
    { value: 'dna', label: 'Did not attend — follow-up' },
    { value: 'results', label: 'Results are ready — please book' },
    { value: 'fitnote', label: 'Cover letter for a fit note or sickness certificate' },
    { value: 'handover', label: 'Discharge or handover cover letter' },
    { value: 'custom', label: 'Something else (describe it)' }
  ];

  window.AI_TOOLS['clinic-letter-writer'] = {
    title: 'Clinic Letter Writer (administrative)',
    short: 'Clinic Letters',
    description: 'A draft administrative letter for the clinician to check and sign — it carries no clinical content of its own, gives no advice, and adds nothing you did not dictate. Referral cover letters, appointment and recall letters, did-not-attend follow-ups, results-ready notices and fit-note cover letters, written around your own words with everything else left as a [placeholder].',
    keywords: ['clinic letter template', 'gp referral cover letter', 'patient recall letter template', 'did not attend letter', 'appointment letter generator', 'medical practice administration letters', 'clinic correspondence drafting'],
    glyph: 'i-ai-clinic-letter',
    glyphSvg: '<symbol id="i-ai-clinic-letter" viewBox="0 0 24 24">\n  <rect x="3" y="5.5" width="18" height="13" rx="1.5"/>\n  <path d="M3.6 6.5L12 13l8.4-6.5" class="thin"/>\n  <path d="M11.35 14.2h1.3v1.35H14v1.3h-1.35v1.35h-1.3v-1.35H10v-1.3h1.35z" class="fill"/>\n</symbol>',
    scripts: COMMON, action: 'Draft letter', resultTitle: 'Draft letter — for the clinician to check and sign',
    privacy: 'What you type is sent to the model. The shield masks emails, phone numbers, National Insurance, card and account numbers on your device first; it cannot mask a name, a date of birth, an NHS or hospital number, or anything clinical, so use initials and a reference you have already pseudonymised. Health data is special category data under UK GDPR, and your GMC, GDC, NMC or equivalent duties and your practice’s information governance are yours — they are not discharged by us. Send the administrative facts the letter needs and no clinical detail beyond the words you want reproduced.',
    inputs: [{ key: 'facts', label: 'What the letter must say', type: 'text', rows: 10, placeholder: 'Who it is to and from; the reference or the patient’s initials; what the letter is about; the administrative facts (dates, times, place, what to bring, who to contact); and, in quotation marks, exactly the clinical words you want reproduced. Anything you do not give becomes a [placeholder].' }],
    options: [
      { key: 'kind', label: 'What to write', type: 'select', default: 'referral', options: CL_TYPES },
      { key: 'to', label: 'Written to', type: 'select', default: 'clinician', options: [
        { value: 'clinician', label: 'Another clinician or a department' },
        { value: 'patient', label: 'The patient' },
        { value: 'carer', label: 'A parent or carer' },
        { value: 'third', label: 'A third party the patient has named (with consent)' }
      ] },
      { key: 'register', label: 'Register', type: 'select', default: 'professional', options: [{ value: 'professional', label: 'Standard professional' }, { value: 'plain', label: 'Plain English — short sentences' }] },
      { key: 'setting', label: 'Setting', type: 'select', default: 'gp', options: [
        { value: 'gp', label: 'General practice' }, { value: 'hospital', label: 'Hospital or clinic department' },
        { value: 'private', label: 'Private clinic' }, { value: 'dental', label: 'Dental practice' }
      ] },
      { key: 'from', label: 'Sign off as', type: 'text', placeholder: 'Name, role, practice — or leave blank for placeholders' }
    ],
    system: (o) => 'You write the administrative part of clinical correspondence for a clinician to check and sign. ' + NOT_ADVICE + ' ' + NO_CLINICAL
      + ' Your job is the letter around the clinician’s words: the addressee, the reference, the reason for writing, the administrative facts, what the recipient is asked to do, and the close. Reproduce the clinician’s clinical wording faithfully in the body — you may correct spelling and expand an abbreviation the clinician themselves has expanded, and nothing else. Never add a symptom, a finding, a degree of urgency, a timescale, a safety net or a reassurance that is not in what you were given. '
      + NO_RULES + ' That includes the name or number of a form, a waiting-time target, an entitlement, a service’s opening hours and a department’s contact details: each of those is a square-bracketed placeholder. '
      + 'Write to ' + ({ patient: 'the patient, in the second person', carer: 'a parent or carer, in the second person, about the person in their care', third: 'a third party the patient has named, saying nothing beyond what the facts say may be said to them' }[o.to] || 'another clinician or a department, in the register clinicians use to each other') + ', in ' + (o.register === 'plain' ? 'plain English: short sentences, everyday words, one idea to a sentence' : 'a standard professional register') + ', British English, from ' + ({ hospital: 'a hospital or clinic department', private: 'a private clinic', dental: 'a dental practice' }[o.setting] || 'a general practice') + '. '
      + 'Never open with a diagnosis you were not given and never close with advice. ' + JSON_ONLY,
    prompt: (i, o) => 'Draft a ' + ((CL_TYPES.find(t => t.value === o.kind) || {}).label || 'letter') + '. Return JSON with exactly these keys: letter_type, recipient_block (string, with [placeholders] for anything not given), our_reference, subject_line, salutation, body_paragraphs (array of strings, in order — the whole letter body), what_the_recipient_is_asked_to_do (string), closing_line, signature_block (string' + (o.from ? ', signed as: ' + o.from : ', with [placeholders] for the name, role and practice') + '), clinical_wording_reproduced (array of {in_the_letter, the_words_you_were_given}: every clinical statement in the letter, quoted, set against the exact words in the facts it came from — if any statement has no source in the facts, it must not be in the letter), placeholders_to_fill (array of strings: every [bracketed] item, and what is needed for it), not_included (array: what a letter of this kind often carries that the facts did not give, listed as a question for the clinician, never supplied), administrative_checks (array of 3–6 short checks before this letter is sent, such as the reference, the address, consent where it is relevant, and what is enclosed). Add no clinical content of your own anywhere in the letter.\n\nFACTS:\n' + i.facts,
    output: 'fields', maxTokens: 3000,
    downloads: docDownloads('clinic-letter', 'Draft clinic letter — for the clinician to check and sign'),
    sample: { inputs: { facts: 'Referral cover letter from Thornhill Road Surgery, 22 Thornhill Road, Sowerby Bridge HX6 3DL. Our reference TRS-4471.\nTo: the Rheumatology department at [hospital — I will fill this in].\nPatient: initials R.M., date of birth and NHS number are on the attached summary, not here.\nMy words for the referral, to be reproduced exactly: “Six months of stiffness in both hands, worst in the mornings. No swelling seen at today’s examination. Blood tests requested; results awaited. Referring for assessment. Routine, not urgent.”\nAdministrative: please send the appointment direct to the patient. The patient has been told to expect a letter. Blood results will follow when they arrive. Practice telephone is on the letterhead.\nEnclosed: the current medication list and the patient summary.\nSigned by Dr A. Whitbourne, GP partner.' }, opts: { kind: 'referral', to: 'clinician', register: 'professional', setting: 'gp', from: 'Dr A. Whitbourne, GP Partner, Thornhill Road Surgery' } },
    tips: [
      'Put the clinical words you want reproduced in quotation marks. Everything inside them is copied; everything outside them is treated as an administrative instruction, and nothing clinical is ever added.',
      'Read the clinical wording reproduced table before anything else. It sets every clinical statement in the letter against the words you gave, so a sentence that drifted is visible in one glance rather than three paragraphs in.',
      'Urgency is yours alone. The tool will not call a referral urgent, routine or two-week, and will not soften or sharpen what you wrote — if the facts do not say, the letter does not say, and the gap appears in the placeholders.',
      'Nothing it writes is clinical judgement, and it will not supply safety-netting. If a patient letter needs "come back if X happens", write X yourself and it will be reproduced; leave it out and the letter will say you have not given it.',
      'Use initials and a practice reference, not a name, a date of birth or an NHS number. The letter can carry [placeholders] for those and you fill them in on the letterhead, which keeps the identifiers off the wire entirely.'
    ],
    faq: [
      { q: 'Is this clinical decision support?', a: 'No, and it is built so that it cannot be. It has no clinical content of its own: it will not diagnose, will not suggest a differential, will not set an urgency, will not name an investigation or a medicine or a dose, and will not tell a patient when to seek help. It writes the administrative letter around the words you dictated and shows you where each of them came from.' },
      { q: 'What happens to patient data?', a: 'What you type goes to the model through our gateway and the draft comes back; we store neither. Emails, phone numbers, National Insurance, card and account numbers are masked on your device first — names, dates of birth, NHS and hospital numbers and clinical text are not, because no pattern finds them reliably. Health data is special category data under UK GDPR, so send initials and a reference rather than identifiers, and satisfy yourself that your practice’s information governance permits what you are doing.' },
      { q: 'Can it write the referral itself?', a: 'It writes the letter; you write the referral. The clinical content is whatever you dictate, reproduced faithfully. If you give it a sentence, it uses that sentence; if you give it nothing, it leaves a bracketed gap rather than inventing a clinical picture.' },
      { q: 'Can it write to a patient in another language?', a: 'Ask for it in the facts and it will. A letter that carries clinical wording is worth having checked by a fluent colleague or a professional translator before it is sent — a translation is a draft as well.' }
    ]
  };

  /* ================================================================== */
  /* 8. Medical practice administration — patient information            */
  /* ================================================================== */

  const PI_LANGS = [
    { value: 'English', label: 'English only' }, { value: 'Hindi', label: 'English and Hindi' }, { value: 'Marathi', label: 'English and Marathi' },
    { value: 'Gujarati', label: 'English and Gujarati' }, { value: 'Bengali', label: 'English and Bengali' }, { value: 'Tamil', label: 'English and Tamil' },
    { value: 'Urdu', label: 'English and Urdu' }, { value: 'Polish', label: 'English and Polish' }, { value: 'Romanian', label: 'English and Romanian' }
  ];

  window.AI_TOOLS['patient-info-writer'] = {
    title: 'Patient Information Writer',
    short: 'Patient Info',
    description: 'Your own explanation turned into a draft a patient can read — nothing clinical added, nothing invented, and the clinician checks it before it is given out. Plain language at about a nine-year-old reading age, in your meaning, with every sentence set against the words of yours it came from, and every gap handed back to you as a question rather than filled.',
    keywords: ['patient information leaflet writer', 'plain english health information', 'patient friendly explanation', 'readability patient leaflet', 'explain diagnosis in plain words', 'patient letter plain english', 'health literacy writing tool'],
    glyph: 'i-ai-patient-info',
    glyphSvg: '<symbol id="i-ai-patient-info" viewBox="0 0 24 24">\n  <path d="M12 6.6C10.4 5.2 8 4.8 4 5.2v13.2c4-.4 6.4 0 8 1.4 1.6-1.4 4-1.8 8-1.4V5.2c-4-.4-6.4 0-8 1.4z"/>\n  <path d="M12 6.6v13.2" class="thin"/>\n  <path d="M6.4 9h3.2M6.4 11.6h3.2M14.4 9h3.2M14.4 11.6h3.2" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Rewrite', resultTitle: 'Draft for the patient — for the clinician to check',
    privacy: 'What you type is sent to the model. The shield masks emails, phone numbers, National Insurance, card and account numbers on your device first; it cannot mask a name, a date of birth, an NHS number or clinical text, so write about the condition and not the person, and leave identifiers out entirely. Health data is special category data under UK GDPR, and your professional duties and your practice’s information governance are yours to satisfy — nothing here discharges them.',
    inputs: [{ key: 'words', label: 'What you told the patient, in your own words', type: 'text', rows: 10, placeholder: 'Write or paste your own explanation — exactly as you would say it, jargon and all. Include what happens next, what to expect and any safety-netting you gave; anything you leave out will be handed back as a question, not filled in.' }],
    options: [
      { key: 'audience', label: 'Written for', type: 'select', default: 'adult', options: [
        { value: 'adult', label: 'An adult patient' }, { value: 'carer', label: 'A parent or carer' },
        { value: 'young', label: 'A young person (11–16)' }, { value: 'older', label: 'An older person' }
      ] },
      { key: 'level', label: 'Reading age', type: 'select', default: '9', options: [{ value: '9', label: 'About nine — recommended' }, { value: '12', label: 'About twelve' }] },
      { key: 'length', label: 'Length', type: 'select', default: 'standard', options: [{ value: 'short', label: 'Short — one side of A4' }, { value: 'standard', label: 'Standard' }] },
      { key: 'language', label: 'Language', type: 'select', default: 'English', options: PI_LANGS }
    ],
    system: (o) => 'You rewrite a clinician’s own explanation into words a patient can read. ' + NOT_ADVICE + ' ' + NO_CLINICAL
      + ' Every sentence you write must be traceable to something the clinician wrote. You may simplify, shorten, reorder, split a long sentence, and explain the clinician’s own meaning in everyday words. You may not add a fact, a cause, a number, a percentage, a timescale, a reassurance, a warning sign, a symptom, an investigation, a treatment, a medicine, a dose or any advice that is not in what you were given — not even something that is obviously true, and not even hedged. '
      + 'Where the patient will plainly want to know something the clinician did not say, do not supply it: put it in gaps_for_the_clinician as a question for them to answer. Where the clinician used a term the patient will not know and did not explain it, do not define it anywhere — not in the leaflet and not in words_to_explain, where you say only why it needs explaining and leave the meaning to the clinician.Where the clinician gave no safety-netting, the safety-netting fields say so in square brackets rather than carrying anything you made up. '
      + 'Reading level: about a ' + (o.level === '12' ? 'twelve' : 'nine') + '-year-old. Sentences of about ' + (o.level === '12' ? 'fifteen' : 'twelve') + ' words, one idea to a sentence, everyday words, the active voice, "you" and not "the patient", no jargon that is not explained by the clinician, no metaphors that could be taken literally, no capitals for emphasis. '
      + ({ carer: 'The reader is a parent or carer: write to them about the person they care for. ', young: 'The reader is a young person of 11 to 16: write to them directly, never talk down to them. ', older: 'The reader is an older person: keep the sentences short and the structure obvious. ' }[o.audience] || 'The reader is an adult patient: write to them directly. ')
      + (o.length === 'short' ? 'Keep the whole leaflet to about 250 words. ' : '')
      + (o.language && o.language !== 'English' ? 'The clinician has asked for ' + o.language + ' as well: write the English first and put a faithful ' + o.language + ' version of the same text in the translation field, adding nothing in the translation that is not in the English. ' : 'No translation is wanted; set translation to null. ')
      + JSON_ONLY,
    prompt: (i, o) => 'Rewrite the clinician’s explanation below for the patient. Return JSON with exactly these keys: title (plain, under 10 words), what_this_is_about (2–4 short sentences), what_the_clinician_said (array of short sentences, the substance of the explanation in plain words), what_happens_next (string, or "[the clinician has not said what happens next]"), what_to_expect (string, or "[the clinician has not said what to expect]"), what_to_watch_for (string, or "[no safety-netting was given — the clinician must add this before the leaflet is given out]"), when_to_get_help (string, or "[no advice about getting help was given — the clinician must add this before the leaflet is given out]"), questions_you_might_want_to_ask (array of 3–6 questions the patient could ask their clinician, each one arising only from what the clinician wrote), words_to_explain (array of {word, why_the_patient_will_not_know_it} — flag only: say why the word needs explaining and never what it means, not even for an everyday or administrative word, because a definition is content the clinician did not give), added_nothing_check (array of {sentence_in_the_leaflet, the_clinicians_words_it_came_from}: every clinical sentence in the leaflet set against the exact words it came from), gaps_for_the_clinician (array of strings: what the patient will want to know that the clinician did not say, each as a question for the clinician), reading_notes (string: the longest sentence used and anything that pushed the reading age up), translation (' + (o.language && o.language !== 'English' ? 'an object with the same text in ' + o.language + ', using the keys title, what_this_is_about, body (array of short sentences), what_happens_next, what_to_watch_for, when_to_get_help' : 'null') + '). Add no clinical content of your own anywhere.\n\nTHE CLINICIAN’S OWN WORDS:\n' + i.words,
    output: 'fields', maxTokens: 3000,
    downloads: docDownloads('patient-information', 'Patient information — draft for the clinician to check'),
    sample: { inputs: { words: 'What I said to the patient in the room, more or less:\n“Your blood test came back showing your iron stores are low. That is why you have been feeling tired and a bit breathless going up the stairs. It is common and it is usually straightforward to put right. I have asked for a second set of bloods to check a couple of other things before we decide anything, and those will take about a week. In the meantime carry on as normal. If you feel faint, or if the breathlessness gets worse rather than better, ring the surgery the same day and ask to speak to a duty doctor. We will phone you when the results are in and book you a review. Bring the list of everything you take, including anything you buy yourself.”\nI did not talk about diet, and I have not started any medicine. I would rather the leaflet did not go into causes, because that is what the second set of tests is for.' } },
    tips: [
      'Write what you actually said, jargon and all. The tool simplifies your words; it does not have any of its own, and a thin explanation in produces a thin leaflet out with the gaps listed rather than filled.',
      'The added nothing check is the point of the whole tool. Every clinical sentence in the leaflet is set beside the words of yours it came from, so a sentence that has drifted, softened or grown is visible in seconds.',
      'Safety-netting is yours. If you did not say what to watch for and when to get help, those fields come back as bracketed notes saying so — because a leaflet that invents its own safety-netting is far more dangerous than one that is honest about missing it.',
      'Say what you do not want covered. "Do not go into causes" is an instruction the model follows, and it saves you deleting a paragraph you never asked for.',
      'A translation is written from the English, adds nothing, and is still a draft. Have a fluent colleague or a professional translator read it before it is given to a patient.'
    ],
    faq: [
      { q: 'Will it add anything I did not say?', a: 'It is instructed not to, and the added nothing check exists so that you can confirm it for yourself rather than take our word for it: every clinical sentence in the leaflet is shown beside the words of yours it came from. Where a sentence has no source, it should not be there — if you see one, that is a defect, and the leaflet needs your pen before it goes anywhere.' },
      { q: 'Is this a substitute for an approved patient information leaflet?', a: 'No. Approved leaflets are written, reviewed and kept up to date by people with that responsibility, and they carry references. This turns one conversation into something the patient can take home in the words you used, and a clinician reads it before it is given out.' },
      { q: 'Why will it not explain a medical word for me?', a: 'Because defining a term is adding clinical content, and a definition that is subtly wrong in a patient leaflet is worse than a word left alone. Terms the patient will not know are listed for you to define in your own words; paste your definition into the explanation and it will be used.' },
      { q: 'Can I paste a patient record into it?', a: 'Paste your explanation, not the record. It needs no name, no date of birth, no NHS number and no history to do its job, and those things are neither masked by the shield nor needed by the model. Less in means less to go wrong.' }
    ]
  };
})();
