/*
 * The passport, visa and ID photo sizes the Passport Photo Maker offers.
 *
 * Each entry: id, name, w and h (the print size in mm), head ([min, max] mm
 * from chin to crown, where the issuer publishes it; otherwise null and the
 * page uses ICAO 9303's 70–80% of the height, and says so), eyes ([min, max]
 * mm from the bottom edge, only where published), bg (the background the
 * issuer asks for) and source (the issuer's own page the figures come from).
 *
 * Compiled 6 October 2026. The sizes marked "searched" were re-read from the
 * issuer's page that day; the rest are the issuers' long-standing published
 * figures and should be spot-checked against the source before each release.
 */
window.MVRPassportPresets = [
  /* India */
  { id: 'in-2x2', name: 'India visa / OCI / passport abroad (2×2 in)', w: 51, h: 51, head: [25.4, 34.9], eyes: null, bg: 'plain white or off-white', source: 'https://indianvisaonline.gov.in/evisa/images/Photo_Spec_FINAL.pdf' },
  { id: 'in-passport', name: 'India passport (Passport Seva, 4.5×3.5 cm)', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://www.passportindia.gov.in/AppOnlineProject/pdf/ApplicantInstructionsBooklet.pdf' },
  { id: 'in-pan', name: 'India PAN card', w: 25, h: 35, head: null, eyes: null, bg: 'plain white', source: 'https://www.protean-tinpan.com/services/pan/pan-index.html' },
  /* United States */
  { id: 'us-passport', name: 'US passport', w: 50.8, h: 50.8, head: [25.4, 34.9], eyes: [28.6, 34.9], bg: 'plain white or off-white', source: 'https://travel.state.gov/content/travel/en/passports/how-apply/photos.html' },
  { id: 'us-visa', name: 'US visa', w: 50.8, h: 50.8, head: [25.4, 34.9], eyes: [28.6, 34.9], bg: 'plain white or off-white', source: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html' },
  { id: 'us-green-card', name: 'US green card / immigrant visa', w: 50.8, h: 50.8, head: [25.4, 34.9], eyes: [28.6, 34.9], bg: 'plain white or off-white', source: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html' },
  /* United Kingdom and Ireland */
  { id: 'uk-passport', name: 'UK passport', w: 35, h: 45, head: [29, 34], eyes: null, bg: 'plain cream or light grey', source: 'https://www.gov.uk/photos-for-passports' },
  { id: 'ie-passport', name: 'Ireland passport', w: 35, h: 45, head: null, eyes: null, bg: 'plain white or light grey', source: 'https://www.ireland.ie/en/dfa/passports/passport-photo-guidelines/' },
  /* Europe */
  { id: 'schengen', name: 'Schengen visa', w: 35, h: 45, head: [32, 36], eyes: null, bg: 'plain light (white or light grey)', source: 'https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy/applying-schengen-visa_en' },
  { id: 'de-passport', name: 'Germany passport / ID card', w: 35, h: 45, head: [32, 36], eyes: null, bg: 'plain light grey or neutral', source: 'https://www.personalausweisportal.de/Webs/PA/DE/buergerinnen-und-buerger/der-personalausweis/fotomustertafel/fotomustertafel-node.html' },
  { id: 'fr-passport', name: 'France passport / ID card', w: 35, h: 45, head: [32, 36], eyes: null, bg: 'plain light (not white)', source: 'https://www.service-public.fr/particuliers/vosdroits/F10619' },
  { id: 'it-passport', name: 'Italy passport', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://www.poliziadistato.it/articolo/passaporto' },
  { id: 'es-passport', name: 'Spain passport / DNI (32×26 mm)', w: 26, h: 32, head: null, eyes: null, bg: 'plain white', source: 'https://www.dnielectronico.es/PortalDNIe/PRF1_Cons02.action?pag=REF_038' },
  { id: 'nl-passport', name: 'Netherlands passport / ID card', w: 35, h: 45, head: [26, 30], eyes: null, bg: 'plain light grey, light blue or white', source: 'https://www.government.nl/topics/identification-documents/requirements-for-photos' /* searched */ },
  { id: 'be-passport', name: 'Belgium passport / eID', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://diplomatie.belgium.be/en/services/services_abroad/passport/photo' },
  { id: 'pl-passport', name: 'Poland passport / ID card', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://www.gov.pl/web/gov/zdjecie-do-dowodu-lub-paszportu' },
  { id: 'at-passport', name: 'Austria passport', w: 35, h: 45, head: null, eyes: null, bg: 'plain light', source: 'https://www.oesterreich.gv.at/themen/dokumente_und_recht/reisepass/Seite.020100.html' },
  { id: 'ch-passport', name: 'Switzerland passport / ID card', w: 35, h: 45, head: null, eyes: null, bg: 'plain light', source: 'https://www.schweizerpass.admin.ch/pass/en/home/ausweise/passfoto.html' },
  { id: 'se-passport', name: 'Sweden passport', w: 35, h: 45, head: null, eyes: null, bg: 'plain light', source: 'https://www.migrationsverket.se/' },
  { id: 'ru-passport', name: 'Russia passport', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://www.gosuslugi.ru/' },
  { id: 'tr-passport', name: 'Turkey passport / visa (50×60 mm)', w: 50, h: 60, head: null, eyes: null, bg: 'plain white', source: 'https://losangeles-cg.mfa.gov.tr/Mission/ShowInfoNote/411309' /* searched */ },
  /* The Americas */
  { id: 'ca-passport', name: 'Canada passport (50×70 mm)', w: 50, h: 70, head: [31, 36], eyes: null, bg: 'plain white or light-coloured', source: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html' /* searched */ },
  { id: 'ca-visa', name: 'Canada visa / PR card', w: 35, h: 45, head: [31, 36], eyes: null, bg: 'plain white or light-coloured', source: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/temporary-resident-visa-application-photograph-specifications.html' },
  { id: 'br-passport', name: 'Brazil passport (5×7 cm)', w: 50, h: 70, head: null, eyes: null, bg: 'plain white', source: 'https://www.gov.br/pf/pt-br/assuntos/passaporte' /* searched */ },
  /* Asia and the Pacific */
  { id: 'au-passport', name: 'Australia passport', w: 35, h: 45, head: [32, 36], eyes: null, bg: 'plain white or light', source: 'https://www.passports.gov.au/passport-photos' /* searched: 35–40 × 45–50 mm */ },
  { id: 'au-visa', name: 'Australia visa', w: 35, h: 45, head: [32, 36], eyes: null, bg: 'plain light', source: 'https://immi.homeaffairs.gov.au/help-support/applying-online-or-on-paper/on-paper/photographs' },
  { id: 'nz-passport', name: 'New Zealand passport', w: 35, h: 45, head: [32, 36], eyes: null, bg: 'plain light grey or white', source: 'https://www.passports.govt.nz/passport-photos/' },
  { id: 'cn-passport', name: 'China passport (33×48 mm)', w: 33, h: 48, head: [28, 33], eyes: null, bg: 'plain white', source: 'http://cs.mfa.gov.cn/' },
  { id: 'cn-visa', name: 'China visa (33×48 mm)', w: 33, h: 48, head: [28, 33], eyes: null, bg: 'plain white', source: 'https://visaforchina.cn/SGP2_EN/generalinformation/news/282849.shtml' /* searched */ },
  { id: 'hk-passport', name: 'Hong Kong passport / travel documents (40×50 mm)', w: 40, h: 50, head: [32, 36], eyes: null, bg: 'plain white', source: 'https://www.immd.gov.hk/eng/residents/immigration/traveldoc/photorequirements.html' /* searched */ },
  { id: 'jp-passport', name: 'Japan passport', w: 35, h: 45, head: [32, 36], eyes: null, bg: 'plain light', source: 'https://www.mofa.go.jp/mofaj/toko/passport/ic_photo.html' /* searched: 34 ± 2 mm */ },
  { id: 'kr-passport', name: 'South Korea passport', w: 35, h: 45, head: [32, 36], eyes: null, bg: 'plain white', source: 'https://www.passport.go.kr/' },
  { id: 'sg-passport', name: 'Singapore passport / IC', w: 35, h: 45, head: [25, 35], eyes: null, bg: 'plain white', source: 'https://www.ica.gov.sg/photo-guidelines' /* searched */ },
  { id: 'my-passport', name: 'Malaysia passport (35×50 mm)', w: 35, h: 50, head: null, eyes: null, bg: 'plain white', source: 'https://www.imi.gov.my/' /* searched */ },
  { id: 'ph-passport', name: 'Philippines passport (4.5×3.5 cm)', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://vancouverpcg.dfa.gov.ph/9-main-menus/496-requirements-for-travel-documents' /* searched */ },
  { id: 'vn-passport', name: 'Vietnam passport (4×6 cm)', w: 40, h: 60, head: null, eyes: null, bg: 'plain white', source: 'https://xuatnhapcanh.gov.vn/' /* searched */ },
  { id: 'pk-passport', name: 'Pakistan passport / visa', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://dgip.gov.pk/' },
  { id: 'lk-passport', name: 'Sri Lanka passport', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://www.immigration.gov.lk/' },
  { id: 'np-passport', name: 'Nepal passport', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://nepalpassport.gov.np/' },
  /* Africa */
  { id: 'za-passport', name: 'South Africa passport / ID', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'http://www.dha.gov.za/' },
  { id: 'ng-passport', name: 'Nigeria passport', w: 35, h: 45, head: null, eyes: null, bg: 'plain white', source: 'https://immigration.gov.ng/' },
  /* Not one issuer's */
  { id: 'icao', name: 'Other: ICAO standard 35×45 mm', w: 35, h: 45, head: [32, 36], eyes: null, bg: 'plain and light', source: 'https://www.icao.int/publications/Documents/9303_p3_cons_en.pdf' },
  { id: 'stamp', name: 'Other: stamp size 20×25 mm (no issuer)', w: 20, h: 25, head: null, eyes: null, bg: 'plain and light', source: null }
];
