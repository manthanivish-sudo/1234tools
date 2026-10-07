(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["average-calculator"] = {
"title": "Average Calculator (Mean, Median, Mode)",
"category": "mathematics",
"description": "Calculate mean, median, mode, range and weighted average from a list of numbers.",
"keywords": ["average calculator","mean median mode","weighted average","calculate average","arithmetic mean"],
"formula": "mean = Σx / n  ·  weighted mean = Σ(w·x) / Σw",
"inputs": [{"key":"data","label":"Numbers (comma or space separated)","type":"text","default":"12, 18, 7, 25, 18, 9, 30"},{"key":"weights","label":"Weights (optional, same order)","type":"text","default":""}],
"compute": ({ data, weights }) => {
      /* Empty tokens (a trailing comma, a leading space) are not zeros. */
      const nums = String(data == null ? '' : data).split(/[\s,;]+/).filter(t => t !== '').map(Number).filter(n => isFinite(n));
      if (!nums.length) return { note: 'Enter some numbers.' };
      const n = nums.length;
      const sorted = [...nums].sort((x, y) => x - y);
      const sum = nums.reduce((s, x) => s + x, 0);
      const mean = sum / n;
      const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

      const counts = {};
      nums.forEach(x => counts[x] = (counts[x] || 0) + 1);
      const maxC = Math.max(...Object.values(counts));
      const mode = maxC === 1 ? 'No mode'
        : Object.keys(counts).filter(k => counts[k] === maxC).join(', ');

      const w = String(weights || '').split(/[\s,;]+/).filter(t => t !== '').map(Number).filter(x => isFinite(x));
      let weighted = NaN;
      if (w.length === n) {
        const wsum = w.reduce((s, x) => s + x, 0);
        if (wsum) weighted = nums.reduce((s, x, i) => s + x * w[i], 0) / wsum;
      }

      // geometric and harmonic means are only defined for positive values
      const allPos = nums.every(x => x > 0);
      return {
        mean, median, mode, count: n, sum,
        min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0],
        weighted,
        geometric: allPos ? Math.pow(nums.reduce((p, x) => p * x, 1), 1 / n) : NaN,
        harmonic: allPos ? n / nums.reduce((s, x) => s + 1 / x, 0) : NaN,
        note: w.length && w.length !== n ? `You gave ${w.length} weights for ${n} numbers — the weighted average needs one weight per value.` : ''
      };
    },
"outputs": [{"key":"mean","label":"Mean (average)","format":"number","primary":true},{"key":"median","label":"Median","format":"number"},{"key":"mode","label":"Mode","format":"text"},{"key":"weighted","label":"Weighted average","format":"number"},{"key":"count","label":"Count","format":"number"},{"key":"sum","label":"Sum","format":"number"},{"key":"min","label":"Minimum","format":"number"},{"key":"max","label":"Maximum","format":"number"},{"key":"range","label":"Range","format":"number"},{"key":"geometric","label":"Geometric mean","format":"number"},{"key":"harmonic","label":"Harmonic mean","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      if (r.mean === undefined) return [];
      const L = ['mean = ' + f.upto(r.sum, 6) + ' ÷ ' + r.count + ' = ' + f.upto(r.mean, 6)];
      if (isFinite(r.weighted)) L.push('weighted mean = Σ(w × x) ÷ Σw = ' + f.upto(r.weighted, 6));
      return L;
    },
"tips": ["The mean is pulled by outliers; the median is not. A large gap between them means the data is skewed.","Use the geometric mean for growth rates and the harmonic mean for averaging rates such as speed.","Weighted averages need one weight per value — module credits, portfolio sizes, or however you are weighting."],
"faq": [{"q":"Which average should I use?","a":"Mean for symmetric data, median when there are outliers or the distribution is skewed, and mode for categories. Reporting the mean of house prices without the median is a classic way to mislead."}]
};
})();