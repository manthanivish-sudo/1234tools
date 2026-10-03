/**
 * Face Blur (everyone but me) — the spec.
 *
 * build-ai-image.js reads this with engine/ai-image-tools.js to write the
 * page, the hub card, the search-index row and the sitemap line; the page
 * loads the `scripts` below, never this file.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['face-blur'] = {
    order: 7,
    title: 'Face Blur (everyone but me)',
    pageTitle: 'Blur Faces in Photos and Videos — Nothing Uploaded | 1234Tools',
    description: 'Blur or pixelate every face in a photo or short video and tap the ones to keep. The face detector runs in your browser — nothing is uploaded. PNG or MP4 out.',
    keywords: ['blur face in video', 'face blur online', 'blur faces', 'anonymize video', 'anonymise faces in photo',
      'pixelate faces', 'blur faces except mine', 'hide faces in video free'],
    glyph: 'i-ai-face-blur',
    glyphSvg: '<symbol id="i-ai-face-blur" viewBox="0 0 24 24">\n  <rect x="3" y="4" width="18" height="16" rx="2"/>\n  <path d="M8.2 11.2a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0z" class="thin"/>\n  <path d="M6.3 17.4a4.3 4.3 0 0 1 8.6 0" class="thin"/>\n  <path d="M15.8 9.6h2.6M15.8 12h2.6M15.8 14.4h2.6" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-face-blur.js'],
    privacy: 'Your photo or video never leaves your device. The face detector (Ultra-Light-Fast-Generic-Face-Detector, 1.5 MB, MIT licence) and the runtime that executes it are served from this site and kept by your browser after the first visit; no third-party server is contacted. Video frames are read, blurred and re-encoded by your browser, on your own processor. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: { name: 'Ultra-Light-Fast-Generic-Face-Detector-1MB (RFB-640)', file: '/engine/models/ultraface-rfb-640.onnx', bytes: 1575192, licence: 'MIT', source: 'https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB' },
    how: [
      'Choose a photo, or a video of up to a minute. Nothing is uploaded: the detector is downloaded into your browser once (1.5 MB) and runs there.',
      'Every face it finds gets a box. Tap a box to keep that face as it is — yourself, your own child — and tap it again to blur it. Drag across the picture to add a box the detector missed.',
      'Pick the look: a soft blur, pixel blocks or a solid colour, in a rectangle or an oval, and widen the margin so hair and ears are covered too.',
      'For a video, tap the faces to keep on the first frame (or any frame you scrub to); they are followed through the clip. Everyone else is blurred in every frame, including faces that appear later.',
      'Export the photo as PNG or JPEG at full resolution, or the video as MP4 at up to 1280×720 with the original sound.'
    ],
    uses: [
      ['Family videos', 'Post the birthday clip with the other children and the passers-by blurred and your own child left as they are.'],
      ['Classroom and club photos', 'Share a school event photo without identifying the pupils whose parents did not consent.'],
      ['Journalists and researchers', 'Protect a source or a bystander in footage before it goes to a desk or a court.'],
      ['Client work under NDA', 'Show a job you did on site without showing the client’s staff.'],
      ['Street photography', 'Keep the scene, drop the identities, before posting to a public feed.'],
      ['Marketplace and property listings', 'Blur the people in the background of a car, flat or furniture photo.']
    ],
    tips: [
      'Tap your own face to keep it; the box turns green and the status says who is kept. In a video the kept face is followed by its position from frame to frame, so tap it on a frame where it is clearly visible.',
      'Widen the margin for profiles and for anyone looking down: the detector draws a tight box from eyebrows to chin, and hair, ears and a cheek are often enough to recognise someone.',
      'Pixel blocks read as deliberate; a soft blur reads as a camera fault. Choose blocks when it should be obvious the picture was anonymised, and a solid colour when it must be beyond question.',
      'Scrub to the last frames of a video before exporting, and to any moment where someone turns away. If a face is missed on a frame, lower the detection threshold or choose Small faces, and the whole clip is done again.',
      'The detector sees a picture at 640×480, so faces under about 1% of the width are hard for it. Small faces looks at nine overlapping crops as well, which finds faces half that size and takes a few seconds longer.',
      'Keep the original somewhere private. A blurred copy is the one to share.'
    ],
    faq: [
      { q: 'Is my photo or video uploaded?',
        a: 'No. The only download is the face detector — Ultra-Light-Fast-Generic-Face-Detector-1MB, 1.5 MB, published under the MIT licence — and the WebAssembly runtime that runs it, both served from 1234tools.com itself and kept by your browser after the first visit. Your file is opened on your device; each frame is read, blurred and re-encoded by your own browser; nothing is sent anywhere. We never see it, and there is no account and no watermark.' },
      { q: 'Does blurring really anonymise someone?',
        a: 'A strong blur or pixel blocks over an expanded box is the standard practice of broadcasters and courts, and at the default strength nothing of the face survives: the blur reduces the area to a few samples, so there is nothing to reverse. Two cautions. First, a face is not the only identifier — a name badge, a tattoo, a number plate or a distinctive coat may need a box drawn by hand too. Second, keep the original private; a blurred copy protects no one if the original is on the same public feed.' },
      { q: 'Why did it miss a face?',
        a: 'The detector is 1.5 MB and sees the picture at 640×480, so it misses faces that are very small, turned well away, in deep shadow, or covered by a mask, a visor or a hand. Lower the detection threshold, choose Small faces, or drag a box over the face yourself — a hand-drawn box is blurred like any other. In a video, a face that is missed on a frame or two is carried over from the frames around it.' },
      { q: 'Will the sound stay?',
        a: 'Yes, in browsers whose on-device encoder can write AAC or Opus audio — Chrome, Edge and Opera, and Safari 17 and later. The original soundtrack is decoded and written back into the new file unchanged in content. Where the browser cannot encode audio, the clip is exported without sound and the result says so in plain words.' },
      { q: 'What formats go in and out?',
        a: 'Photos: JPEG, PNG, WebP, HEIC in Safari; out as PNG or JPEG at the original resolution. Videos: anything the browser can play — MP4, MOV and WebM from a phone or a screen recorder — up to 60 seconds (a longer clip is cut at the minute). Out as H.264 MP4 at up to 1280×720 where the browser has WebCodecs (Chrome, Edge, Safari 16.4+); Firefox records the clip in real time as WebM instead.' },
      { q: 'Can I keep more than one face?',
        a: 'Yes, tap as many as you like; each kept face is followed separately. Tap a kept face again to blur it. In a video, a kept face that leaves the frame and comes back is treated as new when it returns, so scrub to that moment and tap it again before exporting.' },
      { q: 'Why is it slow on a phone?',
        a: 'Each frame of a video is decoded, searched for faces, blurred and encoded again, all on the phone’s processor; a 30-second clip is 900 frames of work. The tool looks for faces on every second or third frame and follows them in between, and it scales the output to 720p, but a laptop is still three to five times faster. Plug the phone in and keep the clip short.' },
      { q: 'Can I use the result commercially?',
        a: 'Yes. The output is yours. The detector is published under the MIT licence, the runtime under MIT too, and nothing here adds a watermark or a credit.' }
    ],
    related: ['/image/blur-redact/', '/image/exif-remover/', '/ai-image/text-behind-image/', '/image/image-compressor/', '/image/social-media-resizer/']
  };
})();
