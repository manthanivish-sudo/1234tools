/**
 * The Audio Tools' worker: runs engine/audio-dsp.js off the page's main
 * thread. Messages: { id, op: 'loudness'|'stretch'|'silences'|'cut', planes:
 * [Float32Array], rate, args } → { id, result } (planes transferred back) or
 * { id, error }; { id, type: 'progress', value } while a stretch runs.
 */
/* global importScripts, AudioDSP */
importScripts('/engine/audio-dsp.js');
self.onmessage = (e) => {
  const m = e.data || {};
  try {
    const D = self.AudioDSP;
    let result, transfer = [];
    if (m.op === 'loudness') result = D.loudness(m.planes, m.rate);
    else if (m.op === 'stretch') {
      result = D.stretch(m.planes, m.rate, m.args.speed, (v) => self.postMessage({ id: m.id, type: 'progress', value: v }));
      transfer = result.map((p) => p.buffer);
    } else if (m.op === 'silences') result = D.silences(m.planes, m.rate, m.args || {});
    else if (m.op === 'cut') { result = D.cutRanges(m.planes, m.rate, m.args.keep, m.args.fade); transfer = result.map((p) => p.buffer); }
    else throw new Error('unknown operation ' + m.op);
    self.postMessage({ id: m.id, result }, transfer);
  } catch (err) {
    self.postMessage({ id: m.id, error: String((err && err.message) || err) });
  }
};
