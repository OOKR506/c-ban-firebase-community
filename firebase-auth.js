/* ========================================
   🔐 Firebase 인증 - c반놈들
   ======================================== */

// 회원가입
async function firebaseSignUp(email, password, name) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    // Firestore에 사용자 정보 저장
    await db.collection('users').doc(user.uid).set({
      email: email,
      name: name,
      avatar: '😀',
      profileBg: 'from-indigo-400 to-purple-500',
      points: 100,
      posts: 0,
      comments: 0,
      grade: '뉴비',
      badges: [],
      isAdmin: false,
      isBanned: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // userData 초기화
    await db.collection('userData').doc(user.uid).set({
      dailyMissions: {},
      achievements: [],
      bookmarks: [],
      purchasedItems: []
    });
    
    return { success: true, user };
  } catch (error) {
    let message = '회원가입 실패';
    if (error.code === 'auth/email-already-in-use') message = '이미 사용 중인 이메일입니다';
    else if (error.code === 'auth/weak-password') message = '비밀번호는 6자 이상이어야 합니다';
    else if (error.code === 'auth/invalid-email') message = '올바른 이메일 형식이 아닙니다';
    return { success: false, error: message };
  }
}

// 로그인
async function firebaseLogin(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    let message = '로그인 실패';
    if (error.code === 'auth/user-not-found') message = '존재하지 않는 계정입니다';
    else if (error.code === 'auth/wrong-password') message = '비밀번호가 틀렸습니다';
    else if (error.code === 'auth/invalid-email') message = '올바른 이메일 형식이 아닙니다';
    else if (error.code === 'auth/too-many-requests') message = '너무 많은 시도. 잠시 후 다시 시도해주세요';
    return { success: false, error: message };
  }
}

// 로그아웃
async function firebaseLogout() {
  try {
    await auth.signOut();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 비밀번호 재설정
async function firebaseResetPassword(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    return { success: true };
  } catch (error) {
    let message = '비밀번호 재설정 실패';
    if (error.code === 'auth/user-not-found') message = '존재하지 않는 계정입니다';
    return { success: false, error: message };
  }
}

// 프로필 업데이트
async function firebaseUpdateProfile(updates) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    await db.collection('users').doc(user.uid).update(updates);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 멤버 수 가져오기
async function firebaseGetMemberCount() {
  try {
    const snapshot = await db.collection('users').get();
    return { count: snapshot.size };
  } catch (error) {
    return { count: 0 };
  }
}

console.log('🔐 인증 모듈 로드 완료!');

async function firebaseSendPasswordReset(email) { return await firebaseResetPassword(email); }

async function firebaseChangePassword(currentPw, newPw) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPw);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(newPw);
    return { success: true };
  } catch (error) {
    if (error.code === 'auth/wrong-password') return { success: false, error: '현재 비밀번호가 틀렸습니다' };
    return { success: false, error: error.message };
  }
}

async function firebaseDeleteAccount(password) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, password);
    await user.reauthenticateWithCredential(cred);
    await db.collection('users').doc(user.uid).delete();
    await db.collection('userData').doc(user.uid).delete();
    await user.delete();
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}
