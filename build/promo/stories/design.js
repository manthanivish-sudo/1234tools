'use strict';
/* Kit v2 story data: Design & Media. Contract: kit2-schema.md, sections 1 and 2.
   4032 × 3024 scaled to 1080 wide gives 810 high (4:3) in the engine. */
module.exports = {
  '/design/aspect-ratio/': {
    persona: 'Video editors and designers',
    hook: 'A 4032 × 3024 photo at 1080 px wide. What height?',
    pain: 'The site wants images 1080 pixels wide, and you need the height that keeps the photo from stretching.',
    usual: ['Cross-multiplying on a sticky note', 'Stretched images from a guessed height', 'Odd heights that video encoders reject'],
    promise: 'Enter the original size and the new width. Get the height and ratio.',
    steps: ['Enter original width and height', 'Enter the new width', 'Read the new height'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { w1: 4032, h1: 3024, w2: 1080 } },
    howTo: 'How to resize while keeping the aspect ratio',
    cta: 'Work out the size'
  }
};
