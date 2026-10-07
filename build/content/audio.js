/**
 * The reading part of the Audio Tools (/audio/), rendered by build-depth.js
 * in its file-and-text shape (howItWorks in place of formula). Shape and
 * rules: build-depth.js and build/content/_check.js.
 *
 * Every figure comes from a run of the tool in headless Chrome on
 * 7 October 2026 against a local server of the site, driven through the
 * page (build/audio/tests/audio-tools.js and audio-ai.js; their logs are in
 * the wave's notes). The inputs are the test sounds
 * build/audio/tests/_fixtures.js writes from the WAV and FLAC
 * specifications: tone.wav (48 kHz stereo, 6 s, a pitch that steps every
 * second), tone.flac (44.1 kHz stereo, 4 s), gaps.wav (tones with a 1.5 s
 * and a 0.4 s silence, 4.9 s), quiet.wav (a 1 kHz sine at −30 dBFS).
 */
'use strict';

module.exports = {
  '/audio/audio-converter/': {
    term: 'audio conversion',
    whatIs: [
      'A sound file is a stream of samples — 44,100 or 48,000 a second for each channel — either stored as they are (WAV) or compressed by a codec such as MP3, AAC or Opus. Converting decodes whatever the file holds back to plain samples and writes them again in the format you need.',
      'Lossless formats such as WAV and FLAC keep every sample; lossy ones throw away detail the ear is least likely to miss. Going from lossy to lossless makes a file easier to edit, never closer to the original recording.'
    ],
    howItWorks: {
      text: 'The browser’s own decoder (`decodeAudioData`) turns each file into samples at the rate its header names, read from the first bytes of the file, so nothing is resampled by accident.',
      points: [
        'WAV is written directly: a RIFF header and 16-bit samples, interleaved.',
        'M4A goes through `AudioEncoder` (AAC) into an MP4 box by mp4-muxer; Opus goes through `AudioEncoder` into Ogg pages written by the page.',
        'A new sample rate, when chosen, comes from a windowed-sinc resampler that filters out what the lower rate cannot hold.',
        'Each file is converted on its own, so one that fails does not stop the rest.'
      ]
    },
    worked: {
      text: 'A 4-second 44.1 kHz stereo FLAC test file became tone.wav with all 176,400 frames identical to the FLAC’s. The same file saved as 16 kHz mono held 64,000 frames, and a 6-second WAV saved as Opus at 32 kbit/s came to 25,047 bytes.'
    },
    uses: [
      ['Sharing recordings by email', 'An Opus copy of a long WAV recording fits where the original never would.'],
      ['Archive tidying', 'Bring a folder of mixed formats to one format in one go.'],
      ['Old software', 'Some editors and players open WAV only; convert first.']
    ],
    mistakes: [
      'Expecting a WAV made from an MP3 to sound better. It is bigger, not better.',
      'Mixing a stereo music file to mono and losing instruments panned to one side.'
    ],
    faq: [
      { q: 'Is FLAC smaller than WAV?', a: 'Usually about half the size, with exactly the same sound. This tool opens FLAC; to keep files small and lossless, keep the FLAC rather than converting it.' },
      { q: 'Which sample rate should I choose?', a: 'Keep the file’s own unless something asks for another: 44.1 kHz for CDs, 48 kHz for video, 16 kHz for speech recognition.' },
      { q: 'Why does an M4A come out a few hundredths of a second longer?', a: 'AAC starts with a short warm-up of the encoder, about 21 ms at 48 kHz, which players skip; the tone.wav test file read 6.016 s as M4A.' }
    ],
    runs: [
      { browser: { input: 'tone.flac (build/audio/tests/_fixtures.js)', seconds: 4, rate: 44100, kHz: 44.1, format: 'wav', channels: 'keep' }, shown: ['176,400 frames'] },
      { browser: { input: 'tone.flac', format: 'wav', rate: 16000, channels: 1 }, shown: ['64,000 frames'] },
      { browser: { input: 'tone.wav', seconds: 6, format: 'opus', bitrate: 32 }, shown: ['25,047 bytes'] },
      { browser: { input: 'tone.wav', format: 'm4a', bitrate: 128 }, shown: ['6.016 s'] }
    ]
  },

  '/audio/audio-trimmer/': {
    term: 'trimming audio',
    whatIs: [
      'Trimming keeps the part of a recording you want and drops the rest. Because decoded sound is just a row of samples, a cut can fall on any one of them: there are no keyframes to worry about, unlike video.',
      'What can spoil a cut is a click. A wave stopped mid-swing jumps to silence, and that jump is heard; a fade of a few milliseconds hides it.'
    ],
    howItWorks: {
      text: 'The file is decoded once and drawn as a waveform from the loudest and quietest sample in each column of pixels.',
      points: [
        'The handles and the typed times give the start and end in seconds; they are turned into sample positions at the file’s own rate.',
        'Cut the selection out removes those samples and joins what is left with a 10 ms fade on each side of the join.',
        'Fades in and out are linear ramps over the length chosen.',
        'The part is saved as WAV directly, or encoded as M4A or Opus.'
      ]
    },
    worked: {
      text: 'From the 6-second 48 kHz test tone, keeping 2.000 s to 4.000 s gave exactly 96,000 samples per channel, identical to the original’s. Cutting the same stretch out left 192,000 samples, and the join stepped by no more than 0.0008 between samples.'
    },
    uses: [
      ['Answering-machine greetings', 'A short, clean greeting trimmed from a longer take.'],
      ['Class recordings', 'Keep only the part of a lesson a student missed.'],
      ['Sound effects', 'Isolate one clap, chime or door slam for a project.']
    ],
    mistakes: [
      'Trimming right on a loud note with no fade. Add half a second of fade out or cut a little later, where it is quiet.',
      'Saving every intermediate step as M4A. Each encode costs a little; keep WAV until the last save.'
    ],
    faq: [
      { q: 'Can I trim an MP3 without re-encoding it?', a: 'Not here: the sound is decoded, cut and saved again, as WAV with no loss or as M4A or Opus. MP3 itself cannot be written, for licence reasons.' },
      { q: 'Why are the handles in steps of a tenth of a second?', a: 'That is the arrow keys’ step; the ◀ ▶ buttons move 10 ms and you can type any time to the millisecond.' },
      { q: 'Will the waveform show me where words start?', a: 'It shows the loudness: speech appears as bursts with gaps between, which is usually enough to cut between words.' }
    ],
    runs: [
      { browser: { input: 'tone.wav (build/audio/tests/_fixtures.js)', seconds: 6, rate: 48000, start: '2.000', end: '4.000', mode: 'keep', format: 'wav' }, shown: ['96,000 samples'] },
      { browser: { input: 'tone.wav', start: 2, end: 4, mode: 'remove', format: 'wav' }, shown: ['192,000 samples', '0.0008'] }
    ]
  },

  '/audio/audio-joiner/': {
    term: 'joining audio files',
    whatIs: [
      'Joining puts several recordings end to end in one file. Files rarely share a format: one may be a 44.1 kHz mono voice memo, another a 48 kHz stereo music track, and they have to be brought to one sample rate and one channel layout before they can sit side by side.',
      'What goes between them matters too. Speech wants a short gap; music usually wants a crossfade, where one track fades out as the next fades in.'
    ],
    howItWorks: {
      text: 'Every file is decoded first; then the highest sample rate among them becomes the rate of the result.',
      points: [
        'Files at a lower rate are resampled up with a windowed-sinc filter; mono files are copied to both channels when any file is stereo.',
        'A gap is written as silence of the length chosen.',
        'A crossfade overlaps the end of one file with the start of the next along equal-power curves, cosine out and sine in, so the level holds through it.',
        'The whole result is then saved as WAV, M4A or Opus.'
      ]
    },
    worked: {
      text: 'A 4-second 44.1 kHz mono test tone and a 6-second 48 kHz stereo one, joined with a 1-second gap, made an 11-second 48 kHz stereo WAV. In reverse order with a 1-second crossfade the result lasted 9 seconds, and the level in the middle of the fade was 0.212, the same as either side.'
    },
    uses: [
      ['Wedding and event playlists', 'One file of the first-dance songs that plays without gaps.'],
      ['Language lessons', 'Join short drills into one track for practice.'],
      ['Field recordings', 'Stitch the clips a recorder split at its file-size limit.']
    ],
    mistakes: [
      'Joining files of very different loudness. Even them out first with the Volume Normaliser, or the change jars.',
      'Crossfading speech. Words in the overlap become hard to follow; use a gap instead.'
    ],
    faq: [
      { q: 'Does joining lose quality?', a: 'Not as WAV: every file is decoded and placed as it is, apart from resampling the lower-rate ones. M4A and Opus are encoded once, at the end.' },
      { q: 'What sample rate does the result use?', a: 'The highest among the files. Lower-rate files are resampled up, which keeps the better files intact.' },
      { q: 'Why equal-power crossfades?', a: 'Fading two different sounds in straight lines makes the middle of the fade sound quieter; cosine and sine curves keep the combined power steady.' }
    ],
    runs: [
      { browser: { input: 'tone44.wav (4 s, 44.1 kHz mono) then tone.wav (6 s, 48 kHz stereo)', between: 'gap1', format: 'wav', seconds: 11, rate: 48000 }, shown: ['11-second'] },
      { browser: { input: 'tone.wav then tone44.wav', between: 'x1', format: 'wav' }, shown: ['9 seconds', '0.212'] }
    ]
  },

  '/audio/volume-normaliser/': {
    term: 'loudness normalisation',
    whatIs: [
      'Normalising sets a recording to a standard loudness, so it plays at the same level as everything around it. The old way aimed the highest peak at full scale; the modern way, used by broadcasters and streaming services, aims the perceived loudness, measured in LUFS, at a target.',
      'Loudness and peak are different things: a recording with sharp drum hits can peak high and still sound quiet, which is why peak normalising leaves podcasts and songs at such different levels.'
    ],
    howItWorks: {
      text: 'Loudness is measured to ITU-R BS.1770-4 in a worker, then one gain is applied.',
      points: [
        'The sound is K-weighted (a high shelf for the head and a low cut), and its power is averaged over 400 ms blocks that overlap by three quarters.',
        'Blocks quieter than −70 LUFS are ignored, then those more than 10 LU below the average of the rest; what remains gives the integrated loudness.',
        'The true peak is found by oversampling four times, so peaks between samples count.',
        'The gain is the target minus the measurement, cut back if it would lift the true peak above −1 dBTP.'
      ]
    },
    worked: {
      text: 'A 1 kHz sine at −30 dBFS measured −30.0 LUFS, as the EBU test signals predict; set to −16 LUFS it was raised by 14.0 dB and measured −16.0 LUFS afterwards, its peak at −16.007 dBFS.'
    },
    uses: [
      ['Audiobooks', 'Keep every chapter at one level, as audiobook stores expect.'],
      ['Background music for video', 'Set the music to a known level before mixing it under a voice.'],
      ['Comparing takes', 'Bring two takes to one loudness so the better one is judged fairly.']
    ],
    mistakes: [
      'Aiming a very dynamic classical recording at −14 LUFS. Its peaks stop it short; the page says how far, and a lower target suits it better.',
      'Normalising each half of a recording separately, then joining them. Join first, then normalise once.'
    ],
    faq: [
      { q: 'How do dBFS and LU relate?', a: 'Both use decibel steps. dBFS is a level against digital full scale; LU is a step of BS.1770 loudness. Raising a file by 1 dB raises its loudness by 1 LU.' },
      { q: 'Why −1 dBTP and not 0?', a: 'Converting to AAC or Opus, or playing through a phone’s output, can push peaks a little higher; a decibel of room stops that from clipping.' },
      { q: 'Does it change the tone of the sound?', a: 'No. One gain is applied to every sample; nothing is filtered, compressed or limited.' }
    ],
    runs: [
      { browser: { input: 'quiet.wav: a 1 kHz stereo sine at −30 dBFS, 8 s (build/audio/tests/audio-tools.js)', target: -16, format: 'wav' }, shown: ['−30.0 LUFS', '14.0 dB', '−16.0 LUFS', '−16.007 dBFS'] }
    ]
  },

  '/audio/speed-changer/': {
    term: 'changing playback speed',
    whatIs: [
      'Playing a recording faster or slower can be done two ways. Resampling — what a record player does at the wrong speed — changes the pitch along with the time. Time-stretching changes only the time, so a voice at 1.5× still sounds like the same person.',
      'Time-stretching is harder than it sounds, because a wave cut into pieces and pushed closer together will not line up at the joins unless each piece is chosen carefully.'
    ],
    howItWorks: {
      text: 'With Keep the pitch ticked, the sound is stretched by WSOLA in a worker; without it, it is resampled.',
      points: [
        'WSOLA cuts the sound into overlapping 42 ms slices with a smooth window and lays them down every 21 ms in the result.',
        'Each slice is taken from near where the speed says it should come from, at the offset (within 12 ms) whose start best matches how the previous slice would have carried on.',
        'The search runs on a quarter-rate copy of the sound and is then refined to the sample; both channels use the same offsets.',
        'Resampling instead treats the samples as if recorded at rate × speed and converts them back with the same filter the converter uses.'
      ]
    },
    worked: {
      text: 'The 6-second test tone at 1.5× with the pitch kept lasted 192,000 samples at 48 kHz, 4 seconds, and every note stayed at its own pitch. Without Keep the pitch, the same speed gave 4 seconds with the 400 Hz note at 600 Hz, 7.0 semitones higher.'
    },
    uses: [
      ['Transcribing by ear', 'Slow an interview to 0.75× and type along without pausing.'],
      ['Dance and fitness classes', 'Fit a track to the tempo of a routine.'],
      ['Audiobook samples', 'Hear a narrator at the speed you would actually listen.']
    ],
    mistakes: [
      'Speeding up music with heavy drums to 2×. Speech copes far better than percussion with large changes.',
      'Unticking Keep the pitch by accident and wondering why the voice sounds like a cartoon.'
    ],
    faq: [
      { q: 'Does it change the file’s format?', a: 'Only to the one you choose: WAV, M4A or Opus. The sample rate stays the file’s own.' },
      { q: 'How long does it take?', a: 'On a computer, a few seconds for a song; the worker keeps the page responsive while it runs.' },
      { q: 'Can I hear it before saving?', a: 'Yes: the result plays on the page before you download it.' }
    ],
    runs: [
      { browser: { input: 'tone.wav (6 s, 48 kHz; its first note is 400 Hz)', speed: 1.5, keep: true, format: 'wav', firstNote: 400 }, shown: ['192,000 samples'] },
      { browser: { input: 'tone.wav', speed: 1.5, keep: false, format: 'wav' }, shown: ['7.0 semitones', '600'] }
    ]
  },

  '/audio/silence-remover/': {
    term: 'removing silence',
    whatIs: [
      'Silence in a recording is rarely digital zero; it is room noise, breathing and hum at a low level. Removing it means choosing a level below which sound counts as silence, and a length below which a pause is part of the speech and should stay.',
      'Cut too hard and speech sounds breathless, words run into each other and their first sounds are clipped; cut too gently and nothing changes. A little of each gap is worth keeping.'
    ],
    howItWorks: {
      text: 'In a worker, the level of every 10 ms of sound is measured, and runs of quiet are collected.',
      points: [
        'A window is quiet when the root-mean-square level of its loudest channel is below the threshold.',
        'Only runs of quiet windows at least the minimum length count as silences.',
        'From each silence the padding is kept at both ends, plus the pause you asked to leave; the rest is removed.',
        'The kept pieces are joined with 10 ms fades, and the waveform shades what goes before anything is saved.'
      ]
    },
    worked: {
      text: 'A 4.90 s test recording with a 1.5 s and a 0.4 s silence, at −40 dBFS and 0.7 s, gave “1 silence found; 1.20 s will go”: the result lasted 3.70 s, the short pause untouched. Leaving a 0.5 s pause took out 0.70 s instead.'
    },
    uses: [
      ['Presentation rehearsals', 'Hear your talk without the hesitations and see how long it really runs.'],
      ['Phone call recordings', 'Remove the waiting on hold.'],
      ['Training data', 'Trim the dead air from voice samples before using them.']
    ],
    mistakes: [
      'Setting the threshold above the speaker’s quiet words. Watch the shading: if it covers speech, lower the threshold.',
      'Removing every pause from a story. Leave a 0.25 s pause so sentences still breathe.'
    ],
    faq: [
      { q: 'What threshold should I use?', a: 'Begin at −40 dBFS. A noisy room may need −35 or −30; a studio recording can go down to −50 or −60.' },
      { q: 'Does it work on videos?', a: 'It takes the sound of a video and saves a sound file; the picture is not edited.' },
      { q: 'Why keep a little either side?', a: 'Words fade in and out below the threshold. The padding keeps their first and last sounds from being cut.' }
    ],
    runs: [
      { browser: { input: 'gaps.wav (1 s tone, 1.5 s silence, 1 s tone, 0.4 s silence, 1 s tone)', seconds: '4.90', threshold: -40, min: 0.7, pad: 0.15, leave: 0, format: 'wav' }, shown: ['1 silence found; 1.20 s will go', '3.70 s'] },
      { browser: { input: 'gaps.wav', threshold: -40, min: 0.7, pad: 0.15, leave: 0.5 }, shown: ['0.70 s'] }
    ]
  },

  '/audio/voice-recorder/': {
    term: 'recording in the browser',
    whatIs: [
      'Browsers can record a microphone without any plug-in: the page asks for permission, the browser shows that the microphone is on, and the MediaRecorder interface compresses the sound as it arrives.',
      'The format is the browser’s choice. Chrome, Edge and Firefox record Opus in a WebM file; Safari records AAC in an MP4. Both are small and good for speech, and either can be converted afterwards.'
    ],
    howItWorks: {
      text: 'The page asks for the microphone with the browser’s own echo cancellation, noise suppression and automatic gain, unless you switch them off.',
      points: [
        'MediaRecorder is asked for 64 kbit/s and hands the page a piece of the recording every second.',
        'The level bar shows the peak of the last 2,048 samples, redrawn about sixty times a second.',
        'Pause and Resume stop and restart the recording and the clock; the microphone stays open while paused.',
        'Stop closes the microphone and puts the pieces together into one file; Save as decodes it and writes WAV, M4A or Opus.'
      ]
    },
    worked: {
      text: 'In Chrome with its test microphone, a recording paused once and stopped after 3.22 s decoded to 3.18 s of WebM sound at 56 kbit/s; saved as WAV it became recording-1.wav at 48 kHz.'
    },
    uses: [
      ['Feedback for students', 'Record spoken comments on a piece of work.'],
      ['Audition tapes', 'A quick recording of a monologue or a song.'],
      ['Meeting reminders', 'A spoken list of actions while they are fresh.']
    ],
    mistakes: [
      'Closing the tab before downloading. The recording lives only in the page.',
      'Recording music with noise suppression on: it treats held notes as noise.'
    ],
    faq: [
      { q: 'Does it work on a phone?', a: 'Yes, in the phone’s browser, with the same permission prompt. Keep the screen on: some phones pause a page that goes to the background.' },
      { q: 'Can I record the computer’s sound as well?', a: 'Not here: the page records a microphone. Recording a screen with its sound is a separate tool.' },
      { q: 'Is the recording saved anywhere?', a: 'Only in the page’s memory until you download it.' }
    ],
    runs: [
      { browser: { input: 'Chrome --use-fake-device-for-media-stream (its test tone)', pause: 'once', seconds: 3.22, saveAs: 'wav' }, shown: ['3.18 s', '56 kbit/s', 'recording-1.wav', '48 kHz'] }
    ]
  },

  '/audio/text-to-speech/': {
    term: 'speech synthesis',
    whatIs: [
      'Text to speech turns written words into a voice. Modern systems use a neural network trained on recorded speech: it predicts the sound of each phoneme in context, which is why the result has natural rhythm and stress rather than the flat robot voice of older systems.',
      'Kokoro-82M is such a model, small enough to run in a browser: 82 million parameters, stored as 8-bit numbers in a 92 MB file.'
    ],
    howItWorks: {
      text: 'Everything runs in a worker on the device through ONNX Runtime’s WebAssembly build.',
      points: [
        'Words are turned into phonemes with Apache-2.0 dictionaries and letter-to-sound rules, American or British according to the voice.',
        'The model turns the phonemes and the voice’s style vector into 24 kHz samples, a sentence at a time.',
        'The speed setting is passed to the model, which stretches its own timing between 0.8× and 1.2×.',
        'The samples are written as WAV, or encoded as M4A or Opus, with the AI label in the file’s metadata.'
      ]
    },
    worked: {
      text: 'The sentence “Hello and welcome. This is a short test.” in the Heart voice became speech-heart.wav: 2.47 s of speech, made in 7.6 s on a fresh page that first had to load the model from the local server.'
    },
    uses: [
      ['E-learning modules', 'Narrate course slides in a consistent voice.'],
      ['Alt text and notices', 'Give a visual notice an audio version.'],
      ['Prototype voice apps', 'Hear how a menu or a prompt will sound.']
    ],
    mistakes: [
      'Pasting text with headings, page numbers and footnotes. Clean it first, or the voice reads them too.',
      'Using a synthetic voice where listeners would assume a real person. Say that it is synthetic.'
    ],
    faq: [
      { q: 'Does it need an internet connection?', a: 'Only the first time, to fetch the model from this site. Once the browser has kept it, speech is made on your device.' },
      { q: 'Why 24 kHz?', a: 'It is the rate the model was trained to produce. It covers the whole range of speech.' },
      { q: 'Can it read a whole book?', a: 'Up to 5,000 characters at a time; read longer texts in parts and join them with the Audio Joiner.' }
    ],
    runs: [
      { browser: { input: 'Hello and welcome. This is a short test.', voice: 'af_heart', speed: 1, format: 'wav' }, shown: ['speech-heart.wav', '2.47 s', '7.6 s'] }
    ]
  },

  '/audio/audio-to-text/': {
    term: 'speech recognition',
    whatIs: [
      'Speech recognition turns spoken words into text. Whisper, the model used here, listens to 30 seconds at a time: it turns the sound into a picture of its frequencies over time and writes out the words it hears, with their times.',
      'The tiny version of Whisper is about 41 MB, small enough to download once and run in a browser. Larger versions are more accurate but far too heavy for a page.'
    ],
    howItWorks: {
      text: 'The recording is decoded, mixed to mono and resampled to 16 kHz, the rate Whisper expects.',
      points: [
        'Each 30-second window becomes an 80-band log-mel spectrogram, computed in a worker.',
        'The encoder reads the spectrogram; the decoder writes text tokens one at a time, with timestamps, in the chosen or detected language.',
        'Word times come from the decoder’s attention, aligned to the sound by dynamic time warping.',
        'Lines are wrapped for subtitles with the same writer as Auto Captions, and saved as TXT, SRT or VTT.'
      ]
    },
    worked: {
      text: 'A 23-word sentence spoken by Windows’ built-in speech synthesiser came back word for word, all 23 words, in 2.4 s; the Kokoro voice reading the same sentence was transcribed just as well, in 2.5 s.'
    },
    uses: [
      ['Searchable archives', 'Turn a box of recorded talks into text you can search.'],
      ['Accessibility', 'Give a recorded announcement a written version.'],
      ['Quotes for articles', 'Find the exact words from an interview quickly.']
    ],
    mistakes: [
      'Trusting names and numbers without checking. The model guesses spellings it has not heard before.',
      'Transcribing a recording with loud music under the voice. Extract and clean the speech first if you can.'
    ],
    faq: [
      { q: 'What do the times in the transcript mean?', a: 'The minute and second each line starts at, so you can find it in the recording.' },
      { q: 'Can it translate?', a: 'No: it writes the words in the language they were spoken.' },
      { q: 'Why is my transcript in the wrong language?', a: 'Auto-detect guessed from the start of the recording. Choose the language yourself and transcribe again.' }
    ],
    runs: [
      { browser: { input: 'sapi.wav: the sentence in audio-ai.js spoken by PowerShell System.Speech, 16 kHz mono', language: 'en' }, shown: ['23 words', '2.4 s'] },
      { browser: { input: 'kokoro.wav: the same sentence from Text to Speech, Emma', language: 'en' }, shown: ['2.5 s'] }
    ]
  },

  '/audio/waveform-video/': {
    term: 'an audiogram',
    whatIs: [
      'An audiogram is a short video built from a sound clip, made so audio can travel on platforms that show video. It usually pairs a still picture with a title and a waveform that rises and falls with the sound, so a scrolling viewer can see something is being said.',
      'The picture does the job a thumbnail does on a video site; the moving waveform tells people the clip has sound worth turning on.'
    ],
    howItWorks: {
      text: 'The sound is decoded once and its loudness measured every 10 ms; each frame is then drawn on a canvas and encoded on the device.',
      points: [
        'Bars show the loudest point of every 20 ms across the 0.8 s around the frame’s moment; the line style joins the same points.',
        'The cover picture fills the frame and is darkened by 45% so the waveform stands out; without one, the background colour is used.',
        'Frames are encoded as H.264 by `VideoEncoder` and boxed with the sound, as AAC or Opus, by mp4-muxer.',
        'A thin bar along the bottom fills as the clip plays.'
      ]
    },
    worked: {
      text: 'Three seconds of the test recording at 1280 × 720 made an MP4 of 90 frames with its sound. Sampled frames had 9,216 gold pixels in the waveform band while the tone played and 481 during the silence.'
    },
    uses: [
      ['Church and community notices', 'Turn a spoken announcement into a clip for a group chat.'],
      ['Radio clips', 'Share a segment of a show on platforms built for video.'],
      ['Book readings', 'An author reading a passage, with the cover behind.']
    ],
    mistakes: [
      'Using a busy, bright photo as the cover. Even darkened, it competes with the waveform; a calm picture reads better.',
      'Rendering the whole hour of an episode. Pick the best minute; long audiograms are rarely watched.'
    ],
    faq: [
      { q: 'How long does rendering take?', a: 'On a computer usually less time than the clip lasts; 1280 × 720 is quicker than 1080 × 1920.' },
      { q: 'Will the sound be in sync?', a: 'Yes: the frames are drawn from the same timeline the sound is encoded on.' },
      { q: 'Can I add captions?', a: 'Not here. Make the video, then run it through Auto Captions to add the words.' }
    ],
    runs: [
      { browser: { input: 'gaps.wav, 0 to 3 s', size: '1280 x 720', style: 'bars', fps: 30 }, shown: ['90 frames', '9,216', '481'] }
    ]
  }
};
