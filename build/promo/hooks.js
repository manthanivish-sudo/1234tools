'use strict';
/**
 * Hook library (copy spec Part B section 4).
 *
 * Every hook carries the constraints that keep it true for the tool it opens:
 *   sections  only for tools in these sections (a PDF hook on a payroll tool is false)
 *   free      only for browser tools (pricing 'free'); AI for Business tools need an
 *             account and send text to a server, so no privacy/offline/no-signup hook
 *   result    needs a figure from the tool itself (opts.result). The desk never
 *             invents one: hooks 12, 21 and 25 contain figures and are only used
 *             as a pattern; the figure shown is always opts.result.
 * Hooks 31+ are additions so every verb, section and pricing has true options.
 */

const HOOKS = [
  { n: 1, text: 'Your PDFs never need to leave your laptop to be merged.', verb: 'Make', angle: 'privacy', sections: ['pdf'], free: true, kw: 'merge' },
  { n: 2, text: 'Three files, one PDF, zero uploads.', verb: 'Make', angle: 'speed', sections: ['pdf'], free: true, kw: 'merge|combine' },
  { n: 3, text: 'Stop paying monthly for a button.', verb: 'Make', angle: 'cost', free: true },
  { n: 4, text: 'Make it on the train with no signal.', verb: 'Make', angle: 'offline', free: true },
  { n: 5, text: 'No account. No email. Just the file.', verb: 'Make', angle: 'no-signup', free: true },
  { n: 6, text: "Here's the finished PDF — now watch how.", verb: 'Make', angle: 'result-first', sections: ['pdf'], free: true, video: true },
  { n: 7, text: 'Convert it without sending it anywhere.', verb: 'Convert', angle: 'privacy', free: true },
  { n: 8, text: 'Drop, convert, done before the kettle boils.', verb: 'Convert', angle: 'speed', free: true },
  { n: 9, text: 'The converter that costs exactly nothing.', verb: 'Convert', angle: 'cost', free: true },
  { n: 10, text: 'Works in airplane mode. Really.', verb: 'Convert', angle: 'offline', free: true },
  { n: 11, text: 'Convert first, sign up never.', verb: 'Convert', angle: 'no-signup', free: true },
  { n: 12, text: '2.4 MB → 310 KB. Same picture.', verb: 'Convert', angle: 'result-first', result: true },
  { n: 13, text: 'Check it before you send it, not after.', verb: 'Check', angle: 'speed' },
  { n: 14, text: "Nobody else sees what you're checking.", verb: 'Check', angle: 'privacy', free: true },
  { n: 15, text: 'The free check that saves a penalty.', verb: 'Check', angle: 'cost', free: true, sections: ['business', 'india', 'finance'] },
  { n: 16, text: 'Validate offline; the rules are in the page.', verb: 'Check', angle: 'offline', free: true },
  { n: 17, text: "No login to find out if it's valid.", verb: 'Check', angle: 'no-signup', free: true },
  { n: 18, text: 'Red means fix it. Green means send.', verb: 'Check', angle: 'result-first' },
  { n: 19, text: "Payslip maths shouldn't need a login.", verb: 'Calculate', angle: 'no-signup', free: true, sections: ['business', 'india'], kw: 'salary|pay|payroll|payslip|ctc|take-home|take home|wage|tax' },
  { n: 20, text: 'Your salary stays on your screen.', verb: 'Calculate', angle: 'privacy', free: true, sections: ['business', 'india'], kw: 'salary|pay|payroll|payslip|ctc|take-home|take home|wage' },
  { n: 21, text: '£48k in England is about £3,160 a month.', verb: 'Calculate', angle: 'result-first', result: true },
  { n: 22, text: 'Type one number. Read the whole breakdown.', verb: 'Calculate', angle: 'speed' },
  { n: 23, text: 'The calculator that never asks for your card.', verb: 'Calculate', angle: 'cost', free: true },
  { n: 24, text: "Still works when the office Wi-Fi doesn't.", verb: 'Calculate', angle: 'offline', free: true },
  { n: 25, text: '18% GST on ₹10,000: here\'s the split.', verb: 'Calculate', angle: 'result-first', result: true },
  { n: 26, text: 'Clean up the mess without uploading it.', verb: 'Clean up', angle: 'privacy', free: true },
  { n: 27, text: 'Paste. Click. Tidy.', verb: 'Clean up', angle: 'speed' },
  { n: 28, text: "Free, because tidying text shouldn't be a subscription.", verb: 'Clean up', angle: 'cost', free: true, sections: ['text', 'developer', 'utilities'] },
  { n: 29, text: 'Clean it offline; nobody reads your draft.', verb: 'Clean up', angle: 'offline', free: true },
  { n: 30, text: 'Before and after, on one screen.', verb: 'Clean up', angle: 'result-first' },
  // Additions: general hooks that hold for any tool of the verb.
  { n: 31, text: 'Made in your browser, not on somebody\'s server.', verb: 'Make', angle: 'privacy', free: true },
  { n: 32, text: 'From blank page to download in a minute.', verb: 'Make', angle: 'speed' },
  { n: 33, text: 'Check it without handing it over.', verb: 'Check', angle: 'privacy', free: true },
  { n: 34, text: 'A check that costs nothing and needs no login.', verb: 'Check', angle: 'cost', free: true },
  { n: 35, text: 'The sum, worked out on your own screen.', verb: 'Calculate', angle: 'privacy', free: true },
  { n: 36, text: 'Tidy it up without a subscription.', verb: 'Clean up', angle: 'cost', free: true },
  { n: 37, text: 'No account needed to tidy this up.', verb: 'Clean up', angle: 'no-signup', free: true },
  { n: 38, text: 'Your photos stay on your phone.', verb: '*', angle: 'privacy', free: true, sections: ['image', 'ai-image'] },
  { n: 39, text: 'Captions without uploading the video.', verb: '*', angle: 'privacy', free: true, sections: ['ai-video'] },
  // AI for Business: true for a freemium tool (account, 10 runs a month, text goes to a model).
  { n: 40, text: 'Ten free runs a month. No card.', verb: '*', angle: 'cost', ai: true },
  { n: 41, text: 'It tells you what it sends before it sends it.', verb: '*', angle: 'privacy', ai: true },
  { n: 42, text: 'Paste the mess, get the table.', verb: 'Convert', angle: 'speed', ai: true },
  { n: 43, text: 'A first draft in seconds; you still press send.', verb: 'Make', angle: 'speed', ai: true },
  { n: 44, text: 'An AI helper you can try without a card.', verb: '*', angle: 'no-signup', ai: true },
  { n: 45, text: 'Let the model do the boring first pass.', verb: '*', angle: 'speed', ai: true },
  // Generic fallbacks for any verb.
  { n: 46, text: 'One job, one page, no account.', verb: '*', angle: 'no-signup', free: true },
  { n: 47, text: 'Free, and it works offline once opened.', verb: '*', angle: 'offline', free: true },
  { n: 48, text: 'Open the page, do the job, close the tab.', verb: '*', angle: 'speed' },
  // Quiz & Party Games (/games/): only these are used for a game, because "just the file" or "your PDFs" would be false for a party game.
  { n: 49, text: 'Names, scores and tickets stay on your own device.', verb: '*', angle: 'privacy', sections: ['games'], free: true },
  { n: 50, text: 'Nothing about your party is uploaded.', verb: '*', angle: 'privacy', sections: ['games'], free: true },
  { n: 51, text: 'From blank page to game night in a minute.', verb: '*', angle: 'speed', sections: ['games'] },
  { n: 52, text: 'Set it up, put it on the TV, play.', verb: '*', angle: 'speed', sections: ['games'] },
  { n: 53, text: 'Game night, and not a penny for an app.', verb: '*', angle: 'cost', sections: ['games'], free: true },
  { n: 54, text: 'A party game that never asks for a subscription.', verb: '*', angle: 'cost', sections: ['games'], free: true },
  { n: 55, text: 'No signal at the party? It still works once opened.', verb: '*', angle: 'offline', sections: ['games'], free: true },
  { n: 56, text: 'Open it once, and it plays without the internet.', verb: '*', angle: 'offline', sections: ['games'], free: true },
  { n: 57, text: 'No account, no app. Just press Start.', verb: '*', angle: 'no-signup', sections: ['games'], free: true },
  { n: 58, text: 'Everyone plays, nobody signs up.', verb: '*', angle: 'no-signup', sections: ['games'], free: true },
  { n: 59, text: 'Here is the big screen, and the game is ready.', verb: '*', angle: 'result-first', sections: ['games'] },
  { n: 60, text: 'The host finally gets to play too.', verb: '*', angle: 'result-first', sections: ['games'] },
  { n: 61, text: 'The caller who never loses count.', verb: '*', angle: 'speed', sections: ['games'], kw: 'tambola|housie|bingo' },
  { n: 62, text: 'Who pressed first? Now you can prove it.', verb: '*', angle: 'speed', sections: ['games'], kw: 'buzzer' },
  { n: 63, text: 'Fair teams, and nobody picks last.', verb: '*', angle: 'speed', sections: ['games'], kw: 'team|group' },
  // The live tools (/live/): only these are used for them. The answers pass through our server to the presenter's screen, so no
  // on-device, offline or "private" hook is true; what is true is no app for the audience, one code, results live on the screen, free.
  { n: 64, text: 'No app for the audience: they join with a code.', verb: '*', angle: 'no-signup', sections: ['live'], free: true },
  { n: 65, text: 'Everyone answers. Nobody installs anything.', verb: '*', angle: 'no-signup', sections: ['live'], free: true },
  { n: 66, text: 'Ask the room a question and watch the answers arrive.', verb: '*', angle: 'result-first', sections: ['live'] },
  { n: 67, text: 'Results live on the big screen as the phones answer.', verb: '*', angle: 'result-first', sections: ['live'] },
  { n: 68, text: 'One code on the screen, and the whole room is in.', verb: '*', angle: 'speed', sections: ['live'] },
  { n: 69, text: 'Type a question, share a code, watch the room answer.', verb: '*', angle: 'speed', sections: ['live'] },
  { n: 70, text: 'Free for the whole room, and no app to install.', verb: '*', angle: 'cost', sections: ['live'], free: true },
  { n: 71, text: 'A room full of phones, and no app to pay for.', verb: '*', angle: 'cost', sections: ['live'], free: true },
  { n: 72, text: 'No accounts, no cookies, no analytics for participants.', verb: '*', angle: 'privacy', sections: ['live'], free: true },
  { n: 73, text: 'The answers are deleted when the room closes.', verb: '*', angle: 'privacy', sections: ['live'], free: true },
  { n: 74, text: 'Quiz night on the TV, answered on every phone.', verb: '*', angle: 'speed', sections: ['live'], kw: 'quiz' },
  { n: 75, text: 'The faster the right answer, the more it scores.', verb: '*', angle: 'result-first', sections: ['live'], kw: 'quiz' },
  { n: 76, text: 'Questions from every seat, ranked by the room.', verb: '*', angle: 'result-first', sections: ['live'], kw: 'questions' },
  { n: 77, text: 'One word from everyone, and the cloud grows.', verb: '*', angle: 'result-first', sections: ['live'], kw: 'word cloud' },
  { n: 78, text: 'Is the room with you? Ask for a rating and see.', verb: '*', angle: 'result-first', sections: ['live'], kw: 'rate|rating|understood' },
];

const ANGLES = ['privacy', 'speed', 'cost', 'offline', 'no-signup', 'result-first'];

/** Whether hook h is true for record rec (independent of verb/angle). */
function allowed(h, rec, opts) {
  if (rec.section === 'games' && !(h.sections && h.sections.includes('games'))) return false;
  if (rec.section === 'live' && !(h.sections && h.sections.includes('live'))) return false;
  if (h.free && rec.pricing !== 'free') return false;
  if (h.ai && rec.pricing !== 'freemium') return false;
  if (h.sections && !h.sections.includes(rec.section)) return false;
  if (h.kw) {
    const hay = (rec.title + ' ' + rec.keywords.join(' ') + ' ' + rec.description).toLowerCase();
    if (!new RegExp(h.kw).test(hay)) return false;
  }
  if (h.result) return false; // figures only ever come from opts.result (see resultHook)
  if (h.video && !(opts && opts.video)) return false;
  return true;
}

/**
 * HOOK(verb, angle): filter by both, fall back to verb-only, then angle-only,
 * then the generic pool; pick index `variant`. With angle 'result-first' and a
 * result summary from the tool, the summary itself is the hook.
 */
function hook(rec, angle, variant, opts) {
  opts = opts || {};
  angle = angle || 'privacy';
  const v = Math.abs(variant | 0);
  if (angle === 'result-first' && opts.result && opts.result.summary) return resultHook(opts.result.summary);
  const ok = HOOKS.filter((h) => allowed(h, rec, opts));
  const verbMatch = (h) => h.verb === rec.verb || h.verb === '*';
  let pool = ok.filter((h) => verbMatch(h) && h.angle === angle);
  if (pool.length < 3) for (const h of ok.filter((x) => verbMatch(x))) if (!pool.includes(h)) pool.push(h);
  if (pool.length < 3) for (const h of ok.filter((x) => x.angle === angle)) if (!pool.includes(h)) pool.push(h);
  if (!pool.length) pool = ok;
  if (!pool.length) return { n: 0, text: rec.title + '.' , angle };
  const h = pool[v % pool.length];
  return { n: h.n, text: h.text, angle: h.angle };
}

/** The shortest true hook for the record (overflow step "swap HOOK for its shortest variant"). */
function shortestHook(rec, opts) {
  const ok = HOOKS.filter((h) => allowed(h, rec, opts || {}) && (h.verb === rec.verb || h.verb === '*'));
  if (!ok.length) return { n: 0, text: rec.title + '.' };
  return ok.slice().sort((a, b) => a.text.length - b.text.length)[0];
}

function resultHook(summary) {
  let s = String(summary).trim().replace(/\s+/g, ' ');
  if (s.length > 70) s = s.slice(0, 69).replace(/\s+\S*$/, '') + '…';
  if (!/[.!?…]$/.test(s)) s += '.';
  return { n: 0, text: s, angle: 'result-first' };
}

module.exports = { HOOKS, ANGLES, hook, shortestHook, allowed };
