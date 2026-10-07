/*
 * Writes engine/vendor/noto-emoji/noto-subset.json: about 300 common emoji
 * from Google's Noto Emoji SVGs (Apache-2.0), as Iconify packages them in
 * @iconify-json/noto. The Thumbnail Maker's sticker picker and the Reel
 * Maker read this one file, on demand, and draw each emoji from its SVG so
 * an export looks the same on every device, whatever emoji font it has.
 *
 *   npm pack @iconify-json/noto@1.2.9          (in a scratch folder)
 *   tar -xzf iconify-json-noto-1.2.9.tgz
 *   node build/ai-image/make-noto-subset.js --pkg <scratch>/package
 *
 * Output: { license, source, width, height, count, icons: { "<name>":
 * { char, name, group, body } } }, where body is the inner markup of an
 * SVG with viewBox "0 0 width height". Keys are Noto's names
 * ("grinning-face"), in picker order: group by group, as listed below.
 * The script stops if the package is not the expected version or licence,
 * or if a listed name is missing.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PKG = flag('pkg', 'E:/tmp/wsoc-thumb/noto/package');
const OUT = flag('out', path.join(__dirname, '..', '..', 'engine', 'vendor', 'noto-emoji', 'noto-subset.json'));
const VERSION = '1.2.9';

const GROUPS = {
  smileys: `grinning-face grinning-face-with-big-eyes grinning-face-with-smiling-eyes beaming-face-with-smiling-eyes grinning-squinting-face
    grinning-face-with-sweat rolling-on-the-floor-laughing face-with-tears-of-joy slightly-smiling-face upside-down-face melting-face
    winking-face smiling-face-with-smiling-eyes smiling-face-with-halo smiling-face-with-hearts smiling-face-with-heart-eyes star-struck
    face-blowing-a-kiss face-savoring-food face-with-tongue winking-face-with-tongue zany-face money-mouth-face
    face-with-hand-over-mouth face-with-open-eyes-and-hand-over-mouth face-with-peeking-eye shushing-face thinking-face saluting-face
    zipper-mouth-face face-with-raised-eyebrow neutral-face expressionless-face smirking-face unamused-face face-with-rolling-eyes
    grimacing-face lying-face shaking-face relieved-face pensive-face sleepy-face drooling-face sleeping-face face-with-medical-mask
    nauseated-face face-vomiting hot-face cold-face woozy-face face-with-spiral-eyes exploding-head cowboy-hat-face partying-face
    disguised-face smiling-face-with-sunglasses nerd-face face-with-monocle confused-face worried-face slightly-frowning-face
    face-with-open-mouth hushed-face astonished-face flushed-face pleading-face face-holding-back-tears anguished-face fearful-face
    anxious-face-with-sweat crying-face loudly-crying-face face-screaming-in-fear confounded-face disappointed-face weary-face tired-face
    yawning-face face-with-steam-from-nose enraged-face angry-face face-with-symbols-on-mouth smiling-face-with-horns skull pile-of-poo
    clown-face ghost alien robot see-no-evil-monkey hear-no-evil-monkey speak-no-evil-monkey
    red-heart orange-heart yellow-heart green-heart blue-heart purple-heart black-heart white-heart pink-heart broken-heart heart-on-fire
    two-hearts sparkling-heart kiss-mark hundred-points anger-symbol collision dizzy sweat-droplets dashing-away speech-balloon
    thought-balloon zzz`,
  people: `waving-hand raised-hand ok-hand victory-hand crossed-fingers love-you-gesture call-me-hand
    backhand-index-pointing-left backhand-index-pointing-right backhand-index-pointing-up backhand-index-pointing-down
    index-pointing-at-the-viewer thumbs-up thumbs-down raised-fist clapping-hands raising-hands heart-hands
    handshake folded-hands flexed-biceps brain eyes eye mouth person-shrugging person-facepalming person-running`,
  animals: `dog-face cat-face monkey-face fox lion tiger-face unicorn pig-face panda frog chicken penguin owl
    butterfly honeybee snake t-rex dragon shark octopus paw-prints rose sunflower cherry-blossom seedling
    evergreen-tree palm-tree cactus four-leaf-clover mushroom`,
  food: `red-apple banana watermelon strawberry lemon avocado hot-pepper pizza hamburger french-fries hot-dog taco sushi
    egg popcorn doughnut cookie birthday-cake chocolate-bar soft-ice-cream hot-beverage cup-with-straw beer-mug clinking-glasses
    bottle-with-popping-cork`,
  activities: `trophy 1st-place-medal 2nd-place-medal 3rd-place-medal sports-medal soccer-ball basketball
    video-game joystick game-die bullseye party-popper confetti-ball wrapped-gift balloon sparkles fireworks ticket
    artist-palette puzzle-piece crystal-ball magic-wand`,
  travel: `rocket fire high-voltage star glowing-star shooting-star sun cloud rainbow snowflake droplet water-wave tornado
    globe-showing-europe-africa house racing-car airplane police-car-light construction stop-sign stopwatch alarm-clock
    hourglass-not-done ringed-planet`,
  objects: `money-bag dollar-banknote money-with-wings coin credit-card gem-stone crown light-bulb laptop mobile-phone
    camera movie-camera clapper-board television studio-microphone headphone musical-notes guitar books memo pencil
    bar-chart chart-increasing chart-decreasing calendar pushpin locked key hammer-and-wrench gear magnifying-glass-tilted-left
    bell megaphone package envelope shopping-cart bomb pill test-tube battery shield graduation-cap sunglasses`,
  symbols: `check-mark-button check-mark cross-mark cross-mark-button red-question-mark red-exclamation-mark double-exclamation-mark
    exclamation-question-mark warning prohibited no-entry red-circle green-circle new-button free-button
    up-exclamation-button cool-button sos-button vs-button top-arrow soon-arrow right-arrow left-arrow up-arrow down-arrow
    play-button pause-button record-button repeat-button plus minus multiply infinity recycling-symbol sparkle
    keycap-1 keycap-2 keycap-3 keycap-4 keycap-5 keycap-6 keycap-7 keycap-8 keycap-9 keycap-10`,
  flags: `chequered-flag triangular-flag white-flag pirate-flag`
};

function main() {
  const pj = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));
  const info = JSON.parse(fs.readFileSync(path.join(PKG, 'info.json'), 'utf8'));
  if (pj.name !== '@iconify-json/noto' || pj.version !== VERSION) throw new Error('expected @iconify-json/noto ' + VERSION + ', found ' + pj.name + ' ' + pj.version);
  if (pj.license !== 'Apache-2.0' || !info.license || info.license.spdx !== 'Apache-2.0') throw new Error('the package does not say Apache-2.0');
  const set = JSON.parse(fs.readFileSync(path.join(PKG, 'icons.json'), 'utf8'));
  const chars = JSON.parse(fs.readFileSync(path.join(PKG, 'chars.json'), 'utf8'));
  const W = set.width || 128, H = set.height || 128;
  /* chars.json maps code points to names; several sequences can share a
     name, so prefer the one with the variation selector (fe0f) a keyboard sends */
  const cp = {};
  for (const [hex, name] of Object.entries(chars)) {
    if (!cp[name] || (/fe0f/.test(hex) && !/fe0f/.test(cp[name]))) cp[name] = hex;
  }
  const icons = {};
  const missing = [];
  let n = 0;
  for (const [group, list] of Object.entries(GROUPS)) {
    for (const name of list.split(/\s+/).filter(Boolean)) {
      if (icons[name]) continue;
      let ic = set.icons[name];
      if (!ic && set.aliases && set.aliases[name]) ic = set.icons[set.aliases[name].parent];
      if (!ic || !cp[name]) { missing.push(name); continue; }
      if ((ic.width && ic.width !== W) || (ic.height && ic.height !== H) || ic.left || ic.top) { missing.push(name + ' (not ' + W + '×' + H + ')'); continue; }
      const ch = cp[name].split('-').map((h) => String.fromCodePoint(parseInt(h, 16))).join('');
      /* make gradient and clip ids unique to the icon, so two emoji inlined in one page never share one */
      const tag = 'n' + (++n).toString(36) + '_';
      const ids = new Set();
      ic.body.replace(/\bid="([^"]+)"/g, (m, id) => { ids.add(id); return m; });
      let body = ic.body;
      for (const id of ids) body = body.split('"' + id + '"').join('"' + tag + id + '"').split('#' + id + ')').join('#' + tag + id + ')').split('"#' + id + '"').join('"#' + tag + id + '"');
      icons[name] = { char: ch, name: name.replace(/-/g, ' '), group, body };
    }
  }
  if (missing.length) throw new Error('missing from the package: ' + missing.join(', '));
  const out = {
    license: 'Apache-2.0',
    source: '@iconify-json/noto ' + VERSION,
    upstream: 'https://github.com/googlefonts/noto-emoji (svg/, Apache-2.0)',
    width: W, height: H,
    count: Object.keys(icons).length,
    icons
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify(out);
  fs.writeFileSync(OUT, json);
  const groups = {};
  for (const k in icons) groups[icons[k].group] = (groups[icons[k].group] || 0) + 1;
  console.log('wrote', OUT, json.length, 'bytes,', out.count, 'emoji', JSON.stringify(groups));
}
main();
