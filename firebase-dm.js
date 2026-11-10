/* ========================================
   📩 쪽지(DM) - Firebase (인덱스 불필요)
   ======================================== */

// 쪽지 보내기
async function firebaseSendDM(toUserId, message) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  if (toUserId === user.uid) return { success: false, error: '자신에게는 보낼 수 없습니다' };
  try {
    const toUserDoc = await db.collection('users').doc(toUserId).get();
    if (!toUserDoc.exists) return { success: false, error: '존재하지 않는 사용자' };
    const fromUserDoc = await db.collection('users').doc(user.uid).get();
    const fromData = fromUserDoc.data();
    const toData = toUserDoc.data();
    await db.collection('directMessages').add({
      fromId: user.uid, fromName: fromData.name, fromAvatar: fromData.avatar || '😀',
      toId: toUserId, toName: toData.name, toAvatar: toData.avatar || '😀',
      message, isRead: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (typeof firebaseCreateNotification === 'function') {
      firebaseCreateNotification(toUserId, { type:'dm', title:'새 쪽지', message:`${fromData.name}님이 쪽지를 보냈습니다`, fromId:user.uid, fromName:fromData.name });
    }
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

// 받은 쪽지 (인덱스 불필요 - where만 사용, 클라이언트 정렬)
async function firebaseGetReceivedDMs() {
  const user = auth.currentUser;
  if (!user) return { messages: [] };
  try {
    const snapshot = await db.collection('directMessages')
      .where('toId', '==', user.uid)
      .limit(50)
      .get();
    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() });
    });
    messages.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { success: true, messages };
  } catch (error) {
    console.error('받은 쪽지 오류:', error);
    return { success: false, messages: [] };
  }
}

// 보낸 쪽지 (인덱스 불필요)
async function firebaseGetSentDMs() {
  const user = auth.currentUser;
  if (!user) return { messages: [] };
  try {
    const snapshot = await db.collection('directMessages')
      .where('fromId', '==', user.uid)
      .limit(50)
      .get();
    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() });
    });
    messages.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { success: true, messages };
  } catch (error) {
    console.error('보낸 쪽지 오류:', error);
    return { success: false, messages: [] };
  }
}

// 안읽은 쪽지 수
async function firebaseGetUnreadDMCount() {
  const user = auth.currentUser;
  if (!user) return 0;
  try {
    const snapshot = await db.collection('directMessages')
      .where('toId', '==', user.uid)
      .where('isRead', '==', false)
      .get();
    return snapshot.size;
  } catch (error) { return 0; }
}

// 쪽지 읽음 처리
async function firebaseMarkDMRead(dmId) {
  try { await db.collection('directMessages').doc(dmId).update({ isRead: true }); return { success: true }; }
  catch (error) { return { success: false }; }
}

// 쪽지 삭제
async function firebaseDeleteDM(dmId) {
  const user = auth.currentUser;
  if (!user) return { success: false };
  try {
    const doc = await db.collection('directMessages').doc(dmId).get();
    const data = doc.data();
    if (data.fromId !== user.uid && data.toId !== user.uid) return { success: false, error: '권한 없음' };
    await db.collection('directMessages').doc(dmId).delete();
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

console.log('📩 쪽지(DM) 모듈 로드 완료!');
