(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["currency-converter"] = {
"currencyLocked": true,
"currencyNote": "rates between two currencies you pick on the page itself",
"currency": "GBP",
"title": "Currency Converter",
"category": "business",
"kind": "live",
"description": "Convert between 150+ world currencies using daily reference rates. Rates are cached so it keeps working offline.",
"keywords": ["currency converter","exchange rate","GBP to USD","EUR to GBP","live exchange rates","foreign exchange"],
"tips": ["These are daily mid-market reference rates. They are not dealing rates — a bank or card provider will add a spread, typically 0.5% to 4%.","For UK VAT and customs, HMRC publishes its own monthly exchange rates that you are expected to use. For statutory accounts, your accounting policy dictates which rate applies.","Rates are cached in your browser, so the converter still works offline using the last figures it fetched. The date fetched is always shown.","For contracts or invoices, record the rate and the date you used. \"The rate on the day\" is ambiguous once anyone queries it."],
"faq": [{"q":"How current are these rates?","a":"They come from a daily-updated reference feed, refreshed once every 24 hours. They are suitable for quotes, estimates and bookkeeping, but not for trading or hedging decisions, which need live intraday pricing."},{"q":"Which rate should I use for an invoice?","a":"It depends on your jurisdiction and accounting policy. UK businesses reporting VAT on foreign-currency invoices are generally expected to use HMRC’s published monthly rate, the European Central Bank rate, or the rate from their own bank — applied consistently. Check with your accountant before choosing."},{"q":"Why does my bank give me a worse rate?","a":"The mid-market rate is the midpoint between buy and sell prices in the interbank market. No retail provider offers it. The difference between the mid-market rate and what you are quoted is the provider’s margin."}]
};
})();