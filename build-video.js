/**
 * The video section: a hub at /video/, a page per tool, and their place in
 * the search index, the sitemap, the homepage and the sidebar.
 *
 *   node build-video.js          apply
 *   node build-video.js --check  report what would change, write nothing
 *
 * Tools come from every engine/video-tools-<slug>.js (window.VIDEO_TOOLS,
 * one spec per file). They run in the browser on engine/render-video.js
 * (WebCodecs, the vendored mp4-muxer and webm-muxer, and the demuxer in
 * engine/video-demux.js): nothing a visitor adds is uploaded. The builder
 * is build/media-section.js, shared with build-audio.js. Requiring this
 * file does nothing. Run it on a clean export, never on the working tree.
 */
'use strict';

const CONFIG = {
  label: 'build-video.js',
  section: 'video',
  specGlobal: 'VIDEO_TOOLS',
  specPrefix: 'video-tools-',
  glyph: 'i-video',
  glyphSvg: '<symbol id="i-video" viewBox="0 0 24 24">\n  <rect x="2.5" y="5.5" width="13.5" height="13" rx="2.5"/>\n  <path d="M16 10.2l5.5-3.2v10l-5.5-3.2"/>\n  <path d="M7.6 9.6v4.8l3.8-2.4z" class="fill"/>\n</symbol>',
  hubTitle: 'Video Tools — Compress, Trim, Convert, Free | 1234Tools',
  hubDescription: 'Free video tools that run in your browser: compress a video to a size, trim it, convert MOV to MP4 or WebM, mute it, take the sound out, and more. Nothing is uploaded.',
  hubLede: 'Shrink, cut, convert and record video in your browser, with the codecs it already has. Your files are read on this device and never uploaded; there is no account, no limit on the number of files and nothing stamped on the result.',
  also: ['/social/video-to-gif/', '/social/reels-resizer/', '/ai-video/auto-captions/', '/ai-video/reel-maker/'],
  alsoTitle: 'More video tools on the site',
  hubPanels:
    '<section class="panel"><h2>How the video stays on your device</h2>' +
    '<p>A video file is a box holding a picture track and a sound track. These tools open the box in the page, read the samples they need straight from the file on your disk, and decode and encode them with the browser’s own codecs (WebCodecs): H.264 for MP4, VP9 for WebM, AAC or Opus for sound. The new file is put together in the page and saved to your downloads.</p>' +
    '<p>Where nothing has to change — cutting at a keyframe, removing the sound, taking the sound out, repackaging a MOV as an MP4 — the samples are copied untouched, so there is no loss of quality and a long video takes seconds. Where the picture must change, it is re-encoded, and the page tells you which happened.</p>' +
    '<p>No ffmpeg is used: its browser builds are under the LGPL or GPL. Where a browser has no WebCodecs, the video is played once in the page and recorded as it plays, which takes as long as the clip and usually gives a WebM; each page says so.</p></section>\n',
  hubFaq: [
    { q: 'Is my video uploaded?', a: 'No. The page reads the file from your device, works on it in this tab and saves the result to your downloads. We never receive it.' },
    { q: 'How big a video can I use?', a: 'Up to 2 GB. The finished file is assembled in memory, so a phone may run short well before that; a few hundred megabytes is comfortable on most phones, and a computer handles the full size.' },
    { q: 'Which browsers work?', a: 'Chrome and Edge on a computer do everything fastest. Safari 16.4 and later, and Firefox 130 and later on a computer, have the codecs too. Where a browser lacks them, the tools record the video in real time instead and say so on the page.' },
    { q: 'Is there a watermark or a time limit?', a: 'No. Nothing is added to your video and there is no limit on how many you process.' },
    { q: 'Why not MP3?', a: 'The usual MP3 encoder for the web (LAME) is under the LGPL, which this site does not ship. Sound comes out as WAV, AAC (M4A) or Opus, and an MP3 inside a video is copied out as it is.' },
    { q: 'Do I need an account?', a: 'No. There is no sign-in. Settings you change are remembered in this browser only.' }
  ],
  homeBeside: ['/social/', '/ai-video/'],
  /* the release bumps the service worker's version once for everything it ships */
  bumpSw: false
};

if (require.main === module) {
  try { require('./build/media-section.js').run(CONFIG); }
  catch (e) { console.error('\nbuild-video.js failed: ' + (e && e.message || e) + '\n'); process.exit(1); }
}
module.exports = { CONFIG, tools: () => require('./build/media-section.js').tools(CONFIG) };
