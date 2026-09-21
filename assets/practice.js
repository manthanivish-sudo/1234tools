/**
 * The practice product, in the browser.
 *
 * Loaded only by the /practice/ pages. It talks to the London project and
 * nothing else on the site touches it — a person converting a PDF should
 * not have an accountancy platform arrive with the page.
 *
 * What the browser is trusted with is exactly what the rules allow: read
 * the practices you are a member of, add and edit clients, upload a
 * document into a client's folder and list what is there. Everything that
 * decides *who may see whose books* — staff membership, the link that says
 * which client a login belongs to, and the invitations that lead to either
 * — is refused here by the rules and done by a function instead. This file
 * calls those functions; it cannot work around them.
 *
 * Storage uploads go straight from the device to the bucket. The file does
 * not pass through us, and the rules check membership, size and type at the
 * bucket rather than trusting anything said here.
 */
(function () {
  'use strict';

  const cfg = window.FIREBASE_CONFIG_UK || null;
  const enabled = !!(cfg && cfg.apiKey && !/REPLACE_ME/.test(cfg.apiKey) && cfg.projectId);
  const SDK = 'https://www.gstatic.com/firebasejs/11.6.0/';
  const REGION = (cfg && cfg.region) || 'europe-west2';

  let A = null, F = null, FN = null, S = null;
  let auth = null, db = null, fns = null, store = null;
  let user = null, me = null;
  const listeners = new Set();

  const state = () => ({
    enabled,
    user: user ? { uid: user.uid, email: user.email } : null,
    me: me || null
  });
  const notify = () => listeners.forEach(fn => { try { fn(state()); } catch (e) { /* a listener's problem */ } });

  async function boot() {
    const [app, a, f, fn, s] = await Promise.all([
      import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js'), import(SDK + 'firebase-functions.js'),
      import(SDK + 'firebase-storage.js')
    ]);
    A = a; F = f; FN = fn; S = s;
    /* A named app: the tools-site library may also be on the page one day,
       and two calls to initializeApp with different projects and the same
       default name would fight. */
    const inst = app.initializeApp(cfg, 'uk');
    auth = A.getAuth(inst);
    db = F.getFirestore(inst);
    fns = FN.getFunctions(inst, REGION);
    store = S.getStorage(inst);
    if (cfg.emulators) {
      A.connectAuthEmulator(auth, cfg.emulators.auth, { disableWarnings: true });
      F.connectFirestoreEmulator(db, cfg.emulators.firestoreHost, cfg.emulators.firestorePort);
      FN.connectFunctionsEmulator(fns, cfg.emulators.functionsHost, cfg.emulators.functionsPort);
      S.connectStorageEmulator(store, cfg.emulators.storageHost, cfg.emulators.storagePort);
    }
    return new Promise((resolve) => {
      let first = true;
      A.onAuthStateChanged(auth, async (u) => {
        user = u;
        me = null;
        if (u) {
          try { me = (await FN.httpsCallable(fns, 'whoAmI')({})).data; }
          catch (e) { me = { kind: 'unknown', error: friendly(e) }; }
        }
        notify();
        if (first) { first = false; resolve(state()); }
      });
    });
  }

  const ready = enabled ? boot().catch((e) => { console.error('practice: could not start', e); return state(); }) : Promise.resolve(state());

  function friendly(e) {
    const code = (e && (e.code || e.message)) || '';
    if (/auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found/.test(code)) return 'That email and password do not match an account.';
    if (/auth\/email-already-in-use/.test(code)) return 'There is already an account with that email. Sign in instead.';
    if (/auth\/weak-password/.test(code)) return 'That password is too short — eight characters or more.';
    if (/auth\/invalid-email/.test(code)) return 'That does not look like an email address.';
    if (/auth\/too-many-requests/.test(code)) return 'Too many attempts. Wait a minute and try again.';
    if (/permission-denied|PERMISSION_DENIED/.test(code)) return (e && e.message) || 'You do not have access to that.';
    return (e && e.message) || String(e);
  }
  const guard = () => { if (!enabled) throw new Error('The practice product is not switched on yet.'); };

  /* ---------- signing in ---------- */

  async function signIn(email, password) {
    guard(); await ready;
    try { await A.signInWithEmailAndPassword(auth, email, password); }
    catch (e) { throw new Error(friendly(e)); }
  }
  async function signUp(email, password) {
    guard(); await ready;
    try { await A.createUserWithEmailAndPassword(auth, email, password); }
    catch (e) { throw new Error(friendly(e)); }
  }
  async function resetPassword(email) {
    guard(); await ready;
    try { await A.sendPasswordResetEmail(auth, email); }
    catch (e) { throw new Error(friendly(e)); }
  }
  async function signOut() { if (!enabled) return; await ready; await A.signOut(auth); }

  /** Ask the server again what this login is — after claiming an invite. */
  async function refresh() {
    await ready;
    if (!user) { me = null; notify(); return null; }
    try { me = (await FN.httpsCallable(fns, 'whoAmI')({})).data; }
    catch (e) { me = { kind: 'unknown', error: friendly(e) }; }
    notify();
    return me;
  }

  const fn = (name) => async (data) => {
    guard(); await ready;
    if (!user) throw new Error('Sign in first.');
    try { return (await FN.httpsCallable(fns, name)(data || {})).data; }
    catch (e) { throw new Error(friendly(e)); }
  };

  const createPractice = async (d) => { const r = await fn('createPractice')(d); await refresh(); return r; };
  const inviteMember = fn('inviteMember');
  const inviteClient = fn('inviteClient');
  const revokeInvite = fn('revokeInvite');
  const claimInvite = async (code) => { const r = await fn('claimInvite')({ code }); await refresh(); return r; };

  /* ---------- clients ---------- */

  async function listClients(practiceId) {
    guard(); await ready;
    const snap = await F.getDocs(F.query(F.collection(db, 'practices', practiceId, 'clients')));
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }

  async function getClient(practiceId, clientId) {
    guard(); await ready;
    const snap = await F.getDoc(F.doc(db, 'practices', practiceId, 'clients', clientId));
    return snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : null;
  }

  /** Add or rename a client. The rules allow this to staff directly. */
  async function saveClient(practiceId, clientId, data) {
    guard(); await ready;
    if (!user) throw new Error('Sign in first.');
    const id = clientId || slug(data.name) + '-' + Math.random().toString(36).slice(2, 7);
    const doc = {
      name: String(data.name || '').slice(0, 160),
      reference: String(data.reference || '').slice(0, 60) || null,
      country: data.country === 'IN' ? 'IN' : 'GB',
      yearEnd: String(data.yearEnd || '').slice(0, 10) || null,
      updatedAt: F.serverTimestamp()
    };
    try { await F.setDoc(F.doc(db, 'practices', practiceId, 'clients', id), doc, { merge: true }); }
    catch (e) { throw new Error(friendly(e)); }
    return id;
  }

  const slug = (s) => String(s || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'client';

  /* ---------- documents ---------- */

  const KINDS = ['invoice', 'receipt', 'bill', 'statement', 'other'];

  /**
   * Straight from the device to the bucket, then a row in Firestore saying
   * what it is. If the upload succeeds and the row fails, the file is
   * orphaned rather than the row pointing at nothing — the safer way round,
   * and the listing only ever shows rows.
   */
  async function uploadDocument(practiceId, clientId, file, meta) {
    guard(); await ready;
    if (!user) throw new Error('Sign in first.');
    if (!file) throw new Error('Choose a file first.');
    if (file.size > 25 * 1024 * 1024) throw new Error('That file is larger than 25 MB, which is the limit for one document.');
    const kind = KINDS.indexOf((meta || {}).kind) >= 0 ? meta.kind : 'other';
    const safe = String(file.name || 'document').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    const path = 'practices/' + practiceId + '/clients/' + clientId + '/' + Date.now() + '-' + safe;

    try {
      await S.uploadBytes(S.ref(store, path), file, { contentType: file.type || 'application/octet-stream' });
    } catch (e) {
      if (/unauthorized/i.test(e && e.code || '')) throw new Error('That file type is not accepted, or you do not have access to this client. PDFs, photographs, CSV and Excel files are allowed.');
      throw new Error(friendly(e));
    }

    const row = {
      name: safe,
      path,
      kind,
      note: String((meta || {}).note || '').slice(0, 300) || null,
      size: Number(file.size) || 0,
      contentType: file.type || null,
      uploadedBy: user.uid,
      uploadedAt: F.serverTimestamp()
    };
    try { await F.addDoc(F.collection(db, 'practices', practiceId, 'clients', clientId, 'documents'), row); }
    catch (e) { throw new Error(friendly(e)); }
    return row;
  }

  async function listDocuments(practiceId, clientId) {
    guard(); await ready;
    const snap = await F.getDocs(F.query(
      F.collection(db, 'practices', practiceId, 'clients', clientId, 'documents'),
      F.orderBy('uploadedAt', 'desc'), F.limit(200)
    ));
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }

  /** A short-lived URL for one file, from the bucket, checked by the rules. */
  async function documentUrl(path) {
    guard(); await ready;
    try { return await S.getDownloadURL(S.ref(store, path)); }
    catch (e) { throw new Error(friendly(e)); }
  }

  async function deleteDocument(practiceId, clientId, docId, path) {
    guard(); await ready;
    try {
      await F.deleteDoc(F.doc(db, 'practices', practiceId, 'clients', clientId, 'documents', docId));
      await S.deleteObject(S.ref(store, path));
    } catch (e) { throw new Error(friendly(e)); }
    return true;
  }

  async function listMembers(practiceId) {
    guard(); await ready;
    const snap = await F.getDocs(F.collection(db, 'practices', practiceId, 'members'));
    return snap.docs.map(d => Object.assign({ uid: d.id }, d.data()));
  }

  window.Practice = {
    enabled, ready, state,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    signIn, signUp, signOut, resetPassword, refresh,
    createPractice, inviteMember, inviteClient, claimInvite, revokeInvite,
    listClients, getClient, saveClient, listMembers,
    uploadDocument, listDocuments, documentUrl, deleteDocument,
    KINDS
  };
})();
