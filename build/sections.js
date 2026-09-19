/**
 * What every section of the site is called.
 *
 * This is the registry the rest of the build reads. Before it existed the
 * display name lived only inside generated HTML, so nothing kept the sidebar,
 * the homepage card, the hub's own <h1> and the breadcrumb in agreement — and
 * they were not in agreement. Four sections carried their raw slug as their
 * name in the sidebar of all 1,253 pages: "business", "image", "india",
 * "text", alongside "Health", "Mathematics" and "Time & Dates".
 *
 * The entries below are the names. Anything that has to print one reads it
 * from here, and a section added without an entry is reported rather than
 * silently getting its slug back.
 *
 * `name` is the full name, used in the sidebar, the breadcrumb and the card.
 * `head` is what goes in the <title> and the <h1> of the hub, and is the same
 * as `name` unless the name already ends in the word it would repeat: "PDF
 * Tools" must not become "PDF Tools Tools".
 */
'use strict';

const SECTIONS = {
  '/': { name: 'Home', head: 'Home' },

  /* Where a section's own tool pages already carried a better name in their
     breadcrumb than the sidebar did — "Image & Photo Tools" on all twenty
     image pages, against "image" in the sidebar — the better name wins. */
  /* One page called this "Business & Accounting". Finance & Accounting is
     already a section, and two sections ending the same way would send
     readers to the wrong one, so the plain name wins and `also` records the
     label it knowingly replaces. */
  '/business/':    { name: 'Business', also: ['Business & Accounting'] },
  /* The cloud tools. `hub` is the hub's own crumb; the sidebar group above
     it is written by build-ai.js, which owns everything under /ai/. */
  '/ai/':          { name: 'AI for Business', head: 'AI for Business', hub: 'AI for Business', noun: 'tool' },
  '/conversions/': { name: 'Conversions' },
  /* `noun` is what a generated hub title counts: "14 Free Calculators" is
     right for business and wrong for an image compressor. */
  '/design/':      { name: 'Design & Media', noun: 'tool' },
  '/developer/':   { name: 'Developer & Web Tools', head: 'Developer & Web', noun: 'tool' },
  '/education/':   { name: 'Education & Exams' },
  '/engineering/': { name: 'Engineering & Electronics' },
  '/finance/':     { name: 'Finance & Accounting' },
  '/health/':      { name: 'Health' },
  '/image/':       { name: 'Image & Photo Tools', head: 'Image & Photo', noun: 'tool' },
  '/india/':       { name: 'India' },
  /* `crumb` is the short form used as a step in a trail; `hub` is what the
     section's own page is called at the end of its trail. */
  '/learn/':       { name: 'Learning resources', crumb: 'Learning', head: 'Learning Resources', hub: 'Learning Resources' },
  '/mathematics/': { name: 'Mathematics' },
  '/pdf/':         { name: 'PDF Tools', head: 'PDF' },
  '/qr/':          { name: 'QR Tools', head: 'QR', noun: 'tool' },
  '/text/':        { name: 'Text & Writing Tools', head: 'Text & Writing', noun: 'tool' },
  '/time/':        { name: 'Time & Dates' },
  '/utilities/':   { name: 'Utilities' },

  /* Conversion families. Each is a section in its own right — they have their
     own hub, their own sidebar entry and their own level in the breadcrumb. */
  '/conversions/angle/':       { name: 'Angle' },
  '/conversions/area/':        { name: 'Area' },
  '/conversions/data/':        { name: 'Digital Storage' },
  '/conversions/energy/':      { name: 'Energy & Work' },
  '/conversions/length/':      { name: 'Length & Distance' },
  '/conversions/mass/':        { name: 'Mass & Weight' },
  '/conversions/power/':       { name: 'Power' },
  '/conversions/pressure/':    { name: 'Pressure' },
  '/conversions/speed/':       { name: 'Speed & Velocity' },
  '/conversions/temperature/': { name: 'Temperature' },
  '/conversions/time/':        { name: 'Time' },
  '/conversions/volume/':      { name: 'Volume & Capacity' },

  /* Not tool sections, but they are levels in a trail and need names. */
  '/about/':   { name: 'About', meta: true },
  '/pricing/': { name: 'Pricing', meta: true },
  '/account/': { name: 'Account', meta: true },
  '/trust/':   { name: 'Trust & security', meta: true },
  '/contact/': { name: 'Contact', meta: true },
  '/privacy/': { name: 'Privacy', meta: true },
  '/terms/':   { name: 'Terms', meta: true },
  '/cookies/': { name: 'Cookies', meta: true }
};

/* Fill in what each entry did not need to say for itself. */
for (const [url, s] of Object.entries(SECTIONS)) {
  s.url = url;
  s.slug = url === '/' ? '' : url.split('/').filter(Boolean).pop();
  if (!s.crumb) s.crumb = s.name;
  if (!s.head) s.head = s.name;
}

/** The section a page belongs to, or null if it sits at the root. */
function sectionOf(url) {
  const parts = url.split('/').filter(Boolean);
  for (let i = parts.length; i > 0; i--) {
    const candidate = '/' + parts.slice(0, i).join('/') + '/';
    if (candidate !== url && SECTIONS[candidate]) return SECTIONS[candidate];
  }
  return null;
}

/**
 * Every section above a page, outermost first, excluding the page itself.
 * "/conversions/length/kilometres-to-miles/" gives Conversions, then Length &
 * Distance, because both are real hubs a reader can climb to.
 */
function trailFor(url) {
  const parts = url.split('/').filter(Boolean);
  const out = [];
  for (let i = 1; i < parts.length; i++) {
    const candidate = '/' + parts.slice(0, i).join('/') + '/';
    if (SECTIONS[candidate]) out.push(SECTIONS[candidate]);
  }
  return out;
}

module.exports = { SECTIONS, sectionOf, trailFor };
