'use strict';
/**
 * Template builders for the live tools (/live/): Live Poll, Live Word Cloud, Audience Q&A, Live Rating Scale and
 * Live Presentation, and their landing pages.
 *
 * templates.js builds most posts around "it runs in your browser and nothing is uploaded". That is true of a PDF
 * tool or a game and FALSE here: once a session starts, the question and the answers pass through our server to
 * reach the presenter's screen. So templates.js hands every live record to these builders instead (same return
 * shape as B[...] there). What they say is limited to what the pages say and build/tests/claims/live.js checks:
 * no app for the audience, one 6-digit code at 1234tools.com/join, a nickname, results live on the big screen, free,
 * no accounts, the launch-trial phone limit, and the approved privacy wording. lint.js (rule live-claim) refuses
 * any on-device, offline, no-upload or "private" claim in these posts, and test.js renders every template for every
 * live page to prove it.
 */

const PRIVACY = 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
const LIMIT = 'During the launch trial a free session takes up to 1,000 phones.';
const JOIN = 'The audience open 1234tools.com/join and type a 6-digit code: no app.';

/* What the host is doing, in a host's words. */
const TASK = [
  [/live-presentation|interactive-meeting/, 'present slides the audience answer on their phones'],
  [/quiz/, 'run a quiz on phones'],
  [/poll/, 'run a live poll'],
  [/word-cloud/, 'run a live word cloud'],
  [/wedding/, 'take guest questions at a wedding'],
  [/qa/, 'take questions from the audience'],
  [/understanding/, 'check understanding in class'],
  [/rat/, 'collect live ratings'],
];
function taskFor(rec) { const t = TASK.find((x) => x[0].test(rec.path)); return t ? t[1] : 'ask a room a question'; }

/* Who it is for, and what goes wrong without it (true to the pages). */
const WHO = [
  [/quiz-night/, ['quiz-night hosts', 'a quiz night needs scores, a leaderboard and someone to add them up']],
  [/classroom|class/, ['teachers', 'a class check, an exit ticket or a quiz Friday needs a show of hands that counts everyone']],
  [/wedding/, ['wedding hosts', 'guests have questions for the couple and no easy way to ask']],
  [/town-hall|meeting|team|rate-a-session/, ['team leads and trainers', 'a meeting hears the loud few and misses everyone else']],
];
function whoFor(rec) {
  const w = WHO.find((x) => x[0].test(rec.path));
  return w ? { name: w[1][0], pain: w[1][1] } : { name: 'teachers, trainers and team leads', pain: 'a show of hands hears the loud few and misses everyone else' };
}

module.exports = function build(H) {
  const { S, sent, cap, lc1, tidy, trunc, cp, count } = H;
  const B = {};
  const free = (C) => 'Free, no sign-up';
  const how = (C) => `Type the question, press Start a live session, and share the code. ${JOIN}`;
  const gaps = 'Everyone needs an internet connection, and the presenter keeps the page open for the session.';

  B['reddit-comment'] = (C) => {
    const r = C.rec;
    const opener = C.pick(0, [`Short version: ${lc1(C.D())}`, 'You can do this without anyone installing anything.', 'Two ways, depending on the room.']);
    const answer = C.q ? `[Your answer to "${trunc(C.q.title, 140)}"]` : (C.v % 3 === 0 ? '' : JOIN);
    const method = C.pick(1, ['By hand: a show of hands and a tally on the board.', 'The low-tech way is paper slips and a volunteer to count.', 'Without a tool, it is hands up and a guess.']);
    const p = C.PRIV(2);
    const tool = C.pick(2, [
      p ? `If you'd rather not, I made ${r.title} — ${p}.` : `If you'd rather not, I made ${r.title}.`,
      S(`I built a small page for exactly this: ${r.title}.`, sent(cap(p))),
      `Otherwise ${r.title} does it, and ${C.PRIVWHAT() || 'it is free'}.`,
    ]);
    const text = tidy(S(opener, answer, method) + '\n\n' + S(tool, 'Disclosure: I built this.') + '\n' + C.URL);
    return { main: 'text', parts: [{ key: 'text', label: 'Comment', text }] };
  };

  B['reddit-post'] = (C) => {
    const r = C.rec;
    const f = C.v % 4;
    const title = [
      `I made a free ${C.titleLc}: the audience answer on their phones, no app`,
      `${r.title}: ${r.io}, free, no sign-up`,
      `Tired of paying for a polling tool to ${C.task}, so I built ${r.title}`,
      `[Free tool] ${r.title} — ${trunc(r.description, 80)}`,
    ][f];
    const body = tidy([C.D(), S(`I kept needing to ${C.task} without asking people to install anything.`, how(C)), S(sent(PRIVACY)), `Known gaps: ${gaps}`, S(C.pick(3, ["What's missing?", 'Happy to take requests.', 'Tell me what broke.']), 'Disclosure: I built this.') + '\n' + C.URL].filter(Boolean).join('\n\n'));
    return { main: 'body', parts: [{ key: 'title', label: 'Title', text: tidy(title), limit: 300 }, { key: 'body', label: 'Body', text: body }] };
  };

  B['hn-show'] = (C) => {
    const r = C.rec;
    const clause = C.pick(0, [`${r.io}, no app for the audience`, trunc(r.description.replace(/[.]$/, ''), 45), `${C.task}, free`]);
    const head = `Show HN: ${r.title} – `;
    const room = 80 - cp(head).length;
    const title = room > 8 ? head + trunc(clause, room) : trunc(`Show HN: ${r.title}`, 80);
    const p = C.PRIV(2);
    const comment = tidy([C.D(), S(`I kept needing to ${C.task} without asking people to install anything.`, how(C)), S(sent(cap(p || PRIVACY))), `Known gaps: ${gaps}`, 'Curious what edge cases break it.'].join('\n\n'));
    return { main: 'comment', parts: [{ key: 'title', label: 'Title', text: title, limit: 80 }, { key: 'url', label: 'URL field', text: C.clean, limit: 2000 }, { key: 'comment', label: 'First comment', text: comment }] };
  };

  B['hn-comment'] = (C) => {
    const r = C.rec;
    const answer = C.q ? `[Your technical answer to "${trunc(C.q.title, 140)}"]` : S(C.oneLine, 'Without a tool: a show of hands.');
    const p = C.PRIV(0);
    const tool = C.pick(0, [p ? `I built ${r.title} for this; ${p}.` : `I built ${r.title} for this.`, `Shameless but relevant: ${r.title} does this, and the audience need no app.`, `I maintain ${r.title}: ${r.io}.`]);
    return { main: 'text', parts: [{ key: 'text', label: 'Comment', text: tidy(S(answer, tool, 'Disclosure: I built this.', C.URL)) }] };
  };

  B['ph-launch'] = (C) => {
    const r = C.rec;
    const tagline = C.pick(0, [`${r.io} — no app, no sign-up`, `${cap(C.task)}, free`, `Free ${C.secLc}: ${trunc(r.description, 40)}`]);
    const description = C.pick(1, [
      S(C.D(), sent(cap(C.FREE()))),
      S(`${r.title} does one job: ${r.io}.`, sent(cap(C.FREE()))),
      S(C.D(), `Part of 1234Tools, ${C.count} tools from a one-person shop in Reading, UK.`),
    ]);
    const comment = tidy(['Hi PH — I built this — ' + `I kept needing to ${C.task} without asking people to install anything.`, how(C) + ' ' + LIMIT, S(sent(PRIVACY)), `Known gaps: ${gaps}`, C.pick(3, ['What would make you use it twice?', 'Tell me the room that breaks it.', 'Requests welcome — I ship weekly.'])].join('\n\n'));
    return {
      main: 'comment',
      parts: [
        { key: 'name', label: 'Name', text: trunc(`${r.title} by 1234Tools`, 60), limit: 60 },
        { key: 'tagline', label: 'Tagline', text: trunc(tagline, 60), limit: 60 },
        { key: 'description', label: 'Description', text: trunc(description, 260), limit: 260 },
        { key: 'comment', label: 'Maker comment', text: comment },
        { key: 'caption1', label: 'Gallery caption 1', text: trunc(C.pick(4, [`${r.io}: the whole flow`, 'Type it, share the code, watch it fill', 'Phones in, results on the big screen']), 80), limit: 80 },
        { key: 'caption2', label: 'Gallery caption 2', text: trunc(C.pick(5, ['No app: the audience join with a code', 'One code, one vote or rating per phone', 'One code to join, no app']), 80), limit: 80 },
        { key: 'caption3', label: 'Gallery caption 3', text: trunc(C.pick(6, [`Part of ${H.sectionCount(r.section)} tools in ${r.sectionName}`, 'During the launch trial a free session takes up to 1,000 phones', 'You choose when results are revealed']), 80), limit: 80 },
        { key: 'topics', label: 'Topics', text: 'Productivity, Education, Meetings', limit: 200 },
        { key: 'url', label: 'Website URL', text: C.utm, limit: 2000 },
      ],
    };
  };

  B['x-post'] = (C) => {
    const r = C.rec;
    const angle = (C.venue && C.venue.angle) || C.opts.angle || 'no-signup';
    const hook = C.HOOK(angle, 0);
    const value = C.pick(1, [`${r.io}.`, trunc(C.D(), 90), `${r.title}, ${C.FREE()}.`]);
    const priv = C.flags.noPriv ? '' : C.PRIVSHORT(2);
    const mine = angle === 'result-first' ? ' (mine)' : '';
    const tag = !C.flags.noTags && C.opts.hashtag ? ' ' + C.opts.hashtag : '';
    if (C.linkMode() === 'comment') {
      const text = tidy(S(hook, value, priv) + tag);
      return { main: 'text', linkInReply: true, parts: [{ key: 'text', label: 'Post (no link)', text }, { key: 'reply', label: 'First reply', text: tidy(C.URL + ' (mine)'), limit: 280, countMode: 'x' }] };
    }
    return { main: 'text', parts: [{ key: 'text', label: 'Post', text: tidy(S(hook, value, priv, C.URL) + mine + tag) }] };
  };

  B['x-thread'] = (C) => {
    const r = C.rec;
    const hook = C.HOOK((C.venue && C.venue.angle) || C.opts.angle || 'no-signup', 0);
    const p1 = C.pick(0, [`${hook} A short thread.`, `${hook} 1/5`, `Thread: ${r.title}, and how the room joins.`]);
    const p2 = `The problem: ${C.aud0.pain}.`;
    const p3 = `${r.title}: ${r.io}. ${JOIN}`;
    const p4 = `${cap(C.FREE())}. ${LIMIT}`;
    const p5 = `Link, free, no sign-up: ${C.URL} (mine)`;
    return { main: 'p1', parts: [p1, p2, p3, p4, p5].map((t, i) => ({ key: 'p' + (i + 1), label: `Tweet ${i + 1}`, text: tidy(t), limit: 280, countMode: i === 4 ? 'x' : undefined })) };
  };

  B['linkedin-post'] = (C) => {
    const r = C.rec;
    const a = C.aud0;
    const hook = C.pick(0, [C.HOOK('cost', 0), `I built a free tool for ${a.name}.`, `Small tool, big difference in a meeting or a classroom: ${r.title}.`]);
    const story = C.pick(1, [`If you ${C.task}, you know the drill: ${a.pain}.`, `Built with ${a.name} in mind.`, 'Built it for my own sessions; sharing it.']);
    const what = S(`${r.title}: ${r.io}.`, JOIN, sent(cap(C.FREE())));
    const ask = C.pick(3, ['What would you want next to it?', `Which tool should I build for ${a.name} next?`, 'Forward it to the person who runs the next session.']);
    const tags = C.tags({ n: 3, tier: 'broad' }).join(' ');
    const body = tidy([hook, story, what, ask + ' Link in the first comment.', tags].filter(Boolean).join('\n\n'));
    return { main: 'body', parts: [{ key: 'body', label: 'Post (no link in the body)', text: body }, { key: 'comment', label: 'First comment', text: `${r.title}: ${C.URL}`, limit: 1250 }] };
  };

  B['facebook-group'] = (C) => {
    const r = C.rec;
    const greet = C.pick(0, ['Hi all,', 'Morning everyone —', 'Quick one for the group:']);
    const ctx = C.pick(1, [`in case a room full of phones comes up for anyone here.`, `for anyone who needs to ${C.task}.`, `for anyone who has a class, a meeting or a party to run.`]);
    const what = S(`${r.title}: ${r.io}.`, JOIN, sent(cap(C.FREE())));
    const mode = C.linkMode();
    const link = mode === 'inline' ? C.URL : mode === 'comment' ? 'Link in the comments.' : `Search "1234tools ${r.title}".`;
    const parts = [{ key: 'text', label: 'Post', text: tidy(S(greet, ctx, what, 'I run the site, so take that as read.', link)) }];
    if (mode === 'comment') parts.push({ key: 'comment', label: 'First comment', text: `${r.title}: ${C.URL}`, limit: 800 });
    return { main: 'text', parts };
  };

  B['pinterest-pin'] = (C) => {
    const r = C.rec;
    const title = C.pick(0, [`How to ${C.task}, free`, `${r.title} — free, no sign-up`, `${r.io}: no app for the audience`]);
    const desc = C.pick(1, [
      S(C.D(), sent(cap(C.FREE())), `Save this for the next time you need to ${C.task}.`),
      S(`${r.title}: ${C.kw(0)}, ${C.kw(1)}, ${C.kw(2)}.`, sent(cap(C.FREE()))),
      S(`A free ${C.secLc} page: ${lc1(C.D())}`),
    ]);
    const tags = C.tags({ n: 4, tier: 'niche', brand: 1 }).join(' ');
    const alt = C.pick(2, [`Dark 1234Tools card: "${r.title}", ${r.io}, with three badges and the web address`, `Dark card titled "${r.title}" with the line "${r.io}" and the 1234Tools logo`, `Pin for ${r.title} on 1234Tools: ${r.io}, in gold lettering on a dark card`]);
    return { main: 'description', parts: [
      { key: 'title', label: 'Pin title', text: trunc(tidy(title), 100), limit: 100 },
      { key: 'description', label: 'Description', text: tidy(S(desc, tags)) },
      { key: 'alt', label: 'Alt text', text: trunc(alt, 500), limit: 500 },
      { key: 'url', label: 'Destination link', text: C.utm, limit: 2000 },
    ] };
  };

  B['youtube-comment'] = (C) => {
    const r = C.rec;
    const value = C.q ? `[Your 1–3 sentence addition to the video]` : C.pick(0, ['Good walkthrough. One thing worth adding: let people join with the code on the screen, so they can see it worked.', `For anyone who got here searching ${C.kw(0)}: the audience need no app.`, 'A tip: say the code out loud once, and leave it on the screen.']);
    const tool = C.pick(1, [`If you want a free version, search "1234tools ${r.title}".`, `I keep a free one at 1234tools dot com (${r.title}).`, `There's a free option on 1234tools dot com under ${r.sectionName}.`]);
    return { main: 'text', parts: [{ key: 'text', label: 'Comment (no URL)', text: tidy(S(value, tool, 'I run that site, so biased.')) }] };
  };

  B['youtube-description'] = (C) => {
    const r = C.rec;
    const line1 = trunc(C.pick(0, [`${r.title} in 30 seconds: ${r.io}.`, `How to ${C.task} — ${r.title}.`, C.D()]), 100);
    const bullets = ['• ' + cap(C.FREE()), '• ' + JOIN, C.flags.noPriv ? '' : '• ' + PRIVACY].filter(Boolean).join('\n');
    const more = `More tools: https://www.1234tools.com/?utm_source=${encodeURIComponent(C.venueId)}&utm_medium=video`;
    const tags = C.tags({ n: 3, tier: 'niche' }).join(' ');
    return { main: 'text', parts: [{ key: 'text', label: 'Description', text: tidy([line1, C.utm, bullets, more, tags].filter(Boolean).join('\n\n')) }] };
  };

  B['quora-answer'] = (C) => {
    const r = C.rec;
    const open = C.pick(0, ['Yes — and nobody needs to install an app to take part.', C.oneLine, 'It depends on the room: how many people, and whether you want results shown at once.']);
    const expl = C.q ? `[Your explanation for "${trunc(C.q.title, 140)}": 2–4 short paragraphs]` : C.D();
    const tool = C.pick(1, [`If you'd rather not do it by hand, ${r.title} does exactly this; ${C.PRIVWHAT() || 'it is free'}.`, `The free option is ${r.title}.`, S(`I made ${r.title} for this: ${r.io}.`, sent(cap(C.FREE())))]);
    const text = tidy([open, expl, 'By hand: a show of hands, or slips of paper and a volunteer to count.', S(tool, '(I built this site, so take that into account.)') + '\n' + C.URL].filter(Boolean).join('\n\n'));
    return { main: 'text', parts: [{ key: 'text', label: 'Answer', text }] };
  };

  B['stackexchange-answer'] = (C) => {
    const r = C.rec;
    const answer = C.q ? `[Write the complete method for "${trunc(C.q.title, 140)}" here: steps that work without the link]` : '[Write the complete method here: the answer must stand on its own without the link]';
    const tool = C.pick(0, [`If you want a tool for it, ${r.title} does it for free.`, `For a no-install route, ${r.title}: the audience join with a code.`, `A free option: ${r.title} (${r.io}).`]);
    return { main: 'text', parts: [{ key: 'text', label: 'Answer', text: tidy([answer, 'Without any tool: a show of hands.', S(tool, "Disclosure: I'm the author of this tool.") + '\n' + C.URL].join('\n\n')) }] };
  };

  B['forum-reply'] = (C) => {
    const r = C.rec;
    const quote = C.q ? '> ' + trunc(C.q.title, 160) : '';
    const answer = C.q ? '[Your answer in 2–4 sentences]' : S(C.oneLine, 'If it is a one-off: a show of hands.');
    const tool = C.pick(0, [`There's also ${r.title}, free, and the audience need no app.`, `I built ${r.title} for this — ${r.io}.`, `Quickest no-install option I know is ${r.title}.`]);
    const link = C.linkMode() === 'none' ? 'Link in my signature.' : C.URL;
    return { main: 'text', parts: [{ key: 'text', label: 'Reply', text: tidy([quote, S(answer, tool, 'Disclosure: I built this.', link)].filter(Boolean).join('\n\n')) }] };
  };

  B['forum-post'] = (C) => {
    const r = C.rec;
    const title = C.pick(0, [`Free live tool: ${r.title} (${r.io})`, `Built a free ${C.secLc.toLowerCase()} page — feedback wanted`, `${r.title}: ${trunc(r.description, 50)}`]);
    const intro = C.pick(1, ['I run a small tools site and wanted to share one page.', 'Solo developer in Reading; I build small tools.', 'Hello — sharing something I made for my own sessions.']);
    const link = C.linkMode() === 'none' ? 'Link in my signature.' : C.URL;
    const body = tidy([intro, C.D(), S(`I kept needing to ${C.task} without asking people to install anything.`, how(C)), `Known gaps: ${gaps}`, S(C.pick(5, ["What's missing?", 'Happy to take requests.', 'Tell me what broke.']), 'Disclosure: I built this.') + '\n' + link].filter(Boolean).join('\n\n'));
    return { main: 'body', parts: [{ key: 'title', label: 'Thread title', text: trunc(tidy(title), 80), limit: 80 }, { key: 'body', label: 'Post', text: body }] };
  };

  B['devto-article'] = (C) => {
    const r = C.rec;
    const title = C.pick(0, [`How ${r.title} keeps phones and a big screen in step`, `${r.io}: what it takes`, `Running a live session without an app`]);
    const intro = C.pick(1, [S(C.D(), 'This is how a room of phones talks to one big screen.'), `I needed to ${C.task} without asking anyone to install anything. This is the write-up.`, `${r.title} is one of ${C.count} tools on 1234Tools. Here is how the live ones work.`]);
    const h2 = C.pick(2, [['The problem with apps in a room', 'One code, no app', 'What the server sees, and for how long'], ['Why a show of hands is not enough', 'Phones as the remote control', 'What it does not do yet'], ['The question people actually ask', 'Joining with a 6-digit code', 'Deleting the room']]);
    const cta = C.pick(3, [S(`Try it: ${C.URL}.`, sent(cap(C.FREE()))), `Live page: ${C.URL}. Tell me what breaks in the comments.`, `${C.URL} — and the next tool in the series is ${C.rel ? C.rel.title : 'coming soon'}.`]);
    const tags = C.flags.noTags ? [] : ['webdev', 'javascript', 'education', 'productivity'];
    const front = ['---', 'title: ' + trunc(title, 100), 'published: false', tags.length ? 'tags: ' + tags.join(', ') : '', '---'].filter(Boolean).join('\n');
    const body = tidy(front + '\n\n' + [intro, ...h2.map((h) => '## ' + h + '\n\n[Write this section]'), cta].join('\n\n'));
    return { main: 'body', parts: [{ key: 'title', label: 'Title', text: trunc(title, 100), limit: 100 }, { key: 'body', label: 'Markdown (front matter + outline)', text: body }] };
  };

  B['indiehackers-post'] = (C) => {
    const r = C.rec;
    const n = C.opts.n ? `Shipped tool #${C.opts.n}: ` : 'Shipped: ';
    const title = C.pick(0, [`${n}${r.title}. No app for the audience.`, `What a live-polling page taught me about classrooms and meetings`, `One person, ${C.count} tools: this week's page`]);
    const context = C.pick(1, ['I run 1234Tools solo from Reading, UK. The live tools are the first ones with a server in the middle.', `Solo, ${C.count} tools; the live ones pass answers through a server so phones can reach one screen.`, '1234Tools is a one-person project, and this is the newest section.']);
    const shipped = S(`What shipped: ${r.title} — ${lc1(C.D())}`, C.flags.noPriv ? '' : sent(PRIVACY));
    const happened = C.opts.metric ? sent(C.opts.metric) : (C.v % 2 === 0 ? "Too early for numbers; I'll report back in 30 days." : 'Search Console shows impressions but no clicks yet — that\'s normal for week one.');
    const body = tidy([context, shipped, happened, `Next: whatever the comments ask for in ${r.sectionName}.`, C.URL].join('\n\n'));
    return { main: 'body', parts: [{ key: 'title', label: 'Title', text: trunc(title, 150), limit: 150 }, { key: 'body', label: 'Post', text: body }] };
  };

  B['discord-message'] = (C) => {
    const r = C.rec;
    const ctx = C.q ? '[One line that answers the question]' : '';
    const tool = C.pick(0, [`${r.title} does that, free — I run the site so obviously biased.`, `I built a page for this: ${r.title}. (Mine, so biased.)`, `Free option: ${r.title} — mine.`]);
    return { main: 'text', parts: [{ key: 'text', label: 'Message', text: tidy(S(ctx, tool, sent(cap(JOIN))) + '\n' + C.URL) }] };
  };

  B['whatsapp-broadcast'] = (C) => {
    const r = C.rec;
    const greet = C.pick(0, ['Hi —', 'New on 1234Tools:', 'Quick update:']);
    const why = C.pick(1, [`Handy if you ${C.task}.`, `For anyone who needs to ${C.task}.`, sent(cap(JOIN))]);
    return { main: 'text', parts: [{ key: 'text', label: 'Broadcast', text: tidy(S(greet, `*${r.title}* — ${r.io}.`, why, C.URL) + "\nReply STOP and I'll take you off this list.") }] };
  };

  B['telegram-post'] = (C) => {
    const r = C.rec;
    const lead = C.pick(0, [`**${r.title}**`, `New: **${r.title}**`, `**${r.io}** — ${r.title}`]);
    const own = !C.venue || /channel|share-/.test(C.venue.id || '') || C.venue.kind === 'newsletter' || C.venue.kind === 'social';
    const tags = C.tags({ n: 3, tier: 'niche', lower: true }).join(' ');
    return { main: 'text', parts: [{ key: 'text', label: 'Post', text: tidy([lead, sent(C.D()), S(sent(cap(C.PRIV(0))), sent(cap(C.FREE()))), own ? '' : 'I run the site.', C.URL, tags].filter(Boolean).join('\n')) }] };
  };

  B['instagram-caption'] = (C) => {
    const r = C.rec;
    const hook = C.HOOK((C.venue && C.venue.angle) || 'no-signup', 0);
    const l2 = C.pick(1, [`${r.title}: ${r.io}.`, trunc(C.D(), 80), 'Free, no sign-up, no app for the audience.']);
    const l3 = C.pick(2, [`For ${C.aud0.name}.`, 'Save this for later.', 'One code, and the whole room joins.']);
    const tags = C.tags({ n: 4, tier: 'niche', brand: 2 }).join(' ');
    return { main: 'text', parts: [{ key: 'text', label: 'Caption', text: tidy([hook, l2, l3, 'Link in bio → 1234tools.com ✅', '', tags].filter((x, i) => x !== '' || i === 4).join('\n')) }] };
  };

  B['tiktok-caption'] = (C) => {
    const hook = C.HOOK('speed', 0);
    const clause = C.pick(1, ['Free, no sign-up.', 'No app for the audience.', 'One code to join.']);
    const shown = trunc(S(hook, clause, '1234tools.com'), 150);
    const tags = C.tags({ n: 4, tier: 'niche', lower: true }).join(' ');
    return { main: 'text', parts: [{ key: 'text', label: 'Caption', text: tidy(S(shown, tags)) }] };
  };

  const short = (C, valueMax) => {
    const r = C.rec;
    const hook = C.HOOK((C.venue && C.venue.angle) || C.opts.angle || 'no-signup', 0);
    const value = C.pick(1, [`${r.title}: ${r.io}.`, trunc(C.D(), valueMax), `${r.title}, ${C.FREE()}.`]);
    return { hook, value, priv: sent(cap(C.PRIV(2))) };
  };
  B['threads-post'] = (C) => { const x = short(C, 160); return { main: 'text', parts: [{ key: 'text', label: 'Post', text: tidy(S(x.hook, x.value, x.priv, C.URL) + ' (mine)') }] }; };
  B['bluesky-post'] = (C) => { const x = short(C, 110); return { main: 'text', parts: [{ key: 'text', label: 'Post', text: tidy(S(x.hook, x.value, x.priv, C.URL) + ' (mine)') }] }; };
  B['mastodon-post'] = (C) => {
    const x = short(C, 200);
    const tags = C.tags({ n: 3, tier: 'niche', brand: 1 }).join(' ');
    return { main: 'text', parts: [{ key: 'text', label: 'Post', text: tidy(S(x.hook, x.value, x.priv, C.URL) + ' (mine)' + (tags ? ' ' + tags : '')) }] };
  };

  B['newsletter-blurb'] = (C) => {
    const r = C.rec;
    const open = C.pick(0, [`**${r.title}** — ${C.D()}`, `New: **${r.title}**. ${r.io}.`, `For ${C.aud0.name}: **${r.title}**.`]);
    const middle = C.v % 3 === 0 ? S(sent(cap(C.PRIV(1))), `Built for ${C.aud0.name}.`) : S(C.D(), sent(cap(C.PRIV(1))));
    const close = C.pick(1, [`[Try it](${C.URL}).`, `[Open the tool](${C.URL}) — ${C.FREE()}.`, `[Have a look](${C.URL}).`]);
    let text = tidy(S(open, middle, close));
    if (count(text, 'words') < 40 && !/Built for/.test(text)) text = tidy(S(open, middle, `Built for ${C.aud0.name}.`, close));
    return { main: 'text', parts: [{ key: 'text', label: 'Blurb', text }] };
  };

  B['directory-listing'] = (C) => {
    const r = C.rec;
    const tagline = C.pick(0, [`${r.io} — no app, no sign-up`, `${cap(C.task)}, free`, `Free ${C.secLc}: ${trunc(r.description, 40)}`]);
    const shortFree = sent(cap(C.FREE()));
    const shortText = S(trunc(r.description, 160 - cp(shortFree).length - 1), shortFree);
    const long = S(C.D(), sent(cap(C.FREE())), sent(JOIN), LIMIT, C.flags.noPriv ? '' : sent(PRIVACY), `One of ${C.count} tools from MVR IT Services LTD, Reading, UK; analytics only after you accept the consent bar.`);
    const tags = r.keywords.slice(0, 6).map((k) => k.toLowerCase()).concat(['free', 'no-signup', 'no-app']).join(', ');
    return { main: 'long', parts: [
      { key: 'name', label: 'Name', text: trunc(`1234Tools — ${r.title}`, 100), limit: 100 },
      { key: 'tagline', label: 'Tagline', text: trunc(tagline, 60), limit: 60 },
      { key: 'short', label: 'Short description', text: shortText, limit: 160 },
      { key: 'long', label: 'Long description', text: long },
      { key: 'categories', label: 'Categories', text: 'Education, Productivity, Meetings', limit: 200 },
      { key: 'tags', label: 'Tags', text: tags, limit: 400 },
      { key: 'url', label: 'Link (UTM)', text: C.utm, limit: 2000 },
      { key: 'clean', label: 'Link (clean)', text: C.clean, limit: 2000 },
    ] };
  };

  B['email-outreach'] = (C) => {
    const r = C.rec;
    const first = C.opts.firstName || '[first name]';
    const their = C.opts.theirPageTitle || '[their page title]';
    const topic = C.opts.pageTopic || 'live polling and classroom tools';
    const subjects = [`A free ${C.kw(0)} tool for your ${topic} page`, `Small addition for "${their}"`, `${r.title} — free, no app for the audience (for your list)`];
    const body = tidy(`Hi ${first}, I'm Vishal from 1234Tools (MVR IT Services, Reading). Your "${their}" page lists ${topic}, and I think one is missing: ${r.title} — ${sent(lc1(C.D()))} Free, no sign-up. Link: ${C.clean}. If it doesn't fit, no reply needed — thanks for reading.`);
    const follow = `Hi ${first}, a quick nudge on the ${r.title} note from last week — happy to drop it if it's not a fit. Vishal, 1234Tools`;
    return { main: 'body', parts: [
      { key: 'subject1', label: 'Subject 1', text: trunc(subjects[0], 120), limit: 120 },
      { key: 'subject2', label: 'Subject 2', text: trunc(subjects[1], 120), limit: 120 },
      { key: 'subject3', label: 'Subject 3', text: trunc(subjects[2], 120), limit: 120 },
      { key: 'body', label: 'Body (≤ 90 words)', text: body },
      { key: 'followup', label: 'Follow-up after 7 days (≤ 50 words)', text: follow, limit: 50, countMode: 'words' },
    ] };
  };

  B['signature'] = (C) => {
    const r = C.rec;
    const l1 = `Vishal · 1234tools.com — ${C.countRounded} free tools, live polls and quizzes too`;
    const room = 120 - cp(l1).length - 1;
    return { main: 'text', parts: [{ key: 'text', label: 'Signature (2 lines)', text: l1 + '\n' + trunc(`${r.sectionName}: ${r.title}`, room) }] };
  };

  return { B, taskFor, whoFor, PRIVACY, LIMIT };
};
module.exports.taskFor = taskFor;
module.exports.whoFor = whoFor;
