(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["gpa-calculator"] = {
"title": "GPA Calculator",
"category": "utilities",
"description": "Calculate weighted and unweighted grade point average from course grades and credits.",
"keywords": ["GPA calculator","grade point average","weighted GPA","college GPA","semester GPA","CGPA"],
"formula": "GPA = Σ(grade points × credits) / Σ credits",
"inputs": [{"key":"grades","label":"Grades (comma separated: A, B+, 3.7 …)","type":"text","default":"A, B+, A-, B, C+"},{"key":"credits","label":"Credits (optional, same order)","type":"text","default":"3, 4, 3, 3, 2"},{"key":"scale","label":"Scale","type":"select","options":[{"value":"4","label":"4.0 scale (US)"},{"value":"10","label":"10.0 scale (India CGPA)"},{"value":"5","label":"5.0 scale (4.0 × 1.25)"}],"default":"4"}],
"compute": ({ grades, credits, scale }) => {
      const MAP = {
        'A+': 4.0, 'A': 4.0, 'A-': 3.7,
        'B+': 3.3, 'B': 3.0, 'B-': 2.7,
        'C+': 2.3, 'C': 2.0, 'C-': 1.7,
        'D+': 1.3, 'D': 1.0, 'D-': 0.7, 'F': 0.0
      };
      const list = String(grades || '').split(/[\s,;]+/).filter(Boolean);
      if (!list.length) return { note: 'Enter some grades.' };

      const points = list.map(g => {
        const up = g.toUpperCase().replace(/[−–]/g, '-');   // A− as printed on a transcript
        if (MAP[up] !== undefined) return MAP[up];
        const n = Number(g);
        return isFinite(n) ? n : null;
      });
      if (points.some(p => p === null)) {
        return { note: 'Use letter grades (A, B+, C-) or numeric grade points. One entry was not recognised.' };
      }

      const cr = String(credits || '').split(/[\s,;]+/).map(Number).filter(n => isFinite(n) && n > 0);
      const weighted = cr.length === list.length;
      const totalCredits = weighted ? cr.reduce((s, c) => s + c, 0) : list.length;
      const totalPoints = weighted
        ? points.reduce((s, p, i) => s + p * cr[i], 0)
        : points.reduce((s, p) => s + p, 0);

      const gpa4 = totalCredits ? totalPoints / totalCredits : 0;
      const factor = Number(scale) / 4;

      return {
        gpa: gpa4 * (Number(scale) === 4 ? 1 : factor),
        gpa4,
        percentage: (gpa4 / 4) * 100,
        courses: list.length,
        totalCredits,
        qualityPoints: totalPoints,
        method: weighted ? 'Weighted by credits' : 'Unweighted — one credit per course',
        note: cr.length && cr.length !== list.length
          ? `You gave ${cr.length} credit values for ${list.length} grades, so the result is unweighted.` : ''
      };
    },
"outputs": [{"key":"gpa","label":"GPA","format":"number","primary":true},{"key":"gpa4","label":"On the 4.0 scale","format":"number"},{"key":"percentage","label":"Approximate percentage","format":"percent"},{"key":"method","label":"Method","format":"text"},{"key":"courses","label":"Courses counted","format":"number"},{"key":"totalCredits","label":"Total credits","format":"number"},{"key":"qualityPoints","label":"Total quality points","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.gpa === undefined || !isFinite(r.gpa) ? [] : ['GPA = ' + f.upto(r.qualityPoints, 4) + ' quality points ÷ ' + f.upto(r.totalCredits, 4) + ' credits = ' + f.num(r.gpa, 2)],
"tips": ["Give credits to weight by course size. Without them every course counts equally, which usually understates a heavy module.","Grade-to-point mappings differ between institutions, particularly for A+ and for pass/fail courses. Check your handbook.","Scale conversion here is proportional. Many institutions publish their own conversion table, which will not always match."],
"faq": [{"q":"Is the percentage conversion official?","a":"No. Percentage-to-GPA mappings vary by country and institution, and some use conversion tables rather than a straight proportion. Use the figure as a rough indication and quote your official transcript for applications."}]
};
})();