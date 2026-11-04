/* ========================================
   🎰 미니게임 - Firebase
   ======================================== */

// 룰렛 결과 목록
const ROULETTE_PRIZES = [
  { id: 'jackpot',  name: '🎉 잭팟!',     points: 500, weight: 1,  color: '#ef4444' },
  { id: 'great',    name: '🌟 대박!',      points: 200, weight: 3,  color: '#f59e0b' },
  { id: 'good',     name: '😊 좋아요!',    points: 100, weight: 8,  color: '#10b981' },
  { id: 'nice',     name: '👍 괜찮아요',    points: 50,  weight: 15, color: '#3b82f6' },
  { id: 'soso',     name: '😐 그저그래',    points: 20,  weight: 25, color: '#8b5cf6' },
  { id: 'bad',      name: '😅 아쉬워요',    points: 10,  weight: 25, color: '#ec4899' },
  { id: 'worst',    name: '💀 꽝!',        points: 0,   weight: 15, color: '#6b7280' },
  { id: 'minus',    name: '😱 감점!',      points: -30, weight: 8,  color: '#1f2937' }
];

// 룰렛 돌리기 (1일 1회)
async function firebaseSpinRoulette() {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const spinId = `${today}_${user.uid}`;
    
    const existingDoc = await db.collection('roulette').doc(spinId).get();
    if (existingDoc.exists) {
      return { success: false, error: '오늘은 이미 돌렸습니다!', alreadySpun: true };
    }
    
    // 가중치 기반 랜덤 결과
    const totalWeight = ROULETTE_PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    let result = ROULETTE_PRIZES[0];
    
    for (const prize of ROULETTE_PRIZES) {
      random -= prize.weight;
      if (random <= 0) { result = prize; break; }
    }
    
    // 기록 저장
    await db.collection('roulette').doc(spinId).set({
      userId: user.uid,
      date: today,
      prizeId: result.id,
      prizeName: result.name,
      points: result.points,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 포인트 적용
    if (result.points !== 0) {
      const userDoc = await db.collection('users').doc(user.uid).get();
      const currentPoints = userDoc.data()?.points || 0;
      const newPoints = Math.max(0, currentPoints + result.points);
      await db.collection('users').doc(user.uid).update({ points: newPoints });
    }
    
    return { success: true, prize: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 오늘 룰렛 돌렸는지 확인
async function firebaseCheckRouletteToday() {
  const user = auth.currentUser;
  if (!user) return { spun: false };
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const doc = await db.collection('roulette').doc(`${today}_${user.uid}`).get();
    return { spun: doc.exists, result: doc.exists ? doc.data() : null };
  } catch (error) {
    return { spun: false };
  }
}

// 가위바위보 (포인트 베팅)
async function firebasePlayRPS(myChoice, betPoints) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  const bet = Math.abs(parseInt(betPoints) || 10);
  if (bet < 10) return { success: false, error: '최소 10P 이상 베팅해야 합니다' };
  if (bet > 10000) return { success: false, error: '최대 10000P까지 베팅 가능합니다' };
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const currentPoints = userDoc.data()?.points || 0;
    
    if (currentPoints < bet) return { success: false, error: '포인트가 부족합니다' };
    
    const choices = ['가위', '바위', '보'];
    const computerChoice = choices[Math.floor(Math.random() * 3)];
    
    let result, pointChange;
    if (myChoice === computerChoice) {
      result = 'draw'; pointChange = 0;
    } else if (
      (myChoice === '가위' && computerChoice === '보') ||
      (myChoice === '바위' && computerChoice === '가위') ||
      (myChoice === '보' && computerChoice === '바위')
    ) {
      result = 'win'; pointChange = bet;
    } else {
      result = 'lose'; pointChange = -bet;
    }
    
    // 포인트 적용
    const newPoints = Math.max(0, currentPoints + pointChange);
    await db.collection('users').doc(user.uid).update({ points: newPoints });
    
    // 기록 저장
    await db.collection('gameHistory').add({
      userId: user.uid,
      game: 'rps',
      myChoice,
      computerChoice,
      result,
      bet,
      pointChange,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, result, myChoice, computerChoice, pointChange, newPoints };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 숫자 맞추기 (1~10)
async function firebasePlayNumberGuess(guess) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  
  try {
    const answer = Math.floor(Math.random() * 10) + 1;
    const correct = parseInt(guess) === answer;
    const pointChange = correct ? 100 : -10;
    
    const userDoc = await db.collection('users').doc(user.uid).get();
    const currentPoints = userDoc.data()?.points || 0;
    
    if (currentPoints < 10 && !correct) return { success: false, error: '포인트가 부족합니다 (최소 10P)' };
    
    const newPoints = Math.max(0, currentPoints + pointChange);
    await db.collection('users').doc(user.uid).update({ points: newPoints });
    
    await db.collection('gameHistory').add({
      userId: user.uid,
      game: 'number',
      guess: parseInt(guess),
      answer,
      correct,
      pointChange,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, correct, answer, guess: parseInt(guess), pointChange, newPoints };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

console.log('🎰 미니게임 모듈 로드 완료!');
