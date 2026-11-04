/* ========================================
   🔥 Firebase 설정 - c반놈들
   ======================================== */

const firebaseConfig = {
  apiKey: "AIzaSyApy-9zZL7G7fCErjCTKagdJdtXzJqWGdM",
  authDomain: "c8nom-c3cd3.firebaseapp.com",
  projectId: "c8nom-c3cd3",
  storageBucket: "c8nom-c3cd3.firebasestorage.app",
  messagingSenderId: "726716256173",
  appId: "1:726716256173:web:ec20b05ce968fd4478db24",
  measurementId: "G-LW6PSV7NXN"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
auth.languageCode = 'ko';

// Firestore 설정
db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });
db.enablePersistence().catch(err => console.warn('오프라인 모드:', err.code));

console.log('🔥 c반놈들 Firebase 연결!');
