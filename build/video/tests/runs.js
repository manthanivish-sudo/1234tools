/*
 * The runs behind the figures quoted in build/content/video.js: each tool on
 * the test videos _kit.js makes (deterministic: seeded noise, fixed tones),
 * driven through the page as a person would, printing what the page shows.
 *
 *   node build/video/tests/runs.js [--root <site>] [--port 9025]
 *
 * Fixtures: clip.mp4 = makeVideo({ box: 'mp4' }) — 640×360, 30 fps, 6 s,
 * AAC 48 kHz stereo, a keyframe every second; big.mp4 = makeVideo({ box:
 * 'mp4', w: 1280, h: 720, seconds: 10, noise: true, bitrate: 5e6 });
 * clip.mov = clip.mp4 with the 'qt  ' brand.
 */
'use strict';
const fs = require('fs');
const T = require('./_kit.js')({ name: 'runs', port: 9025 });

(async () => {
  await T.start();
  const fx = await T.open('/video/', { wait: 'main' });
  const clip = T.save('clip.mp4', await T.makeVideo(fx, { box: 'mp4' }));
  const big = T.save('big.mp4', await T.makeVideo(fx, { box: 'mp4', w: 1280, h: 720, seconds: 10, noise: true, bitrate: 5e6 }));
  const mov = Buffer.from(fs.readFileSync(clip)); mov.write('qt  ', 8, 'latin1');
  const movF = T.save('clip.mov', mov);
  await fx.close();
  const size = (f) => fs.statSync(f).size;
  console.log('fixtures: clip.mp4 ' + size(clip) + ' B, big.mp4 ' + size(big) + ' B, clip.mov ' + size(movF) + ' B');
  const go = async (url, file, sets, button) => {
    const p = await T.open(url);
    await T.upload(p, file);
    await p.waitForFunction(() => { const s = document.querySelector('.vk-studio'); return s && !s.hidden; }, { timeout: 60000 });
    for (const [k, v] of sets) await T.setVal(p, k, v);
    const est = await p.$eval('.vk-est', (e) => e.textContent).catch(() => '');
    await T.press(p, button);
    await T.waitDone(p, 300000);
    const st = await T.status(p);
    const d = (await T.downloads(p))[0];
    const head = await p.$eval('.vk-result .aiimg-result-head', (e) => e.textContent).catch(() => '');
    const note = await p.$eval('.vk-result .vk-note', (e) => e.textContent).catch(() => '');
    const tbl = await p.$$eval('.vk-compare tr', (r) => r.map((x) => [...x.children].map((c) => c.textContent).join(' | '))).catch(() => []);
    await p.close();
    console.log('\n' + url + ' ' + JSON.stringify(sets));
    console.log('  estimate: ' + est);
    console.log('  status:   ' + st);
    console.log('  result:   ' + head + (d ? ' [' + d.bytes.length + ' B]' : ''));
    if (note) console.log('  note:     ' + note);
    tbl.forEach((r) => console.log('  table:    ' + r));
  };
  const B = big.replace(/\\/g, '/');
  await go('/video/video-compressor/', big, [['#vc-mode', 'size'], ['#vc-target', (size(big) / 1048576 / 2).toFixed(1)]], /^Compress the video$/);
  await go('/video/video-compressor/', big, [['#vc-mode', 'quality'], ['#vc-quality', 'balanced'], ['#vc-res', '480'], ['#vc-fps', '15'], ['#vc-sound', '96']], /^Compress the video$/);
  await go('/video/video-trimmer/', clip, [['#vt-start', '1.5'], ['#vt-end', '3.2'], ['#vt-mode', 'exact']], /^Trim the video$/);
  await go('/video/video-trimmer/', clip, [['#vt-start', '1.5'], ['#vt-end', '3.2'], ['#vt-mode', 'fast']], /^Trim the video$/);
  await go('/video/video-converter/', movF, [['#vv-format', 'mp4']], /^Convert the video$/);
  await go('/video/video-converter/', clip, [['#vv-format', 'webm']], /^Convert the video$/);
  await go('/video/mute-video/', clip, [], /^Remove the sound$/);
  await go('/video/extract-audio/', clip, [['#va-format', 'original']], /^Extract the sound$/);
  await go('/video/extract-audio/', clip, [['#va-format', 'wav']], /^Extract the sound$/);
  await go('/video/extract-audio/', clip, [['#va-format', 'opus'], ['#va-rate', '64']], /^Extract the sound$/);
  void B;
  await T.finish();
})().catch(async (e) => { console.error(e); await T.finish(); });
