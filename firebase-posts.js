/* ========================================
   📋 게시글 기능 - Firebase (카테고리 시스템)
   ======================================== */

// 카테고리 정의
const POST_CATEGORIES = [
  { id: '전체', icon: '📋', color: 'from-slate-100 to-slate-200', text: 'text-slate-700' },
  { id: '💬 자유게시판', icon: '💬', color: 'from-blue-100 to-blue-200', text: 'text-blue-700' },
  { id: '💪 헬스/운동', icon: '💪', color: 'from-orange-100 to-orange-200', text: 'text-orange-700' },
  { id: '🎮 게임', icon: '🎮', color: 'from-purple-100 to-purple-200', text: 'text-purple-700' },
  { id: '📈 주식/투자', icon: '📈', color: 'from-green-100 to-green-200', text: 'text-green-700' },
  { id: '🍔 맛집/요리', icon: '🍔', color: 'from-red-100 to-red-200', text: 'text-red-700' },
  { id: '✈️ 여행', icon: '✈️', color: 'from-cyan-100 to-cyan-200', text: 'text-cyan-700' },
  { id: '💻 IT/테크', icon: '💻', color: 'from-indigo-100 to-indigo-200', text: 'text-indigo-700' },
  { id: '📚 취업/자기계발', icon: '📚', color: 'from-amber-100 to-amber-200', text: 'text-amber-700' },
  { id: '📷 사진/영상', icon: '📷', color: 'from-pink-100 to-pink-200', text: 'text-pink-700' }
];

// 카테고리 이름 비교용: 앞의 이모지·공백을 제거 ('💬 자유게시판' → '자유게시판')
function normalizeCategory(name) {
  return String(name || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

function getCategoryInfo(categoryName) {
  return POST_CATEGORIES.find(c => c.id === categoryName) || POST_CATEGORIES[1];
}

// 게시글 작성
async function firebaseCreatePost(data) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  // 객체 또는 개별 파라미터 둘 다 지원
  const title = typeof data === 'object' ? data.title : data;
  const content = typeof data === 'object' ? data.content : arguments[1];
  const category = typeof data === 'object' ? (data.category || '자유게시판') : '자유게시판';
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    const postRef = await db.collection('posts').add({
      title,
      content,
      category,
      authorId: user.uid,
      author: userData.name,
      authorName: userData.name,
      authorAvatar: userData.avatar || '😀',
      likes: [],
      likedBy: [],
      likeCount: 0,
      commentCount: 0,
      views: 0,
      isDeleted: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 작성자 게시글 수 증가
    await db.collection('users').doc(user.uid).update({
      posts: firebase.firestore.FieldValue.increment(1),
      points: firebase.firestore.FieldValue.increment(10)
    });
    
    return { success: true, postId: postRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 게시글 목록 (카테고리 필터 지원)
async function firebaseGetPosts(options = {}) {
  try {
    let query = db.collection('posts')
      .orderBy('createdAt', 'desc');
    
    if (options.limit) query = query.limit(options.limit);
    
    const snapshot = await query.get();
    const posts = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.isDeleted === true) return;
      // 카테고리 필터
      if (options.category && options.category !== '전체' && normalizeCategory(data.category) !== normalizeCategory(options.category)) return;
      posts.push({
        id: doc.id,
        ...data,
        author: data.author || data.authorName,
        authorName: data.authorName || data.author,
        likes: data.likeCount || (data.likes?.length || 0),
        likeCount: data.likeCount || (data.likes?.length || 0),
        createdAt: data.createdAt?.toDate()
      });
    });
    
    return { success: true, posts };
  } catch (error) {
    console.error('게시글 조회 오류:', error);
    return { success: false, posts: [], error: error.message };
  }
}

// 게시글 상세
async function firebaseGetPost(postId) {
  try {
    const doc = await db.collection('posts').doc(postId).get();
    if (!doc.exists) return { success: false, error: '게시글 없음' };
    
    // 조회수 증가
    await db.collection('posts').doc(postId).update({
      views: firebase.firestore.FieldValue.increment(1)
    });
    
    const data = doc.data();
    
    // 댓글 가져오기
    let comments = [];
    try {
      const commentsSnap = await db.collection('posts').doc(postId)
        .collection('comments')
        .orderBy('createdAt', 'asc')
        .get();
      commentsSnap.forEach(c => {
        const cd = c.data();
        comments.push({
          id: c.id,
          author: cd.authorName || cd.author,
          avatar: cd.authorAvatar || '😀',
          content: cd.content,
          createdAt: cd.createdAt?.toDate()
        });
      });
    } catch (e) { console.error('댓글 로드 오류:', e); }
    
    return {
      success: true,
      post: {
        id: doc.id,
        ...data,
        author: data.author || data.authorName,
        authorName: data.authorName || data.author,
        likes: data.likeCount || (data.likes?.length || 0),
        likeCount: data.likeCount || (data.likes?.length || 0),
        likedBy: data.likedBy || data.likes || [],
        comments,
        createdAt: data.createdAt?.toDate()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 게시글 좋아요
async function firebaseToggleLike(postId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    
    if (!postDoc.exists) return { success: false, error: '게시글 없음' };
    
    const data = postDoc.data();
    const likedBy = data.likedBy || data.likes || [];
    const hasLiked = likedBy.includes(user.uid);
    
    if (hasLiked) {
      await postRef.update({
        likes: firebase.firestore.FieldValue.arrayRemove(user.uid),
        likedBy: firebase.firestore.FieldValue.arrayRemove(user.uid),
        likeCount: firebase.firestore.FieldValue.increment(-1)
      });
    } else {
      await postRef.update({
        likes: firebase.firestore.FieldValue.arrayUnion(user.uid),
        likedBy: firebase.firestore.FieldValue.arrayUnion(user.uid),
        likeCount: firebase.firestore.FieldValue.increment(1)
      });
      // 좋아요 알림
      try {
        const postAuthorId = data.authorId;
        if (postAuthorId && postAuthorId !== user.uid && typeof firebaseCreateNotification === 'function') {
          const fromDoc = await db.collection('users').doc(user.uid).get();
          const fromName = fromDoc.data()?.name || '누군가';
          firebaseCreateNotification(postAuthorId, {
            type: 'like', title: '좋아요',
            message: `${fromName}님이 회원님의 글을 좋아합니다`,
            fromId: user.uid, fromName, linkType: 'post', linkId: postId
          });
        }
      } catch (e) {}
    }
    
    return { success: true, liked: !hasLiked };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 게시글 삭제 (본인 + 관리자)
async function firebaseDeletePost(postId) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    const postDoc = await db.collection('posts').doc(postId).get();
    if (postDoc.data().authorId !== user.uid && !isAdmin) return { success: false, error: '권한 없음' };
    await db.collection('posts').doc(postId).update({ isDeleted: true, deletedAt: firebase.firestore.FieldValue.serverTimestamp() });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

// 게시글 수정
async function firebaseEditPost(postId, data) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    const postDoc = await db.collection('posts').doc(postId).get();
    if (postDoc.data().authorId !== user.uid) return { success: false, error: '권한 없음' };
    await db.collection('posts').doc(postId).update({
      title: data.title, content: data.content, category: data.category,
      editedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

// 인기글 (좋아요+조회수 기반)
async function firebaseGetHotPosts() {
  try {
    const snapshot = await db.collection('posts').orderBy('likeCount', 'desc').limit(50).get();
    const posts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.isDeleted === true) return;
      const score = (data.likeCount || 0) * 3 + (data.views || 0) + (data.commentCount || 0) * 2;
      posts.push({ id: doc.id, ...data, author: data.author || data.authorName, authorName: data.authorName || data.author, likeCount: data.likeCount || 0, score, createdAt: data.createdAt?.toDate() });
    });
    posts.sort((a, b) => b.score - a.score);
    return { success: true, posts: posts.slice(0, 20) };
  } catch (error) { return { success: false, posts: [] }; }
}

// 신고
async function firebaseReportContent(data) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    await db.collection('reports').add({
      type: data.type,
      targetId: data.targetId,
      targetTitle: data.targetTitle || '',
      targetAuthorId: data.targetAuthorId || '',
      reason: data.reason,
      reporterId: user.uid,
      reporterName: currentUser?.name || '익명',
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

// 내 활동 통계
async function firebaseGetMyStats() {
  const user = auth.currentUser;
  if (!user) return { stats: {} };
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const ud = userDoc.data() || {};
    const postsSnap = await db.collection('posts').where('authorId', '==', user.uid).get();
    let totalLikes = 0, totalViews = 0, postCount = 0;
    postsSnap.forEach(doc => { const d = doc.data(); if (d.isDeleted !== true) { postCount++; totalLikes += d.likeCount || 0; totalViews += d.views || 0; } });
    const attendSnap = await db.collection('attendance').where('userId', '==', user.uid).get();
    return { success: true, stats: { posts: postCount, comments: ud.comments || 0, points: ud.points || 0, totalLikes, totalViews, attendanceDays: attendSnap.size, grade: ud.grade || '🌱 새싹', joinDate: ud.createdAt?.toDate() } };
  } catch (error) { return { success: false, stats: {} }; }
}

console.log('📋 게시글 모듈 로드 완료!');

// 내 게시글
async function firebaseGetMyPosts() {
  const user = auth.currentUser;
  if (!user) return { posts: [] };
  try {
    const snapshot = await db.collection('posts')
      .where('authorId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .get();
    const posts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.isDeleted === true) return;
      posts.push({ id: doc.id, ...data, createdAt: data.createdAt?.toDate() });
    });
    return { success: true, posts };
  } catch (error) {
    return { success: false, posts: [], error: error.message };
  }
}

// 북마크 목록
async function firebaseGetBookmarks() {
  const user = auth.currentUser;
  if (!user) return { posts: [] };
  try {
    const userDataDoc = await db.collection('userData').doc(user.uid).get();
    const bookmarks = userDataDoc.exists ? (userDataDoc.data().bookmarks || []) : [];
    if (!bookmarks.length) return { success: true, posts: [] };
    
    const posts = [];
    for (const postId of bookmarks.slice(0, 20)) {
      const postDoc = await db.collection('posts').doc(postId).get();
      if (postDoc.exists && postDoc.data().isDeleted !== true) {
        const data = postDoc.data();
        posts.push({ id: postDoc.id, ...data, author: data.author || data.authorName, createdAt: data.createdAt?.toDate() });
      }
    }
    return { success: true, posts };
  } catch (error) {
    return { success: false, posts: [] };
  }
}

// 게시글 검색
async function firebaseSearchPosts(keyword) {
  if (!keyword || keyword.length < 1) return { success: false, posts: [] };
  
  try {
    // Firestore는 full-text 검색을 지원하지 않으므로 전체 로드 후 클라이언트 필터
    const snapshot = await db.collection('posts')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const lowerKeyword = keyword.toLowerCase();
    const posts = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.isDeleted === true) return;
      const title = (data.title || '').toLowerCase();
      const content = (data.content || '').toLowerCase();
      const author = (data.authorName || data.author || '').toLowerCase();
      
      if (title.includes(lowerKeyword) || content.includes(lowerKeyword) || author.includes(lowerKeyword)) {
        posts.push({
          id: doc.id,
          ...data,
          author: data.author || data.authorName,
          authorName: data.authorName || data.author,
          likes: data.likeCount || 0,
          likeCount: data.likeCount || 0,
          createdAt: data.createdAt?.toDate()
        });
      }
    });
    
    return { success: true, posts };
  } catch (error) {
    return { success: false, posts: [], error: error.message };
  }
}

// 고정 공지 가져오기
async function firebaseGetPinnedNotices() {
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
    // 인덱스 없을 경우 대비
    try {
      const snapshot2 = await db.collection('notices')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      const notices = [];
      snapshot2.forEach(doc => {
        const data = doc.data();
        if (data.isActive !== false) {
          notices.push({ id: doc.id, ...data, createdAt: data.createdAt?.toDate() });
        }
      });
      return { success: true, notices };
    } catch (e2) {
      return { success: false, notices: [] };
    }
  }
}


// 기존 게시글 전부 삭제 + 샘플 추가 (카테고리당 10개 = 총 90개)
async function firebaseResetAndSeedPosts() {
  try {
    const existing = await db.collection('posts').get();
    const docs = [];
    existing.forEach(doc => docs.push(doc.ref));
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      docs.slice(i, i + 400).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    const samples = [
      {c:'💬 자유게시판',t:'요즘 날씨 진짜 미쳤다 ㅋㅋ',b:'아침에 반팔 입고 나갔다가 저녁에 패딩 입고 싶어진 사람 나만 있어?ㅋㅋ 환절기 건강 조심하세요!',n:'날씨요정',a:'🌤️'},
      {c:'💬 자유게시판',t:'편의점 신상 과자 추천',b:'불닭볶음면 까르보나라 버전 진짜 맛있음! 매운거 약한 사람도 가능. 강추 👍',n:'편의점헌터',a:'🛒'},
      {c:'💬 자유게시판',t:'주말에 뭐하고 놀지 추천 좀',b:'서울 근교 당일치기 갈 수 있는 곳 추천! 자연 쪽이면 좋겠어요 🏔️',n:'주말뭐하지',a:'🤔'},
      {c:'💬 자유게시판',t:'넷플릭스 드라마 추천 좀요',b:'최근 드라마 다 봐서 뭐 볼지 모르겠어요. 스릴러나 SF 좋아하는데 추천!',n:'집콕러',a:'🍿'},
      {c:'💬 자유게시판',t:'고양이 vs 강아지 뭐가 더 좋아?',b:'첫 반려동물 입양 고민 중. 고양이파 강아지파 의견 좀! 자취 원룸임.',n:'동물사랑',a:'🐾'},
      {c:'💬 자유게시판',t:'아침형 인간 되는 법',b:'매일 알람 5개 맞춰놓는데 다 끄고 다시 잠ㅋㅋ 성공한 사람 비결 좀...',n:'늦잠왕',a:'😴'},
      {c:'💬 자유게시판',t:'MBTI별 특징 ㄹㅇ 맞는듯',b:'INFP인데 혼자 있는 거 좋아하고 감성적인 거 완전 맞음ㅋ 다들 MBTI 뭐?',n:'MBTI덕후',a:'🧠'},
      {c:'💬 자유게시판',t:'요즘 핫한 밈 모음',b:'요즘 유행하는 밈들 정리! 댓글로 아는 밈 공유해주세요ㅋㅋ',n:'밈수집가',a:'😂'},
      {c:'💬 자유게시판',t:'자취 꿀팁 공유합니다',b:'빨래는 바로바로, 냉동실 활용, 다이소 필수, 음식물 쓰레기는 냉동보관!',n:'자취고수',a:'🏠'},
      {c:'💬 자유게시판',t:'오늘 하루 칭찬 릴레이',b:'오늘 힘들었을 여러분 수고했어요! 댓글로 칭찬 한마디씩 남겨봐요 😊',n:'칭찬봇',a:'💕'},
      {c:'💪 헬스/운동',t:'3개월 벌크업 후기',b:'벤치프레스 40kg→70kg! 식단은 닭가슴살+고구마. 프로틴 하루 2번. 질문 받아요~',n:'헬린이탈출',a:'💪'},
      {c:'💪 헬스/운동',t:'런닝화 추천 (15만원대)',b:'나이키 페가수스40 vs 뉴발란스 1080 vs 아식스 젤님버스. 결론은 아식스!',n:'런닝초보',a:'👟'},
      {c:'💪 헬스/운동',t:'홈트 루틴 공유 (기구 없음)',b:'푸쉬업 20x3, 스쿼트 30x3, 플랭크 1분x3, 버피 10x3. 매일 30분!',n:'홈트왕',a:'🏋️'},
      {c:'💪 헬스/운동',t:'수영 배우기 어렵다',b:'자유형 숨쉬기 너무 힘들어요ㅠ 수영 고수분들 팁 좀!',n:'물개꿈나무',a:'🏊'},
      {c:'💪 헬스/운동',t:'다이어트 식단 2주차',b:'간헐적 단식 16:8 하면서 2주 만에 2kg 빠짐! 근데 배고파 죽겠음...',n:'다이어터',a:'🥗'},
      {c:'💪 헬스/운동',t:'스쿼트 자세 교정 필요',b:'스쿼트할 때 무릎이 안쪽으로 모이는데 어떻게 교정하나요?',n:'자세교정',a:'🦵'},
      {c:'💪 헬스/운동',t:'클라이밍 입문 2개월차',b:'처음에 5급도 못 했는데 이제 4급 클리어! 팔 근육이 눈에 보임ㅋ',n:'클라이머',a:'🧗'},
      {c:'💪 헬스/운동',t:'프로틴 파우더 추천',b:'옵티멈 골드스탠다드 vs 마이프로틴 뭐가 나을까요? 맛+가성비 기준!',n:'단백질충',a:'🥤'},
      {c:'💪 헬스/운동',t:'요가 vs 필라테스',b:'유연성 기르고 싶은데 둘 중 뭐가 효과 좋을까요? 둘 다 해본 분?',n:'유연해지고파',a:'🧘'},
      {c:'💪 헬스/운동',t:'오운완 인증!',b:'데드리프트 100kg 성공! 헬스 6개월 만에 3대 운동 100kg 달성 🎉',n:'오운완',a:'🏆'},
      {c:'🎮 게임',t:'발로란트 골드 탈출 팁',b:'제트 원탑인데 골드3에서 한달째... 감도나 크로스헤어 추천! 듀오 구함.',n:'게임중독자',a:'🎮'},
      {c:'🎮 게임',t:'GTA6 출시일 확정!!',b:'2025년 가을 출시! 트레일러 소름... PS5 사야하나 PC 기다려야하나',n:'콘솔러',a:'🕹️'},
      {c:'🎮 게임',t:'스팀 세일 추천작 TOP5',b:'발더스게이트3, 엘든링, 하데스2, 팔월드. 다 갓겜입니다!',n:'스팀지갑파괴',a:'🎯'},
      {c:'🎮 게임',t:'롤 이번 시즌 탑 챔프',b:'탑 라인 메인인데 티어 챔프가 뭔가요? 가렌은 질림ㅋ',n:'롤러',a:'⚔️'},
      {c:'🎮 게임',t:'닌텐도 스위치2 살 사람?',b:'내년 출시인데 예약해야 할지... 스위치 팔아야 하나? 40만원대',n:'닌텐도팬',a:'🎲'},
      {c:'🎮 게임',t:'마인크래프트 서버 같이 할 사람',b:'자바 에디션 서버 열었는데 같이 할 사람! 서바이벌 모드. 디코 있어요!',n:'마크장인',a:'⛏️'},
      {c:'🎮 게임',t:'원신 4.0 업데이트 리뷰',b:'퀀트린 너무 이쁨! 수중 탐험 재밌는데 레진 부족... 무과금 슬픔',n:'원신러',a:'⭐'},
      {c:'🎮 게임',t:'PS5 vs Xbox 뭐 살까',b:'독점작은 PS5인데 게임패스 생각하면 Xbox도... 선택장애',n:'콘솔고민',a:'🎮'},
      {c:'🎮 게임',t:'무과금 모바일 게임 추천',b:'명일방주, 블루아카이브, 림버스컴퍼니, 쿠키런킹덤. 다 무과금 가능!',n:'모바일게이머',a:'📱'},
      {c:'🎮 게임',t:'게임 방송 시작하려는데',b:'트위치 방송 OBS 세팅이나 장비 추천 좀 해주세요!',n:'예비스트리머',a:'📺'},
      {c:'📈 주식/투자',t:'ETF vs 개별주 뭐가 나을까',b:'사회초년생 월 50만원. ETF 안전한데 수익률이... 조언!',n:'주린이',a:'📊'},
      {c:'📈 주식/투자',t:'미국 배당주 포트 공유',b:'AAPL/MSFT/KO/JNJ/SCHD. 월 배당 약 30만원!',n:'배당투자자',a:'💵'},
      {c:'📈 주식/투자',t:'코인 지금 진입해도?',b:'비트코인 또 오르는데 지금 괜찮을까요? 조정 기다려야?',n:'코인고민',a:'🪙'},
      {c:'📈 주식/투자',t:'적금 vs 투자 현실 비교',b:'적금 4% vs 주식. 결론: 초보는 적금+ETF 반반이 최고!',n:'재테크초보',a:'🏦'},
      {c:'📈 주식/투자',t:'부동산 vs 주식',b:'종잣돈 5000만원 부동산 vs 주식 장단점 비교해봐요',n:'투자고민',a:'🏠'},
      {c:'📈 주식/투자',t:'삼성전자 지금 사도?',b:'52주 신저가 근처인데 물타기 vs 손절... 장기 관점 의견 좀',n:'삼전홀더',a:'📉'},
      {c:'📈 주식/투자',t:'ISA 계좌 꼭 만드세요',b:'연 2000만원까지 비과세! 아직 안 만든 분들 빨리요!',n:'절세고수',a:'💰'},
      {c:'📈 주식/투자',t:'연금저축 vs IRP',b:'세액공제 받으려면 둘 다 좋은데 하나만 한다면?',n:'연금준비',a:'👴'},
      {c:'📈 주식/투자',t:'테슬라 실적 후 전망',b:'이번 분기 실적 좋았는데 주가 빠짐. 이유가 뭘까요?',n:'테슬라분석',a:'🚗'},
      {c:'📈 주식/투자',t:'월 100만원 투자 포트',b:'ETF 50만/적금 30만/코인 10만/비상금 10만. 어떤가요?',n:'월급투자',a:'💼'},
      {c:'🍔 맛집/요리',t:'홍대 라멘 맛집 발견',b:'돈코츠라멘이 일본 현지급! 자가제면+차슈. 웨이팅 없을 때 가세요',n:'맛집탐험가',a:'🍜'},
      {c:'🍔 맛집/요리',t:'자취생 파스타 레시피',b:'올리브유+마늘+베이컨, 면수 2스푼, 계란 노른자. 10분 완성! 🍝',n:'자취요리왕',a:'👨‍🍳'},
      {c:'🍔 맛집/요리',t:'강남역 점심 맛집 TOP5',b:'직장인 점심! 도보 5분 한식/일식/양식/분식/카레 정리',n:'강남직장인',a:'🍱'},
      {c:'🍔 맛집/요리',t:'에어프라이어 치킨',b:'튀김가루+카레가루 180도 20분! 치킨집 80% 퀄리티',n:'에프마스터',a:'🍗'},
      {c:'🍔 맛집/요리',t:'성수동 신상 카페',b:'인테리어 미쳤고 디저트 맛있어요. 사진 찍기 좋음!',n:'카페투어러',a:'☕'},
      {c:'🍔 맛집/요리',t:'떡볶이 레시피 (분식집 맛)',b:'고추장2T+설탕1T+간장1T+고춧가루1T+물엿. 이 비율이면 완벽!',n:'떡볶이장인',a:'🌶️'},
      {c:'🍔 맛집/요리',t:'을지로 노포 맛집 탐방',b:'40년 냉면집, 30년 칼국수집 다 가봤어요!',n:'노포헌터',a:'🏚️'},
      {c:'🍔 맛집/요리',t:'편의점 조합 레시피 BEST',b:'삼각김밥+컵라면 기본! 불닭+치즈+밥이 신세계',n:'편의점셰프',a:'🏪'},
      {c:'🍔 맛집/요리',t:'혼밥 좋은 식당 추천',b:'라멘집/국밥집/덮밥집/쌀국수집. 혼자 가도 눈치 안 보임!',n:'혼밥러',a:'🍚'},
      {c:'🍔 맛집/요리',t:'배달앱 할인 꿀팁',b:'배민/쿠팡이츠/요기요 할인 쿠폰 정리! 첫 주문 쿠폰 돌려쓰기ㅋ',n:'배달고수',a:'🛵'},
      {c:'✈️ 여행',t:'오사카 3박4일 가성비 코스',b:'도톤보리→구로몬→유니버셜→교토→신사이바시. 총 80만원!',n:'여행자',a:'✈️'},
      {c:'✈️ 여행',t:'제주도 드라이브 코스',b:'렌트카로 동쪽→남쪽→서쪽! 숙소는 애월 추천',n:'제주러버',a:'🏝️'},
      {c:'✈️ 여행',t:'유럽 배낭여행 꿀팁',b:'유레일패스 필수, 호스텔 2주 전 예약, 마트 활용, 도난 조심!',n:'배낭여행자',a:'🎒'},
      {c:'✈️ 여행',t:'방콕 총정리',b:'카오산로드 야시장, 왕궁 오전, 마사지 2시간 만원!',n:'동남아마스터',a:'🌴'},
      {c:'✈️ 여행',t:'후쿠오카 당일치기',b:'부산에서 배 3시간! 캐널시티→텐진→나카스. 왕복 10만원',n:'후쿠오카러',a:'🚢'},
      {c:'✈️ 여행',t:'국내 글램핑 추천 TOP3',b:'커플 가평, 가족 양평, 친구 포천!',n:'글램핑러',a:'⛺'},
      {c:'✈️ 여행',t:'비행기 좌석 꿀팁',b:'비상구 레그룸 넓음, 창가 A/K, 뒷좌석 피하기. 48시간 전 체크인!',n:'항공덕후',a:'🛩️'},
      {c:'✈️ 여행',t:'베트남 다낭 5일',b:'바나힐→미케비치→호이안→마블마운틴. 100만원 이하!',n:'다낭러버',a:'🏖️'},
      {c:'✈️ 여행',t:'호텔 예약 사이트 비교',b:'아고다 vs 부킹 vs 호텔스닷컴. 아시아는 아고다가 제일 쌈!',n:'호텔헌터',a:'🏨'},
      {c:'✈️ 여행',t:'여행 짐 싸기 체크리스트',b:'여권/충전기/세면도구/상비약/여벌옷. 압축팩 필수!',n:'짐싸기달인',a:'🧳'},
      {c:'💻 IT/테크',t:'M4 맥북 vs 갤럭시북4',b:'성능 M4, 화면 갤럭시북, 배터리 M4 압승. 생태계 따라 선택!',n:'테크덕후',a:'💻'},
      {c:'💻 IT/테크',t:'ChatGPT vs Claude',b:'코딩 Claude, 창작 GPT, 문서분석 Claude. 둘 다 쓰세요ㅋ',n:'AI덕후',a:'🤖'},
      {c:'💻 IT/테크',t:'아이폰16 한달 후기',b:'카메라 좋아짐, 배터리 하루 가요. USB-C 귀찮ㅋ',n:'애플빠',a:'📱'},
      {c:'💻 IT/테크',t:'코딩 독학 로드맵',b:'HTML→JS→React→Node→프로젝트3개. 6개월이면 취업!',n:'개발자꿈',a:'👩‍💻'},
      {c:'💻 IT/테크',t:'기계식 키보드 추천',b:'레오폴드 FC660M 가성비 최고. 갈축 올라운더. PBT 키캡!',n:'키보드덕후',a:'⌨️'},
      {c:'💻 IT/테크',t:'윈도우 11 최적화',b:'시작 프로그램 정리, 고성능 모드, 불필요 서비스 끄기. 체감 2배!',n:'윈도우마스터',a:'🖥️'},
      {c:'💻 IT/테크',t:'개발자 모니터 추천',b:'27인치 4K 코딩 최적. LG 27UL850 가성비. 듀얼이면 생산성 2배!',n:'모니터헌터',a:'🖥️'},
      {c:'💻 IT/테크',t:'깃허브 꿀팁 정리',b:'PR 리뷰, 커밋 컨벤션, 브랜치 전략, 깃 플로우 총정리',n:'깃마스터',a:'🐙'},
      {c:'💻 IT/테크',t:'VS Code 필수 확장',b:'Prettier, ESLint, GitLens, Auto Rename Tag, Live Server. 필수!',n:'코드편집기왕',a:'📝'},
      {c:'💻 IT/테크',t:'스마트홈 구축 후기',b:'알렉사+스마트전구+로봇청소기+스마트플러그. 50만원으로 미래!',n:'IoT덕후',a:'🏠'},
      {c:'📚 취업/자기계발',t:'비전공자 개발자 취업 후기',b:'문과→부트캠프 6개월→신입 개발자! JS+React, 포폴 3개. 질문 환영!',n:'코딩뉴비',a:'🧑‍💻'},
      {c:'📚 취업/자기계발',t:'토익 400→900 공부법',b:'매일 단어 50개, 쉐도잉, 모의고사 주2회, 영어 유튜브. 꾸준함이 답!',n:'영어정복자',a:'📖'},
      {c:'📚 취업/자기계발',t:'면접 합격 비결 5가지',b:'자소서 숫자, STAR 기법, 역질문, 회사 뉴스 파악, 첫인상!',n:'취준성공',a:'🎓'},
      {c:'📚 취업/자기계발',t:'재택근무 생산성 꿀팁',b:'출근시간 정하기, 공간 분리, 포모도로, 점심 산책 15분',n:'재택러',a:'🏠'},
      {c:'📚 취업/자기계발',t:'이력서 잘 쓰는 법',b:'핵심: 수치화! 매출 증가→매출 30% 증가. 경험을 성과로!',n:'이력서코치',a:'📄'},
      {c:'📚 취업/자기계발',t:'직장인 투잡 후기 (블로그)',b:'퇴근 후 블로그 6개월차. 월 부수입 50만원! 꾸준히가 핵심',n:'투잡러',a:'💻'},
      {c:'📚 취업/자기계발',t:'취업용 자격증 TOP5',b:'정보처리기사, SQLD, ADsP, 컴활1급, 한능검. 스펙 충분!',n:'자격증왕',a:'📜'},
      {c:'📚 취업/자기계발',t:'독서 습관 만들기',b:'매일 20페이지! 한달 1권, 1년 12권. 작게 시작이 비결',n:'독서러',a:'📚'},
      {c:'📚 취업/자기계발',t:'대학원 vs 취업 고민',b:'석사 2년 vs 바로 취업. 현직자분들 의견 궁금합니다',n:'진로고민',a:'🤷'},
      {c:'📚 취업/자기계발',t:'사이드 프로젝트 아이디어',b:'포폴용: 날씨앱, 가계부, 할일관리, 블로그. 코드 공유!',n:'프로젝트왕',a:'🛠️'},
      {c:'📷 사진/영상',t:'야경 사진 공유 (아이폰)',b:'남산타워 나이트모드+노출 3초면 DSLR급! 폰카 충분!',n:'사진쟁이',a:'📸'},
      {c:'📷 사진/영상',t:'유튜브 입문 장비',b:'소니 ZV-1 + 로데 마이크 + 엘가토 조명. 총 150만원 프로급!',n:'유튜브준비생',a:'🎬'},
      {c:'📷 사진/영상',t:'라이트룸 보정 팁',b:'화이트밸런스→노출→대비→채도→비네팅. 이것만 해도 확 달라짐!',n:'보정마스터',a:'🎨'},
      {c:'📷 사진/영상',t:'드론 촬영 입문',b:'DJI Mini4 Pro 249g, 4K, 30분 비행. 여행 필수템!',n:'드론파일럿',a:'🚁'},
      {c:'📷 사진/영상',t:'폰카 사진 잘 찍는 법',b:'격자선, 빛방향, 낮은 앵글, 여백 활용, 연사 후 골라내기!',n:'폰카마스터',a:'📱'},
      {c:'📷 사진/영상',t:'영상 편집 프로그램 비교',b:'초보 파컷, 전문가 프리미어, 색보정 다빈치. 용도별 선택!',n:'편집러',a:'🎞️'},
      {c:'📷 사진/영상',t:'카메라 입문 추천 (100만원)',b:'소니 a6400 가성비 최고. 시그마 30mm f1.4 인물사진 예술!',n:'카메라입문',a:'📷'},
      {c:'📷 사진/영상',t:'브이로그 촬영 꿀팁',b:'짐벌 필수! 오즈모 모바일. B컷 많이, BGM은 유튜브 라이브러리',n:'브이로거',a:'🎥'},
      {c:'📷 사진/영상',t:'서울 감성 사진 스팟',b:'성수동/익선동/연남동/을지로/한남동 골목 감성 정리!',n:'감성사진가',a:'🌆'},
      {c:'📷 사진/영상',t:'사진 인화 서비스 비교',b:'스냅스 vs 포토몬 vs 카카오. 가격/품질/배송. 결론은 스냅스!',n:'인화러',a:'🖼️'},
    ];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const fakeDate = new Date();
      fakeDate.setMinutes(fakeDate.getMinutes() - (samples.length - i) * 19);
      await db.collection('posts').add({
        title:s.t, content:s.b, category:s.c,
        authorId:'sample_user_'+i, author:s.n, authorName:s.n, authorAvatar:s.a,
        likes:[], likedBy:[], likeCount:Math.floor(Math.random()*30)+1, commentCount:Math.floor(Math.random()*12),
        views:Math.floor(Math.random()*300)+20, isDeleted:false,
        createdAt:firebase.firestore.Timestamp.fromDate(fakeDate)
      });
    }
    return { success:true, deleted:docs.length, added:samples.length };
  } catch(error) {
    console.error('리셋 오류:', error);
    return { success:false, error:error.message };
  }
}
