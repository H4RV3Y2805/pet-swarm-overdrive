/* Pet Swarm: Overdrive - Firebase web configuration.
   Safe to publish: these values identify the project, they do not grant access.
   Access is controlled by the Firestore security rules (firestore.rules).
   databaseURL is deliberately absent: the game never uses the Realtime Database. */
(function () {
  'use strict';
  window.PSO = window.PSO || {};
  window.PSO.firebaseConfig = {
    apiKey: 'AIzaSyAavzNt6ujjkxg9uhbXGto-vSiEL77hdnc',
    authDomain: 'bath-n-guess.firebaseapp.com',
    projectId: 'bath-n-guess',
    storageBucket: 'bath-n-guess.firebasestorage.app',
    messagingSenderId: '225305279219',
    appId: '1:225305279219:web:b6bf7333fb8f8c9a6e9586'
  };
})();
