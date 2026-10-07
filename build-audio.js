/**
 * The audio section: a hub at /audio/, a page per tool, and their place in
 * the search index, the sitemap, the homepage and the sidebar.
 *
 *   node build-audio.js          apply
 *   node build-audio.js --check  report what would change, write nothing
 *
 * Tools come from every engine/audio-tools-<slug>.js (window.AUDIO_TOOLS,
 * one spec per file). They run in the browser on engine/render-audio.js
 * (the browser's own decoder, engine/audio-dsp.js in a worker, and the
 * encoders of engine/render-video.js): nothing a visitor adds is uploaded.
 * The builder is build/media-section.js, shared with build-video.js.
 * Requiring this file does nothing. Run it on a clean export.
 */
'use strict';

const CONFIG = {
  label: 'build-audio.js',
  section: 'audio',
  specGlobal: 'AUDIO_TOOLS',
  specPrefix: 'audio-tools-',
  glyph: 'i-audio',
  glyphSvg: '<symbol id="i-audio" viewBox="0 0 24 24">\n  <path d="M3 10v4M6.5 7v10M10 4v16M13.5 8v8M17 6v12M20.5 10v4"/>\n</symbol>',
  hubTitle: 'Audio Tools — Convert, Trim, Join, Normalise, Free | 1234Tools',
  hubDescription: 'Free audio tools that run in your browser: convert, trim and join sound files, even out the loudness, speed up speech without the chipmunk effect, record your voice, and more. Nothing is uploaded.',
  hubLede: 'Convert, cut, join and fix sound files in your browser with its own decoder. Your files are read on this device and never uploaded; there is no account and nothing is added to what you save.',
  also: ['/video/extract-audio/', '/ai-video/auto-captions/', '/ai-video/reel-maker/'],
  alsoTitle: 'More sound tools on the site',
  hubPanels:
    '<section class="panel"><h2>How the sound stays on your device</h2>' +
    '<p>The page hands your file to the browser’s own audio decoder, which turns MP3, WAV, M4A, FLAC, Ogg or the sound of a video into plain samples in memory. The tools work on those samples in the page — measuring loudness to the ITU-R BS.1770 standard, stretching time without changing the pitch, finding silences — and write the result as WAV, Opus or AAC with the browser’s own encoders.</p>' +
    '<p>There is no MP3 encoder: the usual one for the web (LAME) is under the LGPL, which this site does not ship. MP3 files open everywhere here; what you save is WAV, M4A (AAC) or Opus, which play wherever MP3 does.</p></section>\n',
  hubFaq: [
    { q: 'Is my sound file uploaded?', a: 'No. The page reads it from your device, works on it in this tab and saves the result to your downloads. We never receive it.' },
    { q: 'How long a file can I use?', a: 'Up to 400 MB and 3 hours. The sound is held decoded in memory, about 23 MB a minute in stereo, so on a phone half an hour is comfortable.' },
    { q: 'Can I save as MP3?', a: 'No. The usual MP3 encoder is under a licence this site does not ship. M4A (AAC) and Opus are smaller for the same quality and play on phones, computers and in browsers.' },
    { q: 'Which files can I open?', a: 'Whatever your browser can play: MP3, WAV, M4A and AAC, FLAC and Ogg in Chrome, Edge and Firefox, and the sound of MP4, MOV and WebM videos. Safari opens MP3, WAV, M4A and FLAC.' },
    { q: 'Is anything added to my audio?', a: 'No watermark, no jingle and no limit on how many files you process.' },
    { q: 'Do I need an account?', a: 'No. Settings you change are remembered in this browser only.' }
  ],
  homeBeside: ['/video/', '/social/'],
  /* the release bumps the service worker's version once for everything it ships */
  bumpSw: false
};

if (require.main === module) {
  try { require('./build/media-section.js').run(CONFIG); }
  catch (e) { console.error('\nbuild-audio.js failed: ' + (e && e.message || e) + '\n'); process.exit(1); }
}
module.exports = { CONFIG, tools: () => require('./build/media-section.js').tools(CONFIG) };
