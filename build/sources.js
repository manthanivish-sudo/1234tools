/**
 * "Sources, and when this was last checked" — one panel, one shape, on
 * every page that states a rule somebody else can change.
 *
 * A calculator that turns kilometres into miles needs none of this: the
 * ratio was true last year and will be true next year. A calculator that
 * applies a tax rate, a threshold, a statutory formula or a grading scale
 * is different — it is right only until a Budget, a notification or a
 * board says otherwise, and a page that does not say when it was last
 * looked at is quietly asking to be trusted forever.
 *
 * So: a date, and the places to check. The date is deliberately "when a
 * person last checked this", not "when the file was last edited" — a
 * typo fix does not make a rate any fresher.
 *
 * A tool may declare `checked` and `sources` on its own spec, which is the
 * better home when the engine already holds the rates. Everything else is
 * declared here, in one table, so that when a Budget lands there is one
 * file to review rather than forty.
 */
'use strict';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Sources worth naming more than once, so a URL is written down once. */
const S = {
  /* United Kingdom */
  ukVatRates: ['gov.uk — VAT rates on different goods and services', 'https://www.gov.uk/vat-rates'],
  ukVatThresholds: ['gov.uk — VAT registration thresholds', 'https://www.gov.uk/vat-registration/thresholds'],
  ukVatReturn: ['gov.uk — VAT Notice 700/12: how to fill in and submit your VAT Return', 'https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012'],
  ukVatFlatRate: ['gov.uk — VAT Notice 733: flat rate scheme for small businesses', 'https://www.gov.uk/guidance/flat-rate-scheme-for-small-businesses-vat-notice-733'],
  ukVatCash: ['gov.uk — VAT Notice 731: cash accounting scheme', 'https://www.gov.uk/guidance/vat-cash-accounting-scheme-notice-731'],
  ukMtdVat: ['gov.uk — Use Making Tax Digital for VAT', 'https://www.gov.uk/guidance/use-making-tax-digital-for-vat'],
  ukMtdVatSoftware: ['gov.uk — Find software compatible with Making Tax Digital for VAT', 'https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-vat'],
  ukMtdItsaCheck: ['gov.uk — Check if you are eligible for Making Tax Digital for Income Tax', 'https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax'],
  ukMtdItsaUse: ['gov.uk — Use Making Tax Digital for Income Tax', 'https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax'],
  ukMtdItsaSoftware: ['gov.uk — Find software compatible with Making Tax Digital for Income Tax', 'https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax'],
  ukSaForms: ['gov.uk — Self Assessment forms and helpsheets (SA103 for a trade, SA105 for property)', 'https://www.gov.uk/self-assessment-forms-and-helpsheets'],
  ukIncomeTax: ['gov.uk — Income Tax rates and Personal Allowances', 'https://www.gov.uk/income-tax-rates'],
  ukNi: ['gov.uk — National Insurance rates and categories', 'https://www.gov.uk/national-insurance-rates-letters'],
  ukPayslips: ['gov.uk — Payslips: what they must show', 'https://www.gov.uk/payslips'],
  ukLatePayment: ['gov.uk — Late commercial payments: charging interest and debt recovery', 'https://www.gov.uk/late-commercial-payments-interest-debt-recovery'],

  /* India */
  inIncomeTax: ['Income Tax Department, India', 'https://www.incometax.gov.in/'],
  inIncomeTaxActs: ['Income Tax India — Acts, rules and the Finance Act', 'https://incometaxindia.gov.in/'],
  inGstPortal: ['Goods and Services Tax portal', 'https://www.gst.gov.in/'],
  inGstRates: ['CBIC-GST — rates for goods and services', 'https://cbic-gst.gov.in/'],
  inEInvoice: ['e-Invoice portal (IRP) — schema and the API specification', 'https://einvoice1.gst.gov.in/'],
  inEpfo: ['EPFO — provident fund rates and the wage ceiling', 'https://www.epfindia.gov.in/'],
  inEsic: ['ESIC — contribution rates and the wage limit', 'https://www.esic.gov.in/'],
  inLabour: ['Ministry of Labour and Employment — the Acts behind gratuity and wages', 'https://labour.gov.in/'],

  /* Education */
  cbse: ['CBSE — the board’s own circulars on assessment and grading', 'https://www.cbse.gov.in/'],
  ofqual: ['Ofqual — GCSE and A level grading', 'https://www.gov.uk/government/organisations/ofqual']
};

const src = (key, note) => { const s = S[key]; return note ? [s[0], s[1], note] : s; };

/**
 * slug -> what the page should say. `checked` is the date a person last
 * compared the figures in the tool against the sources named.
 */
const TABLE = {
  /* ---- United Kingdom: VAT and Making Tax Digital ---- */
  'vat-return': { checked: '2026-09-20', sources: [
    src('ukVatReturn', 'what belongs in each of the nine boxes, and the rounding'),
    src('ukVatFlatRate', 'the flat rate scheme, the sector percentages and the capital goods rule'),
    src('ukVatCash', 'the cash accounting scheme'),
    src('ukVatRates'), src('ukVatThresholds'), src('ukMtdVatSoftware', 'who may actually file a return')
  ] },
  'mtd-checker': { checked: '2026-09-20', sources: [
    src('ukMtdItsaCheck', 'the thresholds, the start dates and what qualifying income means'),
    src('ukMtdItsaUse'), src('ukMtdVat', 'what has applied to every VAT-registered business since April 2022'),
    src('ukMtdItsaSoftware')
  ] },
  'mtd-quarterly-update': { checked: '2026-09-20', sources: [
    src('ukMtdItsaUse', 'quarterly periods, deadlines and the Final Declaration'),
    src('ukSaForms', 'the category headings these figures are grouped under'),
    src('ukMtdItsaSoftware')
  ] },
  'bookkeeping': { checked: '2026-09-20', sources: [
    src('ukVatReturn', 'the nine boxes this works out'), src('ukVatRates'),
    src('inGstRates', 'for a book kept on the Indian chart of accounts')
  ] },
  'uk-take-home-pay': { checked: '2026-09-20', sources: [src('ukIncomeTax'), src('ukNi')] },
  'employer-cost': { checked: '2026-09-20', sources: [src('ukNi', 'employer National Insurance'), src('ukIncomeTax')] },
  'invoice-payment-terms': { checked: '2026-09-20', sources: [src('ukLatePayment', 'statutory interest and the fixed sum for a late commercial payment')] },

  /* ---- India: tax, payroll and GST ---- */
  'ctc-structure': { checked: '2026-09-20', sources: [
    src('inIncomeTaxActs', 'the slabs, the standard deduction and the section 87A rebate, under both regimes'),
    src('inEpfo', 'the 12% contribution and the Rs 15,000 wage ceiling'),
    src('inEsic', 'the 0.75% and 3.25% contributions and the Rs 21,000 wage limit'),
    src('inIncomeTax', 'professional tax is a state tax — check your own state’s current schedule')
  ] },
  'payroll-run': { checked: '2026-09-20', sources: [
    src('inEpfo', 'the PF split between EPS and EPF, and the administration charges'),
    src('inEsic'), src('inIncomeTaxActs', 'TDS is taken from your sheet here, never computed')
  ] },
  'full-final-settlement': { checked: '2026-09-20', sources: [
    src('inLabour', 'the Payment of Gratuity Act, its 15/26 formula, the five-year rule and the cap'),
    src('inIncomeTaxActs', 'what part of gratuity and leave encashment is exempt')
  ] },
  'gst-reconciler': { checked: '2026-09-20', sources: [src('inGstPortal', 'GSTR-2B, and the conditions for claiming input tax credit'), src('inGstRates')] },
  'einvoice-json': { checked: '2026-09-20', sources: [src('inEInvoice', 'the schema version, the mandatory fields and who must issue an e-invoice'), src('inGstPortal')] },
  'id-validator': { checked: '2026-09-20', sources: [src('inGstPortal', 'the only place that can tell you whether a GSTIN is active'), src('inIncomeTax', 'PAN')] },
  'accounting-converter': { checked: '2026-09-20', sources: [src('inGstRates', 'the tax ledgers an imported voucher lands in')] },
  'tally-converter': { checked: '2026-09-20', sources: [src('inGstRates')] },

  /* ---- PDF documents that carry tax wording ---- */
  'payslip-pdf': { checked: '2026-09-20', sources: [
    src('ukPayslips', 'what a payslip must show in the UK'),
    src('inEpfo', 'PF'), src('inEsic', 'ESI'), src('inLabour', 'wages and deductions')
  ] },
  'quotation-pdf': { checked: '2026-09-20', sources: [src('ukVatRates'), src('inGstRates')] },
  'purchase-order-pdf': { checked: '2026-09-20', sources: [src('ukVatRates'), src('inGstRates')] },
  'delivery-challan-pdf': { checked: '2026-09-20', sources: [src('inGstPortal', 'the purposes of movement, and the e-way bill, which is generated on the portal and not here')] },
  'invoice-pdf': { checked: '2026-09-20', sources: [src('ukVatRates'), src('inGstRates')] },

  /* ---- AI tools that state rules ---- */
  'form16-reader': { checked: '2026-09-20', sources: [src('inIncomeTaxActs', 'what Form 16 must contain, and the heads it is split into'), src('inIncomeTax', 'check the figures against Form 26AS and the AIS')] },
  'hsn-gst-finder': { checked: '2026-09-20', sources: [src('inGstRates', 'the tariff and the notified rates — the classification you file is yours'), src('inGstPortal')] },
  'contract-generator': { checked: '2026-09-20', sources: [
    ['gov.uk — Employment contracts and written statements', 'https://www.gov.uk/employment-contracts-and-conditions', 'for the England and Wales documents'],
    src('inLabour', 'for the Indian documents')
  ] },
  'cv-screener': { checked: '2026-09-20', sources: [
    ['ICO — automated decision-making and profiling', 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/automated-decision-making-and-profiling/', 'why a score must not be the only thing a rejection rests on']
  ] },

  /* ---- Education ---- */
  'report-card': { checked: '2026-09-20', sources: [
    src('cbse', 'the grade bands used by that board, which change'),
    src('ofqual', 'the 9 to 1 scale')
  ] }
};

/** "2026-09-20" -> "20 September 2026" */
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return Number(m[3]) + ' ' + months[Number(m[2]) - 1] + ' ' + m[1];
}

/** What applies to a tool: its own declaration first, then the table. */
function forTool(slug, spec) {
  const own = spec && (spec.checked || spec.sources) ? { checked: spec.checked, sources: spec.sources || [] } : null;
  const table = TABLE[slug] || null;
  if (!own && !table) return null;
  const out = own || table;
  return { checked: out.checked || (table && table.checked) || null, sources: (out.sources && out.sources.length ? out.sources : (table ? table.sources : [])) || [] };
}

/** The panel, or '' for a tool with no rules that anyone else can change. */
function panel(slug, spec) {
  const s = forTool(slug, spec);
  if (!s) return '';
  const when = longDate(s.checked);
  const items = s.sources.map(x => {
    const [label, url, note] = Array.isArray(x) ? x : [x.label, x.url, x.note];
    return '<li><a href="' + esc(url) + '">' + esc(label) + '</a>' + (note ? ' <span class="source-note">— ' + esc(note) + '</span>' : '') + '</li>';
  }).join('');
  return '  <section class="panel panel-sources"><h2>Sources, and when this was last checked</h2>' +
    (when ? '<p class="checked-on">The rules, rates and thresholds this tool applies were last checked on <time datetime="' + esc(s.checked) + '">' + esc(when) + '</time>. They change — usually at a Budget or a notification, sometimes between one. Anything you are going to rely on, check against the source.</p>' : '') +
    (items ? '<ul class="source-list">' + items + '</ul>' : '') +
    '</section>\n';
}

/** For the structured data, so a search engine knows how fresh this is. */
const dateModified = (slug, spec) => { const s = forTool(slug, spec); return s && s.checked ? s.checked : null; };

module.exports = { panel, dateModified, forTool, longDate, TABLE, S };
