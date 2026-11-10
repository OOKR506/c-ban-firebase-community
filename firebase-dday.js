/* ========================================
   📅 D-Day 캘린더 - Firebase (인덱스 불필요)
   ======================================== */

// D-Day 이벤트 추가
async function firebaseAddDday(data) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  if (typeof checkBadWords === 'function') {
    var bw = checkBadWords(data.title);
    if (bw.blocked) return badWordError(bw);
  }
  try {
    var userName = '익명';
    try { var uDoc = await db.collection('users').doc(user.uid).get(); userName = uDoc.data().name || '익명'; } catch(e) {}
    
    await db.collection('ddays').add({
      title: data.title,
      date: data.date,
      emoji: data.emoji || '📅',
      category: data.category || '기타',
      isPublic: true,
      authorId: user.uid,
      authorName: userName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('D-Day 추가 오류:', error);
    return { success: false, error: error.message };
  }
}

// D-Day 목록 (인덱스 불필요 - 클라이언트 정렬)
async function firebaseGetDdays() {
  try {
    var snapshot = await db.collection('ddays').orderBy('createdAt', 'desc').limit(100).get();
    var ddays = [];
    
    snapshot.forEach(function(doc) {
      var data = doc.data();
      if (data.isPublic === false) return;
      
      // 날짜 문자열(YYYY-MM-DD)끼리 비교 (시간대 영향 없음)
      var parts = String(data.date).split('-');
      var targetUTC = Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      var tp = kstDateStr(0).split('-');
      var todayUTC = Date.UTC(parseInt(tp[0]), parseInt(tp[1]) - 1, parseInt(tp[2]));
      var diff = Math.round((targetUTC - todayUTC) / 86400000);
      
      ddays.push({
        id: doc.id,
        title: data.title,
        date: data.date,
        emoji: data.emoji || '📅',
        category: data.category || '기타',
        authorId: data.authorId,
        authorName: data.authorName || '익명',
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        dday: diff,
        ddayText: diff === 0 ? 'D-Day!' : diff > 0 ? 'D-' + diff : 'D+' + Math.abs(diff),
        isPast: diff < 0
      });
    });
    
    // 날짜순 정렬
    ddays.sort(function(a, b) { return a.dday - b.dday; });
    
    return { success: true, ddays: ddays };
  } catch (error) {
    console.error('D-Day 조회 오류:', error);
    return { success: false, ddays: [], error: error.message };
  }
}

// D-Day 삭제
async function firebaseDeleteDday(ddayId) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    var doc = await db.collection('ddays').doc(ddayId).get();
    if (!doc.exists) return { success: false, error: '일정 없음' };
    var data = doc.data();
    if (data.authorId !== user.uid && !isAdmin) {
      return { success: false, error: '권한 없음' };
    }
    await db.collection('ddays').doc(ddayId).delete();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

console.log('📅 D-Day 캘린더 모듈 로드 완료!');
