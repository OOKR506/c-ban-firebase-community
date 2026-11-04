/* ========================================
   👥 팔로우/팔로잉 - Firebase
   ======================================== */

async function firebaseFollowUser(targetUserId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  if (targetUserId === user.uid) return { success: false, error: '자신을 팔로우할 수 없습니다' };
  try {
    const followId = `${user.uid}_${targetUserId}`;
    const existing = await db.collection('follows').doc(followId).get();
    if (existing.exists) return { success: false, error: '이미 팔로우 중' };
    await db.collection('follows').doc(followId).set({
      followerId: user.uid, followingId: targetUserId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('users').doc(user.uid).update({ followingCount: firebase.firestore.FieldValue.increment(1) });
    await db.collection('users').doc(targetUserId).update({ followerCount: firebase.firestore.FieldValue.increment(1) });
    if (typeof firebaseCreateNotification === 'function') {
      const fromDoc = await db.collection('users').doc(user.uid).get();
      firebaseCreateNotification(targetUserId, { type:'follow', title:'새 팔로워', message:`${fromDoc.data()?.name||'누군가'}님이 팔로우했습니다`, fromId:user.uid, fromName:fromDoc.data()?.name });
    }
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

async function firebaseUnfollowUser(targetUserId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    const followId = `${user.uid}_${targetUserId}`;
    await db.collection('follows').doc(followId).delete();
    await db.collection('users').doc(user.uid).update({ followingCount: firebase.firestore.FieldValue.increment(-1) });
    await db.collection('users').doc(targetUserId).update({ followerCount: firebase.firestore.FieldValue.increment(-1) });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

async function firebaseIsFollowing(targetUserId) {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const doc = await db.collection('follows').doc(`${user.uid}_${targetUserId}`).get();
    return doc.exists;
  } catch (e) { return false; }
}

async function firebaseGetFollowers(userId) {
  try {
    const snap = await db.collection('follows').where('followingId','==',userId).limit(50).get();
    const ids = []; snap.forEach(d => ids.push(d.data().followerId));
    const users = [];
    for (const id of ids) { const u = await db.collection('users').doc(id).get(); if (u.exists) users.push({ uid: id, ...u.data() }); }
    return { success: true, users };
  } catch (e) { return { success: false, users: [] }; }
}

async function firebaseGetFollowing(userId) {
  try {
    const snap = await db.collection('follows').where('followerId','==',userId).limit(50).get();
    const ids = []; snap.forEach(d => ids.push(d.data().followingId));
    const users = [];
    for (const id of ids) { const u = await db.collection('users').doc(id).get(); if (u.exists) users.push({ uid: id, ...u.data() }); }
    return { success: true, users };
  } catch (e) { return { success: false, users: [] }; }
}

console.log('👥 팔로우 모듈 로드 완료!');
