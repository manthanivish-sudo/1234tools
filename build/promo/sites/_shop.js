'use strict';
/**
 * Shared rules for the shops that run on XLeShop (sites/<shop>.js). Not a profile:
 * site.js loads only files named [a-z0-9-]+.js, so this helper (leading "_") is skipped.
 *
 *   TARGETS            the shop calendar: WhatsApp Status, Instagram Reel, a native Facebook
 *                      Page post (no link: preset "no link", so it spends no link budget) and
 *                      an Instagram feed post. Three slots a week (calendar.js SITE_WEEK).
 *   PICKER_GROUP       the heading the site picker files every shop under
 *   rules(opts)        a profile's `rules`: the common shop rules, the health-claim rules for
 *                      food, dairy, grocery and Ayurveda shops, the disease rules for Ayurveda,
 *                      the "pure" rules for dairy, then the shop's own `forbid`.
 *
 * opts: {
 *   type:          'food' | 'grocery' | 'dairy' | 'ayurveda' | 'fashion'
 *   market:        'india' | 'uk'
 *   pureEvidence:  dairy only: { pure|'100% pure'|'chemical-free'|'preservative-free'|'no-adulteration'|a2: 'file: what the page says' }.
 *                  A word the shop's own page uses becomes a warning ("owner to confirm"), never silently allowed;
 *                  any other stays an error.
 *   allow:         ids of common rules to drop because the shop's own page states the thing (say why in notes)
 *   free, freePhrases, allowClaims, forbid, notes: as in any profile (site.js)
 * }
 *
 * Sources for the health and disease rules (read 2026-10-05):
 *   SOURCES below; each rule names the one it rests on.
 */

const TARGETS = ['whatsapp-status', 'instagram-reel', { channel: 'facebook-post', native: true }, 'instagram-carousel'];
const PICKER_GROUP = 'XLeShop shops';

const SOURCES = {
  /* India. Section 3: no advertisement referring to a drug "in terms which suggests or are calculated to lead
     the use of that drug for" (a) miscarriage or preventing conception, (b) "the maintenance or improvement of
     the capacity of human beings for sexual pleasure", (c) "the correction of menstrual disorders in women",
     (d) "the diagnosis, cure, mitigation, treatment or prevention of any disease, disorder or condition specified
     in the schedule" (clause (d) substituted by Act 42 of 1963). Section 4: no false or misleading drug claims.
     The India Code PDF answered 403 to a script on 2026-10-05; the text was read from the Tamil Nadu Drugs
     Control Department's copy of the Act and Rules the same day. */
  dmr: 'Drugs and Magic Remedies (Objectionable Advertisements) Act, 1954 (Act 21 of 1954), ss. 3-4: https://www.indiacode.nic.in/bitstream/123456789/1412/1/195421.pdf; text read 2026-10-05 from https://drugscontrol.tn.gov.in/pages/application_forms/dmr_drug_objectional_advertisement_act.pdf',
  /* THE SCHEDULE [See Secs.3(d) and 14], 54 entries: appendicitis, arteriosclerosis, blindness, blood poisoning,
     Bright's disease, cancer, cataract, deafness, diabetes, diseases and disorders of the brain / of the optical
     system / of the uterus, disorders of menstrual flow / of the nervous system / of the prostatic gland, dropsy,
     epilepsy, female diseases in general, fevers in general, fits, form and structure of the female bust, gall,
     kidney and bladder stones, gangrene, glaucoma, goitre, heart diseases, high or low blood pressure, hydrocele,
     hysteria, infantile paralysis, insanity, leprosy, leucoderma, lockjaw, locomotor ataxia, lupus, nervous
     debility, obesity, paralysis, plague, pleurisy, pneumonia, rheumatism, ruptures, sexual impotence, small pox,
     stature of persons, sterility in women, trachoma, tuberculosis, tumors, typhoid fever, ulcers of the
     gastro-intestinal tract, venereal diseases. */
  dmrSchedule: 'Same Act, THE SCHEDULE (54 diseases, disorders and conditions), read 2026-10-05 (source as above)',
  /* UK. 15.1.1 "Only health claims listed as authorised in the applicable register ... may be used"; 15.2 general
     health benefits only with an authorised claim; 15.6.2 not acceptable: "Claims that state or imply a food
     prevents, treats or cures human disease". */
  capFood: 'CAP Code (UK non-broadcast) section 15 Food, food supplements and associated health or nutrition claims, rules 15.1, 15.1.1, 15.2, 15.6.2: https://www.asa.org.uk/type/non_broadcast/code_section/15.html, read 2026-10-05',
  /* 12.1 medicinal claims only for a licensed medicine; 12.2 "must not discourage essential treatment for
     conditions for which medical supervision should be sought"; 12.6 "should not falsely claim that a product is
     able to prevent or treat disease"; 12.7 "Unqualified claims such as 'cure' and 'rejuvenation' are not
     generally acceptable"; 12.9 proof before "without side-effects"; 12.10 not safe or effective merely because
     "natural". */
  capMedicines: 'CAP Code (UK non-broadcast) section 12 Medicines, medical devices, health-related products and beauty products, rules 12.1, 12.2, 12.6, 12.7, 12.9, 12.10: https://www.asa.org.uk/type/non_broadcast/code_section/12.html, read 2026-10-05',
  /* India, foods. Reg 10(1): "no claims shall be made which refer to the suitability of the food for use in the
     prevention, alleviation, treatment or cure of a disease, disorder or particular physiological condition";
     10(2) no "recommended by the medical or nutrition or health professionals"; 8(3) foods "shall not be described
     as 'healthy'"; 9(2) "natural", "fresh", "pure", "traditional", "authentic"... only under Schedule V, and
     "home-made", "home cooked" etc. "shall not be used"; Schedule V: "pure" only for a single-ingredient food to
     which nothing has been added, never in a brand or fancy name to imply it; "fresh" only for food not processed
     beyond washing, peeling, chilling, trimming or cutting (not if processing extends shelf life); "natural
     goodness", "naturally better", "nature's way" shall not be used. */
  fssaiClaims: 'Food Safety and Standards (Advertising and Claims) Regulations, 2018 (FSSAI compendium, version III, 04.10.2022), regs 8(3), 9(2), 10(1)-(2) and Schedule V: https://www.fssai.gov.in/upload/uploadfiles/files/Compendium_Advertising_Claims_Regulations_04_10_2022.pdf, read 2026-10-05'
};

/* ------------------------------------------------------------ every shop */
const COMMON = [
  { rule: 'shop-prices', re: '[₹£$€]\\s?\\d|\\b(rs\\.?|inr|gbp)\\s?\\d|\\b\\d[\\d,.]*\\s?(rupees|pounds|/-)', msg: 'No prices in promotion copy: prices change in the shop and copy outlives them. Send people to the shop to see today\'s price.' },
  { rule: 'shop-offers', re: '\\b\\d+\\s?% off\\b|\\bdiscount(s|ed)?\\b|\\bon sale\\b|\\bsale (price|now|ends|starts)\\b|\\b(special|festive|launch|introductory|exclusive|great|big|best) offers?\\b|\\boffer (price|ends|valid)\\b|\\bdeals?\\b|\\bcashback\\b|\\bcoupons?\\b|\\bpromo ?codes?\\b|\\bbuy (one|1|two|2) get\\b|\\bbogo\\b|\\bfree gifts?\\b', msg: 'No offers, discounts or codes unless the owner confirms one is running: the shop\'s pages show none that the desk can rely on.' },
  { rule: 'shop-delivery-promise', re: '\\bsame[- ]day\\b|\\bnext[- ]day\\b|\\bwithin \\d+ ?(minutes|mins|hours|hrs|days)\\b|\\bin (under )?\\d+ ?(minutes|mins|hours|hrs)\\b|\\b\\d+[- ]min(ute)?s? delivery\\b|\\b(express|instant|superfast|lightning) delivery\\b|\\bguaranteed delivery\\b|\\bdelivered (today|tonight|tomorrow)\\b|\\bon time,? every time\\b|\\bdeliver(s|y)? (everywhere|anywhere|across india|all over|nationwide|pan[- ]india)\\b', msg: 'No delivery times or areas beyond what the shop\'s own pages state (the profile lists them).' },
  { rule: 'shop-reviews', re: '\\brated\\b|\\bratings?\\b|\\breviews?\\b|\\b\\d(\\.\\d)? ?(stars?|★)|\\bcustomers? (love|say|rave)\\b|\\bbest[- ]?sell(er|ers|ing)\\b|\\bmost popular\\b|\\bfamous\\b|\\bfavourite of\\b|\\bno\\.? ?1\\b', msg: 'No reviews, ratings, "bestseller" or "famous": none can be shown to be the shop\'s customers\' own words.' },
  { rule: 'shop-certified', re: '\\borganic\\b|\\bcertified\\b|\\bcertificat(e|ion)\\b|\\b(fssai|government|govt|ayush|iso)[- ]?(approved|certified|licensed|registered)\\b|\\bagmark\\b|\\bgmp\\b|\\blab[- ]tested\\b|\\bclinically\\b|\\bscientifically (proven|tested)\\b|\\bdoctor[- ]?(recommended|approved)\\b', msg: 'No organic, certification, testing or approval claims unless the owner shows the certificate.' },
  { rule: 'shop-guarantee', re: '\\bguarantee(d|s)?\\b|\\bmoney[- ]back\\b|\\bno questions asked\\b|\\brisk[- ]free\\b', msg: 'No guarantees: refunds follow the shop\'s refund page, nothing more.' }
];

/* ------------------------------------------- food, grocery, dairy, Ayurveda */
/* A food may not be advertised as preventing, treating or curing a disease, and a
   health claim needs authorisation or substantiation (SOURCES.capFood, SOURCES.fssaiClaims);
   a medicinal claim needs a licensed medicine (SOURCES.capMedicines). The copy here is
   about the shop's products, so none of these words belong in it. "Natural Cure" in the
   Natural Cure Ayurveda name is the shop's name, not a claim, and is not matched. */
const CONDITIONS = 'diseases?|illness(es)?|ailments?|conditions?|disorders?|infections?|symptoms?|pain|aches?|colds?|coughs?|fevers?|flu|diabetes|sugar levels?|blood sugar|cholesterol|blood pressure|bp|arthritis|joint pain|acidity|gas|constipation|indigestion|piles|ulcers?|asthma|allergies|anaemia|anemia|thyroid|pcos|pcod|obesity|cancer|heart disease|kidney stones?|stones?|insomnia|stress|anxiety|depression|skin problems?|acne|hair ?fall|hair loss|dandruff|migraines?|headaches?';
const HEALTH = [
  { rule: 'health-cure', re: '(?<!natural\\s)\\bcur(e|es|ed|ing|ative)\\b|\\bheal(s|ed|ing|er)?\\b|\\b(helps?|to|that|which|it|can|may|will|they) (treat|prevent|fight|reverse)\\b|\\btreat(s|ed|ing)? (\\w+ ){0,3}(' + CONDITIONS + ')\\b|\\btreatments?\\b|\\bprevents?\\b|\\bfights? (off )?(\\w+ ){0,2}(' + CONDITIONS + ')\\b', msg: 'No claim that a product cures, heals, treats or prevents anything (SOURCES in sites/_shop.js: CAP Code 15 for food, CAP Code 12 for medicines, the FSSAI claims regulations, and the Drugs and Magic Remedies Act 1954 in India).' },
  { rule: 'health-immunity', re: '\\b(boost|build|strengthen|improve|increase|enhance|support)(s|es|ed|ing)? (\\w+ )?(immunity|immune system|immune health)\\b|\\bimmunity[- ]?(boost(er|ers|ing)?|builder|support)\\b|\\bimmune[- ]boost', msg: 'No immunity claims: "boosts immunity" is a health claim a shop cannot make for a food (CAP Code 15; FSSAI claims regulations).' },
  { rule: 'health-medicine', re: '\\bmedicin(e|es|al) (for|to|against)\\b|\\bremed(y|ies) (for|to|against)\\b|\\bmedicinal (value|properties|benefits?)\\b|\\bnatural (medicine|remedy|antibiotic)\\b|\\bcure for\\b', msg: 'No "medicine for…" or "remedy for…": that presents a product as a medicine (CAP Code 12; Drugs and Magic Remedies Act 1954).' },
  { rule: 'health-body', re: '\\b(lowers?|reduces?|controls?|regulates?|balances?|manages?|normali[sz]es?) (your )?(' + CONDITIONS + '|weight|sugar|hormones?|metabolism)\\b|\\bweight[- ]loss\\b|\\blose weight\\b|\\bburns? fat\\b|\\bdetox(ify|ifies|ifying|es)?\\b|\\bcleanses? (your|the) (body|blood|liver|gut)\\b|\\bpurif(y|ies) (your|the) blood\\b|\\bdiabetic[- ]friendly\\b|\\bsafe for diabetics\\b|\\bgood for (your )?(health|heart|digestion|gut|immunity|bones|skin|hair|liver|kidneys?|joints|eyes|brain|memory|diabetics?)\\b|\\bhealth benefits?\\b|\\bhealthier\\b|\\bno side[- ]?effects?\\b|\\bside[- ]effect[- ]free\\b|\\bsuperfood\\b|\\bnutritionist\\b|\\bwellness\\b|\\bmiracle\\b|\\bmagic(al)? (cure|remedy|results?)\\b|\\bhealthy\\b|\\bwholesome\\b', msg: 'No health or body-function claims ("healthy", "lowers sugar", "good for digestion", "no side effects"): they need authorisation or evidence the shop does not show (CAP Code 12.9, 15.1.1, 15.2; FSSAI claims regulations 8(3), 10(1)).' },
  { rule: 'health-nutrition', re: '\\bnutritious\\b|\\bnutrient[- ](rich|dense|packed)\\b|\\b(rich|high|loaded|packed) (in|with) (protein|calcium|vitamins?|fib(re|er)|iron|nutrients|minerals|antioxidants|omega)\\b|\\b(high|low)[- ](protein|fat|sugar|calorie|carb)\\b|\\bprotein[- ](rich|packed)\\b|\\b(source|full) of (protein|calcium|vitamins?|fib(re|er)|iron|nutrients|antioxidants)\\b|\\bantioxidants?\\b|\\bprobiotics?\\b|\\bgut[- ]friendly\\b', msg: 'No nutrition claims ("rich in protein", "nutritious", "probiotic"): only claims on the authorised register, with evidence, may be made (CAP Code 15.1, 15.1.1; FSSAI claims regulations).' }
];

/* India, foods (FSSAI claims regulations, SOURCES.fssaiClaims): "home-made" and "natural goodness" are never
   allowed; "fresh", "natural", "traditional", "authentic" and "genuine" only under Schedule V's conditions,
   which the desk cannot check, so they are shown as "owner to confirm". Not applied to the Ayurveda shop
   (its products are not foods), and the shop name "Natural Cure Ayurveda" is never matched. */
const FSSAI = [
  { rule: 'fssai-home-made', re: '\\bhome[- ]?made\\b|\\bhome[- ]cooked\\b|\\bhome[- ]style\\b|\\bmade at home\\b|\\bhome kitchen\\b', msg: 'FSSAI Advertising and Claims Regulations 2018, reg 9(2): "home-made", "home cooked" and the like "shall not be used". Describe how it is made only in the shop\'s own factual words (name, ingredients, pack).' },
  { rule: 'fssai-natural-goodness', re: '\\bnatural goodness\\b|\\bnaturally better\\b|\\bnature\'?s (way|best|goodness)\\b|\\bgoodness of nature\\b', msg: 'FSSAI Advertising and Claims Regulations 2018, Schedule V: "natural goodness", "naturally better", "nature\'s way" shall not be used.' },
  { rule: 'fssai-descriptors', level: 'warn', re: '\\bfresh(ly)?\\b|\\b(all[- ])?natural(ly)?\\b(?! cure ayurveda)|\\btraditional(ly)?\\b|\\bauthentic\\b|\\bgenuine\\b', msg: 'Owner to confirm: FSSAI reg 9(2) and Schedule V allow "fresh", "natural", "traditional", "authentic" and "genuine" only on conditions (e.g. "fresh" only for food not processed beyond washing, chilling or cutting, and not if processing extends its shelf life). Keep the word only if the product meets them.' }
];

/* --------------------------------------------------------------- Ayurveda */
/* The Drugs and Magic Remedies (Objectionable Advertisements) Act 1954 (SOURCES.dmr)
   forbids advertising a remedy for the diseases in its Schedule (SOURCES.dmrSchedule)
   and for the purposes in section 3 (miscarriage or contraception, sexual capacity,
   menstrual disorders); CAP Code 12 (SOURCES.capMedicines) bars discouraging essential
   treatment and medicinal claims for unlicensed products in the UK. The desk does not
   decide which mention is an advertisement: for an Ayurveda shop, every named disease
   and every section 3 purpose is blocked outright, and so is "treat" in any form. */
const SCHEDULE = 'aids|angina|appendicitis|arterio-?sclerosis|blindness|blood poisoning|bright\'?s disease|cancer|cataract|deafness|diabetes|diabetic|brain|optical|uterus|uterine|menstrua(l|tion)|nervous (system|debility)|prostat(e|ic)|dropsy|epilepsy|female diseases?|fevers?|fits|bust|breast (size|enlargement)|gall ?stones?|kidney stones?|bladder stones?|gangrene|glaucoma|goitre|goiter|heart (disease|attack|problems?)|blood pressure|hypertension|hydrocele|hysteria|paralysis|polio|insanity|leprosy|leucoderma|vitiligo|lockjaw|tetanus|locomotor ataxia|lupus|obesity|plague|pleurisy|pneumonia|rheumatism|rheumatoid|ruptures?|hernia|impotence|erectile|stature|height (increase|gain|growth)|grow taller|sterility|infertility|fertility|trachoma|tuberculosis|\\btb\\b|tumou?rs?|typhoid|ulcers?|venereal|sexually transmitted|syphilis|gonorrh?o?ea|small ?pox|insanity|fits|convulsions?|infantile|appendicitis|covid|coronavirus|asthma|arthritis|thyroid|pcos|pcod|piles|haemorrhoids|hemorrhoids|psoriasis|eczema|cholesterol|liver disease|jaundice|hepatitis|kidney disease|dengue|malaria';
const AYURVEDA = [
  { rule: 'ayurveda-disease', re: '\\b(' + SCHEDULE + ')\\b', msg: 'No disease named in Ayurveda copy: the Drugs and Magic Remedies Act 1954 Schedule forbids advertising remedies for these, and CAP Code 12 forbids such claims in the UK. Describe the product (its name, form, pack), never a condition.' },
  { rule: 'ayurveda-section3', re: '\\baphrodisiac\\b|\\blibido\\b|\\bvirility\\b|\\bvigou?r\\b|\\bsexual\\b|\\bsex (power|drive|life)\\b|\\bstamina\\b|\\bperformance\\b|\\bmen\'?s (health|power|wellness)\\b|\\bwomen\'?s (health|wellness)\\b|\\bperiods?\\b|\\bconception\\b|\\bcontracept|\\bmiscarriage\\b|\\bpregnan', msg: 'Drugs and Magic Remedies Act 1954, section 3: no copy about sexual capacity, conception, miscarriage or menstrual disorders.' },
  { rule: 'ayurveda-treat', re: '\\btreat(s|ed|ing|ment|ments)?\\b|\\btherap(y|ies|eutic)\\b|\\bremed(y|ies)\\b|\\bprescri(be|bed|ption)\\b|\\bdosage\\b|\\bdoses?\\b|\\bpatients?\\b|\\bsymptoms?\\b|\\brelie(f|ve|ves)\\b|\\brejuvenat', msg: 'No treatment language for an Ayurveda shop ("treats", "therapy", "remedy", "relief", "dosage"): it turns a product post into a medicinal claim (Drugs and Magic Remedies Act 1954; CAP Code 12).' }
];

/* ------------------------------------------------------------------ dairy */
const PURE = {
  '100% pure': '\\b100\\s*%\\s*(pure|natural|fresh|organic)\\b',
  pure: '\\bpure\\b|\\bpurity\\b',
  'chemical-free': '\\bchemical[- ]free\\b|\\bno chemicals\\b|\\bwithout chemicals\\b',
  'preservative-free': '\\bpreservative[- ]free\\b|\\bno preservatives\\b|\\bwithout preservatives\\b|\\bno additives\\b',
  'no-adulteration': '\\bunadulterated\\b|\\badulteration[- ]free\\b|\\bno adulteration\\b|\\bzero adulteration\\b|\\bno (water|mixing)\\b',
  a2: '\\ba2\\b'
};

/* Who is speaking: the desk's owner builds and hosts these shops on XLeShop but does not
   run them, so "I run <shop>" would be untrue. site-templates.js uses these two lines
   wherever a template discloses ownership or signs an email. */
function disclosure(name) {
  return { line: 'Disclosure: I build and host the ' + name + ' online shop on XLeShop.', email: 'I build and host the ' + name + ' online shop on XLeShop; happy to answer questions.' };
}

function rules(o) {
  o = o || {};
  const allow = new Set(o.allow || []);
  const forbid = COMMON.filter((r) => !allow.has(r.rule)).slice();
  if (o.type && o.type !== 'fashion') forbid.push(...HEALTH.filter((r) => !allow.has(r.rule)));
  if (o.type === 'ayurveda') forbid.push(...AYURVEDA);
  if (o.market === 'india' && ['food', 'grocery', 'dairy'].includes(o.type)) forbid.push(...FSSAI.filter((r) => !allow.has(r.rule)));
  if (o.type === 'dairy' || o.dairy) {
    const ev = o.pureEvidence || {};
    for (const [k, re] of Object.entries(PURE)) {
      /* FSSAI Schedule V: "pure" only for a single-ingredient food with nothing added, and never in a brand
         or fancy name to imply it; CAP 15.1 (UK): claims need documentary evidence */
      const why = ' (FSSAI claims regulations Schedule V; CAP Code 15.1)';
      if (ev[k] && k !== '100% pure') forbid.push({ rule: 'dairy-' + k.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(), re, level: 'warn', msg: 'Owner to confirm: the shop\'s own page says it (' + ev[k] + '), but the desk cannot check it. Keep it only if the owner can evidence it' + why + '.' });
      else forbid.push({ rule: 'dairy-' + k.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(), re, msg: (k === '100% pure' ? 'Never "100% pure": no shop can evidence an absolute' : 'No "' + k + '" claim: the shop\'s own pages do not state it') + why + '.' });
    }
  }
  forbid.push(...(o.forbid || []));
  return {
    free: !!o.free,
    freePhrases: o.freePhrases || [],
    browserClaims: false,
    allowClaims: o.allowClaims || [],
    forbid,
    notes: (o.notes || []).concat([
      'A shop on XLeShop: promote what its own pages show (categories, named products, delivery area and terms, payment options, hours). Never prices, offers, reviews, health claims or delivery promises the pages do not make.',
      'Calendar: three slots a week to WhatsApp Status, an Instagram Reel, a native Facebook Page post (no link) and an Instagram feed post.'
    ])
  };
}

module.exports = { TARGETS, PICKER_GROUP, SOURCES, COMMON, HEALTH, FSSAI, AYURVEDA, PURE, CONDITIONS, SCHEDULE, rules, disclosure };
