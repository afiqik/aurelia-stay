/* AURELIA STAY — central configuration (Firebase web config is public by design; access is enforced by security rules). */

export const SDK_VERSION = '12.19.0';
export const SDK_BASE = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCRNiIt0i8xjkrwvLPhoe57Rtk7I_E0oCM',
  authDomain: 'zyphora-dfe10.firebaseapp.com',
  databaseURL: 'https://zyphora-dfe10-default-rtdb.firebaseio.com',
  projectId: 'zyphora-dfe10',
  storageBucket: 'zyphora-dfe10.firebasestorage.app',
  messagingSenderId: '508512229373',
  appId: '1:508512229373:web:9893142fd1eae5679c2b94'
};

/** The bootstrap administrator. Hard-coded in firestore.rules and database.rules.json too — keep all three in sync. */
export const DEFAULT_ADMIN_EMAIL = 'admin@aureliastay.local';

/** Local emulator mode: add ?emulator=1 to any page URL (remembered in localStorage until ?emulator=0). Never touches production data. */
export const EMULATOR = { projectId: 'demo-aurelia', host: 'localhost', authPort: 9099, firestorePort: 8180, databasePort: 9000 };
export function emulatorEnabled() {
  try {
    const q = new URLSearchParams(location.search).get('emulator');
    if (q === '1') localStorage.setItem('aurelia-emulator', '1');
    if (q === '0') localStorage.removeItem('aurelia-emulator');
    return localStorage.getItem('aurelia-emulator') === '1';
  } catch (e) { return false; }
}
