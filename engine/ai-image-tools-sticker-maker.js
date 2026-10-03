/**
 * Sticker Maker — the spec.
 *
 * build-ai-image.js reads this in Node to write the page, the hub card,
 * the search-index row and the sitemap line; the page loads `scripts`,
 * never this file.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['sticker-maker'] = {
    order: 2,
    title: 'Sticker Maker',
    pageTitle: 'Sticker Maker — Cut Out Stickers With a White Outline | 1234Tools',
    description: 'Cut a sticker from any photo, white outline and all: a WhatsApp or Telegram pack, a story or a transparent PNG. AI in your browser — nothing is uploaded.',
    keywords: ['sticker maker', 'cut out sticker', 'whatsapp sticker maker', 'png sticker with outline',
      'telegram sticker maker', 'die cut sticker from photo', 'sticker with white border'],
    glyph: 'i-ai-sticker-maker',
    glyphSvg: '<symbol id="i-ai-sticker-maker" viewBox="0 0 24 24">\n  <path d="M5 3.5h12.5a2 2 0 0 1 2 2V13l-7.5 7.5H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z"/>\n  <path d="M12 20.5V15a2 2 0 0 1 2-2h5.5" class="thin"/>\n  <path d="M7 8.5h6M7 12h3" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-matte.js', '/engine/zip.js', '/engine/aiimg-sticker-maker.js'],
    privacy: 'Your photo never leaves your device. Two models run inside your browser through WebAssembly: EfficientViT-Seg (18 MB, Apache-2.0) finds the layers and MODNet (25 MB, Apache-2.0) draws the edges of people, hair included. Both, and the runtime that executes them, are served from this site and kept by your browser after the first visit; no third-party server is contacted at all. The sticker is cut, bordered and encoded by your own browser. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: {
      name: 'MODNet, photographic portrait matting (with EfficientViT-Seg B1 from aiimg-core.js)',
      file: '/engine/models/modnet-photographic-portrait-matting.onnx',
      bytes: 25888640,
      licence: 'Apache-2.0',
      source: 'https://github.com/ZHKKKe/MODNet — ONNX from https://huggingface.co/Xenova/modnet (onnx/model.onnx, sha256 07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9)',
      converted: 'not re-exported: the Hub file byte for byte, fp32, opset 11; see engine/models/README-modnet.txt'
    },
    how: [
      'Choose a photo. The AI finds the layers on your device and ticks the people and objects; the sticker is whatever stays ticked — a person, a dog, a car, a building.',
      'People get their edge from a portrait matting model, so hair is cut strand by strand rather than as a blob. Everything else is refined against the pixels of the photo.',
      'Set the border: its width as a share of the sticker\'s size, its colour (white to start), and how much the outline is rounded — a die-cut sticker has a smooth outline that bridges the gap between an arm and a body. Add a glow or a drop shadow if you like.',
      'Export: a PNG at 512, 1024 or 2048 pixels; a 512×512 WebP under 100 KB, which is what WhatsApp and Telegram take; a 1080×1920 story with the sticker in the middle; or copy the PNG straight to the clipboard and paste it into a chat.',
      'For a whole pack, add up to 30 photos: each goes through the same settings and comes out as a WhatsApp-ready WebP (or a PNG), with one zip for all of them.'
    ],
    uses: [
      ['WhatsApp and Telegram packs', 'Thirty photos of friends, one pass, thirty 512×512 WebP stickers under 100 KB each, ready for any sticker app to import.'],
      ['Instagram and TikTok stories', 'A story-sized PNG with the sticker centred, transparent or on a colour, ready for a caption on top.'],
      ['Printed stickers', 'A 2048 px PNG with a white die-cut border is what a sticker printer or a Cricut wants; the border is the cut line.'],
      ['Product stickers for a shop', 'The product on a transparent background with a clean border, the same look across the whole range because the border scales with the sticker.'],
      ['School projects and classroom displays', 'Children, pets and objects as stickers for a poster, a timetable or a reward chart.'],
      ['Twitch, Discord and YouTube', 'Emotes and reaction stickers of your own face with a glow, at exactly the pixel size the platform asks for.']
    ],
    tips: [
      'A subject that fills the frame makes a better sticker than a small figure in a wide photo: the model sees the picture at 512 pixels across, so a face thirty pixels wide has no detail to cut.',
      'Keep the border between 3% and 6% for the classic look. WhatsApp\'s own design guide suggests about 1.5% (8 px on 512) with a soft shadow, which is what the Drop shadow effect\'s defaults give you.',
      'Die-cut smoothing at 2–4% rounds the outline and bridges hair strands and gaps; turn it off for an outline that follows every strand, which looks better at large sizes and worse on a phone.',
      'For fur, raise Edge softness to 5–7; for a product with a hard edge, lower it to 1–2 and shrink the cut by a step so no fringe of background sits inside the border.',
      'If a WhatsApp export reports that it could not get under 100 KB, a thinner border, a less busy subject or no glow brings it down — the limit is a byte count, and glows are expensive to compress.',
      'Copy to clipboard puts the PNG itself on the clipboard: paste it into WhatsApp Web, Telegram, Slack, Discord, a Google Doc or an image editor.',
      'The layer names are the model\x27s best guess, and it learned from street scenes and rooms: a cat can turn up under People, a pet bed under Furniture. Tick whichever layer holds your subject — the cut-out is what matters, not the label on it.'
    ],
    faq: [
      { q: 'Is my photo uploaded?',
        a: 'No. Two models run inside your browser — EfficientViT-Seg (18 MB, Apache-2.0) for the layers and MODNet (25 MB, Apache-2.0) for the edges of people — and both, with the runtime, are served from 1234tools.com and kept by your browser after the first visit. No third-party server is contacted. The sticker is cut, bordered and encoded on your device; we never see the photo, and there is no watermark.' },
      { q: 'What are the WhatsApp sticker rules?',
        a: 'A static sticker is a 512×512 pixel WebP under 100 KB with a transparent background; WhatsApp\'s design guide also suggests a 16 px margin, an 8 px white outline and a soft shadow. A pack holds 3 to 30 stickers and needs a 96×96 PNG tray icon under 50 KB, which the sticker app you import with makes from one of the stickers. The export here is sized, bordered and compressed to those limits and says so on each result.' },
      { q: 'Does it work for Telegram?',
        a: 'Yes. Telegram\'s static stickers are 512 px on at least one side, as PNG or WebP, up to 512 KB, so the WhatsApp export qualifies as it is. Send it to the @Stickers bot, or import it with any Telegram sticker app.' },
      { q: 'How is the border made?',
        a: 'The cut-out\'s silhouette is grown outwards by an exact distance transform — every pixel within the border width of the subject becomes border — then the picture is drawn on top. That is why the border is even all the way round and rounds corners naturally, like a real die cut, instead of being a thick line traced along the edge. Die-cut smoothing first rounds the silhouette, so the outline bridges gaps between strands of hair or between an arm and a body.' },
      { q: 'Why do hair edges look better for people than for pets?',
        a: 'Because the second model, MODNet, is a portrait matting network: it was trained on photographs of people and draws a soft edge for hair. It is used only where the layer model found a person. A cat or a dog gets the layer edge refined against the pixels, which follows fur loosely. With a border, the difference matters less than in a plain cut-out — the outline covers the edge — and Die-cut smoothing hides the rest.' },
      { q: 'Can I make a sticker of a car, a building or a dog?',
        a: 'Yes. Every layer the model finds has a tick: tick Cars, Buildings, Animals, Sky or anything else, and the sticker is whatever is ticked. More than one layer is fine — a person and the bicycle they are holding.' },
      { q: 'Can I use the stickers commercially?',
        a: 'Yes. The output is yours. Both models are published under the Apache-2.0 licence, and nothing here adds a watermark or a credit. The photos themselves must of course be yours to use.' },
      { q: 'What does "Copy to clipboard" do, and why is it greyed out?',
        a: 'It puts the sticker PNG on your clipboard, so you can paste it anywhere that takes an image — a chat, a document, an editor. It needs the browser\'s image clipboard API, which Chrome, Edge and Safari have and Firefox is adding; where it is missing the button is disabled and the download works as usual.' },
      { q: 'Why 30 photos at a time?',
        a: 'A WhatsApp pack holds at most 30 stickers, and 30 keeps the memory of a phone comfortable. Each photo takes a second or two; a full pack, about a minute. Run another batch for the next pack.' }
    ],
    related: ['/image/background-remover/', '/image/circle-crop/', '/image/image-border/', '/image/image-converter/', '/image/social-media-resizer/', '/image/meme-generator/']
  };
})();
