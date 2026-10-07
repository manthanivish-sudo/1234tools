/**
 * Run any browser suite as a phone: a preload, not a suite.
 *
 *   node -r ./build/tests/mobile.js build/tests/claims.js --root <site> --port 9116 --only image
 *
 * Every page the suite opens gets a 390 x 844 viewport at DPR 3 with touch
 * (isMobile, hasTouch) whatever width the suite asks for, so the same checks
 * run against the phone layout without editing the suite. MOBILE_WIDTH
 * overrides 390. A suite that drags with page.mouse still sends mouse
 * pointer events; the touch drags are covered by build/tests/sitewide.js and
 * the suites that use page.touchscreen.
 */
'use strict';
const W = Number(process.env.MOBILE_WIDTH || 390);
let puppeteer;
for (const p of ['puppeteer-core']) { try { puppeteer = require(p); } catch (e) { /* next */ } }
if (!puppeteer || !puppeteer.CdpPage) {
  console.error('mobile.js: puppeteer-core with CdpPage not found; the suite runs at its own width');
} else {
  const set = puppeteer.CdpPage.prototype.setViewport;
  puppeteer.CdpPage.prototype.setViewport = function (vp) {
    return set.call(this, Object.assign({}, vp, { width: W, height: Math.max(700, Math.round(W * 2.16)), deviceScaleFactor: 3, isMobile: true, hasTouch: true }));
  };
  const newPage = puppeteer.CdpBrowserContext && puppeteer.CdpBrowserContext.prototype.newPage;
  if (newPage) {
    puppeteer.CdpBrowserContext.prototype.newPage = async function () {
      const page = await newPage.apply(this, arguments);
      await page.setViewport({ width: W, height: 844 });
      return page;
    };
  }
  console.log('mobile.js: pages run at ' + W + ' px, DPR 3, touch');
}
