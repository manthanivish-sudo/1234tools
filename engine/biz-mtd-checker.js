/**
 * Making Tax Digital, answered for one person.
 *
 * HMRC writes to a sole trader or a landlord and the letter does not say
 * the one thing they want to know: does this apply to me, and from when.
 * The answer turns on "qualifying income", which is gross income before
 * expenses across every self-employment and every property business — not
 * profit, which is what almost everybody types in. This adds it up the
 * right way, in the open, says which threshold catches them and on which
 * date, lists what they would actually have to do, and is candid about
 * everything it cannot decide. All of it in the browser.
 *
 * Every rule it applies lives in the MTD constant below. Nothing else in
 * this file hard-codes a threshold, a date or a deadline.
 */
(function () {
  'use strict';

  /* ==================================================================
   * MAKING TAX DIGITAL - THE RULES THIS TOOL APPLIES
   * ------------------------------------------------------------------
   * Written        : 2026-09-20
   * Verified       : NO. These figures were NOT checked against a live
   *                  gov.uk page. They are the rules as they were
   *                  understood on the date above, written down in one
   *                  place so they can be reviewed and corrected in one
   *                  place. gov.uk is the authority. This file is not.
   *
   * If HMRC has moved a threshold, a date or a deadline, EDIT THIS BLOCK
   * and nothing else. The page prints `checked` and `authority` so a
   * reader always knows how old the advice is and where to go instead.
   *
   * POINTS I AM LEAST SURE OF are listed in `recheck` and are printed on
   * the page itself, so the tool tells the user what it does not know.
   * ================================================================== */
  const MTD = {
    checked: '2026-09-20',
    authority: 'https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax',
    authorityLabel: 'gov.uk: check if you are eligible for Making Tax Digital for Income Tax',
    vatAuthority: 'https://www.gov.uk/guidance/use-making-tax-digital-for-vat',
    vatAuthorityLabel: 'gov.uk: use Making Tax Digital for VAT',

    itsa: {
      /* Who it can apply to at all. Companies are outside MTD for Income
         Tax entirely; partnerships are deferred (see `partnerships`). */
      appliesTo: 'self-employed sole traders and landlords',

      /* QUALIFYING INCOME is GROSS income BEFORE expenses, added up across
         every trade and every property business. It is not profit and it
         is not turnover from one business alone. This single definition
         is the most misread part of the regime. */
      qualifyingIncome: {
        isGross: true,
        includes: ['turnover from self-employment', 'gross rental income from UK property', 'gross rental income from overseas property'],
        excludes: ['employment income (PAYE)', 'pensions', 'dividends and savings interest', 'capital gains'],
        note: 'Gross, before any expense, allowance or relief is taken off.'
      },

      /* THE RULE IS "OVER", NOT "AT LEAST". Qualifying income of exactly
         50,000.00 is NOT over 50,000 and so is not caught by the first
         band; it is over 30,000 and is caught by the second. If HMRC's
         wording is "50,000 or more", change `test` to 'atLeast'. */
      test: 'over',

      /* Start dates by qualifying income. `year` is the calendar year the
         tax year starts in: 2026 means the tax year 2026-27, which begins
         on 6 April 2026. */
      bands: [
        { year: 2026, from: '2026-04-06', threshold: 50000 },
        { year: 2027, from: '2027-04-06', threshold: 30000 },
        { year: 2028, from: '2028-04-06', threshold: 20000 }
      ],

      /* Whether you are in is judged on the tax return for the year TWO
         years before the start year: the April 2026 start is judged on
         the 2024-25 return. */
      lookBackYears: 2,

      /* Flagged as "close" when income is within this fraction below a
         threshold. A presentation choice, not a rule from HMRC. */
      nearMargin: 0.10,

      obligations: [
        'Keep your business records digitally - in software, not on paper and not only in a hand-typed spreadsheet.',
        'Send a quarterly update for each business you run and for each property business, four times a tax year.',
        'Make a Final Declaration after the tax year ends. It replaces the Self Assessment tax return you send now.'
      ],
      /* Each separate trade is its own business; UK property is one
         property business and overseas property is a separate one. Two
         businesses therefore means eight quarterly updates a year. */
      updatesPerBusinessPerYear: 4,
      finalDeclaration: { day: '31 January', afterTaxYear: true, note: 'It replaces the Self Assessment return, and the tax payment dates are unchanged.' },

      /* Quarterly periods. `startY`/`endY`/`dueY` are offsets in whole
         years from the calendar year the tax year starts in. */
      taxYear: { startsMD: '04-06', endsMD: '04-05' },
      quarterSets: {
        standard: {
          label: 'Standard quarters',
          blurb: 'Periods ending 5 July, 5 October, 5 January and 5 April.',
          periods: [
            { startMD: '04-06', startY: 0, endMD: '07-05', endY: 0, dueMD: '08-07', dueY: 0 },
            { startMD: '07-06', startY: 0, endMD: '10-05', endY: 0, dueMD: '11-07', dueY: 0 },
            { startMD: '10-06', startY: 0, endMD: '01-05', endY: 1, dueMD: '02-07', dueY: 1 },
            { startMD: '01-06', startY: 1, endMD: '04-05', endY: 1, dueMD: '05-07', dueY: 1 }
          ]
        },
        calendar: {
          label: 'Calendar quarters (by election)',
          blurb: 'Periods ending 30 June, 30 September, 31 December and 31 March. You have to elect for these in your software.',
          periods: [
            { startMD: '04-06', startY: 0, endMD: '06-30', endY: 0, dueMD: '08-07', dueY: 0 },
            { startMD: '07-01', startY: 0, endMD: '09-30', endY: 0, dueMD: '11-07', dueY: 0 },
            { startMD: '10-01', startY: 0, endMD: '12-31', endY: 0, dueMD: '02-07', dueY: 1 },
            { startMD: '01-01', startY: 1, endMD: '03-31', endY: 1, dueMD: '05-07', dueY: 1 }
          ]
        }
      },

      /* Quarterly updates carry CUMULATIVE year-to-date totals, not the
         figures for that quarter standing alone. RE-VERIFY: this is in
         `recheck` below because it changed during the pilot. */
      cumulative: true,

      partnerships: 'Partnerships are deferred. No start date had been set for them when this was written.',
      exemptions: [
        'Automatic exemption for some people, including certain trustees, personal representatives and Lloyd\'s underwriters.',
        'Exemption on application if it is not reasonably practicable for you to use digital tools - the "digitally excluded" test. Age, disability, location, and religious observance are all grounds HMRC has recognised.',
        'Being exempt is not the same as being under the threshold. If you are over the threshold you are in unless HMRC agrees otherwise.'
      ]
    },

    vat: {
      mandatorySince: '2022-04-01',
      mandatorySinceLabel: 'April 2022',
      scope: 'every VAT-registered business, whatever its turnover - the old 85,000 threshold for MTD for VAT went in April 2022',
      obligations: [
        'Keep your VAT records digitally.',
        'Use digital links between every system the figures pass through - no copying and pasting a total from one place into another by hand.',
        'File the VAT return through software that HMRC has recognised, not by typing it into the old online form.'
      ]
    },

    /* The tool prints these. Say what you do not know. */
    recheck: [
      'Whether a quarterly update carries cumulative year-to-date totals or the figures for that quarter alone. This is set as cumulative here; it changed during the pilot and is worth confirming in your software.',
      'The exact end date of the fourth calendar quarter under a calendar quarter election. It is set here as 31 March; the tax year itself ends on 5 April, so check how your software treats income dated 1 to 5 April.',
      'Whether the threshold test is "over" the figure or "at or above" it. It is set here as over, so exactly 50,000 falls into the next band down.',
      'Whether anything in the 2026 or 2027 Budgets moved a threshold or a start date after this page was written.'
    ]
  };

  const YR = (y) => y + '-' + String((y + 1) % 100).padStart(2, '0');

  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['mtd-checker'] = {
    title: 'Making Tax Digital: Does It Apply to Me?',
    short: 'MTD Checker',
    description: 'Work out whether Making Tax Digital for Income Tax catches you, and from which April. It adds up your qualifying income the way HMRC defines it - gross income before expenses, across every trade and every property business - shows the sum, names the threshold that catches you, counts your quarterly updates, and gives you the first period and its deadline. Guidance as at ' + MTD.checked + '; gov.uk is the authority. Runs in your browser.',
    keywords: ['making tax digital', 'mtd for income tax', 'am i affected by mtd', 'mtd threshold', 'qualifying income', 'mtd quarterly update', 'mtd for landlords', 'mtd sole trader', 'mtd itsa start date', 'making tax digital checker'],
    glyph: 'i-mtd-check',
    glyphSvg: '<symbol id="i-mtd-check" viewBox="0 0 24 24">\n  <path d="M5 2.8h8.6l5 5v13.4H5z"/>\n  <path d="M13.6 2.8v5h5" class="thin"/>\n  <path d="M9.4 12.1a2.6 2.6 0 1 1 3.4 2.5c-.7.3-1 .8-1 1.5v.4" class="thin"/>\n  <circle cx="11.8" cy="18.5" r=".85" class="fill"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/pdfcore.bundle.js', '/engine/biz-mtd-checker.js'],
    tips: [
      'Qualifying income is gross, before expenses. A landlord with ' + '£' + '31,000 of rent and ' + '£' + '14,000 of mortgage interest, agent fees and repairs has qualifying income of ' + '£' + '31,000, not ' + '£' + '17,000. That is the mistake that puts people on the wrong side of a threshold.',
      'It is added up across everything. A plumber turning over ' + '£' + '24,000 who also lets a flat for ' + '£' + '9,000 has qualifying income of ' + '£' + '33,000 and is caught from April 2027, even though neither figure alone is near a threshold.',
      'Whether you are in is judged on the tax return for the year two years earlier. The April 2026 start is decided on your 2024-25 return, which you have already filed - so for that one the figure is settled, not a forecast.',
      'Every threshold, date and deadline this page uses sits in one clearly-marked block at the top of the engine file, labelled ' + MTD.checked + '. It was not verified against a live gov.uk page. Check anything you are about to act on against gov.uk, and treat this as a prompt to look, not as the answer.',
      'Quarterly updates are counted per business. Two trades and a UK property business is three businesses, so twelve updates a year plus one Final Declaration - not four.',
      'Being just under a threshold is not the end of it. A good year two years before a start date pulls you in, so watch the figure rather than filing it away.',
      'MTD for VAT is separate and much older. If you are VAT registered you have been in it since April 2022 whatever your turnover, and the digital links rule - no copying a total from one system into another by hand - applies to you now.'
    ],
    faq: [
      { q: 'What exactly is qualifying income?', a: 'Gross income before expenses, from self-employment and from property, added together. Turnover from every trade plus the rent from every property, UK and overseas, before a single cost comes off. It is not your profit, it is not your taxable income, and it does not include employment income, pensions, dividends or savings interest. If you take one thing from this page, take that.' },
      { q: 'Which return is it judged on?', a: 'The tax return for the year two years before the start year. The 6 April 2026 start is judged on your 2024-25 return, the 6 April 2027 start on 2025-26, and the 6 April 2028 start on 2026-27. That is why a quiet year now does not get you out of a busy year two years ago - and why a good year now matters for a date that feels a long way off.' },
      { q: 'How many quarterly updates will I have to send?', a: 'Four a year for each business. Each separate trade is a business; your UK property letting is one property business and overseas property is a separate one. A sole trader who also lets a UK flat sends eight updates a year, plus one Final Declaration by 31 January after the tax year ends.' },
      { q: 'Are these figures right?', a: 'They are the rules as understood on ' + MTD.checked + ', written into one constant block so they can be reviewed and corrected in one place. They were not checked against a live gov.uk page, and the things least certain are printed on the results as "what to re-check". Treat this as a way of framing the question for your accountant or for gov.uk, not as a ruling.' },
      { q: 'Can this get me out of it?', a: 'No, and it does not try. It cannot grant an exemption, decide a digitally excluded application, tell you what HMRC holds on your record, or say when partnerships will be brought in. It works out one thing - whether your qualifying income crosses a threshold, and when - and tells you plainly what it has not decided.' },
      { q: 'Is anything I type sent anywhere?', a: 'No. Every figure is added up in your browser, and the PDF and text summary are written there too. Your turnover and your rent never leave the device, and nothing is logged.' }
    ]
  };
  if (typeof document === 'undefined') return;

  const K = () => window.MVRBizKit;

  /* ---------------- pure logic ---------------- */

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : String(iso || ''); };
  const gbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gbp0 = (n) => '£' + Math.round(Number(n) || 0).toLocaleString('en-GB');
  const dayGap = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

  /** Does `amount` cross `threshold` under the rule in the constant block? */
  function crosses(amount, threshold) {
    return MTD.itsa.test === 'atLeast' ? amount >= threshold : amount > threshold;
  }

  /** The four quarterly periods of a tax year, with deadlines. */
  function quarterPeriods(taxYearStart, mode) {
    const set = MTD.itsa.quarterSets[mode] || MTD.itsa.quarterSets.standard;
    return set.periods.map((p, i) => ({
      n: i + 1,
      start: (taxYearStart + p.startY) + '-' + p.startMD,
      end: (taxYearStart + p.endY) + '-' + p.endMD,
      due: (taxYearStart + p.dueY) + '-' + p.dueMD
    }));
  }

  /** Gross, before expenses, across every source. Shows its working. */
  function qualifyingIncome(input) {
    const parts = [];
    const n = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };
    if (input.selfEmployed) parts.push({ label: 'Turnover from self-employment (gross, before expenses)', amount: n(input.seTurnover) });
    if (input.landlord) {
      parts.push({ label: 'Gross rental income - UK property', amount: n(input.ukProperty) });
      parts.push({ label: 'Gross rental income - overseas property', amount: n(input.overseasProperty) });
    }
    const total = parts.reduce((s, p) => s + p.amount, 0);
    return { parts, total };
  }

  /** One business per trade, one for UK property, one for overseas. */
  function businessList(input) {
    const out = [];
    const count = Math.max(1, Math.round(Number(input.businesses) || 1));
    if (input.selfEmployed) for (let i = 0; i < count; i++) out.push(count > 1 ? 'Self-employment ' + (i + 1) : 'Self-employment');
    if (input.landlord) {
      const uk = Number(input.ukProperty) > 0, ov = Number(input.overseasProperty) > 0;
      if (uk || !ov) out.push('UK property business');
      if (ov) out.push('Overseas property business');
    }
    return out;
  }

  /** Band by band: is it crossed, and is the year given the deciding one? */
  function bandVerdicts(total, figuresYear) {
    return MTD.itsa.bands.map(b => {
      const decidedBy = b.year - MTD.itsa.lookBackYears;
      const caught = crosses(total, b.threshold);
      let basis;
      if (figuresYear === decidedBy) basis = 'These are the figures that decide this one.';
      else if (figuresYear < decidedBy) basis = 'Decided on your ' + YR(decidedBy) + ' return, which is later than the year you gave - this is what happens if the figure stays where it is.';
      else basis = 'Decided on your ' + YR(decidedBy) + ' return, which is earlier than the year you gave - check that return, not this figure.';
      return {
        year: b.year, from: b.from, threshold: b.threshold, caught, basis,
        decidedBy, decidedByLabel: YR(decidedBy), taxYearLabel: YR(b.year),
        near: !caught && total > b.threshold * (1 - MTD.itsa.nearMargin),
        shortfall: caught ? 0 : Math.round((b.threshold - total) * 100) / 100
      };
    });
  }

  /** The whole answer for one person. */
  function assess(input) {
    const today = input.today || new Date().toISOString().slice(0, 10);
    const inScope = !!(input.selfEmployed || input.landlord);
    const qualifying = qualifyingIncome(input);
    const bands = bandVerdicts(qualifying.total, Number(input.figuresYear));
    const first = inScope ? (bands.find(b => b.caught) || null) : null;
    const businesses = inScope ? businessList(input) : [];
    const mode = MTD.itsa.quarterSets[input.quarterMode] ? input.quarterMode : 'standard';
    const periods = first ? quarterPeriods(first.year, mode) : null;

    const watch = inScope ? bands.filter(b => !b.caught && (b.near || !first)) : [];
    const limits = [
      'It does not check what HMRC holds on your record. Your figure and HMRC\'s figure for the same year can differ.',
      'It does not decide an exemption. ' + MTD.itsa.exemptions.join(' '),
      'It does not cover partnerships. ' + MTD.itsa.partnerships,
      'It reads the return for the year two years before each start date. If you gave figures for a different year, treat the answer as an indication and check the right return.',
      'It is guidance as at ' + MTD.checked + ' and was not verified against a live gov.uk page. gov.uk is the authority.'
    ];

    return {
      today, inScope, qualifying, bands, first, businesses, mode,
      figuresYear: Number(input.figuresYear), figuresYearLabel: YR(Number(input.figuresYear)),
      quarterMode: mode, quarterLabel: MTD.itsa.quarterSets[mode].label,
      periods,
      updatesPerYear: businesses.length * MTD.itsa.updatesPerBusinessPerYear,
      finalDeclaration: first ? MTD.itsa.finalDeclaration.day + ' ' + (first.year + 2) : null,
      vat: { applies: !!input.vatRegistered, since: MTD.vat.mandatorySinceLabel },
      partnership: !!input.partnership,
      watch, limits,
      daysToStart: first ? dayGap(today, first.from) : null,
      daysToFirstDeadline: periods ? dayGap(today, periods[0].due) : null
    };
  }

  /** The written answer, as blocks. ASCII and the pound sign only - it is
      also drawn into a PDF, and the PDF fonts are WinAnsi. */
  function reportBlocks(A) {
    const B = [];
    const head = [];
    if (!A.inScope) {
      head.push('Making Tax Digital for Income Tax does not apply to you.');
      head.push('It applies to ' + MTD.itsa.appliesTo + '. You told us you are neither.');
      head.push('If you start a trade or let a property, come back - the test is on gross income, and it catches people sooner than they expect.');
    } else if (A.first) {
      head.push('Making Tax Digital for Income Tax applies to you from ' + fmtDate(A.first.from) + '.');
      head.push('That is the start of the ' + A.first.taxYearLabel + ' tax year.');
      head.push('Your qualifying income of ' + gbp(A.qualifying.total) + ' is over the ' + gbp0(A.first.threshold) + ' threshold for that date.');
      head.push('It is judged on your ' + A.first.decidedByLabel + ' tax return. ' + A.first.basis);
      head.push(A.daysToStart > 0 ? 'That is ' + A.daysToStart.toLocaleString('en-GB') + ' days away.' : 'That date has already passed.');
    } else {
      head.push('On these figures, Making Tax Digital for Income Tax does not catch you yet.');
      head.push('Your qualifying income of ' + gbp(A.qualifying.total) + ' is under the lowest threshold, ' + gbp0(MTD.itsa.bands[MTD.itsa.bands.length - 1].threshold) + ', which applies from ' + fmtDate(MTD.itsa.bands[MTD.itsa.bands.length - 1].from) + '.');
      head.push('Keep watching it. Each start date is judged on the return for the year two years before, so a good year now decides a date two years out.');
    }
    B.push({ head: 'Where you stand', lines: head });

    const q = ['Qualifying income is GROSS income, before any expense comes off. It is not profit.'];
    A.qualifying.parts.forEach(p => q.push('  ' + p.label + ': ' + gbp(p.amount)));
    q.push('  ' + '-'.repeat(44));
    q.push('  Qualifying income: ' + gbp(A.qualifying.total));
    q.push('You gave these as your ' + A.figuresYearLabel + ' figures. Each start date is decided on the return two years before it, so see the band below for the year that decides each one.');
    q.push('Left out on purpose: ' + MTD.itsa.qualifyingIncome.excludes.join(', ') + '.');
    B.push({ head: 'How that figure is made up', lines: q });

    const t = [];
    A.bands.forEach(b => {
      t.push((b.caught ? '[IN]  ' : '[out] ') + 'From ' + fmtDate(b.from) + ' - qualifying income ' + (MTD.itsa.test === 'atLeast' ? 'of ' : 'over ') + gbp0(b.threshold)
        + ' - judged on the ' + b.decidedByLabel + ' return');
      t.push('       Your ' + gbp(A.qualifying.total) + (b.caught ? ' is over it.' : ' is ' + gbp(b.shortfall) + ' under it.') + (b.near ? ' That is close.' : ''));
    });
    B.push({ head: 'The three start dates', lines: t });

    if (A.first) {
      const o = [];
      MTD.itsa.obligations.forEach(x => o.push('- ' + x));
      o.push('');
      o.push('Your businesses for this purpose:');
      A.businesses.forEach(x => o.push('  - ' + x));
      o.push('That is ' + A.businesses.length + ' business' + (A.businesses.length === 1 ? '' : 'es') + ' x ' + MTD.itsa.updatesPerBusinessPerYear + ' quarterly updates = ' + A.updatesPerYear + ' updates a tax year, plus one Final Declaration.');
      o.push('Final Declaration for ' + A.first.taxYearLabel + ': by ' + A.finalDeclaration + '. ' + MTD.itsa.finalDeclaration.note);
      if (MTD.itsa.cumulative) o.push('Each quarterly update carries cumulative year-to-date totals, not that quarter on its own. See "what to re-check" below.');
      B.push({ head: 'What you would have to do', lines: o });

      const p = [A.quarterLabel + '. ' + MTD.itsa.quarterSets[A.quarterMode].blurb, ''];
      A.periods.forEach(x => p.push('  Q' + x.n + '  ' + fmtDate(x.start) + ' to ' + fmtDate(x.end) + '   due ' + fmtDate(x.due)));
      p.push('');
      p.push('First update: for the period ending ' + fmtDate(A.periods[0].end) + ', due ' + fmtDate(A.periods[0].due)
        + (A.daysToFirstDeadline > 0 ? ' - ' + A.daysToFirstDeadline.toLocaleString('en-GB') + ' days from today.' : '.'));
      B.push({ head: 'Your quarterly periods for ' + A.first.taxYearLabel, lines: p });
    }

    if (A.watch.length) {
      const w = ['A threshold you have not crossed is still worth watching, because each date is judged on the return for the year two years before.'];
      A.watch.forEach(b => w.push('  From ' + fmtDate(b.from) + ': ' + gbp(b.shortfall) + ' more qualifying income in ' + b.decidedByLabel + ' would bring you in.'));
      B.push({ head: 'What to watch', lines: w });
    }

    const v = A.vat.applies
      ? ['You told us you are VAT registered, so MTD for VAT already applies to you and has done since ' + A.vat.since + '.',
         ...MTD.vat.obligations.map(x => '- ' + x),
         'This is separate from MTD for Income Tax and does not change any date above.']
      : ['You told us you are not VAT registered, so MTD for VAT does not apply.',
         'If you register, it applies at once: it covers ' + MTD.vat.scope + '.'];
    B.push({ head: 'MTD for VAT', lines: v });

    const l = A.limits.map(x => '- ' + x);
    if (A.partnership) l.unshift('- You told us you are in a partnership. ' + MTD.itsa.partnerships + ' The partnership\'s own position is not decided here; your personal qualifying income still counts your share of the partnership profits, which this page does not ask for.');
    B.push({ head: 'What this does not decide', lines: l });

    B.push({ head: 'What to re-check', lines: MTD.recheck.map(x => '- ' + x) });
    B.push({
      head: 'Where this came from', lines: [
        'Guidance as at ' + MTD.checked + ', not verified against a live gov.uk page.',
        'The authority is gov.uk, not this page:',
        '  ' + MTD.authority,
        '  ' + MTD.vatAuthority,
        'Prepared with 1234tools.com. Nothing you typed was uploaded.'
      ]
    });
    return B;
  }

  const reportText = (A) => reportBlocks(A).map(b => b.head + '\n' + '-'.repeat(b.head.length) + '\n' + b.lines.join('\n')).join('\n\n');

  function reportPdf(A) {
    const core = window.MVRPdfCore;
    const [W, H] = core.PAGE_SIZES.a4;
    const m = 48, pages = [];
    let ops = [], y = H - m;
    const page = () => { pages.push({ size: [W, H], ops }); ops = []; y = H - m; };
    const room = (n) => { if (y < m + (n || 0) + 26) page(); };
    const line = (text, size, font, colour) => {
      for (const part of core.wrapText(String(text), font || 'Helvetica', size || 9.5, W - m * 2)) {
        room(0);
        ops.push({ text: part, x: m, y, size: size || 9.5, font: font || 'Helvetica', colour });
        y -= (size || 9.5) + 3.2;
      }
    };
    ops.push({ rect: [0, H - 5, W, 5], fill: '#8a1c1c' });
    ops.push({ text: 'Making Tax Digital - where you stand', x: m, y, size: 16, font: 'Helvetica-Bold' }); y -= 20;
    ops.push({ text: 'Prepared ' + fmtDate(A.today) + '. Guidance as at ' + MTD.checked + ', not verified against gov.uk. gov.uk is the authority.', x: m, y, size: 8, colour: '#666666' }); y -= 14;
    ops.push({ line: [m, y, W - m, y], stroke: '#cfc7bb', lineWidth: 0.6 }); y -= 18;
    for (const b of reportBlocks(A)) {
      room(30);
      line(b.head, 11, 'Helvetica-Bold', '#8a1c1c'); y -= 3;
      for (const t of b.lines) { if (t === '') { y -= 5; continue; } line(t, /^\s\s/.test(t) ? 9 : 9.5, /^(Making Tax Digital|On these figures)/.test(t) ? 'Helvetica-Bold' : 'Helvetica'); }
      y -= 8;
    }
    page();
    pages.forEach((p, i) => p.ops.push({ text: 'Prepared with 1234tools.com - guidance as at ' + MTD.checked + ', check gov.uk before acting.   Page ' + (i + 1) + ' of ' + pages.length, x: m, y: 26, size: 6.8, colour: '#aaaaaa' }));
    return new Blob([core.createPDF(pages, { info: { Title: 'Making Tax Digital - where you stand', Creator: '1234Tools' } })], { type: 'application/pdf' });
  }

  /* ---------------- the page ---------------- */

  function mount(root) {
    const k = K();
    const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const msg = k.msgBox();

    io.appendChild(k.h3('1 · Who you are'));
    const bar1 = k.el('div', 'opt-bar');
    const who = k.select('mtd-who', [
      { value: 'se', label: 'Self-employed (sole trader)' },
      { value: 'landlord', label: 'A landlord' },
      { value: 'both', label: 'Both - self-employed and a landlord' },
      { value: 'neither', label: 'Neither' }
    ], 'se');
    const nBiz = k.textInput('mtd-nbiz', '1', '', 'number'); nBiz.min = 1; nBiz.max = 20;
    const vat = k.select('mtd-vat', [{ value: 'no', label: 'Not VAT registered' }, { value: 'yes', label: 'VAT registered' }], 'no');
    const part = k.select('mtd-partner', [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes, I am in a partnership' }], 'no');
    bar1.appendChild(k.field('Your position', who));
    bar1.appendChild(k.field('Separate trades you run', nBiz, 'Each trade is its own business, with its own quarterly updates'));
    bar1.appendChild(k.field('VAT', vat));
    bar1.appendChild(k.field('In a partnership?', part, 'Partnerships are deferred - see the limits below'));
    io.appendChild(bar1);

    io.appendChild(k.h3('2 · Your gross income, before any expenses'));
    const note = k.el('div', 'io-msg is-warn');
    note.textContent = 'Qualifying income is gross income before expenses, added up across every trade and every property business. It is not your profit. Enter turnover and rent as invoiced or received, with nothing taken off.';
    io.appendChild(note);
    const bar2 = k.el('div', 'opt-bar');
    const seT = k.textInput('mtd-se', '', '0', 'number'); seT.min = 0; seT.step = '0.01';
    const ukP = k.textInput('mtd-uk', '', '0', 'number'); ukP.min = 0; ukP.step = '0.01';
    const ovP = k.textInput('mtd-ov', '', '0', 'number'); ovP.min = 0; ovP.step = '0.01';
    const thisYear = new Date().getMonth() > 2 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const years = []; for (let y = thisYear + 1; y >= thisYear - 5; y--) years.push({ value: y, label: YR(y) + ' tax year' });
    const figY = k.select('mtd-year', years, MTD.itsa.bands[0].year - MTD.itsa.lookBackYears);
    const qmode = k.select('mtd-qmode', Object.keys(MTD.itsa.quarterSets).map(x => ({ value: x, label: MTD.itsa.quarterSets[x].label })), 'standard');
    bar2.appendChild(k.field('Turnover from self-employment (£)', seT, 'Gross takings, fees and sales - before expenses'));
    bar2.appendChild(k.field('Gross rent - UK property (£)', ukP, 'Rent before mortgage interest, agent fees or repairs'));
    bar2.appendChild(k.field('Gross rent - overseas property (£)', ovP, 'A separate property business from your UK one'));
    bar2.appendChild(k.field('These figures are for', figY, 'Each start date is judged on the return two years earlier'));
    bar2.appendChild(k.field('Quarterly periods', qmode, 'Calendar quarters need an election in your software'));
    io.appendChild(bar2);

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Check where I stand', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function go() {
      result.innerHTML = '';
      const w = who.value;
      const input = {
        selfEmployed: w === 'se' || w === 'both',
        landlord: w === 'landlord' || w === 'both',
        businesses: Number(nBiz.value) || 1,
        seTurnover: k.toNumber(seT.value),
        ukProperty: k.toNumber(ukP.value),
        overseasProperty: k.toNumber(ovP.value),
        figuresYear: Number(figY.value),
        vatRegistered: vat.value === 'yes',
        partnership: part.value === 'yes',
        quarterMode: qmode.value
      };
      let A;
      try { A = assess(input); } catch (e) { msg.say(e.message, 'error'); return; }

      const headline = !A.inScope
        ? 'MTD for Income Tax does not apply to you'
        : A.first ? 'MTD for Income Tax applies from ' + fmtDate(A.first.from)
          : 'Not caught yet - but keep watching the figure';
      const meta = 'Qualifying income ' + gbp(A.qualifying.total)
        + (A.first ? ' · over the ' + gbp0(A.first.threshold) + ' threshold · ' + A.updatesPerYear + ' quarterly updates a year' : '')
        + ' · guidance as at ' + MTD.checked;

      const buttons = [
        k.downloadButton('mtd-position.pdf', () => reportPdf(A)),
        k.downloadButton('mtd-position.txt', () => new Blob([reportText(A)], { type: 'text/plain' }), false)
      ];
      result.appendChild(k.summaryCard(headline, meta, buttons));

      const stats = A.qualifying.parts.map(p => [p.label, gbp(p.amount)]);
      stats.push(['Qualifying income (gross, before expenses)', gbp(A.qualifying.total)]);
      if (A.first) {
        stats.push(['MTD for Income Tax starts', fmtDate(A.first.from) + ' (' + A.first.taxYearLabel + ')']);
        stats.push(['Judged on the tax return for', A.first.decidedByLabel]);
        stats.push(['Businesses for this purpose', A.businesses.join(', ')]);
        stats.push(['Quarterly updates a year', String(A.updatesPerYear)]);
        stats.push(['First quarterly period ends', fmtDate(A.periods[0].end)]);
        stats.push(['First deadline', fmtDate(A.periods[0].due) + (A.daysToFirstDeadline > 0 ? ' (' + A.daysToFirstDeadline.toLocaleString('en-GB') + ' days away)' : '')]);
        stats.push(['Final Declaration for ' + A.first.taxYearLabel, 'by ' + A.finalDeclaration]);
      }
      stats.push(['MTD for VAT', A.vat.applies ? 'Applies already - since ' + A.vat.since : 'Does not apply - you are not VAT registered']);
      result.appendChild(k.statGrid(stats));

      result.appendChild(k.h3('How the qualifying income is added up'));
      result.appendChild(k.previewTable(
        [['Source', 'Gross, before expenses', 'Counted?']]
          .concat(A.qualifying.parts.map(p => [p.label, gbp(p.amount), 'Yes']))
          .concat(MTD.itsa.qualifyingIncome.excludes.map(x => [x.charAt(0).toUpperCase() + x.slice(1), '-', 'No - not qualifying income']))
          .concat([['Qualifying income', gbp(A.qualifying.total), '']]), 20));

      result.appendChild(k.h3('The three start dates, against your figure'));
      result.appendChild(k.previewTable(
        [['From', 'Qualifying income ' + (MTD.itsa.test === 'atLeast' ? 'of' : 'over'), 'Judged on the return for', 'Your ' + gbp(A.qualifying.total), 'Where you stand']]
          .concat(A.bands.map(b => [
            fmtDate(b.from), gbp0(b.threshold), b.decidedByLabel,
            b.caught ? 'over it' : gbp(b.shortfall) + ' under',
            !A.inScope ? 'Not self-employed or a landlord' : b.caught ? (A.first && b.year === A.first.year ? 'CAUGHT - this is your date' : 'over this one too') : b.near ? 'Close - worth watching' : 'Not on these figures'
          ])), 10));

      if (A.first) {
        result.appendChild(k.h3('What you would have to do'));
        result.appendChild(k.issues(MTD.itsa.obligations.concat([
          'Send ' + A.updatesPerYear + ' quarterly updates a tax year in total: ' + A.businesses.length + ' business' + (A.businesses.length === 1 ? '' : 'es') + ' (' + A.businesses.join(', ') + ') at ' + MTD.itsa.updatesPerBusinessPerYear + ' each.',
          'Make the Final Declaration for ' + A.first.taxYearLabel + ' by ' + A.finalDeclaration + '. ' + MTD.itsa.finalDeclaration.note
        ]), 'obligation'));

        result.appendChild(k.h3('Your quarterly periods for ' + A.first.taxYearLabel + ' - ' + A.quarterLabel));
        result.appendChild(k.previewTable(
          [['Update', 'Period', 'Period ends', 'Deadline', 'Days from today']]
            .concat(A.periods.map(p => {
              const d = dayGap(A.today, p.due);
              return ['Q' + p.n, fmtDate(p.start) + ' to ' + fmtDate(p.end), fmtDate(p.end), fmtDate(p.due), d > 0 ? d.toLocaleString('en-GB') : 'passed'];
            })), 6));
      }

      if (A.watch.length) {
        result.appendChild(k.h3('Thresholds worth watching'));
        result.appendChild(k.issues(A.watch.map(b =>
          'From ' + fmtDate(b.from) + ': you are ' + gbp(b.shortfall) + ' under the ' + gbp0(b.threshold) + ' threshold. It is judged on your ' + b.decidedByLabel + ' return, so a better year then brings you in.'
        ), 'near-miss threshold'));
      }

      result.appendChild(k.h3('MTD for VAT'));
      result.appendChild(k.issues(A.vat.applies
        ? ['MTD for VAT has applied to every VAT-registered business since ' + A.vat.since + ', whatever the turnover.'].concat(MTD.vat.obligations)
        : ['You are not VAT registered, so MTD for VAT does not apply. It covers ' + MTD.vat.scope + ', so it starts the day you register.'],
        A.vat.applies ? 'MTD for VAT rule that already applies to you' : 'VAT note'));

      result.appendChild(k.h3('What this does not decide'));
      result.appendChild(k.issues(A.limits.concat(A.partnership ? [MTD.itsa.partnerships + ' You told us you are in one, so treat everything above as your personal position only.'] : []), 'limit'));
      result.appendChild(k.h3('What to re-check against gov.uk'));
      result.appendChild(k.issues(MTD.recheck, 'unverified point'));

      const src = k.el('p', 'field-hint');
      src.innerHTML = 'Guidance as at ' + MTD.checked + ', not verified against a live gov.uk page. The authority is gov.uk: '
        + '<a href="' + MTD.authority + '" rel="noopener">' + MTD.authorityLabel + '</a> and '
        + '<a href="' + MTD.vatAuthority + '" rel="noopener">' + MTD.vatAuthorityLabel + '</a>.';
      result.appendChild(src);

      result.appendChild(k.h3('The summary, as it downloads'));
      const pre = k.el('pre', 'code-out');
      pre.textContent = reportText(A);
      result.appendChild(pre);

      msg.say('');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="mtd-checker"]'); if (r) mount(r); });
  window.MVRMtd = { MTD, YR, fmtDate, gbp, gbp0, dayGap, crosses, quarterPeriods, qualifyingIncome, businessList, bandVerdicts, assess, reportBlocks, reportText };
})();
