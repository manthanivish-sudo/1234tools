(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["aspect-ratio"] = {
"title": "Aspect Ratio Calculator",
"category": "design",
"icon": "🖼️",
"description": "Calculate proportional dimensions and simplify aspect ratios for images and video.",
"keywords": ["aspect ratio","resize dimensions","image proportions","16:9 calculator"],
"formula": "newHeight = newWidth × (originalHeight / originalWidth)",
"inputs": [{"key":"w1","label":"Original Width","type":"number","unit":"px","default":1920,"min":1},{"key":"h1","label":"Original Height","type":"number","unit":"px","default":1080,"min":1},{"key":"w2","label":"New Width","type":"number","unit":"px","default":1280,"min":0}],
"compute": ({ w1, h1, w2 }) => {
      if (!w1 || !h1) return {};
      const gcd = (a, b) => b ? gcd(b, a % b) : a;
      const g = gcd(Math.round(w1), Math.round(h1));
      return {
        newHeight: w2 * (h1 / w1),
        /* video encoders want even sizes (chroma is stored in 2 × 2 blocks) */
        evenHeight: w2 ? Math.max(2, 2 * Math.round(w2 * (h1 / w1) / 2)) : NaN,
        ratio: `${Math.round(w1 / g)}:${Math.round(h1 / g)}`,
        decimal: w1 / h1,
        megapixels: (w1 * h1) / 1e6
      };
    },
"outputs": [{"key":"newHeight","label":"New Height","format":"number","unit":"px","primary":true},{"key":"ratio","label":"Simplified Ratio","format":"text"},{"key":"decimal","label":"Ratio as Decimal","format":"number"},{"key":"megapixels","label":"Original Megapixels","format":"number"},{"key":"evenHeight","label":"Nearest even height, for video","format":"number","unit":"px"}],
"filled": (v, r, f) => {
      if (r.newHeight === undefined) return [];
      return ['new height = ' + f.upto(Number(v.w2), 4) + ' × (' + f.upto(Number(v.h1), 4) + ' ÷ ' + f.upto(Number(v.w1), 4) + ') = ' + f.upto(r.newHeight, 4) + ' px',
        'ratio = ' + f.upto(Number(v.w1), 0) + ' : ' + f.upto(Number(v.h1), 0) + ' = ' + r.ratio + ' (both divided by their greatest common divisor)'];
    },
"tips": ["Common ratios: 16:9 widescreen video, 4:3 legacy displays, 1:1 square social posts, 9:16 vertical/stories, 3:2 most DSLR sensors.","Scaling to a non-integer height causes half-pixel rendering. Round to an even number for video encoding; the nearest even height is shown with the results."],
"faq": [{"q":"Why does my video need even dimensions?","a":"Most codecs (H.264, H.265) subsample chroma in 2×2 blocks, so both width and height must be divisible by 2 — some encoders require multiples of 4 or 16."}]
};
})();