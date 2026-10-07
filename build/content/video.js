/**
 * The reading part of the Video Tools (/video/), rendered by build-depth.js
 * in its file-and-text shape (howItWorks in place of formula). Shape and
 * rules: build-depth.js and build/content/_check.js.
 *
 * Every figure comes from a run of the tool in headless Chrome on
 * 7 October 2026 against a local server of the site, driven through the
 * page as a person would (build/video/tests/runs.js, log in the wave's
 * notes). The inputs are the test videos build/video/tests/_kit.js makes,
 * which are the same on every run: clip.mp4 is 640 × 360 at 30 fps for 6
 * seconds with AAC sound and a keyframe every second (203,457 bytes);
 * big.mp4 is 1280 × 720 at 30 fps for 10 seconds with a band of moving
 * noise (5,671,524 bytes); clip.mov is clip.mp4 with the QuickTime brand.
 * Sizes depend on the browser's encoders and will differ a little in
 * another browser.
 */
'use strict';

module.exports = {
  '/video/video-compressor/': {
    term: 'video compression',
    whatIs: [
      'A video file’s size is its bitrate times its length: ten minutes at 8 megabits a second is about 600 MB. Compressing means encoding the pictures again with fewer bits a second, so the encoder keeps less fine detail and describes more of each frame as movement from the one before.',
      'Resolution and frame rate decide how many pixels must be described each second, so lowering them shrinks a file without making each frame blockier.'
    ],
    howItWorks: {
      text: 'The pictures are decoded with `VideoDecoder`, encoded again as H.264 with `VideoEncoder`, and boxed into an MP4 by mp4-muxer.',
      points: [
        'For a target size the picture gets what is left of the target after the sound and 2% for the MP4’s own boxes, spread over the length.',
        'A pass over the target is encoded again with the bitrate cut by the overshoot, up to three passes; when a cut stops shrinking the file, the page says so.',
        'The quality levels are bits per pixel per frame: 0.10 for High, 0.06 for Balanced and 0.035 for Small.',
        'Kept sound is never decoded: its AAC or Opus packets go into the new file with their own timestamps.'
      ]
    },
    worked: {
      text: 'A 10-second 1280 × 720 test video of 5.41 MB, aimed at 2.7 MB with its sound kept, came out at 2.68 MB (51% smaller) after 2 passes: the picture at 2.11 Mbit/s where the original had 4.40 Mbit/s. The same file at Balanced, 480p, 15 fps and 96 kbit/s sound came out at 824.6 KB, 85% smaller.'
    },
    uses: [
      ['Job and course applications', 'Video statements often have an upload cap; aim the target just under it.'],
      ['Phone storage', 'Keep a lighter copy of long clips and move the originals to a computer.'],
      ['Slow connections', 'A 480p copy at 15 fps sends quickly over a weak mobile signal.']
    ],
    mistakes: [
      'Squeezing a video saved from a messaging app. It has been compressed once already; a second pass mostly costs detail.',
      'Asking for a tiny file at full resolution. Choose a lower resolution first; the page flags a target that leaves under 0.018 bits per pixel per frame.'
    ],
    faq: [
      { q: 'Does compressing a video lower its resolution?', a: 'Only if you choose a lower one. Left at Original, the 1280 × 720 test video stayed 1280 × 720.' },
      { q: 'What bitrate does a 1080p video need?', a: 'At 30 fps, Balanced works out at 0.06 × 1920 × 1080 × 30, about 3.7 Mbit/s, and High at about 6.2 Mbit/s. Talking heads and screen recordings look fine with far less; sport and confetti need more.' },
      { q: 'Is the sound made smaller too?', a: 'Only when you pick 128 or 96 kbit/s. Kept as it is, the sound is copied without change.' }
    ],
    runs: [
      { browser: { input: 'big.mp4 (build/video/tests/runs.js)', seconds: 10, width: 1280, height: 720, mode: 'size', target: '2.7 MB', resolution: 'Original', fps: 'Original', sound: 'Keep it as it is' }, shown: ['5.41 MB', '2.68 MB', '51% smaller', '2 passes', '2.11 Mbit/s', '4.40 Mbit/s'] },
      { browser: { input: 'big.mp4', mode: 'quality', quality: 'Balanced', resolution: '480p', fps: '15 fps', sound: '96 kbit/s' }, shown: ['824.6 KB', '85% smaller'] }
    ]
  },

  '/video/video-trimmer/': {
    term: 'trimming a video',
    whatIs: [
      'Trimming keeps one stretch of a video and drops the rest. The difficulty is that a compressed video does not store every picture whole: most frames record only what changed since an earlier one, and only keyframes can be shown on their own.',
      'So there are two honest ways to cut. Copy the stored frames from a keyframe onwards, which is lossless but starts on that keyframe, or decode the stretch and encode it again, which starts on any frame you like.'
    ],
    howItWorks: {
      text: 'The file’s index gives every frame’s time, so the handles move from frame to frame rather than by guessed fractions of a second.',
      points: [
        'Exact decodes from the keyframe before your start, throws away the frames before it, and encodes the rest with `VideoEncoder` at a little above the original bitrate.',
        'Fast copies the samples between the keyframe at or before your start and your end into a new file, unchanged.',
        'The sound’s packets for the same stretch are copied in both modes, so it stays in step with the picture.',
        'The preview player is moved a quarter of a frame past the handle, so it shows that frame rather than the one before it.'
      ]
    },
    worked: {
      text: 'From the 6-second test clip, 1.5 s to 3.2 s cut Exact gave clip-trimmed.mp4: 1.700 s and 56.6 KB, starting on the frame at 1.500 s. Cut Fast, the page warned that the keyframe at 0:01.000 is 0.500 s before the start, and the copy came out at 2.200 s and 75.3 KB.'
    },
    uses: [
      ['Evidence clips', 'Keep the exact seconds that show a fault, for a landlord, an insurer or a support desk.'],
      ['Teaching', 'Cut a long lecture recording into the parts each lesson needs.'],
      ['Highlights', 'Lift the best moment from a match or a performance without losing quality.']
    ],
    mistakes: [
      'Expecting Fast to start on any frame. It can only begin where a picture is stored whole; read the line under the cutting method before trimming.',
      'Trimming a phone video before compressing it, then compressing again. Cut with Exact and the right quality once, rather than re-encoding twice.'
    ],
    faq: [
      { q: 'Why is the Fast copy longer than my selection?', a: 'Because it starts on the keyframe before your start. In the test clip, with a keyframe every second, a start at 1.5 s became 1.0 s.' },
      { q: 'Can I cut a piece out of the middle?', a: 'Not in one step: trim the two parts you want to keep, one at a time, and keep both files.' },
      { q: 'Does Exact lose quality?', a: 'A little, as any re-encoding does, but it is encoded at slightly above the original’s bitrate so the difference is hard to see.' }
    ],
    runs: [
      { browser: { input: 'clip.mp4 (build/video/tests/runs.js)', start: 1.5, end: 3.2, mode: 'exact' }, shown: ['1.700 s', '56.6 KB', '1.500'] },
      { browser: { input: 'clip.mp4', start: 1.5, end: 3.2, mode: 'fast' }, shown: ['0:01.000', '0.500 s', '2.200 s', '75.3 KB'] }
    ]
  },

  '/video/video-converter/': {
    term: 'converting a video',
    whatIs: [
      'A video file is a container — MP4, MOV, MKV, WebM — holding a picture track and a sound track, each compressed by a codec such as H.264, HEVC, VP9, AAC or Opus. The container’s name says little about what is inside: a MOV from an iPhone and an MP4 from a camera can hold the very same H.264 pictures.',
      'Converting therefore has two possible meanings. When the tracks inside already suit the new container they can simply be moved into it; when they do not, they must be decoded and encoded again in a codec the new container accepts.'
    ],
    howItWorks: {
      text: 'Before you press anything the page reads the file’s index, names its codecs, and says whether the tracks can be moved as they are.',
      points: [
        'MP4 accepts H.264, HEVC, VP9 and AV1 pictures with AAC or Opus sound; WebM accepts VP8, VP9 and AV1 with Opus or Vorbis. Tracks on those lists are copied sample by sample.',
        'Anything else is re-encoded: H.264 for MP4, VP9 for WebM, through WebCodecs.',
        'Sound that does not suit the new container is re-encoded as AAC for MP4 and as Opus for WebM.',
        'A copied file keeps every frame and sample exactly; only the boxes around them are new.'
      ]
    },
    worked: {
      text: 'The test clip saved as a QuickTime MOV (198.7 KB, H.264 and AAC) became clip.mp4 by copying alone: 198.7 KB, “Repackaged: the picture (H.264) and sound (AAC) were copied untouched.” The same clip converted to WebM was re-encoded as VP9 with Opus sound and came out at 228.3 KB.'
    },
    uses: [
      ['Uploading to forms', 'Many upload forms list MP4 only; a repackaged MOV gets through.'],
      ['Windows playback', 'Older Windows players stumble on MOV and WebM files that an MP4 copy plays.'],
      ['Embedding in a page', 'Serve a WebM beside the MP4 for browsers that prefer it.']
    ],
    mistakes: [
      'Renaming a .mov to .mp4 by hand. Some players accept it, many refuse it; repackaging writes a real MP4 index.',
      'Converting to WebM for a phone. Phones and editors expect MP4; WebM is for web pages.'
    ],
    faq: [
      { q: 'Is a re-encoded file smaller?', a: 'It can be either. A copy is the same size give or take the boxes; a re-encode depends on the quality chosen. To make a file smaller on purpose, use the Video Compressor.' },
      { q: 'Which formats can it write?', a: 'MP4 and WebM only. MP4 plays on almost everything and WebM covers the web; MKV and AVI are not offered.' },
      { q: 'What happens to subtitles and chapters?', a: 'They are left out: the new file holds one picture track and one sound track.' }
    ],
    runs: [
      { browser: { input: 'clip.mov (build/video/tests/runs.js)', format: 'mp4', copy: true }, shown: ['198.7 KB', 'Repackaged: the picture (H.264) and sound (AAC) were copied untouched.'] },
      { browser: { input: 'clip.mp4', format: 'webm', copy: true }, shown: ['228.3 KB'] }
    ]
  },

  '/video/mute-video/': {
    term: 'muting a video',
    whatIs: [
      'Muting here means removing the sound track itself, not turning it down. The new file holds the picture alone, so no player, editor or social site can bring the old sound back.',
      'Because the picture does not need to change, it does not need to be decoded either: its stored frames are copied into a new container exactly as they were.'
    ],
    howItWorks: {
      text: 'The page reads the file’s index, keeps the picture track’s list of samples and writes a new container around them.',
      points: [
        'The samples are read from your disk in batches of up to 4 MB and written into an MP4 (for MP4, MOV and MKV files) or a WebM (for WebM files).',
        'Each frame keeps its own timestamp and keyframe flag, so seeking works as before.',
        'A phone video’s rotation flag is carried over, so an upright video stays upright.',
        'Only a picture codec the new container cannot hold is re-encoded, and the page says so before you start.'
      ]
    },
    worked: {
      text: 'The 6-second test clip of 198.7 KB came out as clip-muted.mp4 at 102.8 KB: the same picture, played back frame for frame, and no sound track at all. The difference is almost exactly what its 128 kbit/s sound took up.'
    },
    uses: [
      ['Product demos', 'Silent clips autoplay on most web pages and in social feeds without being blocked.'],
      ['Classroom screens', 'Show a clip without its commentary while you talk over it.'],
      ['Before adding a voice-over', 'Start from a clean picture so the old sound does not leak through.']
    ],
    mistakes: [
      'Muting the original by mistake. The tool never changes your file; it saves a new one, so keep both until you are sure.',
      'Muting to hide something said, then posting the original. Share the muted copy only.'
    ],
    faq: [
      { q: 'Can I mute only part of a video?', a: 'Not yet: the whole sound track is removed. Trim the part you want first if only that part matters.' },
      { q: 'Will the muted video play on my phone?', a: 'Yes. Nothing about the picture changes, so whatever played the original plays the muted copy.' },
      { q: 'Can I replace the sound with music?', a: 'Not here. Mute the video, then add music in the app where you post it, which also keeps you within its music licence.' }
    ],
    runs: [
      { browser: { input: 'clip.mp4 (build/video/tests/runs.js)', seconds: 6, soundKbps: 128 }, shown: ['198.7 KB', '102.8 KB', 'clip-muted.mp4'] }
    ]
  },

  '/video/extract-audio/': {
    term: 'extracting a video’s sound',
    whatIs: [
      'The sound in a video is a separate track, usually AAC in an MP4 or MOV and Opus in a WebM. Extracting it means writing that track into a file of its own that music players, editors and transcription tools open directly.',
      'When the sound is copied out rather than decoded, the new file holds exactly the bytes that were in the video, so there is no loss and nothing to wait for.'
    ],
    howItWorks: {
      text: 'The page lists only the formats it can honestly make from this file’s sound, with the untouched copy first when there is one.',
      points: [
        'AAC is copied into an M4A container by mp4-muxer; Opus is copied into Ogg pages written by the page itself, with each page’s checksum and sample count.',
        'For WAV the sound is decoded with `AudioDecoder` and written as 16-bit samples at its own rate.',
        'For Opus the decoded sound is resampled to 48 kHz and encoded with `AudioEncoder`.',
        'From and To cut a WAV or Opus file to the sample: 2 s to 4 s of 48 kHz sound is exactly 96,000 samples.'
      ]
    },
    worked: {
      text: 'From the 6-second test clip (AAC, 48 kHz, stereo), the untouched copy gave clip.m4a at 96.0 KB; WAV gave clip.wav at 1.10 MB; Opus at 64 kbit/s gave clip.ogg at 48.2 KB. All three decode to the clip’s own six notes in the right order.'
    },
    uses: [
      ['Lecture recordings', 'Listen to a recorded class on the way home without the screen on.'],
      ['Sampling your own footage', 'Lift a sound effect or a line of dialogue for an edit.'],
      ['Meeting minutes', 'Hand the sound of a recorded meeting to whoever writes the notes.']
    ],
    mistakes: [
      'Choosing WAV to make a file smaller. WAV is uncompressed and far larger than the sound inside the video.',
      'Re-encoding sound that could be copied. Every encode loses a little; the untouched copy loses nothing.'
    ],
    faq: [
      { q: 'Which format should I choose for a podcast?', a: 'The untouched copy if it is offered, or Opus at 64 kbit/s for speech. Both are a small fraction of a WAV’s size.' },
      { q: 'Does the M4A keep the same quality as the video?', a: 'Yes, exactly: the AAC packets are copied byte for byte.' },
      { q: 'Can I take the sound from several videos?', a: 'One video at a time, each saved as its own file.' }
    ],
    runs: [
      { browser: { input: 'clip.mp4 (build/video/tests/runs.js)', format: 'original' }, shown: ['clip.m4a', '96.0 KB'] },
      { browser: { input: 'clip.mp4', format: 'wav' }, shown: ['clip.wav', '1.10 MB'] },
      { browser: { input: 'clip.mp4', format: 'opus', rate: '64' }, shown: ['clip.ogg', '48.2 KB'] },
      { browser: { input: 'clip.mp4', format: 'wav', from: 2, to: 4 }, shown: ['96,000 samples'] }
    ]
  },
  '/video/video-resizer/': {
    term: 'resizing a video',
    whatIs: [
      'Resizing changes a video’s frame: fewer pixels for a smaller file, or a different shape for a different screen. A phone held upright wants 9:16, a feed often wants a square or 4:5, a laptop wants 16:9.',
      'Changing the shape means deciding what to do with the difference. The picture can be fitted whole with something filling the gaps, cropped so it fills the new frame, or stretched, which distorts it.'
    ],
    howItWorks: {
      text: 'Each frame is decoded, turned upright if the file says it is rotated, and drawn into the new frame by one layout function that the preview uses too.',
      points: [
        'Fit scales the picture to fit inside the frame and centres it; the gaps take either a blurred copy (the frame shrunk to a 24th and drawn back up, darkened by 35%) or a plain colour.',
        'Crop to fill scales the picture to cover the frame and cuts the overflow, from the left or top at 0% to the right or bottom at 100%.',
        'Sizes are rounded down to even numbers of pixels, which H.264 needs.',
        'The frames are encoded as H.264 and boxed with the copied sound into an MP4.'
      ]
    },
    worked: {
      text: 'The 640 × 360 test clip set to 9:16 at a short side of 360 px came out as clip-360x640.mp4, 360 × 640, its sound copied. As a 1:1 crop from 0% it was 360 × 360 and kept the red block at the bottom left.'
    },
    uses: [
      ['Digital signage', 'Fit a landscape advert to a portrait screen in a shop window.'],
      ['Presentation slides', 'Bring an old 4:3 clip to 16:9 without stretching it.'],
      ['Old camcorder footage', 'Bring a 4:3 home video to a modern 16:9 frame.']
    ],
    mistakes: [
      'Cropping a video with text at the edges into a narrow shape. Check the preview: the words may be cut.',
      'Choosing a larger size to sharpen a soft video. It only makes the file bigger.'
    ],
    faq: [
      { q: 'Which shape suits which platform?', a: '9:16 for stories, reels and shorts; 1:1 or 4:5 for feeds; 16:9 for video sites, presentations and TVs.' },
      { q: 'Why is the size slightly different from what I typed?', a: 'Widths and heights are rounded down to even numbers, as H.264 requires.' },
      { q: 'Can I resize several videos at once?', a: 'One at a time; the settings stay as you left them for the next.' }
    ],
    runs: [
      { browser: { input: 'clip.mp4 (640 × 360, build/video/tests/video-more.js)', shape: '9:16', short: 360, mode: 'blur' }, shown: ['clip-360x640.mp4', '360 × 640'] },
      { browser: { input: 'clip.mp4', shape: '1:1', short: 360, mode: 'fill', pos: 0 }, shown: ['360 × 360'] }
    ]
  },

  '/video/video-to-frames/': {
    term: 'extracting frames',
    whatIs: [
      'A video is a series of still pictures shown in quick succession, 24 to 60 a second. Extracting frames saves some of those stills as ordinary image files that any viewer or editor opens.',
      'The difficulty is precision. A compressed video stores most frames as changes from earlier ones, so pulling out the picture at an exact moment means decoding from the keyframe before it, frame by frame, up to that moment.'
    ],
    howItWorks: {
      text: 'The file’s index gives every frame’s time; the frames wanted are chosen from it, then decoded in one pass.',
      points: [
        'Every frame takes the index’s frames between From and To; one every so many seconds and a number spread evenly pick the frame on screen at each time.',
        '`VideoDecoder` decodes from the keyframe before the first wanted frame and keeps each frame that is on screen at a wanted time.',
        'Each frame is drawn upright on a canvas at the video’s own size and saved with `canvas.toBlob` as PNG, or as JPEG at quality 0.92.',
        'Several are packed into a ZIP, each named with its frame number and the time it starts.'
      ]
    },
    worked: {
      text: 'From the 6-second test clip, every frame from 1.0 s to 1.5 s gave 15 PNGs, clip-frame-030-1_000s.png to clip-frame-044-1_467s.png, each showing its own frame number. One every 2 s gave frames 0, 60 and 120; the frame paused at 3.51 s was frame 105.'
    },
    uses: [
      ['Training material', 'Stills of each step of a procedure for a printed guide.'],
      ['Storyboards', 'One frame a second of a scene, to plan an edit.'],
      ['Photo prints', 'A sharp still from a holiday video, at full resolution.']
    ],
    mistakes: [
      'Taking every frame of a long video. A minute is well over a thousand pictures; take one every few seconds instead.',
      'Saving thumbnails as PNG. JPEG is a fraction of the size and looks the same at thumbnail size.'
    ],
    faq: [
      { q: 'Why does a frame look blurred?', a: 'Movement in that frame was blurred when it was filmed; try a frame or two either side.' },
      { q: 'Are the times in the names exact?', a: 'They are the times at which those frames start, from the video’s own index, to the millisecond.' },
      { q: 'Can I get frames from a WebM?', a: 'Yes: MP4, MOV, WebM and MKV are all read.' }
    ],
    runs: [
      { browser: { input: 'clip.mp4 (6 s at 30 fps)', what: 'every', from: '1.0', to: '1.5', format: 'png' }, shown: ['15 PNGs', 'clip-frame-030-1_000s.png', 'clip-frame-044-1_467s.png'] },
      { browser: { input: 'clip.mp4', what: 'interval', interval: 2 }, shown: ['0, 60 and 120'] },
      { browser: { input: 'clip.mp4', what: 'current', at: 3.51 }, shown: ['3.51 s', 'frame 105'] }
    ]
  },

  '/video/screen-recorder/': {
    term: 'recording a screen',
    whatIs: [
      'A browser can record a screen, a window or a tab once you choose what to share in its own picker; the page never sees anything you did not pick, and the browser shows that sharing is on.',
      'The recording is compressed as it is made, so a long recording of a quiet screen stays small: little changes from one frame to the next.'
    ],
    howItWorks: {
      text: 'The page asks the browser for a screen with `getDisplayMedia`, and records it with `MediaRecorder` as the browser chooses.',
      points: [
        'The tab’s or the system’s sound, where the browser shares it, comes with the picture.',
        'When the microphone is wanted too, both sounds are mixed into one track with Web Audio, because a recording takes one sound track.',
        'The browser hands over a piece of the recording every second; the page counts the time and the size as they arrive.',
        'Make an MP4 decodes the WebM in the page and encodes it again as H.264 with AAC sound.'
      ]
    },
    worked: {
      text: 'In Chrome with its test screen and microphone, a recording of about 2.5 s came out as a WebM with one picture track and one mixed sound track; Make an MP4 turned it into screen-recording-1.mp4 at 800 × 450 with AAC sound.'
    },
    uses: [
      ['Software training', 'A recorded walkthrough new staff can watch at their own pace.'],
      ['Online classes', 'Record a lesson you present over a video call.'],
      ['Support requests', 'Show the exact clicks that lead to an error.']
    ],
    mistakes: [
      'Sharing the whole screen when one tab would do. Private messages and notifications end up in the recording.',
      'Forgetting the sound box in the browser’s picker. Without it the tab’s sound is not shared at all.'
    ],
    faq: [
      { q: 'Can I record a game or a film?', a: 'Pages playing protected films often show black when shared; games in another window record like any window.' },
      { q: 'Why is my recording a WebM?', a: 'That is what Chrome, Edge and Firefox record. Make an MP4 converts it on your device.' },
      { q: 'Does it record the mouse pointer?', a: 'When you share a screen or a window, the browser includes the pointer; a shared tab shows it where the browser supports that.' }
    ],
    runs: [
      { browser: { input: 'Chrome --use-fake-device-for-media-stream (its test screen and microphone)', sound: true, mic: true, seconds: 2.5 }, shown: ['screen-recording-1.mp4', '800 × 450'] }
    ]
  },

  '/video/webcam-recorder/': {
    term: 'recording from a webcam',
    whatIs: [
      'A webcam recording in the browser needs no app: the page asks for the camera and microphone, the browser asks you, and the picture goes from the camera to the page, which records it.',
      'Cameras offer a few fixed sizes. When the one asked for is not among them, the browser picks the nearest, which is why the page reports the size of the recording itself.'
    ],
    howItWorks: {
      text: 'The camera is opened with `getUserMedia`, asking for the resolution chosen at 30 frames a second, with the microphone if wanted.',
      points: [
        'The preview is the live camera, mirrored by a CSS transform only; the recording receives the frames unmirrored.',
        '`MediaRecorder` records the camera and microphone together, a piece every second.',
        'When the recording stops, its own index is read, and the size it was really recorded at is shown beside it.',
        'Make an MP4 decodes the WebM and encodes it again as H.264 with AAC sound, at that size.'
      ]
    },
    worked: {
      text: 'In Chrome with its test camera set to 480p, the preview showed 853 × 480 while the recording itself came out at 1280 × 720, which the page said beside the file; Make an MP4 gave webcam-recording-1.mp4 at 1280 × 720 with 2.47 s of sound.'
    },
    uses: [
      ['Customer testimonials', 'A short message to camera to send to a business.'],
      ['Sign language and gestures', 'A clip that shows hands clearly, recorded at the size the camera gives.'],
      ['Remote interviews', 'Answer a set of questions on camera to send to an employer.']
    ],
    mistakes: [
      'Sitting with a bright window behind you. The camera exposes for the window and your face goes dark.',
      'Recording a long message without testing. Make a five-second test first and watch it back.'
    ],
    faq: [
      { q: 'Why is the recording bigger than the resolution I chose?', a: 'The camera did not offer that size and gave its nearest; the page shows the size actually recorded.' },
      { q: 'Can I use a phone’s front camera?', a: 'Yes, in the phone’s browser; the Camera list shows the front and back cameras once allowed.' },
      { q: 'Does the camera stay on?', a: 'Only while the page uses it. Stop turns it off, and the browser’s indicator goes out.' }
    ],
    runs: [
      { browser: { input: 'Chrome --use-fake-device-for-media-stream (its test camera)', res: '480p', mic: true }, shown: ['853 × 480', '1280 × 720', 'webcam-recording-1.mp4', '2.47 s'] }
    ]
  }
};
