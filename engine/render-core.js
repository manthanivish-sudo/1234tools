/**
 * Tool Renderer
 * -------------
 * Builds the interactive UI for ANY tool from its spec. One renderer,
 * every tool. Live-updating: results recalculate on each keystroke,
 * with no submit button and no network request.
 */
(function () {
  'use strict';

  const fmt = {
    number(v, unit, code) {
      if (v === null || v === undefined || v === '') return '—';
      if (typeof v === 'string') return v;
      if (!isFinite(v)) return v > 0 ? '∞' : (isNaN(v) ? '—' : '−∞');
      const abs = Math.abs(v);
      let s;
      if (abs !== 0 && (abs < 1e-4 || abs >= 1e12)) s = v.toExponential(6);
      else {
        const dp = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
        const nloc = code === 'INR' ? 'en-IN' : code === 'USD' ? 'en-US' : 'en-GB';
        s = Number(v.toFixed(dp)).toLocaleString(nloc, { maximumFractionDigits: dp });
      }
      return unit ? `${s} ${unit}` : s;
    },
    /* Currency is per-spec, not global: these tools are used from the UK
       but the maths is identical everywhere, so the symbol is data. */
    currency(v, unit, code) {
      if (!isFinite(v)) return '—';
      const cur = code || window.__CURRENCY__ || 'GBP';
      /* Locale drives digit grouping, not just the symbol. INR groups in
         lakhs and crores (3,19,800), which is what Indian users read. */
      const loc = cur === 'USD' ? 'en-US' : cur === 'EUR' ? 'de-DE'
                : cur === 'INR' ? 'en-IN' : 'en-GB';
      try {
        return v.toLocaleString(loc, { style: 'currency', currency: cur, maximumFractionDigits: 2 });
      } catch (e) {
        return cur + ' ' + v.toLocaleString(loc, { maximumFractionDigits: 2 });
      }
    },
    percent(v, unit, code) {
      const loc = code === 'INR' ? 'en-IN' : code === 'USD' ? 'en-US' : 'en-GB';
      return isFinite(v) ? `${Number(v.toFixed(4)).toLocaleString(loc)}%` : '—';
    },
    text(v) { return v === null || v === undefined ? '' : String(v); },
    auto(v, unit, code) { return typeof v === 'string' ? v : fmt.number(v, unit, code); }
  };

  function buildInput(input) {
    const id = `in-${input.key}`;
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = input.label + (input.unit ? ` (${input.unit})` : '');
    wrap.appendChild(label);

    let el;
    if (input.type === 'select') {
      el = document.createElement('select');
      input.options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        if (String(o.value) === String(input.default)) opt.selected = true;
        el.appendChild(opt);
      });
    } else {
      el = document.createElement('input');
      el.type = input.type === 'date' ? 'date' : input.type === 'text' ? 'text' : 'number';
      if (input.type === 'number') {
        el.step = input.step || 'any';
        el.inputMode = 'decimal';
        if (input.min !== undefined) el.min = input.min;
      }
      let def = input.default;
      if (def === 'TODAY') def = new Date().toISOString().slice(0, 10);
      if (def !== null && def !== undefined) el.value = def;
      if (input.optional) el.placeholder = 'leave blank to solve for this';
    }
    el.id = id;
    el.name = input.key;
    el.className = 'control';
    wrap.appendChild(el);
    return wrap;
  }

  function readValues(spec, form) {
    const vals = {};
    spec.inputs.forEach(inp => {
      const el = form.querySelector(`[name="${inp.key}"]`);
      if (!el) return;
      if (inp.type === 'number') {
        vals[inp.key] = el.value === '' ? null : Number(el.value);
      } else {
        vals[inp.key] = el.value;
      }
    });
    return vals;
  }

  function renderResults(spec, results, container) {
    container.innerHTML = '';
    spec.outputs.forEach(out => {
      const v = results[out.key];
      if (v === undefined) return;
      if (out.format === 'text' && (v === '' || v === null)) return;

      const row = document.createElement('div');
      row.className = 'result' + (out.primary ? ' result-primary' : '');

      if (out.label) {
        const l = document.createElement('span');
        l.className = 'result-label';
        l.textContent = out.label;
        row.appendChild(l);
      }

      const val = document.createElement('span');
      val.className = 'result-value';
      const f = fmt[out.format] || fmt.number;
      val.textContent = f(v, out.unit, spec.currency);
      row.appendChild(val);

      const copy = document.createElement('button');
      copy.className = 'copy';
      copy.type = 'button';
      copy.title = 'Copy value';
      copy.textContent = '⧉';
      copy.addEventListener('click', () => {
        navigator.clipboard?.writeText(val.textContent).then(() => {
          copy.textContent = '✓';
          setTimeout(() => (copy.textContent = '⧉'), 1200);
        });
      });
      row.appendChild(copy);

      container.appendChild(row);
    });
  }

  window.MVRTool = {
    mount(spec, root) {
      const form = root.querySelector('.tool-form');
      const out = root.querySelector('.tool-results');

      spec.inputs.forEach(inp => form.appendChild(buildInput(inp)));

      const run = () => {
        try {
          const res = spec.compute(readValues(spec, form)) || {};
          renderResults(spec, res, out);
          const host = root.querySelector('.tool-table');
          if (host) window.MVRTool.renderTable(res._table, host);
        } catch (e) {
          out.innerHTML = '<div class="result"><span class="result-label">Error</span>' +
                          '<span class="result-value">Check your inputs</span></div>';
        }
      };

      form.addEventListener('input', run);
      form.addEventListener('change', run);
      run();
    },

    mountConverter(dim, dimData, convert, root, preset) {
      const form = root.querySelector('.tool-form');
      const out = root.querySelector('.tool-results');
      const keys = Object.keys(dimData.units);

      const mk = (key, label, def) => {
        const w = document.createElement('div');
        w.className = 'field';
        const l = document.createElement('label');
        l.setAttribute('for', 'u-' + key); l.textContent = label;
        const s = document.createElement('select');
        s.id = 'u-' + key; s.name = key; s.className = 'control';
        keys.forEach(k => {
          const o = document.createElement('option');
          o.value = k; o.textContent = `${dimData.units[k].name} (${dimData.units[k].symbol})`;
          if (k === def) o.selected = true;
          s.appendChild(o);
        });
        w.appendChild(l); w.appendChild(s);
        return w;
      };

      const vw = document.createElement('div');
      vw.className = 'field';
      vw.innerHTML = '<label for="u-value">Value</label>';
      const vi = document.createElement('input');
      vi.id = 'u-value'; vi.type = 'number'; vi.step = 'any';
      vi.inputMode = 'decimal'; vi.className = 'control'; vi.value = '1';
      vw.appendChild(vi);

      form.appendChild(vw);
      form.appendChild(mk('from', 'From', preset?.from || keys[0]));
      form.appendChild(mk('to', 'To', preset?.to || keys[1]));

      const swap = document.createElement('button');
      swap.type = 'button'; swap.className = 'swap'; swap.textContent = '⇅ Swap units';
      form.appendChild(swap);

      const run = () => {
        const v = vi.value === '' ? null : Number(vi.value);
        const f = form.querySelector('[name="from"]').value;
        const t = form.querySelector('[name="to"]').value;
        out.innerHTML = '';

        if (v === null) return;

        const main = document.createElement('div');
        main.className = 'result result-primary';
        main.innerHTML =
          `<span class="result-label">${fmt.number(v)} ${dimData.units[f].symbol} =</span>` +
          `<span class="result-value">${fmt.number(convert(v, f, t, dim))} ${dimData.units[t].symbol}</span>`;
        out.appendChild(main);

        const tbl = document.createElement('div');
        tbl.className = 'all-units';
        tbl.innerHTML = '<h3>All units</h3>';
        keys.forEach(k => {
          if (k === f) return;
          const row = document.createElement('div');
          row.className = 'result';
          row.innerHTML =
            `<span class="result-label">${dimData.units[k].name}</span>` +
            `<span class="result-value">${fmt.number(convert(v, f, k, dim))} ${dimData.units[k].symbol}</span>`;
          tbl.appendChild(row);
        });
        out.appendChild(tbl);
      };

      swap.addEventListener('click', () => {
        const fs = form.querySelector('[name="from"]');
        const ts = form.querySelector('[name="to"]');
        [fs.value, ts.value] = [ts.value, fs.value];
        run();
      });

      form.addEventListener('input', run);
      form.addEventListener('change', run);
      run();
    }
  };
})();

/* ============================================================
   Schedule tables — amortisation, depreciation, DCF, commission
   ============================================================ */
(function () {
  'use strict';
  window.MVRTool = window.MVRTool || {};

  window.MVRTool.renderTable = function (table, host) {
    host.innerHTML = '';
    if (!table || !table.rows || !table.rows.length) { host.hidden = true; return; }
    host.hidden = false;

    var wrap = document.createElement('div');
    wrap.className = 'table-scroll';

    var t = document.createElement('table');
    t.className = 'schedule';

    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    table.head.forEach(function (h, i) {
      var th = document.createElement('th');
      th.textContent = h;
      if (i > 0) th.className = 'num';
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);

    var tb = document.createElement('tbody');
    table.rows.forEach(function (row) {
      var tr = document.createElement('tr');
      row.forEach(function (cell, i) {
        var td = document.createElement('td');
        td.textContent = cell;
        if (i > 0) td.className = 'num';
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    host.appendChild(wrap);

    // CSV export — schedules are the thing people paste into a spreadsheet
    var bar = document.createElement('div');
    bar.className = 'io-actions table-actions';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-ghost';
    btn.textContent = 'Download CSV';
    btn.addEventListener('click', function () {
      var q = function (v) { return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var csv = [table.head.map(q).join(',')]
        .concat(table.rows.map(function (r) { return r.map(q).join(','); })).join('\n');
      var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      var a = document.createElement('a');
      a.href = url; a.download = 'schedule.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });
    bar.appendChild(btn);
    host.appendChild(bar);
  };
})();
