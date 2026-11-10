/* ========================================
   🔔 알림 시스템 - Firebase (인덱스 불필요)
   ======================================== */

async function firebaseCreateNotification(toUserId, data) {
  try {
    await db.collection('notifications').add({
      userId: toUserId, type: data.type || 'general', title: data.title,
      message: data.message, fromId: data.fromId || null, fromName: data.fromName || null,
      linkType: data.linkType || null, linkId: data.linkId || null,
      isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

// 내 알림 목록 (인덱스 불필요 - where만, 클라이언트 정렬)
async function firebaseGetNotifications() {
  var user = auth.currentUser;
  if (!user) return { notifications: [] };
  try {
    var snapshot = await db.collection('notifications')
      .where('userId', '==', user.uid)
      .limit(50)
      .get();
    var notifications = [];
    snapshot.forEach(function(doc) {
      var data = doc.data();
      notifications.push({
        id: doc.id, userId: data.userId, type: data.type, title: data.title,
        message: data.message, fromId: data.fromId, fromName: data.fromName,
        linkType: data.linkType, linkId: data.linkId, isRead: data.isRead,
        createdAt: data.createdAt ? data.createdAt.toDate() : null
      });
    });
    notifications.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    return { success: true, notifications: notifications };
  } catch (error) {
    console.error('알림 조회 오류:', error);
    return { success: false, notifications: [] };
  }
}

// 안읽은 알림 수 (안 읽은 것만 직접 조회 - 알림이 50개를 넘어도 정확)
async function firebaseGetUnreadNotifCount() {
  var user = auth.currentUser;
  if (!user) return 0;
  try {
    var snapshot = await db.collection('notifications')
      .where('userId', '==', user.uid)
      .where('isRead', '==', false)
      .limit(100)
      .get();
    return snapshot.size;
  } catch (error) { return 0; }
}

async function firebaseMarkNotifRead(notifId) {
  try { await db.collection('notifications').doc(notifId).update({ isRead: true }); return { success: true }; }
  catch (error) { return { success: false }; }
}

async function firebaseMarkAllNotifsRead() {
  var user = auth.currentUser;
  if (!user) return { success: false };
  try {
    var snapshot = await db.collection('notifications').where('userId', '==', user.uid).where('isRead', '==', false).limit(400).get();
    if (snapshot.empty) return { success: true };
    var batch = db.batch();
    snapshot.forEach(function(doc) { batch.update(doc.ref, { isRead: true }); });
    await batch.commit();
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

async function firebaseDeleteNotification(notifId) {
  try { await db.collection('notifications').doc(notifId).delete(); return { success: true }; }
  catch (error) { return { success: false }; }
}

console.log('🔔 알림 시스템 모듈 로드 완료!');
