/* ========================================
   👑 관리자 기능 - Firebase
   ======================================== */

// 관리자 여부 확인
async function firebaseIsAdmin() {
  const user = auth.currentUser;
  if (!user) return false;
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    return userDoc.exists && userDoc.data().isAdmin === true;
  } catch (error) {
    return false;
  }
}

// ========== 회원 관리 ==========

// 전체 회원 목록
async function firebaseAdminGetAllUsers() {
  try {
    const snapshot = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .get();
    
    const users = [];
    snapshot.forEach(doc => {
      users.push({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      });
    });
    
    return { success: true, users };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 회원 차단/해제
async function firebaseAdminToggleBan(userId) {
  const isAdmin = await firebaseIsAdmin();
  if (!isAdmin) return { success: false, error: '관리자 권한 필요' };
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const currentBanned = userDoc.data()?.isBanned || false;
    
    await db.collection('users').doc(userId).update({
      isBanned: !currentBanned,
      bannedAt: !currentBanned ? firebase.firestore.FieldValue.serverTimestamp() : null
    });
    
    return { success: true, isBanned: !currentBanned };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 포인트 조정
async function firebaseAdminAdjustPoints(userId, amount, reason) {
  const isAdmin = await firebaseIsAdmin();
  if (!isAdmin) return { success: false, error: '관리자 권한 필요' };
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const currentPoints = userDoc.data()?.points || 0;
    const newPoints = Math.max(0, currentPoints + amount);
    
    await db.collection('users').doc(userId).update({ points: newPoints });
    
    await db.collection('pointLogs').add({
      userId,
      amount,
      reason,
      beforePoints: currentPoints,
      afterPoints: newPoints,
      adminId: auth.currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, newPoints };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ========== 게시글 관리 ==========

// 전체 게시글
async function firebaseAdminGetAllPosts() {
  try {
    const snapshot = await db.collection('posts')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const posts = [];
    snapshot.forEach(doc => {
      posts.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      });
    });
    
    return { success: true, posts };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 게시글 강제 삭제
async function firebaseAdminDeletePost(postId) {
  const isAdmin = await firebaseIsAdmin();
  if (!isAdmin) return { success: false, error: '관리자 권한 필요' };
  
  try {
    await db.collection('posts').doc(postId).update({
      isDeleted: true,
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deletedBy: auth.currentUser.uid,
      deletedReason: 'admin'
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 게시글 복구
async function firebaseAdminRestorePost(postId) {
  const isAdmin = await firebaseIsAdmin();
  if (!isAdmin) return { success: false, error: '관리자 권한 필요' };
  
  try {
    await db.collection('posts').doc(postId).update({
      isDeleted: false,
      restoredAt: firebase.firestore.FieldValue.serverTimestamp(),
      restoredBy: auth.currentUser.uid
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ========== 통계 ==========

async function firebaseAdminGetStats() {
  try {
    var usersSnapshot = await db.collection('users').get();
    var totalUsers = usersSnapshot.size;
    
    var postsSnapshot = await db.collection('posts').get();
    var totalPosts = 0;
    postsSnapshot.forEach(function(doc) {
      if (doc.data().isDeleted !== true) totalPosts++;
    });
    
    var dateStr = kstDateStr(0);
    
    var todayAttendance = 0;
    try {
      var attSnap = await db.collection('attendance').where('date', '==', dateStr).get();
      todayAttendance = attSnap.size;
    } catch(e) {}
    
    var totalPoints = 0;
    usersSnapshot.forEach(function(doc) {
      totalPoints += doc.data().points || 0;
    });
    
    return {
      success: true,
      stats: { totalUsers: totalUsers, todayAttendance: todayAttendance, totalPosts: totalPosts, totalPoints: totalPoints }
    };
  } catch (error) {
    console.error('통계 오류:', error);
    return { success: false, stats: {}, error: error.message };
  }
}

// ========== 공지사항 ==========

async function firebaseAdminCreateNotice(title, content) {
  const isAdmin = await firebaseIsAdmin();
  if (!isAdmin) return { success: false, error: '관리자 권한 필요' };
  
  try {
    await db.collection('notices').add({
      title,
      content,
      authorId: auth.currentUser.uid,
      authorName: currentUser?.name || '관리자',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isActive: true
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function firebaseGetNotices() {
  try {
    const snapshot = await db.collection('notices')
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    const notices = [];
    snapshot.forEach(doc => {
      notices.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      });
    });
    
    return { success: true, notices };
  } catch (error) {
    return { success: false, notices: [] };
  }
}

console.log('👑 관리자 모듈 로드 완료!');

// ========== 등급 시스템 ==========
const USER_GRADES = [
  { id: 'newbie',     name: '🌱 새싹',     color: 'text-green-600',  bg: 'bg-green-100' },
  { id: 'member',     name: '🧑 정회원',    color: 'text-blue-600',   bg: 'bg-blue-100' },
  { id: 'active',     name: '⭐ 우수회원',   color: 'text-amber-600',  bg: 'bg-amber-100' },
  { id: 'vip',        name: '💎 VIP',      color: 'text-purple-600', bg: 'bg-purple-100' },
  { id: 'moderator',  name: '🛡️ 운영진',   color: 'text-indigo-600', bg: 'bg-indigo-100' },
  { id: 'admin',      name: '👑 관리자',    color: 'text-red-600',    bg: 'bg-red-100' }
];

// 등급 변경
async function firebaseAdminChangeGrade(userId, gradeId) {
  const admin = await firebaseIsAdmin();
  if (!admin) return { success: false, error: '관리자 권한 필요' };
  
  const grade = USER_GRADES.find(g => g.id === gradeId);
  if (!grade) return { success: false, error: '존재하지 않는 등급' };
  
  try {
    await db.collection('users').doc(userId).update({
      grade: grade.name,
      gradeId: grade.id,
      gradeUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      gradeUpdatedBy: auth.currentUser.uid
    });
    
    return { success: true, grade: grade.name };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 신고 목록 가져오기
async function firebaseAdminGetReports() {
  try {
    const snap = await db.collection('reports').orderBy('createdAt','desc').limit(50).get();
    const reports = [];
    snap.forEach(doc => { reports.push({ id:doc.id, ...doc.data(), createdAt:doc.data().createdAt?.toDate() }); });
    return { success:true, reports };
  } catch (error) {
    try { const snap2 = await db.collection('reports').limit(50).get(); const reports=[]; snap2.forEach(doc=>{reports.push({id:doc.id,...doc.data(),createdAt:doc.data().createdAt?.toDate()});}); reports.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); return{success:true,reports}; }
    catch(e2) { return { success:false, reports:[] }; }
  }
}

// 신고 처리
async function firebaseAdminResolveReport(reportId, action) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    await db.collection('reports').doc(reportId).update({ status: action, resolvedAt: firebase.firestore.FieldValue.serverTimestamp(), resolvedBy: auth.currentUser.uid });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

// ========== 실시간 접속 현황 ==========
async function firebaseAdminGetOnlineUsers() {
  try {
    var fiveMinAgo = new Date(Date.now() - 5 * 60000);
    var snap = await db.collection('userPresence').where('lastSeen', '>', firebase.firestore.Timestamp.fromDate(fiveMinAgo)).limit(200).get();
    var users = [];
    snap.forEach(function(doc) {
      var data = doc.data();
      var lastSeen = data.lastSeen ? data.lastSeen.toDate() : null;
      if (lastSeen && lastSeen > fiveMinAgo) {
        users.push({ uid: doc.id, lastSeen: lastSeen, name: data.name || '', avatar: data.avatar || '😀' });
      }
    });
    // 이름 가져오기
    for (var i = 0; i < users.length; i++) {
      if (!users[i].name) {
        try { var u = await db.collection('users').doc(users[i].uid).get(); users[i].name = u.data().name || '알 수 없음'; users[i].avatar = u.data().avatar || '😀'; } catch(e) {}
      }
    }
    return { success: true, users: users };
  } catch (error) { return { success: false, users: [] }; }
}

// ========== 활동 로그 ==========
async function firebaseAdminLogAction(action, details) {
  try {
    await db.collection('adminLogs').add({
      action, details: details || '',
      adminId: auth.currentUser?.uid,
      adminName: currentUser?.name || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {}
}

async function firebaseAdminGetLogs() {
  try {
    const snap = await db.collection('adminLogs').orderBy('createdAt', 'desc').limit(50).get();
    const logs = [];
    snap.forEach(doc => { logs.push({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() }); });
    return { success: true, logs };
  } catch (e) {
    try {
      const snap2 = await db.collection('adminLogs').limit(50).get();
      const logs = []; snap2.forEach(doc => { logs.push({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() }); });
      logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return { success: true, logs };
    } catch (e2) { return { success: true, logs: [] }; }
  }
}

// ========== 게시글 관리 (전체 검색/삭제/고정) ==========
async function firebaseAdminGetAllPosts(keyword) {
  try {
    var snap = await db.collection('posts').limit(200).get();
    var posts = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      if (keyword) {
        var kw = keyword.toLowerCase();
        if (!(d.title || '').toLowerCase().includes(kw) && !(d.authorName || '').toLowerCase().includes(kw)) return;
      }
      posts.push({ id: doc.id, title: d.title, content: d.content, category: d.category, authorName: d.authorName || d.author, authorAvatar: d.authorAvatar, isPinned: d.isPinned, isDeleted: d.isDeleted, likeCount: d.likeCount || 0, views: d.views || 0, createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    posts.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    return { success: true, posts: posts };
  } catch (e) { return { success: false, posts: [] }; }
}

async function firebaseAdminDeletePost(postId) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    await db.collection('posts').doc(postId).update({ isDeleted: true });
    firebaseAdminLogAction('게시글 삭제', postId);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ========== 공지 관리 ==========
async function firebaseAdminGetNotices() {
  try {
    const snap = await db.collection('notices').orderBy('createdAt', 'desc').limit(20).get();
    const notices = [];
    snap.forEach(doc => { notices.push({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() }); });
    return { success: true, notices };
  } catch (e) {
    try {
      const snap2 = await db.collection('notices').limit(20).get();
      const notices = []; snap2.forEach(doc => { notices.push({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() }); });
      return { success: true, notices };
    } catch (e2) { return { success: true, notices: [] }; }
  }
}

async function firebaseAdminEditNotice(noticeId, data) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    await db.collection('notices').doc(noticeId).update(data);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

async function firebaseAdminDeleteNotice(noticeId) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    await db.collection('notices').doc(noticeId).delete();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

async function firebaseAdminToggleNotice(noticeId) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    const doc = await db.collection('notices').doc(noticeId).get();
    const isActive = doc.data()?.isActive !== false;
    await db.collection('notices').doc(noticeId).update({ isActive: !isActive });
    return { success: true, isActive: !isActive };
  } catch (e) { return { success: false, error: e.message }; }
}

// ========== 채팅방 관리 ==========
async function firebaseAdminAddChatRoom(id, name, desc) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    await db.collection('chatRoomsMeta').doc(id).set({ name, desc, createdAt: firebase.firestore.FieldValue.serverTimestamp(), active: true });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

async function firebaseAdminDeleteChatRoom(roomId) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    await db.collection('chatRoomsMeta').doc(roomId).delete();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

async function firebaseAdminMuteUser(userId, roomId, duration) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    const until = new Date(Date.now() + (duration || 60) * 60000);
    await db.collection('chatMutes').doc(`${roomId}_${userId}`).set({ userId, roomId, until: firebase.firestore.Timestamp.fromDate(until), mutedBy: auth.currentUser.uid });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ========== 카테고리별 통계 ==========
async function firebaseAdminGetCategoryStats() {
  try {
    const snap = await db.collection('posts').get();
    const stats = {};
    snap.forEach(doc => {
      const d = doc.data();
      if (d.isDeleted === true) return;
      const cat = d.category || '미분류';
      if (!stats[cat]) stats[cat] = { count: 0, likes: 0, views: 0 };
      stats[cat].count++;
      stats[cat].likes += d.likeCount || 0;
      stats[cat].views += d.views || 0;
    });
    return { success: true, stats };
  } catch (e) { return { success: false, stats: {} }; }
}

// ========== TOP 활동 유저 ==========
async function firebaseAdminGetTopUsers() {
  try {
    const snap = await db.collection('users').orderBy('points', 'desc').limit(20).get();
    const users = [];
    snap.forEach(doc => { users.push({ uid: doc.id, ...doc.data() }); });
    return { success: true, users };
  } catch (e) { return { success: false, users: [] }; }
}

// ========== 전체 공지 팝업 ==========
async function firebaseAdminSetPopupNotice(title, content, active) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    await db.collection('siteSettings').doc('popupNotice').set({
      title, content, active: active !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

async function firebaseGetPopupNotice() {
  try {
    const doc = await db.collection('siteSettings').doc('popupNotice').get();
    if (!doc.exists || !doc.data().active) return null;
    return doc.data();
  } catch (e) { return null; }
}

// ========== 사이트 설정 ==========
async function firebaseAdminGetSiteSettings() {
  try {
    const doc = await db.collection('siteSettings').doc('general').get();
    return doc.exists ? doc.data() : { siteName: 'c반놈들', siteDesc: '우리만의 커뮤니티', siteEmoji: '🎓' };
  } catch (e) { return { siteName: 'c반놈들', siteDesc: '우리만의 커뮤니티', siteEmoji: '🎓' }; }
}

async function firebaseAdminUpdateSiteSettings(data) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  try {
    await db.collection('siteSettings').doc('general').set(data, { merge: true });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ========== 관리자 권한 부여/회수 ==========
async function firebaseAdminToggleAdmin(userId) {
  if (!(await firebaseIsAdmin())) return { success: false, error: '관리자 권한 필요' };
  if (auth.currentUser && userId === auth.currentUser.uid) return { success: false, error: '자기 자신의 관리자 권한은 변경할 수 없습니다' };
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const isCurrentAdmin = userDoc.data()?.isAdmin === true;
    await db.collection('users').doc(userId).update({ isAdmin: !isCurrentAdmin });
    firebaseAdminLogAction(isCurrentAdmin ? '관리자 해제' : '관리자 임명', userId);
    return { success: true, isAdmin: !isCurrentAdmin };
  } catch (e) { return { success: false, error: e.message }; }
}
