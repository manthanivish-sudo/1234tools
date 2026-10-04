'use strict';
/* Kit v2 story data: AI Image Tools. Contract: kit2-schema.md, sections 1 and 2.
   These models are downloaded once and run on the viewer's device: "runs on your
   device", "no upload" and "no watermark" are true here; nothing else is claimed. */
module.exports = {
  '/ai-image/text-behind-image/': {
    persona: 'Creators making covers and thumbnails',
    hook: 'Words behind the person, in front of the sky.',
    pain: 'You have seen “text behind the subject” covers everywhere. By hand it means an hour of masking hair.',
    usual: ['Masking hair by hand for an hour', 'Apps that lock the effect behind a plan', 'Exports with a logo in the corner'],
    promise: 'AI finds the layers. Type your words, drag them behind, export.',
    steps: ['Choose a photo', 'Type and place your text', 'Export PNG, GIF or MP4'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'portrait', options: { text: 'MONDAY' } },
    howTo: 'How to put text behind a person in a photo',
    cta: 'Try text behind'
  },
  '/ai-image/blur-background/': {
    persona: 'Phone photographers and sellers',
    hook: 'Portrait mode, added after you took the shot.',
    pain: 'You took it in normal mode. The face is sharp, and so is the cluttered kitchen behind it.',
    usual: ['Blur tools that smear the subject’s edge', 'Phone modes that only work before you shoot', 'Uploading family photos to an app'],
    promise: 'Tap the subject. The background softens with distance, like a lens.',
    steps: ['Choose a photo', 'Tap to focus, set strength', 'Export PNG or a clip'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'portrait', options: { style: 'bokeh' } },
    howTo: 'How to blur the background of a photo',
    cta: 'Blur the background'
  },
  '/ai-image/background-remover/': {
    persona: 'Sellers, job seekers and creators',
    hook: 'Your product photo has a kitchen behind it.',
    pain: 'The listing needs a clean cut-out, and the only photo you have was taken on the kitchen table.',
    usual: ['Low-resolution free downloads', 'Uploading every photo to a server', 'Hair cut out like a cardboard blob'],
    promise: 'AI keeps the subject, hair and all. Download a transparent PNG.',
    steps: ['Choose a photo', 'Tick what stays', 'Download PNG or WebP'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'product' },
    howTo: 'How to remove a photo background for free',
    cta: 'Remove a background'
  },
  '/ai-image/sticker-maker/': {
    persona: 'Group chats, pet owners and shops',
    hook: 'Your dog, as a WhatsApp sticker, white outline and all.',
    pain: 'The group chat needs a sticker of the dog. Sticker apps want an account and add their badge.',
    usual: ['Sticker apps that add their own badge', 'Cutting round fur with a fingertip', 'Files over the 100 KB sticker limit'],
    promise: 'AI cuts the subject out and adds the border. A 512 px WebP, ready.',
    steps: ['Choose a photo', 'Set the border and outline', 'Export the sticker or pack'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'pet' },
    howTo: 'How to make a WhatsApp sticker from a photo',
    cta: 'Make a sticker'
  },
  '/ai-image/3d-photo-parallax/': {
    persona: 'Reels creators and estate agents',
    hook: 'One still photo. Six seconds of 3D motion.',
    pain: 'Still photos get scrolled past. You have a great shot of the moment, but no video of it.',
    usual: ['Apps that want a subscription for 3D', 'Exports with a logo burned in', 'Keyframing the camera by hand'],
    promise: 'AI reads the depth. Pick a camera move. Export a looping MP4.',
    steps: ['Choose a photo', 'Pick a camera move', 'Export MP4 or GIF'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'landscape', options: { move: 'sway', frame: '9:16' } },
    howTo: 'How to turn a photo into a 3D video',
    cta: 'Make it move'
  },
  '/ai-image/object-remover/': {
    persona: 'Travellers, sellers and landlords',
    hook: 'A stranger walked into your best holiday photo.',
    pain: 'The view was perfect. The tourist in the red coat standing in the middle of it was not.',
    usual: ['Clone-stamping pixel by pixel', 'Apps that want a plan for one removal', 'Uploading private photos to be edited'],
    promise: 'Brush over it, or tap “Remove all people”. AI fills the gap.',
    steps: ['Choose a photo', 'Brush over what should go', 'Press Remove and save'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'street', options: { removeAllPeople: true } },
    howTo: 'How to remove people from a photo',
    cta: 'Remove an object'
  },
  '/ai-image/color-pop/': {
    persona: 'Car sellers and Instagram creators',
    hook: 'Make the red car the only colour on the street.',
    pain: 'Your listing photo shows the car in a busy street. Buyers look everywhere except the car.',
    usual: ['Masking the subject by hand', 'Filters that grey out the subject too', 'Apps that only export with their logo'],
    promise: 'AI finds the subject. Everything else turns black and white.',
    steps: ['Choose a photo', 'Tick the layers to keep', 'Export PNG, MP4 or GIF'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'street' },
    howTo: 'How to make one colour pop in a photo',
    cta: 'Make it pop'
  },
  '/ai-image/sky-replacement/': {
    persona: 'Estate agents and travellers',
    hook: 'Shot on the one grey Tuesday. Give it a sunset.',
    pain: 'The house was photographed under a flat white sky. The listing looks gloomy before anyone reads it.',
    usual: ['Masking round every roof and tree', 'New skies that do not match the light', 'Full-size exports kept for paid plans'],
    promise: 'AI finds the sky. Pick a new one; the light is matched for you.',
    steps: ['Choose a photo with sky', 'Pick a sky from the gallery', 'Export PNG or a moving clip'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'landscape', options: { sky: 'sunset' } },
    howTo: 'How to replace the sky in a photo',
    cta: 'Change the sky'
  },
  '/ai-image/thumbnail-maker/': {
    persona: 'YouTubers and course creators',
    hook: 'Your video is good. The thumbnail is a blurry frame.',
    pain: 'Clicks live and die on the thumbnail. You use a paused frame because design takes an hour.',
    usual: ['An hour of cut-outs for every video', 'Templates every other channel uses', 'Exports over the 2 MB upload cap'],
    promise: 'Face cut out with a glow, bold title, 1280×720, three variants.',
    steps: ['Choose a photo of you', 'Type the title', 'Export three variants'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'portrait', options: { title: '30 DAYS\nLATER' } },
    howTo: 'How to make a YouTube thumbnail for free',
    cta: 'Make a thumbnail'
  },
  '/ai-image/face-blur/': {
    persona: 'Parents, teachers and event organisers',
    hook: 'Post the class photo. Blur every face but your child’s.',
    pain: 'You want to share the school play photo. The other parents never agreed to their children being online.',
    usual: ['Blurring faces one by one in an editor', 'Uploading children’s photos to an app', 'Not posting the photo at all'],
    promise: 'Every face is found and blurred. Tap the ones to keep.',
    steps: ['Choose a photo or a clip', 'Tap the faces to keep', 'Export PNG or MP4'],
    proof: ['Free', 'Runs on your device', 'No upload'],
    example: { kind: 'image', sample: 'group' },
    howTo: 'How to blur every face in a photo but one',
    cta: 'Blur faces'
  },
  '/ai-image/image-upscaler/': {
    persona: 'Sellers, archivists and anyone printing',
    hook: 'That 600-pixel photo can be 2,400 pixels wide.',
    pain: 'The marketplace rejects your photo as too small, and the only copy of grandad’s picture is a tiny scan.',
    usual: ['Plain resizing that only adds blur', 'Upscalers with a daily credit limit', 'Uploading family photos to a server'],
    promise: 'Real-ESRGAN runs on your device. 2× or 4×, sharper, with a slider.',
    steps: ['Choose a photo', 'Pick 2×, 4× or Unblur', 'Compare, then download'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'pet', options: { scale: 4 } },
    howTo: 'How to upscale a small photo',
    cta: 'Upscale a photo'
  },
  '/ai-image/film-grain/': {
    persona: 'Instagram and TikTok creators',
    hook: 'Make today’s phone photo look like a 1994 camcorder.',
    pain: 'Phone photos all look clean and the same. You want grain, light leaks and a date stamp that feel real.',
    usual: ['Filter apps with the good presets locked', 'Grain that sits on top like dust', 'Exports with an app logo on them'],
    promise: 'Seven presets plus a random roll. Export a still, GIF or MP4.',
    steps: ['Choose a photo', 'Pick a preset or roll', 'Export PNG, GIF or MP4'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'image', sample: 'street', options: { preset: 'vhs' } },
    howTo: 'How to add film grain and a VHS look to a photo',
    cta: 'Add film grain'
  }
};
