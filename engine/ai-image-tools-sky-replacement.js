/**
 * Sky Replacement — the spec. build-ai-image.js reads this file in Node to
 * write the page, the hub card, the search-index row and the sitemap line;
 * the page itself loads `scripts`, never this file.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['sky-replacement'] = {
    order: 9,
    title: 'Sky Replacement',
    pageTitle: 'Sky Replacement — Change the Sky in Any Photo | 1234Tools',
    description: 'Swap a flat sky for blue, clouds, sunset, storm or stars. AI finds the sky in your browser; nothing is uploaded. Match the light and export PNG, MP4 or GIF.',
    keywords: ['sky replacement', 'replace sky in photo', 'change sky online', 'sky swap', 'sunset sky replacement',
      'add clouds to photo', 'sky replacement free no upload'],
    glyph: 'i-ai-sky-replacement',
    glyphSvg: '<symbol id="i-ai-sky-replacement" viewBox="0 0 24 24">\n  <path d="M3 18h18"/>\n  <path d="M7.2 14.5a3 3 0 0 1 .4-6 4.1 4.1 0 0 1 7.9 1 2.6 2.6 0 0 1 .4 5z"/>\n  <circle cx="18" cy="6.5" r="2.1"/>\n  <path d="M6.5 21.5h11m-2-2 2 2-2 2" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-sky-replacement.js'],
    privacy: 'Your photo never leaves your device. The AI model that finds the sky — EfficientViT-Seg B1, 18 MB, Apache-2.0, already used by the other tools here — and the runtime that executes it are served from this site and kept by your browser after the first visit; no third-party server is contacted at all. The replacement skies are served from this site too, one at a time as you choose them, and the picture is masked, relit and encoded by your own browser. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: { name: 'EfficientViT-Seg B1', file: '/engine/models/efficientvit-seg-b1-ade20k.onnx', bytes: 19317241, licence: 'Apache-2.0', source: 'https://github.com/mit-han-lab/efficientvit' },
    how: [
      'Choose a photo with some sky in it — a house, a street, a beach, a skyline. The AI finds the sky on your device and shows its share of the frame.',
      'Pick a sky from the gallery: clear blue, soft clouds, golden hour, sunset, dusk pink, storm, overcast or a starry night. Only the one you choose is loaded. Drag the sky up or down to set the horizon, scale it, or flip it so the light comes from the right side.',
      'Fix the edge if you need to: Edge softness follows roofs and leaves more loosely or more crisply; Shrink or grow pulls the mask back from trees it has leaked into; Protect trees and buildings keeps those layers out of the sky altogether.',
      'Match the light: the tool reads the new sky’s warmth and brightness and shifts the foreground toward them — fully, a little, or not at all — so a sunset does not sit over a midday street. Optionally let the sky’s light darken or lift the ground too.',
      'Export the still as PNG, JPEG or WebP at up to the original size, or switch on drifting clouds and export a 4–10 second loop as MP4 or animated GIF.'
    ],
    uses: [
      ['Estate agents', 'The house was photographed on the one grey Tuesday of the month. A soft blue sky, light matched, and the listing photo looks like the viewing day.'],
      ['Travel and landscape', 'Blown-out white skies from a phone are the usual loss on a bright day; put the sky back, or trade it for the sunset you were an hour early for.'],
      ['Instagram and Reels', 'The drifting-cloud loop — the scene still, the clouds moving — is a quiet six seconds that reads as a video without a video camera.'],
      ['Car and product photos', 'A dramatic storm sky behind a car on an open road, or a clean blue behind a building, and the foreground warmth matched so it does not look pasted.'],
      ['Posters and headers', 'A starry night over a familiar street, a golden hour over the office. Export at full resolution for print.']
    ],
    tips: [
      'Horizon first: drag the sky until its lowest clouds sit just above the roofs or the hills. A sky placed too low shows its bottom edge; placed too high it loses its biggest clouds.',
      'The sky usually leaks into trees, because the model sees sky between the leaves. Shrink the mask one or two steps, switch on Protect trees and buildings, and raise Edge softness so the leaves keep their fringe.',
      'Match the light at 60–80% for a convincing result; 100% can be too much on a very warm sunset. Where the new sky is darker than the old one, Reflect the sky’s light darkens the ground a little, which is what makes a storm sky believable.',
      'Flip the sky so the brighter side is where the sun was in your photo — the shadows on the ground give it away.',
      'For the drifting clouds, slow is better: 2–4% of the width a second, 6–8 seconds. The sky is mirror-tiled, so the loop joins seamlessly at any speed.',
      'Blue sky through a window or a reflection in water is not replaced — the model labels those as window and water. If you want them changed, the Background Remover and Photo Filters tools can do the rest by hand.'
    ],
    faq: [
      { q: 'Is my photo uploaded anywhere?',
        a: 'No. The only downloads are the model — EfficientViT-Seg B1, 18 MB, Apache-2.0 — the runtime that runs it, and the one sky you pick, all served from 1234tools.com and kept by your browser after the first visit. No third-party server is contacted. Your picture is read, masked, relit and encoded on your own device, and there is no account and no watermark.' },
      { q: 'Which skies are these, and can I use them?',
        a: 'Six are photographs released into the public domain under the Creative Commons CC0 dedication by their photographers on Wikimedia Commons (soft clouds, sunset, dusk pink, storm, golden hour and overcast); the clear blue sky and the starry night are generated by the tool itself. All eight may be used in anything, including commercial work, with no credit required. The source of each file is listed in the README beside the skies.' },
      { q: 'Why did the sky leak into the trees, and how do I fix it?',
        a: 'Trees are full of small gaps that really are sky, and the model marks them as sky. That is correct for a photo and wrong for a sky swap, because the new sky through those gaps rarely matches. Shrink the mask by one or two steps, which pulls it back from thin branches; switch on Protect trees and buildings, which removes everything the model labelled as a tree, plant or building from the sky mask; and raise Edge softness so the outline keeps a leafy fringe rather than a hard line.' },
      { q: 'What does Match the light do?',
        a: 'It measures the average colour and brightness of the new sky and of the sky it replaces, works out how much warmer or cooler and lighter or darker the new one is, and shifts the foreground part of the way toward it — in roughly linear light, so the colours move the way real light does — plus a light tint over the whole frame to tie the two halves together. The slider sets how far it goes.' },
      { q: 'Can I use the result commercially?',
        a: 'Yes. The output is yours; the skies are CC0 or generated, the model is Apache-2.0, and nothing we make adds a watermark or a credit. The photo itself must be one you have the right to use.' },
      { q: 'Why is the first run slow?',
        a: 'The first run on a device downloads the 18 MB model and the 14 MB runtime and warms the runtime up. After that both come from your browser’s cache and the sky is found in about a second on a laptop. Each sky is about 20–60 KB and is fetched the first time you pick it.' },
      { q: 'The edge along a roof or a mountain looks soft or jagged. What helps?',
        a: 'Lower Edge softness for a crisp line along a roof; raise it for leaves and hair. Set Detail to High, which shows the model the picture at a higher resolution and is sharper on small chimneys and aerials. A photo with the sky clearly brighter than the land is the easy case; haze and a sky the same colour as a white wall are the hard ones.' },
      { q: 'Does the drifting-cloud clip loop?',
        a: 'Yes. The sky is drawn as a mirror-tiled band, so the end of one pass joins the start of the next without a jump at any speed or length. Export 4–10 seconds as MP4 for Reels and TikTok, or as a GIF at 640 px or under for chat and stories.' },
      { q: 'Why did I get a WebM instead of an MP4?',
        a: 'MP4 is encoded on the device with the browser’s WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the clip is recorded in real time as WebM, which every browser and most apps play.' }
    ],
    related: ['/image/photo-filters/', '/image/background-remover/', '/image/image-cropper/', '/image/social-media-resizer/', '/image/image-compressor/']
  };
})();
