/**
 * English text → Kokoro phonemes, without eSpeak.
 *
 * Kokoro-82M was trained on the phonemes of misaki (github.com/hexgrad/
 * misaki, Apache-2.0), its author's own G2P. This is a JavaScript port of
 * misaki's English lexicon path — its gold and silver dictionaries (served
 * from engine/models/kokoro-82m/lexicon-us.json and lexicon-gb.json), its
 * stress rules, its -s / -ed / -ing stemming and its special cases for a,
 * an, the, to, in, I, by, am, used — with three things misaki does
 * elsewhere done here in small form:
 *   - numbers, money, years, times and percentages are written out in
 *     words (misaki uses num2words), with lakh and crore for rupees;
 *   - acronyms are spelt letter by letter from the dictionary's letter
 *     names, and a short list of this site's own words (GST, PDF, UPI,
 *     challan, WhatsApp, 1234Tools…) is pronounced from a custom table;
 *   - a word in no dictionary falls back to letter-to-sound rules from NRL
 *     Report 7948 (Elovitz, Johnson, McHugh and Shore, US Naval Research
 *     Laboratory, 1976: a US Government work), in the transcription
 *     HeadTTS uses (github.com/met4citizen/HeadTTS, MIT, © 2025 Mika
 *     Suominen — notice in engine/models/LICENSE-headtts.txt), where misaki
 *     would ask eSpeak NG (GPL-3.0) or a neural fallback.
 * Nothing here is derived from eSpeak NG. There is no part-of-speech
 * tagger: the few dictionary words that change with their part of speech
 * (record, live, read, use…) are guessed from the word before them.
 *
 * Used inside the voice worker (engine/aivid-tts-worker.js) and loadable in
 * Node for tests: `KokoroG2P.create(lexiconJson, 'en-us' | 'en-gb')` →
 * `{ phonemize(text) → { phonemes, words }, split(phonemes, max) }`.
 */
(function (root) {
  'use strict';
  const PRIMARY = 'ˈ', SECONDARY = 'ˌ', STRESSES = 'ˌˈ';
  const VOWELS = new Set('AIOQWYaiuæɑɒɔəɛɜɪʊʌᵻ');
  const CONSONANTS = new Set('bdfhjklmnpstvwzðŋɡɹɾʃʒʤʧθ');
  const NON_QUOTE_PUNCTS = new Set(';:,.!?—…');
  const PUNCTS = ';:,.!?—…"“”';
  const US_TAUS = new Set('AIOWYiuæɑəɛɪɹʊʌ');
  const SYMBOLS = { '%': 'percent', '&': 'and', '+': 'plus', '@': 'at' };
  /* Kokoro's tokenizer vocabulary (tokenizer.json of the ONNX export); anything else is dropped */
  const VOCAB = new Set(';:,.!?—…"()“” \u0303ʣʥʦʨᵝꭧAIOQSTWYᵊabcdefhijklmnopqrstuvwxyzɑɐɒæβɔɕçɖðʤəɚɛɜɟɡɥɨɪʝɯɰŋɳɲɴøɸθœɹɾɻʁɽʂʃʈʧʊʋʌɣɤχʎʒʔˈˌːʰʲ↓→↗↘ᵻ');

  /* ------------------------------------------------------------------ */
  /* stress (misaki apply_stress)                                       */
  /* ------------------------------------------------------------------ */
  function restress(ps) {
    const ips = [...ps].map((c, i) => [i, c]);
    for (let i = 0; i < ips.length; i++) {
      if (STRESSES.indexOf(ips[i][1]) < 0) continue;
      let j = i;
      while (j < ips.length && !VOWELS.has(ips[j][1])) j++;
      if (j < ips.length) ips[i][0] = j - 0.5;
    }
    return ips.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('');
  }
  const hasAny = (ps, set) => { for (const c of ps) if (set.has(c)) return true; return false; };
  function applyStress(ps, stress) {
    if (ps === null || ps === undefined || stress === null || stress === undefined) return ps;
    const noMarks = ps.indexOf(PRIMARY) < 0 && ps.indexOf(SECONDARY) < 0;
    if (stress < -1) return ps.split(PRIMARY).join('').split(SECONDARY).join('');
    if (stress === -1 || ((stress === 0 || stress === -0.5) && ps.indexOf(PRIMARY) >= 0)) return ps.split(SECONDARY).join('').split(PRIMARY).join(SECONDARY);
    if ((stress === 0 || stress === 0.5 || stress === 1) && noMarks) return hasAny(ps, VOWELS) ? restress(SECONDARY + ps) : ps;
    if (stress >= 1 && ps.indexOf(PRIMARY) < 0 && ps.indexOf(SECONDARY) >= 0) return ps.split(SECONDARY).join(PRIMARY);
    if (stress > 1 && noMarks) return hasAny(ps, VOWELS) ? restress(PRIMARY + ps) : ps;
    return ps;
  }

  /* ------------------------------------------------------------------ */
  /* this site's words                                                  */
  /* ------------------------------------------------------------------ */
  /* always spelt out, even where a lower-case word exists (SIP is not "sip", US is not "us") */
  const ACRONYMS = new Set(('GST CGST SGST IGST UTGST GSTIN TDS TCS PDF CSV QR UPI EMI SIP PPF EPF NPS HRA CTC ITR HSN SAC IFSC KYC OTP ' +
    'FD RD ROI SEO API URL PNG JPG SVG GIF MP3 MP4 HTML CSS XML SQL SHA NPV IRR CAGR BMI GPA CGPA VAT PAYE NI HMRC UK US USA EU ' +
    'UAE CA CS CFO CEO HR FAQ SMS PC TV ID DIY CV EPS ESI UAN MRP LLP GPS AI ATM EV').split(' '));
  /* text read as other text before anything else */
  const ALIASES = [
    [/\b1234tools\.com\b/gi, 'one two three four tools dot com'],
    [/\b1234 ?tools\b/gi, 'one two three four tools'],
    [/\be\.g\.(?=\s|$)/gi, 'for example'], [/\bi\.e\.(?=\s|$)/gi, 'that is'],
    [/\betc\.(?=\s|$)/gi, 'etcetera'], [/\bvs\.?(?=\s)/gi, 'versus'],
    [/\b(?:Rs\.?|INR)\s?(?=\d)/g, '₹'], [/\bw\/(?=\s)/gi, 'with'],
    [/\bJPEG\b/g, 'jay peg'], [/\bJPG\b/g, 'jay peg'], [/\bWebP\b/g, 'web P'], [/\bPDF\b(?=s\b)/g, 'PDF'],
    [/\bDr\.(?= [A-Z])/g, 'Doctor'], [/\bMr\.(?= [A-Z])/g, 'Mister'], [/\bMrs\.(?= [A-Z])/g, 'Missus'], [/\bMs\.(?= [A-Z])/g, 'Miz'],
    [/\bno\.(?= ?\d)/gi, 'number'], [/\bkm\b(?=[\s.,!?]|$)/g, 'kilometres'], [/\bkg\b(?=[\s.,!?]|$)/g, 'kilograms'],
    [/\bMB\b/g, 'megabytes'], [/\bGB\b/g, 'gigabytes'], [/\bKB\b/g, 'kilobytes']
  ];
  /* pronounced from this table, in American then British phonemes */
  const CUSTOM = {
    challan: ['ʧˈɑlən', 'ʧˈʌlən'], challans: ['ʧˈɑlənz', 'ʧˈʌlənz'],
    whatsapp: ['wˈʌtsˌæp', 'wˈɒtsap'], tiktok: ['tˈɪktˌɑk', 'tˈɪktɒk'], aadhaar: ['ˈɑdɑɹ', 'ˈɑːdɑː'], aadhar: ['ˈɑdɑɹ', 'ˈɑːdɑː'],
    json: ['ʤˈAsən', 'ʤˈAsən'], gstr: ['ʤˌiˌɛstˌiˈɑɹ', 'ʤˌiːˌɛstˌiːˈɑː'], tally: ['tˈæli', 'tˈali'], zerodha: ['zəɹˈOdə', 'zəɹˈQdə'],
    paytm: ['pˈAtˌiˈɛm', 'pˈAtˌiːˈɛm'], phonepe: ['fˈOnpˌA', 'fˈQnpA'], lakhs: ['lˈɑks', 'lˈaks'], crores: ['kɹˈɔɹz', 'kɹˈɔːz'],
    rupees: ['ɹupˈiz', 'ɹuːpˈiːz'], paisa: ['pˈIsə', 'pˈIsə'], app: ['ˈæp', 'ˈap'], apps: ['ˈæps', 'ˈaps'],
    reels: ['ɹˈilz', 'ɹˈiːlz'], online: ['ˌɑnlˈIn', 'ɒnlˈIn'], offline: ['ˌɔflˈIn', 'ɒflˈIn'], signup: ['sˈInˌʌp', 'sˈInʌp'],
    screenshot: ['skɹˈinʃˌɑt', 'skɹˈiːnʃɒt'], screenshots: ['skɹˈinʃˌɑts', 'skɹˈiːnʃɒts'], hashtag: ['hˈæʃtˌæɡ', 'hˈaʃtaɡ'], hashtags: ['hˈæʃtˌæɡz', 'hˈaʃtaɡz']
  };

  /* ------------------------------------------------------------------ */
  /* numbers in words                                                   */
  /* ------------------------------------------------------------------ */
  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function under100(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''); }
  function under1000(n) { return n >= 100 ? ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + under100(n % 100) : '') : under100(n); }
  function cardinal(n) {
    if (n === 0) return 'zero';
    const scales = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
    const out = [];
    for (const [v, w] of scales) if (n >= v) { out.push(under1000(Math.floor(n / v)) + ' ' + w); n %= v; }
    if (n) out.push(under1000(n));
    return out.join(' ');
  }
  function indian(n) {
    if (n < 1e5) return cardinal(n);
    const out = [];
    if (n >= 1e7) { out.push(indian(Math.floor(n / 1e7)) + ' crore'); n %= 1e7; }
    if (n >= 1e5) { out.push(under100(Math.floor(n / 1e5)) + ' lakh'); n %= 1e5; }
    if (n) out.push(cardinal(n));
    return out.join(' ');
  }
  function ordinal(n) {
    const w = cardinal(n).split(/([ -])/);
    const last = w[w.length - 1];
    const irr = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
    w[w.length - 1] = irr[last] || (/y$/.test(last) ? last.slice(0, -1) + 'ieth' : last + 'th');
    return w.join('');
  }
  function year(n) {
    if (n % 1000 < 10 && n % 1000 > 0 && n >= 2000) return cardinal(n);
    if (n % 100 === 0 && n % 1000 !== 0) return under100(Math.floor(n / 100)) + ' hundred';
    if (n % 1000 === 0) return cardinal(n);
    const lo = n % 100;
    return under100(Math.floor(n / 100)) + ' ' + (lo < 10 ? 'oh ' + ONES[lo] : under100(lo));
  }
  const digits = (s) => [...s].map((d) => ONES[Number(d)]).join(' ');
  function decimal(s, big) {
    const [i, f] = s.split('.');
    const whole = i === '' ? 'zero' : (big ? big(Number(i)) : cardinal(Number(i)));
    return f === undefined ? whole : whole + ' point ' + digits(f);
  }
  const CURRENCY = { '$': ['dollar', 'dollars', 'cent', 'cents'], '£': ['pound', 'pounds', 'penny', 'pence'], '€': ['euro', 'euros', 'cent', 'cents'], '₹': ['rupee', 'rupees', 'paisa', 'paise'] };
  function money(sym, num, scale) {
    const c = CURRENCY[sym];
    const big = sym === '₹' ? indian : cardinal;
    const clean = num.replace(/,/g, '');
    if (scale) return decimal(clean, big) + ' ' + scale + ' ' + c[1];
    const [i, f] = clean.split('.');
    const whole = Number(i || 0), cents = f ? Math.round(Number('0.' + f) * 100) : 0;
    const parts = [];
    if (whole || !cents) parts.push(big(whole) + ' ' + (whole === 1 ? c[0] : c[1]));
    if (cents) parts.push(cardinal(cents) + ' ' + (cents === 1 ? c[2] : c[3]));
    return parts.join(' and ');
  }

  /** One written token → the words it is read as (strings), before any dictionary. */
  function expand(core) {
    let m;
    if (!core) return [];
    if ((m = /^([$£€₹])(\d[\d,]*(?:\.\d+)?)(k|m|bn|cr|crore|lakh|lakhs|million|billion|thousand)?$/i.exec(core))) {
      const sc = m[3] ? ({ k: 'thousand', m: 'million', bn: 'billion', cr: 'crore', lakhs: 'lakh' }[m[3].toLowerCase()] || m[3].toLowerCase()) : '';
      return money(m[1], m[2], sc).split(/[ ]+/);
    }
    if ((m = /^(\d[\d,]*(?:\.\d+)?)([$£€₹])$/.exec(core))) return money(m[2], m[1]).split(' ');
    if ((m = /^(-?)(\d[\d,]*(?:\.\d+)?)%$/.exec(core))) return ((m[1] ? 'minus ' : '') + decimal(m[2].replace(/,/g, '')) + ' percent').split(' ');
    if ((m = /^(\d{1,2}):(\d\d)(am|pm)?$/i.exec(core))) {
      const h = Number(m[1]), mi = Number(m[2]);
      return (cardinal(h) + ' ' + (mi === 0 ? (m[3] ? '' : "o'clock") : mi < 10 ? 'oh ' + ONES[mi] : under100(mi)) + (m[3] ? ' ' + m[3].toUpperCase() : '')).trim().split(/ +/);
    }
    if ((m = /^(\d+)(st|nd|rd|th)$/i.exec(core))) return ordinal(Number(m[1])).split(' ');
    if ((m = /^(\d{2})(\d0)s$/.exec(core))) return (under100(Number(m[1])) + ' ' + under100(Number(m[2])).replace(/y$/, 'ies')).split(' ');
    if ((m = /^(\d+(?:\.\d+)?)(k|x)$/i.exec(core))) return (decimal(m[1]) + (m[2].toLowerCase() === 'k' ? ' thousand' : ' times')).split(' ');
    if ((m = /^(\d+)[-–](\d+)$/.exec(core))) return expand(m[1]).concat(['to'], expand(m[2]));
    if (/^\d{4}$/.test(core) && Number(core) >= 1100 && Number(core) <= 2099) return year(Number(core)).split(' ');
    if (/^0\d+$/.test(core)) return digits(core).split(' ');
    if (/^-?\d{1,3}(,\d{2,3})+(\.\d+)?$/.test(core) || /^-?\d+(\.\d+)?$/.test(core)) {
      const neg = core[0] === '-';
      const n = core.replace(/^-/, '');
      const indianGroups = /^\d{1,2}(,\d\d)+,\d{3}/.test(n);
      return ((neg ? 'minus ' : '') + decimal(n.replace(/,/g, ''), indianGroups ? indian : null)).split(' ');
    }
    if ((m = /^([\w.+-]+)@([\w-]+(?:\.[\w-]+)+)$/.exec(core))) return expand(m[1].replace(/\./g, ' dot ')).concat(['at'], expand(m[2]));
    if (/^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|org|net|co|uk|io|ai|app|dev|me|info|biz)(?:\/\S*)?$/i.test(core)) {
      const host = core.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      return host.split('.').flatMap((p, i) => (i ? ['dot'] : []).concat(p.toLowerCase() === 'www' ? ['W', 'W', 'W'] : expand(p)));
    }
    if (core.indexOf('/') > 0 && core.indexOf('/') < core.length - 1) return core.split('/').flatMap((p, i) => (i ? ['slash'] : []).concat(expand(p)));
    if (/^[^-]+-[^-]/.test(core) && !/^-?\d/.test(core)) return core.split(/-+/).filter(Boolean).flatMap(expand);
    if (core.indexOf('&') > 0) return core.split('&').flatMap((p, i) => (i ? ['and'] : []).concat(expand(p)));
    if ((m = /^([A-Za-z]+)(\d+)$/.exec(core)) || (m = /^(\d+)([A-Za-z]+)$/.exec(core))) {
      if (CUSTOM[core.toLowerCase()] || ACRONYMS.has(core)) return [core];
      const a = m[1], b = m[2];
      const say = (s) => /^\d+$/.test(s) ? (s.length > 2 ? digits(s).split(' ') : expand(s)) : expand(s);
      return say(a).concat(say(b));
    }
    if (/^#\w/.test(core)) return expand(core.slice(1));
    return [core];
  }

  /* ------------------------------------------------------------------ */
  /* letter-to-sound rules: NRL Report 7948, as transcribed by HeadTTS  */
  /* ------------------------------------------------------------------ */
  const RULES = {
    A: [' [A] =AX', ' [ARE] =AA R', ' [AR]O=AX R', '[AR]#=EH R', ' ^[AS]#=EY S', '[A]WA=AX', '[AW]=AO', ' :[ANY]=EH N IY',
      '[A]^+#=EY', '#:[ALLY]=AX L IY', ' [AL]#=AX L', '[AGAIN]=AX G EH N', '#:[AG]E=IH JH', '[A]^+:#=AE', ' :[A]^+ =EY', '[A]^%=EY',
      ' [ARR]=AX R', '[ARR]=AE R', ' :[AR] =AA R', '[AR] =ER', '[AR]=AA R', '[AIR]=EH R', '[AI]=EY', '[AY]=EY', '[AU]=AO',
      '#:[AL] =AX L', '#:[ALS] =AX L Z', '[ALK]=AO K', '[AL]^=AO L', ' :[ABLE]=EY B AX L', '[ABLE]=AX B AX L', '[ANG]+=EY N JH', '[A]=AE'],
    B: [' [BE]^#=B IH', '[BEING]=B IY IH NX', ' [BOTH] =B OW TH', ' [BUS]#=B IH Z', '[BUIL]=B IH L', '[B]=B'],
    C: [' [CH]^=K', '^E[CH]=K', '[CH]=CH', ' S[CI]#=S AY', '[CI]A=SH', '[CI]O=SH', '[CI]EN=SH', '[C]+=S', '[CK]=K', '[COM]%=K AH M', '[C]=K'],
    D: ['#:[DED] =D IH D', '.E[D] =D', '#^:E[D] =T', ' [DE]^#=D IH', ' [DO] =D UW', ' [DOES]=D AH Z', ' [DOING]=D UW IH NX',
      ' [DOW]=D AW', '[DU]A=JH UW', '[D]=D'],
    E: ['#:[E] =', "'^:[E] =", ' :[E] =IY', '#[ED] =D', '#:[E]D =', '[EV]ER=EH V', '[E]^%=IY', '[ERI]#=IY R IY', '[ERI]=EH R IH',
      '#:[ER]#=ER', '[ER]#=EH R', '[ER]=ER', ' [EVEN]=IY V EH N', '#:[E]W=', '@[EW]=UW', '[EW]=Y UW', '[E]O=IY', '#:&[ES] =IH Z',
      '#:[E]S =', '#:[ELY] =L IY', '#:[EMENT]=M EH N T', '[EFUL]=F UH L', '[EE]=IY', '[EARN]=ER N', ' [EAR]^=ER', '[EAD]=EH D',
      '#:[EA] =IY AX', '[EA]SU=EH', '[EA]=IY', '[EIGH]=EY', '[EI]=IY', ' [EYE]=AY', '[EY]=IY', '[EU]=Y UW', '[E]=EH'],
    F: ['[FUL]=F UH L', '[F]=F'],
    G: ['[GIV]=G IH V', ' [G]I^=G', '[GE]T=G EH', 'SU[GGES]=G JH EH S', '[GG]=G', ' B#[G]=G', '[G]+=JH', '[GREAT]=G R EY T', '#[GH]=', '[G]=G'],
    H: [' [HAV]=HH AE V', ' [HERE]=HH IY R', ' [HOUR]=AW ER', '[HOW]=HH AW', '[H]#=HH', '[H]='],
    I: [' [IN]=IH N', ' [I] =AY', '[IN]D=AY N', '[IER]=IY ER', '#:R[IED] =IY D', '[IED] =AY D', '[IEN]=IY EH N', '[IE]T=AY EH',
      ' :[I]%=AY', '[I]%=IY', '[IE]=IY', '[I]^+:#=IH', '[IR]#=AY R', '[IZ]%=AY Z', '[IS]%=AY Z', '[I]D%=AY', '+^[I]^+=IH',
      '[I]T%=AY', '#^:[I]^+=IH', '[I]^+=AY', '[IR]=ER', '[IGH]=AY', '[ILD]=AY L D', '[IGN] =AY N', '[IGN]^=AY N', '[IGN]%=AY N',
      '[IQUE]=IY K', '[I]=IH'],
    J: ['[J]=JH'],
    K: [' [K]N=', '[K]=K'],
    L: ['[LO]C#=L OW', 'L[L]=', '#^:[L]%=AX L', '[LEAD]=L IY D', '[L]=L'],
    M: ['[MOV]=M UW V', '[M]=M'],
    N: ['E[NG]+=N JH', '[NG]R=NX G', '[NG]#=NX G', '[NGL]%=NX G AX L', '[NG]=NX', '[NK]=NX K', ' [NOW] =N AW', '[N]=N'],
    O: ['[OF] =AX V', '[OROUGH]=ER OW', '#:[OR] =ER', '#:[ORS] =ER Z', '[OR]=AO R', ' [ONE]=W AH N', '[OW]=OW', ' [OVER]=OW V ER',
      '[OV]=AH V', '[O]^%=OW', '[O]^EN=OW', '[O]^I#=OW', '[OL]D=OW L', '[OUGHT]=AO T', '[OUGH]=AH F', ' [OU]=AW', 'H[OU]S#=AW',
      '[OUS]=AX S', '[OUR]=AO R', '[OULD]=UH D', '^[OU]^L=AH', '[OUP]=UW P', '[OU]=AW', '[OY]=OY', '[OING]=OW IH NX', '[OI]=OY',
      '[OOR]=AO R', '[OOK]=UH K', '[OOD]=UH D', '[OO]=UW', '[O]E=OW', '[O] =OW', '[OA]=OW', ' [ONLY]=OW N L IY', ' [ONCE]=W AH N S',
      "[ON'T]=OW N T", 'C[O]N=AA', '[O]NG=AO', ' ^:[O]N=AH', 'I[ON]=AX N', '#:[ON] =AX N', '#^[ON]=AX N', '[O]ST =OW',
      '[OF]^=AO F', '[OTHER]=AH DH ER', '[OSS] =AO S', '#^:[OM]=AH M', '[O]=AA'],
    P: ['[PH]=F', '[PEOP]=P IY P', '[POW]=P AW', '[PUT] =P UH T', '[P]=P'],
    Q: ['[QUAR]=K W AO R', '[QU]=K W', '[Q]=K'],
    R: [' [RE]^#=R IY', '[R]=R'],
    S: ['[SH]=SH', '#[SION]=ZH AX N', '[SOME]=S AH M', '#[SUR]#=ZH ER', '[SUR]#=SH ER', '#[SU]#=ZH UW', '#[SSU]#=SH UW', '#[SED] =Z D',
      '#[S]#=Z', '[SAID]=S EH D', '^[SION]=SH AX N', '[S]S=', '.[S] =Z', '#:.E[S] =Z', '#^:##[S] =Z', '#^:#[S] =S', 'U[S] =S',
      ' :#[S] =Z', ' [SCH]=S K', '[S]C+=', '#[SM]=Z M', "#[SN]'=Z AX N", '[S]=S'],
    T: [' [THE] =DH AX', '[TO] =T UW', '[THAT] =DH AE T', ' [THIS] =DH IH S', ' [THEY]=DH EY', ' [THERE]=DH EH R', '[THER]=DH ER',
      '[THEIR]=DH EH R', ' [THAN] =DH AE N', ' [THEM] =DH EH M', '[THESE] =DH IY Z', ' [THEN]=DH EH N', '[THROUGH]=TH R UW',
      '[THOSE]=DH OW Z', '[THOUGH] =DH OW', ' [THUS]=DH AH S', '[TH]=TH', '#:[TED] =T IH D', 'S[TI]#N=CH', '[TI]O=SH', '[TI]A=SH',
      '[TIEN]=SH AX N', '[TUR]#=CH ER', '[TU]A=CH UW', ' [TWO]=T UW', '[T]=T'],
    U: [' [UN]I=Y UW N', ' [UN]=AH N', ' [UPON]=AX P AO N', '@[UR]#=UH R', '[UR]#=Y UH R', '[UR]=ER', '[U]^ =AH', '[U]^^=AH',
      '[UY]=AY', ' G[U]#=', 'G[U]%=', 'G[U]#=W', '#N[U]=Y UW', '@[U]=UW', '[U]=Y UW'],
    V: ['[VIEW]=V Y UW', '[V]=V'],
    W: [' [WERE]=W ER', '[WA]S=W AA', '[WA]T=W AA', '[WHERE]=WH EH R', '[WHAT]=WH AA T', '[WHOL]=HH OW L', '[WHO]=HH UW', '[WH]=WH',
      '[WAR]=W AO R', '[WOR]^=W ER', '[WR]=R', '[W]=W'],
    X: [' [X]=Z', '[X]=K S'],
    Y: ['[YOUNG]=Y AH NX', ' [YOU]=Y UW', ' [YES]=Y EH S', ' [Y]=Y', '#^:[Y] =IY', '#^:[Y]I=IY', ' :[Y] =AY', ' :[Y]#=AY',
      ' :[Y]^+:#=IH', ' :[Y]^#=AY', '[Y]=IH'],
    Z: ['[Z]=Z']
  };
  const OPS = { '#': '[AEIOUY]+', '.': '[BDVGJLMNRWZ]', '%': '(?:ER|E|ES|ED|ING|ELY)', '&': '(?:[SCGZXJ]|CH|SH)', '@': '(?:[TSRDLZNJ]|TH|CH|SH)',
    '^': '[BCDFGHJKLMNPQRSTVWXZ]', '+': '[EIY]', ':': '[BCDFGHJKLMNPQRSTVWXZ]*', ' ': ' ' };
  const ARPA = { AO: 'ɔ', AA: 'ɑ', IY: 'i', UW: 'u', EH: 'ɛ', IH: 'ɪ', UH: 'ʊ', AH: 'ʌ', AX: 'ə', AE: 'æ', EY: 'A', AY: 'I', OW: 'O', AW: 'W', OY: 'Y',
    P: 'p', B: 'b', T: 't', D: 'd', K: 'k', G: 'ɡ', CH: 'ʧ', JH: 'ʤ', F: 'f', V: 'v', TH: 'θ', DH: 'ð', S: 's', Z: 'z', SH: 'ʃ', ZH: 'ʒ',
    HH: 'h', M: 'm', N: 'n', NX: 'ŋ', L: 'l', R: 'ɹ', ER: 'ɜɹ', W: 'w', WH: 'w', Y: 'j' };
  let compiled = null;
  function compile() {
    if (compiled) return compiled;
    compiled = {};
    const ctx = (s) => [...s].map((c) => OPS[c] || c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    for (const k of Object.keys(RULES)) {
      compiled[k] = RULES[k].map((r) => {
        const a = r.indexOf('['), b = r.indexOf(']'), e = r.indexOf('=');
        return {
          left: a > 0 ? new RegExp('(?:' + ctx(r.slice(0, a)) + ')$') : null,
          letters: r.slice(a + 1, b),
          right: b + 1 < e ? new RegExp('^(?:' + ctx(r.slice(b + 1, e)) + ')') : null,
          ps: r.slice(e + 1).trim().split(/\s+/).filter(Boolean).map((p) => ARPA[p] || '').join('')
        };
      });
    }
    return compiled;
  }
  function rules(word) {
    const R = compile();
    const w = ' ' + word.toUpperCase().replace(/[^A-Z']/g, '') + ' ';
    let i = 1, out = '';
    while (i < w.length - 1) {
      const list = R[w[i]];
      if (!list) { i++; continue; }
      let hit = null;
      for (const r of list) {
        if (w.substr(i, r.letters.length) !== r.letters) continue;
        if (r.left && !r.left.test(w.slice(0, i))) continue;
        if (r.right && !r.right.test(w.slice(i + r.letters.length))) continue;
        hit = r; break;
      }
      if (!hit) { i++; continue; }
      out += hit.ps;
      i += hit.letters.length;
    }
    return out;
  }
  function toBritish(ps) {
    return ps.replace(/O/g, 'Q').replace(/æ/g, 'a').replace(/ɾ/g, 't').replace(/ᵻ/g, 'ɪ')
      .replace(/([ɑɔɜ])ɹ(?![AIOQWYaiuæɑɒɔəɛɜɪʊʌ])/g, '$1ː').replace(/ɛɹ(?![AIOQWYaiuæɑɒɔəɛɜɪʊʌ])/g, 'ɛː')
      .replace(/əɹ(?![AIOQWYaiuæɑɒɔəɛɜɪʊʌ])/g, 'ə');
  }

  /* ------------------------------------------------------------------ */
  /* the lexicon (misaki Lexicon, without spaCy tags)                   */
  /* ------------------------------------------------------------------ */
  const isAlpha = (s) => /^[A-Za-z]+$/.test(s);
  const isLexWord = (s) => /^[A-Za-z'-]+$/.test(s);
  const lower = (s) => s.toLowerCase();
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
  const parentTag = (t) => !t ? t : /^VB/.test(t) ? 'VERB' : /^NN/.test(t) ? 'NOUN' : /^(ADV|RB)/.test(t) ? 'ADV' : /^(ADJ|JJ)/.test(t) ? 'ADJ' : t;

  function create(data, accent) {
    const british = accent === 'en-gb';
    const gold = data.g, silver = data.s;
    const pick = (d, w) => {
      if (Object.prototype.hasOwnProperty.call(d, w)) return d[w];
      if (w.length < 2) return undefined;
      const l = lower(w);
      if (w === l && w !== cap(w) && Object.prototype.hasOwnProperty.call(d, cap(w))) return d[cap(w)];
      if (w === cap(l) && w !== l && Object.prototype.hasOwnProperty.call(d, l)) return d[l];
      return undefined;
    };
    const inGold = (w) => pick(gold, w) !== undefined;
    const inSilver = (w) => pick(silver, w) !== undefined;

    /* Letter by letter. misaki runs the letter names together (ʤˌiˌɛstˈi); Kokoro then says the s-t of
       "GST" as one cluster and listeners (and Whisper) hear "GSD". With a space between letters each
       one starts fresh, the T keeps its puff of air, and the last letter carries the stress, as people
       say acronyms. */
    function getNNP(word) {
      const ps = [];
      for (const c of word) { if (!/[A-Za-z]/.test(c)) continue; const p = gold[c.toUpperCase()]; if (typeof p !== 'string') return null; ps.push(p); }
      if (!ps.length) return null;
      return ps.map((p, i) => applyStress(p, i === ps.length - 1 ? 2 : 0.5).split(PRIMARY).join(i === ps.length - 1 ? PRIMARY : SECONDARY)).join(' ');
    }
    function isKnown(word) {
      if (inGold(word) || inSilver(word) || SYMBOLS[word]) return true;
      if (!isLexWord(word)) return false;
      if (word.length === 1) return true;
      if (word === word.toUpperCase() && inGold(lower(word))) return true;
      return word.slice(1) === word.slice(1).toUpperCase();
    }
    function lookup(word, tag, stress, ctx) {
      let isNNP = null;
      if (word === word.toUpperCase() && !inGold(word)) { word = lower(word); isNNP = tag === 'NNP'; }
      let ps = pick(gold, word);
      if (ps === undefined && !isNNP) ps = pick(silver, word);
      if (ps && typeof ps === 'object') {
        let t = tag;
        if (ctx && ctx.futureVowel === null && 'None' in ps) t = 'None';
        else if (!(t in ps)) t = parentTag(t);
        ps = (t in ps) ? ps[t] : ps.DEFAULT;
      }
      if (ps === undefined || ps === null || (isNNP && ps.indexOf(PRIMARY) < 0)) {
        const n = getNNP(word);
        if (n) return n;
      }
      return ps === undefined ? null : applyStress(ps, stress);
    }
    const _s = (stem) => !stem ? null : /[ptkfθ]$/.test(stem) ? stem + 's' : /[szʃʒʧʤ]$/.test(stem) ? stem + (british ? 'ɪ' : 'ᵻ') + 'z' : stem + 'z';
    function stemS(word, tag, stress, ctx) {
      if (word.length < 3 || !word.endsWith('s')) return null;
      let stem;
      if (!word.endsWith('ss') && isKnown(word.slice(0, -1))) stem = word.slice(0, -1);
      else if ((word.endsWith("'s") || (word.length > 4 && word.endsWith('es') && !word.endsWith('ies'))) && isKnown(word.slice(0, -2))) stem = word.slice(0, -2);
      else if (word.length > 4 && word.endsWith('ies') && isKnown(word.slice(0, -3) + 'y')) stem = word.slice(0, -3) + 'y';
      else return null;
      return _s(lookup(stem, tag, stress, ctx));
    }
    function _ed(stem) {
      if (!stem) return null;
      if (/[pkfθʃsʧ]$/.test(stem)) return stem + 't';
      if (stem.endsWith('d')) return stem + (british ? 'ɪ' : 'ᵻ') + 'd';
      if (!stem.endsWith('t')) return stem + 'd';
      if (british || stem.length < 2) return stem + 'ɪd';
      if (US_TAUS.has(stem[stem.length - 2])) return stem.slice(0, -1) + 'ɾᵻd';
      return stem + 'ᵻd';
    }
    function stemEd(word, tag, stress, ctx) {
      if (word.length < 4 || !word.endsWith('d')) return null;
      let stem;
      if (!word.endsWith('dd') && isKnown(word.slice(0, -1))) stem = word.slice(0, -1);
      else if (word.length > 4 && word.endsWith('ed') && !word.endsWith('eed') && isKnown(word.slice(0, -2))) stem = word.slice(0, -2);
      else return null;
      return _ed(lookup(stem, tag, stress, ctx));
    }
    function _ing(stem) {
      if (!stem) return null;
      if (british) { if (/[əː]$/.test(stem)) return null; }
      else if (stem.length > 1 && stem.endsWith('t') && US_TAUS.has(stem[stem.length - 2])) return stem.slice(0, -1) + 'ɾɪŋ';
      return stem + 'ɪŋ';
    }
    function stemIng(word, tag, stress, ctx) {
      if (word.length < 5 || !word.endsWith('ing')) return null;
      let stem;
      if (word.length > 5 && isKnown(word.slice(0, -3))) stem = word.slice(0, -3);
      else if (isKnown(word.slice(0, -3) + 'e')) stem = word.slice(0, -3) + 'e';
      else if (word.length > 5 && /([bcdgklmnprstvxz])\1ing$|cking$/.test(word) && isKnown(word.slice(0, -4))) stem = word.slice(0, -4);
      else return null;
      return _ing(lookup(stem, tag, stress, ctx));
    }
    function special(word, tag, stress, ctx) {
      if (SYMBOLS[word]) return lookup(SYMBOLS[word], null, null, ctx);
      if (/\./.test(word.replace(/^\.+|\.+$/g, '')) && isAlpha(word.replace(/\./g, '')) && Math.max(...word.split('.').map((x) => x.length)) < 3) return getNNP(word);
      if (word === 'a') return 'ɐ';
      if (word === 'A') return ctx.nextIsWord ? 'ɐ' : 'ˈA';
      if (word === 'am' || word === 'Am') return ctx.futureVowel === null ? (typeof gold.am === 'string' ? gold.am : 'ˈæm') : 'ɐm';
      if (word === 'an' || word === 'An') return 'ɐn';
      if (word === 'I') return SECONDARY + 'I';
      if (word === 'to' || word === 'To') return ctx.futureVowel === null ? (typeof gold.to === 'string' ? gold.to : 'tu') : ctx.futureVowel ? 'tʊ' : 'tə';
      if (word === 'in' || word === 'In') return (ctx.futureVowel === null ? PRIMARY : '') + 'ɪn';
      if (word === 'the' || word === 'The') return ctx.futureVowel === true ? 'ði' : 'ðə';
      if (/^vs\.?$/i.test(word)) return lookup('versus', null, null, ctx);
      if (word === 'used' || word === 'Used') { const u = gold.used; return typeof u === 'object' ? (ctx.futureTo ? u.VBD : u.DEFAULT) : u; }
      return null;
    }
    function custom(word) {
      const c = CUSTOM[lower(word)];
      if (c) return c[british ? 1 : 0];
      if (ACRONYMS.has(word)) return getNNP(word);
      if (/^[A-Z]{2,}s$/.test(word) && ACRONYMS.has(word.slice(0, -1))) return _s(getNNP(word.slice(0, -1)));
      return null;
    }
    function getWord(word, tag, stress, ctx) {
      const sp = special(word, tag, stress, ctx);
      if (sp) return sp;
      const wl = lower(word);
      if (word.length > 1 && isAlpha(word.replace(/'/g, '')) && word !== wl && (tag !== 'NNP' || word.length > 7) &&
          !inGold(word) && !inSilver(word) && (word === word.toUpperCase() || word.slice(1) === word.slice(1).toLowerCase()) &&
          (inGold(wl) || inSilver(wl) || stemS(wl, tag, stress, ctx) || stemEd(wl, tag, stress, ctx) || stemIng(wl, tag, stress, ctx))) word = wl;
      if (isKnown(word)) return lookup(word, tag, stress, ctx);
      if (word.endsWith("s'") && isKnown(word.slice(0, -2) + "'s")) return lookup(word.slice(0, -2) + "'s", tag, stress, ctx);
      if (word.endsWith("'") && isKnown(word.slice(0, -1))) return lookup(word.slice(0, -1), tag, stress, ctx);
      return stemS(word, tag, stress, ctx) || stemEd(word, tag, stress, ctx) || stemIng(word, tag, stress === null ? 0.5 : stress, ctx) || null;
    }
    /* the guess that stands in for a tagger: a word after "to", a modal or a pronoun is a verb; after a determiner, a noun */
    const VERBY = new Set('to will would can could should must might may shall i you we they don\'t doesn\'t didn\'t won\'t can\'t please let\'s not never just'.split(' '));
    const NOUNY = new Set('a an the this that these those your my our their his her its every each no any some one'.split(' '));
    const tagOf = (prev) => !prev ? null : VERBY.has(lower(prev)) ? 'VB' : NOUNY.has(lower(prev)) ? 'NN' : null;

    function wordPhonemes(word, prev, ctx) {
      word = word.replace(/[‘’]/g, "'");
      const cu = custom(word);
      if (cu) return cu;
      const stress = word === lower(word) ? null : word === word.toUpperCase() ? 2 : 0.5;
      const tag = tagOf(prev);
      let ps = getWord(word, tag, stress, ctx);
      if (ps) return ps;
      if (/^[A-Z]{2,5}$/.test(word)) return getNNP(word);
      if (/^[A-Za-z]$/.test(word)) return getNNP(word);
      /* camelCase or a joined word: try its parts */
      const parts = word.match(/[A-Z]?[a-z']+|[A-Z]+(?![a-z])|\d+/g);
      if (parts && parts.length > 1) {
        const ps2 = parts.map((p, i) => wordPhonemes(p, i ? parts[i - 1] : prev, ctx));
        if (ps2.every(Boolean)) return ps2.join(' ');
      }
      const r = rules(word);
      if (!r) return null;
      const out = applyStress(r, 2);
      return british ? toBritish(out) : out;
    }

    function tokens(text) {
      for (const [re, to] of ALIASES) text = text.replace(re, to);
      text = text.normalize('NFKC')
        .replace(/[‘’]/g, "'").replace(/[«»]/g, '"')
        .replace(/\.{3,}/g, '…').replace(/\s[-–]\s/g, ' — ').replace(/–/g, '-').replace(/[→⇒]/g, ' to ')
        .replace(/\p{Extended_Pictographic}|[\u{FE0F}\u{200D}]/gu, ' ')
        .replace(/[*_~|<>{}\[\]^`=\\]/g, ' ')
        .replace(/\s+/g, ' ').trim();
      const out = [];
      for (const chunk of text.split(' ')) {
        if (!chunk) continue;
        let lead = '', core = chunk, tail = '';
        let m = /^([("“"']+)/.exec(core); if (m) { lead = m[1]; core = core.slice(m[1].length); }
        m = /([)"”"';:,.!?—…]+)$/.exec(core); if (m && m[1].length < core.length + 1) { tail = m[1]; core = core.slice(0, core.length - m[1].length); }
        /* a closing apostrophe that belongs to the word (dogs') stays */
        if (/^'/.test(tail) && /s$/.test(core)) { core += "'"; tail = tail.slice(1); }
        if (lead) out.push({ punct: lead.replace(/'/g, '').replace(/"/g, '“') });
        for (const w of expand(core)) if (w) out.push({ text: w });
        if (tail) out.push({ punct: tail.replace(/'/g, '').replace(/"/g, '”') });
      }
      return out;
    }

    function phonemize(text) {
      const toks = tokens(String(text || ''));
      const ctx = { futureVowel: null, futureTo: false, nextIsWord: false };
      for (let i = toks.length - 1; i >= 0; i--) {
        const t = toks[i];
        if (t.punct !== undefined) {
          t.ps = [...t.punct].filter((c) => PUNCTS.indexOf(c) >= 0 || c === '(' || c === ')').join('');
          if ([...t.punct].some((c) => NON_QUOTE_PUNCTS.has(c))) { ctx.futureVowel = null; ctx.nextIsWord = false; }
          continue;
        }
        let prev = null;
        for (let k = i - 1; k >= 0; k--) { if (toks[k].punct !== undefined) break; prev = toks[k].text; break; }
        t.ps = wordPhonemes(t.text, prev, ctx) || '';
        /* misaki token_context: the first sound of this word decides "the" / "to" before it */
        let fv = ctx.futureVowel;
        for (const c of t.ps) { if (NON_QUOTE_PUNCTS.has(c)) { fv = null; break; } if (VOWELS.has(c)) { fv = true; break; } if (CONSONANTS.has(c)) { fv = false; break; } }
        ctx.futureVowel = t.ps ? fv : ctx.futureVowel;
        ctx.futureTo = /^(to|To|TO)$/.test(t.text);
        ctx.nextIsWord = /^[A-Za-z]/.test(t.text);
      }
      let s = '';
      for (const t of toks) {
        if (t.punct !== undefined) {
          if (!t.ps) continue;
          const opening = /^[(“—]/.test(t.ps);
          s += (opening && s && !/ $/.test(s) ? ' ' : '') + t.ps;
          if (t.ps[0] === '—') { s += ' '; continue; }
          if (!opening) s += ' ';
          continue;
        }
        if (!t.ps) continue;
        if (s && !/[ (“]$/.test(s)) s += ' ';
        s += t.ps;
      }
      if (!british) s = s.replace(/ɾ/g, 'T').replace(/ʔ/g, 't');
      s = [...s].filter((c) => VOCAB.has(c)).join('').replace(/ +/g, ' ').replace(/ ([;:,.!?…”)])/g, '$1').trim();
      return { phonemes: s, words: toks.filter((t) => t.text).map((t) => ({ text: t.text, ps: t.ps })) };
    }

    /** Cut a phoneme string into pieces of at most `max` symbols, at a sentence end, then a comma, then a space. */
    function split(ps, max) {
      max = max || 400;
      const out = [];
      let rest = ps.trim();
      while ([...rest].length > max) {
        const arr = [...rest];
        const head = arr.slice(0, max).join('');
        let at = -1;
        for (const re of [/[.!?…](?=\s)/g, /[;:,—](?=\s)/g, / /g]) {
          let m; while ((m = re.exec(head))) at = m.index + 1;
          if (at > max * 0.3) break;
          at = -1;
        }
        if (at < 0) at = head.length;
        out.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) out.push(rest);
      return out;
    }
    return { phonemize, split, wordPhonemes: (w) => wordPhonemes(w, null, { futureVowel: null, futureTo: false, nextIsWord: false }), rules, accent };
  }

  const api = { create, applyStress, expand, cardinal, indian, ordinal, year, rules, VOCAB, ACRONYMS, CUSTOM };
  root.KokoroG2P = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
