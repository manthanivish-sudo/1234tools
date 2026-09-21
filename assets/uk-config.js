/**
 * The London project, which holds the practice product.
 *
 * A second Firebase project on purpose: a Firestore database's location is
 * fixed when it is created, and the first project's is Mumbai. A UK
 * practice's client records should not sit in a region with no UK adequacy
 * decision, and a practice asks where its clients' data lives before it
 * asks anything else. So the tools site keeps its project, and this holds
 * nothing but the practice.
 *
 * As with the other config, this is a public identifier and not a secret:
 * what a page may do with it is decided by the Firestore rules and the
 * functions, never by this file.
 */
window.FIREBASE_CONFIG_UK = {
  apiKey: 'AIzaSyDzlKhB6fsGSIaAYd4VHNSgQrcTtMJnvbA',
  authDomain: 'mvr-1234tools-uk.firebaseapp.com',
  projectId: 'mvr-1234tools-uk',
  storageBucket: 'mvr-1234tools-uk.firebasestorage.app',
  messagingSenderId: '935658882387',
  appId: '1:935658882387:web:86a1eb24606887928d8da6',
  region: 'europe-west2'
};
