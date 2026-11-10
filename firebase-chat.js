/* ========================================
   💬 실시간 채팅 - Firebase (주제별 채팅방, 인덱스 불필요)
   ======================================== */

var CHAT_ROOMS = [
  { id: 'general', name: '🏠 자유 채팅', desc: '아무 주제나 편하게!' },
  { id: 'game', name: '🎮 게임', desc: '게임 이야기' },
  { id: 'music', name: '🎵 음악', desc: '음악 추천/공유' },
  { id: 'study', name: '📚 공부', desc: '스터디/질문' },
  { id: 'humor', name: '😂 유머', desc: '웃긴 이야기' }
];

var chatUnsubscribe = null;
var currentChatRoom = 'general';

function firebaseStartChatListener(roomId, callback) {
  if (chatUnsubscribe) chatUnsubscribe();
  currentChatRoom = roomId || 'general';
  
  // chatRooms/{roomId}/messages 또는 기존 chatMessages에서 리스닝
  var ref = db.collection('chatRooms').doc(currentChatRoom).collection('messages');
  
  chatUnsubscribe = ref
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(function(snapshot) {
      var messages = [];
      snapshot.forEach(function(doc) {
        var data = doc.data();
        if (data.isDeleted === true) return;
        messages.push({ id: doc.id, message: data.message, userId: data.userId, userName: data.userName, userAvatar: data.userAvatar, isDeleted: data.isDeleted, createdAt: data.createdAt ? data.createdAt.toDate() : null });
      });
      messages.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      callback(messages);
    }, function(error) {
      console.error('채팅 리스너 오류:', error);
      // 에러 시 빈 콜백
      callback([]);
    });
}

function firebaseStopChatListener() {
  if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }
}

async function firebaseSendMessage(message, roomId) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  if (typeof checkBadWords === 'function') {
    var bw = checkBadWords(message);
    if (bw.blocked) return badWordError(bw);
  }
  var room = roomId || currentChatRoom || 'general';
  if (typeof message !== 'string' || !message.trim()) return { success: false, error: '메시지를 입력하세요' };
  if (message.length > 500) return { success: false, error: '메시지는 500자까지 가능합니다' };
  try {
    // 관리자가 채팅 금지(뮤트)한 사용자 차단
    try {
      var muteDoc = await db.collection('chatMutes').doc(room + '_' + user.uid).get();
      if (muteDoc.exists) {
        var until = muteDoc.data({ __raw: true }).until;
        if (until && until.toDate && until.toDate() > new Date()) {
          return { success: false, error: '🔇 채팅이 제한된 상태입니다. (해제: ' + until.toDate().toLocaleString('ko-KR') + ')' };
        }
      }
    } catch (e) {}
    var userDoc = await db.collection('users').doc(user.uid).get();
    var userData = userDoc.data();
    await db.collection('chatRooms').doc(room).collection('messages').add({
      message: message, userId: user.uid, userName: userData.name || '익명',
      userAvatar: userData.avatar || '😀', isDeleted: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

async function firebaseDeleteMessage(messageId, roomId) {
  var room = roomId || currentChatRoom || 'general';
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var ref = db.collection('chatRooms').doc(room).collection('messages').doc(messageId);
    var doc = await ref.get();
    if (!doc.exists) return { success: false, error: '메시지 없음' };
    if (doc.data().userId !== user.uid && !(typeof isAdmin !== 'undefined' && isAdmin === true)) return { success: false, error: '권한 없음' };
    await ref.update({ isDeleted: true });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

async function firebaseGetOnlineCount() {
  try {
    var fiveMinAgo = firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 5 * 60000));
    var snap = await db.collection('userPresence').where('lastSeen', '>', fiveMinAgo).limit(500).get();
    return snap.size;
  } catch (e) { return 0; }
}

async function firebaseUpdatePresence() {
  var user = auth.currentUser;
  if (!user) return;
  try {
    await db.collection('userPresence').doc(user.uid).set({
      userId: user.uid, lastSeen: firebase.firestore.FieldValue.serverTimestamp(), online: true
    }, { merge: true });
  } catch (e) {}
}

console.log('💬 채팅 모듈 로드 완료!');
