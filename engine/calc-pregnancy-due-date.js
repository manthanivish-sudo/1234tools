(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["pregnancy-due-date"] = {
"title": "Pregnancy Due Date Calculator",
"category": "health",
"description": "Estimate a due date from the last menstrual period or conception date, with current gestational age.",
"keywords": ["due date calculator","pregnancy calculator","EDD calculator","gestational age","how many weeks pregnant"],
"formula": "Naegele's rule: LMP + 280 days + (cycle length − 28) days",
"inputs": [{"key":"basis","label":"Calculate from","type":"select","options":[{"value":"lmp","label":"First day of last menstrual period"},{"value":"conception","label":"Conception or ovulation date"},{"value":"ivf","label":"IVF transfer date"}],"default":"lmp"},{"key":"date","label":"Date","type":"date","default":"TODAY"},{"key":"cycle","label":"Average cycle length","type":"number","unit":"days","default":28,"min":20,"max":45},{"key":"ivfDay","label":"IVF embryo age at transfer","type":"select","options":[{"value":"3","label":"Day 3"},{"value":"5","label":"Day 5"},{"value":"6","label":"Day 6"}],"default":"5"},{"key":"today","label":"Today’s date","type":"date","default":"TODAY"}],
"compute": ({ basis, date, cycle, ivfDay, today }) => {
      /* Whole calendar days, held as UTC midnights: a YYYY-MM-DD field is
         read as that calendar day wherever the browser is, and adding days
         can never be shifted by a clock change. */
      const MS = 86400000;
      const dayOf = (s) => {
        const m = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s).trim());
        if (m) { const t = new Date(0); t.setUTCFullYear(+m[1], +m[2] - 1, +m[3]); return t.getTime(); }
        const x = new Date(s);
        return isNaN(x) ? NaN : Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
      };
      const d = dayOf(date), now = dayOf(today);
      if (isNaN(d) || isNaN(now)) return { note: 'Enter valid dates.' };
      const add = (base, days) => base + days * MS;

      let lmp;
      if (basis === 'lmp') {
        /* Naegele's rule assumes a 28-day cycle with ovulation on day 14.
           A longer cycle ovulates later, so the due date moves later by
           (cycle − 28) days; a shorter one moves it earlier. */
        lmp = add(d, Math.max(20, Math.min(45, Number(cycle) || 28)) - 28);
      } else if (basis === 'conception') {
        lmp = add(d, -14);
      } else {
        lmp = add(d, -(14 + Number(ivfDay || 5)));
      }

      const due = add(lmp, 280);
      const daysPreg = Math.round((now - lmp) / MS);
      const weeks = Math.floor(daysPreg / 7), days = daysPreg % 7;
      const fmt = (x) => new Date(x).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

      let stage = '';
      if (daysPreg < 0) stage = 'That date is in the future.';
      else if (weeks < 13) stage = 'First trimester';
      else if (weeks < 27) stage = 'Second trimester';
      else if (weeks < 42) stage = 'Third trimester';
      else stage = 'Past 42 weeks — this is beyond the usual range';

      return {
        dueDate: fmt(due),
        gestational: daysPreg < 0 ? '—' : `${weeks} weeks and ${days} days`,
        trimester: stage,
        daysRemaining: Math.max(0, Math.round((due - now) / MS)),
        conception: fmt(add(lmp, 14)),
        fullTermFrom: fmt(add(lmp, 273)),
        fullTermTo: fmt(add(lmp, 287)),
        note: ''
      };
    },
"outputs": [{"key":"dueDate","label":"Estimated due date","format":"text","primary":true},{"key":"gestational","label":"Gestational age today","format":"text"},{"key":"trimester","label":"Stage","format":"text"},{"key":"daysRemaining","label":"Days to the estimated date","format":"number"},{"key":"conception","label":"Estimated conception date","format":"text"},{"key":"fullTermFrom","label":"Full term from","format":"text"},{"key":"fullTermTo","label":"Full term to","format":"text"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.dueDate === undefined ? [] : [v.basis === 'lmp' ? 'due = first day of the last period + 280 days' + (Number(v.cycle) !== 28 ? ' + (' + v.cycle + ' − 28) days' : '') + ' = ' + r.dueDate : 'due = ' + r.dueDate, 'today: ' + r.gestational],
"tips": ["Only about 4% of babies arrive on the estimated due date. Around 80% arrive within the two weeks either side of it, which is why the full-term window matters more than the single date.","Naegele’s rule assumes a 28-day cycle with ovulation on day 14. Adjusting the cycle length above corrects for that, but ovulation timing varies between cycles even for regular ones.","A dating ultrasound in the first trimester is more accurate than any calculation from dates, and is what your maternity team will use.","Gestational age is counted from the first day of the last period, not from conception — which is why you are considered \"two weeks pregnant\" at conception."],
"faq": [{"q":"How accurate is this?","a":"It is arithmetic on the dates you supply, and inherits any uncertainty in them. First-trimester ultrasound dating is accurate to within about five days and supersedes calculated dates. Use this for orientation, not for decisions — your midwife or doctor will confirm dating."},{"q":"My cycle is irregular. Does this still work?","a":"Less well. Naegele’s rule depends on predictable ovulation. With irregular cycles the estimate can be out by a week or more, and early ultrasound dating becomes considerably more important."}]
};
})();