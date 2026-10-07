(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["ovulation-calculator"] = {
"title": "Ovulation & Fertile Window Calculator",
"category": "health",
"description": "Estimate ovulation and the fertile window from cycle length and last period date.",
"keywords": ["ovulation calculator","fertile window","ovulation date","fertility calculator","period tracker"],
"formula": "ovulation ≈ next period − 14 days; fertile window is the five days before through the day after",
"inputs": [{"key":"lastPeriod","label":"First day of last period","type":"date","default":"TODAY"},{"key":"cycle","label":"Average cycle length","type":"number","unit":"days","default":28,"min":20,"max":45},{"key":"luteal","label":"Luteal phase length","type":"number","unit":"days","default":14,"min":9,"max":17},{"key":"cycles","label":"Show this many cycles","type":"number","default":3,"min":1,"max":12}],
"compute": ({ lastPeriod, cycle, luteal, cycles }) => {
      /* A date input gives "YYYY-MM-DD", which new Date() reads as UTC
         midnight — the previous evening west of Greenwich. Read it as a
         local calendar date instead. */
      const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(lastPeriod || ''));
      const d = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(lastPeriod);
      if (isNaN(d)) return { note: 'Enter a valid date.' };
      const cyc = Math.max(20, Math.min(45, Math.round(Number(cycle) || 28)));
      const lut = Math.max(9, Math.min(17, Math.round(Number(luteal) || 14)));
      const n = Math.max(1, Math.min(12, Math.round(Number(cycles) || 3)));

      const add = (base, days) => { const x = new Date(base); x.setDate(x.getDate() + days); return x; };
      const fmt = (x) => x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const shortF = (x) => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      const rows = [];
      for (let i = 0; i < n; i++) {
        const start = add(d, cyc * i);
        const ov = add(start, cyc - lut);
        rows.push([
          fmt(start).replace(/,.*?(\d)/, ' $1'),
          `${shortF(add(ov, -5))} – ${shortF(add(ov, 1))}`,
          fmt(ov).replace(/,.*?(\d)/, ' $1'),
          shortF(add(start, cyc))
        ]);
      }

      const ov1 = add(d, cyc - lut);
      return {
        ovulation: fmt(ov1),
        fertileWindow: `${fmt(add(ov1, -5))} to ${fmt(add(ov1, 1))}`,
        nextPeriod: fmt(add(d, cyc)),
        /* whole calendar days from the period's first day to today's local
           date: counting milliseconds was a day short after local midnight
           in British Summer Time (00:00–01:00) and east of Greenwich */
        cycleDay: (() => {
          const t = new Date();
          return Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000) + 1;
        })(),
        note: '',
        _table: { head: ['Period starts', 'Fertile window', 'Ovulation (est.)', 'Next period'], rows }
      };
    },
"outputs": [{"key":"fertileWindow","label":"Estimated fertile window","format":"text","primary":true},{"key":"ovulation","label":"Estimated ovulation","format":"text"},{"key":"nextPeriod","label":"Next period expected","format":"text"},{"key":"cycleDay","label":"Current cycle day","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.ovulation === undefined ? [] : ['next period = ' + v.lastPeriod + ' + ' + v.cycle + ' days: ' + r.nextPeriod, 'ovulation ≈ next period − ' + v.luteal + ' days: ' + r.ovulation, 'fertile window = the five days before ovulation to the day after: ' + r.fertileWindow],
"tips": ["The fertile window runs from about five days before ovulation to the day after, because sperm can survive several days while an egg is viable for roughly 24 hours.","Ovulation timing varies between cycles even for people with regular periods. Calendar prediction alone is a rough guide, not a reliable signal.","Ovulation predictor kits, basal body temperature tracking and cervical mucus observation all give better information than dates alone.","**This is not a contraceptive method.** Calendar-based prediction has a high failure rate for avoiding pregnancy — pregnancies occur outside the predicted window regularly. Use proper contraception if that is the goal.","If you have been trying to conceive for a year without success, or six months if over 35, that is the usual point to speak to a GP."],
"faq": [{"q":"Can I use this to avoid pregnancy?","a":"No. Calendar-based prediction is among the least reliable approaches to avoiding pregnancy, because ovulation shifts unpredictably between cycles. If avoiding pregnancy matters, use a method with a proper effectiveness rate and speak to a healthcare provider about the options."},{"q":"Why is the luteal phase adjustable?","a":"Because the phase after ovulation is more consistent in length than the phase before it, typically 12–16 days. If you know yours from tracking, entering it gives a better estimate than assuming 14."}]
};
})();