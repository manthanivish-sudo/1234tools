/**
 * Tool UI strings in Hindi, read by engine/i18n.js on the Hindi twins.
 *
 *   common      every twin: the share bar, buttons every shell has, and the
 *               patterns that keep sizes, file names and numbers as they are
 *   image, pdf, dev, core, qr, aiimg
 *               what one shell (render-image, render-pdf, render-dev,
 *               render-core, render-qr, aiimg-core) writes for every tool
 *   tools[slug] what one tool's own spec adds
 *
 * Each set is { s: exact strings, p: [pattern, replacement], k: kept as is }.
 * A pattern is anchored by the runtime's use (write ^…$ yourself); in the
 * replacement $n is the captured group as it is and %n the group translated.
 *
 * Where these come from: `node build/tests/hi-tools.js --harvest out.json`
 * drives every English tool with a real input and lists each UI string it
 * meets. When an English page gains a control, that list grows, and the
 * hi-tools suite fails until the string has a translation here.
 *
 * MACHINE-DRAFTED. Needs a native Hindi speaker's review before promotion.
 * Common loanwords are kept the way Indian web users write them: PDF, JPG,
 * KB, फ़ाइल, डाउनलोड, सेटिंग.
 */
'use strict';

/* sizes, dimensions and counts: digits and units stay as they are */
const UNITS = '(?:KB|MB|GB|kB|B|px|pt|mm|cm|in|DPI|dpi|kg|lb|st|ft|h|min|s|ms|x)';
const NUMERIC = '^((?:[\\d.,\\s×·%+\\-−–()/:°~≈→←]|' + UNITS + '\\b)+)$';
const FILE = '^([^\\s/]+\\.(?:jpe?g|png|webp|gif|avif|bmp|ico|heic|pdf|zip|svg|txt|csv|json))$';

const common = {
  s: {
    'Share this tool': 'यह टूल शेयर करें',
    'Share': 'शेयर करें',
    'Share on WhatsApp': 'WhatsApp पर शेयर करें',
    'Share on Telegram': 'Telegram पर शेयर करें',
    'Share on X': 'X पर शेयर करें',
    'Share on Facebook': 'Facebook पर शेयर करें',
    'Share on LinkedIn': 'LinkedIn पर शेयर करें',
    'Share on Reddit': 'Reddit पर शेयर करें',
    'Share by email': 'ईमेल से शेयर करें',
    'Email': 'ईमेल',
    'Copy link': 'लिंक कॉपी करें',
    'Link copied': 'लिंक कॉपी हो गया',
    'Copied': 'कॉपी हो गया',
    'Show link as QR code': 'लिंक को QR कोड में दिखाएँ',
    'Include my figures': 'मेरे आँकड़े भी शामिल करें',
    'Include my text': 'मेरा टेक्स्ट भी शामिल करें',
    'Include my settings': 'मेरी सेटिंग भी शामिल करें',
    'Include this code’s content': 'इस कोड का कंटेंट भी शामिल करें',
    'Embed this tool': 'यह टूल अपनी साइट पर लगाएँ',
    'Embed': 'एम्बेड',
    'Download a result card': 'नतीजे का कार्ड डाउनलोड करें',
    'Result card': 'नतीजे का कार्ड',
    'Close': 'बंद करें',
    'Quality': 'क्वालिटी',
    'Metadata': 'मेटाडेटा',
    'Cancel': 'रद्द करें',
    'Reading…': 'पढ़ रहे हैं…',
    'Working…': 'काम चल रहा है…',
    'Fit': 'फ़िट',
    'Download': 'डाउनलोड करें',
    'Save': 'सेव करें',
    'Output': 'आउटपुट',
    'Before': 'पहले',
    'After': 'बाद में',
    'Change': 'बदलाव',
    'Format': 'फ़ॉर्मैट',
    'PNG — lossless': 'PNG — बिना क्वालिटी खोए',
    'Move up': 'ऊपर ले जाएँ',
    'Move down': 'नीचे ले जाएँ',
    'Remove': 'हटाएँ',
    'None': 'कोई नहीं',
    'Clear': 'साफ़ करें',
    'Yes': 'हाँ',
    'No': 'नहीं',
    'On': 'चालू',
    'Off': 'बंद',
    'Show': 'दिखाएँ',
    'Hide': 'छिपाएँ',
    'All': 'सभी',
    'Width': 'चौड़ाई',
    'Height': 'ऊँचाई',
    'Source': 'स्रोत',
    'Settings': 'सेटिंग',
    'Pages': 'पेज',
    'Print': 'प्रिंट करें',
    'Total': 'कुल',
    'Input': 'इनपुट',
    'Copy': 'कॉपी करें',
    'Done': 'हो गया',
    'Portrait': 'खड़ा (पोर्ट्रेट)',
    'Landscape': 'आड़ा (लैंडस्केप)',
    'Original': 'ओरिजिनल',
    'Result': 'नतीजा'
  },
  p: [
    [NUMERIC, '$1'],
    [FILE, '$1'],
    ['^(https?://\\S+)$', '$1'],
    ['^Remove (\\S+\\.\\w{2,4})$', '$1 हटाएँ'],
    ['^Save (\\S+\\.\\w{2,4})$', '$1 सेव करें'],
    ['^Download (\\S+\\.\\w{2,4})$', '$1 डाउनलोड करें'],
    ['^Copy (.+)$', '%1 कॉपी करें'],
    ['^Install (.+)$', '%1 इंस्टॉल करें']
  ],
  k: ['WhatsApp', 'Telegram', 'Facebook', 'LinkedIn', 'Reddit', 'QR', 'X', 'Y', 'WebP', 'JPEG', 'PNG', 'AVIF', 'GIF', 'BMP', 'ICO', 'PDF', 'SVG', 'EPS', 'YAML', 'CSV', 'XML', 'JSON', 'ZIP', 'HEIC', 'sRGB', 'EXIF', 'GPS', 'XMP', 'UTC', 'A4', 'Legal', 'US Letter', '1:1']
};

const image = {
  s: {
    'Choose images': 'फ़ोटो चुनें',
    'Choose an image': 'फ़ोटो चुनें',
    'or drag them (or a folder) here, or paste with Ctrl+V — nothing is uploaded': 'या उन्हें (या पूरा फ़ोल्डर) यहाँ खींचकर लाएँ, या Ctrl+V से पेस्ट करें — कुछ भी अपलोड नहीं होता',
    'or drag it here, or paste with Ctrl+V — nothing is uploaded': 'या यहाँ खींचकर लाएँ, या Ctrl+V से पेस्ट करें — कुछ भी अपलोड नहीं होता',
    'click to choose different files': 'दूसरी फ़ाइलें चुनने के लिए क्लिक करें',
    'click to choose another image': 'दूसरी फ़ोटो चुनने के लिए क्लिक करें',
    'Output format': 'आउटपुट फ़ॉर्मैट',
    'Keep original format': 'ओरिजिनल फ़ॉर्मैट ही रखें',
    'Lossless — every pixel kept': 'लॉसलेस — हर पिक्सेल वैसा ही',
    'Make it under': 'इतने से कम बनाएँ',
    'No size limit': 'कोई साइज़ लिमिट नहीं',
    'Another size…': 'कोई और साइज़…',
    'Size limit (KB)': 'साइज़ लिमिट (KB)',
    'Remove all (colours converted to sRGB)': 'सब हटाएँ (रंग sRGB में बदले जाएँगे)',
    'Keep the colour profile only': 'सिर्फ़ कलर प्रोफ़ाइल रखें',
    'Keep colour profile and EXIF, without GPS': 'कलर प्रोफ़ाइल और EXIF रखें, GPS के बिना',
    'Keep everything: EXIF with GPS, XMP, colour profile': 'सब रखें: GPS समेत EXIF, XMP, कलर प्रोफ़ाइल',
    'Settings are remembered on this device.': 'सेटिंग इसी डिवाइस पर याद रहती हैं।',
    'A link to this page with these settings. It never carries your image.': 'इन सेटिंग के साथ इस पेज का लिंक। इसमें आपकी फ़ोटो कभी नहीं जाती।',
    'Copy settings link': 'सेटिंग का लिंक कॉपी करें',
    'Copy this link:': 'यह लिंक कॉपी करें:',
    'Reset settings': 'सेटिंग रीसेट करें',
    'Add more': 'और जोड़ें',
    'Clear all': 'सब हटाएँ',
    'View': 'व्यू',
    'Slider': 'स्लाइडर',
    'Side by side': 'साथ-साथ',
    'Zoom': 'ज़ूम',
    'Before and after. When zoomed, drag or use the arrow keys to look around.': 'पहले और बाद में। ज़ूम करने पर खींचकर या ऐरो की से इधर-उधर देखें।',
    'Before: the original': 'पहले: ओरिजिनल',
    'Before and after divider': 'पहले और बाद के बीच की लाइन',
    'Grew': 'बढ़ा',
    'Saved': 'बचत',
    'Metadata kept': 'रखा गया मेटाडेटा',
    'Images processed': 'प्रोसेस हुई फ़ोटो',
    'Original total': 'ओरिजिनल कुल',
    'Result total': 'नतीजा कुल',
    'Files produced': 'बनी फ़ाइलें',
    'Total size': 'कुल साइज़',
    'Encoder': 'एनकोडर',
    'Resampling': 'रीसैंपलिंग',
    'Output size': 'आउटपुट साइज़',
    'Selection': 'चुना हुआ हिस्सा',
    'Download result': 'नतीजा डाउनलोड करें',
    'Download all as ZIP': 'सब ZIP में डाउनलोड करें',
    'Own settings': 'अपनी सेटिंग',
    'none: the original’s profile is sRGB, which every viewer assumes': 'कुछ नहीं: ओरिजिनल का प्रोफ़ाइल sRGB है, जिसे हर व्यूअर मानकर चलता है',
    'none (colours converted to sRGB)': 'कुछ नहीं (रंग sRGB में बदले गए)',
    'The result is larger than the original: it is saved as PNG, which keeps every pixel exactly.': 'नतीजा ओरिजिनल से बड़ा है: यह PNG में सेव होता है, जो हर पिक्सेल को ठीक वैसा रखता है।',
    'Instagram · Square post — 1080×1080': 'Instagram · चौकोर पोस्ट — 1080×1080',
    'Instagram · Portrait post — 1080×1350': 'Instagram · खड़ी पोस्ट — 1080×1350',
    'Instagram · Story / Reel — 1080×1920': 'Instagram · स्टोरी / Reel — 1080×1920',
    'Facebook · Feed post — 1200×630': 'Facebook · फ़ीड पोस्ट — 1200×630',
    'Facebook · Cover photo — 851×315': 'Facebook · कवर फ़ोटो — 851×315',
    'X · Post image — 1600×900': 'X · पोस्ट की फ़ोटो — 1600×900',
    'X · Header — 1500×500': 'X · हेडर — 1500×500',
    'LinkedIn · Post image — 1200×627': 'LinkedIn · पोस्ट की फ़ोटो — 1200×627',
    'LinkedIn · Cover — 851×315': 'LinkedIn · कवर — 851×315',
    'LinkedIn · Cover — 1584×396': 'LinkedIn · कवर — 1584×396',
    'YouTube · Thumbnail — 1280×720': 'YouTube · थंबनेल — 1280×720',
    'YouTube · Channel art — 2560×1440': 'YouTube · चैनल आर्ट — 2560×1440',
    'Pinterest · Standard pin — 1000×1500': 'Pinterest · स्टैंडर्ड पिन — 1000×1500',
    'TikTok · Video cover — 1080×1920': 'TikTok · वीडियो कवर — 1080×1920',
    'WhatsApp · Status — 1080×1920': 'WhatsApp · स्टेटस — 1080×1920',
    'Web · Open Graph image — 1200×630': 'वेब · Open Graph फ़ोटो — 1200×630',
    'Web · Email header — 600×200': 'वेब · ईमेल हेडर — 600×200'
  },
  p: [
    ['^(\\d+) images?$', '$1 फ़ोटो'],
    ['^(\\d+) images? in the queue$', 'कतार में $1 फ़ोटो'],
    ['^After: (.+)$', 'बाद में: $1'],
    ['^Before: (.+)$', 'पहले: $1'],
    ['^(.+) \\(WebAssembly\\)$', '$1 (WebAssembly)'],
    ['^(\\d+) of (\\d+)$', '$2 में से $1'],
    ['^Working… (\\d+) of (\\d+)$', 'काम चल रहा है… $2 में से $1']
  ],
  k: ['MozJPEG', 'oxipng', 'libwebp', 'libavif', 'Lanczos3']
};

const pdf = {
  s: {
    'Choose a PDF': 'PDF चुनें',
    'Choose PDF files': 'PDF फ़ाइलें चुनें',
    'or drag it here — nothing is uploaded': 'या यहाँ खींचकर लाएँ — कुछ भी अपलोड नहीं होता',
    'or drag them here — nothing is uploaded': 'या उन्हें यहाँ खींचकर लाएँ — कुछ भी अपलोड नहीं होता',
    'click to choose another': 'दूसरी चुनने के लिए क्लिक करें',
    'click to add more': 'और जोड़ने के लिए क्लिक करें',
    'Preparing the preview…': 'प्रीव्यू तैयार हो रहा है…',
    'Previous page': 'पिछला पेज',
    'Next page': 'अगला पेज',
    'Zoom out': 'ज़ूम आउट',
    'Zoom in': 'ज़ूम इन',
    'Fit the page to the width': 'पेज को चौड़ाई में फ़िट करें',
    'Preview of the output. Plus and minus zoom; Page Up and Page Down turn the page.': 'आउटपुट का प्रीव्यू। प्लस और माइनस से ज़ूम; Page Up और Page Down से पेज पलटें।',
    'Drag to change the order': 'क्रम बदलने के लिए खींचें',
    'Choose which pages of this file to take': 'इस फ़ाइल के कौन-से पेज लेने हैं, चुनें',
    'Pages: all': 'पेज: सभी',
    'Output size': 'आउटपुट साइज़',
    'Which file to preview': 'किस फ़ाइल का प्रीव्यू देखें',
    'Strip all metadata': 'सारा मेटाडेटा हटाएँ',
    'Keep metadata from the first file': 'पहली फ़ाइल का मेटाडेटा रखें',
    'Remove it (title, author, XMP)': 'हटाएँ (टाइटल, लेखक, XMP)',
    'Keep it': 'रखें',
    'Source pages': 'स्रोत पेज',
    'Resolution': 'रिज़ॉल्यूशन',
    'Files produced': 'बनी फ़ाइलें',
    'Total size': 'कुल साइज़',
    'Packing…': 'पैक हो रहा है…'
  },
  p: [
    ['^(\\S+ × \\S+ pt) · fitted to width$', '$1 · चौड़ाई में फ़िट'],
    ['^Page (\\d+)$', 'पेज $1'],
    ['^Page (\\d+) of (\\d+)$', 'पेज $1 / $2'],
    ['^Turn page (\\d+) a quarter clockwise$', 'पेज $1 को घड़ी की दिशा में चौथाई घुमाएँ'],
    ['^(\\d+) pages? · (.+)$', '$1 पेज · $2'],
    ['^(\\d+) files?$', '$1 फ़ाइलें'],
    ['^(\\d+) of (\\d+) pages$', '$2 में से $1 पेज'],
    ['^(\\d+) of (\\d+) chosen$', '$2 में से $1 चुने गए'],
    ['^Writing page (\\d+) of (\\d+)$', 'पेज $1 / $2 लिखा जा रहा है'],
    ['^Move up, (.+)$', 'ऊपर ले जाएँ, $1'],
    ['^Move down, (.+)$', 'नीचे ले जाएँ, $1'],
    ['^Pages of (.+)$', '$1 के पेज'],
    ['^(\\S+\\.pdf) · (\\d+) pages?$', '$1 · $2 पेज'],
    ['^Download all (\\d+) as ZIP$', 'सभी $1 ZIP में डाउनलोड करें'],
    ['^Split after page (\\d+)$', 'पेज $1 के बाद काटें'],
    ['^Page (\\d+), chosen \\((\\d+) of (\\d+)\\)$', 'पेज $1, चुना गया ($3 में से $2)'],
    ['^Page (\\d+), not chosen$', 'पेज $1, नहीं चुना गया']
  ],
  k: []
};

const dev = {
  s: {
    'Open file': 'फ़ाइल खोलें',
    'Load example': 'उदाहरण लोड करें',
    'Full screen': 'फ़ुल स्क्रीन',
    'Exit full screen': 'फ़ुल स्क्रीन से बाहर',
    'Shortcuts': 'शॉर्टकट',
    'Keyboard shortcuts': 'कीबोर्ड शॉर्टकट',
    'Run now': 'अभी चलाएँ',
    'Copy the output': 'आउटपुट कॉपी करें',
    'Download the output': 'आउटपुट डाउनलोड करें',
    'Close a message, or leave full screen': 'मैसेज बंद करें, या फ़ुल स्क्रीन से बाहर आएँ',
    'On a Mac, use Cmd for Ctrl.': 'Mac पर Ctrl की जगह Cmd इस्तेमाल करें।',
    'Resize the input and output columns': 'इनपुट और आउटपुट कॉलम का साइज़ बदलें',
    'Expand': 'बड़ा करें',
    'Collapse': 'छोटा करें',
    'Output': 'आउटपुट'
  },
  p: [],
  k: ['Ctrl + Enter', 'Ctrl + Shift + C', 'Ctrl + S', 'Esc']
};

const core = {
  s: {
    'Save scenario': 'सीन सेव करें',
    'Compare': 'तुलना करें',
    'Reset to example': 'उदाहरण पर लौटें',
    'Copy value': 'मान कॉपी करें',
    'Step-by-step working': 'स्टेप-बाय-स्टेप हल',
    'Copy chart as PNG': 'चार्ट PNG में कॉपी करें',
    'With your numbers': 'आपके नंबरों के साथ',
    'Download CSV': 'CSV डाउनलोड करें',
    'change the currency and grouping': 'करेंसी और अंकों का समूह बदलें',
    'Amounts in ₹ ·': 'रकम ₹ में ·',
    'Show the schedule': 'शेड्यूल दिखाएँ',
    'Yearly': 'सालाना',
    'Monthly': 'मासिक',
    'Year': 'साल',
    'Month': 'महीना',
    'Scenario saved.': 'सीन सेव हो गया।'
  },
  p: [
    ['^Recent results \\((\\d+)\\)$', 'हाल के नतीजे ($1)'],
    ['^(.+) slider$', '%1 स्लाइडर'],
    ['^Amounts in (\\S+) ·$', 'रकम $1 में ·'],
    ['^(.+)\\. Arrow keys read the values\\.$', '%1। ऐरो की से मान पढ़ें।']
  ],
  k: []
};

const qr = {
  s: {
    '1. Content': '1. कंटेंट',
    'Content type': 'कंटेंट का प्रकार',
    'Website / URL': 'वेबसाइट / URL',
    'Plain text': 'सादा टेक्स्ट',
    'PDF or MP3 link': 'PDF या MP3 लिंक',
    'WiFi network': 'WiFi नेटवर्क',
    'Contact card (vCard)': 'कॉन्टैक्ट कार्ड (vCard)',
    'Contact card (vCard 4.0)': 'कॉन्टैक्ट कार्ड (vCard 4.0)',
    'Contact card (MeCard)': 'कॉन्टैक्ट कार्ड (MeCard)',
    'SMS': 'SMS',
    'Phone call': 'फ़ोन कॉल',
    'Social profile': 'सोशल प्रोफ़ाइल',
    'App store link': 'ऐप स्टोर लिंक',
    'Map location': 'मैप लोकेशन',
    'Calendar event': 'कैलेंडर इवेंट',
    'UPI payment (India)': 'UPI पेमेंट (भारत)',
    'PayPal.Me payment': 'PayPal.Me पेमेंट',
    'Bitcoin payment': 'Bitcoin पेमेंट',
    'Address': 'पता (लिंक)',
    '2. Shape': '2. आकार',
    'Module shape': 'मॉड्यूल का आकार',
    'Square': 'चौकोर',
    'Rounded': 'गोल कोने',
    'Fluid': 'बहता हुआ',
    'Dots': 'बिंदु',
    'Classy': 'क्लासी',
    'Vertical': 'खड़ी',
    'Horizontal': 'आड़ी',
    'Eye frame': 'आँख का फ़्रेम',
    'Leaf': 'पत्ती',
    'Petal': 'पंखुड़ी',
    'Eye centre': 'आँख का बीच',
    '3. Colours': '3. रंग',
    'Foreground': 'सामने का रंग',
    'Solid colour': 'एक रंग',
    'Linear gradient': 'सीधा ग्रेडिएंट',
    'Radial gradient': 'गोल ग्रेडिएंट',
    'Foreground colour': 'सामने का रंग',
    'Foreground colour hex value': 'सामने के रंग का hex मान',
    'Gradient second colour': 'ग्रेडिएंट का दूसरा रंग',
    'Gradient second colour hex value': 'ग्रेडिएंट के दूसरे रंग का hex मान',
    'Gradient angle': 'ग्रेडिएंट का कोण',
    'Background colour': 'बैकग्राउंड का रंग',
    'Background colour hex value': 'बैकग्राउंड के रंग का hex मान',
    'Transparent background (SVG and PNG)': 'ट्रांसपेरेंट बैकग्राउंड (SVG और PNG)',
    'Eyes match the foreground': 'आँखें सामने वाले रंग की',
    'Eye frame colour': 'आँख के फ़्रेम का रंग',
    'Eye frame colour hex value': 'आँख के फ़्रेम के रंग का hex मान',
    'Eye centre colour': 'आँख के बीच का रंग',
    'Eye centre colour hex value': 'आँख के बीच के रंग का hex मान',
    '4. Logo': '4. लोगो',
    'Centre image': 'बीच की इमेज',
    'Choose image': 'इमेज चुनें',
    'No image - the code stays plain': 'कोई इमेज नहीं - कोड सादा रहेगा',
    'Logo size': 'लोगो का साइज़',
    'Clear space around it': 'उसके चारों ओर खाली जगह',
    'Knock out the code behind the logo': 'लोगो के पीछे का कोड हटाएँ',
    '5. Output': '5. आउटपुट',
    'Error correction': 'Error correction',
    'Medium - recovers 15%': 'मीडियम - 15% तक ठीक करता है',
    'Low - recovers 7%': 'लो - 7% तक ठीक करता है',
    'Quartile - recovers 25%': 'क्वार्टाइल - 25% तक ठीक करता है',
    'High - recovers 30%': 'हाई - 30% तक ठीक करता है',
    'PNG width': 'PNG की चौड़ाई',
    'Resolution': 'रिज़ॉल्यूशन',
    'Quiet zone': 'खाली किनारा (quiet zone)',
    '4 modules - standard': '4 मॉड्यूल - स्टैंडर्ड',
    '6. Frame and label': '6. फ़्रेम और लेबल',
    'Frame': 'फ़्रेम',
    'No frame': 'कोई फ़्रेम नहीं',
    'Border, label below': 'बॉर्डर, लेबल नीचे',
    'Border, label above': 'बॉर्डर, लेबल ऊपर',
    'Speech bubble below': 'नीचे बात वाला बबल',
    'Thin border, label inside': 'पतला बॉर्डर, लेबल अंदर',
    'Label only, below': 'सिर्फ़ लेबल, नीचे',
    'Label': 'लेबल',
    'Frame colour': 'फ़्रेम का रंग',
    'Frame colour hex value': 'फ़्रेम के रंग का hex मान',
    'Label colour': 'लेबल का रंग',
    'Label colour hex value': 'लेबल के रंग का hex मान',
    '7. Your designs': '7. आपके डिज़ाइन',
    'Every design you download is kept here, in this browser only, so you can go back to it. The look is kept, not what the code says.': 'आप जो भी डिज़ाइन डाउनलोड करते हैं वह यहाँ, सिर्फ़ इसी ब्राउज़र में रखा जाता है, ताकि आप उस पर लौट सकें। सिर्फ़ डिज़ाइन रखा जाता है, कोड में क्या लिखा है वह नहीं।',
    'No saved designs yet. Download a code, or press Save this design.': 'अभी कोई सेव किया डिज़ाइन नहीं। कोई कोड डाउनलोड कीजिए, या “यह डिज़ाइन सेव करें” दबाइए।',
    'Save this design': 'यह डिज़ाइन सेव करें',
    'Clear designs': 'डिज़ाइन हटाएँ',
    'Reset to defaults': 'डिफ़ॉल्ट पर लौटें',
    'Reading the code back…': 'कोड वापस पढ़ा जा रहा है…',
    'Download SVG': 'SVG डाउनलोड करें',
    'Download PNG': 'PNG डाउनलोड करें',
    'Download PDF': 'PDF डाउनलोड करें',
    'Download EPS': 'EPS डाउनलोड करें',
    'All formats (ZIP)': 'सभी फ़ॉर्मैट (ZIP)',
    'Copy content': 'कंटेंट कॉपी करें',
    'Copy share link': 'शेयर लिंक कॉपी करें',
    'Version': 'वर्ज़न',
    'Mask pattern': 'मास्क पैटर्न',
    'Encoding': 'एनकोडिंग',
    'Content length': 'कंटेंट की लंबाई',
    'PNG export': 'PNG एक्सपोर्ट',
    'Print size': 'प्रिंट साइज़',
    'Smallest safe print': 'सबसे छोटा सुरक्षित प्रिंट',
    'Verified: this exact image was scanned and read back correctly': 'जाँचा गया: यही इमेज स्कैन करके सही पढ़ी गई',
    'Scan me': 'स्कैन करें'
  },
  p: [
    ['^(\\d+)% of the width$', 'चौड़ाई का $1%'],
    ['^(\\d+) modules?$', '$1 मॉड्यूल'],
    ['^(\\d+) \\((\\d+ x \\d+) modules\\)$', '$1 ($2 मॉड्यूल)'],
    ['^byte x(\\d+)$', 'byte x$1'],
    ['^(\\d+) characters?$', '$1 अक्षर'],
    ['^(\\S+ x \\S+ mm) at (\\d+) dpi$', '$2 dpi पर $1'],
    ['^(\\d+) mm wide$', '$1 mm चौड़ा']
  ],
  k: ['px', 'dpi', 'Error correction']
};
const tools = {};

const aiimg = {
  s: {
    'Choose a photo': 'फ़ोटो चुनें',
    'or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.': 'या यहाँ खींचकर लाएँ — कुछ भी अपलोड नहीं होता। JPEG, PNG, WebP या HEIC।',
    'The result': 'नतीजा',
    'The original': 'ओरिजिनल',
    'Before and after divider — drag, or use the arrow keys': 'पहले और बाद के बीच की लाइन — खींचें, या ऐरो की इस्तेमाल करें',
    'Change photo': 'फ़ोटो बदलें',
    'Export': 'एक्सपोर्ट',
    'Choose a photo to begin.': 'शुरू करने के लिए फ़ोटो चुनें।',
    'Reading the photo…': 'फ़ोटो पढ़ी जा रही है…',
    'Preparing the AI model…': 'AI मॉडल तैयार हो रहा है…',
    'Preparing the model…': 'मॉडल तैयार हो रहा है…',
    'Download the image': 'फ़ोटो डाउनलोड करें',
    'Result preview': 'नतीजे का प्रीव्यू'
  },
  p: [
    ['^Downloading the model once — (.+) of (.+)\\. Your browser keeps it for next time\\.$', 'मॉडल एक बार डाउनलोड हो रहा है — $2 में से $1। आपका ब्राउज़र इसे अगली बार के लिए रख लेता है।'],
    ['^Tile (\\d+) of (\\d+)\\.?$', 'टुकड़ा $1 / $2']
  ],
  k: []
};

tools['image-compressor'] = {
  s: {
    'Presets': 'प्रीसेट',
    'WebP at quality 75, at most 1920 px wide, colour profile kept.': 'WebP, क्वालिटी 75, ज़्यादा से ज़्यादा 1920 px चौड़ी, कलर प्रोफ़ाइल रखी गई।',
    'Photo for web': 'वेबसाइट के लिए फ़ोटो',
    'PNG with 256 colours and no dithering, so text and edges stay crisp.': '256 रंगों वाली PNG, डिदरिंग के बिना, ताकि टेक्स्ट और किनारे साफ़ रहें।',
    'Screenshot': 'स्क्रीनशॉट',
    'JPEG at quality 70, at most 1600 px wide, no metadata.': 'JPEG, क्वालिटी 70, ज़्यादा से ज़्यादा 1600 px चौड़ी, कोई मेटाडेटा नहीं।',
    'Email attachment': 'ईमेल अटैचमेंट',
    'JPEG at quality 80, at most 1600 px wide, with the location and camera details removed.': 'JPEG, क्वालिटी 80, ज़्यादा से ज़्यादा 1600 px चौड़ी, लोकेशन और कैमरे की जानकारी हटाकर।',
    'WebP — small, every current browser opens it': 'WebP — छोटी, हर नया ब्राउज़र खोल लेता है',
    'AVIF — smallest, slowest to make': 'AVIF — सबसे छोटी, बनने में सबसे धीमी',
    'JPEG — opens everywhere': 'JPEG — हर जगह खुलती है',
    'PNG — for screenshots and logos': 'PNG — स्क्रीनशॉट और लोगो के लिए',
    'Progressive JPEG': 'प्रोग्रेसिव JPEG',
    'Yes — loads blurry-to-sharp, usually smaller': 'हाँ — धुंधली से साफ़ होकर खुलती है, आमतौर पर छोटी',
    'No — baseline, loads top to bottom': 'नहीं — बेसलाइन, ऊपर से नीचे खुलती है',
    'Colour detail (chroma subsampling)': 'रंग की बारीकी (chroma subsampling)',
    'Automatic (4:2:0 for photos)': 'अपने-आप (फ़ोटो के लिए 4:2:0)',
    '4:2:0 — smaller': '4:2:0 — छोटी',
    '4:4:4 — full colour detail, for text and sharp red edges': '4:4:4 — रंग की पूरी बारीकी, टेक्स्ट और तीखे लाल किनारों के लिए',
    'WebP mode': 'WebP मोड',
    'Lossy — photos': 'लॉसी — फ़ोटो के लिए',
    'WebP effort (0 fastest – 6 smallest)': 'WebP मेहनत (0 सबसे तेज़ – 6 सबसे छोटी)',
    'AVIF speed (0 smallest – 10 fastest)': 'AVIF स्पीड (0 सबसे छोटी – 10 सबसे तेज़)',
    'PNG colours': 'PNG के रंग',
    'All — lossless': 'सभी — लॉसलेस',
    '256 — much smaller, close to the original': '256 — काफ़ी छोटी, ओरिजिनल के क़रीब',
    'Dithering': 'डिदरिंग',
    'On — smooth gradients': 'चालू — रंगों का मुलायम बदलाव',
    'Off — flat colour, crisp edges': 'बंद — सपाट रंग, साफ़ किनारे',
    'PNG effort (oxipng level 0–6)': 'PNG मेहनत (oxipng लेवल 0–6)',
    'Max width (0 = keep)': 'ज़्यादा से ज़्यादा चौड़ाई (0 = वही रखें)'
  }
};
tools['image-converter'] = {
  s: {
    'Convert to': 'इसमें बदलें',
    'PNG — lossless, supports transparency': 'PNG — लॉसलेस, ट्रांसपेरेंसी के साथ',
    'JPEG — small, no transparency': 'JPEG — छोटी, ट्रांसपेरेंसी नहीं',
    'WebP — small, supports transparency': 'WebP — छोटी, ट्रांसपेरेंसी के साथ',
    'AVIF — smallest, supports transparency': 'AVIF — सबसे छोटी, ट्रांसपेरेंसी के साथ',
    'GIF — 256 colours, for old systems': 'GIF — 256 रंग, पुराने सिस्टम के लिए',
    'BMP — uncompressed, for old software': 'BMP — बिना कंप्रेशन, पुराने सॉफ़्टवेयर के लिए',
    'ICO — a Windows or site icon, 16 to 256 px': 'ICO — Windows या वेबसाइट का आइकन, 16 से 256 px',
    'Quality (JPEG / WebP / AVIF)': 'क्वालिटी (JPEG / WebP / AVIF)',
    'Background for transparency': 'ट्रांसपेरेंट हिस्से का बैकग्राउंड',
    'Background for transparency (picker)': 'ट्रांसपेरेंट हिस्से का बैकग्राउंड (रंग चुनें)',
    'Longest side in px (0 = keep)': 'सबसे लंबी साइड px में (0 = वही रखें)'
  }
};
tools['image-resizer'] = {
  s: {
    'Size preset': 'साइज़ प्रीसेट',
    'My own size (the settings below)': 'मेरा अपना साइज़ (नीचे की सेटिंग)',
    'Resize by': 'किस हिसाब से',
    'Fixed width (keep ratio)': 'तय चौड़ाई (अनुपात वही)',
    'Fixed height (keep ratio)': 'तय ऊँचाई (अनुपात वही)',
    'Longest edge': 'सबसे लंबी साइड',
    'Percentage': 'प्रतिशत',
    'Exact size (may distort)': 'सटीक साइज़ (खिंच सकती है)',
    'Exact size, crop to fit': 'सटीक साइज़, क्रॉप करके',
    'Exact size, pad to fit': 'सटीक साइज़, पैड करके',
    'Value (px or %)': 'मान (px या %)',
    'Height (exact sizes)': 'ऊँचाई (सटीक साइज़ के लिए)',
    'Padding colour': 'पैडिंग का रंग',
    'Padding colour (picker)': 'पैडिंग का रंग (रंग चुनें)',
    'Allow enlarging': 'बड़ा करने दें',
    'No — smaller images keep their size': 'नहीं — छोटी फ़ोटो अपने साइज़ में रहें',
    'Yes — scale small images up': 'हाँ — छोटी फ़ोटो बड़ी करें',
    'DPI written to the file (0 = none)': 'फ़ाइल में लिखा DPI (0 = कोई नहीं)'
  }
};
tools['image-cropper'] = {
  s: {
    'Aspect ratio': 'अनुपात (aspect ratio)',
    'Free': 'खुला',
    'Square 1:1': 'चौकोर 1:1',
    '9:16 vertical': '9:16 खड़ा',
    '3:4 portrait': '3:4 खड़ा',
    '2:3 portrait': '2:3 खड़ा',
    '16:9 widescreen': '16:9 वाइडस्क्रीन',
    '4:3 landscape': '4:3 आड़ा',
    '3:2 landscape': '3:2 आड़ा',
    'Platform size': 'प्लैटफ़ॉर्म साइज़',
    'None — crop at the box’s own size': 'कोई नहीं — बॉक्स के अपने साइज़ में क्रॉप',
    'Circle preview': 'गोल प्रीव्यू',
    'On — see it as a round profile picture': 'चालू — गोल प्रोफ़ाइल फ़ोटो की तरह देखें',
    'Drag on the image to set the area. Drag inside the box to move it, or its handles to resize it; arrow keys move it, with Ctrl or ⌘ they resize it.': 'हिस्सा चुनने के लिए फ़ोटो पर खींचें। बॉक्स के अंदर खींचकर उसे खिसकाएँ, या कोनों से साइज़ बदलें; ऐरो की से खिसकता है, Ctrl या ⌘ के साथ साइज़ बदलता है।',
    'Turn left 90°': 'बाएँ 90° घुमाएँ',
    'Turn right 90°': 'दाएँ 90° घुमाएँ',
    'Straighten': 'सीधा करें',
    'Straighten, in degrees': 'सीधा करें, डिग्री में',
    'Thirds': 'तिहाई ग्रिड',
    'Crop area. Arrow keys move the box; with Ctrl or ⌘ they resize it.': 'क्रॉप का हिस्सा। ऐरो की से बॉक्स खिसकता है; Ctrl या ⌘ के साथ साइज़ बदलता है।'
  },
  p: [['^(\\d+ × \\d+ px) at (\\d+, \\d+) · saved as (\\d+ × \\d+ px)$', '$1, $2 पर · $3 में सेव होगा']]
};
tools['background-remover'] = {
  s: {
    'Method': 'तरीका',
    'Automatic — samples the corners': 'अपने-आप — कोनों का रंग देखकर',
    'Pick a colour to remove': 'हटाने वाला रंग खुद चुनें',
    'Colour to remove': 'हटाने वाला रंग',
    'Colour to remove (picker)': 'हटाने वाला रंग (रंग चुनें)',
    'Tolerance': 'टॉलरेंस',
    'Edge softness': 'किनारे की नरमी',
    'Replace with': 'इससे बदलें',
    'Transparency': 'ट्रांसपेरेंट',
    'A solid colour': 'एक सादा रंग',
    'New background': 'नया बैकग्राउंड',
    'New background (picker)': 'नया बैकग्राउंड (रंग चुनें)'
  }
};

tools['image-upscaler'] = {
  s: {
    'Upscale': 'अपस्केल करें',
    'What to do': 'क्या करना है',
    '4× — four times the width and height': '4× — चौड़ाई और ऊँचाई चार गुना',
    '2× — twice the size, cleaner': '2× — दोगुना साइज़, ज़्यादा साफ़',
    'Unblur — same size, sharper': 'धुंधलापन हटाएँ — वही साइज़, ज़्यादा शार्प',
    '4× is the network’s own output. 2× and Unblur run the same network and reduce the result, which is why they are cleaner than a plain resize.': '4× नेटवर्क का अपना आउटपुट है। 2× और “धुंधलापन हटाएँ” वही नेटवर्क चलाकर नतीजे को छोटा करते हैं, इसीलिए वे सादे रीसाइज़ से ज़्यादा साफ़ होते हैं।',
    'Denoise': 'Denoise (दाने हटाएँ)',
    '0 keeps every bit of texture. Raise it for a grainy or heavily compressed original: a second set of weights trained on noisy input is blended in, which doubles the time while both run.': '0 पर हर बनावट बची रहती है। दानेदार या बहुत कंप्रेस हुई फ़ोटो के लिए इसे बढ़ाइए: शोर वाली फ़ोटो पर ट्रेन किया दूसरा मॉडल मिलाया जाता है, जिससे दोनों के चलने तक समय दोगुना लगता है।',
    'PNG keeps every pixel the network produced; JPEG at 90 or above is a fifth of the size and fine for a listing or a message.': 'PNG नेटवर्क का बनाया हर पिक्सेल रखती है; 90 या उससे ऊपर की JPEG पाँचवें हिस्से जितनी होती है और लिस्टिंग या मैसेज के लिए ठीक है।',
    'Photo loaded. Choose 4×, 2× or Unblur and press Upscale.': 'फ़ोटो आ गई। 4×, 2× या “धुंधलापन हटाएँ” चुनिए और “अपस्केल करें” दबाइए।',
    'Upscale the photo first — the Export tab saves the result.': 'पहले फ़ोटो अपस्केल कीजिए — एक्सपोर्ट टैब नतीजा सेव करता है।'
  },
  p: [
    ['^(\\d+ × \\d+) → (\\d+ × \\d+ px) · (\\d+) tiles?\\.$', '$1 → $2 · $3 टुकड़े।'],
    ['^Upscaled (\\S+) — ready$', '$1 अपस्केल हो गया — तैयार'],
    ['^Unblurred — ready$', 'धुंधलापन हटा — तैयार'],
    ['^(\\d+ × \\d+ px) in (\\S+ s)\\. Drag the divider to compare; 1:1 shows the real pixels\\. Download it from the Export tab\\.$', '$1, $2 में। मिलाने के लिए बीच की लाइन खींचिए; 1:1 असली पिक्सेल दिखाता है। एक्सपोर्ट टैब से डाउनलोड कीजिए।'],
    ['^(.+) · (\\S+) upscaled$', '$1 · $2 अपस्केल'],
    ['^(.+) · unblurred$', '$1 · धुंधलापन हटा']
  ]
};
const PASS = {
  'India visa / OCI / passport abroad (2×2 in)': 'भारत वीज़ा / OCI / विदेश में पासपोर्ट (2×2 इंच)',
  'India passport (Passport Seva, 4.5×3.5 cm)': 'भारतीय पासपोर्ट (पासपोर्ट सेवा, 4.5×3.5 cm)',
  'India PAN card': 'भारत PAN कार्ड',
  'US passport': 'अमेरिका पासपोर्ट', 'US visa': 'अमेरिका वीज़ा', 'US green card / immigrant visa': 'अमेरिका ग्रीन कार्ड / इमिग्रेंट वीज़ा',
  'UK passport': 'UK पासपोर्ट', 'Ireland passport': 'आयरलैंड पासपोर्ट', 'Schengen visa': 'शेंगेन वीज़ा',
  'Germany passport / ID card': 'जर्मनी पासपोर्ट / ID कार्ड', 'France passport / ID card': 'फ़्रांस पासपोर्ट / ID कार्ड', 'Italy passport': 'इटली पासपोर्ट',
  'Spain passport / DNI (32×26 mm)': 'स्पेन पासपोर्ट / DNI (32×26 mm)', 'Netherlands passport / ID card': 'नीदरलैंड पासपोर्ट / ID कार्ड', 'Belgium passport / eID': 'बेल्जियम पासपोर्ट / eID',
  'Poland passport / ID card': 'पोलैंड पासपोर्ट / ID कार्ड', 'Austria passport': 'ऑस्ट्रिया पासपोर्ट', 'Switzerland passport / ID card': 'स्विट्ज़रलैंड पासपोर्ट / ID कार्ड',
  'Sweden passport': 'स्वीडन पासपोर्ट', 'Russia passport': 'रूस पासपोर्ट', 'Turkey passport / visa (50×60 mm)': 'तुर्की पासपोर्ट / वीज़ा (50×60 mm)',
  'Canada passport (50×70 mm)': 'कनाडा पासपोर्ट (50×70 mm)', 'Canada visa / PR card': 'कनाडा वीज़ा / PR कार्ड', 'Brazil passport (5×7 cm)': 'ब्राज़ील पासपोर्ट (5×7 cm)',
  'Australia passport': 'ऑस्ट्रेलिया पासपोर्ट', 'Australia visa': 'ऑस्ट्रेलिया वीज़ा', 'New Zealand passport': 'न्यूज़ीलैंड पासपोर्ट',
  'China passport (33×48 mm)': 'चीन पासपोर्ट (33×48 mm)', 'China visa (33×48 mm)': 'चीन वीज़ा (33×48 mm)', 'Hong Kong passport / travel documents (40×50 mm)': 'हांगकांग पासपोर्ट / यात्रा दस्तावेज़ (40×50 mm)',
  'Japan passport': 'जापान पासपोर्ट', 'South Korea passport': 'दक्षिण कोरिया पासपोर्ट', 'Singapore passport / IC': 'सिंगापुर पासपोर्ट / IC',
  'Malaysia passport (35×50 mm)': 'मलेशिया पासपोर्ट (35×50 mm)', 'Philippines passport (4.5×3.5 cm)': 'फ़िलीपींस पासपोर्ट (4.5×3.5 cm)', 'Vietnam passport (4×6 cm)': 'वियतनाम पासपोर्ट (4×6 cm)',
  'Pakistan passport / visa': 'पाकिस्तान पासपोर्ट / वीज़ा', 'Sri Lanka passport': 'श्रीलंका पासपोर्ट', 'Nepal passport': 'नेपाल पासपोर्ट',
  'South Africa passport / ID': 'दक्षिण अफ़्रीका पासपोर्ट / ID', 'Nigeria passport': 'नाइजीरिया पासपोर्ट',
  'Other: ICAO standard 35×45 mm': 'अन्य: ICAO स्टैंडर्ड 35×45 mm', 'Other: stamp size 20×25 mm (no issuer)': 'अन्य: स्टैम्प साइज़ 20×25 mm (कोई जारीकर्ता नहीं)'
};
tools['passport-photo'] = {
  s: Object.assign({}, PASS, {
    'Document': 'दस्तावेज़',
    'Background': 'बैकग्राउंड',
    'Keep the photo’s background': 'फ़ोटो का बैकग्राउंड ही रखें',
    'Replace with the colour below (cut out on this device)': 'नीचे वाले रंग से बदलें (इसी डिवाइस पर काटकर)',
    'New background colour': 'नए बैकग्राउंड का रंग',
    'New background colour (picker)': 'नए बैकग्राउंड का रंग (रंग चुनें)',
    'Single photo + 6×4 print sheet': 'एक फ़ोटो + 6×4 प्रिंट शीट',
    'Single photo only': 'सिर्फ़ एक फ़ोटो',
    '6×4 print sheet only': 'सिर्फ़ 6×4 प्रिंट शीट',
    'Single photo + A4 sheet': 'एक फ़ोटो + A4 शीट',
    'Single photo, 6×4 and A4 sheets': 'एक फ़ोटो, 6×4 और A4 शीट',
    'Save as': 'इस रूप में सेव करें',
    'JPEG — what portals and kiosks ask for': 'JPEG — जो पोर्टल और कियोस्क माँगते हैं',
    'JPEG quality': 'JPEG क्वालिटी',
    'Single photo under': 'एक फ़ोटो इतने से कम',
    'Drag the photo, or use the arrow keys, until the chin sits on the gold line and the top of the head falls between the two dashed lines; zoom to fit. Or let the page frame it for you.': 'फ़ोटो को खींचिए, या ऐरो की इस्तेमाल कीजिए, जब तक ठुड्डी सुनहरी लाइन पर और सिर का ऊपरी हिस्सा दोनों डैश वाली लाइनों के बीच न आ जाए; फ़िट होने तक ज़ूम कीजिए। या पेज को खुद फ़्रेम करने दीजिए।',
    'Finds the face with a 1.5 MB detector run on this device (the AI runtime, 14 MB, is fetched from this site the first time)': '1.5 MB का डिटेक्टर इसी डिवाइस पर चेहरा ढूँढता है (AI रनटाइम, 14 MB, पहली बार इसी साइट से आता है)',
    'Frame my face automatically': 'चेहरा अपने-आप फ़्रेम करें',
    'Tilt': 'झुकाव',
    'Reset framing': 'फ़्रेमिंग रीसेट करें',
    'Framing. Drag or use the arrow keys to move the photo; plus and minus zoom.': 'फ़्रेमिंग। फ़ोटो खिसकाने के लिए खींचें या ऐरो की इस्तेमाल करें; प्लस और माइनस से ज़ूम।',
    'Rounding': 'राउंडिंग',
    'Resolution in the file': 'फ़ाइल में रिज़ॉल्यूशन',
    'as photographed': 'जैसी खींची गई',
    'Head height asked for': 'माँगी गई सिर की ऊँचाई',
    'Source of these sizes': 'इन साइज़ का स्रोत',
    'Print size': 'प्रिंट साइज़',
    'Print sheet': 'प्रिंट शीट',
    'Photo': 'फ़ोटो'
  }),
  p: [
    ['^(.+) — ([\\d.]+×[\\d.]+ mm)$', '%1 — $2'],
    ['^Head \\(chin to crown\\) (.+)\\. Background: (.+)\\.$', 'सिर (ठुड्डी से चोटी तक) $1। बैकग्राउंड: %2।'],
    ['^plain white or off-white$', 'सादा सफ़ेद या हल्का सफ़ेद'],
    ['^(\\d+×\\d+ px) at (\\d+) DPI = (.+)$', '$2 DPI पर $1 = $3'],
    ['^(\\S+ mm) is (.+ px); pixels are whole, so each side is rounded to the nearest one$', '$1 = $2; पिक्सेल पूरे होते हैं, इसलिए हर साइड पास वाले पूरे पिक्सेल पर राउंड होती है'],
    ['^(\\S+\\.(?:gov|gc|go|govt)\\S*|[a-z0-9.-]+\\.[a-z]{2,}(?:/\\S*)?)$', '$1'],
    ['^The background is uneven \\(its brightness varies by (\\d+) levels at the top corners\\)\\. (.+) asks for (.+); “Replace with the colour below” cuts the person out\\.$', 'बैकग्राउंड एक-सा नहीं है (ऊपरी कोनों पर उसकी चमक $1 लेवल तक बदलती है)। %2 के लिए %3 चाहिए; “नीचे वाले रंग से बदलें” इंसान को काटकर अलग कर देता है।']
  ]
};
tools['image-to-pdf'] = {
  s: {
    'Page size': 'पेज साइज़',
    'Fit to image': 'इमेज के बराबर',
    'Orientation': 'दिशा',
    'Match each image': 'हर इमेज के हिसाब से',
    'Image on the page': 'पेज पर इमेज',
    'Fit — the whole image, inside the margin': 'फ़िट — पूरी इमेज, मार्जिन के अंदर',
    'Fill — cover the page, trimming the overflow': 'फ़िल — पूरा पेज भरें, बाहर का हिस्सा काटकर',
    'Margin (pt)': 'मार्जिन (pt)',
    'JPEG photos': 'JPEG फ़ोटो',
    'Keep as they are — no re-encode': 'जैसी हैं वैसी रखें — दोबारा एनकोड नहीं',
    'Re-encode at the quality below (smaller PDF)': 'नीचे की क्वालिटी पर दोबारा एनकोड करें (छोटी PDF)',
    'PNG, GIF and BMP images': 'PNG, GIF और BMP इमेज',
    'As JPEG at the quality below (smaller)': 'नीचे की क्वालिटी पर JPEG के रूप में (छोटी)',
    'Quality for re-encoded images': 'दोबारा एनकोड होने वाली इमेज की क्वालिटी',
    'File name': 'फ़ाइल का नाम',
    'images': 'images',
    'Pages in order. Drag a page, or use its arrow buttons, to move it.': 'क्रम में पेज। किसी पेज को खिसकाने के लिए उसे खींचें, या उसके ऐरो बटन इस्तेमाल करें।',
    'Move earlier': 'पहले ले जाएँ',
    'Move later': 'बाद में ले जाएँ',
    'Turn left': 'बाएँ घुमाएँ',
    'Turn right': 'दाएँ घुमाएँ',
    'PDF size': 'PDF साइज़',
    'Embedding': 'इमेज कैसे डाली गईं'
  },
  p: [
    ['^Page (\\d+) · JPEG as it is$', 'पेज $1 · JPEG जैसी है वैसी'],
    ['^Page (\\d+) · (.+)$', 'पेज $1 · $2'],
    ['^Move earlier: (.+)$', 'पहले ले जाएँ: $1'],
    ['^Move later: (.+)$', 'बाद में ले जाएँ: $1'],
    ['^Turn left: (.+)$', 'बाएँ घुमाएँ: $1'],
    ['^Turn right: (.+)$', 'दाएँ घुमाएँ: $1'],
    ['^Download PDF \\((\\d+) pages?\\)$', 'PDF डाउनलोड करें ($1 पेज)'],
    ['^(\\d+) JPEGs? embedded as they are, not re-encoded$', '$1 JPEG जैसी हैं वैसी डाली गईं, दोबारा एनकोड नहीं']
  ],
  k: ['images']
};

tools['merge-pdf'] = {
  s: {
    'Pages to take from each file': 'हर फ़ाइल से कौन-से पेज लें',
    'all, or per-file like: 1-3 | all | 2,5': 'all, या हर फ़ाइल का अलग: 1-3 | all | 2,5',
    'Document title (optional)': 'दस्तावेज़ का टाइटल (चाहें तो)',
    'Merge PDFs': 'PDF मर्ज करें',
    'Files merged': 'जुड़ी फ़ाइलें',
    'Total pages': 'कुल पेज'
  }
};
tools['split-pdf'] = {
  s: {
    'Split': 'कैसे बाँटें',
    'One file per page': 'हर पेज की अलग फ़ाइल',
    'Every N pages': 'हर N पेज पर',
    'By explicit ranges': 'तय रेंज से',
    'In half': 'आधे-आधे में',
    'Pages per file': 'हर फ़ाइल में पेज',
    'Ranges, one output per group': 'रेंज, हर समूह की एक फ़ाइल',
    'Split PDF': 'PDF स्प्लिट करें',
    'Click a page to split after it; each colour is one file': 'जिस पेज के बाद काटना है उस पर क्लिक करें; हर रंग एक फ़ाइल है',
    'Total output': 'कुल आउटपुट'
  }
};
tools['pdf-to-images'] = {
  s: {
    '72 DPI — screen': '72 DPI — स्क्रीन',
    '150 DPI — good': '150 DPI — अच्छा',
    '300 DPI — print': '300 DPI — प्रिंट',
    '600 DPI — very large': '600 DPI — बहुत बड़ा',
    'JPEG — smaller': 'JPEG — छोटी',
    'WebP — smallest': 'WebP — सबसे छोटी',
    'Quality (JPEG/WebP)': 'क्वालिटी (JPEG/WebP)',
    'Convert to images': 'इमेज में बदलें',
    'Click the pages to convert; shift-click for a run, or drag across': 'बदलने वाले पेज पर क्लिक करें; लगातार कई पेज के लिए shift-क्लिक करें, या उन पर खींचें',
    'Loading the PDF rendering engine': 'PDF रेंडरिंग इंजन लोड हो रहा है',
    'Images produced': 'बनी इमेज'
  },
  p: [
    ['^Drawing page (\\d+) — (\\d+) of (\\d+)$', 'पेज $1 बन रहा है — $3 में से $2'],
    ['^Done — (\\d+) of (\\d+)$', 'हो गया — $2 में से $1'],
    ['^(\\d+×\\d+ · \\S+ \\S+) · (PNG|JPEG|WebP)$', '$1 · $2']
  ]
};
tools['compress-pdf'] = {
  s: {
    'How small': 'कितनी छोटी',
    'Email: aim for under 2 MB': 'ईमेल: 2 MB से कम का लक्ष्य',
    'Screen: 110 DPI pictures, quality 65': 'स्क्रीन: तस्वीरें 110 DPI, क्वालिटी 65',
    'Print: 200 DPI pictures, quality 85': 'प्रिंट: तस्वीरें 200 DPI, क्वालिटी 85',
    'Smallest: 72 DPI pictures, quality 45': 'सबसे छोटी: तस्वीरें 72 DPI, क्वालिटी 45',
    'Lossless: leave the pictures alone': 'लॉसलेस: तस्वीरों को न छेड़ें',
    'My own settings (below)': 'मेरी अपनी सेटिंग (नीचे)',
    'Picture resolution (custom)': 'तस्वीरों का रिज़ॉल्यूशन (अपना)',
    'DPI at the size each picture is printed on the page': 'पेज पर तस्वीर जिस साइज़ में छपती है, उस पर DPI',
    'JPEG quality (custom)': 'JPEG क्वालिटी (अपनी)',
    'Compress PDF': 'PDF कंप्रेस करें',
    'Compressing': 'कंप्रेस हो रही है',
    'Pictures': 'तस्वीरें',
    'Picture data': 'तस्वीरों का डेटा',
    'Streams compressed': 'कंप्रेस हुई स्ट्रीम',
    'Duplicates stored once': 'एक जैसी चीज़ें एक बार रखी गईं',
    'Removed': 'हटाया गया'
  },
  p: [
    ['^Trying (\\d+) DPI, quality (\\d+)$', '$1 DPI, क्वालिटी $2 आज़मा रहे हैं'],
    ['^Measuring the pictures on page (\\d+) — (\\d+) of (\\d+)$', 'पेज $1 की तस्वीरें नापी जा रही हैं — $3 में से $2'],
    ['^(\\S+ \\S+) smaller \\((\\d+%)\\)$', '$1 छोटी ($2)'],
    ['^(\\S+ \\S+) larger \\((\\d+%)\\)$', '$1 बड़ी ($2)'],
    ['^(\\d+) DPI pictures, JPEG quality (\\d+)$', 'तस्वीरें $1 DPI, JPEG क्वालिटी $2'],
    ['^(\\d+) found, (\\d+) re-encoded \\((\\d+) scaled down\\)$', '$1 मिलीं, $2 दोबारा एनकोड ($3 छोटी की गईं)']
  ]
};

tools['word-counter'] = {
  s: {
    'Keyword density': 'कीवर्ड डेंसिटी',
    'Top 10': 'टॉप 10',
    'Top 25': 'टॉप 25',
    'Count': 'क्या गिनें',
    'Single words': 'अकेले शब्द',
    'Two-word phrases': 'दो शब्दों के वाक्यांश',
    'Three-word phrases': 'तीन शब्दों के वाक्यांश',
    'Ignore common words': 'आम शब्द छोड़ दें',
    'Word goal (0 = none)': 'शब्दों का लक्ष्य (0 = कोई नहीं)',
    'Your character limit (0 = none)': 'आपकी अक्षर लिमिट (0 = कोई नहीं)',
    'Limit bars': 'लिमिट की पट्टियाँ',
    'Your text': 'आपका टेक्स्ट',
    'Paste or type your text here…': 'अपना टेक्स्ट यहाँ पेस्ट या टाइप करें…',
    'Analysis': 'विश्लेषण',
    'Type or paste some text above.': 'ऊपर कुछ टेक्स्ट टाइप या पेस्ट कीजिए।',
    'Words': 'शब्द',
    'Characters': 'अक्षर',
    'Characters (no spaces)': 'अक्षर (स्पेस के बिना)',
    'Sentences': 'वाक्य',
    'Paragraphs': 'पैराग्राफ़',
    'Lines': 'लाइनें',
    'Unique words': 'अलग-अलग शब्द',
    'Average word length': 'शब्द की औसत लंबाई',
    'Average sentence length': 'वाक्य की औसत लंबाई',
    'Longest word': 'सबसे लंबा शब्द',
    'Reading time': 'पढ़ने का समय',
    'Speaking time': 'बोलने का समय',
    'Goal and limits': 'लक्ष्य और लिमिट',
    'X post': 'X पोस्ट',
    'Links count 23; most non-Latin characters and emoji count 2.': 'लिंक 23 गिने जाते हैं; ज़्यादातर गैर-लैटिन अक्षर (हिन्दी समेत) और इमोजी 2 गिने जाते हैं।',
    'SMS (one message)': 'SMS (एक मैसेज)',
    '€ and [ ] { } count 2 in GSM': 'GSM में € और [ ] { } 2 गिने जाते हैं',
    'Page title (SEO)': 'पेज टाइटल (SEO)',
    'Google shows around 60 characters': 'Google लगभग 60 अक्षर दिखाता है',
    'Meta description': 'मेटा डिस्क्रिप्शन',
    'Google shows around 155 characters': 'Google लगभग 155 अक्षर दिखाता है',
    'YouTube title': 'YouTube टाइटल',
    'Google Ads headline': 'Google Ads हेडलाइन',
    'Instagram caption': 'Instagram कैप्शन',
    'LinkedIn post': 'LinkedIn पोस्ट'
  },
  p: [
    ['^([\\d.,]+) characters?$', '$1 अक्षर'],
    ['^([\\d.,]+) words?$', '$1 शब्द'],
    ['^([\\d.,]+) sec$', '$1 सेकंड'],
    ['^([\\d.,]+) min ([\\d.,]+) sec$', '$1 मिनट $2 सेकंड'],
    ['^([\\d.,]+) min$', '$1 मिनट'],
    ['^([\\d,]+) of ([\\d,]+) · ([\\d,]+) left$', '$2 में से $1 · $3 बाकी'],
    ['^([\\d,]+) of ([\\d,]+) · ([\\d,]+) over$', '$2 में से $1 · $3 ज़्यादा']
  ]
};
tools['password-generator'] = {
  s: {
    'Type': 'प्रकार',
    'Random characters': 'रैंडम अक्षर',
    'Passphrase (memorable words)': 'पासफ़्रेज़ (याद रहने वाले शब्द)',
    'Pronounceable': 'बोलने लायक',
    'Check a password': 'पासवर्ड जाँचें',
    'Length (characters)': 'लंबाई (अक्षर)',
    'Words (passphrase)': 'शब्द (पासफ़्रेज़)',
    'Lowercase a-z': 'छोटे अक्षर a-z',
    'Include': 'शामिल करें',
    'Exclude': 'शामिल न करें',
    'Uppercase A-Z': 'बड़े अक्षर A-Z',
    'Digits 0-9': 'अंक 0-9',
    'Symbols': 'चिह्न',
    'Lookalike characters (l, 1, O, 0)': 'मिलते-जुलते अक्षर (l, 1, O, 0)',
    'At least one of each kind': 'हर प्रकार का कम से कम एक',
    'Guarantee': 'पक्का करें',
    'Do not force': 'ज़रूरी नहीं',
    'Between words': 'शब्दों के बीच',
    'Hyphen': 'हाइफ़न (-)',
    'Space': 'स्पेस',
    'Full stop': 'फ़ुल स्टॉप (.)',
    'Underscore': 'अंडरस्कोर (_)',
    'Nothing': 'कुछ नहीं',
    'A random digit': 'कोई रैंडम अंक',
    'Capital letters': 'बड़े अक्षर',
    'One random word': 'कोई एक शब्द',
    'Every word': 'हर शब्द',
    'All capitals': 'सब बड़े अक्षर',
    'Number on the end (0-99)': 'आखिर में नंबर (0-99)',
    'Add': 'जोड़ें',
    'Leave out': 'न जोड़ें',
    'How many': 'कितने',
    'Password to check': 'जाँचने वाला पासवर्ड',
    'Generate again': 'फिर से बनाएँ',
    'Generated': 'बने',
    'Entropy': 'एंट्रॉपी',
    'Character pool': 'अक्षरों का पूल',
    'Rule': 'नियम',
    'Offline cracking time*': 'ऑफ़लाइन क्रैक होने का समय*',
    'Random source': 'रैंडम सोर्स'
  },
  p: [
    ['^(\\d+) bits$', '$1 बिट'],
    ['^(\\d+) characters$', '$1 अक्षर'],
    ['^(\\d+) words$', '$1 शब्द'],
    ['^at least one of each of the (\\d+) kinds$', 'सभी $1 प्रकार का कम से कम एक'],
    ['^(\\S+) million years$', '$1 मिलियन साल'],
    ['^(\\S+) years$', '$1 साल'],
    ['^(\\S+) days$', '$1 दिन'],
    ['^(\\S+) hours$', '$1 घंटे'],
    ['^(\\S+) minutes$', '$1 मिनट'],
    ['^(\\S+) seconds$', '$1 सेकंड'],
    ['^less than a second$', 'एक सेकंड से कम']
  ],
  k: ['crypto.getRandomValues']
};
tools['json-formatter'] = {
  s: {
    'Formatted (indented)': 'फ़ॉर्मैटेड (इंडेंट के साथ)',
    'Minified (one line)': 'मिनिफ़ाइड (एक लाइन)',
    'Formatted + keys sorted': 'फ़ॉर्मैटेड + की क्रम में',
    'CSV (one row per item)': 'CSV (हर आइटम की एक लाइन)',
    'Indent': 'इंडेंट',
    '2 spaces': '2 स्पेस',
    '4 spaces': '4 स्पेस',
    'Tab': 'टैब',
    'Repair JSON5, comments and trailing commas': 'JSON5, कमेंट और आखिरी कॉमा रिपेयर करें',
    'JSONPath query': 'JSONPath क्वेरी',
    'Formatted output': 'फ़ॉर्मैटेड आउटपुट',
    'Show the output as': 'आउटपुट ऐसे दिखाएँ',
    'Text': 'टेक्स्ट',
    'Tree': 'ट्री',
    'Paste some JSON above.': 'ऊपर कुछ JSON पेस्ट कीजिए।',
    'What Repair changed': 'रिपेयर ने क्या बदला',
    'Valid': 'सही (valid)',
    'yes': 'हाँ',
    'no': 'नहीं',
    'Top-level type': 'सबसे ऊपर का प्रकार',
    'Keys / items': 'की / आइटम',
    'Max depth': 'ज़्यादा से ज़्यादा गहराई',
    'Query this path': 'इस पाथ की क्वेरी करें'
  },
  k: ['$.items[*].sku', 'object', 'array', 'string', 'number', 'boolean', 'null']
};

tools['word-counter'].k = [];
/* the longest word is the visitor's own: a bare word of theirs stays as it is */
tools['word-counter'].p.push(['^([A-Za-z’\'-]+)$', '$1']);

const DAYS = { Monday: 'सोमवार', Tuesday: 'मंगलवार', Wednesday: 'बुधवार', Thursday: 'गुरुवार', Friday: 'शुक्रवार', Saturday: 'शनिवार', Sunday: 'रविवार' };
const MONTHS = { January: 'जनवरी', February: 'फ़रवरी', March: 'मार्च', April: 'अप्रैल', May: 'मई', June: 'जून', July: 'जुलाई', August: 'अगस्त', September: 'सितंबर', October: 'अक्टूबर', November: 'नवंबर', December: 'दिसंबर' };
const SIGNS = { Aries: 'मेष', Taurus: 'वृषभ', Gemini: 'मिथुन', Cancer: 'कर्क', Leo: 'सिंह', Virgo: 'कन्या', Libra: 'तुला', Scorpio: 'वृश्चिक', Sagittarius: 'धनु', Capricorn: 'मकर', Aquarius: 'कुंभ', Pisces: 'मीन' };
const ANIMALS = { Rat: 'चूहा', Ox: 'बैल', Tiger: 'बाघ', Rabbit: 'खरगोश', Dragon: 'ड्रैगन', Snake: 'साँप', Horse: 'घोड़ा', Goat: 'बकरी', Monkey: 'बंदर', Rooster: 'मुर्गा', Dog: 'कुत्ता', Pig: 'सूअर' };
const ELEMENTS = { Wood: 'लकड़ी', Fire: 'अग्नि', Earth: 'पृथ्वी', Metal: 'धातु', Water: 'जल' };
tools['age-calculator'] = {
  s: Object.assign({}, DAYS, MONTHS, SIGNS, ANIMALS, ELEMENTS, {
    'Date of birth': 'जन्म तारीख',
    'Age at date': 'इस तारीख पर उम्र',
    'Time of birth (optional)': 'जन्म का समय (चाहें तो)',
    'Time zone of birth (optional, e.g. Europe/London)': 'जन्म का टाइम ज़ोन (चाहें तो, जैसे Asia/Kolkata)',
    'More people (optional): a name and a YYYY-MM-DD date each, separated by semicolons': 'और लोग (चाहें तो): हर एक का नाम और YYYY-MM-DD तारीख, सेमीकोलन (;) से अलग',
    'e.g. Asha 1988-03-02; Tom 2015-11-30': 'जैसे Asha 1988-03-02; Tom 2015-11-30',
    'Age': 'उम्र',
    'Age in years': 'उम्र सालों में',
    'Total months': 'कुल महीने',
    'Total weeks': 'कुल हफ़्ते',
    'Total days': 'कुल दिन',
    'Total hours': 'कुल घंटे',
    'Day of the week born': 'जन्म का दिन',
    'Next birthday': 'अगला जन्मदिन',
    'Days until then': 'तब तक बचे दिन',
    'Age on the next birthday': 'अगले जन्मदिन पर उम्र',
    'Star sign': 'राशि (पश्चिमी)',
    'Chinese zodiac': 'चीनी राशि',
    'Today': 'आज'
  }),
  p: [
    ['^This device: (\\S+)$', 'यह डिवाइस: $1'],
    ['^([\\d,]+) years?, ([\\d,]+) months?, ([\\d,]+) days?$', '$1 साल, $2 महीने, $3 दिन'],
    ['^(\\w+) (\\d{1,2}) (\\w+) (\\d{4})$', '%1, $2 %3 $4'],
    ['^(\\d{1,2}) (\\w+) (\\d{4})$', '$1 %2 $3'],
    ['^(\\w+) \\((\\w+) (\\w+)\\)$', '%1 (%2 %3)'],
    ['^Right now: ([\\d,]+) days, (\\d+) h (\\d+) min (\\d+) s since birth — ([\\d,]+) seconds \\(from midnight; add a time of birth to be exact\\)\\.$', 'अभी: जन्म से $1 दिन, $2 घंटे $3 मिनट $4 सेकंड — $5 सेकंड (आधी रात से; सटीक गिनती के लिए जन्म का समय डालिए)।'],
    ['^Right now: ([\\d,]+) days, (\\d+) h (\\d+) min (\\d+) s since birth — ([\\d,]+) seconds\\.$', 'अभी: जन्म से $1 दिन, $2 घंटे $3 मिनट $4 सेकंड — $5 सेकंड।']
  ],
  k: ['UTC']
};
tools['percentage'] = {
  s: {
    'Question': 'सवाल',
    'Every answer for two numbers, A and B': 'दो संख्याओं A और B के सारे जवाब',
    'What is P% of N?': 'N का P% कितना है?',
    'X is what percentage of Y?': 'X, Y का कितना प्रतिशत है?',
    'X is P% of what?': 'X किसका P% है?',
    'Percentage change from one figure to another': 'एक आँकड़े से दूसरे तक प्रतिशत बदलाव',
    'Percentage difference between two figures': 'दो आँकड़ों में प्रतिशत अंतर',
    'The figure before a percentage rise or cut': 'प्रतिशत बढ़त या कटौती से पहले का आँकड़ा',
    'Fraction, decimal and percentage': 'भिन्न, दशमलव और प्रतिशत',
    'Value A': 'मान A',
    'Value B': 'मान B',
    'Percentage (%)': 'प्रतिशत (%)',
    'X (the part)': 'X (हिस्सा)',
    'N (the whole, or the figure now)': 'N (पूरा, या अभी का आँकड़ा)',
    'From (the old figure)': 'से (पुराना आँकड़ा)',
    'To (the new figure)': 'तक (नया आँकड़ा)',
    'N is the figure after a': 'N इसके बाद का आँकड़ा है',
    'Rise': 'बढ़त',
    'Cut': 'कटौती',
    'A fraction, decimal or percentage': 'भिन्न, दशमलव या प्रतिशत',
    'For example 3/8, 1 1/2, 0.375 or 37.5%.': 'जैसे 3/8, 1 1/2, 0.375 या 37.5%।',
    'A is what % of B': 'A, B का कितना % है',
    'A% of B': 'B का A%',
    '% change from A to B': 'A से B तक % बदलाव',
    'B increased by A%': 'B में A% बढ़ोतरी',
    'B decreased by A%': 'B में A% कमी',
    '% difference (symmetric)': '% अंतर (सममित)',
    'B before an A% rise': 'A% बढ़त से पहले B',
    'B before an A% cut': 'A% कटौती से पहले B',
    'P% of N': 'N का P%',
    'X as a % of Y': 'X, Y का %',
    'The whole': 'पूरा',
    'Change': 'बदलाव',
    'Difference': 'अंतर',
    'Before': 'पहले'
  }
};
tools['bmi'] = {
  s: {
    'Weight': 'वज़न',
    'Weight in kilograms': 'किलोग्राम में वज़न',
    'Weight unit': 'वज़न की यूनिट',
    'Height in centimetres': 'सेंटीमीटर में लंबाई',
    'Height unit': 'लंबाई की यूनिट',
    'Height': 'लंबाई',
    'Age (years)': 'उम्र (साल)',
    'Under 18, BMI is read against centiles for age and sex: give a child’s age with a decimal, such as 10.5 for ten and a half.': '18 से कम उम्र में BMI उम्र और लिंग के सेंटाइल से पढ़ा जाता है: बच्चे की उम्र दशमलव में दीजिए, जैसे साढ़े दस के लिए 10.5।',
    'Sex': 'लिंग',
    'Male': 'पुरुष',
    'Female': 'महिला',
    'Family background': 'पारिवारिक पृष्ठभूमि',
    'White, or any background not listed below': 'श्वेत, या कोई पृष्ठभूमि जो नीचे नहीं है',
    'South Asian, Chinese, other Asian, Middle Eastern, Black African or African-Caribbean': 'दक्षिण एशियाई (भारतीय समेत), चीनी, अन्य एशियाई, मध्य-पूर्वी, अश्वेत अफ़्रीकी या अफ़्रीकी-कैरेबियाई',
    'Waist (optional)': 'कमर (चाहें तो)',
    'Waist (optional) in centimetres': 'कमर (चाहें तो) सेंटीमीटर में',
    'Waist (optional) unit': 'कमर (चाहें तो) की यूनिट',
    'Body Mass Index': 'बॉडी मास इंडेक्स',
    'Standard Category': 'श्रेणी',
    'Within the healthy range': 'स्वस्थ सीमा में',
    'Underweight': 'कम वज़न',
    'Healthy weight': 'स्वस्थ वज़न',
    'Overweight': 'ज़्यादा वज़न',
    'Obese': 'मोटापा',
    'Healthy weight for your height': 'आपकी लंबाई के लिए स्वस्थ वज़न',
    'BMI prime (BMI ÷ 25)': 'BMI प्राइम (BMI ÷ 25)',
    'Below 18.5': '18.5 से कम',
    '30 and over': '30 और ऊपर',
    'Waist-to-height ratio': 'कमर-लंबाई अनुपात'
  },
  p: [
    ['^(\\S+ kg) \\((\\d+) st (\\d+) lb\\) to (\\S+ kg) \\((\\d+) st (\\d+) lb\\)$', '$1 ($2 st $3 lb) से $4 ($5 st $6 lb)'],
    ['^Where (\\S+) sits$', '$1 कहाँ है'],
    ['^Where (\\S+) sits\\. BMI (\\S+), in the band (\\S+) to (\\S+)\\.$', '$1 कहाँ है। BMI $2, $3 से $4 वाली श्रेणी में।'],
    ['^Where (\\S+) sits\\. BMI (\\S+), in the band (\\S+) and over\\.$', '$1 कहाँ है। BMI $2, $3 और ऊपर वाली श्रेणी में।'],
    ['^Where (\\S+) sits\\. BMI (\\S+), in the band below (\\S+)\\.$', '$1 कहाँ है। BMI $2, $3 से कम वाली श्रेणी में।'],
    ['^BMI (\\S+)$', 'BMI $1'],
    ['^([\\d.]+) to ([\\d.]+)$', '$1 से $2'],
    ['^([\\d.]+) and over$', '$1 और ऊपर'],
    ['^Below ([\\d.]+)$', '$1 से कम']
  ],
  k: ['cm', 'kg', 'lb', 'in', 'st + lb', 'ft + in']
};
tools['emi-calculator'] = {
  s: {
    'Loan amount (₹)': 'लोन की रकम (₹)',
    'Annual interest rate (%)': 'सालाना ब्याज दर (%)',
    'Tenure (years)': 'अवधि (साल)',
    'Extra payment each month (₹)': 'हर महीने अतिरिक्त भुगतान (₹)',
    'Part-prepayment and step-up': 'आंशिक प्री-पेमेंट और स्टेप-अप',
    'Part-prepayment (₹)': 'आंशिक प्री-पेमेंट (₹)',
    'Paid in month': 'किस महीने में चुकाया',
    'Raise the EMI each year by (%)': 'हर साल EMI इतनी बढ़ाएँ (%)',
    'A step-up EMI: the higher instalment closes the loan early.': 'स्टेप-अप EMI: बढ़ती किस्त लोन जल्दी खत्म करती है।',
    'Floating rate change': 'फ़्लोटिंग रेट में बदलाव',
    'Rate changes after (years)': 'इतने साल बाद रेट बदलेगा',
    '0 keeps one rate for the whole tenure.': '0 पर पूरी अवधि एक ही रेट रहता है।',
    'New rate (%)': 'नया रेट (%)',
    'Same rate throughout': 'पूरे समय एक ही रेट',
    'When the rate changes, keep': 'रेट बदलने पर, यह वही रखें',
    'The EMI (the tenure changes)': 'EMI (अवधि बदलेगी)',
    'The tenure (the EMI changes)': 'अवधि (EMI बदलेगी)',
    'Processing fee': 'प्रोसेसिंग फ़ीस',
    'Processing fee (% of the loan)': 'प्रोसेसिंग फ़ीस (लोन का %)',
    'Include the 18% GST on the fee.': 'फ़ीस पर 18% GST शामिल करें।',
    'Compare with another offer': 'किसी दूसरे ऑफ़र से तुलना',
    'Compare at a rate of (%)': 'इस रेट पर तुलना करें (%)',
    'Leave blank to skip': 'छोड़ना हो तो खाली रखें',
    'Over a tenure of (years)': 'इतनी अवधि में (साल)',
    'Same tenure': 'वही अवधि',
    'Monthly EMI': 'मासिक EMI',
    'Total interest': 'कुल ब्याज',
    'Total repayment': 'कुल भुगतान',
    'Interest as % of principal': 'मूलधन के % के रूप में ब्याज',
    'Paid off in': 'इतने में चुकता',
    'Interest saved by prepaying': 'प्री-पेमेंट से बचा ब्याज',
    'Months saved': 'बचे महीने',
    'Principal and interest each year': 'हर साल मूलधन और ब्याज',
    'Principal': 'मूलधन',
    'Interest': 'ब्याज',
    'Loan outstanding': 'बकाया लोन',
    'Balance': 'बकाया',
    'Total paid': 'कुल चुकाया',
    'Repayment schedule': 'रीपेमेंट शेड्यूल',
    'Loan amount': 'लोन की रकम',
    'Annual interest rate': 'सालाना ब्याज दर',
    'Tenure': 'अवधि',
    'Extra payment each month': 'हर महीने अतिरिक्त भुगतान',
    'Part-prepayment': 'आंशिक प्री-पेमेंट',
    'Raise the EMI each year by': 'हर साल EMI इतनी बढ़ाएँ',
    'Rate changes after': 'रेट इसके बाद बदलेगा',
    'New rate': 'नया रेट',
    'Compare at a rate of': 'इस रेट पर तुलना',
    'Over a tenure of': 'इतनी अवधि में',
    'Principal paid': 'चुकाया मूलधन',
    'Interest paid': 'चुकाया ब्याज',
    'Effective annual cost': 'असली सालाना लागत'
  },
  p: [
    ['^Principal: (.+)$', 'मूलधन: $1'],
    ['^Interest: (.+)$', 'ब्याज: $1'],
    ['^([\\d,]+) years?$', '$1 साल'],
    ['^([\\d,]+) years?, ([\\d,]+) months?$', '$1 साल, $2 महीने'],
    ['^([\\d,]+) months?$', '$1 महीने'],
    ['^(\\S+) % of the loan$', 'लोन का $1 %'],
    /* the charts' spoken summaries */
    ['^(.+)\\. (\\d+) to (\\d+)\\. At (\\d+): (.+)$', '%1। $2 से $3। $4 पर: %5'],
    ['^Principal (\\S+), Interest (\\S+)$', 'मूलधन $1, ब्याज $2'],
    ['^Balance (\\S+)$', 'बकाया $1'],
    ['^Total repayment\\. Principal (.+); Interest (.+)$', 'कुल भुगतान। मूलधन $1; ब्याज $2']
  ]
};

module.exports = { common, image, pdf, dev, core, qr, aiimg, tools, UNITS };
