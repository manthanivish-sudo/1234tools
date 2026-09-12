(function(){

window.DEV_TOOLS = window.DEV_TOOLS || {};
window.DEV_TOOLS["qr-code-scanner"] = {
"title": "QR Code Scanner",
"category": "qr",
"icon": "▣",
"kind": "qr-scan",
"description": "Scan a QR code with your camera or from a picture. Reads WiFi, contact cards, payments and links, and shows where a link really goes before you open it.",
"keywords": ["qr code scanner","qr code reader","scan qr code","read qr code","qr scanner online","scan qr from image"],
"tips": ["The camera only works on a secure (https) page, and only after you allow it. Nothing is recorded: frames are read in memory and thrown away.","If a code will not read, fill more of the frame with it, hold steadier, and make sure the light border around the code is not cropped off.","A code on a screen often reads better with the torch off — the reflection is usually what defeats it.","Scanning a picture works when the camera does not: take a photo of the code, or drop in a screenshot."],
"faq": [{"q":"Does the scan go to a server?","a":"No. The camera stream is read by JavaScript in this page and decoded on the device. No frame, image or result is uploaded, and the scan list is kept in this browser tab only, gone when you close it."},{"q":"Why does the camera not start?","a":"Browsers only allow camera access on secure (https) pages, and only after you grant permission. If you refused it earlier, reset it from the padlock or camera icon in the address bar. On iPhone, the camera works in Safari and in apps added to the Home Screen, but some in-app browsers block it."},{"q":"Is it safe to open a link from a QR code?","a":"Treat it like a link in a message from a stranger. Printed codes get covered with stickers, which is a common trick in car parks and on restaurant tables. This scanner never opens anything on its own: it shows the domain the link really goes to, warns when a domain uses look-alike characters, and refuses to open script addresses."},{"q":"Can it read a damaged or partly covered code?","a":"Often, yes. Every QR code carries Reed-Solomon error correction, and this reader uses it, repairing up to 7% to 30% of the code depending on the level it was made with. The result tells you how many damaged codewords were repaired."}]
};
})();
