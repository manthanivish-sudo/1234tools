/**
 * The reading part of the Design calculators, rendered by
 * build-depth.js. Shape and rules: build-depth.js and build/content/_check.js.
 * Every figure is computed with the page's own engine (build/content/_engine.js)
 * and listed in worked.check / checks so the check can recompute it.
 */
'use strict';

module.exports = {
  '/design/aspect-ratio/': {
    term: 'an aspect ratio',
    whatIs: [
      'An aspect ratio is the proportion of width to height, written as two whole numbers such as 16:9. It describes shape, not size: a 1920 × 1080 video and a 1280 × 720 one are both 16:9.',
      'Holding it fixed is what stops a picture or a video looking squashed or stretched when it is resized for a different screen, page or upload limit.'
    ],
    formula: {
      text: 'Width and height are divided by their greatest common divisor to give the simplest ratio. A new height is the new width multiplied by the original height over the original width, and the pixel count in megapixels is width times height divided by a million.',
      expr: [
        'new height = new width × original height ÷ original width',
        'ratio = (W ÷ g) : (H ÷ g), where g = gcd(W, H)',
        'decimal = W ÷ H',
        'megapixels = W × H ÷ 1,000,000'
      ],
      vars: [['W, H', 'original width and height in pixels'], ['g', 'the greatest common divisor of W and H']]
    },
    worked: {
      inputs: { w1: 3000, h1: 2000, w2: 1200 },
      text: 'A 6-megapixel camera frame is 3000 × 2000 pixels. For a blog column 1200 pixels wide, the height that keeps its proportions is 800 pixels. The simplified ratio is 3:2, or 1.5 as a decimal, the same shape as a 6 × 4 inch print, so the photo prints at that size without cropping.',
      check: [['megapixels', '6-megapixel'], ['newHeight', '800 pixels'], ['ratio', '3:2'], ['decimal', '1.5 as a decimal']]
    },
    uses: [
      ['Vertical video', 'A 1080 × 1920 Story scaled to 720 wide becomes 1280 high and stays 9:16.'],
      ['Responsive images', 'Set width and height attributes in the right proportion so a web page reserves the space before the image loads.'],
      ['Printing photos', 'A4 paper is 297 × 210 mm, a decimal of 1.414, so a 3:2 photo printed on it will crop or leave a border.'],
      ['Ultrawide monitors', 'A 2560 × 1080 screen reduces to 64:27, sold as 21:9.']
    ],
    mistakes: [
      'Assuming every screen size is a familiar ratio. 1366 × 768 simplifies to 683:384, not 16:9: the decimal is 1.7786 against 1.7778, close but not equal.',
      'Scaling up past the original. A 1200-pixel-wide copy of an 800-pixel image keeps the shape but not the detail; the calculator gives a size, not new pixels.'
    ],
    faq: [
      { q: 'What aspect ratio is 1920 × 1080?', a: '16:9, or 1.7778 as a decimal. Dividing both sides by their greatest common divisor, 120, gives 16 and 9; the frame holds 2.0736 megapixels.' },
      { q: 'How do I find the width for a given height?', a: 'Swap the roles: put the original height in Original Width, the original width in Original Height, and the target height in New Width. The new height shown is then the width you need: a 1920 × 1080 frame scaled to 1350 high needs a width of 2400.' },
      { q: 'Does changing the aspect ratio reduce quality?', a: 'Changing the ratio means cropping or stretching: cropping throws pixels away and stretching distorts them. Scaling at the same ratio only changes the pixel count, which softens detail when a photo is enlarged.' }
    ],
    checks: [
      { inputs: { w1: 1080, h1: 1920, w2: 720 }, key: 'newHeight', shown: '1280 high' },
      { inputs: { w1: 1080, h1: 1920, w2: 720 }, key: 'ratio', shown: '9:16' },
      { inputs: { w1: 297, h1: 210 }, key: 'decimal', shown: '1.414' },
      { inputs: { w1: 2560, h1: 1080 }, key: 'ratio', shown: '64:27' },
      { inputs: { w1: 1366, h1: 768 }, key: 'ratio', shown: '683:384' },
      { inputs: { w1: 1366, h1: 768 }, key: 'decimal', shown: '1.7786' },
      { inputs: { w1: 1920, h1: 1080 }, key: 'decimal', shown: '1.7778' },
      { inputs: { w1: 1920, h1: 1080 }, key: 'megapixels', shown: '2.0736' },
      { inputs: { w1: 1080, h1: 1920, w2: 1350 }, key: 'newHeight', shown: 'width of 2400' }
    ]
  }
};
