/**
 * The Firebase web config for accounts. It is a public identifier, not a
 * secret: what it names is the project, and what a page may do with it is
 * decided by the Firestore rules and the functions, not by this file.
 *
 * While the apiKey says REPLACE_ME, accounts are switched off everywhere on
 * the site: no sign-in, no library loaded, nothing sent to Google. The free
 * tools do not read this file at all.
 *
 * Paste the config from Firebase console -> Project settings -> Your apps.
 */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBxtLZHkt3RzTcscjJklaRoJJ2tjFCQBM8',
  authDomain: 'mvr-1234tools.firebaseapp.com',
  projectId: 'mvr-1234tools',
  appId: '1:950170265810:web:62f1940361d1b46ce3250b',
  messagingSenderId: '950170265810',
  storageBucket: 'mvr-1234tools.firebasestorage.app',
  region: 'asia-south1'
};
