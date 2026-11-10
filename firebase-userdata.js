/* ========================================
   📊 사용자 데이터 - Firebase
   ======================================== */

// 상점 아이템
const SHOP_ITEMS = {
  avatars: [
    { id: 'avatar_cool', name: '쿨한 선글라스', icon: '😎', price: 500 },
    { id: 'avatar_nerd', name: '똑똑이', icon: '🤓', price: 500 },
    { id: 'avatar_party', name: '파티피플', icon: '🥳', price: 800 },
    { id: 'avatar_angel', name: '천사', icon: '😇', price: 1000 },
    { id: 'avatar_devil', name: '악마', icon: '😈', price: 1000 },
    { id: 'avatar_robot', name: '로봇', icon: '🤖', price: 1500 },
    { id: 'avatar_alien', name: '외계인', icon: '👽', price: 2000 },
    { id: 'avatar_crown', name: '왕관', icon: '👑', price: 5000 }
  ],
  backgrounds: [
    { id: 'bg_sunset', name: '석양', gradient: 'from-orange-400 to-pink-500', price: 300 },
    { id: 'bg_ocean', name: '바다', gradient: 'from-cyan-400 to-blue-500', price: 300 },
    { id: 'bg_forest', name: '숲', gradient: 'from-green-400 to-emerald-500', price: 300 },
    { id: 'bg_night', name: '밤하늘', gradient: 'from-indigo-600 to-purple-800', price: 500 },
    { id: 'bg_rainbow', name: '무지개', gradient: 'from-red-400 via-yellow-400 to-green-400', price: 800 },
    { id: 'bg_gold', name: '황금', gradient: 'from-yellow-400 to-amber-500', price: 1000 }
  ]
};

// 업적 목록
const ACHIEVEMENTS = [
  { id: 'first_post', name: '첫 게시글', desc: '첫 번째 게시글 작성', icon: '✍️', condition: p => p.posts >= 1, reward: 50 },
  { id: 'post_10', name: '글쓰기 마스터', desc: '게시글 10개 작성', icon: '📝', condition: p => p.posts >= 10, reward: 200 },
  { id: 'post_50', name: '다작 작가', desc: '게시글 50개 작성', icon: '📚', condition: p => p.posts >= 50, reward: 500 },
  { id: 'first_comment', name: '첫 댓글', desc: '첫 번째 댓글 작성', icon: '💬', condition: p => p.comments >= 1, reward: 30 },
  { id: 'comment_50', name: '수다쟁이', desc: '댓글 50개 작성', icon: '🗣️', condition: p => p.comments >= 50, reward: 300 },
  { id: 'attendance_7', name: '일주일 개근', desc: '7일 연속 출석', icon: '📅', condition: p => (p.attendanceStreak || 0) >= 7, reward: 100 },
  { id: 'attendance_30', name: '한 달 개근', desc: '30일 연속 출석', icon: '🏆', condition: p => (p.attendanceStreak || 0) >= 30, reward: 500 },
  { id: 'points_1000', name: '천원의 행복', desc: '1000P 달성', icon: '💰', condition: p => p.points >= 1000, reward: 100 },
  { id: 'points_10000', name: '만원의 기쁨', desc: '10000P 달성', icon: '💎', condition: p => p.points >= 10000, reward: 500 },
  { id: 'first_purchase', name: '첫 구매', desc: '상점에서 첫 구매', icon: '🛒', condition: p => (p.purchasedItems?.length || 0) >= 1, reward: 50 },
  { id: 'collector', name: '수집가', desc: '아이템 5개 구매', icon: '🎁', condition: p => (p.purchasedItems?.length || 0) >= 5, reward: 200 }
];

// 출석 체크
async function firebaseCheckAttendance() {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    const today = kstDateStr(0);
    const attendanceId = `${today}_${user.uid}`;
    
    const existingDoc = await db.collection('attendance').doc(attendanceId).get();
    if (existingDoc.exists) {
      return { success: false, error: '이미 출석했습니다', alreadyChecked: true };
    }
    
    // 연속 출석 계산
    const yesterdayStr = kstDateStr(-1);
    const yesterdayDoc = await db.collection('attendance').doc(`${yesterdayStr}_${user.uid}`).get();
    
    const userDataDoc = await db.collection('userData').doc(user.uid).get();
    let currentStreak = 1;
    
    if (yesterdayDoc.exists) {
      currentStreak = (userDataDoc.data()?.attendanceStreak || 0) + 1;
    }
    
    // 연속 출석 보너스
    let bonusPoints = 0;
    if (currentStreak >= 7) bonusPoints = 30;
    else if (currentStreak >= 3) bonusPoints = 10;
    
    const totalPoints = 50 + bonusPoints;
    
    // 출석 기록
    await db.collection('attendance').doc(attendanceId).set({
      userId: user.uid,
      date: today,
      streak: currentStreak,
      points: totalPoints,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 사용자 데이터 업데이트
    await db.collection('userData').doc(user.uid).update({
      attendanceStreak: currentStreak,
      lastAttendance: today
    });
    
    // 포인트 지급
    await db.collection('users').doc(user.uid).update({
      points: firebase.firestore.FieldValue.increment(totalPoints)
    });
    
    return { success: true, streak: currentStreak, points: totalPoints, bonus: bonusPoints };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 출석 현황
async function firebaseGetAttendanceStatus() {
  const user = auth.currentUser;
  if (!user) return { checked: false, streak: 0 };
  
  try {
    const today = kstDateStr(0);
    const attendanceDoc = await db.collection('attendance').doc(`${today}_${user.uid}`).get();
    const userDataDoc = await db.collection('userData').doc(user.uid).get();
    
    return {
      checked: attendanceDoc.exists,
      streak: userDataDoc.data()?.attendanceStreak || 0
    };
  } catch (error) {
    return { checked: false, streak: 0 };
  }
}

// 일일 미션
async function firebaseGetMissions() {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    const today = kstDateStr(0);
    const userDataDoc = await db.collection('userData').doc(user.uid).get();
    const userData = userDataDoc.data() || {};
    const dailyData = userData.dailyMissions?.[today] || {};
    
    const userDoc = await db.collection('users').doc(user.uid).get();
    const todayAttendance = await db.collection('attendance').doc(`${today}_${user.uid}`).get();
    
    return {
      attendance: {
        name: '출석 체크',
        icon: '✅',
        current: todayAttendance.exists ? 1 : 0,
        target: 1,
        done: todayAttendance.exists,
        reward: 50
      },
      post: {
        name: '게시글 작성',
        icon: '✍️',
        current: dailyData.posts || 0,
        target: 1,
        done: (dailyData.posts || 0) >= 1,
        reward: 20
      },
      comment: {
        name: '댓글 작성',
        icon: '💬',
        current: dailyData.comments || 0,
        target: 3,
        done: (dailyData.comments || 0) >= 3,
        reward: 30
      },
      like: {
        name: '좋아요 누르기',
        icon: '❤️',
        current: dailyData.likes || 0,
        target: 5,
        done: (dailyData.likes || 0) >= 5,
        reward: 20
      }
    };
  } catch (error) {
    return null;
  }
}

// 미션 진행 기록
async function firebaseRecordMissionProgress(type) {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const today = kstDateStr(0);
    const userDataRef = db.collection('userData').doc(user.uid);
    
    await userDataRef.set({
      dailyMissions: {
        [today]: {
          [type]: firebase.firestore.FieldValue.increment(1)
        }
      }
    }, { merge: true });
  } catch (error) {
    console.error('미션 기록 오류:', error);
  }
}

// 멤버 목록/랭킹
async function firebaseGetMembers(sortBy = 'points') {
  try {
    const snapshot = await db.collection('users')
      .orderBy(sortBy, 'desc')
      .limit(50)
      .get();
    
    const members = [];
    snapshot.forEach(doc => {
      members.push({
        uid: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, members };
  } catch (error) {
    return { success: false, members: [] };
  }
}

// 상점 구매 (트랜잭션: 포인트 부족/중복 구매/동시 구매를 안전하게 처리)
async function firebasePurchaseItem(itemId, itemType) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    const items = SHOP_ITEMS[itemType];
    const item = items?.find(i => i.id === itemId);
    if (!item) return { success: false, error: '아이템 없음' };
    
    const userRef = db.collection('users').doc(user.uid);
    const dataRef = db.collection('userData').doc(user.uid);
    
    const remaining = await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      const dSnap = await tx.get(dataRef);
      const currentPoints = (uSnap.exists && uSnap.data().points) || 0;
      const purchased = (dSnap.exists && dSnap.data().purchasedItems) || [];
      if (purchased.includes(itemId)) { const e = new Error('이미 구매한 아이템'); e.code = 'already-owned'; throw e; }
      if (currentPoints < item.price) { const e = new Error('포인트 부족'); e.code = 'insufficient-points'; throw e; }
      tx.update(userRef, { points: currentPoints - item.price });
      tx.set(dataRef, { purchasedItems: firebase.firestore.FieldValue.arrayUnion(itemId) }, { merge: true });
      return currentPoints - item.price;
    });
    
    return { success: true, remainingPoints: remaining, newPoints: remaining };
  } catch (error) {
    if (error.code === 'already-owned' || error.code === 'insufficient-points') return { success: false, error: error.message };
    return { success: false, error: error.message };
  }
}

// 구매한 아이템 목록
async function firebaseGetPurchasedItems() {
  const user = auth.currentUser;
  if (!user) return [];
  
  try {
    const userDataDoc = await db.collection('userData').doc(user.uid).get();
    return userDataDoc.data()?.purchasedItems || [];
  } catch (error) {
    return [];
  }
}

// 업적 확인
async function firebaseCheckAchievements() {
  const user = auth.currentUser;
  if (!user) return { newAchievements: [] };
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userDataDoc = await db.collection('userData').doc(user.uid).get();
    
    const userData = { ...userDoc.data(), ...userDataDoc.data() };
    const currentAchievements = userData.achievements || [];
    const newAchievements = [];
    
    for (const achievement of ACHIEVEMENTS) {
      if (!currentAchievements.includes(achievement.id) && achievement.condition(userData)) {
        newAchievements.push(achievement);
        
        await db.collection('userData').doc(user.uid).update({
          achievements: firebase.firestore.FieldValue.arrayUnion(achievement.id)
        });
        
        await db.collection('users').doc(user.uid).update({
          points: firebase.firestore.FieldValue.increment(achievement.reward),
          badges: firebase.firestore.FieldValue.arrayUnion(achievement.icon)
        });
      }
    }
    
    return { newAchievements };
  } catch (error) {
    return { newAchievements: [] };
  }
}

// 업적 목록
async function firebaseGetAchievements() {
  const user = auth.currentUser;
  if (!user) return { all: ACHIEVEMENTS, unlocked: [] };
  
  try {
    const userDataDoc = await db.collection('userData').doc(user.uid).get();
    const unlocked = userDataDoc.data()?.achievements || [];
    
    return { all: ACHIEVEMENTS, unlocked };
  } catch (error) {
    return { all: ACHIEVEMENTS, unlocked: [] };
  }
}

// 북마크/스크랩
async function firebaseToggleBookmark(postId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    const userDataDoc = await db.collection('userData').doc(user.uid).get();
    const bookmarks = userDataDoc.data()?.bookmarks || [];
    const isBookmarked = bookmarks.includes(postId);
    
    if (isBookmarked) {
      await db.collection('userData').doc(user.uid).update({
        bookmarks: firebase.firestore.FieldValue.arrayRemove(postId)
      });
    } else {
      await db.collection('userData').doc(user.uid).update({
        bookmarks: firebase.firestore.FieldValue.arrayUnion(postId)
      });
    }
    
    return { success: true, bookmarked: !isBookmarked };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

console.log('📊 사용자 데이터 모듈 로드 완료!');

// ========== alias (app-firebase.js 호환) ==========
async function firebaseDoAttendance() {
  return await firebaseCheckAttendance();
}

async function firebaseGetAttendanceInfo() {
  const status = await firebaseGetAttendanceStatus();
  return { hasAttendedToday: status.checked, streak: status.streak };
}

async function firebaseGetShopItems() {
  const user = auth.currentUser;
  let purchased = [];
  try {
    if (user) {
      const result = await firebaseGetPurchasedItems();
      purchased = Array.isArray(result) ? result : (result.items || []);
    }
  } catch (e) {}
  
  const items = [];
  SHOP_ITEMS.avatars.forEach(a => {
    items.push({ id: a.id, name: a.name, icon: a.icon, price: a.price, type: 'avatars', description: '아바타', owned: purchased.includes(a.id) });
  });
  SHOP_ITEMS.backgrounds.forEach(b => {
    items.push({ id: b.id, name: b.name, icon: '🎨', price: b.price, type: 'backgrounds', description: b.gradient, owned: purchased.includes(b.id) });
  });
  return { items };
}

async function firebaseBuyItem(itemId) {
  // 어떤 타입인지 찾기
  let itemType = null;
  if (SHOP_ITEMS.avatars.find(a => a.id === itemId)) itemType = 'avatars';
  else if (SHOP_ITEMS.backgrounds.find(b => b.id === itemId)) itemType = 'backgrounds';
  if (!itemType) return { success: false, message: '아이템을 찾을 수 없습니다' };
  
  const result = await firebasePurchaseItem(itemId, itemType);
  return result;
}
