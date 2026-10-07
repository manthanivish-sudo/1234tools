(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["statistics"] = {
"title": "Statistics Calculator (Mean, Median, Mode, SD)",
"category": "mathematics",
"icon": "📊",
"description": "Compute mean, median, mode, standard deviation, variance, and quartiles from a dataset.",
"keywords": ["mean median mode","standard deviation calculator","variance","quartiles"],
"formula": "σ = √( Σ(xᵢ − μ)² / N )   ·   s = √( Σ(xᵢ − x̄)² / (N−1) )",
"inputs": [{"key":"data","label":"Data Set (comma or space separated)","type":"text","default":"12, 15, 11, 18, 15, 20, 13, 15"}],
"compute": ({ data }) => {
      /* Empty tokens (a trailing comma, a leading space) are not zeros. */
      const nums = String(data == null ? '' : data).split(/[\s,;]+/).filter(t => t !== '').map(Number).filter(n => isFinite(n));
      const N = nums.length;
      if (N === 0) return {};

      const sorted = [...nums].sort((a, b) => a - b);
      const sum = nums.reduce((s, n) => s + n, 0);
      const mean = sum / N;

      const median = N % 2 ? sorted[(N - 1) / 2] : (sorted[N / 2 - 1] + sorted[N / 2]) / 2;

      const counts = {};
      nums.forEach(n => counts[n] = (counts[n] || 0) + 1);
      const maxCount = Math.max(...Object.values(counts));
      const modes = Object.keys(counts).filter(k => counts[k] === maxCount);
      const mode = maxCount === 1 ? 'No mode' : modes.join(', ');

      const sqDiff = nums.reduce((s, n) => s + (n - mean) ** 2, 0);
      const popVar = sqDiff / N;
      const sampVar = N > 1 ? sqDiff / (N - 1) : NaN;

      const quantile = p => {
        const idx = (N - 1) * p;
        const lo = Math.floor(idx), hi = Math.ceil(idx);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
      };
      const q1 = quantile(0.25), q3 = quantile(0.75);

      return {
        count: N, sum, mean, median, mode,
        min: sorted[0], max: sorted[N - 1], range: sorted[N - 1] - sorted[0],
        popSD: Math.sqrt(popVar), sampSD: Math.sqrt(sampVar),
        popVar, sampVar, q1, q3, iqr: q3 - q1
      };
    },
"outputs": [{"key":"mean","label":"Mean (average)","format":"number","primary":true},{"key":"median","label":"Median","format":"number"},{"key":"mode","label":"Mode","format":"text"},{"key":"sampSD","label":"Standard Deviation (sample, n−1)","format":"number"},{"key":"popSD","label":"Standard Deviation (population, N)","format":"number"},{"key":"sampVar","label":"Variance (sample)","format":"number"},{"key":"count","label":"Count","format":"number"},{"key":"sum","label":"Sum","format":"number"},{"key":"min","label":"Minimum","format":"number"},{"key":"max","label":"Maximum","format":"number"},{"key":"range","label":"Range","format":"number"},{"key":"q1","label":"Q1 (25th percentile)","format":"number"},{"key":"q3","label":"Q3 (75th percentile)","format":"number"},{"key":"iqr","label":"Interquartile Range","format":"number"}],
"filled": (v, r, f) => r.mean === undefined ? [] : ['mean = ' + f.upto(r.sum, 6) + ' ÷ ' + r.count + ' = ' + f.upto(r.mean, 6), 's = √(Σ(x − mean)² ÷ ' + (r.count - 1) + ') = ' + f.upto(r.sampSD, 6), 'σ = √(Σ(x − mean)² ÷ ' + r.count + ') = ' + f.upto(r.popSD, 6)],
"tips": ["Use the sample standard deviation (n−1) when your data is a sample drawn from a larger population — this is the usual case.","The median resists outliers; the mean does not. A large gap between them signals a skewed distribution.","The IQR is a robust spread measure. Points beyond Q1 − 1.5·IQR or Q3 + 1.5·IQR are conventional outliers."],
"faq": [{"q":"Why are there two standard deviations?","a":"Dividing by N gives the population standard deviation, correct when your data is the entire population. Dividing by N−1 (Bessel’s correction) gives an unbiased estimate when your data is a sample."}]
};
})();