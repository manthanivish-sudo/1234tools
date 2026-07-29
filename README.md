# 1234Tools

1,169+ free calculators and converters — finance, mathematics, engineering, health and everyday work. Static HTML/CSS/JS, no build step, no framework. Every tool runs entirely client-side: nothing typed into a tool is ever sent to a server.

Live at **https://www.1234tools.com** (GitHub Pages, `main` branch, root).

Built and maintained by [MVR IT Services LTD](https://www.mvritservices.com/).

## Structure

| URL | File |
|---|---|
| `/` | `index.html` — all tools, browsable by category |
| `/<category>/` | `<category>/index.html`, e.g. `/finance/` |
| `/<category>/<tool>.html` | an individual calculator/converter |
| `/about/` `/contact/` `/privacy/` `/terms/` `/cookies/` | site pages |
| any bad URL | `404.html` |

Shared assets live in `assets/` (CSS design system, JS behaviour, SVG icon sprite, logo, PWA icons). Calculator logic lives in `engine/*.js`, one file per tool.

## PWA / offline

- `manifest.webmanifest` — installable app manifest.
- `sw.js` — service worker: precaches the shell, caches tool pages as visited (network-first), so tools keep working offline once opened. **Bump the `V` version string in `sw.js` on every deploy** so returning visitors' caches refresh.

## Contact form

`contact/index.html` posts to FormSubmit.co (free, no account) → `contact@xleshop.com`. The first submission triggers a one-time confirmation email — click the link in it once and all future submissions deliver normally. Swap the address in the form's `action` attribute if you set up a dedicated inbox for the domain.

## Design system

Dark-first theme (light/system also available), gold gradient accents, Sora (headings) + Inter (body) via Google Fonts. All colours are CSS variables in `assets/app.css` `:root`. Every tool page shares the same header, category sidebar and footer.

## Deploying

Push to `main` — GitHub Pages publishes automatically. Domain: `CNAME` file (`www.1234tools.com`) + registrar DNS pointing at GitHub Pages; HTTPS enforced once GitHub issues the certificate.

## Legal pages

Privacy Policy, Terms of Service and Cookie Policy are solid boilerplate for a client-side, no-account tool site — have a solicitor review before relying on them for anything contentious.
