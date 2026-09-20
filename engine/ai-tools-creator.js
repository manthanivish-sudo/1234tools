/**
 * The creator tools: what a YouTuber, vlogger, podcaster or writer makes in
 * a week — a script, the metadata that sits under it, ten hooks to choose
 * between, show notes from a transcript, a long article, an edit of your
 * own draft, a newsletter issue, and the same work re-cut for five other
 * places.
 *
 * Same shape as engine/ai-tools.js, in its own file so parallel batches
 * never edit the same one. Two rules run through all eight. Nothing is
 * invented: no statistic, no timestamp, no quotation, no sponsor, no link —
 * a gap is marked and left. And where a number can be counted, the browser
 * counts it after the answer arrives, because a language model counts
 * characters badly and a title that is four over is a title that gets cut.
 */
(function () {
  'use strict';
  window.AI_TOOLS = window.AI_TOOLS || {};
  const COMMON = ['/engine/zip.js', '/engine/sheet.js', '/engine/pdf-text.js', '/engine/pii.js', '/engine/render-ai.js', '/engine/ai-tools.js', '/engine/ai-tools-creator.js'];
  const JSON_ONLY = 'Return only JSON, with no explanation before or after it and no markdown fences. Inside JSON strings write line breaks as \\n, never as a raw newline. Use null for anything not present; never invent a value.';

  const str = (v) => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const arr = (v) => Array.isArray(v) ? v : [];
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const chars = (v) => Array.from(str(v)).length;
  const words = (v) => str(v).trim().split(/\s+/).filter(Boolean).length;

  const csvDownload = (name) => (data, ctx) => {
    const list = Array.isArray(data) ? data : (data.rows || data.items || [data]);
    const rows = ctx.sheet.objectsToRows(list);
    return [
      { name: name + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
      { name: name + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, name) }
    ];
  };
  /* a plain-text or Markdown rendering of a structured answer, plus the JSON */
  const textDownload = (name, build) => (data) => [
    { name: name, blob: () => new Blob([build(data)], { type: name.endsWith('.md') ? 'text/markdown' : 'text/plain' }) },
    { name: name.replace(/\.\w+$/, '.json'), blob: () => new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }
  ];

  /* ------------------------------------------------------------------ */
  /* 1. Video script writer                                             */
  /* ------------------------------------------------------------------ */

  const VIDEO_LENGTHS = [
    { value: '60', label: '60 seconds — a Short or Reel' },
    { value: '180', label: '3 minutes' },
    { value: '300', label: '5 minutes' },
    { value: '480', label: '8 minutes' },
    { value: '720', label: '12 minutes' }
  ];
  const VIDEO_FORMATS = {
    'talking-head': 'a talking-head piece straight to camera: the presenter is the whole shot, so the writing has to carry it',
    tutorial: 'a tutorial: the viewer is doing the thing while watching, so every step is complete, in order, and possible to pause on',
    review: 'a review: what it is, who it is for, what is good, what is not, and a verdict — with the reviewer’s own use of the thing at the centre',
    listicle: 'a numbered list video: every item earns its place, each is announced by number, and the best one is not held back as a hostage',
    documentary: 'a documentary or video essay: a narrative spine, evidence in order, and a point of view stated plainly rather than implied'
  };
  const VIDEO_FORMAT_LABELS = [
    { value: 'talking-head', label: 'Talking head' }, { value: 'tutorial', label: 'Tutorial / how-to' }, { value: 'review', label: 'Review' },
    { value: 'listicle', label: 'Listicle (numbered)' }, { value: 'documentary', label: 'Documentary / video essay' }
  ];
  const VIDEO_TONES = { plain: 'plain and direct', warm: 'warm and personal', energetic: 'quick and energetic, without shouting', dry: 'dry and wry', serious: 'serious and measured' };
  const mmss = (n) => Math.floor(n / 60) + ':' + String(Math.round(n) % 60).padStart(2, '0');

  window.AI_TOOLS['video-script-writer'] = {
    title: 'YouTube & Vlog Script Writer',
    short: 'Video Script Writer',
    description: 'A topic in; a script you can read to camera out — a hook worth the first fifteen seconds, a beat-by-beat outline whose timings add up to the length you asked for, the spoken words in full, one call to action, and a B-roll list for the edit.',
    keywords: ['youtube script writer', 'video script generator', 'vlog script template', 'youtube video outline with timings', 'tutorial script writer', 'video essay script ai', 'talking head script'],
    glyph: 'i-ai-script',
    glyphSvg: '<symbol id="i-ai-script" viewBox="0 0 24 24">\n  <rect x="3" y="8" width="18" height="12.5" rx="1.5"/>\n  <path d="M3.3 8l1.5-3.7 17 1.5-.3 2.2z"/>\n  <path d="M8.7 4.9l-1.3 3M13.5 5.3l-1.3 3M18.3 5.7l-1.3 3" class="thin"/>\n  <path d="M7 12.5h10M7 16h6.5" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Write script', resultTitle: 'Script',
    privacy: 'The topic and notes you type are sent to the model. A sponsor or a collaboration you have not announced belongs out of the box until you have.',
    inputs: [{ key: 'topic', label: 'What the video is about', type: 'text', rows: 7, placeholder: 'The subject, the point you want to make, the steps or beats if you know them, your own numbers and stories, what to avoid saying. The more you give, the less generic it is.' }],
    options: [
      { key: 'audience', label: 'Who it is for', type: 'text', placeholder: 'e.g. solo creators with a day job' },
      { key: 'length', label: 'Length', type: 'select', default: '480', options: VIDEO_LENGTHS },
      { key: 'format', label: 'Format', type: 'select', default: 'talking-head', options: VIDEO_FORMAT_LABELS },
      { key: 'tone', label: 'Tone', type: 'select', default: 'plain', options: [{ value: 'plain', label: 'Plain and direct' }, { value: 'warm', label: 'Warm and personal' }, { value: 'energetic', label: 'Quick and energetic' }, { value: 'dry', label: 'Dry and wry' }, { value: 'serious', label: 'Serious, measured' }] },
      { key: 'channel', label: 'Channel or presenter', type: 'text', placeholder: 'optional' }
    ],
    system: (o) => 'You write scripts for YouTube and vlog videos that one person will read aloud to a camera. Write ' + (VIDEO_FORMATS[o.format] || VIDEO_FORMATS['talking-head']) + ', in a ' + (VIDEO_TONES[o.tone] || VIDEO_TONES.plain) + ' voice, for ' + (o.audience || 'a general audience on YouTube') + (o.channel ? ', on the channel ' + o.channel : '') + '. Rules. The first fifteen seconds must earn the next fifteen: open on the thing itself, never on "hey guys, welcome back to my channel", never on a self-introduction, never on "before we start, hit subscribe". Write spoken English — contractions, short sentences, one idea to a sentence, words a person can say without tripping — not written English read aloud. Use only what the brief gives you. Never invent a statistic, a study, a price, a product, a sponsor, or an anecdote from the presenter’s life; where a number or a story would carry the beat and you have not been given one, write [your example here] or [check this figure] in the script and move on. The call to action is one ask, in the second half, in the presenter’s own words. British spelling. Output the script only, in the layout asked for: no preamble, no notes to the editor, no word count, no offer to revise.',
    prompt: (i, o) => {
      const secs = Number(o.length) || 480;
      const target = Math.round(secs * 145 / 60);
      const beats = secs <= 60 ? '3 to 5' : secs <= 300 ? '5 to 8' : '7 to 12';
      const hook = secs <= 60 ? 5 : 15;
      return 'Write a video script that runs ' + mmss(secs) + ' — ' + secs + ' seconds.\n\n'
        + 'THE ARITHMETIC, which matters more than anything else here. Give every beat a whole number of seconds. The durations must add up to exactly ' + secs + '. Add them up yourself before you write the outline out, and if the total is not ' + secs + ', change the durations until it is. Each beat starts at the sum of the durations before it, so the first starts at 0:00 and the last ends at ' + mmss(secs) + '. Use ' + beats + ' beats.\n\n'
        + 'THE LENGTH OF THE WRITING. Spoken aloud, the script runs at about 145 words a minute, so the whole thing is roughly ' + target + ' words of speech, and each beat carries roughly its own duration multiplied by 2.4. A beat marked 45s with twelve words of speech in it is wrong; write the words the beat needs.\n\n'
        + 'Lay it out exactly like this and output nothing else:\n\n'
        + '# <working title>\n\n'
        + '## Hook\n<the first ' + hook + ' seconds, word for word, as the presenter says them, with what is on screen in square brackets>\n\n'
        + '## Outline\n- 0:00 | ' + hook + 's | Hook | what happens in this beat, in one line\n- 0:' + String(hook).padStart(2, '0') + ' | 40s | <beat name> | what happens in this beat\n(one line per beat, same shape, times in m:ss and durations in whole seconds)\nTotal: ' + mmss(secs) + '\n\n'
        + '## Script\n### <beat name> (m:ss)\n<the spoken words in full, as they are said>\n[VISUAL: what is on screen] — only where it is not obvious\n<one ### heading and its words for every beat in the outline, in the same order>\n\n'
        + '## Call to action\n<a short paragraph: the one thing to ask for, the words to ask it in, and where in the video it lands>\n\n'
        + '## B-roll and shots\n- <m:ss> — <the shot, and what it is doing there>\n\n'
        + 'THE BRIEF:\n' + i.topic;
    },
    output: 'text', maxTokens: 6000,
    sample: {
      inputs: { topic: 'How I film a whole week of videos in one day — the batch-filming system I use.\nPoints to make: filming one video a week quietly ate every Sunday; batching works because the setup is the expensive part, not the filming; the Sunday planning hour where I decide all six videos before touching a camera; one lighting and camera setup that covers three formats so nothing is re-rigged; a shot list per video taped to the wall; filming in wardrobe order rather than video order, which is the change that actually saved the time; naming files at the moment of filming, not in the edit.\nMy own numbers: it used to take three days a week and now it is about five hours for six videos; my upload schedule has not slipped in fourteen weeks.\nWhat still goes wrong: my voice tires after two hours, batteries die in the middle of the best take, and I am always tempted to write the script on camera instead of before.\nNo sponsor. Ask people to comment with the part of their own filming week that takes longest.' },
      opts: { audience: 'solo creators with a day job and fewer than 50,000 subscribers', length: '480', format: 'tutorial', tone: 'plain', channel: 'Making It Weekly' }
    },
    tips: [
      'The timings are the reason to use it. Every beat carries a duration, the durations add up to the length you chose, and the outline ends with the total — so you can cut a beat and know exactly what it buys you.',
      'Give it your own numbers and your own failures. Everything specific in the script comes from the brief; everything the brief does not say comes back as [your example here], which is the list of places only you can fill.',
      'Read the hook out loud before you film it. Fifteen seconds is about thirty-five words, and a hook that needs forty is a hook that has already lost.',
      'Twelve minutes is the longest it writes in one run — roughly 1,700 words of speech. For a twenty-minute essay, script it in two halves and join them; the second half writes better when you paste the first in as part of the brief.',
      'B-roll is listed against the timestamp it belongs to, which is the shot list for the day you actually have the camera out.'
    ],
    faq: [
      { q: 'Will the timings really add up?', a: 'That is what the prompt spends most of its words on: whole-second durations, a running start time, and a total line at the end. It gets there in practice, but it is arithmetic done by a language model — glance at the total before you rely on it, and if a beat is wrong it is one number to change.' },
      { q: 'Does it sound like me?', a: 'Not by itself. It writes clean spoken English in the tone you pick and leaves the personal parts marked for you to fill. The scripts that work are the ones where you paste in your own stories and numbers first; the ones that sound like everyone else are the ones written from a one-line topic.' },
      { q: 'Can it write a Short?', a: 'Choose 60 seconds and it writes to that: a five-second hook, three to five beats, and about 145 words. The Content Repurposer will also cut three short-form scripts out of a long video you have already made.' },
      { q: 'Will YouTube penalise an AI-written script?', a: 'YouTube’s rules are about what the video is, not what wrote the first draft: it acts against spam, impersonation and mass-produced content that helps nobody. A script you wrote from your own experience, edited and performed, is not that. A hundred videos generated from nothing are.' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 2. YouTube metadata writer                                         */
  /* ------------------------------------------------------------------ */

  const YT_TITLE_MAX = 60, YT_TAGS_MAX = 500;
  /* The model is asked for a count and gets it wrong by a character or two;
     the browser does not. The page builds the downloads from the same object
     it draws the fields from, so what is on screen is the browser's count. */
  const countMeta = (d) => {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return d;
    arr(d.titles).forEach(t => {
      if (!t || typeof t !== 'object') return;
      const n = chars(t.title);
      t.characters = n;
      t.over = n > YT_TITLE_MAX ? 'OVER 60 by ' + (n - YT_TITLE_MAX) + ' — it will be cut in search' : null;
    });
    const lines = str(d.description).split('\n');
    d.before_the_fold = lines.slice(0, 2).join('\n');
    d.before_the_fold_characters = chars(d.before_the_fold);
    d.description_characters = chars(d.description);
    const tagText = arr(d.tags).map(str).join(', ');
    d.tags_characters = chars(tagText);
    d.tags_over = d.tags_characters > YT_TAGS_MAX ? 'OVER 500 by ' + (d.tags_characters - YT_TAGS_MAX) + ' — drop the shortest tags' : null;
    return d;
  };

  window.AI_TOOLS['youtube-metadata-writer'] = {
    title: 'YouTube Title, Description & Tags Writer',
    short: 'YouTube Metadata',
    description: 'Five titles, each counted here in your browser and flagged if it runs past the 60 characters YouTube shows; a description whose first two lines do the work before the fold; chapter timestamps from your own outline; 15 to 20 tags; three hashtags; and a pinned comment.',
    keywords: ['youtube title generator', 'youtube description writer', 'youtube tags generator', 'youtube chapters timestamps', 'video seo metadata', 'youtube pinned comment ideas', 'youtube title character count'],
    glyph: 'i-ai-metadata',
    glyphSvg: '<symbol id="i-ai-metadata" viewBox="0 0 24 24">\n  <rect x="3" y="3.5" width="18" height="11.5" rx="2"/>\n  <path d="M10.3 6.9l4.4 2.4-4.4 2.4z" class="fill"/>\n  <path d="M3.5 18h13M3.5 20.5h8" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Write metadata', resultTitle: 'Title, description and tags',
    privacy: 'What the video is, and the outline if you paste one, are sent to the model. Nothing about your channel’s analytics is, because nothing here has access to them.',
    inputs: [
      { key: 'video', label: 'What the video is', type: 'text', rows: 6, placeholder: 'What happens in it, who it is for, what the viewer walks away with, any numbers or names that belong in the description. A paragraph is enough.' },
      { key: 'outline', label: 'Outline with timings (optional)', type: 'text+file', accept: '.txt,.md,.srt,.vtt', rows: 7, required: false, placeholder: 'Paste the beats with their times — "0:00 the three-day week, 1:55 the planning hour…" — or choose the .srt or .vtt your editor exported, and the chapters come back as timestamps. Leave it empty and none are invented.' }
    ],
    options: [
      { key: 'keyword', label: 'Search phrase', type: 'text', placeholder: 'e.g. batch filming youtube videos', hint: 'What you would like this video found for' },
      { key: 'channel', label: 'Channel', type: 'text', placeholder: 'optional' },
      { key: 'audience', label: 'Who it is for', type: 'text', placeholder: 'e.g. solo creators with a day job' },
      { key: 'links', label: 'Links to include', type: 'text', placeholder: 'One per idea; placeholders like [template link] are fine', hint: 'Only links you give are used — none are invented' }
    ],
    system: () => 'You write the metadata that sits under a YouTube video: titles, a description, chapters, tags and a pinned comment. Hard limits, counted in characters including spaces and punctuation: a title is at most 60 (YouTube stores 100 but cuts at about 60 in search and on a phone), the whole tag list at most 500, the description at most 5,000. Language models miscount by a character or two, so aim titles at 50 to 58 and let the counting happen elsewhere. No clickbait: every title is a promise the video keeps, with no ALL CAPS word, no "you won’t believe", no manufactured shock, and no bracketed tag that lies. Front-load what matters — the first three words are all a phone shows. The description is written for a person: it says what the video is in its first two lines, because YouTube hides the rest behind "more", and it is never a wall of keywords. Never invent a link, a timestamp, a sponsor, a discount code, a subscriber count or a result. British spelling unless the audience is American. ' + JSON_ONLY,
    prompt: (i, o) => {
      const has = !!(i.outline && String(i.outline).trim());
      return 'Write the title, description and tags for this video.'
        + (o.keyword ? ' Target search phrase: "' + o.keyword + '".' : '')
        + (o.channel ? ' Channel: ' + o.channel + '.' : '')
        + (o.audience ? ' Audience: ' + o.audience + '.' : '')
        + (o.links ? ' Links to include, exactly as given: ' + o.links + '.' : ' No links were given, so include none.')
        + ' Return JSON with exactly these keys: titles (array of exactly 5 objects {title, angle, characters}: each at most 60 characters, each a genuinely different angle — the plain one, the one that names the result, the question, the one built on a number from the brief, and the one that names the viewer — and no two may be the same sentence rearranged), description (the whole description as one string with \\n line breaks: the first two lines say what the video is and why to watch it, then a blank line, then the fuller description in short paragraphs, then the links given, and nothing that was not given), timestamps ('
        + (has ? 'array of {time, chapter} taken from the outline below and from nowhere else: times in m:ss, the first exactly "0:00", in order, each at least ten seconds after the one before, chapter names of two to five words' : 'null — no outline was given, so invent none')
        + '), tags (array of 15 to 20 phrases people actually type, most specific first, the whole set at most 500 characters including the commas between them), hashtags (array of exactly 3 words or phrases without the # sign, since YouTube shows the first three above the title), pinned_comment (one comment in the creator’s voice that either asks the question the video leaves open or carries the one link that matters), notes (array of anything you could not settle because a fact was missing; empty if none).\n\nTHE VIDEO:\n' + i.video
        + (has ? '\n\nOUTLINE WITH TIMINGS:\n' + i.outline : '');
    },
    output: 'fields', maxTokens: 3000, transform: countMeta,
    downloads: (data) => textDownload('youtube-metadata.txt', (d) => {
      const t = arr(d.titles).map((x, n) => '  ' + (n + 1) + '. ' + str(obj(x).title) + '  (' + chars(obj(x).title) + ' characters' + (obj(x).angle ? ', ' + str(obj(x).angle) : '') + ')' + (obj(x).over ? '  ** ' + str(obj(x).over) + ' **' : ''));
      const ts = arr(d.timestamps).map(x => '  ' + str(obj(x).time) + ' ' + str(obj(x).chapter));
      const tagText = arr(d.tags).map(str).join(', ');
      return ['TITLES'].concat(t, ['', 'DESCRIPTION  (' + chars(d.description) + ' characters; the first two lines are what shows before "more")', '', str(d.description), ''],
        ts.length ? ['CHAPTERS'].concat(ts, ['']) : ['CHAPTERS: none — no outline was given, so none were invented', ''],
        ['TAGS  (' + chars(tagText) + ' of 500 characters)', '', tagText, '', 'HASHTAGS', '', arr(d.hashtags).map(x => '#' + str(x).replace(/^#/, '')).join(' '), '', 'PINNED COMMENT', '', str(d.pinned_comment)],
        arr(d.notes).length ? ['', 'NOTES'].concat(arr(d.notes).map(n => '  - ' + str(n))) : []).join('\n');
    })(countMeta(data)),
    sample: {
      inputs: {
        video: 'An eight-minute tutorial on batch-filming a week of videos in one day: the Sunday planning hour, one lighting setup that covers three formats, a shot list per video, filming in wardrobe order rather than video order, and naming files at the moment of filming. I film six videos in about five hours; it used to take three days, and my upload schedule has not slipped in fourteen weeks. For solo creators with a day job who film alone.',
        outline: '0:00 the three-day filming week I used to have\n0:42 why batching beats filming one at a time\n1:55 the Sunday planning hour\n3:10 one lighting setup, three formats\n4:35 the shot list on the wall\n5:40 filming in wardrobe order, not video order\n6:30 file names that save the edit\n7:20 what still goes wrong\n7:50 what to try this week'
      },
      opts: { keyword: 'batch filming youtube videos', channel: 'Making It Weekly', audience: 'solo creators with a day job and fewer than 50,000 subscribers', links: 'The shot list template: [template link]. Newsletter: [newsletter link]' }
    },
    tips: [
      'The character counts are made in your browser after the answer arrives, not by the model. Sixty is where YouTube cuts a title in search and on a phone; anything over is flagged with how far over it is.',
      'The first two lines of the description are the whole game — they are what shows before "more", and they are pulled out separately so you can read them on their own.',
      'Chapters come from your outline and nowhere else. Paste the times in, or choose the .srt your editor exported; leave it empty and the field comes back empty rather than invented. YouTube only makes chapters if the first one is 0:00 and there are at least three.',
      'Tags are worth little for ranking and something for disambiguation — a misspelling of your name, the model number, the town. The set is kept under YouTube’s 500-character total, counted here.',
      'Five titles, one video. Run the best two as a thumbnail test if your channel has the traffic for it; if it does not, pick the one that is a promise you can keep.'
    ],
    faq: [
      { q: 'Does it know what is trending?', a: 'No. It has no access to YouTube, no search volumes, no view counts and no sight of your channel. It knows how titles and descriptions are written when they are written well. Use YouTube Studio to find out what actually happened.' },
      { q: 'Why does it refuse to make up timestamps?', a: 'Because a chapter that points at the wrong second is worse than no chapter: viewers jump, land in the middle of a sentence, and leave. If you give it the outline it uses your times; if you do not, it says so in the notes.' },
      { q: 'Are the tags worth anything?', a: 'Less than people think. YouTube has said tags play a minimal role in discovery, and they are mostly useful for spellings and model numbers the title cannot carry. They are here because the box exists and filling it badly is worse than filling it well.' },
      { q: 'Can it write the thumbnail text?', a: 'Not as a field of its own. Take the three or four strongest words out of the plainest title — a thumbnail that repeats the whole title wastes both.' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 3. Video hook writer                                               */
  /* ------------------------------------------------------------------ */

  const HOOK_ANGLES = ['Question', 'Bold claim', 'Story', 'Contradiction', 'Demonstration', 'Stake', 'Number', 'Confession', 'Callout', 'Cold open'];
  const HOOK_JOBS = 'A Question asks something the viewer cannot answer and now wants to. A Bold claim states the thing the video will go on to prove. A Story drops the viewer into a moment already happening. A Contradiction sets what everyone believes against what you found. A Demonstration shows the finished result first and explains it afterwards. A Stake says what it costs to get this wrong. A Number opens on a figure from the brief and makes the viewer want the rest of it. A Confession admits what the presenter got wrong. A Callout names the one viewer this is for and lets everybody else leave. A Cold open starts mid-sentence in the middle of the best part.';
  /* spoken length, counted here: a hook is a stopwatch problem, not a word problem */
  const countHooks = (rows) => {
    rows.forEach(r => {
      if (!r || typeof r !== 'object') return;
      const n = words(r.hook);
      r.words = n;
      r.about_seconds = Math.round(n / 2.5 * 10) / 10;
    });
    return rows;
  };

  window.AI_TOOLS['video-hook-writer'] = {
    title: 'Video Hook Writer — Ten Openings',
    short: 'Video Hook Writer',
    description: 'One video idea in; ten opening lines out, each built on a different angle — a question, a claim, a story, a contradiction, a demonstration, a stake and four more — with the shot it opens on, the viewer it suits, its spoken length counted here, and the honest reason it might not work.',
    keywords: ['youtube hook generator', 'video opening lines', 'first 15 seconds youtube', 'tiktok hook ideas', 'video intro script writer', 'retention hook ideas', 'short form hook writer'],
    glyph: 'i-ai-hook',
    glyphSvg: '<symbol id="i-ai-hook" viewBox="0 0 24 24">\n  <path d="M15.5 4.5v7a4.5 4.5 0 0 1-9 0v-1.2"/>\n  <path d="M4.3 11.9L6.5 9.2l2.4 2.4" class="thin"/>\n  <path d="M15.5 4.5h2.2" class="thin"/>\n  <circle cx="19.2" cy="4.5" r="1.4" class="fill"/>\n</symbol>',
    scripts: COMMON, action: 'Write ten hooks', resultTitle: 'Ten hooks',
    privacy: 'The idea you type is sent to the model. It is the premise of a video you are about to publish; there is rarely anything private in it.',
    inputs: [{ key: 'idea', label: 'The video idea', type: 'text', rows: 6, placeholder: 'What the video is, what the viewer gets, and the facts you can actually use — your numbers, the thing that surprised you, the mistake you made. A hook built on a real detail beats one built on a topic.' }],
    options: [
      { key: 'audience', label: 'Who it is for', type: 'text', placeholder: 'e.g. creators who film alone' },
      { key: 'platform', label: 'Where it opens', type: 'select', default: 'long', options: [{ value: 'long', label: 'A YouTube video — about 15 seconds' }, { value: 'short', label: 'A Short, Reel or TikTok — about 3 seconds' }, { value: 'podcast', label: 'A podcast episode — a cold open' }] },
      { key: 'tone', label: 'Tone', type: 'select', default: 'plain', options: [{ value: 'plain', label: 'Plain and direct' }, { value: 'warm', label: 'Warm and personal' }, { value: 'energetic', label: 'Quick and energetic' }, { value: 'dry', label: 'Dry and wry' }, { value: 'serious', label: 'Serious, measured' }] }
    ],
    system: (o) => 'You write the opening of videos — the words that decide whether anybody watches the rest — in a ' + (VIDEO_TONES[o.tone] || VIDEO_TONES.plain) + ' voice for ' + (o.audience || 'a general audience') + '. ' + ({ short: 'This opens a Short, a Reel or a TikTok: the first three seconds are all you get, so the hook is one sentence, ten words or fewer where it can be, and something is moving on screen as it is said.', podcast: 'This is a podcast cold open: no picture to carry it, so it is a sentence a listener leans into, usually a line lifted from the best part of the episode.' }[o.platform] || 'This opens a YouTube video: about fifteen seconds, thirty-five words at most, and the viewer decides inside the first five.') + ' The ten hooks are ten different openings, not one idea reworded ten times. No two may share their first four words. Each must stand alone, without the other nine. Where two angles would land on the same sentence, change what the hook says, not how it says it. ' + HOOK_JOBS + ' A hook may never promise what the brief does not support: if the claim is bigger than the facts, make the claim smaller and say so under why_it_might_fail. No "in this video I am going to", no "stay tuned", no "let me tell you". British spelling. ' + JSON_ONLY,
    prompt: (i, o) => 'Write exactly ten opening hooks for this video, one per angle, in this order: ' + HOOK_ANGLES.join(', ') + '. Return a JSON array of exactly 10 objects with keys: number (1 to 10), angle (exactly one of the names above, each used once, in that order), hook (the words said or shown, at most ' + (o.platform === 'short' ? '15' : '35') + ' words, written as they are spoken), first_shot (what the viewer is looking at while it is said), suits (in a few words, the kind of viewer this one is for), why_it_might_fail (the honest risk in this one — where it overpromises, where it bores, where it reads as clickbait — never "none"), strength (high, medium or low: how well this angle fits this particular idea).\n\nTHE IDEA:\n' + i.idea,
    output: 'table', maxTokens: 3000,
    transform: (data) => Array.isArray(data) ? countHooks(data) : data,
    downloads: (data, ctx) => csvDownload('video-hooks')(countHooks(Array.isArray(data) ? data : arr(data.rows || data.items)), ctx),
    sample: {
      inputs: { idea: 'A video about batch-filming: how I film six videos in one day, and why filming one video a week was quietly eating every Sunday I had. Facts I can use: it used to take three days a week and now it is about five hours; the change that actually saved the time was filming in wardrobe order rather than video order, not buying anything; my upload schedule has not slipped in fourteen weeks; the first time I tried it I lost two hours re-rigging lights I did not need to move. For solo creators who film alone and have a day job.' },
      opts: { audience: 'solo creators who film alone and have a day job', platform: 'long', tone: 'plain' }
    },
    tips: [
      'Ten angles, fixed and named, is the point. Asking for "ten hooks" gets eight rewordings of one; asking for a question, a claim, a story, a contradiction, a demonstration, a stake, a number, a confession, a callout and a cold open gets ten different openings you can choose between.',
      'The spoken length is counted in your browser from the words, at about two and a half words a second. Fifteen seconds is roughly thirty-five words — anything longer is a hook you will cut while filming.',
      'Read why_it_might_fail before you pick. Every hook has a way of going wrong, and the tool is told never to answer "none"; the one with the risk you can live with is usually the one to film.',
      'Strength is the model’s honest fit between the angle and your idea. A Number hook on an idea with no numbers in it comes back marked low, which tells you something about the brief as much as the hook.',
      'Film two. The first fifteen seconds are cheap to shoot twice and the retention graph will tell you which one worked.'
    ],
    faq: [
      { q: 'Are these clickbait?', a: 'They are told not to be: a hook may not promise what the brief does not support, and where a claim outruns the facts the tool is told to shrink the claim and flag it. A hook that makes a true promise vividly is the job; one that makes a false promise loudly is how a channel loses the audience it just bought.' },
      { q: 'Why ten and not five?', a: 'Because the tenth is often the one you would never have written. Five comes back safe; ten forces the angles you avoid — the confession, the callout, the cold open — and one of those is usually better than your usual opening.' },
      { q: 'Can I use one for a Short?', a: 'Pick "A Short, Reel or TikTok" and every hook comes back short enough to say in three seconds, because the fifteen-second version does not survive that format.' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 4. Podcast show notes                                              */
  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['podcast-show-notes'] = {
    title: 'Podcast Show Notes from a Transcript',
    short: 'Podcast Show Notes',
    description: 'Paste or upload a transcript and get the show notes: a summary, chapter timestamps taken from the transcript’s own timings, quotable lines with the time they were said, the links mentioned, the topics, and a short blurb to post. No time is ever estimated and no quotation is ever tidied.',
    keywords: ['podcast show notes generator', 'transcript to show notes', 'podcast chapter timestamps', 'episode summary ai', 'srt to show notes', 'podcast episode description writer', 'pull quotes from transcript'],
    glyph: 'i-ai-podcast',
    glyphSvg: '<symbol id="i-ai-podcast" viewBox="0 0 24 24">\n  <rect x="9" y="2.8" width="6" height="11" rx="3"/>\n  <path d="M5.5 11.3a6.5 6.5 0 0 0 13 0" class="thin"/>\n  <path d="M12 17.8v3.4M9 21.2h6" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Write show notes', resultTitle: 'Show notes',
    privacy: 'The transcript’s text is sent to the model. It carries everything your guest said, including anything they said off the record — cut those parts out before you paste it. The file itself is read here and never leaves your device.',
    inputs: [{ key: 'transcript', label: 'Transcript', type: 'text+file', accept: '.txt,.md,.srt,.vtt,.pdf', rows: 14, placeholder: 'Paste the transcript, or choose the .txt, .srt, .vtt or PDF your transcription tool made. Speaker labels and timestamps come through as they are, and they are what the chapters and the quote times are built from.' }],
    options: [
      { key: 'show', label: 'Show', type: 'text', placeholder: 'e.g. The Long Way Round' },
      { key: 'episode', label: 'Episode', type: 'text', placeholder: 'e.g. 47 — Sam Okafor' },
      { key: 'guest', label: 'Guest', type: 'text', placeholder: 'name, and what they do' },
      { key: 'social', label: 'Blurb written for', type: 'select', default: 'x', options: [{ value: 'x', label: 'X — under 260 characters' }, { value: 'linkedin', label: 'LinkedIn — a short paragraph' }, { value: 'instagram', label: 'Instagram — a caption with line breaks' }, { value: 'email', label: 'Email — two or three sentences' }] }
    ],
    system: (o) => 'You write show notes for a podcast or interview from its transcript' + (o.show ? ' for the show ' + o.show : '') + '. The transcript is the only source. Every chapter time and every quote time is copied from a timestamp that is actually in the transcript; if the transcript has no timestamps, return chapters as null, leave every quote time null, and say so plainly in notes — never estimate a time, never interpolate one, never round one into existence. Write every time as m:ss, or as h:mm:ss only where it is past one hour, so a transcript’s 00:04:38 is written 4:38 and its 01:12:09 is written 1:12:09. Quotations are exact: copy the speaker’s own words, removing only "um", "you know" and false starts, and never smooth a sentence into something the speaker did not say. Attribute each quote to the speaker the transcript attributes it to; where the transcript does not say who is speaking, say so rather than guessing. A link is listed only where the transcript names it; where someone says "it is in the description" without naming it, record what it was and mark it [link needed]. Do not add a fact, a date, a figure or a credential that the transcript does not contain. The social blurb is written for ' + ({ linkedin: 'LinkedIn: a short paragraph, no hashtag soup, three hashtags at most', instagram: 'Instagram: a caption with line breaks and six to ten hashtags at the end', email: 'an email to subscribers: two or three sentences and one link' }[o.social] || 'X: under 260 characters, at most two hashtags') + '. British spelling. ' + JSON_ONLY,
    prompt: (i, o) => 'Write the show notes for this episode.' + (o.episode ? ' Episode: ' + o.episode + '.' : '') + (o.guest ? ' Guest: ' + o.guest + '.' : '') + ' Return JSON with exactly these keys: episode_title_suggestions (array of 3, each under 70 characters), one_line (a single sentence describing the episode), summary (4 to 6 sentences: what was discussed and what a listener gets from it), chapters (array of {time, title}: every time is a timestamp that is actually in the transcript, rewritten as m:ss — or h:mm:ss only past one hour — so the transcript’s 00:04:38 becomes 4:38; the first is the transcript’s own first time, they run in order, and titles are two to six words — or null if the transcript carries no timestamps), quotes (array of 3 to 6 objects {quote, speaker, time}: the lines worth pulling out, word for word, with the time from the transcript in the same m:ss form, or null if it has none), topics (array of 5 to 10 short subject labels), links_mentioned (array of {what, link}: link is the URL if the transcript gives one, otherwise "[link needed]"), guest (object {name, who_they_are, where_to_find_them} built only from what the transcript says, or null), social_blurb (one string), keywords (array of 8 to 12 search phrases for the episode page), notes (array of short strings: anything missing, anything you could not time, anything the host should check before publishing).\n\nTRANSCRIPT:\n' + i.transcript,
    output: 'fields', maxTokens: 4000,
    downloads: textDownload('show-notes.md', (d) => {
      const g = obj(d.guest);
      return ['# ' + (arr(d.episode_title_suggestions)[0] ? str(arr(d.episode_title_suggestions)[0]) : 'Show notes'), '', str(d.one_line), '', '## Summary', '', str(d.summary), '']
        .concat(arr(d.episode_title_suggestions).length ? ['## Other titles considered', ''].concat(arr(d.episode_title_suggestions).slice(1).map(t => '- ' + str(t)), ['']) : [],
          arr(d.chapters).length ? ['## Chapters', ''].concat(arr(d.chapters).map(c => '- **' + str(obj(c).time) + '** ' + str(obj(c).title)), ['']) : ['## Chapters', '', '_The transcript carried no timestamps, so no chapters were made. None were invented._', ''],
          ['## Quotes', ''], arr(d.quotes).map(q => '> ' + str(obj(q).quote) + '\n>\n> — ' + str(obj(q).speaker) + (obj(q).time ? ' (' + str(obj(q).time) + ')' : '') + '\n'),
          ['## Links mentioned', ''], arr(d.links_mentioned).map(l => '- ' + str(obj(l).what) + ' — ' + str(obj(l).link)),
          g.name ? ['', '## Guest', '', '**' + str(g.name) + '** — ' + str(g.who_they_are), '', str(g.where_to_find_them)] : [],
          ['', '## Post this', '', str(d.social_blurb), '', '## Topics', '', arr(d.topics).map(str).join(' · ')],
          arr(d.notes).length ? ['', '## Before you publish', ''].concat(arr(d.notes).map(n => '- ' + str(n))) : [], ['']).join('\n');
    }),
    sample: {
      inputs: { transcript: '[00:00:00] PRIYA: Welcome back to The Long Way Round. I am Priya Nair, and today I am sitting with Sam Okafor, who spent nine years as a session drummer before he started making records on his own in a shed in Margate. Sam, thanks for coming.\n[00:00:22] SAM: Thanks for having me. The shed is more of a garage now, for the record.\n[00:01:04] PRIYA: Let us start with the session years. What does nine years of playing on other people’s records teach you?\n[00:01:15] SAM: That nobody is coming to save the song. I used to sit in a live room waiting for somebody to tell me what the part was, and the honest answer is that everyone in the building was waiting for somebody else to decide. The day I started deciding, I started getting called back.\n[00:04:38] PRIYA: And that is what pushed you to produce your own things?\n[00:04:49] SAM: Partly. The other part was money. Session work pays on the day and then it is gone. A record you made keeps paying, badly, for years. Badly but for years — that is the whole business model, really.\n[00:09:12] PRIYA: Tell me about the first record you made alone.\n[00:09:20] SAM: It took fourteen months and it is unlistenable. I had no deadline, so I kept moving things. The second one took five weeks because I gave myself five weeks. I now think the deadline is the instrument.\n[00:15:47] PRIYA: You have said before that home studios made everyone worse. Do you still think that?\n[00:16:02] SAM: I said it badly. What I meant is that infinite takes make you worse. You can play a fill forty times and pick the best one, and it will be technically perfect and completely dead. On a session you get three passes and the third one has a person in it.\n[00:22:30] PRIYA: What would you tell somebody setting up in a shed this year?\n[00:22:41] SAM: Buy one good microphone and stop reading about microphones. Then finish something badly. The finishing is the skill and nobody sells you a course in it, because you cannot photograph it.\n[00:29:05] PRIYA: You run a workshop now, is that right?\n[00:29:11] SAM: Twice a year, in Margate. Six people, four days. There is a link in the description, I never remember the address.\n[00:31:40] PRIYA: Last one. What are you working on?\n[00:31:48] SAM: A record of field recordings from the seafront with drums underneath. It is either the best idea I have had or a very expensive way to record seagulls.\n[00:33:02] PRIYA: Sam Okafor, thank you. His records are on the usual places and the workshop link is below.' },
      opts: { show: 'The Long Way Round', episode: '47 — Sam Okafor', guest: 'Sam Okafor, session drummer turned producer', social: 'x' }
    },
    tips: [
      'Chapters and quote times come from timestamps that are in your transcript. Upload the .srt or .vtt your transcription tool made and they are exact; paste a transcript without times and the tool says so rather than guessing.',
      'Quotations are copied, not improved. That matters when a guest reads their own show notes — a tidied quotation is a quotation they did not say, and it is the kind of thing that ends a relationship with a guest.',
      'Where someone says "the link is in the description", the tool records what it was and writes [link needed]. Search for that before you publish; it is usually the one link the episode is for.',
      'A 45-minute episode is about 7,000 words and reads in one run. An interview over about 90 minutes is better fed in halves — the chapters from each half join up because the times are real.',
      'The Markdown download drops into most podcast hosts as the episode description, chapter list and all.'
    ],
    faq: [
      { q: 'What if my transcript has no timestamps?', a: 'Then you get everything except chapters, and the notes say plainly that no times were found. The tool is told never to estimate one. Most transcription tools — including the automatic ones in the big editors — will export an .srt or a .vtt with times, and those are the files to use here.' },
      { q: 'Is my guest’s transcript stored?', a: 'No. The text goes to the model through our gateway to be read, the answer comes back to your browser, and neither is kept; only the fact of the call counts against your allowance. If part of the conversation was off the record, cut it out before you paste — that is the only guarantee worth having.' },
      { q: 'Can it identify who is speaking?', a: 'Only as well as your transcript does. If the transcript labels speakers, attribution is right; if it does not, the tool says whose line it could not identify instead of picking a name.' },
      { q: 'Will it write chapters for YouTube too?', a: 'The chapter list is in m:ss and starts at your transcript’s first time. YouTube needs its first chapter at 0:00 and three or more in total; if your transcript starts later than that, add the 0:00 line yourself.' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 5. Article writer                                                  */
  /* ------------------------------------------------------------------ */

  const ART_STRUCTURE = {
    explainer: 'an explainer: the thing itself, in order, from what a reader already knows to what they do not',
    opinion: 'an opinion piece: a claim made in the first paragraph, argued with reasons, with the strongest objection answered rather than avoided',
    interview: 'an interview write-up: the subject’s words carry it, quoted from the brief only, with the writer setting each quotation in place',
    howto: 'a how-to: numbered steps that a reader can follow while reading, each complete, with what goes wrong at each one',
    review: 'a review: what it is, who it is for, how it was used, what is good, what is not, and a verdict that commits'
  };
  const ART_STRUCTURE_LABELS = [
    { value: 'explainer', label: 'Explainer' }, { value: 'opinion', label: 'Opinion' }, { value: 'interview', label: 'Interview write-up' },
    { value: 'howto', label: 'How-to' }, { value: 'review', label: 'Review' }
  ];
  const ART_LENGTH = { '800': 'about 800 words', '1200': 'about 1,200 words', '1800': 'about 1,800 words', '2500': 'about 2,500 words' };
  const ART_TONE = { plain: 'plain and direct', literary: 'considered and literary, without ornament for its own sake', conversational: 'conversational, as if talking to one reader', authoritative: 'authoritative and measured' };

  window.AI_TOOLS['article-writer'] = {
    title: 'Long-Form Article Writer',
    short: 'Article Writer',
    description: 'A brief in, a full article out — a standfirst, sections that go somewhere, and an ending that lands. Every claim it cannot support is marked [source needed] and no statistic is ever invented, because a wrong number in a published piece costs more than a gap does.',
    keywords: ['long form article writer', 'article generator ai', 'explainer article writer', 'opinion piece writer', 'how to article generator', 'interview write up', 'british english article writer'],
    glyph: 'i-ai-article',
    glyphSvg: '<symbol id="i-ai-article" viewBox="0 0 24 24">\n  <rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/>\n  <rect x="6.4" y="6.4" width="6" height="5" rx=".8" class="fill"/>\n  <path d="M14.2 7.2h3.4M14.2 10.4h3.4" class="thin"/>\n  <path d="M6.4 14.4h11.2M6.4 17.4h8" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Write article', resultTitle: 'Article',
    privacy: 'The brief you paste is sent to the model. An interview your subject has not approved, or a story under embargo, is worth keeping out of it until it is not.',
    inputs: [{ key: 'brief', label: 'The brief', type: 'text+file', accept: '.txt,.md', rows: 12, placeholder: 'What the piece is about and the point it makes; the facts, quotations and examples to use; the structure if you have one; what to avoid. For an interview write-up, paste the quotations you actually have.' }],
    options: [
      { key: 'audience', label: 'Who reads it', type: 'text', placeholder: 'e.g. people who run a small newsletter' },
      { key: 'length', label: 'Length', type: 'select', default: '1200', options: [{ value: '800', label: '800 words' }, { value: '1200', label: '1,200 words' }, { value: '1800', label: '1,800 words' }, { value: '2500', label: '2,500 words' }] },
      { key: 'structure', label: 'Kind of piece', type: 'select', default: 'explainer', options: ART_STRUCTURE_LABELS },
      { key: 'tone', label: 'Voice', type: 'select', default: 'plain', options: [{ value: 'plain', label: 'Plain and direct' }, { value: 'conversational', label: 'Conversational' }, { value: 'literary', label: 'Considered, literary' }, { value: 'authoritative', label: 'Authoritative, measured' }] },
      { key: 'byline', label: 'Written for', type: 'text', placeholder: 'publication or byline, optional' }
    ],
    system: (o) => 'You write long-form articles in a ' + (ART_TONE[o.tone] || ART_TONE.plain) + ' voice, with British spelling, for ' + (o.audience || 'a general but attentive readership') + (o.byline ? ', for ' + o.byline : '') + '. This piece is ' + (ART_STRUCTURE[o.structure] || ART_STRUCTURE.explainer) + '. Rules. The first two sentences say what the piece is about and why it is worth reading; no scene-setting about the modern world, no rhetorical question, no "in an age of". Use only the facts, quotations and examples in the brief, plus general knowledge a careful editor would let through unsourced. Never invent a statistic, a study, a survey, a date, a price, a threshold, a name or a quotation. Where a claim needs a figure or a source you have not been given, make the claim smaller and write [source needed] immediately after it; where the brief itself marks something to check, keep its marker. Quotations appear only if the brief contains them, word for word. Paragraphs are short; no bulleted list runs past five items; every section heading earns its section. The ending is an ending, not a summary of the introduction: it says what the reader should now think or do. Output the article only — a "# " title line, then a one-sentence standfirst in italics, then the piece with "## " headings — with no preamble, no word count, and no note to the editor.',
    prompt: (i, o) => 'Write ' + (ART_LENGTH[o.length] || ART_LENGTH['1200']) + ' as ' + (ART_STRUCTURE[o.structure] || ART_STRUCTURE.explainer) + '. Use four to eight "## " sections for a piece this long, each with a heading that says what is in it rather than teasing it.\n\nBRIEF:\n' + i.brief,
    output: 'text', maxTokens: 6000,
    sample: {
      inputs: { brief: 'Piece: why creators should own an email list before they chase another thousand subscribers on a platform.\nThe point: reach you rent can be taken away without notice and without appeal; reach you own cannot.\nUse: the recurring pattern where a platform changes its recommendation system and a creator’s views fall overnight with no explanation and no one to appeal to; the fact that an email list moves with you between platforms; that open rates decay when you only email when you want something; that a list of 800 people who asked to hear from you outperforms a following of 80,000 who did not, for anything you actually sell [source needed for any specific figure].\nAlso cover: what to put in the first email so people remember signing up; why a weekly rhythm beats a perfect monthly one; the single sign-up point that works (one link, one promise, in every video description); and the honest cost — it is another thing to write every week, and it is the thing you will resent when you are tired.\nAvoid: scaring people about any named platform, and any claim about a specific algorithm change I cannot cite.\nFor: creators with a small audience and no list, who have heard this advice and not acted on it.' },
      opts: { audience: 'creators with a small audience and no mailing list', length: '1200', structure: 'opinion', tone: 'plain', byline: 'Making It Weekly' }
    },
    tips: [
      'Search for "[source needed]" before you publish. Each one is a sentence the model would not stand behind; give it the figure, or cut the claim to what you can show.',
      'It will not invent a quotation. For an interview write-up, paste the quotations you actually have into the brief and it builds the piece around them; give it none and it writes around the gap rather than filling it with something plausible.',
      'A brief is "why X, for Y, because Z" plus the facts. A topic is "write about newsletters", and the article will be exactly as vague as that.',
      'Two thousand five hundred words is the longest single run. A 5,000-word feature is two pieces or two passes — and the second pass writes better with the first pasted in.',
      'The ending is written as an ending. If it reads like the introduction again, the brief probably did not say what the reader should do differently.'
    ],
    faq: [
      { q: 'Why will it not give me statistics?', a: 'Because it would be producing plausible numbers rather than true ones, and a fabricated figure in a published article is the kind of mistake that follows a byline around. Where you have the number, put it in the brief; where you do not, the marker tells you exactly which sentence needs an afternoon in a source.' },
      { q: 'Is this publishable as it stands?', a: 'It is a good first draft that took a minute. It will be structurally sound, correctly spelt and free of invented facts. It will not have your judgement, your best sentence, or the anecdote that makes the piece — those are what you add. Run the result through the Story Editor if you want a second read.' },
      { q: 'Can it write in another language?', a: 'Say so in the brief — "write this in Hindi" — and it will; the structure and length options still apply, though the spelling rules are written for English.' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 6. Story editor                                                    */
  /* ------------------------------------------------------------------ */

  const EDIT_KINDS = [
    { value: 'story', label: 'Short story' }, { value: 'chapter', label: 'Novel chapter' }, { value: 'essay', label: 'Personal essay' },
    { value: 'post', label: 'Blog post or article' }, { value: 'scene', label: 'Screenplay scene' }, { value: 'newsletter', label: 'Newsletter issue' }
  ];
  const EDIT_FOCUS = {
    all: 'everything: structure, pacing, line by line',
    structure: 'structure and pacing above all — where the piece starts, what it withholds, where it sags',
    line: 'the lines themselves — rhythm, precision, the words doing too much work and too little',
    dialogue: 'dialogue — who talks like themselves, what is said that should be withheld, what is explained that should be played'
  };

  window.AI_TOOLS['story-editor'] = {
    title: 'Story & Draft Editor (an edit, not a rewrite)',
    short: 'Story Editor',
    description: 'Paste your own draft and get an editor’s read: what is working and where, what is not, line-level suggestions as your line and a proposed change side by side, pacing notes, and the three things to fix first. It does not rewrite you, and it will not hand back a smoothed-out version of your voice.',
    keywords: ['story editor ai', 'manuscript feedback ai', 'developmental edit', 'line editing suggestions', 'novel chapter critique', 'writing feedback tool', 'essay editor ai'],
    glyph: 'i-ai-storyedit',
    glyphSvg: '<symbol id="i-ai-storyedit" viewBox="0 0 24 24">\n  <path d="M5 4.5h9.5L19 9v10.5H5z"/>\n  <path d="M14.5 4.5V9H19" class="thin"/>\n  <path d="M7.5 12.5h9M7.5 16.5h5.5" class="thin"/>\n  <path d="M10.6 12.5l1.7-2.7 1.7 2.7" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Edit it', resultTitle: 'Edit notes',
    privacy: 'Your draft is sent to the model to be read. It is not stored by us and Anthropic’s API terms do not use it to train models — but it is unpublished work leaving your device, and that is your decision to make each time.',
    inputs: [{ key: 'draft', label: 'Your draft', type: 'text+file', accept: '.txt,.md,.pdf', rows: 16, placeholder: 'Paste the piece, or choose the file. Up to about 8,000 words a run — a chapter, a story, an essay. Give it the version you are stuck on, not the one you have tidied.' }],
    options: [
      { key: 'kind', label: 'What it is', type: 'select', default: 'story', options: EDIT_KINDS },
      { key: 'stage', label: 'Stage', type: 'select', default: 'first', options: [{ value: 'first', label: 'First draft — be structural' }, { value: 'third', label: 'Third draft — structure is settled' }, { value: 'final', label: 'Nearly final — line level only' }] },
      { key: 'focus', label: 'Look hardest at', type: 'select', default: 'all', options: [{ value: 'all', label: 'Everything' }, { value: 'structure', label: 'Structure and pacing' }, { value: 'line', label: 'The lines themselves' }, { value: 'dialogue', label: 'Dialogue' }] },
      { key: 'register', label: 'How blunt', type: 'select', default: 'straight', options: [{ value: 'kind', label: 'Kind — encouraging, still honest' }, { value: 'straight', label: 'Straight — say it plainly' }, { value: 'hard', label: 'Hard — as a tough editor would' }] },
      { key: 'about', label: 'Anything I should know', type: 'text', placeholder: 'e.g. it is the opening of a novel; the ending is deliberate' }
    ],
    system: (o) => 'You are an editor reading someone’s draft of ' + ((EDIT_KINDS.find(k => k.value === o.kind) || EDIT_KINDS[0]).label.toLowerCase()) + ' at ' + ({ third: 'a third draft, where the structure is settled and the work is in the middle distance', final: 'a nearly final draft, where only line-level work is wanted' }[o.stage] || 'first-draft stage, where structural problems are still worth naming') + '. Look hardest at ' + (EDIT_FOCUS[o.focus] || EDIT_FOCUS.all) + '. Speak ' + ({ kind: 'kindly and encouragingly, without softening anything into uselessness', hard: 'as a tough editor would: bluntly, with no cushioning, but never cruelly and never about the author' }[o.register] || 'plainly and directly, as a trusted editor would to a working writer') + '. THE RULE THAT GOVERNS EVERYTHING ELSE: you are an editor, not a ghostwriter. You never rewrite the piece and you never return a rewritten version of it, in whole or in part, however much better you think yours would be. Every suggestion is local and paired: quote the author’s line exactly as they wrote it, then show the smallest change that fixes the specific problem, and say in one clause what the change does. Where a line is strange but deliberate — a rhythm, a repetition, a sentence fragment, a regionalism, an unfashionable word — leave it alone and name it under do_not_change. The author’s voice is not a defect to be normalised, and a note that makes the piece sound more like everybody else is a bad note. Point at the text: every observation names the line, the paragraph or the moment it is about. Do not invent content, characters, or facts about the author. Do not praise emptily; where something works, say what it is doing. British spelling in your notes, but never correct the author’s own spelling choices into British or American unless they are inconsistent with themselves. ' + JSON_ONLY,
    prompt: (i, o) => 'Read this draft and edit it.' + (o.about ? ' What the author wants you to know: ' + o.about + '.' : '') + ' Return JSON with exactly these keys: first_impression (2 to 3 sentences: what this piece is doing, said back to the author so they can see whether it is what they meant), what_is_working (array of 3 to 5 objects {what, where: a short phrase quoted from the draft, why}), what_is_not (array of 3 to 5 objects {what, where: a short phrase quoted from the draft, why}), line_edits (array of 4 to 12 objects {before: the author’s line quoted exactly, after: the smallest change that fixes it, why: one clause}: never a whole paragraph, never a rewrite for taste alone, and as many as the draft actually needs rather than a number to be reached — a clean draft gets four real notes, not twelve manufactured ones), pacing (array of 3 to 6 objects {where: the moment, point in the piece or quoted phrase, note: what the pace is doing there, suggestion}), voice (2 to 3 sentences naming what is distinctive about how this writer writes, so they know what to protect), do_not_change (array of 2 to 5 objects {what, why}: the things that look like errors and are not), fix_first (array of exactly 3 objects {fix, why_it_matters_most, how: a concrete first move}), questions_for_the_author (array of 2 to 4 questions only the author can answer).\n\nTHE DRAFT:\n' + i.draft,
    output: 'fields', maxTokens: 4000,
    downloads: textDownload('edit-notes.md', (d) => {
      const pair = (x) => '- **' + str(obj(x).what) + '** — ' + str(obj(x).why) + (obj(x).where ? '\n  > ' + str(obj(x).where) : '');
      return ['# Edit notes', '', str(d.first_impression), '', '## The three things to fix first', '']
        .concat(arr(d.fix_first).map((f, n) => (n + 1) + '. **' + str(obj(f).fix) + '** — ' + str(obj(f).why_it_matters_most) + '\n   _First move:_ ' + str(obj(f).how)),
          ['', '## What is working', ''], arr(d.what_is_working).map(pair),
          ['', '## What is not', ''], arr(d.what_is_not).map(pair),
          ['', '## Line by line', ''], arr(d.line_edits).map(e => '- ' + str(obj(e).why) + '\n  - was: ' + str(obj(e).before) + '\n  - try: ' + str(obj(e).after)),
          ['', '## Pacing', ''], arr(d.pacing).map(p => '- **' + str(obj(p).where) + '** — ' + str(obj(p).note) + (obj(p).suggestion ? ' _' + str(obj(p).suggestion) + '_' : '')),
          ['', '## Your voice', '', str(d.voice), '', '## Leave these alone', ''], arr(d.do_not_change).map(x => '- **' + str(obj(x).what) + '** — ' + str(obj(x).why)),
          ['', '## Questions only you can answer', ''], arr(d.questions_for_the_author).map(q => '- ' + str(q)), ['']).join('\n');
    }),
    sample: {
      inputs: { draft: 'The kettle had been on for twenty minutes before Ruth noticed she had not filled it. She stood in the doorway of her mother’s kitchen with the tea towel still folded over her arm, the way waiters do, and watched the element glow orange behind the plastic window.\n\nIt was the third day. On the first day there had been people, so many people, all of them holding plates they did not want. On the second day the house had emptied and the phone had rung eleven times. On the third day nobody rang at all and Ruth discovered that this was worse.\n\nShe unplugged the kettle and put her hand flat against its side, the way her mother had told her never to do. It was hot but it did not burn her. She kept her hand there anyway for a count of ten because she wanted, briefly and uselessly, for something to hurt in a place she could point at.\n\nThe fridge was full of other people’s food. Someone had labelled a lasagne with a date in blue biro, in handwriting Ruth did not recognise, and she stood looking at it for a long time. It occurred to her that she would have to eat all of this, or throw all of this away, and that both of these were unbearable, and that she would have to do one of them anyway, probably today, probably before the light went.\n\nShe boiled the empty kettle again. Then she filled it, and boiled it properly, and made a cup of tea she did not drink, and carried it into the front room where her mother’s chair was, and she put it down on the little table beside the chair where her mother would have wanted it, and then she sat on the floor with her back against the sofa and waited for the tea to go cold, which it did, in the way that tea does, without anyone watching.' },
      opts: { kind: 'story', stage: 'third', focus: 'all', register: 'straight', about: 'The opening of a short story. The long final sentence is deliberate — I want the rhythm to run out with her.' }
    },
    tips: [
      'It is an edit, not a rewrite. Every suggestion is your own line quoted back with the smallest change that fixes one thing — never a smoothed-over version of your paragraph, and never a new draft you have to argue with.',
      'The "leave these alone" list is the one to read first. It names the things that look like mistakes and are not — the fragment, the repetition, the unfashionable word — so that nothing in the notes talks you out of your own voice.',
      'Tell it what is deliberate in the "anything I should know" box. An editor who does not know the ending is meant to be flat will spend three notes trying to fix it.',
      'Change the stage and the notes change with it. A first draft gets structural notes; a nearly final one gets the lines, because by then the structure is not the question.',
      'The three things to fix first are ranked on purpose. Everything else is a list; that is a plan.'
    ],
    faq: [
      { q: 'Will it rewrite my work?', a: 'No, and it is told so in the strongest terms in its instructions: it is an editor, not a ghostwriter, it never returns a rewritten version of the piece, and its line suggestions are the smallest change that fixes one specific problem. If a suggestion ever reads as "here is how I would have written it", that is the suggestion to ignore — and it is the failure the tool is built to avoid.' },
      { q: 'Does it understand what I am doing stylistically?', a: 'Partly. It is good at noticing rhythm, repetition and register, and it is told to protect them rather than normalise them. It is not good at knowing what your book is for. Use the "anything I should know" box and the questions it asks you at the end; those are the places where it admits what it cannot see.' },
      { q: 'Is my unpublished work safe?', a: 'The draft goes to the model through our gateway to be read, and comes straight back. We store neither the draft nor the notes, and Anthropic’s API terms do not use API content to train models. That is the honest position: it left your device, it was read, nothing was kept. Whether that is acceptable for a manuscript under submission is a judgement only you can make.' },
      { q: 'How long a piece can it read?', a: 'About 8,000 words a run, which is a chapter or a long story. A whole novel is not a job for one pass; edit it a chapter at a time, and the notes stay specific instead of becoming generalities.' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 7. Newsletter writer                                               */
  /* ------------------------------------------------------------------ */

  const NEWS_LENGTH = { short: 'short — about 300 words, read in a minute', medium: 'medium — about 600 words', long: 'long — about 1,000 words, a proper read' };
  const NEWS_VOICE = { plain: 'plain and direct', warm: 'warm, like writing to one person you know', wry: 'wry and light', expert: 'expert and measured' };
  const SUBJ_MAX = 55, PREVIEW_MAX = 90;
  const countSubjects = (d) => {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return d;
    arr(d.subject_lines).forEach(s => {
      if (!s || typeof s !== 'object') return;
      s.subject_characters = chars(s.subject);
      s.preview_characters = chars(s.preview_text);
      s.over = s.subject_characters > SUBJ_MAX ? 'subject OVER ' + SUBJ_MAX + ' by ' + (s.subject_characters - SUBJ_MAX) : s.preview_characters > PREVIEW_MAX ? 'preview OVER ' + PREVIEW_MAX + ' by ' + (s.preview_characters - PREVIEW_MAX) : null;
    });
    return d;
  };

  window.AI_TOOLS['newsletter-writer'] = {
    title: 'Newsletter Issue Writer',
    short: 'Newsletter Writer',
    description: 'Your notes for this week in; a finished issue out — five subject lines with preview text and their lengths counted here, an opening that is not "hope you’re well", the body in sections, one thing to click, and a sign-off that sounds like a person.',
    keywords: ['newsletter writer ai', 'email newsletter generator', 'substack issue writer', 'newsletter subject line generator', 'weekly newsletter template', 'creator newsletter writing'],
    glyph: 'i-ai-newsletter',
    glyphSvg: '<symbol id="i-ai-newsletter" viewBox="0 0 24 24">\n  <path d="M3.5 5.5h13.5v13H5a1.5 1.5 0 0 1-1.5-1.5z"/>\n  <path d="M17 9h3.5v8a1.5 1.5 0 0 1-3.5 0" class="thin"/>\n  <path d="M6 8.5h8.5M6 11.5h8.5M6 14.5h5" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Write the issue', resultTitle: 'Issue written',
    privacy: 'The notes you type are sent to the model. Never paste your subscriber list: the issue is written once, for everyone on it, and the list is not needed to write it.',
    inputs: [{ key: 'notes', label: 'Notes for this issue', type: 'text+file', accept: '.txt,.md', rows: 10, placeholder: 'What happened, what you made, what you read, what you want to say, the links to include, anything to leave out. Rough notes are exactly right — this is the tool for turning them into an issue.' }],
    options: [
      { key: 'name', label: 'Newsletter', type: 'text', placeholder: 'e.g. Making It Weekly' },
      { key: 'audience', label: 'Who reads it', type: 'text', placeholder: 'e.g. people making things on the side' },
      { key: 'voice', label: 'Voice', type: 'select', default: 'warm', options: [{ value: 'plain', label: 'Plain and direct' }, { value: 'warm', label: 'Warm, like one person to another' }, { value: 'wry', label: 'Wry and light' }, { value: 'expert', label: 'Expert, measured' }] },
      { key: 'length', label: 'Length', type: 'select', default: 'medium', options: [{ value: 'short', label: 'Short — about 300 words' }, { value: 'medium', label: 'Medium — about 600 words' }, { value: 'long', label: 'Long — about 1,000 words' }] },
      { key: 'from', label: 'Signed', type: 'text', placeholder: 'how you sign off' }
    ],
    system: (o) => 'You write a creator’s newsletter issue' + (o.name ? ' called ' + o.name : '') + ' in a ' + (NEWS_VOICE[o.voice] || NEWS_VOICE.warm) + ' voice, for ' + (o.audience || 'the people who subscribed to it') + '. British spelling. Rules. The subject line says what is actually in the issue: at most ' + SUBJ_MAX + ' characters, no clickbait, no false urgency, no ALL CAPS, no "Re:" trick, no emoji unless the notes use them. Preview text adds to the subject instead of repeating it, at most ' + PREVIEW_MAX + ' characters. These openings are banned outright and none may appear in any form: "hope you are well", "hope this finds you well", "happy Monday", "in this week’s issue", "it has been a while", and any apology for not having written sooner — open on the most interesting thing in the notes instead, in the first sentence. Use only what the notes contain: never invent a link, a number, a book you did not read, a milestone, a sponsor or a reader’s message. Anything missing goes in square brackets as a placeholder, such as [link] or [date], and is listed at the end. Short paragraphs; a section heading only where the issue genuinely changes subject; one main thing to click, not five. The sign-off is a human being writing, not a brand. ' + JSON_ONLY,
    prompt: (i, o) => 'Write this week’s issue, ' + (NEWS_LENGTH[o.length] || NEWS_LENGTH.medium) + '.' + (o.from ? ' Signed: ' + o.from + '.' : '') + ' Return JSON with exactly these keys: subject_lines (array of exactly 5 objects {subject, preview_text, angle}: each a different angle on the same issue — the plain one, the specific detail, the question, the one that names the reader, the curious one that is still true), opening (2 to 4 sentences that open on the most interesting thing in the notes; none of the banned openings), sections (array of 2 to 5 objects {heading, body: the prose as one string with \\n\\n between paragraphs, link: the link from the notes if this section has one, otherwise null}), one_more_thing (a short closing item — a recommendation, an aside, something read — taken from the notes, or null if the notes have none), call_to_action (one sentence: the single thing to click or do, and where), sign_off (the closing line and the name), plain_text (the whole issue as one plain-text string with \\n line breaks: subject, blank line, opening, sections with their headings, the one more thing, the call to action, the sign-off. This is the version that gets pasted into the email tool, so every link and every square-bracket placeholder must appear in it, written out in full at the point it is referred to: "you can find it here" with no link beside it is a broken issue, and "[template link]" belongs on the page where the sentence points at it), missing (array of every placeholder you had to leave; empty if none).\n\nNOTES FOR THIS ISSUE:\n' + i.notes,
    output: 'fields', maxTokens: 4000, transform: countSubjects,
    downloads: (data) => textDownload('newsletter.txt', (d) => {
      const subs = arr(d.subject_lines).map((s, n) => '  ' + (n + 1) + '. ' + str(obj(s).subject) + '  (' + chars(obj(s).subject) + ' chars)' + (obj(s).over ? '  ** ' + str(obj(s).over) + ' **' : '') + '\n     preview: ' + str(obj(s).preview_text) + '  (' + chars(obj(s).preview_text) + ' chars)');
      return ['SUBJECT LINES'].concat(subs, ['', '----------------------------------------', ''], [str(d.plain_text) || [str(d.opening), ''].concat(arr(d.sections).map(s => str(obj(s).heading) + '\n\n' + str(obj(s).body) + (obj(s).link ? '\n' + str(obj(s).link) : ''))).concat([str(d.one_more_thing), str(d.call_to_action), str(d.sign_off)]).filter(Boolean).join('\n\n')],
        arr(d.missing).length ? ['', '----------------------------------------', '', 'STILL NEEDED'].concat(arr(d.missing).map(m => '  - ' + str(m))) : []).join('\n');
    })(countSubjects(data)),
    sample: {
      inputs: { notes: 'This week: I finally tried batch-filming and did six videos in about five hours. Used to take three days. The thing that actually worked was filming in wardrobe order rather than video order — obvious in hindsight, invisible before.\nAlso: the shot list on the wall. Four videos in I stopped checking it and immediately forgot a whole segment, so the list is not decoration.\nWhat went wrong: voice went after two hours. Next time I split it over two mornings.\nReader question from Marta: how do you decide what to film when nothing feels good enough? Answer: film the boring one. The boring one is usually the useful one, and the good idea will still be there next week.\nLink: the shot list template is at [template link].\nRead this week: an essay about deadlines being an instrument rather than a constraint — I do not have the link to hand, [link needed].\nNo sponsor this week. Next issue is the two-year anniversary one, which I am going to make embarrassing.' },
      opts: { name: 'Making It Weekly', audience: 'people making things on the side of a job', voice: 'warm', length: 'medium', from: 'Priya' }
    },
    tips: [
      'The subject and preview lengths are counted in your browser after the answer comes back. Fifty-five characters for the subject and ninety for the preview is what a phone inbox shows; anything over is flagged with how far over.',
      'Five subjects, one issue. Send the issue and split-test the subject if your tool does that; if it does not, pick the one that describes what is actually inside.',
      'The openings people hate are banned by name — "hope you’re well", "happy Monday", "in this week’s issue", and apologising for the gap. It opens on the most interesting thing in your notes instead, which is usually the right move anyway.',
      'Everything it did not know is in [square brackets] and listed under "missing". Search for "[" before you send.',
      'Rough notes work better than a tidy draft. A list of what happened, what went wrong and what you want to say is the ideal input; a half-written issue gets half-rewritten.'
    ],
    faq: [
      { q: 'Will it sound like me?', a: 'It will sound like a person, in the voice you chose, saying the things in your notes. It will not sound like you until you edit it — which takes ten minutes rather than the ninety the blank page takes. The Brand Voice Guide Builder, on the marketing side, will describe your voice from three issues you already like; feed that description into the notes and it gets closer.' },
      { q: 'Can it send the email?', a: 'No. Paste the plain-text version into Substack, Buttondown, Kit, Mailchimp or whatever you use, and let it do the formatting. The plain-text version exists because it is also what a text-only client and a spam filter see, and most people never make one.' },
      { q: 'Does it write a whole sequence?', a: 'Not here — this writes one issue from one week’s notes. The Email Campaign Writer does onboarding sequences and launches, which is a different job.' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 8. Content repurposer                                              */
  /* ------------------------------------------------------------------ */

  const SRC_KINDS = [
    { value: 'script', label: 'Video script' }, { value: 'transcript', label: 'Video or podcast transcript' }, { value: 'post', label: 'Blog post or article' },
    { value: 'newsletter', label: 'Newsletter issue' }, { value: 'talk', label: 'Talk or presentation' }, { value: 'thread', label: 'A thread or long post' }
  ];

  window.AI_TOOLS['content-repurposer'] = {
    title: 'Content Repurposer — One Piece, Six Formats',
    short: 'Content Repurposer',
    description: 'One thing you already made goes in; the other formats come out — a blog outline, a thread, three short-form scripts cut from the strongest moments, a newsletter blurb and five captions. Nothing new is invented: repurposing is re-cutting, not re-researching.',
    keywords: ['repurpose content ai', 'video to blog post', 'turn video into shorts', 'podcast to thread', 'content atomisation tool', 'repurpose youtube video', 'one piece of content many formats'],
    glyph: 'i-ai-repurpose',
    glyphSvg: '<symbol id="i-ai-repurpose" viewBox="0 0 24 24">\n  <rect x="2.8" y="8.5" width="7" height="7" rx="1.2"/>\n  <rect x="15.6" y="3.4" width="5.6" height="5" rx="1" class="thin"/>\n  <rect x="15.6" y="9.5" width="5.6" height="5" rx="1" class="thin"/>\n  <rect x="15.6" y="15.6" width="5.6" height="5" rx="1" class="thin"/>\n  <path d="M12.4 12h3.2M12.4 12V5.9h3.2M12.4 12v6.1h3.2M9.8 12h2.6" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Repurpose it', resultTitle: 'The other formats',
    privacy: 'The piece you paste is sent to the model. It is work you have already published, or are about to; if it is under embargo, wait.',
    inputs: [{ key: 'source', label: 'The piece you already made', type: 'text+file', accept: '.txt,.md,.srt,.vtt,.pdf', rows: 14, placeholder: 'Paste the script, transcript, post or newsletter — or choose the file. A transcript with timestamps is best: the short-form cuts come back with the time they start.' }],
    options: [
      { key: 'kind', label: 'What it is', type: 'select', default: 'script', options: SRC_KINDS },
      { key: 'audience', label: 'Who it is for', type: 'text', placeholder: 'e.g. creators with a day job' },
      { key: 'brand', label: 'Name or handle', type: 'text', placeholder: 'optional' },
      { key: 'thread', label: 'The thread is for', type: 'select', default: 'x', options: [{ value: 'x', label: 'X — short posts, no hashtags' }, { value: 'linkedin', label: 'LinkedIn — a single long post in parts' }, { value: 'threads', label: 'Threads / Bluesky' }] }
    ],
    system: (o) => 'You re-cut one piece of content into the formats it can also live in, for ' + (o.audience || 'the audience it was made for') + (o.brand ? ', for ' + o.brand : '') + '. The source is the only material. Never add a fact, a figure, a story, an example, a name or a claim that is not in it: repurposing is re-cutting, not re-researching. Where a format wants something the source does not contain, leave a placeholder in square brackets and list it. Each format obeys its own shape. A blog outline is a plan, not prose. ' + ({ linkedin: 'The thread is one LinkedIn post written in short parts separated by line breaks, the first line standing alone above the "see more" fold, and at most three hashtags at the end.', threads: 'The thread is for Threads or Bluesky: short posts, plain language, no hashtags.' }[o.thread] || 'The thread is for X: each post under 260 characters, the first post able to stand alone, no hashtags, no "a thread 🧵" announcement, and the last post saying where to find the full thing.') + ' A short-form script is 30 to 45 seconds of spoken words — 75 to 110 words — cut from a single moment in the source that is already interesting, not a summary of the whole. Captions are for a still image or a clip and do not repeat each other. British spelling. ' + JSON_ONLY,
    prompt: (i, o) => 'Re-cut this ' + ((SRC_KINDS.find(k => k.value === o.kind) || SRC_KINDS[0]).label.toLowerCase()) + ' into the other formats. Return JSON with exactly these keys: blog_outline (object {title, angle: one sentence on what the written version is for that the original was not, h2_outline: array of 5 to 8 headings each followed by a short note in brackets on what the section covers, word_target: an integer}), thread (array of 6 to 10 objects {number, post}), short_form_scripts (array of exactly 3 objects {title, from: where in the source this moment is — the timestamp if the source has one, otherwise the line it starts at, hook: the first sentence, script: 75 to 110 words of spoken words, on_screen_text: the words that appear on screen, why_this_moment: why this part travels on its own}), newsletter_blurb (120 to 200 words that could carry the piece to a mailing list, ending in one link or [link]), captions (array of exactly 5 objects {platform, caption, hashtags: array}), what_was_left_out (array of 2 to 5 things in the source that do not travel to any of these formats, and why), check_before_posting (array of any claim, figure or name carried over from the source that is worth verifying before it is repeated in five more places; empty if none).\n\nTHE SOURCE:\n' + i.source,
    output: 'fields', maxTokens: 5000,
    downloads: textDownload('repurposed.md', (d) => {
      const b = obj(d.blog_outline);
      return ['# Repurposed', '', '## Blog outline', '', '**' + str(b.title) + '**', '', str(b.angle), '', 'Target: ' + str(b.word_target) + ' words', '']
        .concat(arr(b.h2_outline).map(h => '- ' + str(h)),
          ['', '## Thread', ''], arr(d.thread).map(t => (obj(t).number || '') + '. ' + str(obj(t).post)),
          ['', '## Short-form scripts', ''], arr(d.short_form_scripts).reduce((a, s) => a.concat(['### ' + str(obj(s).title) + (obj(s).from ? '  (' + str(obj(s).from) + ')' : ''), '', '**Hook:** ' + str(obj(s).hook), '', str(obj(s).script), '', '_On screen:_ ' + str(obj(s).on_screen_text), '', '_Why this moment:_ ' + str(obj(s).why_this_moment), '']), []),
          ['## Newsletter blurb', '', str(d.newsletter_blurb), '', '## Captions', ''],
          arr(d.captions).map(c => '- **' + str(obj(c).platform) + '** — ' + str(obj(c).caption) + (arr(obj(c).hashtags).length ? '\n  ' + arr(obj(c).hashtags).map(h => '#' + str(h).replace(/^#/, '')).join(' ') : '')),
          ['', '## What does not travel', ''], arr(d.what_was_left_out).map(x => '- ' + str(x)),
          arr(d.check_before_posting).length ? ['', '## Check before posting', ''].concat(arr(d.check_before_posting).map(x => '- ' + str(x))) : [], ['']).join('\n');
    }),
    sample: {
      inputs: { source: '[0:00] I used to spend three days a week filming. Not editing — filming. Three days, for one video, and I could not work out where the time was going until I wrote it down.\n[0:42] Here is what I found. The filming itself took about forty minutes. Everything else was setup: lights, camera, changing my shirt, finding the thing I was going to hold up to the lens, deciding what to say while the camera was already running. The setup is the expensive part. The filming is nearly free.\n[1:55] So on a Sunday I sit down for one hour with no camera anywhere near me and I decide all six videos. Titles, the one point each of them makes, and the single object I am holding in each. One hour. If I skip it, I lose the whole Monday.\n[3:10] Then one lighting setup. One. A key light at forty-five degrees, a bounce card on the other side, and the window blacked out so the weather cannot join in. That setup covers a talking head, a tutorial over the desk and a piece to camera standing up, because I move, not the lights.\n[4:35] A shot list goes on the wall. Paper, not a phone. Four videos in I stopped checking mine and forgot an entire segment of video three, so now the list is laminated and it is the only thing in the room I am allowed to touch with dirty hands.\n[5:40] And here is the one that actually saved the time. I film in wardrobe order, not video order. Every shot in the blue shirt, then every shot in the jumper. It looks insane on the shot list and it turned three days into five hours, because changing clothes was costing me twenty minutes a change and I was doing it six times.\n[6:30] Name the files while the camera is still warm. Video three, take two, jumper. If you leave it to the edit you are watching six hours of yourself to find out which one was which, and that is the worst hour of the week.\n[7:20] What still goes wrong: my voice goes after two hours and you can hear it. Batteries die during the best take, always, so the spare is charged and on the table. And I still want to write the script while the camera is running, which is the most expensive way to write anything.\n[7:50] Try one thing this week. Do the Sunday hour. Not the batching — just the hour where you decide, before you touch a camera. Tell me what your longest part is; I read all of them.' },
      opts: { kind: 'script', audience: 'solo creators with a day job and fewer than 50,000 subscribers', brand: 'Making It Weekly', thread: 'x' }
    },
    tips: [
      'A transcript with timestamps gives you the best result: each short-form script comes back with the time it starts, so the cuts are already located in the footage.',
      'Nothing new is added. If a caption needs a number the source does not have, it comes back in square brackets — because the fastest way to spread a mistake is to repurpose it into five places.',
      'Read "what does not travel" before you post the rest. It is usually the part that made the original worth making, and knowing it does not survive the cut is the difference between repurposing and diluting.',
      'The three short-form scripts are cut from single moments, not summaries of the whole. A Short that tries to be the whole video in forty seconds is why most of them do not work.',
      'The blog outline is a plan, not prose. Paste it into the Long-Form Article Writer as the brief and the written version keeps the same spine.'
    ],
    faq: [
      { q: 'Is posting the same thing everywhere a good idea?', a: 'Posting the same file everywhere is not; re-cutting the same idea for each place is how most people publish. Each format here is written to its own shape rather than reformatted — the thread is not the blog post with line breaks, and the captions do not repeat each other.' },
      { q: 'Will it give me the video clips?', a: 'No — it gives you the words and the moment they come from. Everything here is text; the cutting happens in your editor. Where the source has timestamps, each short-form script carries the time it starts, which is what you need to find it.' },
      { q: 'Can I go the other way, from a post to a video?', a: 'Yes. Choose "Blog post or article" as what it is and the three short-form scripts and the thread come from the post. For a full video script from scratch, the YouTube & Vlog Script Writer starts from a brief instead.' }
    ]
  };
})();
