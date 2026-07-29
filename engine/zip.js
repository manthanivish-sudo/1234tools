/**
 * Minimal ZIP writer, STORE method (no compression).
 *
 * PNGs and JPEGs are already compressed, so deflating again buys almost
 * nothing and would mean shipping a compressor. Shared by the developer
 * tools (favicon bundles) and the image tools (batch output).
 */
(function () {
  'use strict';
  /* Minimal ZIP writer, STORE method (no compression).
     PNGs are already compressed, so deflating again buys almost nothing
     and would mean shipping a compressor. */
  async function zipStore(files) {
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;

    const crcTable = (function () {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c >>> 0;
      }
      return t;
    })();
    const crc32 = function (bytes) {
      let c = 0xFFFFFFFF;
      for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
      return (c ^ 0xFFFFFFFF) >>> 0;
    };
    const u32 = function (v) { return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); };
    const u16 = function (v) { return new Uint8Array([v & 255, (v >>> 8) & 255]); };

    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      const data = new Uint8Array(await f.blob.arrayBuffer());
      const crc = crc32(data);

      const local = [
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0), nameBytes, data
      ];
      local.forEach(function (p) { chunks.push(p); });
      const localSize = local.reduce(function (n, p) { return n + p.length; }, 0);

      central.push([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
        u32(offset), nameBytes
      ]);
      offset += localSize;
    }

    const centralStart = offset;
    let centralSize = 0;
    central.forEach(function (rec) {
      rec.forEach(function (p) { chunks.push(p); centralSize += p.length; });
    });
    chunks.push(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
                u32(centralSize), u32(centralStart), u16(0));

    return new Blob(chunks, { type: 'application/zip' });
  }


  window.MVRZip = zipStore;
})();
