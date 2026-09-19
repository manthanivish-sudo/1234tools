/**
 * The marketing tools: the copy a business publishes — search snippets,
 * blog posts, ads, campaign email, a voice guide, a landing page. Same
 * shape as engine/ai-tools.js, in its own file so batches never collide.
 *
 * Every one of these writes from facts it is given and marks what it does
 * not have — [source needed], [quote needed], [proof needed] — because a
 * plausible sentence that is not true costs more than a gap does.
 */
(function () {
  'use strict';
  window.AI_TOOLS = window.AI_TOOLS || {};
  const COMMON = ['/engine/zip.js', '/engine/sheet.js', '/engine/pdf-text.js', '/engine/pii.js', '/engine/render-ai.js', '/engine/ai-tools.js', '/engine/ai-tools-marketing.js'];
  const JSON_ONLY = 'Return only JSON, with no explanation before or after it and no markdown fences. Inside JSON strings write line breaks as \\n, never as a raw newline. Use null for anything not present; never invent a value.';
  const csvDownload = (name) => (data, ctx) => {
    const list = Array.isArray(data) ? data : (data.rows || data.items || [data]);
    const rows = ctx.sheet.objectsToRows(list);
    return [
      { name: name + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
      { name: name + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, name) }
    ];
  };
  /* a plain-text rendering of a structured answer, plus the JSON itself */
  const textDownload = (name, build) => (data) => [
    { name: name, blob: () => new Blob([build(data)], { type: 'text/plain' }) },
    { name: name.replace(/\.\w+$/, '.json'), blob: () => new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }
  ];
  const str = (v) => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const arr = (v) => Array.isArray(v) ? v : [];
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};

  /* ------------------------------------------------------------------ */

  const countSeo = (d) => {
    if (d && typeof d === 'object' && !Array.isArray(d)) { d.title_characters = Array.from(str(d.title)).length; d.meta_characters = Array.from(str(d.meta_description)).length; }
    return d;
  };
  const PAGE_TYPES = [
    { value: 'article', label: 'Article or blog post' }, { value: 'guide', label: 'How-to guide' }, { value: 'product', label: 'Product page' },
    { value: 'service', label: 'Service page' }, { value: 'category', label: 'Category or listing page' }, { value: 'landing', label: 'Landing page' },
    { value: 'comparison', label: 'Comparison (X vs Y)' }, { value: 'tool', label: 'Tool or calculator page' }, { value: 'home', label: 'Homepage' }
  ];
  window.AI_TOOLS['seo-writer'] = {
    title: 'SEO Title, Meta & Outline Writer',
    short: 'SEO Writer',
    description: 'Give it a page topic, who it is for and the keyword you want to rank for; get back a title that fits in the search result, a meta description that fits under it, an H1, an H2 outline, the questions people ask, where to link from — and a note on what the searcher actually wants.',
    keywords: ['seo title generator', 'meta description generator', 'blog outline generator', 'seo content brief', 'h2 outline for article', 'search intent checker', 'seo writer ai'],
    glyph: 'i-ai-seo', scripts: COMMON, action: 'Write brief', resultTitle: 'SEO brief',
    glyphSvg: '<symbol id="i-ai-seo" viewBox="0 0 24 24">\n  <circle cx="10" cy="10" r="5.5"/>\n  <path d="M14 14l5.5 5.5"/>\n  <path d="M7.5 9h5M7.5 11.5h3.5" class="thin"/>\n  <path d="M4 19.5h6.5" class="thin"/>\n</symbol>',
    privacy: 'The topic, audience and keyword you type are sent to the model. There is rarely anything sensitive in a page brief.',
    inputs: [{ key: 'topic', label: 'What the page is about', type: 'text', rows: 5, placeholder: 'The subject, what the page will cover, anything it must say or avoid. A sentence or a paragraph.' }],
    options: [
      { key: 'keyword', label: 'Target keyword', type: 'text', placeholder: 'e.g. gst invoice format', hint: 'The phrase you want to rank for' },
      { key: 'audience', label: 'Audience', type: 'text', placeholder: 'e.g. small business owners in India' },
      { key: 'pagetype', label: 'Page type', type: 'select', default: 'article', options: PAGE_TYPES },
      { key: 'site', label: 'Site or brand', type: 'text', placeholder: 'optional', hint: 'Goes on the end of the title only if it still fits' }
    ],
    system: () => 'You write SEO briefs for web pages: a title that fits in a search result, a meta description that earns the click, and a heading structure that answers what the searcher came for. Hard limits, counted in characters including spaces and punctuation: title at most 60, meta description at most 155. Count each one; if it is over, shorten it before answering, and report the true count. Lead with the keyword or a close variant where it reads naturally; never stuff it. Plain, specific British English: no hype, no "ultimate guide", no exclamation marks, no year in the title unless the topic is about that year. Do not invent statistics, brand names, product features or claims. ' + JSON_ONLY,
    prompt: (i, o) => 'Write an SEO brief for a ' + ((PAGE_TYPES.find(t => t.value === o.pagetype) || PAGE_TYPES[0]).label.toLowerCase()) + (o.keyword ? ' targeting the keyword "' + o.keyword + '"' : '') + (o.audience ? ', for ' + o.audience : '') + (o.site ? ', on the site ' + o.site : '') + '. Return JSON with exactly these keys: search_intent (one of informational, commercial, transactional, navigational — then a colon and one or two sentences on what the searcher wants and what the page must do to satisfy it), title (at most 60 characters), title_characters (integer, the exact character count of title), meta_description (at most 155 characters, with a reason to click), meta_characters (integer, the exact character count of meta_description), h1 (may differ from the title; no character limit), h2_outline (array of 5–9 H2 headings in reading order, each followed by a short note in brackets saying what the section covers), faq_questions (array of 4–6 questions people actually search, phrased the way they type them), internal_link_suggestions (array of {anchor_text, link_to}: pages a site on this subject would normally have, described in words rather than invented as URLs), secondary_keywords (array of 5–8 related phrases to use naturally in the page), notes (array of anything the brief could not settle because a fact was missing; empty if none).\n\nPAGE TOPIC:\n' + i.topic,
    output: 'fields', maxTokens: 2500, transform: countSeo,
    /* The page builds the downloads before it draws the fields, from the same
       object, so the two counts on screen are the browser's, not the model's
       (which said 52 for a 51-character title in testing). */
    downloads: (data) => textDownload('seo-brief.txt', (d) => [
      'Title: ' + str(d.title) + ' (' + str(d.title).length + ' characters)',
      'Meta description: ' + str(d.meta_description) + ' (' + str(d.meta_description).length + ' characters)',
      'H1: ' + str(d.h1), '', 'Search intent: ' + str(d.search_intent), '', 'Outline:'
    ].concat(arr(d.h2_outline).map(h => '  H2  ' + str(h)), ['', 'FAQ:'], arr(d.faq_questions).map(q => '  - ' + str(q)), ['', 'Internal links:'], arr(d.internal_link_suggestions).map(l => '  - ' + str(obj(l).anchor_text) + ' -> ' + str(obj(l).link_to)), ['', 'Secondary keywords: ' + arr(d.secondary_keywords).map(str).join(', ')], arr(d.notes).length ? ['', 'Notes:'].concat(arr(d.notes).map(n => '  - ' + str(n))) : []).join('\n'))(countSeo(data)),
    sample: { inputs: { topic: 'A guide to the GST invoice format in India: what a tax invoice must contain under the CGST Rules, the difference between a tax invoice and a bill of supply, when an e-invoice is mandatory, common mistakes that cost the buyer input tax credit, and a free template to download.' }, opts: { keyword: 'gst invoice format', audience: 'small business owners and accountants in India', pagetype: 'guide', site: '1234Tools' } },
    tips: ['The character counts are the point. Google shows about 60 characters of a title and 155 of a description before cutting them off. The counts shown are made in your browser after the answer arrives, not by the model, so they are exact.','Search intent first. If the searcher wants a template and the page is an essay, the brief says so, and no title fixes that.', 'The H2 outline is the plan for the page, not its copy. Paste it into the Blog Post Writer as the brief and the two agree with each other.', 'Internal-link suggestions are the pages a site on this subject would have. Where you have the page, link it; where you do not, that is the next page to write.'],
    faq: [{ q: 'Does it know what ranks on Google?', a: 'No. It knows how titles, descriptions and headings are written when they are written well, and it can reason about what a searcher wants from a phrase. It has no search data, no rankings and no view of your competitors. Use it to write the brief; use Search Console to see what happened.' }, { q: 'Why is the title sometimes well under 60 characters?', a: 'Because 60 is a ceiling, not a target. A title that says the thing in 48 characters beats one padded to 59. If one comes back over — the model counts imperfectly — trim it; the count shown is the browser\'s, so you can see by how much.' }, { q: 'Can it write the page as well?', a: 'The Blog Post Writer and the Landing Page Copy Writer do that. Paste the outline in as the brief and the headings carry through.' }]
  };

  /* ------------------------------------------------------------------ */

  const BLOG_LENGTH = { short: 'short (about 500 words)', medium: 'medium-length (about 900 words)', long: 'long (about 1,500 words)' };
  const BLOG_TONE = { plain: 'a plain, direct', friendly: 'a friendly, conversational', expert: 'an expert, measured', story: 'a story-led' };
  window.AI_TOOLS['blog-writer'] = {
    title: 'Blog Post Writer',
    short: 'Blog Writer',
    description: 'A brief in, a finished post out: headings, an introduction that says what the point is, and a summary at the end. British spelling and no invented numbers — anything it cannot support is marked [source needed] for you to fill in or cut.',
    keywords: ['blog post writer ai', 'article generator', 'write a blog post from an outline', 'long form content writer', 'seo blog writer', 'british english blog writer'],
    glyph: 'i-ai-blog', scripts: COMMON, action: 'Write post', resultTitle: 'Post written',
    glyphSvg: '<symbol id="i-ai-blog" viewBox="0 0 24 24">\n  <path d="M12.5 3.5H6A1.5 1.5 0 0 0 4.5 5v14A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-6.5"/>\n  <path d="M8 12h4M8 15.5h6.5" class="thin"/>\n  <path d="M20.6 4.4l-1.2-1.2-7.2 7.2-.6 1.8 1.8-.6z"/>\n</symbol>',
    privacy: 'The brief you type is sent to the model. Keep unreleased product details out of it if they must stay private.',
    inputs: [{ key: 'brief', label: 'The brief', type: 'text+file', accept: '.txt,.md', rows: 10, placeholder: 'What the post is about, the point it should make, the headings if you have them, the facts and examples to use, anything to avoid. An outline from the SEO writer pastes straight in.' }],
    options: [
      { key: 'audience', label: 'Audience', type: 'text', placeholder: 'e.g. owners of small businesses in India' },
      { key: 'length', label: 'Length', type: 'select', default: 'medium', options: [{ value: 'short', label: 'Short — about 500 words' }, { value: 'medium', label: 'Medium — about 900 words' }, { value: 'long', label: 'Long — about 1,500 words' }] },
      { key: 'tone', label: 'Tone', type: 'select', default: 'plain', options: [{ value: 'plain', label: 'Plain and direct' }, { value: 'friendly', label: 'Friendly, conversational' }, { value: 'expert', label: 'Expert, measured' }, { value: 'story', label: 'Story-led' }] },
      { key: 'keyword', label: 'Keyword to include', type: 'text', placeholder: 'optional' },
      { key: 'brand', label: 'Written for', type: 'text', placeholder: 'brand or author, optional' }
    ],
    system: (o) => 'You write blog posts for business websites in ' + (BLOG_TONE[o.tone] || BLOG_TONE.plain) + ' voice, with British spelling, for ' + (o.audience || 'a general business readership') + '. Rules. The introduction states the point of the post in its first two sentences: no throat-clearing, no "in today\'s fast-paced world", no rhetorical questions. Use "## " for section headings (five to eight for a long post, fewer for a short one) and short paragraphs. Use only the facts in the brief and well-established general knowledge; never invent statistics, studies, surveys, quotations, prices, thresholds or dates. Where a claim needs a figure or a source you do not have, keep the claim modest and write [source needed] immediately after it; where the brief itself says to check something, keep its marker. No bullet list longer than five items. End with a "## Summary" section of three to five sentences that says what the reader should remember or do. Output the post only: a "# " title line first, then the post; no preamble, no notes to the editor, no word count.',
    prompt: (i, o) => 'Write a ' + (BLOG_LENGTH[o.length] || BLOG_LENGTH.medium) + ' blog post' + (o.keyword ? ' that uses the phrase "' + o.keyword + '" naturally in the title, in one heading and in the opening paragraph' : '') + (o.brand ? ', written for ' + o.brand : '') + '.\n\nBRIEF:\n' + i.brief,
    output: 'text', maxTokens: 6000,
    sample: { inputs: { brief: 'Why small businesses in India should move from a spreadsheet invoice to a proper GST invoice format.\nPoints to make: the CGST Rules require specific fields (supplier and buyer GSTIN, HSN or SAC code, place of supply, the tax split into CGST/SGST or IGST, a consecutive serial number); a buyer can lose input tax credit on an invoice with a missing field; consecutive numbering is mandatory and gaps get questioned; e-invoicing is mandatory above a turnover threshold [check the current threshold before publishing].\nOffer: our free invoice PDF tool makes a compliant invoice in a minute.\nAvoid: making fun of Excel — our readers run their business on it.' }, opts: { audience: 'owners of small businesses in India', length: 'medium', tone: 'plain', keyword: 'gst invoice format', brand: '1234Tools' } },
    tips: ['Give it the point, not just the topic. "Why X, for Y, because Z" is a brief; "write about invoicing" is a topic, and the post will be as vague as the brief.', 'Search for "[source needed]" before publishing. Each one is a claim the model would not stand behind; give it a source or cut the sentence.', 'Paste the H2 outline from the SEO writer as the brief and the headings carry through, so the post and the brief agree.', 'A long post is about 1,500 words. If you need 3,000, write two posts; each reads better and both can rank.'],
    faq: [{ q: 'Will Google penalise an AI-written post?', a: 'Google says it rewards helpful content whoever wrote it and demotes unhelpful content whoever wrote it. A post written from a real brief with real facts, then checked and edited, is helpful; a hundred generic posts are not, and this tool cannot make the second kind useful.' }, { q: 'Why does it refuse to give numbers?', a: 'Because it would be guessing. A language model produces plausible figures, not true ones, and a wrong statistic in a published post costs more than a marker does. Where you have the number, put it in the brief and it will use it.' }, { q: 'Can it write in Hindi or another language?', a: 'Ask in the brief ("write this in Hindi") and it will; the tone and length options still apply.' }]
  };

  /* ------------------------------------------------------------------ */

  const AD_GOALS = { sales: 'sales (purchases on the site)', leads: 'leads and enquiries', signups: 'sign-ups or free trials', traffic: 'visits to the website', installs: 'app installs', awareness: 'awareness of the brand' };
  const AD_LIMITS = { 'Google|Headline': 30, 'Google|Description': 90, 'Meta|Headline': 40 };
  /* A model counts characters badly (a Sonnet run said 97 for a 95-character
     line and left it over the limit); a browser does not. The page builds the
     downloads before it draws the table, from the same row objects, so the
     true count set here is what the screen shows too, with a flag on any line
     that still slipped over. */
  const countAds = (rows) => {
    rows.forEach(r => {
      if (!r || typeof r !== 'object') return;
      const n = Array.from(String(r.text == null ? '' : r.text)).length;
      const lim = AD_LIMITS[r.platform + '|' + r.element];
      r.characters = n;
      if (lim && n > lim) r.note = 'OVER the ' + lim + ' limit by ' + (n - lim) + ' — shorten before use';
    });
    return rows;
  };
  window.AI_TOOLS['ad-copy-writer'] = {
    title: 'Google & Meta Ad Copy Writer',
    short: 'Ad Copy Writer',
    description: 'One offer in; a full set of ad copy out — 15 Google responsive search ad headlines and 4 descriptions, 3 Meta primary texts and 5 headlines — each written short of its character limit, counted here in your browser, and flagged if one slips over, as a table you can paste straight into the ad platform.',
    keywords: ['google ads headline generator', 'responsive search ad copy', 'meta ad copy generator', 'facebook ad text writer', 'rsa headlines 30 characters', 'ad copy ai small business'],
    glyph: 'i-ai-ads', scripts: COMMON, action: 'Write ads', resultTitle: 'Ad copy',
    glyphSvg: '<symbol id="i-ai-ads" viewBox="0 0 24 24">\n  <path d="M4 10v4a1 1 0 0 0 1 1h3l8 4V5L8 9H5a1 1 0 0 0-1 1z"/>\n  <path d="M8 15v4.5" class="thin"/>\n  <path d="M19 9.5a3.5 3.5 0 0 1 0 5" class="thin"/>\n</symbol>',
    privacy: 'The offer, audience and URL you type are sent to the model. It is advertising copy; nothing private belongs in it.',
    inputs: [{ key: 'offer', label: 'The product or offer', type: 'text', rows: 6, placeholder: 'What it is, what it costs or saves, what makes it different, any dates or conditions, the brand name.' }],
    options: [
      { key: 'audience', label: 'Who it is for', type: 'text', placeholder: 'e.g. purchase managers at factories in Maharashtra' },
      { key: 'url', label: 'Landing page URL', type: 'text', placeholder: 'https://…', hint: 'Keeps the copy honest to the page it lands on' },
      { key: 'goal', label: 'Goal', type: 'select', default: 'leads', options: [{ value: 'sales', label: 'Sales' }, { value: 'leads', label: 'Leads / enquiries' }, { value: 'signups', label: 'Sign-ups / trials' }, { value: 'traffic', label: 'Website visits' }, { value: 'installs', label: 'App installs' }, { value: 'awareness', label: 'Awareness' }] },
      { key: 'platforms', label: 'Platforms', type: 'select', default: 'both', options: [{ value: 'both', label: 'Google and Meta' }, { value: 'google', label: 'Google only' }, { value: 'meta', label: 'Meta only' }] }
    ],
    system: () => 'You write paid advertising copy for small businesses. The platforms enforce hard limits, counted in characters including spaces and punctuation: Google responsive search ad headlines 30, Google descriptions 90, Meta headlines 40. Language models miscount by a few characters, so write to a margin and never to the limit: Google headlines at most 27 characters (20 to 27 is ideal), Google descriptions at most 82, Meta headlines at most 36. Meta primary text has no hard limit, but its first 125 characters must carry the whole message, because that is what shows before "See more". Count every line character by character and put the count in the characters field; a line that is in doubt gets shortened, not counted again. Google headlines must be distinct from one another and work in any combination, so none may depend on another to make sense; across the fifteen, include the brand, the offer, a benefit, a call to action and a specific fact (a price, a time, a quantity) each in at least one. No ALL CAPS words, no exclamation marks in Google copy, no claim the offer does not support, no "best" or "#1" without a basis. British spelling unless the audience is American. ' + JSON_ONLY,
    prompt: (i, o) => {
      const g = o.platforms !== 'meta', m = o.platforms !== 'google';
      const order = [g ? '15 rows of Google Headline (text at most 27 characters), then 4 rows of Google Description (at most 82)' : '', m ? '3 rows of Meta Primary text, then 5 rows of Meta Headline (at most 36)' : ''].filter(Boolean).join(', then ');
      return 'Write ad copy for ' + (g && m ? 'Google and Meta' : g ? 'Google' : 'Meta') + '. Goal: ' + (AD_GOALS[o.goal] || AD_GOALS.leads) + '.' + (o.audience ? ' Audience: ' + o.audience + '.' : '') + (o.url ? ' Landing page: ' + o.url + '.' : '') + ' Return a JSON array of objects with keys: platform ("Google" or "Meta"), element ("Headline", "Description" or "Primary text"), text, characters (integer: the exact character count of text, including spaces), note (a word or two on the job this line does — brand, offer, benefit, CTA, fact — or null). Rows in this order: ' + order + '.\n\nOFFER:\n' + i.offer;
    },
    output: 'table', maxTokens: 3000, transform: (data) => Array.isArray(data) ? countAds(data) : data,
    downloads: (data, ctx) => csvDownload('ad-copy')(countAds(Array.isArray(data) ? data : arr(data.rows || data.items)), ctx),
    sample: { inputs: { offer: 'Sharma Traders: ISI-marked industrial work gloves at Rs 85 a pair for orders of 100 pairs or more. Delivery across Maharashtra within 48 hours. GST invoice with every order. Free replacement if a pair fails within 30 days. Offer runs until 30 April.' }, opts: { audience: 'purchase managers at factories and workshops in Maharashtra', url: 'https://www.sharmatraders.example/gloves', goal: 'leads', platforms: 'both' } },
    tips: ['The characters column is counted here, in your browser, after the model answers — not by the model, which miscounts by a character or two. The model is asked to write short of each limit (27 for a 30-character headline) for that reason; any line that still lands over is flagged in the note column with how far over it is.', 'Fifteen headlines is what Google asks for, and it assembles them in combinations. That is why each stands alone: no headline finishes another one\'s sentence.', 'Meta shows the first 125 characters of primary text before "See more". The copy is written so the message survives the cut.', 'Change the goal and the calls to action change with it: "Get a quote" for leads, "Order now" for sales, "Start free" for sign-ups.'],
    faq: [{ q: 'Which ad formats does this cover?', a: 'Google responsive search ads (headlines and descriptions) and Meta feed ads on Facebook and Instagram (primary text and headlines). Display, video and Performance Max asset groups take the same kinds of text; paste what fits.' }, { q: 'Are the character counts exact?', a: 'Yes: the count shown is made on your device by the browser, not by the model. Language models count imperfectly — in our runs the model was a character out on most lines — so it is asked to write to a margin, and any line that still comes back over its platform limit is marked in the note column. The platform counts once more when you paste; the two should agree.' }, { q: 'Will it make claims my product cannot support?', a: 'It is told not to: no "best", no "#1", no benefit the offer does not state. Give it the facts and it writes from them; if a line still overreaches, that is the line to cut.' }]
  };

  /* ------------------------------------------------------------------ */

  const EMAIL_PURPOSE = { launch: 'product or feature launch', offer: 'offer or promotion', reengagement: 're-engagement (win-back) email to customers who have gone quiet', newsletter: 'newsletter', onboarding: 'onboarding sequence for new customers' };
  const EMAIL_TONE = { warm: 'warm and personal', plain: 'plain and businesslike', expert: 'expert and measured', lively: 'lively and upbeat' };
  window.AI_TOOLS['email-campaign-writer'] = {
    title: 'Email Campaign Writer',
    short: 'Email Writer',
    description: 'A launch, an offer, a win-back, a newsletter or an onboarding series, written from your facts: five subject lines with preview text, the email itself, a plain-text version, the call to action — and a three-email sequence when you ask for one.',
    keywords: ['email campaign writer', 'marketing email generator', 'subject line generator', 'product launch email', 'onboarding email sequence', 'win back email template', 'newsletter writer ai'],
    glyph: 'i-ai-email', scripts: COMMON, action: 'Write email', resultTitle: 'Campaign written',
    glyphSvg: '<symbol id="i-ai-email" viewBox="0 0 24 24">\n  <rect x="3" y="7.5" width="15" height="11" rx="1.5"/>\n  <path d="M3.5 8.5l7 5.5 7-5.5" class="thin"/>\n  <path d="M6.5 4.5h13a1.5 1.5 0 0 1 1.5 1.5v9.5" class="thin"/>\n</symbol>',
    privacy: 'The facts you type are sent to the model. Do not paste a customer list: the email is written once, for everyone on it.',
    inputs: [{ key: 'facts', label: 'The facts', type: 'text', rows: 8, placeholder: 'What is being announced or offered, the details (dates, prices, what changes), what you want the reader to do, the link they should click, anything to avoid saying.' }],
    options: [
      { key: 'purpose', label: 'Purpose', type: 'select', default: 'launch', options: [{ value: 'launch', label: 'Product or feature launch' }, { value: 'offer', label: 'Offer or promotion' }, { value: 'reengagement', label: 'Re-engagement / win-back' }, { value: 'newsletter', label: 'Newsletter' }, { value: 'onboarding', label: 'Onboarding sequence (3 emails)' }] },
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'who it is from' },
      { key: 'audience', label: 'Audience', type: 'text', placeholder: 'e.g. existing trade customers in Pune' },
      { key: 'tone', label: 'Tone', type: 'select', default: 'plain', options: [{ value: 'plain', label: 'Plain, businesslike' }, { value: 'warm', label: 'Warm, personal' }, { value: 'expert', label: 'Expert, measured' }, { value: 'lively', label: 'Lively' }] },
      { key: 'sequence', label: 'How many', type: 'select', default: 'single', options: [{ value: 'single', label: 'One email' }, { value: 'three', label: 'Three-email sequence' }] },
      { key: 'from', label: 'Sign off as', type: 'text', placeholder: 'name and role' }
    ],
    system: (o) => 'You write marketing email' + (o.brand ? ' for ' + o.brand : ' for a small business') + ' in a ' + (EMAIL_TONE[o.tone] || EMAIL_TONE.plain) + ' voice, for ' + (o.audience || 'its customers') + '. British spelling. Rules. The subject line says what the email is about: no clickbait, no false urgency, no "Re:" or "Fwd:" tricks, no ALL CAPS, at most 55 characters. The preview text adds to the subject rather than repeating it, at most 90 characters. The email opens with the point in its first sentence, says what changes for the reader, and asks for one action. Use only the facts given; anything missing goes in square brackets as a placeholder, such as [link] or [date]. Short paragraphs; no bullet list longer than four items. Do not invent discounts, deadlines, statistics or customer names. The email must make sense to someone who did not ask for it and must not pretend to be personal correspondence. ' + JSON_ONLY,
    prompt: (i, o) => {
      const seq = o.purpose === 'onboarding' || o.sequence === 'three';
      return 'Write a ' + (EMAIL_PURPOSE[o.purpose] || EMAIL_PURPOSE.launch) + ' email' + (seq ? ' as a three-email sequence' : '') + (o.from ? ', signed off by ' + o.from : '') + '. Return JSON with exactly these keys: subject_lines (array of 5 objects {subject, preview_text}, each a different angle), email (object with keys: subject (the strongest of the five), preview_text, greeting, paragraphs (array of strings, one per paragraph of the body), cta_text (the button or link text), cta_link (the link given, or [link]), sign_off), plain_text (the whole email as one plain-text string with line breaks as \\n: subject line, blank line, greeting, body, the call to action as text with its link, sign-off), cta (one sentence: what the reader is asked to do and where), sequence (' + (seq ? 'array of exactly 3 objects {number, send_when, purpose, subject, preview_text, paragraphs (array of strings), cta_text}: the first is the email above, the second and third follow it' : 'null') + '), send_notes (array of 2–4 short practical notes: when to send, who to send to, what to test), missing (array of the facts you had to leave as placeholders; empty if none).\n\nFACTS:\n' + i.facts;
    },
    output: 'fields', maxTokens: 4000,
    downloads: (data) => {
      const e = obj(data.email);
      const one = (m) => ['Subject: ' + str(m.subject), 'Preview: ' + str(m.preview_text), '', str(m.greeting), ''].concat(arr(m.paragraphs).map(str).join('\n\n').split('\n'), ['', str(m.cta_text) + (m.cta_link ? ' — ' + str(m.cta_link) : ''), '', str(m.sign_off)]).join('\n');
      const out = [
        { name: 'email.txt', blob: () => new Blob([str(data.plain_text) || one(e)], { type: 'text/plain' }) },
        { name: 'campaign.json', blob: () => new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }
      ];
      if (arr(data.sequence).length) out.splice(1, 0, { name: 'email-sequence.txt', blob: () => new Blob([arr(data.sequence).map((m, n) => '=== Email ' + (m.number || n + 1) + (m.send_when ? ' — ' + str(m.send_when) : '') + (m.purpose ? ' — ' + str(m.purpose) : '') + ' ===\n\n' + one(obj(m))).join('\n\n\n')], { type: 'text/plain' }) });
      return out;
    },
    sample: { inputs: { facts: 'Sharma Traders is launching same-day delivery in Pune for orders placed before 11 am, from 1 May. Applies to all stock items. No extra charge on orders over Rs 5,000; otherwise Rs 150. Existing customers order on the website as usual and pick "same day" at checkout; phone orders still work. Link: [website link]. Do not promise same-day delivery outside Pune city limits.' }, opts: { purpose: 'launch', brand: 'Sharma Traders', audience: 'existing trade customers in Pune', tone: 'plain', sequence: 'single', from: 'Vishal, Sharma Traders' } },
    tips: ['Five subject lines, one email: send the email, test the subjects. Most email tools will split-test a subject on a slice of the list before sending the rest.', 'The plain-text version is what a text-only client, a smartwatch and a spam filter see. Send it alongside the HTML; do not skip it.', 'Everything the model did not know is in [square brackets] and listed under "missing". Search for "[" before you send.', 'Onboarding is always three emails: welcome, first value, next step. For an offer, the three are announce, remind, last day.'],
    faq: [{ q: 'Is this compliant with anti-spam rules?', a: 'The copy is written to be honest: the subject says what the email is, the sender is named, and nothing pretends to be a personal note. Compliance is mostly about the sending, though — consent, an unsubscribe link, a postal address in the footer — and that is your email tool\'s job and yours.' }, { q: 'Can it write the HTML?', a: 'No, and you do not want it to: every email tool has its own editor and templates. Paste the paragraphs in, add the button, and the tool handles the rest. The plain-text version is provided because most people forget it.' }, { q: 'Does it personalise?', a: 'It writes one email for the audience you describe. Put merge tags such as {{first_name}} in the facts and it will place them; it never sees a list.' }]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['brand-voice-guide'] = {
    title: 'Brand Voice Guide Builder',
    short: 'Brand Voice Guide',
    description: 'Paste two or three pieces of copy you already like and say what the brand is; get back a voice guide — the personality in three words, a tone do/don’t table, words to use and words to avoid, your samples rewritten to show the rules, and how the voice changes for social, support and sales.',
    keywords: ['brand voice guide generator', 'tone of voice guidelines', 'brand voice examples', 'brand style guide writing', 'tone of voice do and dont', 'brand personality words'],
    glyph: 'i-ai-voice', scripts: COMMON, action: 'Build guide', resultTitle: 'Voice guide',
    glyphSvg: '<symbol id="i-ai-voice" viewBox="0 0 24 24">\n  <path d="M12 4C7.6 4 4 6.9 4 10.5c0 1.9 1 3.6 2.6 4.8L5.5 19l4-1.7c.8.2 1.6.2 2.5.2 4.4 0 8-2.9 8-6.5S16.4 4 12 4z"/>\n  <path d="M9 9.5v2.5M12 8.5v4.5M15 9.5v2.5" class="thin"/>\n</symbol>',
    privacy: 'The samples and the description you paste are sent to the model. Published copy is public already; an internal draft is your call.',
    inputs: [
      { key: 'samples', label: 'Two or three samples of copy you like', type: 'text+file', accept: '.txt,.md,.pdf', rows: 10, placeholder: 'Paste them one after another with a blank line between: a web page, an email, a post, a product description. The ones that sound most like you.' },
      { key: 'about', label: 'What the brand is', type: 'text', rows: 3, placeholder: 'What you sell, to whom, and what you want to be known for. One or two sentences.' }
    ],
    options: [
      { key: 'audience', label: 'Main audience', type: 'text', placeholder: 'e.g. factory purchase managers' },
      { key: 'aim', label: 'Aim', type: 'select', default: 'describe', options: [{ value: 'describe', label: 'Describe the voice the samples already have' }, { value: 'sharpen', label: 'Sharpen it — say where the samples fall short' }] }
    ],
    system: (o) => 'You are a brand writer building a tone-of-voice guide from real samples. Work from what is on the page: name the traits the samples actually show, point to the words that show them, and do not describe a voice the samples do not have' + (o.aim === 'sharpen' ? '; but where a sample is weaker than the brand described deserves, say so plainly and show the fix' : '') + '. Be concrete: every rule comes with an example. Prefer plain words; a voice guide written in marketing jargon teaches nobody. Keep table entries short. British spelling. ' + JSON_ONLY,
    prompt: (i, o) => 'Build a brand voice guide. Return JSON with exactly these keys: personality (array of exactly 3 single words), personality_explained (array of 3 strings, one per word in the same order, each quoting a phrase from a sample as evidence), tone (array of 5–7 objects {do, dont}: matched pairs of at most 8 words each — what the voice does, and the nearby thing it does not do), vocabulary_use (array of 8–12 words or phrases the brand should use, drawn from or consistent with the samples), vocabulary_avoid (array of 8–12 words or phrases to avoid, each followed by the reason in brackets), rewritten_samples (object with keys sample_1, sample_2, sample_3 — one per sample given, null for a sample not given — each {original (a short passage from that sample, quoted exactly), rewritten (' + (o.aim === 'sharpen' ? 'the passage at the voice\'s best' : 'the passage in the voice made explicit, changing only what the rules require') + '), what_changed (one sentence)}), by_channel (object with keys social, support, sales, each {rules (2–3 sentences on how the voice flexes in that channel), example (one sentence written in that channel\'s register)}), one_line_summary (how to explain the voice to a new writer in one sentence).\n\nWHAT THE BRAND IS:\n' + i.about + (o.audience ? '\nMAIN AUDIENCE: ' + o.audience : '') + '\n\nSAMPLES:\n' + i.samples,
    output: 'fields', maxTokens: 4000,
    downloads: textDownload('brand-voice-guide.md', (d) => {
      const rs = obj(d.rewritten_samples), bc = obj(d.by_channel);
      return ['# Brand voice guide', '', str(d.one_line_summary), '', '## Personality: ' + arr(d.personality).map(str).join(', '), '']
        .concat(arr(d.personality_explained).map(x => '- ' + str(x)), ['', '## Tone', '', '| Do | Don\'t |', '|---|---|'], arr(d.tone).map(t => '| ' + str(obj(t).do) + ' | ' + str(obj(t).dont) + ' |'),
          ['', '## Words to use', ''], arr(d.vocabulary_use).map(x => '- ' + str(x)), ['', '## Words to avoid', ''], arr(d.vocabulary_avoid).map(x => '- ' + str(x)),
          ['', '## Samples, rewritten'], Object.keys(rs).filter(k => rs[k]).reduce((a, k) => a.concat(['', '### ' + k.replace(/_/g, ' '), '', '> ' + str(obj(rs[k]).original), '', str(obj(rs[k]).rewritten), '', '_' + str(obj(rs[k]).what_changed) + '_']), []),
          ['', '## By channel'], Object.keys(bc).reduce((a, k) => a.concat(['', '### ' + k.charAt(0).toUpperCase() + k.slice(1), '', str(obj(bc[k]).rules), '', '> ' + str(obj(bc[k]).example)]), []), ['']).join('\n');
    }),
    sample: { inputs: { samples: 'Website, about us:\nWe have supplied safety gear to factories in Pune since 1998. We stock what we sell, we quote a delivery date and we keep it. If a glove fails on the job, call us: we will replace it and find out why.\n\nWhatsApp broadcast:\nGloves are back in stock. ISI-marked, Rs 85 a pair on 100 or more, delivered within 48 hours across Maharashtra. Reply with your quantity and we will confirm today.\n\nSupport reply:\nHello Mr Desai — the goggles you ordered left our warehouse this morning and should reach Ahmedabad by Thursday. The tracking number is [number]. If they are not there by Friday, message me here and I will chase it myself.', about: 'Sharma Traders sells industrial safety gear — gloves, goggles, boots — to factories and workshops across Maharashtra. We want to be known as the supplier who answers the phone and delivers when we said we would.' }, opts: { audience: 'purchase managers at factories and workshops', aim: 'describe' } },
    tips: ['Choose the samples with care: the guide describes the voice they have. Three pieces you are proud of make a better guide than ten you are not.', 'The do/don\'t pairs are the part a new writer uses. Print them; the three words are for the meeting.', 'Support and sales pull the voice in different directions, one calm and one keen. The by-channel rules say how far each may go before it stops sounding like you.', 'Run it again with "Sharpen it" and it says where your samples fall short of the brand you described, with the fix shown.'],
    faq: [{ q: 'Will it invent a personality?', a: 'It is told to work from evidence: each of the three words is tied to a phrase in the samples. If your samples are bland, the guide says so rather than dressing them up, and "Sharpen it" shows what better would look like.' }, { q: 'How many samples do I need?', a: 'Two is the minimum, three is right, and five is the most that helps. Mix them — a page, an email, a message — because the guide is about what stays the same across them.' }, { q: 'Is the guide finished?', a: 'It is a first draft that took a minute instead of a workshop. Read it, cut what is wrong, add the words only your business uses, and put it where the writers are. The Markdown download is meant to be edited.' }]
  };

  /* ------------------------------------------------------------------ */

  const LP_GOAL = { buy: 'buy or place an order', trial: 'start a free trial', demo: 'book a demo or a call', quote: 'request a quote', signup: 'sign up', download: 'download it' };
  const LP_TONE = { plain: 'plain, confident', premium: 'premium, understated', friendly: 'friendly, everyday', technical: 'technical, precise' };
  window.AI_TOOLS['landing-page-writer'] = {
    title: 'Landing Page Copy Writer',
    short: 'Landing Page Writer',
    description: 'Product, audience, offer and proof in; a landing page out — hero headline and subhead, three benefit blocks, how it works, the objections answered, testimonial slots marked [quote needed], an FAQ and five calls to action — written from your facts and nothing else.',
    keywords: ['landing page copy generator', 'landing page headline writer', 'sales page copywriter ai', 'hero headline and subheadline', 'benefit blocks copywriting', 'landing page faq generator'],
    glyph: 'i-ai-landing', scripts: COMMON, action: 'Write page', resultTitle: 'Landing page copy',
    glyphSvg: '<symbol id="i-ai-landing" viewBox="0 0 24 24">\n  <rect x="3" y="4" width="18" height="16" rx="1.5"/>\n  <path d="M3 8h18" class="thin"/>\n  <circle cx="5.6" cy="6" r=".9" class="fill"/>\n  <path d="M6.5 11.5h8M6.5 14h5.5" class="thin"/>\n  <rect x="6.5" y="16" width="5.5" height="2" rx=".8" class="fill"/>\n</symbol>',
    privacy: 'The product facts, offer and proof points you type are sent to the model. Leave out customer names unless they have agreed to be quoted.',
    inputs: [
      { key: 'product', label: 'The product or service', type: 'text', rows: 6, placeholder: 'What it is, what it does, who it is for, how it works, what it costs. Facts, not adjectives.' },
      { key: 'proof', label: 'Proof points', type: 'text', rows: 4, required: false, placeholder: 'Numbers you can stand behind, certifications, years in business, customers who have agreed to be named, guarantees. Leave empty and the page marks where proof is needed.' }
    ],
    options: [
      { key: 'audience', label: 'Audience', type: 'text', placeholder: 'e.g. purchase managers at factories' },
      { key: 'offer', label: 'The offer', type: 'text', placeholder: 'e.g. 10% off the first order, free trial, free consultation' },
      { key: 'goal', label: 'The page asks the reader to', type: 'select', default: 'quote', options: [{ value: 'buy', label: 'Buy / order' }, { value: 'trial', label: 'Start a free trial' }, { value: 'demo', label: 'Book a demo or call' }, { value: 'quote', label: 'Request a quote' }, { value: 'signup', label: 'Sign up' }, { value: 'download', label: 'Download' }] },
      { key: 'tone', label: 'Voice', type: 'select', default: 'plain', options: [{ value: 'plain', label: 'Plain and confident' }, { value: 'premium', label: 'Premium, understated' }, { value: 'friendly', label: 'Friendly, everyday' }, { value: 'technical', label: 'Technical, precise' }] }
    ],
    system: (o) => 'You write landing page copy for small and medium businesses in a ' + (LP_TONE[o.tone] || LP_TONE.plain) + ' voice, with British spelling. The page has one job: get the reader to ' + (LP_GOAL[o.goal] || LP_GOAL.quote) + '. Rules. The headline says what the product does for the reader in plain words, under 12 words, no puns; the subhead says for whom and how. Every benefit is a fact from the input turned outward — what it means for the reader — never a claim the input does not support. Where a claim needs proof and none was given, write [proof needed: what would prove it] beside it. Testimonials are never invented: each slot is marked [quote needed] with a note of what the quote should show. Objections are the real ones a buyer would raise; answer them straight, and where the honest answer is a limit, state the limit. No exclamation marks, no "revolutionary", no "seamless", no "solutions". ' + JSON_ONLY,
    prompt: (i, o) => 'Write landing page copy' + (o.audience ? ' for ' + o.audience : '') + (o.offer ? ', with the offer: ' + o.offer : '') + '. Return JSON with exactly these keys: hero (object {headline, subhead, cta}), benefits (object with keys benefit_1, benefit_2, benefit_3, each {heading (under 8 words), text (one or two sentences)}), how_it_works (array of 3–4 strings, each "Step N — heading: one sentence"), objections (object with keys objection_1, objection_2, objection_3, objection_4, each {objection (as the buyer would say it), answer}), testimonials (array of 2–3 strings, each of the form "[quote needed] — [who: role, company] — should show: what this quote must demonstrate"), faq (object with keys faq_1 to faq_5, each {question, answer}), cta_variants (array of 5 short button texts, the first the recommended one), proof_used (array of the proof points from the input that were used, and where), missing (array of the facts or proof the page needs and did not have; empty if none).\n\nPRODUCT:\n' + i.product + (i.proof && String(i.proof).trim() ? '\n\nPROOF POINTS:\n' + i.proof : '\n\nPROOF POINTS: none given — mark where proof is needed.'),
    output: 'fields', maxTokens: 4000,
    downloads: textDownload('landing-page.md', (d) => {
      const h = obj(d.hero), b = obj(d.benefits), ob = obj(d.objections), fq = obj(d.faq);
      return ['# ' + str(h.headline), '', str(h.subhead), '', '**[' + str(h.cta) + ']**', '', '## Why it works for you', '']
        .concat(Object.keys(b).reduce((a, k) => a.concat(['### ' + str(obj(b[k]).heading), '', str(obj(b[k]).text), '']), []),
          ['## How it works', ''], arr(d.how_it_works).map((s, n) => (n + 1) + '. ' + str(s)), ['', '## Questions buyers ask', ''],
          Object.keys(ob).reduce((a, k) => a.concat(['**' + str(obj(ob[k]).objection) + '**', '', str(obj(ob[k]).answer), '']), []),
          ['## What customers say', ''], arr(d.testimonials).map(t => '> ' + str(t)), ['', '## FAQ', ''],
          Object.keys(fq).reduce((a, k) => a.concat(['**' + str(obj(fq[k]).question) + '**', '', str(obj(fq[k]).answer), '']), []),
          ['## Calls to action', ''], arr(d.cta_variants).map((c, n) => '- ' + str(c) + (n === 0 ? ' (recommended)' : '')),
          arr(d.missing).length ? ['', '## Still needed', ''].concat(arr(d.missing).map(m => '- ' + str(m))) : [], ['']).join('\n');
    }),
    sample: { inputs: { product: 'Sharma Traders supplies ISI-marked industrial safety gloves to factories and workshops across Maharashtra. Rs 85 a pair for 100 pairs or more; smaller orders at Rs 95. Order on the website or by phone before 11 am and it ships the same day; delivery within 48 hours anywhere in the state. GST invoice with every order. Free replacement if a pair fails within 30 days.', proof: 'Supplying since 1998. 340 factories bought from us last year. ISI certificate number available on request. 48-hour delivery met on 97% of orders in 2025 (our own records).' }, opts: { audience: 'purchase managers at factories and workshops in Maharashtra', offer: '10% off the first order of 200 pairs or more', goal: 'quote', tone: 'plain' } },
    tips: ['Facts, not adjectives, in the product box. "Delivers within 48 hours" becomes a benefit; "fast delivery" becomes nothing.', 'Every [quote needed] is a request to a customer you already have. Send it with the note of what the quote should show and you will get a usable one back.', 'The objections section is the one that sells. Read it as the most sceptical buyer you know; if an answer is thin, the page is thin there.', 'Five calls to action, one page. Use the first; test the others once the page has traffic.'],
    faq: [{ q: 'Why does it leave gaps instead of filling them?', a: 'Because a landing page that claims what you cannot show loses the sale when the buyer checks. Every [proof needed] and [quote needed] marks a place where a real fact will do more than a plausible sentence.' }, { q: 'Can it lay the page out?', a: 'No. It writes the sections in the order a landing page normally runs; your page builder or developer does the rest. The Markdown download keeps the structure.' }, { q: 'What if I have no proof points yet?', a: 'Leave the box empty. The page comes back with the benefit copy and a list under "missing" of what would prove each claim, which doubles as the list of things to go and measure.' }]
  };
})();
