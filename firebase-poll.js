/* ========================================
   📊 투표/설문 - Firebase
   ======================================== */

// 투표 생성
async function firebaseCreatePoll(data) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    const options = data.options.map((opt, i) => ({
      id: i,
      text: opt,
      votes: 0,
      voters: []
    }));
    
    await db.collection('polls').add({
      title: data.title,
      description: data.description || '',
      options,
      totalVotes: 0,
      isMultiple: data.isMultiple || false,
      isAnonymous: data.isAnonymous || false,
      isActive: true,
      authorId: user.uid,
      authorName: currentUser?.name || '익명',
      authorAvatar: currentUser?.avatar || '😀',
      endsAt: data.endsAt || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 투표 목록
async function firebaseGetPolls() {
  try {
    const snapshot = await db.collection('polls')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    const polls = [];
    snapshot.forEach(doc => {
      polls.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      });
    });
    
    return { success: true, polls };
  } catch (error) {
    return { success: false, polls: [], error: error.message };
  }
}

// 투표하기
async function firebaseVotePoll(pollId, optionId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    const pollRef = db.collection('polls').doc(pollId);
    const pollDoc = await pollRef.get();
    if (!pollDoc.exists) return { success: false, error: '투표 없음' };
    
    const pollData = pollDoc.data();
    if (!pollData.isActive) return { success: false, error: '종료된 투표' };
    
    // 이미 투표했는지 확인
    const alreadyVoted = pollData.options.some(opt => opt.voters?.includes(user.uid));
    if (alreadyVoted && !pollData.isMultiple) {
      return { success: false, error: '이미 투표했습니다' };
    }
    
    // 해당 옵션에 이미 투표했는지
    const targetOpt = pollData.options[optionId];
    if (targetOpt.voters?.includes(user.uid)) {
      return { success: false, error: '이미 이 항목에 투표했습니다' };
    }
    
    const newOptions = pollData.options.map((opt, i) => {
      if (i === optionId) {
        return {
          ...opt,
          votes: (opt.votes || 0) + 1,
          voters: [...(opt.voters || []), user.uid]
        };
      }
      return opt;
    });
    
    await pollRef.update({
      options: newOptions,
      totalVotes: firebase.firestore.FieldValue.increment(1)
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 투표 종료
async function firebaseClosePoll(pollId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    const pollDoc = await db.collection('polls').doc(pollId).get();
    if (pollDoc.data().authorId !== user.uid && !isAdmin) {
      return { success: false, error: '권한 없음' };
    }
    await db.collection('polls').doc(pollId).update({ isActive: false });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

console.log('📊 투표/설문 모듈 로드 완료!');

// 투표 삭제 (작성자 + 관리자)
async function firebaseDeletePoll(pollId) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var doc = await db.collection('polls').doc(pollId).get();
    if (!doc.exists) return { success: false, error: '투표 없음' };
    if (doc.data().authorId !== user.uid && !isAdmin) return { success: false, error: '권한 없음' };
    await db.collection('polls').doc(pollId).delete();
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}
