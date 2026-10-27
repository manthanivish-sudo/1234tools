/**
 * The ready-made quiz packs under games/packs/, checked and indexed.
 *
 *   node build/games-packs.js            check every pack, then write games/packs/index.json
 *   node build/games-packs.js --check    check only, write nothing; exit 1 on any problem
 *                                        (including an index.json that is out of date)
 *   node build/games-packs.js --check --dir <folder> [--draft]
 *                                        check packs in another folder (read-only);
 *                                        --draft lets a pack without a reviewed date through,
 *                                        reported as a warning
 *
 * A pack is a quiz in the format engine/game-quiz-core.js reads, plus { id,
 * title, ages, region, count, reviewed, sources }, every question with an
 * https source. The checks are the quiz core's own validatePack (schema, an
 * mcq answer that is not among its options, duplicate options, a missing
 * reviewed date, a count that does not match) plus, across the folder: the
 * file name must be the pack's id, and no question may be asked twice in any
 * two packs (compared with case, accents, punctuation and articles ignored).
 *
 * index.json is what the "Load a ready-made quiz" picker reads, so the page
 * fetches one small file to list the packs and the chosen pack only when it
 * is opened. Requiring this file does nothing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Core = require('../engine/game-quiz-core.js');

const ROOT = path.join(__dirname, '..');
const DEFAULT_DIR = path.join(ROOT, 'games', 'packs');

/** Every pack in `dir` → { packs, problems, warnings, index }. */
function checkDir(dir, opts) {
  const o = opts || {};
  const problems = [], warnings = [], packs = [];
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.json$/.test(f) && f !== 'index.json').sort() : [];
  if (!files.length) problems.push(dir + ': no packs found');
  const prompts = new Map();
  for (const f of files) {
    let pack;
    try { pack = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
    catch (e) { problems.push(f + ': not valid JSON — ' + e.message); continue; }
    const res = Core.validatePack(pack, { strict: !o.draft });
    res.errors.forEach((m) => problems.push(f + ': ' + m));
    if (o.draft && (pack.reviewed === null || pack.reviewed === undefined || pack.reviewed === '')) warnings.push(f + ': ' + Core.STR.notReviewed);
    if (pack && pack.id && f !== pack.id + '.json') problems.push(f + ': the file name must be ' + pack.id + '.json');
    (pack.rounds || []).forEach((r, ri) => ((r && r.questions) || []).forEach((q, qi) => {
      const k = q && Core.norm(q.prompt);
      if (!k) return;
      const here = f + ' round ' + (ri + 1) + ' question ' + (qi + 1);
      const was = prompts.get(k);
      if (was && was.file !== f) problems.push(here + ': the same question is in ' + was.where);
      else if (!was) prompts.set(k, { file: f, where: here });
    }));
    packs.push(pack);
  }
  const index = {
    v: 1,
    packs: packs.filter((p) => p && p.id).sort((a, b) => a.id.localeCompare(b.id)).map((p) => {
      const types = {};
      (p.rounds || []).forEach((r) => (r.questions || []).forEach((q) => { types[q.type] = (types[q.type] || 0) + 1; }));
      return { id: p.id, title: p.title, ages: p.ages, region: p.region, count: Core.countQuestions(p), rounds: (p.rounds || []).map((r) => r.name), types, reviewed: p.reviewed || null };
    })
  };
  return { packs, problems, warnings, index };
}

function main() {
  const args = process.argv.slice(2);
  const CHECK = args.includes('--check');
  const di = args.indexOf('--dir');
  const dir = di >= 0 ? path.resolve(args[di + 1]) : DEFAULT_DIR;
  const draft = args.includes('--draft');
  const r = checkDir(dir, { draft });
  const n = r.packs.reduce((s, p) => s + Core.countQuestions(p), 0);
  const indexPath = path.join(dir, 'index.json');
  const want = JSON.stringify(r.index, null, 1) + '\n';
  if (di < 0) {
    const have = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : null;
    if (CHECK && have !== want) r.problems.push('games/packs/index.json is out of date: run node build/games-packs.js');
    if (!CHECK && !r.problems.length && have !== want) fs.writeFileSync(indexPath, want);
  }
  r.warnings.forEach((w) => console.log('  warn ' + w));
  r.problems.slice(0, 200).forEach((p) => console.log('  FAIL ' + p));
  if (r.problems.length > 200) console.log('  … and ' + (r.problems.length - 200) + ' more');
  console.log('games-packs  ' + r.packs.length + ' packs, ' + n + ' questions, ' + r.problems.length + ' problems' + (r.warnings.length ? ', ' + r.warnings.length + ' warnings' : ''));
  process.exit(r.problems.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { checkDir };
