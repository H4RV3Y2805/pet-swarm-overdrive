/* Pet Swarm: Overdrive - online layer (optional). Nothing else in the game talks to Firebase.
   On file:// this file does nothing: no scripts are loaded and no network request is made.
   On http(s) it loads the Firebase compat SDK from the gstatic CDN, then handles Google sign-in
   and the allowlist check (a document at players/{uid} means "allowed").
   It never touches gameplay state or the gameplay RNG. Only the UID is read from the Google
   account: no email, display name or photo is read, stored or shown. */
(function () {
  'use strict';
  var PSO = window.PSO, C = PSO.DATA.ONLINE;
  var O = PSO.Online = { available: false, state: 'offline', nick: '', uid: '', message: '' };
  var listeners = [], auth = null, db = null, started = false, refused = false, checkId = 0;

  function set(state, message) {
    O.state = state; O.message = message || '';
    if (state !== 'allowed') { O.nick = ''; O.uid = ''; }
    listeners.slice().forEach(function (fn) { try { fn(O.state); } catch (e) { /* a listener must never break sign-in */ } });
  }
  O.onChange = function (fn) { listeners.push(fn); };

  /* Every online call is time-limited and fails soft. */
  function withTimeout(promise, what) {
    return new Promise(function (resolve, reject) {
      var done = false, timer = setTimeout(function () { if (!done) { done = true; reject({ code: 'timeout', message: what + ' took too long.' }); } }, C.timeoutMs);
      promise.then(function (v) { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
                   function (e) { if (!done) { done = true; clearTimeout(timer); reject(e || {}); } });
    });
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = src; s.async = false;
      s.onload = resolve; s.onerror = function () { reject({ code: 'sdk', message: 'Could not load ' + src }); };
      document.head.appendChild(s);
    });
  }

  function checkAllowed(user) {
    var id = ++checkId, uid = user.uid;
    set('checking');
    withTimeout(db.collection('players').doc(uid).get(), 'Checking the player list').then(function (doc) {
      if (id !== checkId) return;
      if (doc && doc.exists) {
        var d = doc.data() || {};
        O.nick = String(d.nick || 'Player').slice(0, C.nickMax); O.uid = uid;
        set('allowed');
      } else refuse();
    }, function (e) {
      if (id !== checkId) return;
      if (e && e.code === 'permission-denied') refuse();
      else set('error', e && e.code === 'timeout' ? 'The leaderboard server did not answer in time.' : 'Could not reach the leaderboard server.');
    });
  }
  function refuse() {
    refused = true;
    set('notAllowed', 'This Google account is not on the player list. Ask Len to add it.');
    auth.signOut().catch(function () { /* already shown as not allowed */ });
  }

  O.init = function () {
    var proto = window.location && window.location.protocol;
    if (started || (proto !== 'http:' && proto !== 'https:')) return;   /* file:// stays fully offline */
    started = true;
    set('checking');
    var base = 'https://www.gstatic.com/firebasejs/' + C.sdkVersion + '/';
    withTimeout(loadScript(base + 'firebase-app-compat.js')
      .then(function () { return loadScript(base + 'firebase-auth-compat.js'); })
      .then(function () { return loadScript(base + 'firebase-firestore-compat.js'); }), 'Loading the sign-in service')
      .then(function () {
        var fb = window.firebase;
        fb.initializeApp(PSO.firebaseConfig);
        auth = fb.auth(); db = fb.firestore();
        O.available = true;
        auth.onAuthStateChanged(function (user) {
          if (user) { refused = false; checkAllowed(user); }
          else { checkId++; if (refused) refused = false; else set('signedOut', O.state === 'signedOut' ? O.message : ''); }
        });
      })
      .catch(function () { started = false; O.available = false; set('error', 'The sign-in service could not be loaded.'); });
  };

  /* Must be called from a click, or the browser blocks the popup. The popup itself is not
     time-limited: choosing an account is the player's action, not a network wait. */
  O.signIn = function () {
    if (!O.available) { O.retry(); return; }
    var provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });   /* shared family PC: always ask which account */
    auth.signInWithPopup(provider).catch(function (e) {
      var code = e && e.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') set('signedOut', 'Sign-in was cancelled.');
      else if (code === 'auth/popup-blocked') set('signedOut', 'The browser blocked the sign-in window. Allow pop-ups for this site and try again.');
      else set('error', 'Sign-in failed. Check the internet connection and try again.');
    });
  };
  O.signOut = function () {
    if (!auth) return;
    withTimeout(auth.signOut(), 'Signing out').catch(function () { set('error', 'Could not sign out. Try again.'); });
  };
  O.retry = function () {
    if (!O.available) { O.init(); return; }
    if (auth.currentUser) checkAllowed(auth.currentUser); else set('signedOut');
  };
})();
