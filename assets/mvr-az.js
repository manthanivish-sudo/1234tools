/*!
 * MVR A–Z Launchpad · Brand banner for the MVR IT Services LTD product family.
 * Self-contained: injects its own styles + markup into <div id="mvr-az"></div>.
 * Optional attributes on the container:
 *   data-site="attend-now|1234tools|fixourtime|mvr|xleshop"  → highlights "You are here"
 * One file, copied verbatim to every site. Edit the PRODUCTS map below to add products.
 */
(function () {
  'use strict';

  var MOUNT_ID = 'mvr-az';

  /* ------------------------------------------------------------------ data */
  var MVR = 'https://www.mvritservices.com';
  var ATTEND = 'https://attend-now.com'; // apex only — www has no DNS record

  // Every entry: k = key cap, p = products [{n:name, t:tagline, u:url, d:domain label}]
  // r:true = reserved key (invites the next client), site = "you are here" id.
  var KEYS = [
    { k: '1', site: '1234tools' }, { k: '2' }, { k: '3' }, { k: '4' },
    { k: '5' }, { k: '6' }, { k: '7' }, { k: '8' }, { k: '9' }, { k: '0' },
    {
      k: 'A', site: 'attend-now',
      p: [{ n: 'Attend Now', t: 'Smart attendance, events & QR check-in', u: ATTEND + '/', d: 'attend-now.com' }]
    },
    { k: 'B', r: true },
    {
      k: 'C',
      p: [{ n: 'Contact Center Management', t: 'Campaigns, call tracking & lead pipelines', u: MVR + '/products/#telemarketing', d: 'mvritservices.com' }]
    },
    { k: 'D', r: true },
    {
      k: 'E',
      p: [{ n: 'E-commerce by XLeShop', t: 'Branded online stores, zero commission', u: 'https://xleshop.com/', d: 'xleshop.com' }]
    },
    {
      k: 'F', site: 'fixourtime',
      p: [{ n: 'FixOurTime', t: 'Scheduling & bookings — share, book, meet, done', u: 'https://www.fixourtime.com/', d: 'fixourtime.com' }]
    },
    {
      k: 'G',
      p: [{ n: 'Gajanana Foods', t: 'Sweets & savouries, ordered online', u: 'https://gajananafoods.co.in/', d: 'gajananafoods.co.in' }]
    },
    {
      k: 'H',
      p: [
        { n: 'House of Spices', t: 'Restaurant pre-order, pickup & delivery', u: ATTEND + '/hos/hos-pre-order.html', d: 'attend-now.com' },
        { n: 'Hospital Apps', t: 'Patient records, billing, pharmacy & labs', u: MVR + '/products/#hospital', d: 'mvritservices.com' }
      ]
    },
    {
      k: 'I',
      p: [{ n: 'Integrations', t: 'Payments, WhatsApp, CRMs & legacy systems — unified', u: MVR + '/services/#integration', d: 'mvritservices.com' }]
    },
    { k: 'J', r: true },
    {
      k: 'K',
      p: [
        { n: 'KBK Dairy Products', t: 'Fresh dairy, delivered', u: 'https://kbkdairyproducts.com/', d: 'kbkdairyproducts.com' },
        { n: 'KBK Mart', t: 'Online grocery store', u: 'https://kbkmart.com/', d: 'kbkmart.com' }
      ]
    },
    {
      k: 'L',
      p: [{ n: 'LearnX', t: 'Learning & classroom platform', u: ATTEND + '/learnx/index.html', d: 'attend-now.com/learnx' }]
    },
    {
      k: 'M', site: 'mvr',
      p: [{ n: 'MVR IT Services LTD', t: 'Traditional software to Agentic AI — we deliver', u: MVR + '/', d: 'mvritservices.com' }]
    },
    {
      k: 'N',
      p: [
        { n: 'Nature Cure Hospital Management', t: 'Hospital operations, digitised', u: MVR + '/products/#hospital', d: 'mvritservices.com' },
        { n: 'Natural Cure Ayurveda', t: 'Ayurvedic products online', u: 'https://naturalcureayurveda.com/', d: 'naturalcureayurveda.com' }
      ]
    },
    { k: 'O', r: true },
    {
      k: 'P',
      p: [{ n: 'PestNest', t: 'Pest control services platform', u: 'https://pestnest.co.in/', d: 'pestnest.co.in' }]
    },
    {
      k: 'Q',
      p: [{ n: 'QR Check-in', t: 'Bulk QR generation & instant event check-in', u: ATTEND + '/', d: 'attend-now.com' }]
    },
    {
      k: 'R',
      p: [{ n: 'Registrations', t: 'Online event registration & ticketing', u: ATTEND + '/', d: 'attend-now.com' }]
    },
    {
      k: 'S',
      p: [
        { n: 'SocialPostXpress', t: 'Social posting, automated', u: MVR + '/products/', d: 'mvritservices.com' },
        { n: 'Scholis — School Apps', t: 'Admissions, attendance, fees & parent comms', u: MVR + '/products/#school', d: 'mvritservices.com' },
        { n: 'Sthira — Yoga App', t: 'Classes, members & practice tracking', u: 'https://app.swaravikasayoga.com/', d: 'app.swaravikasayoga.com' },
        { n: 'South Basket', t: 'Indian grocery, online', u: 'https://southbasket.co.in/', d: 'southbasket.co.in' },
        { n: 'Sri Balaji Stores', t: 'Asian groceries, Kent UK', u: 'https://sribalajistores.co.uk/', d: 'sribalajistores.co.uk' }
      ]
    },
    {
      k: 'T',
      p: [
        { n: '1234Tools', t: '1,185+ free calculators & converters', u: 'https://www.1234tools.com/', d: '1234tools.com' },
        { n: 'Telemarketing Suite', t: 'Outbound sales, organised', u: MVR + '/products/#telemarketing', d: 'mvritservices.com' }
      ]
    },
    {
      k: 'U',
      p: [{ n: 'UltimateChit', t: 'Chit fund management', u: MVR + '/products/', d: 'mvritservices.com' }]
    },
    {
      k: 'V',
      p: [{ n: 'Swara Vikasa Yoga', t: 'Yoga school & wellness', u: 'https://swaravikasayoga.com/', d: 'swaravikasayoga.com' }]
    },
    {
      k: 'W',
      p: [{ n: 'WhatsApp, SMS & Email Automation', t: 'Reach customers on channels they use', u: MVR + '/services/#communications', d: 'mvritservices.com' }]
    },
    {
      k: 'X', site: 'xleshop',
      p: [{ n: 'XLeShop', t: 'The online store platform — live before your chai', u: 'https://xleshop.com/', d: 'xleshop.com' }]
    },
    {
      k: 'Y',
      p: [{ n: 'Yoga App', t: 'Swara Vikasa Yoga — practice anywhere', u: 'https://app.swaravikasayoga.com/', d: 'app.swaravikasayoga.com' }]
    },
    {
      k: 'Z',
      p: [{ n: 'A to Z — Delivered', t: 'Everything in between, built by one team', u: MVR + '/', d: 'mvritservices.com' }]
    }
  ];

  var DIGIT_PRODUCT = { n: '1234Tools', t: '1,185+ free calculators & converters — free forever', u: 'https://www.1234tools.com/', d: '1234tools.com' };
  var RESERVED = { n: 'Reserved for your idea', t: 'This letter is waiting for your product. Let’s build it together.', u: MVR + '/contact/', d: 'Talk to MVR IT →' };

  /* ----------------------------------------------------------------- styles */
  var CSS = ''
    + '.mvraz{--az-bg:#070b18;--az-bg2:#0c1226;--az-key:#141c36;--az-key2:#1b2547;--az-edge:rgba(255,255,255,.09);'
    + '--az-txt:#eef2ff;--az-mut:#93a0c2;--az-acc:#7c8cff;--az-acc2:#38bdf8;--az-gold:#fbbf24;--az-pop:#101832;'
    + 'position:relative;isolation:isolate;margin:56px auto;padding:44px 20px 48px;max-width:1180px;border-radius:26px;'
    + 'background:radial-gradient(1000px 420px at 15% -10%,rgba(124,140,255,.16),transparent 60%),'
    + 'radial-gradient(800px 380px at 90% 115%,rgba(56,189,248,.12),transparent 60%),linear-gradient(180deg,var(--az-bg),var(--az-bg2));'
    + 'border:1px solid var(--az-edge);color:var(--az-txt);overflow:visible;font-family:inherit;text-align:center}'
    + '@media (prefers-color-scheme: light){html:not([data-theme="dark"]) .mvraz{--az-bg:#f6f8ff;--az-bg2:#eef1fb;--az-key:#ffffff;--az-key2:#f2f4ff;'
    + '--az-edge:rgba(20,30,80,.12);--az-txt:#131a33;--az-mut:#5a6790;--az-pop:#ffffff}}'
    + 'html[data-theme="light"] .mvraz{--az-bg:#f6f8ff;--az-bg2:#eef1fb;--az-key:#ffffff;--az-key2:#f2f4ff;'
    + '--az-edge:rgba(20,30,80,.12);--az-txt:#131a33;--az-mut:#5a6790;--az-pop:#ffffff}'
    + '.mvraz *{box-sizing:border-box}'
    + '.mvraz-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.18em;'
    + 'text-transform:uppercase;color:var(--az-acc);border:1px solid var(--az-edge);border-radius:999px;padding:6px 14px;margin:0 0 14px}'
    + '.mvraz-eyebrow::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--az-gold);box-shadow:0 0 10px var(--az-gold)}'
    + '.mvraz-h{margin:0 0 10px;font-size:clamp(24px,3.4vw,40px);font-weight:800;line-height:1.15;letter-spacing:-.02em;color:var(--az-txt)}'
    + '.mvraz-h .mvraz-grad{background:linear-gradient(100deg,var(--az-acc),var(--az-acc2) 55%,var(--az-gold));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}'
    + '.mvraz-sub{margin:0 auto 30px;max-width:640px;font-size:15px;line-height:1.7;color:var(--az-mut)}'
    + '.mvraz-board{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;max-width:960px;margin:0 auto}'
    + '.mvraz-keywrap{position:relative}'
    + '.mvraz-key{position:relative;display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:12px;'
    + 'background:linear-gradient(180deg,var(--az-key2),var(--az-key));border:1px solid var(--az-edge);'
    + 'box-shadow:0 4px 0 rgba(0,0,0,.28),0 6px 14px rgba(0,0,0,.18);cursor:pointer;text-decoration:none;'
    + 'font-size:19px;font-weight:800;color:var(--az-txt);letter-spacing:.02em;'
    + 'transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease,color .14s ease;'
    + 'animation:mvrazIn .5s cubic-bezier(.2,.7,.3,1.2) both;animation-delay:var(--az-i)}'
    + '@keyframes mvrazIn{from{opacity:0;transform:translateY(14px) scale(.85)}to{opacity:1;transform:none}}'
    + '@media (prefers-reduced-motion: reduce){.mvraz-key{animation:none}}'
    + '.mvraz-key:hover,.mvraz-key:focus-visible{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.28),0 3px 8px rgba(0,0,0,.18);'
    + 'border-color:var(--az-acc);color:var(--az-acc);outline:none;z-index:3}'
    + '.mvraz-key .mvraz-dot{position:absolute;right:6px;top:6px;width:5px;height:5px;border-radius:50%;background:var(--az-acc2);opacity:.9}'
    + '.mvraz-key--multi .mvraz-count{position:absolute;right:4px;bottom:3px;font-size:8.5px;font-weight:700;color:var(--az-mut);letter-spacing:0}'
    /* tiered heat: the more products behind a key, the warmer it glows */
    + '.mvraz-key--warm{border-color:rgba(124,140,255,.45);'
    + 'box-shadow:0 4px 0 rgba(0,0,0,.28),0 6px 14px rgba(0,0,0,.18),0 0 14px rgba(124,140,255,.30)}'
    + '.mvraz-key--warm:hover,.mvraz-key--warm:focus-visible{box-shadow:0 2px 0 rgba(0,0,0,.28),0 3px 8px rgba(0,0,0,.18),0 0 24px rgba(124,140,255,.55)}'
    + '.mvraz-key--warm .mvraz-count{color:var(--az-acc)}'
    + '.mvraz-key--hot{border-color:rgba(56,189,248,.55);'
    + 'box-shadow:0 4px 0 rgba(0,0,0,.28),0 6px 14px rgba(0,0,0,.18),0 0 18px rgba(124,140,255,.50),0 0 32px rgba(56,189,248,.30)}'
    + '.mvraz-key--hot:hover,.mvraz-key--hot:focus-visible{box-shadow:0 2px 0 rgba(0,0,0,.28),0 3px 8px rgba(0,0,0,.18),0 0 26px rgba(124,140,255,.70),0 0 44px rgba(56,189,248,.45)}'
    + '.mvraz-key--hot .mvraz-count{color:var(--az-acc2)}'
    + '.mvraz-key--dim{opacity:.45}'
    + '.mvraz-key--dim:hover,.mvraz-key--dim:focus-visible{opacity:1;border-color:var(--az-gold);color:var(--az-gold)}'
    + '.mvraz-key--here{border-color:var(--az-gold);box-shadow:0 4px 0 rgba(0,0,0,.28),0 0 18px rgba(251,191,36,.4)}'
    + '.mvraz-key--here::after{content:"";position:absolute;inset:-4px;border-radius:15px;border:1px solid rgba(251,191,36,.5);pointer-events:none}'
    + '.mvraz-pop{position:absolute;left:50%;bottom:calc(100% + 12px);transform:translateX(calc(-50% + var(--az-shift,0px)));'
    + 'min-width:230px;max-width:290px;background:var(--az-pop);border:1px solid var(--az-edge);border-radius:14px;padding:8px;'
    + 'box-shadow:0 18px 44px rgba(0,0,0,.45);opacity:0;visibility:hidden;translate:0 6px;transition:opacity .16s ease,translate .16s ease,visibility .16s;z-index:30;text-align:left}'
    + '.mvraz-pop::after{content:"";position:absolute;left:calc(50% - var(--az-shift,0px));bottom:-5px;width:10px;height:10px;transform:translateX(-50%) rotate(45deg);'
    + 'background:var(--az-pop);border-right:1px solid var(--az-edge);border-bottom:1px solid var(--az-edge)}'
    + '.mvraz-keywrap:hover .mvraz-pop,.mvraz-keywrap:focus-within .mvraz-pop,.mvraz-keywrap.mvraz-open .mvraz-pop{opacity:1;visibility:visible;translate:0 0}'
    + '.mvraz-item{display:block;padding:9px 11px;border-radius:10px;text-decoration:none;transition:background .12s ease}'
    + '.mvraz-item:hover,.mvraz-item:focus-visible{background:rgba(124,140,255,.14);outline:none}'
    + '.mvraz-item b{display:block;font-size:13.5px;font-weight:700;color:var(--az-txt);line-height:1.3}'
    + '.mvraz-item span{display:block;font-size:12px;color:var(--az-mut);line-height:1.45;margin-top:2px}'
    + '.mvraz-item em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--az-acc2);margin-top:4px}'
    + '.mvraz-here-tag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;'
    + 'color:var(--az-gold);border:1px solid rgba(251,191,36,.4);border-radius:999px;padding:2px 8px;margin:4px 11px 2px}'
    + '.mvraz-legend{margin:26px auto 0;font-size:12.5px;color:var(--az-mut)}'
    + '.mvraz-legend b{color:var(--az-txt);font-weight:700}'
    + '.mvraz-cta{display:inline-flex;align-items:center;gap:6px;margin-top:16px;padding:10px 22px;border-radius:999px;'
    + 'background:linear-gradient(100deg,var(--az-acc),var(--az-acc2));color:#fff;font-size:13.5px;font-weight:700;text-decoration:none;'
    + 'box-shadow:0 8px 22px rgba(124,140,255,.35);transition:transform .15s ease,box-shadow .15s ease}'
    + '.mvraz-cta:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(124,140,255,.45)}'
    + '@media (max-width:560px){.mvraz{padding:34px 10px 38px;margin:36px 10px;border-radius:20px}'
    + '.mvraz-board{gap:7px}.mvraz-key{width:44px;height:44px;font-size:16px;border-radius:10px}}';

  /* ----------------------------------------------------------------- build */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function productsFor(key) {
    if (key.p) return key.p;
    if (key.r) return [RESERVED];
    return [DIGIT_PRODUCT]; // digits
  }

  function buildPop(key, isHere) {
    var pop = el('div', 'mvraz-pop');
    pop.setAttribute('role', 'group');
    if (isHere) pop.appendChild(el('span', 'mvraz-here-tag', 'You are here'));
    productsFor(key).forEach(function (p) {
      var a = el('a', 'mvraz-item',
        '<b>' + esc(p.n) + '</b><span>' + esc(p.t) + '</span><em>' + esc(p.d) + '</em>');
      a.href = p.u;
      a.target = '_blank';
      a.rel = 'noopener';
      pop.appendChild(a);
    });
    return pop;
  }

  function render(mount) {
    var here = (mount.getAttribute('data-site') || '').toLowerCase();

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = el('section', 'mvraz');
    root.setAttribute('aria-label', 'MVR IT Services product A to Z');

    root.appendChild(el('span', 'mvraz-eyebrow', 'MVR IT Services LTD &middot; One Company, A Whole Alphabet'));
    root.appendChild(el('h2', 'mvraz-h',
      'From <span class="mvraz-grad">1 to 0</span> and <span class="mvraz-grad">A to Z</span> &mdash; we’ve built it.'));
    root.appendChild(el('p', 'mvraz-sub',
      'Every key below launches a real product built by MVR IT Services LTD &mdash; shops, schools, hospitals, events, tools and more. '
      + 'Press a key. Discover a product. The dimmed keys? They’re waiting for <b>your</b> idea.'));

    var board = el('div', 'mvraz-board');
    board.setAttribute('role', 'list');

    KEYS.forEach(function (key, i) {
      var wrap = el('div', 'mvraz-keywrap');
      wrap.setAttribute('role', 'listitem');
      var prods = productsFor(key);
      var multi = prods.length > 1;
      var isHere = !!key.site && key.site === here;

      var cap;
      if (multi) {
        var heat = prods.length >= 3 ? ' mvraz-key--hot' : ' mvraz-key--warm';
        cap = el('button', 'mvraz-key mvraz-key--multi' + heat, esc(key.k));
        cap.type = 'button';
        cap.setAttribute('aria-haspopup', 'true');
        cap.setAttribute('aria-expanded', 'false');
        cap.setAttribute('aria-label', key.k + ' — ' + prods.map(function (p) { return p.n; }).join(', '));
        cap.appendChild(el('span', 'mvraz-count', '×' + prods.length));
      } else {
        cap = el('a', 'mvraz-key', esc(key.k));
        cap.href = prods[0].u;
        cap.target = '_blank';
        cap.rel = 'noopener';
        cap.setAttribute('aria-label', key.k + ' — ' + prods[0].n + ': ' + prods[0].t);
        cap.title = prods[0].n;
      }
      if (key.r) cap.className += ' mvraz-key--dim';
      if (isHere) {
        cap.className += ' mvraz-key--here';
        cap.appendChild(el('span', 'mvraz-dot'));
      }
      cap.style.setProperty('--az-i', (i * 22) + 'ms');

      wrap.appendChild(cap);
      wrap.appendChild(buildPop(key, isHere));
      board.appendChild(wrap);
    });

    root.appendChild(board);
    root.appendChild(el('p', 'mvraz-legend',
      '<b>10 digits</b> &middot; <b>26 letters</b> &middot; <b>25+ products &amp; platforms</b> &middot; one team behind all of it'));

    var cta = el('a', 'mvraz-cta', 'Explore every product →');
    cta.href = MVR + '/products/';
    cta.target = '_blank';
    cta.rel = 'noopener';
    root.appendChild(cta);

    mount.appendChild(root);

    /* --------------------------------------------------- popover behaviour */
    // Keep popovers inside the band horizontally.
    root.addEventListener('mouseover', clampPop, true);
    root.addEventListener('focusin', clampPop, true);
    function clampPop(ev) {
      var wrap = ev.target && ev.target.closest ? ev.target.closest('.mvraz-keywrap') : null;
      if (!wrap) return;
      var pop = wrap.querySelector('.mvraz-pop');
      if (!pop) return;
      pop.style.setProperty('--az-shift', '0px');
      var r = pop.getBoundingClientRect();
      var pad = 10;
      var shift = 0;
      if (r.left < pad) shift = pad - r.left;
      else if (r.right > window.innerWidth - pad) shift = (window.innerWidth - pad) - r.right;
      if (shift) pop.style.setProperty('--az-shift', shift + 'px');
    }

    // Tap-to-toggle for multi-product keys (touch devices have no hover).
    board.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('button.mvraz-key') : null;
      if (!btn) return;
      var wrap = btn.parentNode;
      var open = wrap.classList.toggle('mvraz-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      board.querySelectorAll('.mvraz-keywrap.mvraz-open').forEach(function (w) {
        if (w !== wrap) {
          w.classList.remove('mvraz-open');
          var b = w.querySelector('button.mvraz-key');
          if (b) b.setAttribute('aria-expanded', 'false');
        }
      });
    });
    document.addEventListener('click', function (ev) {
      if (!root.contains(ev.target)) {
        board.querySelectorAll('.mvraz-keywrap.mvraz-open').forEach(function (w) {
          w.classList.remove('mvraz-open');
          var b = w.querySelector('button.mvraz-key');
          if (b) b.setAttribute('aria-expanded', 'false');
        });
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        board.querySelectorAll('.mvraz-keywrap.mvraz-open').forEach(function (w) {
          w.classList.remove('mvraz-open');
          var b = w.querySelector('button.mvraz-key');
          if (b) b.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  function init() {
    var mount = document.getElementById(MOUNT_ID);
    if (mount && !mount.hasChildNodes()) render(mount);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
