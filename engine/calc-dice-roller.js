(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["dice-roller"] = {
"title": "Dice Roller",
"category": "utilities",
"description": "Roll up to 200 dice from d4 to d100 with a modifier and a drop rule, shown in standard RPG notation.",
"keywords": ["dice roller","roll dice online","d20 roller","virtual dice","random dice","D&D dice"],
"formula": "standard notation: 2d6+3 means two six-sided dice plus three",
"regenerate": true,
"inputs": [{"key":"count","label":"Number of dice","type":"number","default":2,"min":1,"max":200},{"key":"sides","label":"Sides","type":"select","options":[{"value":"4","label":"d4"},{"value":"6","label":"d6"},{"value":"8","label":"d8"},{"value":"10","label":"d10"},{"value":"12","label":"d12"},{"value":"20","label":"d20"},{"value":"100","label":"d100"}],"default":"6"},{"key":"modifier","label":"Modifier","type":"number","default":0},{"key":"drop","label":"Drop","type":"select","options":[{"value":"none","label":"Keep all"},{"value":"low","label":"Drop the lowest"},{"value":"high","label":"Drop the highest"}],"default":"none"}],
"compute": ({ count, sides, modifier, drop }) => {
      const n = Math.max(1, Math.min(200, Math.round(Number(count) || 1)));
      const s = Math.max(2, Math.round(Number(sides) || 6));
      const mod = Math.round(Number(modifier) || 0);

      const rand = (limit) => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const max32 = 4294967296, bound = max32 - (max32 % limit);
          const buf = new Uint32Array(1);
          let v; do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= bound);
          return v % limit;
        }
        return Math.floor(Math.random() * limit);
      };

      const rolls = Array.from({ length: n }, () => 1 + rand(s));
      let kept = rolls.slice();
      let dropped = null;
      if (drop !== 'none' && n > 1) {
        const sorted = rolls.slice().sort((a, b) => a - b);
        dropped = drop === 'low' ? sorted[0] : sorted[sorted.length - 1];
        const idx = kept.indexOf(dropped);
        kept.splice(idx, 1);
      }
      const sum = kept.reduce((a, b) => a + b, 0);

      return {
        total: sum + mod,
        notation: `${n}d${s}${mod ? (mod > 0 ? '+' + mod : mod) : ''}`,
        rolls: rolls.join(', '),
        droppedValue: dropped === null ? '—' : String(dropped),
        sum,
        modifier: mod,
        highest: Math.max(...rolls),
        lowest: Math.min(...rolls),
        average: sum / kept.length
      };
    },
"outputs": [{"key":"total","label":"Total","format":"number","primary":true},{"key":"notation","label":"Notation","format":"text"},{"key":"rolls","label":"Individual rolls","format":"text"},{"key":"droppedValue","label":"Dropped","format":"text"},{"key":"sum","label":"Sum of kept dice","format":"number"},{"key":"highest","label":"Highest roll","format":"number"},{"key":"lowest","label":"Lowest roll","format":"number"},{"key":"average","label":"Average per die","format":"number"}],
"filled": (v, r, f) => r.rolls ? ['total = ' + (r.rolls || '').replace(/,\s*/g, ' + ') + (Number(v.modifier) ? ' ' + (Number(v.modifier) > 0 ? '+ ' : '− ') + Math.abs(Number(v.modifier)) : '') + (r.droppedValue && r.droppedValue !== '—' ? ', dropping ' + r.droppedValue : '') + ' = ' + r.total] : [],
"tips": ["Standard notation is NdS+M: 3d6+2 rolls three six-sided dice and adds two.","Dropping the lowest die is the usual method for rolling character statistics — it shifts the distribution upward.","Rolls use the cryptographic random source, so they are not predictable from previous results."],
"faq": [{"q":"Why do multiple dice cluster around the middle?","a":"Because sums of dice follow a bell-shaped distribution. On 2d6 there is one way to make 2 but six ways to make 7, so 7 comes up six times as often."}]
};
})();