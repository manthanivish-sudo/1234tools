#!/usr/bin/env node
/**
 * build/whats-new.js — the tools that went live most recently, for the
 * "New on 1234Tools" row on the homepage (build-home.js writes it).
 *
 * Hand-kept on purpose: a release builds in an export with no git history,
 * so the day a tool went live cannot be read at build time, and the history
 * itself is no guide (whole sections were re-committed on 2026-10-07).
 *
 * When a tool goes live, add [path, 'YYYY-MM-DD'] at the top of NEW and
 * check LEDE still describes the newest batch. build-home.js shows the
 * newest MAX whose pages exist (a line for a page not yet built is skipped,
 * so a wave can be listed before it lands) and links "see all" to the
 * newest tool's section.
 *
 *   node build/whats-new.js     self-test: dates, paths, duplicates
 */
'use strict';

const MAX = 8;

/* One sentence under the heading: what the newest batch is for. */
const LEDE = 'Live polls, word clouds and Q&A from the audience’s phones, and games for a quiz night, a tambola party or the classroom, shown on the TV.';

/* Newest first. Same-day tools keep this order on the page. */
const NEW = [
  ['/games/quiz-maker/', '2026-10-27'],
  ['/games/category-board/', '2026-10-27'],
  ['/games/top-answers/', '2026-10-27'],
  ['/games/charades-generator/', '2026-10-27'],
  ['/games/antakshari/', '2026-10-27'],
  ['/games/icebreaker-cards/', '2026-10-27'],
  ['/live/live-poll/', '2026-10-27'],
  ['/live/word-cloud/', '2026-10-27'],
  ['/live/audience-qa/', '2026-10-27'],
  ['/live/rating-scale/', '2026-10-27'],
  ['/games/tambola-number-caller/', '2026-10-26'],
  ['/games/tambola-ticket-generator/', '2026-10-26'],
  ['/games/quiz-buzzer/', '2026-10-26'],
  ['/games/scoreboard/', '2026-10-26'],
  ['/games/spin-the-wheel/', '2026-10-26'],
  ['/games/team-generator/', '2026-10-26'],
  ['/games/bingo-card-generator/', '2026-10-26']
];

function problems() {
  const out = [];
  const seen = new Set();
  let last = '9999-99-99';
  for (const [p, d] of NEW) {
    if (!/^\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(p)) out.push(p + ': not a /section/tool/ path');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d + 'T00:00:00Z'))) out.push(p + ': bad date ' + d);
    if (d > last) out.push(p + ': out of order (newest first)');
    if (seen.has(p)) out.push(p + ': listed twice');
    seen.add(p);
    last = d;
  }
  if (!(MAX >= 3 && MAX <= 12)) out.push('MAX should be 3-12');
  if (!LEDE || LEDE.length > 200) out.push('LEDE should be one sentence of at most 200 characters');
  return out;
}

if (require.main === module) {
  const p = problems();
  console.log('whats-new: ' + NEW.length + ' entries, ' + p.length + ' problem(s)');
  p.forEach((x) => console.log('  ' + x));
  process.exit(p.length ? 1 : 0);
}

module.exports = { NEW, MAX, LEDE, problems };
