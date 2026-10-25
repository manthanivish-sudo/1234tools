'use strict';
/* Stories for the newer variant pages: single-format converters, size-limit
   compressors, country passport and visa photos, and the PDF size and image
   variants. Every figure is taken from the tool's own page. */
const FREE = ['Free', 'Nothing uploaded'];
const FREE_NW = ['Free', 'Nothing uploaded', 'No watermark'];

module.exports = {
  /* ------------------------------------------------ format converters */
  '/image/png-to-jpg/': {
    persona: 'Anyone whose upload form wants JPG',
    hook: 'The screenshot is a PNG. The form only takes JPG.',
    pain: 'You saved a screenshot or an export and the application form, printer or phone refuses it. A see-through logo turns black when you rename it.',
    usual: ['Renaming the file and hoping', 'Online converters that keep your file', 'Opening an editor just to Save As'],
    promise: 'Drop in PNGs. See-through areas are filled with white or a colour you pick, then JPGs download.',
    steps: ['Drop in the PNG files', 'Pick a fill colour for see-through areas', 'Download the JPGs'],
    proof: FREE,
    howTo: 'How to convert PNG to JPG',
    cta: 'Convert PNG to JPG'
  },
  '/image/jpg-to-png/': {
    persona: 'Designers and anyone filling a print template',
    hook: 'The template wants a PNG. Your photo is a JPG.',
    pain: 'A design tool or print template will only take PNG, and every JPG re-save makes the photo a little worse.',
    usual: ['Screenshotting the photo instead', 'Converters with a watermark on the result', 'Re-saving a JPG again and again'],
    promise: 'Every pixel of the JPG is kept in a lossless PNG. One photo or a batch.',
    steps: ['Drop in the JPG', 'Check the PNG is selected', 'Download the PNG'],
    proof: FREE_NW,
    howTo: 'How to convert JPG to PNG',
    cta: 'Convert JPG to PNG'
  },
  '/image/webp-to-jpg/': {
    persona: 'Anyone who saved a picture from a website',
    hook: 'You saved a picture from a website. It came down as WebP.',
    pain: 'The print shop upload page, the old photo editor and the government portal all say the file type is not supported.',
    usual: ['Screenshotting the picture', 'Converters that email you the result', 'Searching for a plug-in for the editor'],
    promise: 'Turn WebP into a JPG the older software accepts. One file or a batch.',
    steps: ['Drop in the WebP files', 'Keep JPG selected', 'Download the JPGs'],
    proof: FREE,
    howTo: 'How to turn WebP into JPG',
    cta: 'Convert WebP to JPG'
  },
  '/image/jpg-to-webp/': {
    persona: 'Bloggers and shop owners with slow pages',
    hook: 'The page-speed report says: serve images in WebP.',
    pain: 'Your product photos and banners are all JPG, and the report flags every one of them.',
    usual: ['Plug-ins that convert on their server', 'Opening each photo in an editor', 'Ignoring the report'],
    promise: 'Save JPGs as WebP, usually in fewer bytes for the same look. Batches welcome.',
    steps: ['Drop in the JPG photos', 'Keep quality at 92 or change it', 'Download the WebP files'],
    proof: FREE,
    howTo: 'How to convert JPG to WebP',
    cta: 'Convert JPG to WebP'
  },
  '/image/png-to-webp/': {
    persona: 'Web designers with heavy cut-outs',
    hook: 'The cut-out product shot is a PNG. It weighs more than the page.',
    pain: 'A photo with a soft shadow saved as PNG is heavy, and the see-through edges are the reason you used PNG at all.',
    usual: ['Flattening it to JPG and losing the cut-out', 'Online tools that drop the transparency', 'Living with the slow page'],
    promise: 'Convert to WebP and the transparent areas stay transparent, usually far smaller.',
    steps: ['Drop in the PNG', 'Keep WebP and quality 92', 'Download the WebP'],
    proof: FREE,
    howTo: 'How to convert PNG to WebP',
    cta: 'Convert PNG to WebP'
  },
  '/image/avif-to-jpg/': {
    persona: 'Anyone whose software cannot open AVIF',
    hook: 'The file ends in .avif. Nothing on your computer opens it.',
    pain: 'A website or phone saved a picture as AVIF and the desktop program, printer or upload form has never heard of it.',
    usual: ['Hunting for a codec to install', 'Converters that keep a copy', 'Taking a screenshot of it'],
    promise: 'Your browser decodes the AVIF and writes a JPG that software and forms accept.',
    steps: ['Drop in the AVIF file', 'Keep JPG at quality 92', 'Download the JPG'],
    proof: FREE,
    howTo: 'How to convert AVIF to JPG',
    cta: 'Convert AVIF to JPG'
  },
  '/image/gif-to-png/': {
    persona: 'Anyone who needs a still from a GIF',
    hook: 'You need one still from a GIF for a document.',
    pain: 'The editor, the document or the profile picture box wants PNG. The GIF is the only copy you have.',
    usual: ['Screenshotting the GIF mid-loop', 'Converters that make a blurry copy', 'Importing it into a video editor'],
    promise: 'A still GIF converts exactly. An animated one gives its first frame, and the page says which.',
    steps: ['Drop in the GIF', 'Read the message about frames', 'Download the PNG'],
    proof: FREE,
    howTo: 'How to convert a GIF to PNG',
    cta: 'Convert GIF to PNG'
  },
  '/image/bmp-to-jpg/': {
    persona: 'People with old scans and Paint files',
    hook: 'The scan is a 5 MB bitmap. The mailbox says no.',
    pain: 'Old software, a scanner and Paint all saved BMP files, and the email or upload form balks at the size.',
    usual: ['Emailing it in pieces', 'Converters with a file limit', 'Re-scanning at a lower setting'],
    promise: 'Turn BMPs into small JPGs at the same width and height. One file or a whole folder.',
    steps: ['Drop in the BMP files', 'Keep JPG at quality 92', 'Download the JPGs'],
    proof: FREE,
    howTo: 'How to convert BMP to JPG',
    cta: 'Convert BMP to JPG'
  },
  '/image/svg-to-png/': {
    persona: 'Small businesses with a vector logo',
    hook: 'The logo is an SVG. The site only takes PNG.',
    pain: 'Your designer sent an SVG, and the social profile, the app or the slide will not accept it.',
    usual: ['Screenshotting the logo on a white page', 'Converters that add a solid background', 'Asking the designer again'],
    promise: 'The SVG is drawn at its own size and saved as a PNG with the transparent background kept.',
    steps: ['Drop in the SVG', 'Check the size it declares', 'Download the transparent PNG'],
    proof: FREE,
    howTo: 'How to convert an SVG to PNG',
    cta: 'Convert SVG to PNG'
  },
  '/image/heic-to-jpg/': {
    persona: 'iPhone owners sending photos to a portal',
    hook: 'The portal says your iPhone photo is not a valid image.',
    pain: 'iPhone photos are saved as HEIC, and a website or a Windows program turns them down.',
    usual: ['Emailing the photo to yourself to change the type', 'Converters that keep your photos', 'Switching the camera to Most Compatible'],
    promise: 'In Safari, on the device, HEIC becomes JPG. Other browsers are told plainly that they cannot.',
    steps: ['Open the page in Safari', 'Drop in the HEIC photos', 'Download the JPGs'],
    proof: ['Free', 'Nothing uploaded', 'Works in Safari'],
    howTo: 'How to convert HEIC to JPG',
    cta: 'Convert HEIC to JPG'
  },

  /* ------------------------------------------- size-limit image pages */
  '/image/compress-image-to-20kb/': {
    persona: 'Exam, job and visa form applicants',
    hook: 'The exam form says photo and signature under 20 KB.',
    pain: 'Your photo is megabytes and the upload box rejects anything over 20 KB. Shrinking by hand takes ten tries.',
    usual: ['Trial and error with an editor', 'Upload sites that keep your ID photo', 'Shrinking until the face is a blur'],
    promise: 'It lowers the quality, then the size if it must, until the image fits under 20 KB, and tells you the size reached.',
    steps: ['Drop in the photo or signature', 'Leave the limit at 20 KB', 'Download the file that fits'],
    proof: FREE,
    howTo: 'How to get a photo under 20 KB',
    cta: 'Get it under 20 KB'
  },
  '/image/compress-image-to-50kb/': {
    persona: 'Applicants on government and university portals',
    hook: 'The recruitment portal caps uploads at 50 KB.',
    pain: 'The form tells you the file is too big, but not by how much, and not what to do about it.',
    usual: ['Screenshotting to get a smaller file', 'Compressors that queue your photo online', 'Shrinking it twice and ruining it'],
    promise: 'Quality drops first and the picture only shrinks if it must. The message says what it did.',
    steps: ['Drop in the JPG or PNG', 'Leave the limit at 50 KB', 'Check the message and download'],
    proof: FREE,
    howTo: 'How to compress an image to 50 KB',
    cta: 'Get it under 50 KB'
  },
  '/image/compress-image-to-100kb/': {
    persona: 'Sellers and form-fillers',
    hook: 'The listing form says 100 KB. The photo is a phone original.',
    pain: 'A phone photo is a few megabytes, and the upload form or email gateway wants a hundredth of that.',
    usual: ['Sending the photo to a free site', 'Cropping away half the picture', 'Lowering one slider and guessing'],
    promise: 'It starts from your quality setting and lowers it until the file lands under 100 KB. Size shrinks only if it must.',
    steps: ['Drop in the photo', 'Leave the limit at 100 KB', 'Download the result'],
    proof: FREE,
    howTo: 'How to compress an image to 100 KB',
    cta: 'Get it under 100 KB'
  },
  '/image/compress-image-to-200kb/': {
    persona: 'CV, listing and form uploaders',
    hook: 'Under 200 KB, but you still want the full-size photo.',
    pain: 'The CV site or listing form has a 200 KB cap, and every tool you try shrinks the dimensions as well.',
    usual: ['Resizing first and hoping', 'Free sites that cut the size too far', 'Re-saving until it fits'],
    promise: 'For most photos quality alone gets under 200 KB, so width and height stay as they are.',
    steps: ['Drop in the photo', 'Leave the limit at 200 KB', 'Compare before and after, then download'],
    proof: FREE,
    howTo: 'How to compress an image to 200 KB',
    cta: 'Get it under 200 KB'
  },
  '/image/compress-image-to-500kb/': {
    persona: 'Photo competition and property-site entrants',
    hook: 'Competition entries: under 500 KB, still sharp.',
    pain: 'Your camera writes three to eight megabytes, and the entry form wants half a megabyte of a photo that should still look good.',
    usual: ['Phone apps that cut the size in half', 'Downsizing to a thumbnail', 'Emailing the photo to the organiser'],
    promise: 'Large photos come under 500 KB, usually at full dimensions with a little less quality.',
    steps: ['Drop in the big photo', 'Leave the limit at 500 KB', 'Read what it did, then download'],
    proof: FREE,
    howTo: 'How to compress an image to 500 KB',
    cta: 'Get it under 500 KB'
  },
  '/image/compress-image-to-1mb/': {
    persona: 'Support-form and marketplace users',
    hook: 'The support form takes 1 MB. The screenshot is 3.',
    pain: 'An older email system or marketplace refuses the attachment, and you cannot tell the support agent what the problem is without it.',
    usual: ['Pasting the picture into a document', 'Sending a smaller crop that hides the problem', 'Re-sending in four separate mails'],
    promise: 'Most pictures keep their full dimensions and are saved at a lower quality, under the 1 MB cap.',
    steps: ['Drop in the picture', 'Leave the limit at 1 MB', 'Download the smaller file'],
    proof: FREE,
    howTo: 'How to compress an image to 1 MB',
    cta: 'Get it under 1 MB'
  },

  /* ----------------------------------------- passport and visa photos */
  '/image/passport-photo-35x45mm/': {
    persona: 'Applicants for an ICAO-size photo',
    hook: 'Photo size 35 × 45 mm. Your phone selfie is not.',
    pain: 'The UK, Schengen, Australia and most countries share this size, and a free-hand crop leaves the head too big or too small.',
    usual: ['A photo booth strip you pay for', 'Cropping by eye in a phone editor', 'Apps that hold the download for payment'],
    promise: 'Frame your picture to 35 × 45 mm, 413 × 531 px at 300 DPI, with a head guide and a 6 × 4 in print sheet.',
    steps: ['Drop in a front-facing photo', 'Line the head up with the guide', 'Download the photo and the print sheet'],
    proof: FREE,
    howTo: 'How to make a 35 × 45 mm photo',
    cta: 'Make a 35 × 45 mm photo'
  },
  '/image/passport-photo-2x2-inch/': {
    persona: 'US passport and visa applicants',
    hook: 'The US wants a square 2 × 2 inch photo. A normal crop is a rectangle.',
    pain: 'The digital upload wants a square JPEG of at least 600 × 600 pixels with the head the right height.',
    usual: ['A drugstore photo counter', 'Cropping a square in a phone editor', 'Guessing the head size'],
    promise: 'A 2 × 2 in photo, 600 × 600 px, head 1 to 1⅜ in, plus a print sheet.',
    steps: ['Drop in a front-facing photo', 'Frame the head to the guide', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make a 2 × 2 inch photo',
    cta: 'Make a 2 × 2 inch photo'
  },
  '/image/passport-photo-51x51mm/': {
    persona: 'People applying for an Indian visa or OCI card',
    hook: 'The Indian e-visa wants a 51 × 51 mm square.',
    pain: 'You have a photo in the UK or US size, and the visa, OCI or abroad passport application wants a square.',
    usual: ['Paying a studio for one square print', 'Cropping to 2 × 2 in and hoping', 'Uploading your face to a converter'],
    promise: 'A 51 × 51 mm photo, 602 × 602 px at 300 DPI. Set the file size limit to the figure the form gives.',
    steps: ['Drop in a front-facing photo', 'Set the single photo size limit', 'Download the square photo'],
    proof: FREE,
    howTo: 'How to make a 51 × 51 mm photo',
    cta: 'Make a 51 × 51 mm photo'
  },
  '/image/uk-passport-photo/': {
    persona: 'UK passport applicants',
    hook: 'The wall behind you is white. The UK wants cream or grey.',
    pain: 'A photo framed for a Schengen visa can come out too tight for a British passport, and a bright wall is the wrong shade.',
    usual: ['A booth at the post office', 'Photo apps that charge to download', 'Standing at a cream wall that does not exist'],
    promise: 'Frames to 35 × 45 mm with the head 29 to 34 mm, and can swap the background for light grey.',
    steps: ['Drop in a front-facing photo', 'Let it replace the wall with light grey', 'Download the photo and 6 × 4 in sheet'],
    proof: FREE,
    howTo: 'How to make a UK passport photo',
    cta: 'Make a UK passport photo'
  },
  '/image/india-passport-photo/': {
    persona: 'Applicants for an Indian passport',
    hook: 'India has three photo sizes. Passport Seva wants this one.',
    pain: 'Passport, visa and PAN card photos are all different, and it is easy to upload the wrong one.',
    usual: ['A studio near the passport centre', 'Cropping to a size you half remember', 'Reprinting after the wrong one'],
    promise: 'Opens on the Passport Seva size, 35 × 45 mm on plain white. Switch to the square or PAN size when you need it.',
    steps: ['Drop in a front-facing photo', 'Check Document says India passport', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make an Indian passport photo',
    cta: 'Make an Indian passport photo'
  },
  '/image/schengen-visa-photo/': {
    persona: 'Schengen visa applicants',
    hook: 'One photo for every Schengen country.',
    pain: 'You are applying to France, Germany or Italy and every consulate page seems to say something different.',
    usual: ['A visa centre photo booth', 'Re-reading three embassy pages', 'Reprinting after a wrong head size'],
    promise: 'Schengen states share the visa photo: 35 × 45 mm, head 32 to 36 mm, on plain light. A 6 × 4 in sheet for the printer.',
    steps: ['Drop in a front-facing photo', 'Line up the head guide', 'Print the 6 × 4 in sheet'],
    proof: FREE,
    howTo: 'How to make a Schengen visa photo',
    cta: 'Make a Schengen visa photo'
  },
  '/image/france-passport-photo/': {
    persona: 'French passport and ID card applicants',
    hook: 'In France the background must be light, but not white.',
    pain: 'Your wall is white, and the usual photo apps give you exactly the wrong background for a French application.',
    usual: ['A photomaton you queue for', 'Apps that default to white', 'A pale wall that shows shadows'],
    promise: '35 × 45 mm, head 32 to 36 mm. Replace the wall with a pale grey or blue, cut out on your device.',
    steps: ['Drop in a front-facing photo', 'Replace the background with a pale colour', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make a French passport photo',
    cta: 'Make a French passport photo'
  },
  '/image/spain-passport-photo/': {
    persona: 'Spanish passport and DNI applicants',
    hook: 'Spain wants a smaller photo: 26 × 32 mm.',
    pain: 'Trimming down a 35 × 45 mm photo puts the head at the wrong proportion in the frame.',
    usual: ['A photographer near the police station', 'Shrinking a 35 × 45 mm print', 'Guessing the proportions'],
    promise: 'Frames to 26 × 32 mm, 307 × 378 px at 300 DPI, on plain white.',
    steps: ['Drop in a front-facing photo', 'Check the frame is 26 × 32 mm', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make a Spanish passport or DNI photo',
    cta: 'Make a Spanish passport photo'
  },
  '/image/netherlands-passport-photo/': {
    persona: 'Dutch passport and ID card applicants',
    hook: 'A smaller head in the usual frame: 26 to 30 mm.',
    pain: 'Most countries ask for a head of 32 to 36 mm. Use that for a Dutch application and the head is too big.',
    usual: ['A photographer who knows only the common size', 'Copying a Schengen photo', 'Cropping until it feels right'],
    promise: '35 × 45 mm with the head 26 to 30 mm, on light grey, light blue or white.',
    steps: ['Drop in a front-facing photo', 'Pick one of the three backgrounds', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make a Dutch passport photo',
    cta: 'Make a Dutch passport photo'
  },
  '/image/turkey-passport-photo/': {
    persona: 'Applicants for Turkish passports and visas',
    hook: 'Turkey asks for a big photo: 50 × 60 mm.',
    pain: 'The consulate wants several printed copies, and a standard small photo is far too small.',
    usual: ['Photo shops that cut the wrong size', 'Enlarging a small photo until it blurs', 'Printing one copy at a time'],
    promise: '50 × 60 mm, 591 × 709 px at 300 DPI, on plain white, with an A4 sheet for several copies.',
    steps: ['Drop in a front-facing photo', 'Pick the A4 sheet under Output', 'Print the copies'],
    proof: FREE,
    howTo: 'How to make a Turkish passport or visa photo',
    cta: 'Make a Turkish passport photo'
  },
  '/image/canada-passport-photo/': {
    persona: 'Canadian passport applicants',
    hook: 'A Canadian passport photo is 50 × 70 mm. A tall one.',
    pain: 'A visa or permanent-resident card uses the common 35 × 45 mm. The passport does not, and the two are easy to confuse.',
    usual: ['A drugstore photo counter', 'Cutting a 35 × 45 mm print larger', 'Checking sizes by ruler'],
    promise: '50 × 70 mm, head 31 to 36 mm, 591 × 827 px at 300 DPI. An A4 sheet for several copies.',
    steps: ['Drop in a front-facing photo', 'Line up the head guide', 'Print the A4 sheet'],
    proof: FREE,
    howTo: 'How to make a Canadian passport photo',
    cta: 'Make a Canadian passport photo'
  },
  '/image/brazil-passport-photo/': {
    persona: 'Brazilian passport applicants',
    hook: 'Brazil lists a 5 × 7 cm photo, but no head size.',
    pain: 'The Federal Police name the size and a white background, and say nothing about how big the head should be.',
    usual: ['A studio that charges per print', 'Guessing the head height', 'Reprinting after a rejection'],
    promise: '50 × 70 mm, 591 × 827 px at 300 DPI. The head is framed to the ICAO guide and the page calls that an estimate.',
    steps: ['Drop in a front-facing photo', 'Check the frame is 50 × 70 mm', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make a Brazilian passport photo',
    cta: 'Make a Brazilian passport photo'
  },
  '/image/australia-passport-photo/': {
    persona: 'Australian passport and visa applicants',
    hook: 'Australia allows a range of photo sizes. Which one?',
    pain: 'The Passport Office accepts 35 to 40 mm by 45 to 50 mm, and you have to pick a size before you crop.',
    usual: ['A pharmacy photo service', 'Choosing a size at random', 'Cropping and checking with a ruler'],
    promise: 'Makes the smallest allowed, 35 × 45 mm, face 32 to 36 mm, 413 × 531 px at 300 DPI.',
    steps: ['Drop in a front-facing photo', 'Choose passport or visa under Document', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make an Australian passport photo',
    cta: 'Make an Australian passport photo'
  },
  '/image/china-visa-photo/': {
    persona: 'Chinese visa applicants',
    hook: 'The Chinese visa photo is narrower and taller: 33 × 48 mm.',
    pain: 'Visa centres ask for a shape that is not the common one, and the space above the head counts as much as the head.',
    usual: ['A photo shop near the visa centre', 'Trimming a 35 × 45 mm print', 'Reprinting at the visa centre'],
    promise: '33 × 48 mm, head 28 to 33 mm, 390 × 567 px at 300 DPI, on plain white. Guide lines show the space above the head.',
    steps: ['Drop in a front-facing photo', 'Use the guide lines for head and space', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make a Chinese visa photo',
    cta: 'Make a Chinese visa photo'
  },
  '/image/hong-kong-passport-photo/': {
    persona: 'Hong Kong passport and travel document applicants',
    hook: 'A 40 × 50 mm photo for a Hong Kong passport.',
    pain: 'It is neither the 35 × 45 mm size nor a square, and Immigration wants the head 32 to 36 mm.',
    usual: ['A photo studio queue', 'Cropping a common size and guessing', 'Reprinting at the counter'],
    promise: '40 × 50 mm, 472 × 591 px at 300 DPI, on plain white, with a 6 × 4 in print sheet.',
    steps: ['Drop in a front-facing photo', 'Line up the head guide', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make a Hong Kong passport photo',
    cta: 'Make a Hong Kong passport photo'
  },
  '/image/singapore-passport-photo/': {
    persona: 'Singapore passport and IC applicants',
    hook: 'One photo for the Singapore passport and the IC.',
    pain: 'ICA allows a head of 25 to 35 mm, wider than most countries, so most guides frame it too tightly.',
    usual: ['A photo shop near the ICA', 'Following a guide for another country', 'Retaking the photo'],
    promise: '35 × 45 mm on plain white, head 25 to 35 mm, 413 × 531 px at 300 DPI.',
    steps: ['Drop in a front-facing photo', 'Frame the head inside the range', 'Download the photo and sheet'],
    proof: FREE,
    howTo: 'How to make a Singapore passport photo',
    cta: 'Make a Singapore passport photo'
  },

  /* ------------------------------------------------------- PDF pages */
  '/pdf/compress-pdf-to-100kb/': {
    persona: 'Applicants with scanned documents',
    hook: 'The portal takes the PDF only under 100 KB.',
    pain: 'Your scanned certificate is mostly picture data, and the upload form rejects it with no hint on how to shrink it.',
    usual: ['Uploading the scan to a free site', 'Scanning again in black and white', 'Splitting it and uploading in parts'],
    promise: 'Pictures step down until the PDF fits under 100 KB. Text is kept sharp. If it cannot fit, the page says so.',
    steps: ['Open the PDF', 'Leave the target at 100 KB', 'Download the smallest version that fits'],
    proof: FREE,
    howTo: 'How to compress a PDF to 100 KB',
    cta: 'Get a PDF under 100 KB'
  },
  '/pdf/compress-pdf-to-200kb/': {
    persona: 'Job, visa and university applicants',
    hook: 'The certificate scan must be under 200 KB.',
    pain: 'Application sites cap a certificate or ID scan at 200 KB. A scan at 300 DPI has far more pixels than a screen shows.',
    usual: ['Screenshotting the pages', 'Sending the scan to a free compressor', 'Re-scanning at a lower setting'],
    promise: 'Pictures are resampled until it fits under 200 KB. Typed text, links and form fields are left untouched.',
    steps: ['Open the PDF', 'Leave the target at 200 KB', 'Download the smaller copy'],
    proof: FREE,
    howTo: 'How to compress a PDF to 200 KB',
    cta: 'Get a PDF under 200 KB'
  },
  '/pdf/compress-pdf-to-1mb/': {
    persona: 'Support-portal users and email senders',
    hook: 'The support portal takes a PDF only under 1 MB.',
    pain: 'Your photo report is a few megabytes, and the portal or older mail system turns it away.',
    usual: ['Splitting the report in parts', 'Squashing everything to the lowest setting', 'Uploading it to a shrinking site'],
    promise: 'It tries gentle settings first, from 150 DPI, and stops as soon as the file fits under 1 MB. Text and links are left alone.',
    steps: ['Open the PDF', 'Leave the target at 1 MB', 'Check the results, then download'],
    proof: FREE,
    howTo: 'How to compress a PDF to 1 MB',
    cta: 'Get a PDF under 1 MB'
  },
  '/pdf/compress-pdf-to-2mb/': {
    persona: 'Anyone attaching a PDF to email',
    hook: '2 MB passes nearly every inbox. Your PDF does not.',
    pain: 'A company filter or an inbox bounces the PDF with its camera-resolution photos, even though your mail service allows more.',
    usual: ['Sending a download link instead', 'Splitting into two emails', 'Shrinking the photos by hand'],
    promise: 'Photos are scaled to the resolution they are printed at, starting at 150 DPI, until it is under 2 MB.',
    steps: ['Open the PDF', 'Leave the target at 2 MB', 'Download the lighter copy'],
    proof: FREE,
    howTo: 'How to make a PDF under 2 MB',
    cta: 'Get a PDF under 2 MB'
  },
  '/pdf/pdf-to-jpg/': {
    persona: 'Anyone putting a page in a slide or a message',
    hook: 'You need page 3 of a PDF as a JPG.',
    pain: 'The slide, the website or the chat takes a picture and not a PDF, and a screenshot of the page comes out soft.',
    usual: ['Screenshotting the page', 'Uploading the whole PDF to a converter', 'Printing to an image driver'],
    promise: 'Each page is drawn and saved as a JPG, at 150 DPI by default or anything from 72 to 600. All pages or a range.',
    steps: ['Open the PDF', 'Choose pages and DPI', 'Download the JPGs one by one or as a ZIP'],
    proof: FREE,
    howTo: 'How to convert PDF pages to JPG',
    cta: 'Convert PDF to JPG'
  },
  '/pdf/pdf-to-png/': {
    persona: 'People turning documents and charts into images',
    hook: 'JPG makes the text on your invoice look fuzzy.',
    pain: 'Letters, tables and thin lines turn hazy when a PDF page is saved as JPG, and the slide looks bad.',
    usual: ['Screenshots with the wrong crop', 'JPG exports with smeared edges', 'Online converters that keep the file'],
    promise: 'Each page is saved as a lossless PNG: crisp text and lines. 72 to 600 DPI, any page range.',
    steps: ['Open the PDF', 'Choose pages and DPI', 'Download the PNGs'],
    proof: FREE,
    howTo: 'How to convert PDF pages to PNG',
    cta: 'Convert PDF to PNG'
  },
  '/pdf/jpg-to-pdf/': {
    persona: 'Anyone sending receipts and scans as one file',
    hook: 'The receipts are JPGs. The claim wants one PDF.',
    pain: 'A camera roll full of receipt photos needs to go to one place in one file, in the right order.',
    usual: ['Emailing each photo separately', 'Converters that cap the number of pages', 'A watermark across every page'],
    promise: 'Each JPG goes on its own A4 page untouched, in the order you choose. One PDF out.',
    steps: ['Drop in the JPG photos', 'Set the order', 'Download the one PDF'],
    proof: FREE_NW,
    howTo: 'How to combine JPGs into one PDF',
    cta: 'Make the PDF'
  }
};
