(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["password-generator"] = {
"title": "Password Generator",
"kind": "generate",
"description": "Generate strong random passwords or passphrases using a cryptographic random source.",
"keywords": ["password generator","strong password","random password","passphrase generator","secure password"],
"regenerate": true,
"fields": [{"key":"type","label":"Type","type":"select","default":"password","options":[{"value":"password","label":"Random characters"},{"value":"passphrase","label":"Passphrase (memorable words)"}]},{"key":"length","label":"Length (characters)","type":"number","default":20,"min":6,"max":128},{"key":"words","label":"Words (passphrase)","type":"number","default":5,"min":3,"max":12},{"key":"upper","label":"Uppercase A-Z","type":"select","default":"yes","options":[{"value":"yes","label":"Include"},{"value":"no","label":"Exclude"}]},{"key":"digits","label":"Digits 0-9","type":"select","default":"yes","options":[{"value":"yes","label":"Include"},{"value":"no","label":"Exclude"}]},{"key":"symbols","label":"Symbols","type":"select","default":"yes","options":[{"value":"yes","label":"Include"},{"value":"no","label":"Exclude"}]},{"key":"ambiguous","label":"Lookalike characters (l, 1, O, 0)","type":"select","default":"exclude","options":[{"value":"exclude","label":"Exclude"},{"value":"include","label":"Include"}]},{"key":"count","label":"How many","type":"number","default":5,"min":1,"max":50}],
"generate": (f) => {
      const rand = (limit) => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const max32 = 4294967296, bound = max32 - (max32 % limit);
          const buf = new Uint32Array(1);
          let v; do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= bound);
          return v % limit;
        }
        return Math.floor(Math.random() * limit);
      };

      const n = Math.max(1, Math.min(50, Number(f.count) || 1));
      const WORDS = ('able acid aged also area army away baby back ball band bank base bath bear beat been beer bell belt bend best bike bird bite blue boat body bone book boot born both bowl bulk burn bush busy cake call calm came camp card care case cash cast cell chat chip city club coal coat code cold come cook cool cope copy core cost crew crop dark data date dawn days dead deal dean dear debt deep deny desk dial diet disc disk does done door dose down draw drew drop drug dual duke dust duty each earn ease east easy edge else even ever evil exit face fact fail fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flat flew flow food foot ford form fort four free from fuel full fund gain game gate gave gear gene gift girl give glad goal goes gold golf gone good gray grew grey grid grow gulf hair half hall hand hang hard harm hate have head heal hear heat held hell help here hero high hill hire hold hole holy home hope horn host hour huge hung hunt hurt idea inch into iron item jack jane jean join jump jury just keen keep kent kept kick kind king knee knew know lack lady laid lake land lane last late lead left less life lift like line link list live load loan lock logo long look lord lose loss lost love luck made mail main make male mall many mark mass matt meal mean meat meet menu mere mile milk mill mind mine miss mode mood moon more most move much must name navy near neck need news next nice nick nine none nose note noun okay once only onto open oral over pace pack page paid pain pair palm park part pass past path peak pick pink pipe plan play plot plug plus poll pool poor port post pull pure push race rail rain rank rare rate read real rear rely rent rest rice rich ride ring rise risk road rock role roll roof room root rose rule rush safe said sail salt same sand save seat seed seek seem seen self sell send sent sept ship shoe shop shot show shut sick side sign silk sing sink site size skin slip slow snow soft soil sold sole some song soon sort soul spot star stay step stop such suit sure take tale talk tall tank tape task team tech tell tend term test text than that them then they thin this thus tide tied tier ties tile till time tiny told toll tone tony took tool tops torn tour town tree trip true tune turn twin type unit upon used user vary vast very vice view vote wage wait wake walk wall want ward warm wash wave ways weak wear week well went were west what when whom wide wife wild will wind wine wing wire wise wish with wood word wore work yard yeah year your zero zone').split(' ');

      const out = [];
      let poolSize = 0, entropy = 0;

      if (f.type === 'passphrase') {
        const w = Math.max(3, Math.min(12, Number(f.words) || 5));
        for (let i = 0; i < n; i++) {
          const parts = Array.from({ length: w }, () => WORDS[rand(WORDS.length)]);
          if (f.upper === 'yes') parts[rand(w)] = parts[rand(w)].replace(/^./, c => c.toUpperCase());
          let p = parts.join('-');
          if (f.digits === 'yes') p += '-' + rand(100);
          out.push(p);
        }
        poolSize = WORDS.length;
        entropy = w * Math.log2(WORDS.length) + (f.digits === 'yes' ? Math.log2(100) : 0);
      } else {
        let pool = 'abcdefghijkmnopqrstuvwxyz';
        if (f.ambiguous === 'include') pool = 'abcdefghijklmnopqrstuvwxyz';
        if (f.upper === 'yes') pool += f.ambiguous === 'include' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        if (f.digits === 'yes') pool += f.ambiguous === 'include' ? '0123456789' : '23456789';
        if (f.symbols === 'yes') pool += '!@#$%^&*()-_=+[]{};:,.?';
        const len = Math.max(6, Math.min(128, Number(f.length) || 20));
        for (let i = 0; i < n; i++) {
          out.push(Array.from({ length: len }, () => pool[rand(pool.length)]).join(''));
        }
        poolSize = pool.length;
        entropy = len * Math.log2(pool.length);
      }

      const years = Math.pow(2, entropy) / (1e12 * 31557600);   // a trillion guesses a second
      const crack = years < 1 / 31557600 ? 'under a second'
        : years < 1 ? `${Math.round(years * 31557600).toLocaleString('en-GB')} seconds`
        : years < 1e6 ? `${Math.round(years).toLocaleString('en-GB')} years`
        : `${(years / 1e6).toExponential(1)} million years`;

      return {
        output: out.join('\n'),
        stats: [
          ['Generated', String(n)],
          ['Entropy', `${Math.round(entropy)} bits`],
          ['Character pool', String(poolSize) + (f.type === 'passphrase' ? ' words' : ' characters')],
          ['Offline cracking time*', crack],
          ['Random source', (typeof crypto !== 'undefined' && crypto.getRandomValues) ? 'crypto.getRandomValues' : 'Math.random fallback']
        ],
        warn: entropy < 60 ? 'Below about 60 bits of entropy is weak for anything that matters. Increase the length or add character types.' : ''
      };
    },
"tips": ["Length matters far more than complexity. A long passphrase of ordinary words beats a short string of symbols, and is easier to type on a phone.","Passwords are generated by your browser’s cryptographic random source and never transmitted. Nothing here is logged or stored.","Use a password manager and a different password everywhere. Reuse is what turns one breach into many.","*Cracking time assumes an offline attack at a trillion guesses per second against a fast hash. A properly slow hash such as Argon2 or bcrypt makes it vastly longer — but you cannot know which a given site uses.","Enable two-factor authentication wherever it is offered. It defeats a stolen password outright."],
"faq": [{"q":"Is generating a password in a browser safe?","a":"The randomness is sound — it uses the same cryptographic source as the browser’s own security features, and the page is static with no network calls. That said, a dedicated password manager generating directly into its vault removes the copy-paste step entirely, which is one fewer place for something to go wrong."},{"q":"Why exclude lookalike characters by default?","a":"Because l, 1, I, O and 0 are routinely misread when a password is written down or read aloud. Excluding them costs a few bits of entropy and saves a great deal of frustration."}]
};
})();