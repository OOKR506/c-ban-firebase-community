/* ========================================
   💬 댓글 기능 - Firebase (대댓글 지원)
   ======================================== */

// 댓글 작성 (parentId가 있으면 대댓글)
async function firebaseCreateComment(postId, content, parentId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  if (typeof checkBadWords === 'function') {
    const bw = checkBadWords(content);
    if (bw.blocked) return badWordError(bw);
  }
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    const commentData = {
      content, authorId: user.uid, authorName: userData.name,
      authorAvatar: userData.avatar || '😀', likes: [], likeCount: 0,
      parentId: parentId || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('posts').doc(postId).collection('comments').add(commentData);
    await db.collection('posts').doc(postId).update({ commentCount: firebase.firestore.FieldValue.increment(1) });
    await db.collection('users').doc(user.uid).update({ comments: firebase.firestore.FieldValue.increment(1), points: firebase.firestore.FieldValue.increment(5) });
    if (typeof firebaseRecordMissionProgress === 'function') firebaseRecordMissionProgress('comments');
    // 알림
    try {
      const postDoc = await db.collection('posts').doc(postId).get();
      const postAuthorId = postDoc.data()?.authorId;
      if (postAuthorId && postAuthorId !== user.uid && typeof firebaseCreateNotification === 'function') {
        firebaseCreateNotification(postAuthorId, { type:'comment', title:'새 댓글', message:`${userData.name}님이 댓글을 남겼습니다: "${content.substring(0,30)}"`, fromId:user.uid, fromName:userData.name, linkType:'post', linkId:postId });
      }
      // 대댓글이면 원댓글 작성자에게도 알림
      if (parentId) {
        const parentDoc = await db.collection('posts').doc(postId).collection('comments').doc(parentId).get();
        const parentAuthorId = parentDoc.data()?.authorId;
        if (parentAuthorId && parentAuthorId !== user.uid && parentAuthorId !== postAuthorId && typeof firebaseCreateNotification === 'function') {
          firebaseCreateNotification(parentAuthorId, { type:'reply', title:'답글', message:`${userData.name}님이 답글을 남겼습니다`, fromId:user.uid, fromName:userData.name, linkType:'post', linkId:postId });
        }
      }
    } catch (e) {}
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

// 댓글 목록 (대댓글 포함 트리 구조)
async function firebaseGetComments(postId) {
  try {
    const snapshot = await db.collection('posts').doc(postId).collection('comments').orderBy('createdAt', 'asc').get();
    const all = [];
    snapshot.forEach(doc => { all.push({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() }); });
    // 트리 구조로 변환
    const roots = all.filter(c => !c.parentId);
    roots.forEach(root => { root.replies = all.filter(c => c.parentId === root.id); });
    return { success: true, comments: roots, total: all.length };
  } catch (error) { return { success: false, comments: [], total: 0 }; }
}

// 댓글 수정
async function firebaseEditComment(postId, commentId, newContent) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  if (typeof checkBadWords === 'function') {
    const bw = checkBadWords(newContent);
    if (bw.blocked) return badWordError(bw);
  }
  try {
    const ref = db.collection('posts').doc(postId).collection('comments').doc(commentId);
    const doc = await ref.get();
    if (doc.data().authorId !== user.uid) return { success: false, error: '권한 없음' };
    await ref.update({ content: newContent, editedAt: firebase.firestore.FieldValue.serverTimestamp() });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

// 댓글 삭제
async function firebaseDeleteComment(postId, commentId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    const ref = db.collection('posts').doc(postId).collection('comments').doc(commentId);
    const doc = await ref.get();
    if (doc.data().authorId !== user.uid && !isAdmin) return { success: false, error: '권한 없음' };
    await ref.delete();
    await db.collection('posts').doc(postId).update({ commentCount: firebase.firestore.FieldValue.increment(-1) });
    // 대댓글도 삭제
    const replies = await db.collection('posts').doc(postId).collection('comments').where('parentId','==',commentId).get();
    const batch = db.batch();
    replies.forEach(r => { batch.delete(r.ref); });
    if (!replies.empty) { await batch.commit(); await db.collection('posts').doc(postId).update({ commentCount: firebase.firestore.FieldValue.increment(-replies.size) }); }
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

// 댓글 좋아요
async function firebaseToggleCommentLike(postId, commentId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    const ref = db.collection('posts').doc(postId).collection('comments').doc(commentId);
    const doc = await ref.get();
    const likes = doc.data().likes || [];
    const hasLiked = likes.includes(user.uid);
    await ref.update({ likes: hasLiked ? firebase.firestore.FieldValue.arrayRemove(user.uid) : firebase.firestore.FieldValue.arrayUnion(user.uid), likeCount: firebase.firestore.FieldValue.increment(hasLiked ? -1 : 1) });
    return { success: true, liked: !hasLiked };
  } catch (error) { return { success: false, error: error.message }; }
}

// alias
async function firebaseAddComment(postId, content, parentId) { return await firebaseCreateComment(postId, content, parentId); }

console.log('💬 댓글 모듈 로드 완료!');
