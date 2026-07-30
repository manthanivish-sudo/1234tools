#!/usr/bin/env node
/**
 * Fetches daily currency reference rates and writes assets/rates.json.
 *
 *   node build/fetch-rates.js
 *
 * This runs on GitHub's servers from .github/workflows/update-rates.yml, never
 * in a visitor's browser. That is the entire point of it: the converter used to
 * call cdn.jsdelivr.net (falling back to open.er-api.com) directly on page load,
 * with no consent, which made privacy/index.html's "an ordinary page load
 * contacts no third party at all" untrue on that one page. Moving the call here
 * means the visitor's browser only ever talks to this site, and the upstream
 * feeds only ever see a GitHub runner.
 *
 * Nothing is lost by the move: both feeds publish once a day, so a file rebuilt
 * once a day is exactly as current as fetching live was.
 *
 * The two sources are kept, still tried in order, because the resilience that
 * was worth having client-side is worth having here too -- if the first is down
 * on a given morning the file simply does not change, and the converter goes on
 * serving yesterday's rates rather than breaking.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'rates.json');

/* USD, because both feeds carry it and every cross-rate is derived from it in
   the page anyway. The UI still opens on GBP; that is a display default, not
   this file's base. */
const BASE = 'USD';

const SOURCES = [
  {
    name: 'Currency API',
    url: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${BASE.toLowerCase()}.json`,
    parse(json) {
      const block = json[BASE.toLowerCase()];
      if (!block) return null;
      const rates = {};
      for (const [k, v] of Object.entries(block)) {
        if (typeof v === 'number' && isFinite(v)) rates[k.toUpperCase()] = v;
      }
      return { rates, date: json.date };
    }
  },
  {
    name: 'ExchangeRate-API (open)',
    url: `https://open.er-api.com/v6/latest/${BASE}`,
    parse(json) {
      if (json.result !== 'success' || !json.rates) return null;
      return {
        rates: json.rates,
        date: (json.time_last_update_utc || '').slice(5, 16)
      };
    }
  }
];

/**
 * The currencies the converter actually offers, read from its own COMMON list
 * so there is one place that decides. Filtering matters for more than size: the
 * jsDelivr feed carries several hundred crypto tickers, and because those move
 * every minute, keeping them would produce a large diff and a commit every
 * single day whether or not a real currency moved.
 */
function listedCurrencies() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'engine', 'fx.bundle.js'), 'utf8');
  const m = /var COMMON = \{([\s\S]*?)\};/.exec(src);
  if (!m) throw new Error('could not find the COMMON list in engine/fx.bundle.js');
  const codes = [...m[1].matchAll(/\b([A-Z]{3}):/g)].map((x) => x[1]);
  if (codes.length < 20) throw new Error(`only ${codes.length} currencies parsed from COMMON`);
  return new Set(codes);
}

async function fetchRates(wanted) {
  const problems = [];
  for (const src of SOURCES) {
    try {
      const res = await fetch(src.url, { headers: { 'user-agent': '1234tools-rates' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const parsed = src.parse(await res.json());
      if (!parsed || !parsed.rates) throw new Error('unexpected response shape');

      const rates = {};
      for (const k of [...wanted].sort()) {
        const v = parsed.rates[k];
        if (typeof v === 'number' && isFinite(v) && v > 0) rates[k] = v;
      }
      rates[BASE] = 1;

      /* A feed that answers 200 with half the currencies missing would quietly
         break most of the converter, so treat thin data as a failure and let
         the next source try. */
      const missing = [...wanted].filter((k) => !(k in rates));
      if (missing.length > wanted.size * 0.1) {
        throw new Error(`${missing.length} of ${wanted.size} currencies missing`);
      }
      return { source: src.name, date: parsed.date, rates, missing };
    } catch (e) {
      problems.push(`${src.name}: ${e.message}`);
    }
  }
  throw new Error('every source failed —\n  ' + problems.join('\n  '));
}

(async () => {
  const wanted = listedCurrencies();
  const got = await fetchRates(wanted);
  if (got.missing.length) {
    console.log(`  note: no rate for ${got.missing.join(', ')} from ${got.source}`);
  }

  /* Keys are sorted above so the daily diff is the numbers that moved and
     nothing else. Without that, key reordering would make every commit look
     like the whole file changed. */
  const out = {
    base: BASE,
    date: got.date,
    source: got.source,
    fetched: new Date().toISOString(),
    rates: got.rates
  };

  const next = JSON.stringify(out, null, 2) + '\n';
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;

  /* `fetched` changes on every run, so comparing whole files would commit daily
     even when no rate moved. Compare the payload that matters. */
  const same = prev && (() => {
    try {
      const p = JSON.parse(prev);
      return JSON.stringify(p.rates) === JSON.stringify(out.rates) && p.date === out.date;
    } catch (e) { return false; }
  })();

  if (same) {
    console.log(`rates unchanged (${got.date}, ${Object.keys(got.rates).length} currencies)`);
    process.exit(0);
  }

  fs.writeFileSync(OUT, next);
  console.log(`wrote assets/rates.json — ${got.date}, ` +
              `${Object.keys(got.rates).length} currencies, via ${got.source}`);
})().catch((e) => {
  console.error('\nfetch-rates.js failed: ' + (e && e.message || e) + '\n');
  process.exit(1);
});
