/**
 * Accounts, for the pages that have a reason to want one.
 *
 * Loaded only by /account/, /pricing/ and tools with a cloud feature — never
 * by the free tools, which have nothing to sign in for. Until
 * firebase-config.js carries a real project, `Account.enabled` is false and
 * nothing here loads Google's library or talks to anything.
 *
 * The browser is trusted with exactly what the Firestore rules allow: reading
 * its own record and keeping its own saved settings. A plan is read here and
 * never written here; the functions do that after a payment provider has
 * spoken.
 */
(function () {
  'use strict';

  const cfg = window.FIREBASE_CONFIG || null;
  const enabled = !!(cfg && cfg.apiKey && !/REPLACE_ME/.test(cfg.apiKey) && cfg.projectId && !/REPLACE_ME/.test(cfg.projectId));
  const SDK = 'https://www.gstatic.com/firebasejs/11.6.0/';
  const REGION = (cfg && cfg.region) || 'asia-south1';

  let A = null, F = null, FN = null;        /* the SDK modules */
  let auth = null, db = null, fns = null;
  let user = null, record = null, unsubRecord = null;
  const listeners = new Set();

  const state = () => ({ enabled, user: user ? { uid: user.uid, email: user.email, name: user.displayName || null } : null, plan: planOf(record), record: record || null });
  const notify = () => listeners.forEach(fn => { try { fn(state()); } catch (e) { /* a listener's problem */ } });

  /** What the record entitles to right now — the same rule the server uses. */
  function planOf(r) {
    if (!r || !r.plan || r.plan === 'free') return 'free';
    if (r.status && r.status !== 'active' && r.status !== 'trialing' && r.status !== 'cancelled') return 'free';
    const until = r.planUntil && (typeof r.planUntil.toMillis === 'function' ? r.planUntil.toMillis() : Number(r.planUntil));
    if (until && until < Date.now() - 3 * 86400000) return 'free';
    return r.plan;
  }

  async function boot() {
    const [app, a, f, fn] = await Promise.all([
      import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js'), import(SDK + 'firebase-functions.js')
    ]);
    A = a; F = f; FN = fn;
    const inst = app.initializeApp(cfg);
    auth = A.getAuth(inst);
    db = F.getFirestore(inst);
    fns = FN.getFunctions(inst, REGION);
    if (cfg.emulators) {
      A.connectAuthEmulator(auth, cfg.emulators.auth, { disableWarnings: true });
      F.connectFirestoreEmulator(db, cfg.emulators.firestoreHost, cfg.emulators.firestorePort);
      FN.connectFunctionsEmulator(fns, cfg.emulators.functionsHost, cfg.emulators.functionsPort);
    }
    return new Promise((resolve) => {
      let first = true;
      A.onAuthStateChanged(auth, (u) => {
        user = u;
        if (unsubRecord) { unsubRecord(); unsubRecord = null; }
        record = null;
        if (u) {
          /* live: a plan bought in another tab shows here without a reload */
          unsubRecord = F.onSnapshot(F.doc(db, 'users', u.uid), (snap) => {
            record = snap.exists() ? snap.data() : null;
            notify();
            if (first) { first = false; resolve(state()); }
          }, () => { record = null; notify(); if (first) { first = false; resolve(state()); } });
        } else {
          notify();
          if (first) { first = false; resolve(state()); }
        }
      });
    });
  }

  const ready = enabled ? boot().catch((e) => { console.error('account: could not start', e); return state(); }) : Promise.resolve(state());

  /* ---------- sign in / out ---------- */

  const friendly = (e) => {
    const code = (e && e.code) || '';
    if (/user-not-found|invalid-credential|wrong-password|invalid-login/.test(code)) return 'That email and password do not match.';
    if (/email-already-in-use/.test(code)) return 'There is already an account with that email. Sign in instead, or reset the password.';
    if (/weak-password/.test(code)) return 'Use a longer password — at least 8 characters.';
    if (/invalid-email/.test(code)) return 'That does not look like an email address.';
    if (/too-many-requests/.test(code)) return 'Too many tries. Wait a few minutes.';
    if (/popup-closed|cancelled-popup/.test(code)) return 'The sign-in window was closed before it finished.';
    if (/network-request-failed/.test(code)) return 'No connection. Check the network and try again.';
    return (e && e.message) || 'Something went wrong.';
  };
  const guard = () => { if (!enabled) throw new Error('Accounts are not switched on yet.'); };

  async function signInWithGoogle() {
    guard(); await ready;
    try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); }
    catch (e) { throw new Error(friendly(e)); }
  }
  async function signInWithEmail(email, password) {
    guard(); await ready;
    try { await A.signInWithEmailAndPassword(auth, String(email).trim(), password); }
    catch (e) { throw new Error(friendly(e)); }
  }
  async function signUpWithEmail(email, password) {
    guard(); await ready;
    try { await A.createUserWithEmailAndPassword(auth, String(email).trim(), password); }
    catch (e) { throw new Error(friendly(e)); }
  }
  async function resetPassword(email) {
    guard(); await ready;
    try { await A.sendPasswordResetEmail(auth, String(email).trim()); }
    catch (e) { throw new Error(friendly(e)); }
  }
  async function signOut() { if (!enabled) return; await ready; await A.signOut(auth); }

  /* ---------- paying ---------- */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  /**
   * Start a subscription. Razorpay opens its checkout here and the webhook
   * finishes the job; Stripe sends the browser to its hosted page and back.
   * Either way the plan appears on the account page when the provider says
   * so, not when this returns.
   */
  async function checkout(planId, period, provider) {
    guard(); await ready;
    if (!user) throw new Error('Sign in first.');
    const call = FN.httpsCallable(fns, 'createCheckout');
    let res;
    try { res = (await call({ planId, period, provider })).data; }
    catch (e) { throw new Error(friendly(e)); }
    if (res.provider === 'stripe') { location.href = res.url; return { redirected: true }; }
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    return new Promise((resolve, reject) => {
      const rz = new window.Razorpay({
        key: res.keyId, subscription_id: res.subscriptionId,
        name: '1234Tools', description: planId.charAt(0).toUpperCase() + planId.slice(1) + ' · ' + period,
        prefill: { email: res.email || user.email || '' },
        theme: { color: '#f7c948' },
        handler: () => resolve({ paid: true }),
        modal: { ondismiss: () => reject(new Error('The payment window was closed.')) }
      });
      rz.on('payment.failed', (r) => reject(new Error((r.error && r.error.description) || 'The payment failed.')));
      rz.open();
    });
  }

  async function manage(action) {
    guard(); await ready;
    if (!user) throw new Error('Sign in first.');
    const call = FN.httpsCallable(fns, 'manageBilling');
    let res;
    try { res = (await call({ action: action || 'portal' })).data; }
    catch (e) { throw new Error(friendly(e)); }
    if (res.url) { location.href = res.url; return { redirected: true }; }
    return res;
  }

  /* ---------- saved settings that follow you ---------- */

  async function saveMapping(tool, m) {
    guard(); await ready;
    if (!user) throw new Error('Sign in first.');
    const id = (tool + '-' + String(m.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 80) || (tool + '-' + Date.now());
    await F.setDoc(F.doc(db, 'users', user.uid, 'mappings', id), {
      tool, name: String(m.name || '').slice(0, 80), kind: m.kind || null,
      headers: (m.headers || []).slice(0, 200), map: m.map || {}, options: m.options || {},
      updatedAt: F.serverTimestamp()
    });
    return id;
  }
  async function listMappings(tool) {
    if (!enabled) return [];
    await ready;
    if (!user) return [];
    const q = F.query(F.collection(db, 'users', user.uid, 'mappings'), F.where('tool', '==', tool));
    const snap = await F.getDocs(q);
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }
  async function deleteMapping(id) {
    guard(); await ready;
    if (!user) throw new Error('Sign in first.');
    await F.deleteDoc(F.doc(db, 'users', user.uid, 'mappings', id));
  }
  async function usageThisMonth() {
    if (!enabled) return null;
    await ready;
    if (!user) return null;
    const snap = await F.getDoc(F.doc(db, 'users', user.uid, 'usage', new Date().toISOString().slice(0, 7)));
    return snap.exists() ? snap.data() : { calls: 0 };
  }

  /* ---------- the AI gateway, for tools ---------- */
  async function ai(tool, input, opts) {
    guard(); await ready;
    if (!user) throw new Error('Sign in to use the AI tools.');
    const call = FN.httpsCallable(fns, 'aiComplete');
    try { return (await call(Object.assign({ tool, input }, opts || {}))).data; }
    catch (e) { throw new Error(friendly(e)); }
  }

  window.Account = {
    enabled, ready, state, plan: () => planOf(record),
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut,
    checkout, manage, saveMapping, listMappings, deleteMapping, usageThisMonth, ai
  };
})();
