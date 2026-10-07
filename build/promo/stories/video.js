'use strict';
/* Kit v2 story data: Video Tools (/video/). Contract: kit2-schema.md, sections 1 and 2.
   Every claim here is one the tool pages make and build/tests/claims/video.js or
   build/video/tests/video-tools.js checks: nothing uploaded, untouched copies where
   the codecs allow, the routes said on the page. The example figures are real runs on
   the test videos (build/video/tests/runs.js, 7 October 2026). */
module.exports = {
  '/video/video-compressor/': {
    persona: 'Anyone with a phone video too big to email, upload or send',
    hook: 'Too big to send? Pick the size. Get the video.',
    pain: 'Upload forms and email cap the size, and guessing at bitrates means trying again and again.',
    usual: ['Exporting again and again at lower settings', 'Uploading the video to a converter site', 'Cutting the video short to fit'],
    promise: 'Type the size you need; the video comes out at or under it, and the page says how many passes it took.',
    steps: ['Choose the video', 'Type a size in MB or pick a quality', 'Download the smaller MP4'],
    proof: ['Free', 'Nothing uploaded', 'Size before and after'],
    example: { kind: 'schematic', input: 'A 10-second 1280 × 720 video of 5.41 MB', output: 'An MP4 of 2.68 MB, under a 2.7 MB target', sampleIn: '5.41 MB, aim for 2.7 MB, sound kept', sampleOut: '2.68 MB in 2 passes, 51% smaller' },
    howTo: 'How to compress a video to a file size, free',
    cta: 'Compress a video'
  },
  '/video/video-trimmer/': {
    persona: 'People sharing one moment from a longer clip',
    hook: 'Cut a video to the frame. Or cut it without losing a pixel.',
    pain: 'Phone editors trim by dragging a thumb, and most online trimmers re-encode everything.',
    usual: ['Dragging a fiddly slider on a phone', 'Re-encoding the whole video to cut a second', 'Uploading the video to a trimming site'],
    promise: 'Step the start and end a frame at a time; cut exactly, or copy the part untouched.',
    steps: ['Choose the video', 'Set the start and end, frame by frame', 'Trim and download'],
    proof: ['Free', 'Nothing uploaded', 'Lossless option'],
    example: { kind: 'schematic', input: 'A 6-second clip, keep 1.5 s to 3.2 s', output: 'A 1.700 s clip starting on the chosen frame', sampleIn: 'Start 1.5 s, end 3.2 s, Exact', sampleOut: '1.700 s, 56.6 KB' },
    howTo: 'How to trim a video to the exact frame, free',
    cta: 'Trim a video'
  },
  '/video/video-converter/': {
    persona: 'iPhone and Mac users with MOV files, and anyone with a WebM',
    hook: 'MOV to MP4 in seconds, without re-encoding.',
    pain: 'A form or an app refuses the MOV or WebM, and converter sites want the file uploaded first.',
    usual: ['Uploading the video to a converter site', 'Installing a desktop converter', 'Renaming .mov to .mp4 and hoping'],
    promise: 'When the codecs already fit, the tracks are copied into a real MP4 untouched; otherwise they are re-encoded, and the page says which.',
    steps: ['Choose the MOV, MKV, WebM or MP4', 'Pick MP4 or WebM', 'Convert and download'],
    proof: ['Free', 'Nothing uploaded', 'Lossless where the codecs allow'],
    example: { kind: 'schematic', input: 'A MOV with H.264 picture and AAC sound', output: 'An MP4 with both tracks copied untouched', sampleIn: 'clip.mov, 198.7 KB', sampleOut: 'clip.mp4, 198.7 KB, repackaged' },
    howTo: 'How to convert MOV to MP4 without losing quality',
    cta: 'Convert a video'
  },
  '/video/mute-video/': {
    persona: 'People posting clips with sound they cannot or should not share',
    hook: 'Remove the sound. Keep every frame exactly.',
    pain: 'Background music gets posts blocked, and what was said behind the camera was not meant for everyone.',
    usual: ['Turning the volume to zero in an app (the sound is still there)', 'Re-exporting the whole video from an editor', 'Uploading it to an online editor'],
    promise: 'The picture is copied into a new file untouched; the sound track is removed, not turned down.',
    steps: ['Choose the video', 'Press Remove the sound', 'Download the silent copy'],
    proof: ['Free', 'Nothing uploaded', 'Picture copied untouched'],
    example: { kind: 'schematic', input: 'A 6-second clip with sound, 198.7 KB', output: 'The same picture with no sound track', sampleIn: 'clip.mp4, 198.7 KB', sampleOut: 'clip-muted.mp4, 102.8 KB' },
    howTo: 'How to remove the sound from a video',
    cta: 'Mute a video'
  },
  '/video/video-resizer/': {
    persona: 'Anyone posting one video on platforms that want different shapes',
    hook: 'Landscape in. Vertical out. No black bars.',
    pain: 'Every platform wants a different shape, and black bars or a stretched picture look careless.',
    usual: ['Rebuilding the edit for each shape', 'Accepting black bars', 'Uploading the video to an online resizer'],
    promise: 'Any shape and size, the picture over its own blurred copy, cropped or on a colour.',
    steps: ['Choose the video', 'Pick the shape and size', 'Download the MP4'],
    proof: ['Free', 'Nothing uploaded', 'Sound kept'],
    example: { kind: 'schematic', input: 'A 640 × 360 clip', output: 'A 360 × 640 vertical MP4 over a blurred copy', sampleIn: '16:9, 640 × 360', sampleOut: 'clip-360x640.mp4' },
    howTo: 'How to make a landscape video vertical without black bars',
    cta: 'Resize a video'
  },
  '/video/video-to-frames/': {
    persona: 'Editors, teachers and anyone who needs a still from a video',
    hook: 'The exact frame, as a full-size picture.',
    pain: 'A screenshot of a paused player is the wrong size, has the controls in it and misses the moment.',
    usual: ['Pausing and taking a screenshot', 'Installing an editor to export one frame', 'Uploading the video to a frame grabber'],
    promise: 'Every frame, one every few seconds, or the one on screen, as PNG or JPEG at full size.',
    steps: ['Choose the video', 'Pick which frames', 'Download the pictures'],
    proof: ['Free', 'Nothing uploaded', 'Frame-accurate'],
    example: { kind: 'schematic', input: 'Half a second of a 30 fps clip', output: '15 PNGs, each named by frame and time', sampleIn: '1.0 s to 1.5 s, every frame', sampleOut: 'clip-frame-030-1_000s.png …' },
    howTo: 'How to extract frames from a video as images',
    cta: 'Take frames'
  },
  '/video/screen-recorder/': {
    persona: 'Teachers, support staff and anyone showing how something works',
    hook: 'Record your screen and your voice. In the browser.',
    pain: 'Screen recorders mean installing an app, and online ones upload what is on your screen.',
    usual: ['Installing a screen-recording app', 'Online recorders that upload the recording', 'Recording the screen with a phone'],
    promise: 'A screen, window or tab with its sound and your microphone, kept in the page until you save it.',
    steps: ['Press Start recording', 'Choose what to share', 'Stop and download, or make an MP4'],
    proof: ['Free', 'Nothing uploaded', 'Voice mixed in'],
    example: { kind: 'schematic', input: 'A shared screen with its sound and a microphone', output: 'A WebM, and an MP4 with AAC sound', sampleIn: 'Sound and microphone ticked', sampleOut: 'screen-recording-1.mp4' },
    howTo: 'How to record your screen with audio in the browser',
    cta: 'Record your screen'
  },
  '/video/webcam-recorder/': {
    persona: 'Job seekers, teachers and anyone sending a video message',
    hook: 'Record yourself. Keep the video.',
    pain: 'Camera apps hide the file, and online recorders upload the video before you can save it.',
    usual: ['Recording on a phone and emailing it to yourself', 'Installing a camera app', 'Online recorders that upload the video'],
    promise: 'Choose the camera, see a mirrored preview, record and save — as recorded or as an MP4.',
    steps: ['Show the camera', 'Record, pause, stop', 'Download the video'],
    proof: ['Free', 'Nothing uploaded', 'Mirrored preview'],
    example: { kind: 'schematic', input: 'A webcam and a microphone', output: 'A WebM, and an MP4 at the size recorded', sampleIn: '480p asked, microphone on', sampleOut: 'webcam-recording-1.mp4' },
    howTo: 'How to record a video with your webcam, free',
    cta: 'Record your webcam'
  },
  '/video/extract-audio/': {
    persona: 'Podcasters, students and anyone who wants the sound of a video',
    hook: 'The sound of your video, as its own file.',
    pain: 'Recorded lectures, calls and performances are stuck inside video files that music players will not open.',
    usual: ['Playing the video and recording it again', 'Uploading the video to an extractor site', 'Installing an audio editor'],
    promise: 'The original sound copied out untouched, or as WAV, or as a small Opus file.',
    steps: ['Choose the video', 'Pick the original, WAV or Opus', 'Download the sound'],
    proof: ['Free', 'Nothing uploaded', 'Untouched copy where it can'],
    example: { kind: 'schematic', input: 'A 6-second MP4 with AAC sound', output: 'The AAC sound copied into an M4A', sampleIn: 'clip.mp4', sampleOut: 'clip.m4a, 96.0 KB, copied without re-encoding' },
    howTo: 'How to extract the audio from an MP4',
    cta: 'Extract the sound'
  }
};
