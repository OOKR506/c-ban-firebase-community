/* ========================================
   🔥 Firebase 설정 - c반놈들
   (웹 앱 설정값은 공개용입니다. 데이터 보호는 firestore.rules가 담당합니다.)
   ======================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDXjgrTyx92vdknzPWJ5xgEtW9Fp-Da3n0",
  authDomain: "c-ban-firebase-community.firebaseapp.com",
  projectId: "c-ban-firebase-community",
  storageBucket: "c-ban-firebase-community.firebasestorage.app",
  messagingSenderId: "243713271073",
  appId: "1:243713271073:web:818bbd834948ff1a6d8a60",
  measurementId: "G-0VKL7NHGYT"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
auth.languageCode = 'ko';

// Firestore 설정
db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });
db.enablePersistence().catch(err => console.warn('오프라인 모드:', err.code));

console.log('🔥 c반놈들 Firebase 연결!');
