/* ========================================
   🚀 c반놈들 - 완전판 (전체 기능 통합)
   ======================================== */
let isLoggedIn=false, currentUser={}, currentView='home', currentUserData=null, isAdmin=false;

// 유틸리티
function escapeHtml(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML;}
function stripEmoji(s){if(!s)return'';var r=s;var px=['💬 ','💪 ','🎮 ','📈 ','🍔 ','✈️ ','💻 ','📚 ','📷 ','📋 ','🏠 ','⭐ ','🔥 '];for(var i=0;i<px.length;i++){if(r.indexOf(px[i])===0){r=r.substring(px[i].length);break;}}var fc=r.search(/[가-힣a-zA-Z]/);if(fc>0)r=r.substring(fc);return r.trim();}
function formatDate(date){if(!date)return'';const d=date instanceof Date?date:date.toDate?date.toDate():new Date(date);const now=new Date(),diff=now-d;if(diff<60000)return'방금';if(diff<3600000)return`${Math.floor(diff/60000)}분 전`;if(diff<86400000)return`${Math.floor(diff/3600000)}시간 전`;if(diff<604800000)return`${Math.floor(diff/86400000)}일 전`;return`${d.getMonth()+1}/${d.getDate()}`;}
function formatTime(date){if(!date)return'';const d=date instanceof Date?date:new Date(date);return`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;}
function formatFullDate(date){if(!date)return'';const d=date instanceof Date?date:new Date(date);return`${d.getFullYear()}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getDate().toString().padStart(2,'0')}`;}

// 모달
function showModal(html){const c=document.getElementById('modal-container');c.innerHTML=html;c.classList.remove('hidden');}
function closeModal(){const c=document.getElementById('modal-container');c.innerHTML='';c.classList.add('hidden');}
function showToast(msg){const t=document.createElement('div');t.className='fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg z-[100] animate-fade-in text-sm';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3000);}
function showLoading(){const l=document.createElement('div');l.id='loading';l.className='fixed inset-0 bg-black/50 flex items-center justify-center z-[200]';l.innerHTML=`<div class="bg-white rounded-2xl p-6 text-center"><div class="animate-spin text-4xl mb-2">⏳</div><p class="text-slate-600">잠시만요...</p></div>`;document.body.appendChild(l);}
function hideLoading(){const l=document.getElementById('loading');if(l)l.remove();}

// 앱 시작
document.addEventListener('DOMContentLoaded',()=>{
  auth.onAuthStateChanged(async(user)=>{
    if(user){
      try{
        const userDoc=await db.collection('users').doc(user.uid).get();
        if(userDoc.exists){
          const ud=userDoc.data();
          if(ud.isBanned){await auth.signOut();showToast('⛔ 계정이 차단되었습니다.');return;}
          isLoggedIn=true;currentUser={uid:user.uid,...ud};isAdmin=ud.isAdmin===true;
          const udDoc=await db.collection('userData').doc(user.uid).get();
          if(udDoc.exists)currentUserData=udDoc.data();
          if(typeof firebaseUpdatePresence==='function'){firebaseUpdatePresence();setInterval(firebaseUpdatePresence,60000);}
        }
      }catch(e){console.error(e);}
    }else{isLoggedIn=false;currentUser={};currentUserData=null;isAdmin=false;}
    updateLoginUI();showView('home');
    updateMemberCount();
    if(isLoggedIn){ updateNotifBadge(); startRealtimeNotifListener(); showPopupNoticeIfAny(); }
  });
  // 당겨서 새로고침 (모바일)
  let _pullStartY=0,_pulling=false;
  document.addEventListener('touchstart',e=>{if(window.scrollY===0){_pullStartY=e.touches[0].clientY;_pulling=true;}});
  document.addEventListener('touchmove',e=>{if(!_pulling)return;const dy=e.touches[0].clientY-_pullStartY;if(dy>100){_pulling=false;showToast('🔄 새로고침...');showView(currentView);}});
  document.addEventListener('touchend',()=>{_pulling=false;});
});

// UI 업데이트
function updateLoginUI(){
  const s=document.getElementById('sidebar-login-area'),m=document.getElementById('mobile-profile-btn'),a=document.getElementById('admin-menu-sidebar');
  if(isLoggedIn){
    if(s)s.innerHTML=`<div onclick="showProfileMenu()" class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 cursor-pointer"><div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-xl">${currentUser.avatar||'😀'}</div><div class="flex-1 min-w-0"><div class="font-medium text-slate-800 truncate">${currentUser.name} ${isAdmin?'👑':''}</div><div class="text-xs text-slate-500">💎 ${(currentUser.points||0).toLocaleString()}P</div></div></div>`;
    if(m){m.innerHTML=currentUser.avatar||'😀';m.onclick=showProfileMenu;}
    if(a)a.classList.toggle('hidden',!isAdmin);
  }else{
    if(s)s.innerHTML=`<button onclick="showLoginModal()" class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg">로그인</button>`;
    if(m){m.innerHTML='👤';m.onclick=showLoginModal;}
    if(a)a.classList.add('hidden');
  }
}
async function updateMemberCount(){try{const r=await firebaseGetMemberCount();const el=document.getElementById('member-count-sidebar');if(el)el.textContent=r.count||0;}catch(e){}}

async function updateNotifBadge(){
  if(!isLoggedIn)return;
  try{
    const count=await firebaseGetUnreadNotifCount();
    const badge=document.getElementById('notif-badge');
    const mbadge=document.getElementById('notif-badge-mobile');
    if(badge){badge.classList.toggle('hidden',count===0);badge.textContent=count>9?'9+':count;}
    if(mbadge){mbadge.classList.toggle('hidden',count===0);mbadge.textContent=count>9?'9+':count;}
  }catch(e){}
}

// 실시간 알림 (폴링 방식 - 10초마다)
var _lastNotifCount = -1;
function startRealtimeNotifListener(){
  checkNewNotifs();
  setInterval(function(){ if(isLoggedIn) checkNewNotifs(); }, 10000);
}
async function checkNewNotifs(){
  try {
    var count = await firebaseGetUnreadNotifCount();
    // 첫 호출은 기준값만 저장 (로그인 시 기존 알림 팝업 방지)
    if (_lastNotifCount === -1) { _lastNotifCount = count; updateNotifBadge(); return; }
    // 새 알림이 생겼을 때만 팝업
    if (count > _lastNotifCount) {
      var r = await firebaseGetNotifications();
      var unread = (r.notifications||[]).filter(function(n){ return !n.isRead; });
      if (unread.length > 0) {
        var n = unread[0];
        var icon = n.type==='comment'?'💬':n.type==='like'?'❤️':n.type==='dm'?'📩':n.type==='follow'?'👥':'🔔';
        showNotifPopup(icon, n.title||'알림', n.message||'');
      }
    }
    _lastNotifCount = count;
    updateNotifBadge();
  } catch(e) { console.error('알림 체크 오류:', e); }
}

function showNotifPopup(icon,title,message){
  const popup=document.createElement('div');
  popup.className='fixed top-4 right-4 bg-white shadow-2xl rounded-2xl p-4 z-[150] animate-fade-in border border-slate-200 max-w-xs';
  popup.innerHTML=`<div class="flex items-start gap-3"><span class="text-2xl">${icon}</span><div class="flex-1"><div class="font-bold text-sm text-slate-800">${title}</div><div class="text-xs text-slate-500 mt-1">${message}</div></div><button onclick="this.parentElement.parentElement.remove()" class="text-slate-400 text-lg">×</button></div>`;
  document.body.appendChild(popup);
  setTimeout(()=>{if(popup.parentElement)popup.remove();},5000);
}

// 팝업 공지 체크
async function showPopupNoticeIfAny(){
  try{
    if(typeof firebaseGetPopupNotice!=='function')return;
    const r=await firebaseGetPopupNotice();
    if(r.notice&&r.notice.active){
      const dismissed=sessionStorage.getItem('popup_dismissed');
      if(dismissed)return;
      showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onclick="if(event.target===this){sessionStorage.setItem('popup_dismissed','1');closeModal()}"><div class="bg-white rounded-2xl w-full max-w-sm animate-fade-in"><div class="bg-gradient-to-r from-pink-500 to-rose-500 p-5 rounded-t-2xl text-white"><h2 class="text-xl font-bold">📣 ${r.notice.title}</h2></div><div class="p-5"><p class="text-slate-700 whitespace-pre-wrap">${r.notice.content}</p><button onclick="sessionStorage.setItem('popup_dismissed','1');closeModal()" class="w-full mt-4 py-3 bg-slate-100 rounded-xl">확인</button></div></div></div>`);
    }
  }catch(e){}
}

// 화면 전환
function showView(view){
  currentView=view;
  window.scrollTo(0,0);
  if(view!=='chat'&&typeof firebaseStopChatListener==='function')firebaseStopChatListener();
  document.querySelectorAll('.nav-btn,.mobile-nav-btn').forEach(b=>{b.classList.remove('bg-gradient-to-r','from-indigo-500','to-purple-600','text-white','shadow-md','bg-indigo-50','text-indigo-600');b.classList.add('text-slate-600','hover:bg-slate-100','text-slate-500');});
  const nb=document.getElementById(`nav-${view}`),mnb=document.getElementById(`mobile-nav-${view}`);
  if(nb){nb.classList.remove('text-slate-600','hover:bg-slate-100');nb.classList.add('bg-gradient-to-r','from-indigo-500','to-purple-600','text-white','shadow-md');}
  if(mnb){mnb.classList.remove('text-slate-500');mnb.classList.add('bg-indigo-50','text-indigo-600');}
  switch(view){
    case'home':renderHomeView().catch(e=>console.error('홈뷰 오류:',e));break;
    case'board':renderBoardView().catch(e=>console.error('게시판뷰 오류:',e));break;
    case'members':renderMembersView().catch(e=>console.error('멤버뷰 오류:',e));break;
    case'chat':renderChatView();break;
    case'admin':renderAdminView().catch(e=>console.error('관리자뷰 오류:',e));break;
    case'poll':renderPollView().catch(e=>console.error('투표뷰 오류:',e));break;
    case'dday':renderDdayView().catch(e=>console.error('D-Day뷰 오류:',e));break;
    case'game':renderGameView().catch(e=>console.error('게임뷰 오류:',e));break;
    default:renderHomeView().catch(e=>console.error('기본뷰 오류:',e));
  }
}

// ========== 홈 ==========
async function renderHomeView(){
  const content=document.getElementById('content');
  
  // 1단계: 즉시 표시 (DB 호출 없이)
  try { content.innerHTML=renderHomeShell(); } catch(e) { 
    console.error('홈 렌더 오류:', e);
    content.innerHTML='<div class="p-8 text-center text-red-500">홈 로딩 오류: '+e.message+'</div>';
    return;
  }
  
  // 2단계: 데이터 병렬 로딩 후 섹션별 업데이트
  try {
    const [postsResult, membersResult, missions, noticesResult] = await Promise.all([
      firebaseGetPosts({limit:5}).catch(e=>{console.error('posts err:',e);return{posts:[]};}),
      (typeof firebaseGetMembers==='function') ? firebaseGetMembers().catch(()=>({members:[]})) : Promise.resolve({members:[]}),
      (isLoggedIn&&typeof firebaseGetMissions==='function') ? firebaseGetMissions().catch(()=>null) : Promise.resolve(null),
      (typeof firebaseGetPinnedNotices==='function') ? firebaseGetPinnedNotices().catch(()=>({notices:[]})) : Promise.resolve({notices:[]})
    ]);
    
    const recentPosts = postsResult.posts||[];
    const topMembers = (membersResult.members||[]).slice(0,3);
    const notices = noticesResult.notices||[];
  
  // 공지 업데이트
  const noticeArea=document.getElementById('home-notices');
  if(noticeArea&&notices.length) noticeArea.innerHTML=`<div class="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-4 shadow-sm"><div class="flex items-center gap-2 mb-2"><span class="text-lg">📢</span><h3 class="font-bold text-red-700">공지사항</h3></div>${notices.map(n=>`<div class="p-2 bg-white/60 rounded-lg mb-1 last:mb-0"><div class="font-medium text-slate-800 text-sm">${n.title}</div><div class="text-xs text-slate-500 mt-1">${n.content?.substring(0,60)||''}</div></div>`).join('')}</div>`;
  
  // 미션 업데이트
  const missionArea=document.getElementById('home-missions');
  if(missionArea&&isLoggedIn&&missions) missionArea.innerHTML=`<div class="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-sm"><div class="flex items-center justify-between mb-3"><h3 class="font-bold text-amber-800">🎁 오늘의 미션</h3><span class="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">${Object.values(missions).filter(m=>m.done).length}/${Object.keys(missions).length}</span></div><div class="grid grid-cols-4 gap-2">${Object.entries(missions).map(([k,m])=>`<div class="bg-white rounded-xl p-2 text-center ${m.done?'opacity-60':''} shadow-sm"><div class="text-lg">${m.icon}</div><div class="text-xs text-slate-600 truncate">${m.name}</div><div class="text-xs font-bold ${m.done?'text-green-600':'text-amber-600'}">${m.done?'✓':`${m.current}/${m.target}`}</div></div>`).join('')}</div></div>`;
  
  // 랭킹 업데이트
  const rankArea=document.getElementById('home-ranking');
  if(rankArea&&topMembers.length) rankArea.innerHTML=`<div class="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4 shadow-sm"><div class="flex items-center justify-between mb-3"><h3 class="font-bold text-purple-800">🏆 포인트 랭킹</h3><button onclick="showRanking()" class="text-xs text-purple-600">전체 →</button></div><div class="flex gap-3 justify-center">${topMembers.map((m,i)=>`<div class="flex flex-col items-center"><div class="text-2xl">${['🥇','🥈','🥉'][i]}</div><div class="w-12 h-12 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">${m.avatar||'😀'}</div><div class="text-sm font-medium mt-1">${m.name}</div><div class="text-xs text-purple-600">💎 ${(m.points||0).toLocaleString()}</div></div>`).join('')}</div></div>`;
  
  // 최근 게시글 업데이트
  const postsArea=document.getElementById('home-posts');
  if(postsArea) postsArea.innerHTML=recentPosts.length?recentPosts.map(p=>{const ci=typeof getCategoryInfo==='function'?getCategoryInfo(p.category):null;return`<div onclick="openPost('${p.id}')" class="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl cursor-pointer"><div class="flex-1 min-w-0"><div class="flex items-center gap-2"><span class="text-xs bg-slate-100 px-1.5 py-0.5 rounded">${ci?.icon||'📋'}</span><span class="font-medium text-slate-800 truncate">${p.title}</span></div><div class="text-xs text-slate-500 mt-1">${p.authorName||p.author} · ${formatDate(p.createdAt)}</div></div><div class="flex items-center gap-2 text-xs text-slate-400 ml-2"><span>❤️ ${p.likeCount||0}</span><span>💬 ${p.commentCount||0}</span></div></div>`;}).join(''):'<div class="text-center text-slate-400 py-4">아직 게시글이 없습니다</div>';
  } catch(e) { console.error('홈 데이터 로딩 오류:', e); }
}

// 홈 껍데기 (DB 호출 없이 즉시 렌더링)
function renderHomeShell(){
  return`<div class="max-w-4xl mx-auto space-y-6">
    <div class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg">
      <h2 class="text-2xl font-bold mb-2">${isLoggedIn?`${currentUser.name}님, 환영합니다! 👋`:'c반놈들에 오신 것을 환영합니다! 🎓'}</h2>
      <p class="opacity-90">${isLoggedIn?`보유 포인트: 💎 ${(currentUser.points||0).toLocaleString()}P`:'로그인하고 커뮤니티에 참여하세요!'}</p>
      ${!isLoggedIn?`<div class="mt-4 flex gap-3"><button onclick="showLoginModal()" class="px-6 py-2 bg-white text-indigo-600 rounded-xl font-medium">로그인</button><button onclick="showSignUpModal()" class="px-6 py-2 bg-white/20 text-white rounded-xl font-medium">회원가입</button></div>`:''}
    </div>

    <div class="grid grid-cols-4 lg:grid-cols-8 gap-2">
      <button onclick="showView('board')" class="bg-gradient-to-br from-blue-100 to-blue-200 p-3 rounded-2xl text-blue-700 shadow-sm hover:shadow-md hover:scale-105 transition-all"><div class="text-xl mb-1">📋</div><div class="text-xs font-medium">게시판</div></button>
      <button onclick="showView('chat')" class="bg-gradient-to-br from-cyan-100 to-cyan-200 p-3 rounded-2xl text-cyan-700 shadow-sm hover:shadow-md hover:scale-105 transition-all"><div class="text-xl mb-1">💬</div><div class="text-xs font-medium">채팅</div></button>
      <button onclick="showAttendance()" class="bg-gradient-to-br from-green-100 to-green-200 p-3 rounded-2xl text-green-700 shadow-sm hover:shadow-md hover:scale-105 transition-all"><div class="text-xl mb-1">✅</div><div class="text-xs font-medium">출석</div></button>
      <button onclick="showView('poll')" class="bg-gradient-to-br from-violet-100 to-violet-200 p-3 rounded-2xl text-violet-700 shadow-sm hover:shadow-md hover:scale-105 transition-all"><div class="text-xl mb-1">📊</div><div class="text-xs font-medium">투표</div></button>
      <button onclick="showView('dday')" class="bg-gradient-to-br from-rose-100 to-rose-200 p-3 rounded-2xl text-rose-700 shadow-sm hover:shadow-md hover:scale-105 transition-all"><div class="text-xl mb-1">📅</div><div class="text-xs font-medium">D-Day</div></button>
      <button onclick="showView('game')" class="bg-gradient-to-br from-amber-100 to-amber-200 p-3 rounded-2xl text-amber-700 shadow-sm hover:shadow-md hover:scale-105 transition-all"><div class="text-xl mb-1">🎰</div><div class="text-xs font-medium">게임</div></button>
      <button onclick="showRanking()" class="bg-gradient-to-br from-purple-100 to-purple-200 p-3 rounded-2xl text-purple-700 shadow-sm hover:shadow-md hover:scale-105 transition-all"><div class="text-xl mb-1">🏆</div><div class="text-xs font-medium">랭킹</div></button>
      <button onclick="showShop()" class="bg-gradient-to-br from-pink-100 to-pink-200 p-3 rounded-2xl text-pink-700 shadow-sm hover:shadow-md hover:scale-105 transition-all"><div class="text-xl mb-1">🏪</div><div class="text-xs font-medium">상점</div></button>
    </div>

    ${isAdmin?`<button onclick="showView('admin')" class="w-full bg-gradient-to-r from-red-500 to-orange-500 p-4 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"><span class="text-2xl">👑</span><span class="font-bold">관리자 대시보드</span></button>`:''}

    <div class="bg-white rounded-2xl p-4 shadow-sm">
      <div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-800">🏷️ 관심사별 게시판</h3></div>
      <div class="grid grid-cols-3 lg:grid-cols-5 gap-2" id="home-categories">
        <button onclick="filterByCategory('자유게시판')" class="bg-gradient-to-br from-blue-100 to-blue-200 p-3 rounded-xl text-blue-700 hover:shadow-md transition-all text-center"><div class="text-lg">💬</div><div class="text-xs font-medium mt-1">자유게시판</div></button>
        <button onclick="filterByCategory('헬스/운동')" class="bg-gradient-to-br from-orange-100 to-orange-200 p-3 rounded-xl text-orange-700 hover:shadow-md transition-all text-center"><div class="text-lg">💪</div><div class="text-xs font-medium mt-1">헬스/운동</div></button>
        <button onclick="filterByCategory('게임')" class="bg-gradient-to-br from-purple-100 to-purple-200 p-3 rounded-xl text-purple-700 hover:shadow-md transition-all text-center"><div class="text-lg">🎮</div><div class="text-xs font-medium mt-1">게임</div></button>
        <button onclick="filterByCategory('주식/투자')" class="bg-gradient-to-br from-green-100 to-green-200 p-3 rounded-xl text-green-700 hover:shadow-md transition-all text-center"><div class="text-lg">📈</div><div class="text-xs font-medium mt-1">주식/투자</div></button>
        <button onclick="filterByCategory('맛집/요리')" class="bg-gradient-to-br from-red-100 to-red-200 p-3 rounded-xl text-red-700 hover:shadow-md transition-all text-center"><div class="text-lg">🍔</div><div class="text-xs font-medium mt-1">맛집/요리</div></button>
        <button onclick="filterByCategory('여행')" class="bg-gradient-to-br from-cyan-100 to-cyan-200 p-3 rounded-xl text-cyan-700 hover:shadow-md transition-all text-center"><div class="text-lg">✈️</div><div class="text-xs font-medium mt-1">여행</div></button>
        <button onclick="filterByCategory('IT/테크')" class="bg-gradient-to-br from-indigo-100 to-indigo-200 p-3 rounded-xl text-indigo-700 hover:shadow-md transition-all text-center"><div class="text-lg">💻</div><div class="text-xs font-medium mt-1">IT/테크</div></button>
        <button onclick="filterByCategory('취업/자기계발')" class="bg-gradient-to-br from-amber-100 to-amber-200 p-3 rounded-xl text-amber-700 hover:shadow-md transition-all text-center"><div class="text-lg">📚</div><div class="text-xs font-medium mt-1">취업/자기계발</div></button>
        <button onclick="filterByCategory('사진/영상')" class="bg-gradient-to-br from-pink-100 to-pink-200 p-3 rounded-xl text-pink-700 hover:shadow-md transition-all text-center"><div class="text-lg">📷</div><div class="text-xs font-medium mt-1">사진/영상</div></button>
      </div>
    </div>

    <div id="home-notices"></div>
    <div id="home-missions"></div>
    <div id="home-ranking"></div>

    <div class="bg-white rounded-2xl p-4 shadow-sm">
      <div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-800">📋 최근 게시글</h3><button onclick="showView('board')" class="text-xs text-indigo-600">전체 →</button></div>
      <div id="home-posts"><div class="flex items-center justify-center py-6 text-slate-400"><div class="animate-spin mr-2">⏳</div> 불러오는 중...</div></div>
    </div>
  </div>`;
}

// ========== 게시판 (카테고리 탭 + 검색 + 공지고정) ==========
let currentBoardCategory = '전체';

async function renderBoardView(category){
  if(category) currentBoardCategory = category;
  const content=document.getElementById('content');
  content.innerHTML='<div class="text-center py-8"><div class="animate-spin text-4xl">⏳</div></div>';
  
  let posts=[], noticeHtml='';
  try{
    const result=await firebaseGetPosts({limit:50, category: currentBoardCategory});
    posts=result.posts||[];
  }catch(e){console.error('게시글 로드 오류:',e);}
  try{const nr=await firebaseGetPinnedNotices();const notices=nr.notices||[];
    if(notices.length)noticeHtml=notices.map(n=>`<div class="flex items-center gap-2 p-3 bg-red-50 border-b border-red-100"><span class="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">공지</span><span class="font-medium text-slate-800 text-sm flex-1 truncate">${n.title}</span></div>`).join('');
  }catch(e){}

  const catButtons = [
    {id:'전체',label:'전체',icon:'📋'},
    {id:'자유게시판',label:'자유게시판',icon:'💬'},
    {id:'헬스/운동',label:'헬스/운동',icon:'💪'},
    {id:'게임',label:'게임',icon:'🎮'},
    {id:'주식/투자',label:'주식/투자',icon:'📈'},
    {id:'맛집/요리',label:'맛집/요리',icon:'🍔'},
    {id:'여행',label:'여행',icon:'✈️'},
    {id:'IT/테크',label:'IT/테크',icon:'💻'},
    {id:'취업/자기계발',label:'취업/자기계발',icon:'📚'},
    {id:'사진/영상',label:'사진/영상',icon:'📷'}
  ];
  const catHtml = catButtons.map(c=>{
    const active = currentBoardCategory===c.id;
    return `<button onclick="filterByCategory('${c.id}')" style="display:inline-block;white-space:nowrap;margin-right:6px;padding:8px 14px;border-radius:12px;font-size:14px;font-weight:500;border:none;cursor:pointer;${active?'background:#6366f1;color:white;box-shadow:0 2px 6px rgba(99,102,241,0.4);':'background:white;color:#475569;'}">${c.icon} ${c.label}</button>`;
  }).join('');

  content.innerHTML=`<div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-slate-800">📋 게시판</h2>
      ${isLoggedIn?`<button onclick="openWriteModal()" class="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg text-sm">✍️ 글쓰기</button>`:''}
    </div>

    <div id="cat-scroll" onmousedown="catDragStart(event)" onmousemove="catDragMove(event)" onmouseup="catDragEnd()" onmouseleave="catDragEnd()" style="overflow-x:scroll;overflow-y:hidden;-webkit-overflow-scrolling:touch;white-space:nowrap;padding-bottom:6px;margin-bottom:12px;scrollbar-width:none;cursor:grab;">
      <button onclick="showHotPosts()" style="display:inline-block;white-space:nowrap;margin-right:6px;padding:8px 14px;border-radius:12px;font-size:14px;font-weight:500;border:none;cursor:pointer;background:linear-gradient(to right,#ef4444,#f97316);color:white;">🔥 인기</button>${catHtml}
    </div>

    <div class="mb-4"><div class="flex gap-2"><input type="text" id="search-input" placeholder="🔍 제목, 내용, 작성자 검색..." class="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onkeypress="if(event.key==='Enter')doSearchPosts()"><button onclick="doSearchPosts()" class="px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-sm hover:bg-indigo-600">검색</button></div></div>

    ${isAdmin?`<div class="mb-3"><button onclick="doResetPosts()" class="px-4 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600">🗑 초기화+샘플</button></div>`:''}

    <div id="board-list" class="bg-white rounded-2xl shadow-sm overflow-hidden">${noticeHtml}${renderPostList(posts)}</div>
    <div id="board-load-more" class="text-center py-4 ${posts.length>=50?'':'hidden'}"><button onclick="loadMorePosts()" class="px-6 py-2 bg-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-300">더 보기 ↓</button></div>
  </div>`;
}

async function loadMorePosts(){
  const result=await firebaseGetPosts({limit:100,category:currentBoardCategory});
  const posts=result.posts||[];
  const el=document.getElementById('board-list');
  if(el) el.innerHTML=renderPostList(posts);
  const btn=document.getElementById('board-load-more');
  if(btn) btn.classList.add('hidden');
}

function filterByCategory(cat){
  currentBoardCategory = cat;
  if(currentView==='board') renderBoardView();
  else { currentBoardCategory=cat; showView('board'); }
}

async function doResetPosts(){
  if(!confirm('기존 게시글을 모두 삭제하고 샘플 180개를 추가합니다. 시간이 좀 걸릴 수 있어요. 진행할까요?')) return;
  showLoading();
  try {
    const r = await firebaseResetAndSeedPosts();
    hideLoading();
    if(r.success){ showToast(`🗑 ${r.deleted}개 삭제, ✅ ${r.added}개 샘플 추가!`); renderBoardView(); }
    else showToast('❌ ' + (r.error||'알 수 없는 오류'));
  } catch(e) {
    hideLoading();
    console.error('초기화 오류:', e);
    showToast('❌ 오류: ' + e.message);
  }
}

async function doSearchPosts(){
  const keyword=document.getElementById('search-input').value.trim();
  if(!keyword){renderBoardView();return;}
  showLoading();const result=await firebaseSearchPosts(keyword);hideLoading();
  const posts=result.posts||[];
  document.getElementById('board-list').innerHTML=posts.length?`<div class="p-3 bg-indigo-50 text-sm text-indigo-700">"${keyword}" 검색 결과: ${posts.length}건 <button onclick="renderBoardView()" class="ml-2 underline">초기화</button></div>`+posts.map(p=>`<div onclick="openPost('${p.id}')" class="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-100"><div class="flex-1 min-w-0"><div class="font-medium text-slate-800 truncate">${p.title}</div><div class="text-xs text-slate-500">${p.authorName||p.author} · ${formatDate(p.createdAt)}</div></div><div class="flex items-center gap-2 text-xs text-slate-400"><span>❤️ ${p.likeCount||0}</span><span>💬 ${p.commentCount||0}</span></div></div>`).join(''):`<div class="text-center text-slate-400 py-12">"${keyword}" 검색 결과가 없습니다</div>`;
}

// ========== 멤버 ==========
async function renderMembersView(){
  const content=document.getElementById('content');
  content.innerHTML='<div class="text-center py-8"><div class="animate-spin text-4xl">⏳</div></div>';
  const result=await firebaseGetMembers('points');const members=result.members||[];
  content.innerHTML=`<div class="max-w-4xl mx-auto"><h2 class="text-xl font-bold text-slate-800 mb-4">👥 멤버 (${members.length}명)</h2><div class="bg-white rounded-2xl shadow-sm overflow-hidden">${members.map((m,i)=>`<div class="flex items-center justify-between p-4 border-b border-slate-100 last:border-0"><div class="flex items-center gap-3 cursor-pointer" onclick="showUserProfile('${m.uid}')"><div class="w-6 text-center font-bold ${i<3?'text-amber-500':'text-slate-400'}">${i+1}</div><div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl">${m.avatar||'😀'}</div><div><div class="font-medium text-slate-800">${m.name} ${m.isAdmin?'👑':''}</div><div class="text-xs text-slate-500">${m.grade||'🌱 새싹'} · 팔로워 ${m.followerCount||0}</div></div></div><div class="flex items-center gap-2"><div class="text-right"><div class="font-bold text-indigo-600 text-sm">💎 ${(m.points||0).toLocaleString()}</div></div>${isLoggedIn&&m.uid!==currentUser.uid?`<button onclick="showSendDM('${m.uid}','${m.name}')" class="px-2 py-1 text-xs bg-indigo-100 text-indigo-600 rounded-lg">📩</button>`:''}</div></div>`).join('')}</div></div>`;
}

// ========== 채팅 (주제별 채팅방) ==========
function renderChatView(){
  if(!isLoggedIn){showLoginModal();return;}
  const content=document.getElementById('content');
  const rooms=typeof CHAT_ROOMS!=='undefined'?CHAT_ROOMS:[{id:'general',name:'🏠 자유 채팅',desc:'아무 주제나'}];
  content.innerHTML=`<div class="max-w-3xl mx-auto animate-fade-in">
    <div class="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1" style="scrollbar-width:none;">
      ${rooms.map(r=>`<button onclick="switchChatRoom('${r.id}')" id="chat-room-${r.id}" style="white-space:nowrap;" class="px-3 py-2 rounded-xl text-sm font-medium ${currentChatRoom===r.id?'bg-indigo-500 text-white shadow-md':'bg-white text-slate-600 hover:bg-slate-100 shadow-sm'}">${r.name}</button>`).join('')}
    </div>
    <div class="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col" style="height:calc(100vh - 220px);min-height:350px;">
      <div class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 flex items-center justify-between">
        <div class="flex items-center gap-3"><span class="text-2xl">💬</span><div><h2 class="font-bold" id="chat-room-title">${rooms.find(r=>r.id===currentChatRoom)?.name||'채팅'}</h2><p class="text-xs opacity-80" id="chat-online-count">접속 중...</p></div></div>
      </div>
      <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50"><div class="text-center text-slate-400 py-8">💬 불러오는 중...</div></div>
      <div class="p-4 bg-white border-t border-slate-200"><div class="flex gap-2"><input type="text" id="chat-input" placeholder="메시지를 입력하세요..." class="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" onkeypress="if(event.key==='Enter')sendChatMessage()" maxlength="500"><button onclick="sendChatMessage()" class="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium">📤</button></div></div>
    </div>
  </div>`;
  firebaseStartChatListener(currentChatRoom,updateChatMessages);updateOnlineCount();
}
function switchChatRoom(roomId){currentChatRoom=roomId;renderChatView();}
function updateChatMessages(messages){const c=document.getElementById('chat-messages');if(!c)return;if(!messages.length){c.innerHTML='<div class="text-center text-slate-400 py-8">💬 첫 메시지를 보내보세요!</div>';return;}const uid=currentUser.uid;c.innerHTML=messages.map(msg=>{const mine=msg.userId===uid,time=msg.createdAt?formatTime(msg.createdAt):'';return`<div class="flex ${mine?'justify-end':'justify-start'}"><div class="flex ${mine?'flex-row-reverse':'flex-row'} items-end gap-2 max-w-[80%]">${!mine?`<div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm">${msg.userAvatar||'😀'}</div>`:''}<div>${!mine?`<div class="text-xs text-slate-500 mb-1 ml-1">${msg.userName}</div>`:''}<div class="relative group"><div class="${mine?'bg-gradient-to-r from-indigo-500 to-purple-600 text-white':'bg-white'} px-4 py-2 rounded-2xl ${mine?'rounded-br-md':'rounded-bl-md'} shadow-sm"><p class="break-words text-sm">${escapeHtml(msg.message)}</p></div>${(mine||isAdmin)?`<button onclick="deleteChatMessage('${msg.id}')" class="absolute -top-2 ${mine?'-left-2':'-right-2'} hidden group-hover:flex w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center text-xs">✕</button>`:''}</div><div class="text-xs text-slate-400 mt-1 ${mine?'text-right':'ml-1'}">${time}</div></div></div></div>`;}).join('');c.scrollTop=c.scrollHeight;}
async function sendChatMessage(){const i=document.getElementById('chat-input'),msg=i.value.trim();if(!msg)return;i.disabled=true;const r=await firebaseSendMessage(msg);i.disabled=false;if(r.success){i.value='';i.focus();}else showToast('❌ '+r.error);}
async function deleteChatMessage(id){if(!confirm('삭제할까요?'))return;await firebaseDeleteMessage(id);}
async function updateOnlineCount(){const c=await firebaseGetOnlineCount();const el=document.getElementById('chat-online-count');if(el)el.textContent=`${c}명 접속 중`;}

// ========== 투표 ==========
async function renderPollView(){
  if(!isLoggedIn){showLoginModal();return;}
  const content=document.getElementById('content');
  content.innerHTML='<div class="text-center py-8"><div class="animate-spin text-4xl">⏳</div></div>';
  const result=await firebaseGetPolls();const polls=result.polls||[];
  const uid=currentUser.uid;

  content.innerHTML=`<div class="max-w-3xl mx-auto"><div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold text-slate-800">📊 투표/설문</h2><button onclick="showCreatePollModal()" class="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium">+ 투표 만들기</button></div>
    <div class="space-y-4">${polls.length?polls.map(poll=>{
      const myVoted=poll.options.some(o=>o.voters?.includes(uid));
      const total=poll.totalVotes||0;
      return`<div class="bg-white rounded-2xl shadow-sm p-5">
        <div class="flex items-start justify-between mb-3"><div><h3 class="font-bold text-slate-800">${poll.title}</h3>${poll.description?`<p class="text-sm text-slate-500 mt-1">${poll.description}</p>`:''}</div><span class="text-xs px-2 py-1 rounded-full ${poll.isActive?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">${poll.isActive?'진행중':'종료'}</span></div>
        <div class="space-y-2">${poll.options.map((opt,i)=>{
          const pct=total?Math.round((opt.votes/total)*100):0;
          const voted=opt.voters?.includes(uid);
          return`<div class="relative"><button onclick="${poll.isActive&&!myVoted?`votePoll('${poll.id}',${i})`:'void(0)'}" class="w-full text-left p-3 rounded-xl border-2 ${voted?'border-indigo-400 bg-indigo-50':'border-slate-200 hover:border-indigo-300'} transition-all ${!poll.isActive||myVoted?'cursor-default':'cursor-pointer'}"><div class="flex justify-between items-center relative z-10"><span class="text-sm font-medium">${voted?'✓ ':''}${opt.text}</span><span class="text-xs text-slate-500">${opt.votes}표 (${pct}%)</span></div>${myVoted||!poll.isActive?`<div class="absolute left-0 top-0 h-full bg-indigo-100 rounded-xl transition-all" style="width:${pct}%"></div>`:''}</button></div>`;
        }).join('')}</div>
        <div class="flex items-center justify-between mt-3 text-xs text-slate-400"><span>${poll.authorName} · ${formatDate(poll.createdAt)}</span><span>총 ${total}표</span></div>
        ${(poll.authorId===uid||isAdmin)&&poll.isActive?`<button onclick="closePoll('${poll.id}')" class="mt-2 text-xs text-red-500 hover:text-red-700">투표 종료</button>`:''}
        ${(poll.authorId===uid||isAdmin)?`<button onclick="deletePoll('${poll.id}')" class="mt-2 ml-2 text-xs text-slate-400 hover:text-red-500">🗑 삭제</button>`:''}
      </div>`;}).join(''):'<div class="text-center text-slate-400 py-12 bg-white rounded-2xl">아직 투표가 없습니다</div>'}</div></div>`;
}

function showCreatePollModal(){
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto animate-fade-in"><div class="p-5 border-b border-slate-100"><h2 class="text-lg font-bold">📊 투표 만들기</h2></div><div class="p-5 space-y-4"><input type="text" id="poll-title" placeholder="투표 제목" class="w-full px-4 py-3 border border-slate-200 rounded-xl"><input type="text" id="poll-desc" placeholder="설명 (선택)" class="w-full px-4 py-3 border border-slate-200 rounded-xl"><div id="poll-options-list"><input type="text" class="poll-option w-full px-4 py-2 border border-slate-200 rounded-xl mb-2" placeholder="항목 1"><input type="text" class="poll-option w-full px-4 py-2 border border-slate-200 rounded-xl mb-2" placeholder="항목 2"></div><button onclick="addPollOption()" class="text-sm text-indigo-600 hover:text-indigo-800">+ 항목 추가</button><button onclick="doCreatePoll()" class="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium">만들기</button></div></div></div>`);
}
function addPollOption(){const list=document.getElementById('poll-options-list');const count=list.querySelectorAll('.poll-option').length+1;const input=document.createElement('input');input.type='text';input.className='poll-option w-full px-4 py-2 border border-slate-200 rounded-xl mb-2';input.placeholder=`항목 ${count}`;list.appendChild(input);}
async function doCreatePoll(){const title=document.getElementById('poll-title').value.trim();const desc=document.getElementById('poll-desc').value.trim();const opts=[...document.querySelectorAll('.poll-option')].map(i=>i.value.trim()).filter(v=>v);if(!title||opts.length<2){alert('제목과 2개 이상 항목을 입력하세요.');return;}showLoading();const r=await firebaseCreatePoll({title,description:desc,options:opts});hideLoading();if(r.success){closeModal();showToast('📊 투표가 생성되었습니다!');renderPollView();}else showToast('❌ '+r.error);}
async function votePoll(pollId,optId){showLoading();const r=await firebaseVotePoll(pollId,optId);hideLoading();if(r.success){showToast('✅ 투표 완료!');renderPollView();}else showToast('❌ '+r.error);}
async function closePoll(pollId){if(!confirm('투표를 종료할까요?'))return;await firebaseClosePoll(pollId);showToast('투표가 종료되었습니다');renderPollView();}
async function deletePoll(pollId){if(!confirm('투표를 삭제할까요?'))return;showLoading();var r=await firebaseDeletePoll(pollId);hideLoading();if(r.success){showToast('🗑 삭제됨');renderPollView();}else showToast('❌ '+r.error);}

// ========== D-Day 캘린더 ==========
async function renderDdayView(){
  if(!isLoggedIn){showLoginModal();return;}
  const content=document.getElementById('content');
  content.innerHTML='<div class="text-center py-8"><div class="animate-spin text-4xl">⏳</div></div>';
  const result=await firebaseGetDdays();const ddays=result.ddays||[];

  content.innerHTML=`<div class="max-w-3xl mx-auto"><div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold text-slate-800">📅 D-Day 캘린더</h2><button onclick="showAddDdayModal()" class="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl text-sm font-medium">+ 일정 추가</button></div>
    <div class="space-y-3">${ddays.length?ddays.map(d=>{
      const color=d.dday===0?'from-red-500 to-orange-500':d.dday>0?'from-indigo-500 to-purple-600':'from-slate-400 to-slate-500';
      return`<div class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 ${d.isPast?'opacity-60':''}"><div class="w-16 h-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-sm shadow-md">${d.ddayText}</div><div class="flex-1"><div class="flex items-center gap-2"><span class="text-xl">${d.emoji}</span><span class="font-bold text-slate-800">${d.title}</span></div><div class="text-xs text-slate-500 mt-1">${d.date} · ${d.category} · by ${d.authorName}</div></div>${d.authorId===currentUser.uid||isAdmin?`<button onclick="deleteDday('${d.id}')" class="text-red-400 hover:text-red-600 text-sm">🗑</button>`:''}</div>`;
    }).join(''):'<div class="text-center text-slate-400 py-12 bg-white rounded-2xl">등록된 일정이 없습니다</div>'}</div></div>`;
}
function showAddDdayModal(){
  const today=new Date().toISOString().split('T')[0];
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-sm animate-fade-in"><div class="p-5 border-b border-slate-100"><h2 class="text-lg font-bold">📅 일정 추가</h2></div><div class="p-5 space-y-4"><input type="text" id="dday-title" placeholder="일정 이름 (예: 기말고사)" class="w-full px-4 py-3 border border-slate-200 rounded-xl"><input type="date" id="dday-date" value="${today}" class="w-full px-4 py-3 border border-slate-200 rounded-xl"><select id="dday-category" class="w-full px-4 py-3 border border-slate-200 rounded-xl"><option>시험</option><option>행사</option><option>과제</option><option>방학</option><option>기타</option></select><div class="flex gap-2 flex-wrap">${['📅','📚','🎉','🏃','✈️','🎂','💼','🎓'].map(e=>`<button onclick="document.getElementById('dday-emoji').value='${e}';this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('ring-2'));this.classList.add('ring-2','ring-indigo-500')" class="text-2xl p-2 rounded-lg hover:bg-slate-100">${e}</button>`).join('')}<input type="hidden" id="dday-emoji" value="📅"></div><button onclick="doAddDday()" class="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-medium">추가하기</button></div></div></div>`);
}
async function doAddDday(){const title=document.getElementById('dday-title').value.trim();const date=document.getElementById('dday-date').value;const category=document.getElementById('dday-category').value;const emoji=document.getElementById('dday-emoji').value;if(!title||!date){alert('이름과 날짜를 입력하세요.');return;}showLoading();const r=await firebaseAddDday({title,date,category,emoji});hideLoading();if(r.success){closeModal();showToast('📅 일정이 추가되었습니다!');renderDdayView();}else showToast('❌ '+r.error);}
async function deleteDday(id){if(!confirm('삭제할까요?'))return;await firebaseDeleteDday(id);showToast('삭제됨');renderDdayView();}

// ========== 미니게임 ==========
async function renderGameView(){
  if(!isLoggedIn){showLoginModal();return;}
  const content=document.getElementById('content');
  const rouletteCheck=await firebaseCheckRouletteToday();

  content.innerHTML=`<div class="max-w-3xl mx-auto space-y-6">
    <h2 class="text-xl font-bold text-slate-800">🎰 미니게임</h2>
    <p class="text-sm text-slate-500">보유 포인트: 💎 ${(currentUser.points||0).toLocaleString()}P</p>

    <div class="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 shadow-sm border border-amber-200">
      <h3 class="font-bold text-lg text-amber-800 mb-2">🎡 행운의 룰렛 <span class="text-xs font-normal text-amber-600">(1일 1회)</span></h3>
      <p class="text-sm text-slate-600 mb-4">돌려서 포인트를 받아보세요! 잭팟은 500P!</p>
      ${rouletteCheck.spun?`<div class="text-center p-4 bg-white rounded-xl"><p class="text-slate-500">오늘은 이미 돌렸어요!</p><p class="font-bold text-lg mt-1">${rouletteCheck.result?.prizeName||''} (${rouletteCheck.result?.points||0}P)</p></div>`:`<button onclick="doSpinRoulette()" class="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all animate-pulse">🎡 룰렛 돌리기!</button>`}
    </div>

    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 shadow-sm border border-blue-200">
      <h3 class="font-bold text-lg text-blue-800 mb-2">✊ 가위바위보 <span class="text-xs font-normal text-blue-600">(포인트 베팅)</span></h3>
      <p class="text-sm text-slate-600 mb-3">이기면 베팅 포인트 2배!</p>
      <div class="flex items-center gap-2 mb-3"><label class="text-sm text-slate-600">베팅:</label><input type="number" id="rps-bet" value="10" min="10" max="10000" step="10" class="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center" oninput="if(this.value<0)this.value=Math.abs(this.value)"><span class="text-sm text-slate-500">P</span></div>
      <div class="grid grid-cols-3 gap-3">${['✌️ 가위','✊ 바위','🖐️ 보'].map(c=>{const name=c.split(' ')[1];return`<button onclick="doPlayRPS('${name}')" class="p-4 bg-white rounded-xl hover:bg-blue-100 hover:shadow-md transition-all text-center"><div class="text-3xl">${c.split(' ')[0]}</div><div class="text-sm font-medium mt-1">${name}</div></button>`;}).join('')}</div>
      <div id="rps-result" class="mt-3"></div>
    </div>

    <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 shadow-sm border border-green-200">
      <h3 class="font-bold text-lg text-green-800 mb-2">🔢 숫자 맞추기 <span class="text-xs font-normal text-green-600">(1~10)</span></h3>
      <p class="text-sm text-slate-600 mb-3">맞추면 +100P, 틀리면 -10P</p>
      <div class="grid grid-cols-5 gap-2">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button onclick="doPlayNumber(${n})" class="p-3 bg-white rounded-xl hover:bg-green-100 hover:shadow-md transition-all font-bold text-lg">${n}</button>`).join('')}</div>
      <div id="number-result" class="mt-3"></div>
    </div>
  </div>`;
}

async function doSpinRoulette(){
  showLoading();const r=await firebaseSpinRoulette();hideLoading();
  if(r.success){currentUser.points=(currentUser.points||0)+r.prize.points;updateLoginUI();
    showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick="closeModal()"><div class="bg-white rounded-2xl w-80 p-8 text-center animate-fade-in" onclick="event.stopPropagation()"><div class="text-6xl mb-4 animate-bounce">${r.prize.points>=100?'🎉':r.prize.points>0?'😊':r.prize.points===0?'💀':'😱'}</div><h3 class="text-2xl font-bold mb-2">${r.prize.name}</h3><p class="text-lg ${r.prize.points>=0?'text-green-600':'text-red-600'} font-bold">${r.prize.points>=0?'+':''}${r.prize.points}P</p><button onclick="closeModal();renderGameView()" class="mt-4 w-full py-3 bg-slate-100 rounded-xl">확인</button></div></div>`);
  }else showToast('❌ '+r.error);
}

async function doPlayRPS(choice){
  const bet=parseInt(document.getElementById('rps-bet').value)||10;
  showLoading();const r=await firebasePlayRPS(choice,bet);hideLoading();
  if(r.success){currentUser.points=r.newPoints;updateLoginUI();
    const emoji=r.result==='win'?'🎉':r.result==='draw'?'🤝':'😢';
    const text=r.result==='win'?`승리! +${bet}P`:r.result==='draw'?'무승부! 0P':`패배... ${r.pointChange}P`;
    document.getElementById('rps-result').innerHTML=`<div class="p-4 bg-white rounded-xl text-center animate-fade-in"><div class="text-2xl mb-2">${emoji}</div><p class="font-bold">내: ${choice} vs 상대: ${r.computerChoice}</p><p class="${r.result==='win'?'text-green-600':r.result==='lose'?'text-red-600':'text-slate-600'} font-bold mt-1">${text}</p></div>`;
  }else showToast('❌ '+r.error);
}

async function doPlayNumber(guess){
  showLoading();const r=await firebasePlayNumberGuess(guess);hideLoading();
  if(r.success){currentUser.points=r.newPoints;updateLoginUI();
    document.getElementById('number-result').innerHTML=`<div class="p-4 bg-white rounded-xl text-center animate-fade-in"><div class="text-3xl mb-2">${r.correct?'🎉':'😢'}</div><p class="font-bold">정답: ${r.answer} ${r.correct?'맞았습니다!':'틀렸습니다...'}</p><p class="${r.correct?'text-green-600':'text-red-600'} font-bold">${r.pointChange>=0?'+':''}${r.pointChange}P</p></div>`;
  }else showToast('❌ '+r.error);
}

// ========== 알림 ==========
async function showNotifications(){
  if(!isLoggedIn){showLoginModal();return;}
  showLoading();const result=await firebaseGetNotifications();hideLoading();
  const notifs=result.notifications||[];
  await firebaseMarkAllNotifsRead();updateNotifBadge();

  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b border-slate-100"><h2 class="text-lg font-bold text-slate-800">🔔 알림</h2></div><div class="overflow-y-auto flex-1">${notifs.length?notifs.map(n=>{
    const icon=n.type==='comment'?'💬':n.type==='like'?'❤️':n.type==='dm'?'📩':'🔔';
    return`<div class="p-4 border-b border-slate-100 ${n.isRead?'':'bg-indigo-50'} hover:bg-slate-50 cursor-pointer" onclick="${n.linkType==='post'?`closeModal();openPost('${n.linkId}')`:''}""><div class="flex items-start gap-3"><span class="text-xl">${icon}</span><div class="flex-1"><div class="font-medium text-sm text-slate-800">${n.title}</div><div class="text-xs text-slate-500 mt-1">${n.message}</div><div class="text-xs text-slate-400 mt-1">${formatDate(n.createdAt)}</div></div></div></div>`;}).join(''):'<div class="p-8 text-center text-slate-400">알림이 없습니다</div>'}</div><div class="p-4 border-t border-slate-100"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 text-slate-600 rounded-xl">닫기</button></div></div></div>`);
}

// ========== 쪽지(DM) ==========
function showSendDM(toId,toName){
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-sm animate-fade-in"><div class="p-5 border-b border-slate-100"><h2 class="text-lg font-bold">📩 쪽지 보내기</h2><p class="text-sm text-slate-500 mt-1">${toName}님에게</p></div><div class="p-5"><textarea id="dm-message" rows="4" placeholder="메시지를 입력하세요..." class="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none mb-4"></textarea><button onclick="doSendDM('${toId}')" class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium">보내기</button></div></div></div>`);
}
async function doSendDM(toId){const msg=document.getElementById('dm-message').value.trim();if(!msg){alert('메시지를 입력하세요.');return;}showLoading();const r=await firebaseSendDM(toId,msg);hideLoading();if(r.success){closeModal();showToast('📩 쪽지를 보냈습니다!');}else showToast('❌ '+r.error);}

async function showDMInbox(){
  if(!isLoggedIn){showLoginModal();return;}
  closeModal();showLoading();
  const received=await firebaseGetReceivedDMs();
  const sent=await firebaseGetSentDMs();
  hideLoading();
  const rMsgs=received.messages||[], sMsgs=sent.messages||[];

  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b border-slate-100 flex items-center justify-between"><h2 class="text-lg font-bold text-slate-800">📩 쪽지함</h2><div class="flex gap-2"><button onclick="dmShowTab('received')" id="dm-tab-received" class="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full">받은 쪽지</button><button onclick="dmShowTab('sent')" id="dm-tab-sent" class="px-3 py-1 text-sm bg-slate-100 text-slate-600 rounded-full">보낸 쪽지</button></div></div>
    <div class="overflow-y-auto flex-1">
      <div id="dm-received">${rMsgs.length?rMsgs.map(m=>`<div class="p-4 border-b border-slate-100 ${m.isRead?'':'bg-indigo-50'}"><div class="flex items-center gap-2 mb-1"><span class="text-lg">${m.fromAvatar||'😀'}</span><span class="font-medium text-sm">${m.fromName}</span><span class="text-xs text-slate-400 ml-auto">${formatDate(m.createdAt)}</span></div><p class="text-sm text-slate-700">${escapeHtml(m.message)}</p><button onclick="showSendDM('${m.fromId}','${m.fromName}')" class="text-xs text-indigo-600 mt-2">↩ 답장</button></div>`).join(''):'<div class="p-8 text-center text-slate-400">받은 쪽지가 없습니다</div>'}
      </div>
      <div id="dm-sent" class="hidden">${sMsgs.length?sMsgs.map(m=>`<div class="p-4 border-b border-slate-100"><div class="flex items-center gap-2 mb-1"><span class="text-lg">${m.toAvatar||'😀'}</span><span class="font-medium text-sm">${m.toName}에게</span><span class="text-xs text-slate-400 ml-auto">${formatDate(m.createdAt)}</span></div><p class="text-sm text-slate-700">${escapeHtml(m.message)}</p></div>`).join(''):'<div class="p-8 text-center text-slate-400">보낸 쪽지가 없습니다</div>'}
      </div>
    </div>
    <div class="p-4 border-t border-slate-100"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 text-slate-600 rounded-xl">닫기</button></div></div></div>`);
}
function dmShowTab(tab){document.getElementById('dm-received').classList.toggle('hidden',tab!=='received');document.getElementById('dm-sent').classList.toggle('hidden',tab!=='sent');document.getElementById('dm-tab-received').className=`px-3 py-1 text-sm rounded-full ${tab==='received'?'bg-indigo-100 text-indigo-700':'bg-slate-100 text-slate-600'}`;document.getElementById('dm-tab-sent').className=`px-3 py-1 text-sm rounded-full ${tab==='sent'?'bg-indigo-100 text-indigo-700':'bg-slate-100 text-slate-600'}`;}

// ========== 프로필 (커스텀 강화) ==========
function showProfileMenu(){
  if(!isLoggedIn){showLoginModal();return;}
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-t-3xl lg:rounded-2xl w-full max-w-md overflow-hidden animate-fade-in">
    <div class="bg-gradient-to-r ${currentUser.profileBg||'from-indigo-400 to-purple-500'} p-6 text-white"><div class="flex items-center gap-4"><div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">${currentUser.avatar||'😀'}</div><div><h3 class="font-bold text-lg">${currentUser.name} ${isAdmin?'👑':''}</h3><p class="text-sm opacity-80">${currentUser.grade||'🌱 새싹'}</p><p class="text-sm font-medium">💎 ${(currentUser.points||0).toLocaleString()}P</p>${currentUser.bio?`<p class="text-xs opacity-80 mt-1">${currentUser.bio}</p>`:''}</div></div></div>
    <div class="p-4 space-y-1">
      <button onclick="showEditProfile()" class="w-full p-3 text-left hover:bg-slate-100 rounded-xl flex items-center gap-3"><span>🎨</span><span>프로필 수정</span></button>
      <button onclick="showAttendance()" class="w-full p-3 text-left hover:bg-slate-100 rounded-xl flex items-center gap-3"><span>✅</span><span>출석체크</span><span class="ml-auto text-xs text-indigo-500">+50P</span></button>
      <button onclick="showMyPosts()" class="w-full p-3 text-left hover:bg-slate-100 rounded-xl flex items-center gap-3"><span>📝</span><span>내 게시글</span></button>
      <button onclick="showBookmarks()" class="w-full p-3 text-left hover:bg-slate-100 rounded-xl flex items-center gap-3"><span>🔖</span><span>스크랩</span></button>
      <button onclick="showDMInbox()" class="w-full p-3 text-left hover:bg-slate-100 rounded-xl flex items-center gap-3"><span>📩</span><span>쪽지함</span></button>
      <button onclick="showAchievements()" class="w-full p-3 text-left hover:bg-slate-100 rounded-xl flex items-center gap-3"><span>🎯</span><span>업적/뱃지</span></button>
      <button onclick="showShop()" class="w-full p-3 text-left hover:bg-slate-100 rounded-xl flex items-center gap-3"><span>🏪</span><span>포인트 상점</span></button>
      <button onclick="showMyStats()" class="w-full p-3 text-left hover:bg-slate-100 rounded-xl flex items-center gap-3"><span>📊</span><span>내 활동 통계</span></button>
      <button onclick="showSettings()" class="w-full p-3 text-left hover:bg-slate-100 rounded-xl flex items-center gap-3"><span>⚙️</span><span>설정</span></button>
      <div class="border-t border-slate-100 my-2"></div>
      <button onclick="doLogout()" class="w-full p-3 text-left hover:bg-red-50 rounded-xl flex items-center gap-3 text-red-500"><span>🚪</span><span>로그아웃</span></button>
    </div></div></div>`);
}

// 프로필 수정
function showEditProfile(){
  closeModal();
  const avatars=['😀','😎','🤓','🥳','😇','😈','🤖','👽','🦊','🐱','🐶','👑','🌟','💎','🔥','🎯'];
  const bgs=[{name:'인디고',val:'from-indigo-400 to-purple-500'},{name:'석양',val:'from-orange-400 to-pink-500'},{name:'바다',val:'from-cyan-400 to-blue-500'},{name:'숲',val:'from-green-400 to-emerald-500'},{name:'밤하늘',val:'from-indigo-600 to-purple-800'},{name:'무지개',val:'from-red-400 via-yellow-400 to-green-400'},{name:'골드',val:'from-yellow-400 to-amber-500'},{name:'로즈',val:'from-pink-400 to-rose-500'}];

  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto animate-fade-in"><div class="p-5 border-b border-slate-100"><h2 class="text-lg font-bold">🎨 프로필 수정</h2></div><div class="p-5 space-y-4">
    <div><label class="block text-sm font-medium text-slate-700 mb-2">닉네임</label><input type="text" id="edit-name" value="${currentUser.name||''}" class="w-full px-4 py-3 border border-slate-200 rounded-xl" maxlength="10"></div>
    <div><label class="block text-sm font-medium text-slate-700 mb-2">자기소개</label><input type="text" id="edit-bio" value="${currentUser.bio||''}" placeholder="한 줄 소개" class="w-full px-4 py-3 border border-slate-200 rounded-xl" maxlength="50"></div>
    <div><label class="block text-sm font-medium text-slate-700 mb-2">아바타</label><div class="flex flex-wrap gap-2" id="avatar-picker">${avatars.map(a=>`<button onclick="document.getElementById('edit-avatar').value='${a}';document.querySelectorAll('#avatar-picker button').forEach(b=>b.classList.remove('ring-2'));this.classList.add('ring-2','ring-indigo-500')" class="text-2xl p-2 rounded-lg hover:bg-slate-100 ${a===currentUser.avatar?'ring-2 ring-indigo-500':''}">${a}</button>`).join('')}<input type="hidden" id="edit-avatar" value="${currentUser.avatar||'😀'}"></div></div>
    <div><label class="block text-sm font-medium text-slate-700 mb-2">프로필 배경</label><div class="grid grid-cols-4 gap-2" id="bg-picker">${bgs.map(b=>`<button onclick="document.getElementById('edit-bg').value='${b.val}';document.querySelectorAll('#bg-picker button').forEach(btn=>btn.classList.remove('ring-2'));this.classList.add('ring-2','ring-indigo-500')" class="h-12 rounded-xl bg-gradient-to-r ${b.val} ${b.val===currentUser.profileBg?'ring-2 ring-indigo-500':''}" title="${b.name}"></button>`).join('')}<input type="hidden" id="edit-bg" value="${currentUser.profileBg||'from-indigo-400 to-purple-500'}"></div></div>
    <button onclick="doEditProfile()" class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium">저장</button>
  </div></div></div>`);
}
async function doEditProfile(){
  const name=document.getElementById('edit-name').value.trim();const bio=document.getElementById('edit-bio').value.trim();const avatar=document.getElementById('edit-avatar').value;const profileBg=document.getElementById('edit-bg').value;
  if(!name||name.length<2){alert('닉네임은 2자 이상');return;}
  showLoading();const r=await firebaseUpdateProfile({name,bio,avatar,profileBg});hideLoading();
  if(r.success){currentUser.name=name;currentUser.bio=bio;currentUser.avatar=avatar;currentUser.profileBg=profileBg;updateLoginUI();closeModal();showToast('✅ 프로필이 수정되었습니다!');}
  else showToast('❌ '+r.error);
}

// ========== 관리자 ==========
async function renderAdminView(){
  if(!isAdmin){showView('home');return;}
  const content=document.getElementById('content');
  content.innerHTML='<div class="text-center py-8"><div class="animate-spin text-4xl">⏳</div></div>';
  
  const [statsResult, usersResult, catStatsResult, topUsersResult] = await Promise.all([
    firebaseAdminGetStats().catch(()=>({stats:{}})),
    firebaseAdminGetAllUsers().catch(()=>({users:[]})),
    (typeof firebaseAdminGetCategoryStats==='function'?firebaseAdminGetCategoryStats():Promise.resolve({stats:[]})).catch(()=>({stats:[]})),
    (typeof firebaseAdminGetTopUsers==='function'?firebaseAdminGetTopUsers():Promise.resolve({users:[]})).catch(()=>({users:[]}))
  ]);
  const stats=statsResult.stats||{};
  const users=usersResult.users||[];
  const catStats=catStatsResult.stats||[];
  const topUsers=topUsersResult.users||[];

  content.innerHTML=`<div class="max-w-5xl mx-auto space-y-6">
    <h2 class="text-xl font-bold text-slate-800">👑 관리자 대시보드</h2>
    
    <!-- 통계 카드 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-2xl shadow-lg"><div class="text-3xl font-bold">${stats.totalUsers||0}</div><div class="text-sm opacity-80">총 회원</div></div>
      <div class="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-4 rounded-2xl shadow-lg"><div class="text-3xl font-bold">${stats.todayAttendance||0}</div><div class="text-sm opacity-80">오늘 출석</div></div>
      <div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-2xl shadow-lg"><div class="text-3xl font-bold">${stats.totalPosts||0}</div><div class="text-sm opacity-80">총 게시글</div></div>
      <div class="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-4 rounded-2xl shadow-lg"><div class="text-3xl font-bold">${(stats.totalPoints||0).toLocaleString()}</div><div class="text-sm opacity-80">총 포인트</div></div>
    </div>
    
    <!-- 관리 메뉴 버튼 그리드 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <button onclick="showAdminReports()" class="bg-gradient-to-r from-red-500 to-pink-500 text-white p-3 rounded-2xl font-medium hover:shadow-lg text-sm">🚨 신고 관리</button>
      <button onclick="showAdminOnlineUsers()" class="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-3 rounded-2xl font-medium hover:shadow-lg text-sm">📊 접속 현황</button>
      <button onclick="showAdminActivityLogs()" class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-3 rounded-2xl font-medium hover:shadow-lg text-sm">📝 활동 로그</button>
      <button onclick="showAdminPostsMgmt()" class="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-3 rounded-2xl font-medium hover:shadow-lg text-sm">📋 게시글 관리</button>
      <button onclick="showAdminNoticesMgmt()" class="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-3 rounded-2xl font-medium hover:shadow-lg text-sm">📢 공지 관리</button>
      <button onclick="showAdminChatMgmt()" class="bg-gradient-to-r from-cyan-500 to-teal-500 text-white p-3 rounded-2xl font-medium hover:shadow-lg text-sm">💬 채팅방 관리</button>
      <button onclick="showAdminPopupNotice()" class="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-3 rounded-2xl font-medium hover:shadow-lg text-sm">📣 팝업 공지</button>
      <button onclick="showAdminSiteSettings()" class="bg-gradient-to-r from-slate-500 to-slate-600 text-white p-3 rounded-2xl font-medium hover:shadow-lg text-sm">⚙️ 사이트 설정</button>
    </div>
    
    <!-- 카테고리별 통계 -->
    ${catStats.length?`<div class="bg-white rounded-2xl shadow-sm p-4"><h3 class="font-bold text-slate-800 mb-3">📊 카테고리별 게시글</h3><div class="grid grid-cols-3 lg:grid-cols-5 gap-2">${catStats.map(c=>`<div class="text-center p-3 bg-slate-50 rounded-xl"><div class="text-lg">${c.icon||'📋'}</div><div class="text-xs text-slate-600">${c.name}</div><div class="font-bold text-indigo-600">${c.count}</div></div>`).join('')}</div></div>`:''}
    
    <!-- TOP 활동 유저 -->
    ${topUsers.length?`<div class="bg-white rounded-2xl shadow-sm p-4"><h3 class="font-bold text-slate-800 mb-3">🏆 활동량 TOP 유저</h3><div class="space-y-2">${topUsers.slice(0,5).map((u,i)=>`<div class="flex items-center justify-between p-2 bg-slate-50 rounded-xl"><div class="flex items-center gap-3"><span class="font-bold ${i<3?'text-amber-500':'text-slate-400'}">${i+1}</span><span class="text-lg">${u.avatar||'😀'}</span><span class="font-medium text-sm">${u.name}</span></div><div class="text-xs text-slate-500">글 ${u.posts||0} · 댓글 ${u.comments||0} · 💎 ${(u.points||0).toLocaleString()}</div></div>`).join('')}</div></div>`:''}
    
    <!-- 공지 작성 -->
    <div class="bg-white rounded-2xl shadow-sm p-4"><h3 class="font-bold text-slate-800 mb-3">📢 공지사항 작성</h3><input type="text" id="notice-title" placeholder="공지 제목" class="w-full px-4 py-2 border border-slate-200 rounded-xl mb-2"><textarea id="notice-content" placeholder="공지 내용" rows="3" class="w-full px-4 py-2 border border-slate-200 rounded-xl mb-2 resize-none"></textarea><button onclick="doCreateNotice()" class="px-6 py-2 bg-indigo-500 text-white rounded-xl font-medium">공지 등록</button></div>
    
    <!-- 회원 관리 -->
    <div class="bg-white rounded-2xl shadow-sm p-4"><h3 class="font-bold text-slate-800 mb-3">👥 회원 관리 (${users.length}명)</h3><input type="text" id="admin-search" placeholder="검색..." class="w-full px-4 py-2 border border-slate-200 rounded-xl mb-4" oninput="filterAdminUsers()"><div id="admin-user-list" class="space-y-2 max-h-96 overflow-y-auto">${users.map(u=>renderAdminUserRow(u)).join('')}</div></div>
  </div>`;
  window._adminUsers=users;
}
function renderAdminUserRow(u){return`<div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl ${u.isBanned?'opacity-60 bg-red-50':''}"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-lg">${u.avatar||'😀'}</div><div><div class="font-medium text-slate-800">${u.name||'이름없음'} ${u.isAdmin?'👑':''} ${u.isBanned?'🚫':''}</div><div class="text-xs text-slate-500">${u.email||''} · 💎 ${(u.points||0).toLocaleString()}P</div></div></div><div class="flex items-center gap-1 flex-wrap justify-end"><button onclick="adminChangeGrade('${u.uid}')" class="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-lg">🏅</button><button onclick="adminAdjustPoints('${u.uid}')" class="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-lg">💎</button><button onclick="adminToggleAdmin('${u.uid}')" class="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg">${u.isAdmin?'👑해제':'👑임명'}</button><button onclick="adminToggleBan('${u.uid}')" class="px-2 py-1 text-xs ${u.isBanned?'bg-green-100 text-green-700':'bg-red-100 text-red-700'} rounded-lg">${u.isBanned?'해제':'차단'}</button></div></div>`;}
function filterAdminUsers(){const q=document.getElementById('admin-search').value.toLowerCase();document.getElementById('admin-user-list').innerHTML=(window._adminUsers||[]).filter(u=>(u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)).map(u=>renderAdminUserRow(u)).join('');}
async function adminToggleAdmin(userId){if(!confirm('관리자 권한을 변경할까요?'))return;showLoading();const r=await firebaseAdminToggleAdmin(userId);hideLoading();if(r.success){showToast(r.isAdmin?'👑 관리자 임명':'관리자 해제');renderAdminView();}else showToast('❌ '+r.error);}

async function adminChangeGrade(userId){
  const user=(window._adminUsers||[]).find(u=>u.uid===userId);const currentGrade=user?(user.gradeId||'newbie'):'newbie';
  const grades=typeof USER_GRADES!=='undefined'?USER_GRADES:[{id:'newbie',name:'🌱 새싹'},{id:'member',name:'🧑 정회원'},{id:'active',name:'⭐ 우수회원'},{id:'vip',name:'💎 VIP'},{id:'moderator',name:'🛡️ 운영진'},{id:'admin',name:'👑 관리자'}];
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-sm animate-fade-in"><div class="p-5 border-b border-slate-100"><h2 class="text-lg font-bold">🏅 등급 변경</h2><p class="text-sm text-slate-500 mt-1">${user?.name||'사용자'}님</p></div><div class="p-4 space-y-2">${grades.map(g=>`<button onclick="doChangeGrade('${userId}','${g.id}')" class="w-full p-3 text-left rounded-xl flex items-center justify-between ${g.id===currentGrade?'bg-indigo-50 border-2 border-indigo-400':'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'}"><span class="font-medium">${g.name}</span>${g.id===currentGrade?'<span class="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">현재</span>':''}</button>`).join('')}</div><div class="p-4 border-t border-slate-100"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">취소</button></div></div></div>`);
}
async function doChangeGrade(userId,gradeId){showLoading();const r=await firebaseAdminChangeGrade(userId,gradeId);hideLoading();if(r.success){closeModal();showToast(`🏅 등급: "${r.grade}"`);renderAdminView();}else showToast('❌ '+r.error);}
async function adminAdjustPoints(userId){const amount=prompt('조정할 포인트 (음수 가능):');if(!amount||isNaN(amount))return;const reason=prompt('사유:')||'관리자 조정';showLoading();const r=await firebaseAdminAdjustPoints(userId,parseInt(amount),reason);hideLoading();if(r.success){showToast(`💎 ${r.newPoints}P`);renderAdminView();}else showToast('❌ '+r.error);}
async function adminToggleBan(userId){if(!confirm('차단/해제?'))return;showLoading();const r=await firebaseAdminToggleBan(userId);hideLoading();if(r.success){showToast(r.isBanned?'🚫 차단':'✅ 해제');renderAdminView();}else showToast('❌ '+r.error);}
async function doCreateNotice(){const t=document.getElementById('notice-title').value.trim();const c=document.getElementById('notice-content').value.trim();if(!t||!c){alert('제목과 내용을 입력');return;}showLoading();const r=await firebaseAdminCreateNotice(t,c);hideLoading();if(r.success){showToast('📢 등록!');document.getElementById('notice-title').value='';document.getElementById('notice-content').value='';}else showToast('❌ '+r.error);}

// ========== 로그인/회원가입 ==========
function showLoginModal(){showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-fade-in"><div class="p-6 border-b border-slate-100"><h2 class="text-xl font-bold">🔐 로그인</h2></div><div class="p-6 space-y-4"><input type="email" id="login-email" placeholder="이메일" class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"><input type="password" id="login-password" placeholder="비밀번호" class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" onkeypress="if(event.key==='Enter')doLogin()"><button onclick="doLogin()" class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium">로그인</button><div class="flex justify-between text-sm"><button onclick="showForgotPasswordModal()" class="text-slate-500">비밀번호 찾기</button><button onclick="showSignUpModal()" class="text-indigo-600 font-medium">회원가입</button></div></div></div></div>`);}
function showSignUpModal(){showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-fade-in"><div class="p-6 border-b border-slate-100"><h2 class="text-xl font-bold">📝 회원가입</h2></div><div class="p-6 space-y-4"><input type="email" id="signup-email" placeholder="이메일" class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"><input type="text" id="signup-nickname" placeholder="닉네임 (2~10자)" class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"><input type="password" id="signup-password" placeholder="비밀번호 (6자 이상)" class="w-full px-4 py-3 border border-slate-200 rounded-xl"><input type="password" id="signup-password-confirm" placeholder="비밀번호 확인" class="w-full px-4 py-3 border border-slate-200 rounded-xl" onkeypress="if(event.key==='Enter')doSignUp()"><button onclick="doSignUp()" class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium">가입하기</button><p class="text-center text-sm text-slate-500">이미 계정이 있나요? <button onclick="showLoginModal()" class="text-indigo-600 font-medium">로그인</button></p></div></div></div>`);}
async function doLogin(){const e=document.getElementById('login-email').value.trim(),p=document.getElementById('login-password').value;if(!e||!p){alert('입력하세요');return;}showLoading();const r=await firebaseLogin(e,p);hideLoading();if(r.success){closeModal();showToast('🎉 로그인!');}else alert(r.message||r.error);}
async function doSignUp(){const e=document.getElementById('signup-email').value.trim(),n=document.getElementById('signup-nickname').value.trim(),p=document.getElementById('signup-password').value,pc=document.getElementById('signup-password-confirm').value;if(!e||!n||!p){alert('모두 입력');return;}if(n.length<2||n.length>10){alert('닉네임 2~10자');return;}if(p.length<6){alert('비밀번호 6자 이상');return;}if(p!==pc){alert('비밀번호 불일치');return;}showLoading();const r=await firebaseSignUp(e,p,n);hideLoading();if(r.success){closeModal();showToast('🎉 가입완료!');}else alert(r.message||r.error);}
async function doLogout(){await firebaseLogout();closeModal();showToast('로그아웃');}
function showForgotPasswordModal(){showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md p-6 animate-fade-in"><h2 class="text-xl font-bold mb-4">🔑 비밀번호 찾기</h2><input type="email" id="reset-email" placeholder="이메일" class="w-full px-4 py-3 border border-slate-200 rounded-xl mb-4"><button onclick="doResetPw()" class="w-full py-3 bg-indigo-500 text-white rounded-xl">재설정 링크 보내기</button></div></div>`);}
async function doResetPw(){const e=document.getElementById('reset-email').value.trim();if(!e){alert('이메일 입력');return;}showLoading();const r=await firebaseSendPasswordReset(e);hideLoading();alert(r.success?'메일 전송됨':'실패');if(r.success)showLoginModal();}

// ========== 출석/랭킹/업적/상점/스크랩/내글 ==========
async function showAttendance(){if(!isLoggedIn){showLoginModal();return;}const info=await firebaseGetAttendanceInfo();showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-sm text-center animate-fade-in"><div class="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white"><div class="text-6xl mb-4">✅</div><h2 class="text-2xl font-bold mb-2">출석체크</h2><p class="text-emerald-100">연속 ${info.streak||0}일!</p></div><div class="p-6">${info.hasAttendedToday?`<p class="text-slate-600 mb-4">오늘 이미 출석! 🎉</p>`:`<p class="text-3xl font-bold text-indigo-600 mb-4">+50P</p><button onclick="doAttendance()" class="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium">출석하기</button>`}<button onclick="closeModal()" class="w-full mt-3 py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);}
async function doAttendance(){showLoading();const r=await firebaseDoAttendance();hideLoading();if(r.success){currentUser.points=(currentUser.points||0)+r.points;closeModal();showToast(`🎉 출석! +${r.points}P`);updateLoginUI();}else alert(r.message||r.error);}

async function showRanking(){if(!isLoggedIn){showLoginModal();return;}closeModal();showLoading();let members=[];try{const r=await firebaseGetMembers('points');members=r.members||[];}catch(e){}hideLoading();showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="text-lg font-bold">🏆 랭킹</h2></div><div class="overflow-y-auto flex-1">${members.map((m,i)=>`<div class="flex items-center justify-between p-3 border-b border-slate-100"><div class="flex items-center gap-3"><div class="w-8 text-center font-bold ${i<3?'text-amber-500':''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div><div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-lg">${m.avatar||'😀'}</div><span class="font-medium">${m.name}</span></div><span class="font-bold text-indigo-600">💎 ${(m.points||0).toLocaleString()}</span></div>`).join('')}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);}

async function showAchievements(){if(!isLoggedIn){showLoginModal();return;}
  showLoading();
  let achievements=[], newOnes=[];
  try{
    if(typeof firebaseCheckAchievements==='function'){const ck=await firebaseCheckAchievements();newOnes=ck.newAchievements||[];}
    if(typeof firebaseGetAchievements==='function'){const r=await firebaseGetAchievements();const all=r.all||[];const unlocked=r.unlocked||[];achievements=all.map(a=>({id:a.id,name:a.name,icon:a.icon,description:a.desc||'',reward:a.reward||0,unlocked:unlocked.includes(a.id)}));}
  }catch(e){console.error('업적오류:',e);}
  hideLoading();
  if(newOnes.length){for(const a of newOnes){showToast(`🎯 업적 달성! "${a.name}" +${a.reward}P`);}currentUser.points=(currentUser.points||0)+newOnes.reduce((s,a)=>s+a.reward,0);updateLoginUI();}
  const unlockedCount=achievements.filter(a=>a.unlocked).length;
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="text-lg font-bold">🎯 업적/뱃지</h2><p class="text-sm text-slate-500">${unlockedCount}/${achievements.length} 달성</p></div><div class="overflow-y-auto flex-1 p-4">${achievements.length?`<div class="grid grid-cols-3 gap-3">${achievements.map(a=>`<div class="text-center p-3 rounded-xl ${a.unlocked?'bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200':'bg-slate-50 opacity-50'}"><div class="text-3xl mb-1">${a.icon||'🔒'}</div><div class="text-xs font-bold">${a.name}</div><div class="text-xs text-slate-500">${a.description||''}</div><div class="text-xs mt-1 ${a.unlocked?'text-green-600 font-bold':'text-amber-600'}">${a.unlocked?'✅ 달성':'🎁 +'+a.reward+'P'}</div></div>`).join('')}</div>`:'<div class="text-center text-slate-400 py-8">업적 준비 중!</div>'}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);}

async function showShop(){if(!isLoggedIn){showLoginModal();return;}let items=[];try{if(typeof firebaseGetShopItems==='function'){const r=await firebaseGetShopItems();items=r.items||[];}}catch(e){}showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="text-lg font-bold">🏪 상점</h2><p class="text-sm text-indigo-600">💎 ${(currentUser.points||0).toLocaleString()}P</p></div><div class="overflow-y-auto flex-1 p-4">${items.length?`<div class="grid grid-cols-2 gap-3">${items.map(it=>`<div class="border rounded-xl p-3 text-center ${it.owned?'bg-green-50':''}"><div class="text-3xl mb-2">${it.icon||'🎁'}</div><div class="text-sm font-medium">${it.name}</div>${it.owned?'<span class="text-xs text-green-600">✅ 보유</span>':`<button onclick="buyItem('${it.id}')" class="px-3 py-1 text-xs bg-indigo-500 text-white rounded-lg mt-1">💎 ${it.price}P</button>`}</div>`).join('')}</div>`:'<div class="text-center text-slate-400 py-8">준비 중!</div>'}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);}
async function buyItem(itemId){if(typeof firebaseBuyItem!=='function')return;showLoading();const r=await firebaseBuyItem(itemId);hideLoading();if(r.success){currentUser.points=r.newPoints;showToast('🎉 구매!');showShop();updateLoginUI();}else showToast('❌ '+(r.message||r.error));}

async function showMyPosts(){closeModal();showLoading();const r=await firebaseGetMyPosts();hideLoading();const posts=r.posts||[];showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="text-lg font-bold">📝 내 게시글</h2></div><div class="overflow-y-auto flex-1">${posts.length?posts.map(p=>`<div onclick="closeModal();openPost('${p.id}')" class="p-4 border-b hover:bg-slate-50 cursor-pointer"><h4 class="font-medium">${p.title}</h4><div class="text-xs text-slate-400 mt-1">❤️ ${p.likes||p.likeCount||0}</div></div>`).join(''):'<div class="p-8 text-center text-slate-400">없습니다</div>'}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);}
async function showBookmarks(){closeModal();showLoading();const r=await firebaseGetBookmarks();hideLoading();const posts=r.posts||[];showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="text-lg font-bold">🔖 스크랩</h2></div><div class="overflow-y-auto flex-1">${posts.length?posts.map(p=>`<div onclick="closeModal();openPost('${p.id}')" class="p-4 border-b hover:bg-slate-50 cursor-pointer"><h4 class="font-medium">${p.title}</h4></div>`).join(''):'<div class="p-8 text-center text-slate-400">없습니다</div>'}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);}

// ========== 글쓰기/게시글 상세 ==========
function openWriteModal(){if(!isLoggedIn){showLoginModal();return;}
  const cats=(typeof POST_CATEGORIES!=='undefined'?POST_CATEGORIES:[]).filter(c=>c.id!=='전체');
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b flex justify-between"><h2 class="text-lg font-bold">✍️ 글쓰기</h2><button onclick="closeModal()" class="text-2xl text-slate-400">&times;</button></div><div class="p-4 overflow-y-auto flex-1 space-y-4"><div><label class="block text-sm font-medium text-slate-700 mb-2">카테고리</label><div class="grid grid-cols-3 gap-2" id="write-cat-picker">${cats.map((c,i)=>`<button type="button" onclick="selectWriteCategory('${c.id}',this)" class="write-cat-btn p-2 rounded-xl text-center text-sm border-2 ${i===0?'border-indigo-400 bg-indigo-50':'border-slate-200 bg-slate-50 hover:bg-slate-100'} transition-all"><div class="text-lg">${c.icon}</div><div class="text-xs font-medium mt-0.5">${stripEmoji(c.id)}</div></button>`).join('')}</div><input type="hidden" id="post-category" value="${cats[0]?.id||'💬 자유게시판'}"></div><input type="text" id="post-title" placeholder="제목" class="w-full px-4 py-3 border rounded-xl"><textarea id="post-content" rows="8" placeholder="내용 (본문에 #해시태그 를 포함하면 자동 등록됩니다)" class="w-full px-4 py-3 border rounded-xl resize-none"></textarea><input type="text" id="post-tags" placeholder="해시태그 (쉼표로 구분: 맛집, 추천, 서울)" class="w-full px-4 py-3 border rounded-xl text-sm"></div><div class="p-4 border-t"><button onclick="doCreatePost()" class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium">게시하기</button></div></div></div>`);
}
function selectWriteCategory(catId, btn){
  document.getElementById('post-category').value=catId;
  document.querySelectorAll('.write-cat-btn').forEach(b=>{b.classList.remove('border-indigo-400','bg-indigo-50');b.classList.add('border-slate-200','bg-slate-50');});
  btn.classList.remove('border-slate-200','bg-slate-50');btn.classList.add('border-indigo-400','bg-indigo-50');
}
async function doCreatePost(){const t=document.getElementById('post-title').value.trim(),c=document.getElementById('post-content').value.trim(),cat=document.getElementById('post-category').value;const tagsInput=document.getElementById('post-tags');const tags=tagsInput?tagsInput.value.split(',').map(t=>t.trim()).filter(t=>t):[];if(!t||!c){alert('제목/내용 입력');return;}showLoading();const r=await firebaseCreatePost({title:t,content:c,category:cat,tags});hideLoading();if(r.success){closeModal();showToast('✅ 등록!');showView('board');}else alert(r.message||r.error);}

// 게시글 목록 렌더 헬퍼
function renderPostList(posts){
  if(!posts.length) return '<div class="text-center text-slate-400 py-12">게시글이 없습니다</div>';
  return posts.map(p=>{const ci=typeof getCategoryInfo==='function'?getCategoryInfo(p.category):null;const pinBadge=p.isPinned?'<span class="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-medium mr-1">📌</span>':'';const tags=(p.tags||[]).slice(0,3).map(t=>`<button onclick="event.stopPropagation();searchByTag('${t}')" class="text-xs text-indigo-500 hover:underline">#${t}</button>`).join(' ');return`<div onclick="openPost('${p.id}')" class="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 ${p.isPinned?'bg-amber-50/50':''}"><div class="flex items-center gap-3 flex-1 min-w-0"><div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg">${p.authorAvatar||'😀'}</div><div class="flex-1 min-w-0"><div class="flex items-center gap-1">${pinBadge}<span class="text-xs px-1.5 py-0.5 rounded bg-gradient-to-r ${ci?.color||'from-slate-100 to-slate-200'} ${ci?.text||'text-slate-600'} font-medium">${ci?.icon||'📋'}</span><span class="font-medium text-slate-800 truncate">${p.title}</span></div><div class="text-xs text-slate-500 mt-1">${p.authorName||p.author} · ${formatDate(p.createdAt)} ${tags?'· '+tags:''}</div></div></div><div class="flex items-center gap-3 text-sm text-slate-400"><span>👁️ ${p.views||0}</span><span>❤️ ${p.likeCount||0}</span><span>💬 ${p.commentCount||0}</span></div></div>`;}).join('');
}

async function searchByTag(tag){showLoading();const r=await firebaseSearchByTag(tag);hideLoading();const posts=r.posts||[];const el=document.getElementById('board-list');if(el)el.innerHTML=`<div class="p-3 bg-indigo-50 text-sm text-indigo-700">#${tag} 태그 검색: ${posts.length}건 <button onclick="renderBoardView()" class="ml-2 underline text-slate-500">초기화</button></div>`+(posts.length?renderPostList(posts):'<div class="text-center text-slate-400 py-8">결과 없음</div>');}

// 인기글
async function showHotPosts(){
  showLoading();const r=await firebaseGetHotPosts();hideLoading();
  const posts=r.posts||[];
  const el=document.getElementById('board-list');
  if(el) el.innerHTML=`<div class="p-3 bg-gradient-to-r from-red-50 to-orange-50 text-sm text-red-700 font-medium">🔥 인기글 TOP ${posts.length} <button onclick="renderBoardView()" class="ml-2 underline text-slate-500">전체글</button></div>`+(posts.length?renderPostList(posts):'<div class="text-center text-slate-400 py-12">아직 인기글이 없습니다</div>');
}

// ========== 게시글 상세 (수정/삭제/대댓글/신고) ==========
async function openPost(postId){
  showLoading();
  const [postResult, commentsResult] = await Promise.all([
    firebaseGetPost(postId),
    firebaseGetComments(postId).catch(()=>({comments:[],total:0}))
  ]);
  hideLoading();
  if(!postResult.success){alert('불러올 수 없음');return;}
  const post=postResult.post;
  const comments=commentsResult.comments||[];
  const totalComments=commentsResult.total||post.comments?.length||0;
  const isLiked=(post.likedBy||[]).includes(auth.currentUser?.uid);
  const isMine=post.authorId===auth.currentUser?.uid;
  const ci=typeof getCategoryInfo==='function'?getCategoryInfo(post.category):null;

  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()">
  <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
    <div class="p-4 border-b flex items-center justify-between">
      <span class="text-xs bg-gradient-to-r ${ci?.color||'from-slate-100 to-slate-200'} ${ci?.text||''} px-2 py-1 rounded-full font-medium">${ci?.icon||'📋'} ${stripEmoji(post.category||'')}</span>
      <div class="flex items-center gap-2">
        ${isMine?`<button onclick="showEditPostModal('${postId}')" class="text-xs text-indigo-600 hover:text-indigo-800">✏️ 수정</button><button onclick="doDeletePost('${postId}')" class="text-xs text-red-500 hover:text-red-700">🗑 삭제</button>`:''}
        ${isAdmin?`<button onclick="doTogglePin('${postId}')" class="text-xs ${post.isPinned?'text-amber-600':'text-slate-400'} hover:text-amber-600">${post.isPinned?'📌 고정해제':'📌 고정'}</button>`:''}
        <button onclick="showReportModal('post','${postId}','${escapeHtml(post.title)}','${post.authorId}')" class="text-xs text-slate-400 hover:text-red-500">🚨</button>
        <button onclick="closeModal()" class="text-2xl text-slate-400">&times;</button>
      </div>
    </div>
    <div class="p-6 overflow-y-auto flex-1">
      <h2 class="text-xl font-bold mb-1">${post.title}</h2>
      ${post.editedAt?'<span class="text-xs text-slate-400">(수정됨)</span>':''}
      <div class="flex items-center gap-3 my-4">
        <span class="text-2xl">${post.authorAvatar||'😀'}</span>
        <div><div class="font-medium">${post.author||post.authorName}</div><div class="text-xs text-slate-400">👁️ ${post.views} · ❤️ ${post.likeCount||0} · 💬 ${totalComments} · ${formatDate(post.createdAt)}</div></div>
      </div>
      <div class="mb-6 whitespace-pre-wrap text-slate-700 leading-relaxed">${escapeHtml(post.content)}</div>
      ${(post.tags||[]).length?`<div class="flex flex-wrap gap-1 mb-4">${post.tags.map(t=>`<button onclick="closeModal();searchByTag('${t}')" class="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full hover:bg-indigo-100">#${t}</button>`).join('')}</div>`:''}
      <div class="flex gap-3 py-4 border-t">
        <button onclick="toggleLike('${postId}')" class="flex items-center gap-2 px-4 py-2 rounded-full ${isLiked?'bg-red-100 text-red-600':'bg-slate-100 hover:bg-red-50'}">${isLiked?'❤️':'🤍'} ${post.likeCount||0}</button>
        <button onclick="toggleBookmark('${postId}')" class="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-amber-50">🔖 저장</button>
        ${!isMine&&isLoggedIn?`<button onclick="toggleFollowFromPost('${post.authorId}',this)" class="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-indigo-50 text-sm" id="follow-btn-post">👥 팔로우</button>`:''}
      </div>
      <div class="pt-4 border-t">
        <h3 class="font-bold mb-4">💬 댓글 ${totalComments}</h3>
        <div id="comments-area">${renderComments(comments, postId)}</div>
        ${isLoggedIn?`<div class="flex gap-2 mt-3"><input type="text" id="comment-input" placeholder="댓글을 입력하세요..." class="flex-1 px-4 py-2 border rounded-xl text-sm" onkeypress="if(event.key==='Enter')addComment('${postId}')"><button onclick="addComment('${postId}')" class="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm">등록</button></div>`:''}
      </div>
    </div>
  </div></div>`);
}

function renderComments(comments, postId){
  if(!comments.length) return '';
  const uid=auth.currentUser?.uid;
  return comments.map(c=>{
    const isMine=c.authorId===uid;
    return`<div class="mb-3"><div class="p-3 bg-slate-50 rounded-xl"><div class="flex items-center justify-between mb-1"><div class="flex items-center gap-2"><span class="text-lg">${c.authorAvatar||'😀'}</span><span class="font-medium text-sm">${c.authorName||c.author}</span><span class="text-xs text-slate-400">${formatDate(c.createdAt)}</span>${c.editedAt?'<span class="text-xs text-slate-400">(수정)</span>':''}</div><div class="flex items-center gap-1">${isMine?`<button onclick="doEditComment('${postId}','${c.id}')" class="text-xs text-slate-400 hover:text-indigo-600">수정</button><button onclick="doDeleteComment('${postId}','${c.id}')" class="text-xs text-slate-400 hover:text-red-500">삭제</button>`:`<button onclick="showReportModal('comment','${c.id}','댓글','${c.authorId}')" class="text-xs text-slate-400 hover:text-red-500">🚨</button>`}</div></div><p class="text-sm text-slate-700">${escapeHtml(c.content)}</p><button onclick="showReplyInput('${postId}','${c.id}')" class="text-xs text-indigo-500 mt-1 hover:text-indigo-700">↩ 답글</button><div id="reply-input-${c.id}" class="hidden mt-2"><div class="flex gap-2"><input type="text" id="reply-text-${c.id}" placeholder="답글..." class="flex-1 px-3 py-1.5 border rounded-lg text-sm" onkeypress="if(event.key==='Enter')addReply('${postId}','${c.id}')"><button onclick="addReply('${postId}','${c.id}')" class="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs">등록</button></div></div></div>${(c.replies||[]).map(r=>{const rMine=r.authorId===uid;return`<div class="ml-8 mt-1 p-2 bg-indigo-50 rounded-lg"><div class="flex items-center justify-between mb-1"><div class="flex items-center gap-2"><span>↳</span><span class="text-sm">${r.authorAvatar||'😀'}</span><span class="font-medium text-xs">${r.authorName}</span><span class="text-xs text-slate-400">${formatDate(r.createdAt)}</span></div>${rMine?`<button onclick="doDeleteComment('${postId}','${r.id}')" class="text-xs text-slate-400 hover:text-red-500">삭제</button>`:''}</div><p class="text-xs text-slate-700">${escapeHtml(r.content)}</p></div>`;}).join('')}</div>`;
  }).join('');
}

function showReplyInput(postId,commentId){const el=document.getElementById('reply-input-'+commentId);if(el)el.classList.toggle('hidden');const input=document.getElementById('reply-text-'+commentId);if(input)input.focus();}
async function addReply(postId,parentId){const input=document.getElementById('reply-text-'+parentId);const text=input?.value.trim();if(!text)return;showLoading();const r=await firebaseAddComment(postId,text,parentId);hideLoading();if(r.success){openPost(postId);showToast('↩ 답글 등록!');}else alert(r.error||'실패');}

function showPostDetail(id){openPost(id);}
async function toggleLike(id){if(!isLoggedIn)return;const r=await firebaseToggleLike(id);if(r.success)openPost(id);}
async function toggleBookmark(id){if(!isLoggedIn)return;const r=await firebaseToggleBookmark(id);if(r.success)showToast(r.bookmarked?'🔖 스크랩!':'해제');}
async function addComment(postId){const i=document.getElementById('comment-input'),c=i.value.trim();if(!c)return;showLoading();const r=await firebaseAddComment(postId,c);hideLoading();if(r.success){openPost(postId);showToast('💬 등록!');}else alert(r.message||'실패');}

// 게시글 수정
async function showEditPostModal(postId){
  closeModal();showLoading();const r=await firebaseGetPost(postId);hideLoading();
  if(!r.success)return;const post=r.post;
  const cats=(typeof POST_CATEGORIES!=='undefined'?POST_CATEGORIES:[]).filter(c=>c.id!=='전체');
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="text-lg font-bold">✏️ 게시글 수정</h2></div><div class="p-4 overflow-y-auto flex-1 space-y-4"><div class="grid grid-cols-3 gap-2">${cats.map(c=>`<button type="button" onclick="selectWriteCategory('${c.id}',this)" class="write-cat-btn p-2 rounded-xl text-center text-sm border-2 ${stripEmoji(c.id)===stripEmoji(post.category||'')?'border-indigo-400 bg-indigo-50':'border-slate-200 bg-slate-50'} transition-all"><div class="text-lg">${c.icon}</div><div class="text-xs font-medium mt-0.5">${stripEmoji(c.id)}</div></button>`).join('')}</div><input type="hidden" id="post-category" value="${post.category||''}"><input type="text" id="edit-post-title" value="${escapeHtml(post.title)}" class="w-full px-4 py-3 border rounded-xl"><textarea id="edit-post-content" rows="8" class="w-full px-4 py-3 border rounded-xl resize-none">${escapeHtml(post.content)}</textarea></div><div class="p-4 border-t"><button onclick="doEditPost('${postId}')" class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium">수정 완료</button></div></div></div>`);
}
async function doEditPost(postId){const t=document.getElementById('edit-post-title').value.trim(),c=document.getElementById('edit-post-content').value.trim(),cat=document.getElementById('post-category').value;if(!t||!c){alert('입력하세요');return;}showLoading();const r=await firebaseEditPost(postId,{title:t,content:c,category:cat});hideLoading();if(r.success){closeModal();showToast('✅ 수정 완료!');openPost(postId);}else showToast('❌ '+r.error);}
async function doDeletePost(postId){if(!confirm('정말 삭제할까요?'))return;showLoading();const r=await firebaseDeletePost(postId);hideLoading();if(r.success){closeModal();showToast('🗑 삭제 완료');showView('board');}else showToast('❌ '+r.error);}

// 댓글 수정/삭제
async function doEditComment(postId,commentId){const newText=prompt('수정할 내용:');if(!newText)return;showLoading();const r=await firebaseEditComment(postId,commentId,newText);hideLoading();if(r.success){openPost(postId);showToast('✏️ 수정됨');}else showToast('❌ '+r.error);}
async function doDeleteComment(postId,commentId){if(!confirm('댓글을 삭제할까요?'))return;showLoading();const r=await firebaseDeleteComment(postId,commentId);hideLoading();if(r.success){openPost(postId);showToast('🗑 삭제됨');}else showToast('❌ '+r.error);}

// 신고 모달
function showReportModal(type,targetId,targetTitle,targetAuthorId){
  const reasons=['스팸/광고','욕설/비방','부적절한 내용','허위정보','기타'];
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-sm animate-fade-in"><div class="p-5 border-b"><h2 class="text-lg font-bold text-red-600">🚨 신고</h2><p class="text-sm text-slate-500 mt-1">${type==='post'?'게시글':'댓글'} 신고</p></div><div class="p-5 space-y-2">${reasons.map(r=>`<button onclick="doReport('${type}','${targetId}','${escapeHtml(targetTitle)}','${targetAuthorId}','${r}')" class="w-full p-3 text-left bg-slate-50 hover:bg-red-50 rounded-xl text-sm">${r}</button>`).join('')}<button onclick="closeModal()" class="w-full mt-2 py-3 bg-slate-100 rounded-xl text-sm">취소</button></div></div></div>`);
}
async function doReport(type,targetId,title,authorId,reason){showLoading();const r=await firebaseReportContent({type,targetId,targetTitle:title,targetAuthorId:authorId,reason});hideLoading();closeModal();if(r.success)showToast('🚨 신고가 접수되었습니다');else showToast('❌ '+r.error);}

// ========== 설정 ==========
function showSettings(){
  if(!isLoggedIn){showLoginModal();return;}
  closeModal();
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-auto animate-fade-in"><div class="p-5 border-b"><h2 class="text-lg font-bold">⚙️ 설정</h2></div><div class="p-5 space-y-4">
    <div class="p-4 bg-slate-50 rounded-xl"><h3 class="font-medium mb-3">🔐 비밀번호 변경</h3><input type="password" id="set-current-pw" placeholder="현재 비밀번호" class="w-full px-4 py-2 border rounded-xl mb-2 text-sm"><input type="password" id="set-new-pw" placeholder="새 비밀번호 (6자 이상)" class="w-full px-4 py-2 border rounded-xl mb-2 text-sm"><button onclick="doChangePw()" class="w-full py-2 bg-indigo-500 text-white rounded-xl text-sm">변경</button></div>
    <div class="p-4 bg-red-50 rounded-xl"><h3 class="font-medium text-red-600 mb-3">⚠️ 위험 영역</h3><p class="text-xs text-red-500 mb-3">계정을 삭제하면 모든 데이터가 삭제되며 복구할 수 없습니다.</p><button onclick="doDeleteAccount()" class="w-full py-2 bg-red-500 text-white rounded-xl text-sm">계정 삭제</button></div>
    <button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button>
  </div></div></div>`);
}
async function doChangePw(){const cur=document.getElementById('set-current-pw').value,nw=document.getElementById('set-new-pw').value;if(!cur||!nw){alert('입력하세요');return;}if(nw.length<6){alert('6자 이상');return;}showLoading();const r=await firebaseChangePassword(cur,nw);hideLoading();if(r.success){showToast('🔐 비밀번호 변경 완료!');document.getElementById('set-current-pw').value='';document.getElementById('set-new-pw').value='';}else showToast('❌ '+r.error);}
async function doDeleteAccount(){const pw=prompt('비밀번호를 입력하세요:');if(!pw)return;if(!confirm('정말로 계정을 삭제하시겠습니까? 되돌릴 수 없습니다!'))return;showLoading();const r=await firebaseDeleteAccount(pw);hideLoading();if(r.success){closeModal();showToast('계정이 삭제되었습니다');}else showToast('❌ '+r.error);}

// ========== 내 활동 통계 ==========
async function showMyStats(){
  if(!isLoggedIn){showLoginModal();return;}
  closeModal();showLoading();const r=await firebaseGetMyStats();hideLoading();
  const s=r.stats||{};
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md animate-fade-in"><div class="p-5 border-b"><h2 class="text-lg font-bold">📊 내 활동 통계</h2></div><div class="p-5">
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="text-center p-3 bg-blue-50 rounded-xl"><div class="text-2xl font-bold text-blue-600">${s.posts||0}</div><div class="text-xs text-slate-500">게시글</div></div>
      <div class="text-center p-3 bg-green-50 rounded-xl"><div class="text-2xl font-bold text-green-600">${s.comments||0}</div><div class="text-xs text-slate-500">댓글</div></div>
      <div class="text-center p-3 bg-purple-50 rounded-xl"><div class="text-2xl font-bold text-purple-600">💎 ${(s.points||0).toLocaleString()}</div><div class="text-xs text-slate-500">포인트</div></div>
    </div>
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="text-center p-3 bg-red-50 rounded-xl"><div class="text-2xl font-bold text-red-500">${s.totalLikes||0}</div><div class="text-xs text-slate-500">받은 좋아요</div></div>
      <div class="text-center p-3 bg-amber-50 rounded-xl"><div class="text-2xl font-bold text-amber-600">${(s.totalViews||0).toLocaleString()}</div><div class="text-xs text-slate-500">총 조회수</div></div>
      <div class="text-center p-3 bg-emerald-50 rounded-xl"><div class="text-2xl font-bold text-emerald-600">${s.attendanceDays||0}</div><div class="text-xs text-slate-500">출석일</div></div>
    </div>
    <div class="text-center text-sm text-slate-500">등급: ${s.grade||'🌱 새싹'} ${s.joinDate?` · 가입: ${formatFullDate(s.joinDate)}`:''}</div>
    <button onclick="closeModal()" class="w-full mt-4 py-3 bg-slate-100 rounded-xl">닫기</button>
  </div></div></div>`);
}

console.log('🎓 c반놈들 앱 로드 완료!');

// 게시글 고정 토글
async function doTogglePin(postId){showLoading();const r=await firebaseTogglePinPost(postId);hideLoading();if(r.success){closeModal();showToast(r.isPinned?'📌 고정됨':'📌 고정 해제');showView('board');}else showToast('❌ '+r.error);}

// 팔로우 (게시글 상세에서)
async function toggleFollowFromPost(userId,btn){
  if(!isLoggedIn)return;
  const isF=await firebaseIsFollowing(userId);
  if(isF){await firebaseUnfollowUser(userId);if(btn)btn.innerHTML='👥 팔로우';showToast('팔로우 해제');}
  else{await firebaseFollowUser(userId);if(btn)btn.innerHTML='✅ 팔로잉';showToast('팔로우!');}
}

// 멤버 프로필 보기
async function showUserProfile(userId){
  showLoading();
  const [userDoc, isFollowing, followers, following] = await Promise.all([
    db.collection('users').doc(userId).get(),
    firebaseIsFollowing(userId),
    firebaseGetFollowers(userId).catch(()=>({users:[]})),
    firebaseGetFollowing(userId).catch(()=>({users:[]}))
  ]);
  hideLoading();
  if(!userDoc.exists){showToast('사용자를 찾을 수 없습니다');return;}
  const u=userDoc.data();
  const isSelf=userId===currentUser.uid;
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-sm animate-fade-in">
    <div class="bg-gradient-to-r ${u.profileBg||'from-indigo-400 to-purple-500'} p-6 text-white rounded-t-2xl"><div class="flex items-center gap-4"><div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">${u.avatar||'😀'}</div><div><h3 class="font-bold text-lg">${u.name}</h3><p class="text-sm opacity-80">${u.grade||'🌱 새싹'}</p><p class="text-sm">💎 ${(u.points||0).toLocaleString()}P</p>${u.bio?`<p class="text-xs opacity-80 mt-1">${u.bio}</p>`:''}</div></div></div>
    <div class="p-4">
      <div class="flex justify-around mb-4 text-center"><div><div class="font-bold">${u.posts||0}</div><div class="text-xs text-slate-500">게시글</div></div><div onclick="showFollowerList('${userId}')" class="cursor-pointer"><div class="font-bold">${u.followerCount||0}</div><div class="text-xs text-slate-500">팔로워</div></div><div onclick="showFollowingList('${userId}')" class="cursor-pointer"><div class="font-bold">${u.followingCount||0}</div><div class="text-xs text-slate-500">팔로잉</div></div></div>
      ${!isSelf&&isLoggedIn?`<div class="flex gap-2"><button onclick="toggleFollowFromProfile('${userId}',this)" class="flex-1 py-2 rounded-xl text-sm font-medium ${isFollowing?'bg-slate-200 text-slate-600':'bg-indigo-500 text-white'}">${isFollowing?'✅ 팔로잉':'👥 팔로우'}</button><button onclick="closeModal();showSendDM('${userId}','${u.name}')" class="px-4 py-2 bg-slate-100 rounded-xl text-sm">📩 쪽지</button></div>`:''}
      <button onclick="closeModal()" class="w-full mt-3 py-3 bg-slate-100 rounded-xl text-sm">닫기</button>
    </div></div></div>`);
}

async function toggleFollowFromProfile(userId,btn){
  const isF=await firebaseIsFollowing(userId);
  if(isF){await firebaseUnfollowUser(userId);btn.className='flex-1 py-2 rounded-xl text-sm font-medium bg-indigo-500 text-white';btn.textContent='👥 팔로우';showToast('팔로우 해제');}
  else{await firebaseFollowUser(userId);btn.className='flex-1 py-2 rounded-xl text-sm font-medium bg-slate-200 text-slate-600';btn.textContent='✅ 팔로잉';showToast('팔로우!');}
}

async function showFollowerList(userId){closeModal();showLoading();const r=await firebaseGetFollowers(userId);hideLoading();showUserListModal('팔로워',r.users||[]);}
async function showFollowingList(userId){closeModal();showLoading();const r=await firebaseGetFollowing(userId);hideLoading();showUserListModal('팔로잉',r.users||[]);}
function showUserListModal(title,users){
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-sm max-h-[70vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="font-bold">${title} (${users.length})</h2></div><div class="overflow-y-auto flex-1">${users.length?users.map(u=>`<div onclick="closeModal();showUserProfile('${u.uid}')" class="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b"><div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-lg">${u.avatar||'😀'}</div><div><div class="font-medium text-sm">${u.name}</div><div class="text-xs text-slate-500">💎 ${(u.points||0).toLocaleString()}</div></div></div>`).join(''):'<div class="p-8 text-center text-slate-400">없습니다</div>'}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);
}

// 관리자 신고 관리
async function showAdminReports(){
  showLoading();const r=await firebaseAdminGetReports();hideLoading();
  const reports=r.reports||[];
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="font-bold text-red-600">🚨 신고 관리 (${reports.length}건)</h2></div><div class="overflow-y-auto flex-1">${reports.length?reports.map(r=>`<div class="p-4 border-b ${r.status==='pending'?'bg-red-50':''}"><div class="flex justify-between mb-1"><span class="text-sm font-medium">${r.type==='post'?'게시글':'댓글'} 신고</span><span class="text-xs px-2 py-0.5 rounded-full ${r.status==='pending'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}">${r.status==='pending'?'대기중':'처리됨'}</span></div><div class="text-xs text-slate-500">사유: ${r.reason} · 신고자: ${r.reporterName} · ${formatDate(r.createdAt)}</div>${r.status==='pending'?`<div class="flex gap-2 mt-2"><button onclick="resolveReport('${r.id}','resolved')" class="px-3 py-1 text-xs bg-green-500 text-white rounded-lg">처리</button><button onclick="resolveReport('${r.id}','dismissed')" class="px-3 py-1 text-xs bg-slate-300 rounded-lg">무시</button></div>`:''}</div>`).join(''):'<div class="p-8 text-center text-slate-400">신고 없음</div>'}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);
}
async function resolveReport(id,action){showLoading();const r=await firebaseAdminResolveReport(id,action);hideLoading();if(r.success){showToast(action==='resolved'?'✅ 처리됨':'무시됨');showAdminReports();}else showToast('❌ '+r.error);}

// ========== 접속 현황 ==========
async function showAdminOnlineUsers(){
  showLoading();const r=await firebaseAdminGetOnlineUsers();hideLoading();
  const users=r.users||[];
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="font-bold text-green-600">📊 실시간 접속 현황 (${users.length}명)</h2></div><div class="overflow-y-auto flex-1">${users.length?users.map(u=>`<div class="flex items-center gap-3 p-3 border-b"><div class="w-2 h-2 bg-green-500 rounded-full"></div><span class="text-lg">${u.avatar||'😀'}</span><div><div class="font-medium text-sm">${u.name||'알 수 없음'}</div><div class="text-xs text-slate-400">${u.lastSeen?formatDate(u.lastSeen):''}</div></div></div>`).join(''):'<div class="p-8 text-center text-slate-400">접속자 없음</div>'}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);
}

// ========== 활동 로그 ==========
async function showAdminActivityLogs(){
  showLoading();const r=await firebaseAdminGetLogs();hideLoading();
  const logs=r.logs||[];
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="font-bold text-indigo-600">📝 활동 로그</h2></div><div class="overflow-y-auto flex-1">${logs.length?logs.map(l=>`<div class="p-3 border-b text-sm"><div class="flex justify-between"><span class="font-medium">${l.action||''}</span><span class="text-xs text-slate-400">${formatDate(l.createdAt)}</span></div><div class="text-xs text-slate-500 mt-1">${l.adminName||''} · ${typeof l.details==='string'?l.details:JSON.stringify(l.details||'')}</div></div>`).join(''):'<div class="p-8 text-center text-slate-400">로그 없음</div>'}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);
}

// ========== 게시글 관리 ==========
async function showAdminPostsMgmt(){
  showLoading();const r=await firebaseAdminGetAllPosts();hideLoading();
  const posts=r.posts||[];
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="font-bold text-blue-600">📋 게시글 관리 (${posts.length}개)</h2><input type="text" id="admin-post-search" placeholder="검색..." class="w-full px-3 py-2 border rounded-xl mt-2 text-sm" oninput="filterAdminPosts()"></div><div class="overflow-y-auto flex-1" id="admin-posts-list">${renderAdminPostsList(posts)}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);
  window._adminPosts=posts;
}
function renderAdminPostsList(posts){return posts.length?posts.map(p=>`<div class="flex items-center justify-between p-3 border-b ${p.isDeleted?'opacity-40':''}"><div class="flex-1 min-w-0 mr-2"><div class="font-medium text-sm truncate">${p.isPinned?'📌 ':''}${p.title||'제목없음'}</div><div class="text-xs text-slate-500">${p.authorName||''} · ${stripEmoji(p.category||'')} · ${formatDate(p.createdAt)}</div></div><div class="flex gap-1"><button onclick="adminTogglePin('${p.id}')" class="px-2 py-1 text-xs ${p.isPinned?'bg-amber-100 text-amber-700':'bg-slate-100'} rounded">${p.isPinned?'📌해제':'📌고정'}</button><button onclick="adminDeletePostFromList('${p.id}')" class="px-2 py-1 text-xs bg-red-100 text-red-600 rounded">${p.isDeleted?'복구':'삭제'}</button></div></div>`).join(''):'<div class="p-8 text-center text-slate-400">게시글 없음</div>';}
function filterAdminPosts(){const q=(document.getElementById('admin-post-search')?.value||'').toLowerCase();const el=document.getElementById('admin-posts-list');if(!el||!window._adminPosts)return;const filtered=window._adminPosts.filter(p=>(p.title||'').toLowerCase().includes(q)||(p.authorName||'').toLowerCase().includes(q));el.innerHTML=renderAdminPostsList(filtered);}
async function adminTogglePin(postId){showLoading();const r=await firebaseTogglePinPost(postId);hideLoading();if(r.success){showToast(r.isPinned?'📌 고정':'📌 해제');showAdminPostsMgmt();}else showToast('❌ '+r.error);}
async function adminDeletePostFromList(postId){if(!confirm('삭제/복구?'))return;showLoading();try{const doc=await db.collection('posts').doc(postId).get();const isDel=doc.data()?.isDeleted;await db.collection('posts').doc(postId).update({isDeleted:!isDel});showToast(isDel?'복구됨':'삭제됨');}catch(e){showToast('❌ '+e.message);}hideLoading();showAdminPostsMgmt();}

// ========== 공지 관리 ==========
async function showAdminNoticesMgmt(){
  showLoading();const r=await firebaseAdminGetNotices();hideLoading();
  const notices=r.notices||[];
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col animate-fade-in"><div class="p-4 border-b"><h2 class="font-bold text-orange-600">📢 공지 관리 (${notices.length}개)</h2></div><div class="overflow-y-auto flex-1">${notices.length?notices.map(n=>`<div class="p-3 border-b ${n.isActive===false?'opacity-40':''}"><div class="font-medium text-sm">${n.title}</div><div class="text-xs text-slate-500 mt-1">${(n.content||'').substring(0,50)} · ${formatDate(n.createdAt)}</div><div class="flex gap-2 mt-2"><button onclick="adminToggleNotice('${n.id}')" class="px-2 py-1 text-xs ${n.isActive!==false?'bg-green-100 text-green-700':'bg-slate-100'} rounded">${n.isActive!==false?'활성':'비활성'}</button><button onclick="adminEditNotice('${n.id}')" class="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded">수정</button><button onclick="adminDeleteNotice('${n.id}')" class="px-2 py-1 text-xs bg-red-100 text-red-600 rounded">삭제</button></div></div>`).join(''):'<div class="p-8 text-center text-slate-400">공지 없음</div>'}</div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);
}
async function adminToggleNotice(id){showLoading();const r=await firebaseAdminToggleNotice(id);hideLoading();if(r.success)showAdminNoticesMgmt();else showToast('❌ '+r.error);}
async function adminEditNotice(id){const title=prompt('공지 제목:');if(!title)return;const content=prompt('공지 내용:');if(!content)return;showLoading();const r=await firebaseAdminEditNotice(id,{title,content});hideLoading();if(r.success){showToast('✅ 수정됨');showAdminNoticesMgmt();}else showToast('❌ '+r.error);}
async function adminDeleteNotice(id){if(!confirm('공지를 삭제할까요?'))return;showLoading();const r=await firebaseAdminDeleteNotice(id);hideLoading();if(r.success){showToast('🗑 삭제됨');showAdminNoticesMgmt();}else showToast('❌ '+r.error);}

// ========== 채팅방 관리 ==========
async function showAdminChatMgmt(){
  const rooms=typeof CHAT_ROOMS!=='undefined'?CHAT_ROOMS:[];
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md animate-fade-in"><div class="p-4 border-b"><h2 class="font-bold text-teal-600">💬 채팅방 관리</h2></div><div class="p-4 space-y-2">${rooms.map(r=>`<div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl"><div><div class="font-medium text-sm">${r.name}</div><div class="text-xs text-slate-500">${r.desc||''}</div></div></div>`).join('')}<div class="border-t pt-3 mt-3"><h4 class="text-sm font-medium mb-2">채팅방 추가</h4><input type="text" id="new-room-id" placeholder="ID (영문)" class="w-full px-3 py-2 border rounded-xl mb-2 text-sm"><input type="text" id="new-room-name" placeholder="이름 (예: 🎵 음악)" class="w-full px-3 py-2 border rounded-xl mb-2 text-sm"><input type="text" id="new-room-desc" placeholder="설명" class="w-full px-3 py-2 border rounded-xl mb-2 text-sm"><button onclick="doAddChatRoom()" class="w-full py-2 bg-teal-500 text-white rounded-xl text-sm">추가</button></div></div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);
}
async function doAddChatRoom(){const id=document.getElementById('new-room-id').value.trim();const name=document.getElementById('new-room-name').value.trim();const desc=document.getElementById('new-room-desc').value.trim();if(!id||!name){alert('ID와 이름을 입력하세요');return;}showLoading();const r=await firebaseAdminAddChatRoom(id,name,desc);hideLoading();if(r.success){showToast('💬 채팅방 추가됨');showAdminChatMgmt();}else showToast('❌ '+r.error);}

// ========== 팝업 공지 ==========
async function showAdminPopupNotice(){
  showLoading();let current={title:'',content:'',active:false};
  try{const r=await firebaseGetPopupNotice();if(r.notice)current=r.notice;}catch(e){}
  hideLoading();
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md animate-fade-in"><div class="p-4 border-b"><h2 class="font-bold text-pink-600">📣 팝업 공지 설정</h2><p class="text-xs text-slate-500 mt-1">로그인 시 모든 사용자에게 팝업으로 표시됩니다</p></div><div class="p-4 space-y-3"><input type="text" id="popup-title" placeholder="팝업 제목" value="${current.title||''}" class="w-full px-4 py-2 border rounded-xl"><textarea id="popup-content" placeholder="팝업 내용" rows="4" class="w-full px-4 py-2 border rounded-xl resize-none">${current.content||''}</textarea><div class="flex items-center gap-2"><input type="checkbox" id="popup-active" ${current.active?'checked':''}><label for="popup-active" class="text-sm">팝업 활성화</label></div><button onclick="doSetPopupNotice()" class="w-full py-3 bg-pink-500 text-white rounded-xl font-medium">저장</button></div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);
}
async function doSetPopupNotice(){const t=document.getElementById('popup-title').value.trim();const c=document.getElementById('popup-content').value.trim();const active=document.getElementById('popup-active').checked;if(active&&(!t||!c)){alert('제목과 내용을 입력하세요');return;}showLoading();const r=await firebaseAdminSetPopupNotice(t,c,active);hideLoading();if(r.success){closeModal();showToast(active?'📣 팝업 공지 활성화!':'팝업 비활성화');}else showToast('❌ '+r.error);}

// ========== 사이트 설정 ==========
async function showAdminSiteSettings(){
  showLoading();let settings={siteName:'c반놈들',siteDesc:'우리만의 커뮤니티',siteEmoji:'🎓'};
  try{const r=await firebaseAdminGetSiteSettings();if(r.settings)settings={...settings,...r.settings};}catch(e){}
  hideLoading();
  showModal(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this)closeModal()"><div class="bg-white rounded-2xl w-full max-w-md animate-fade-in"><div class="p-4 border-b"><h2 class="font-bold">⚙️ 사이트 설정</h2></div><div class="p-4 space-y-3"><div><label class="text-sm font-medium">사이트 이름</label><input type="text" id="site-name" value="${settings.siteName||''}" class="w-full px-4 py-2 border rounded-xl mt-1"></div><div><label class="text-sm font-medium">사이트 설명</label><input type="text" id="site-desc" value="${settings.siteDesc||''}" class="w-full px-4 py-2 border rounded-xl mt-1"></div><div><label class="text-sm font-medium">사이트 아이콘</label><div class="flex gap-2 mt-1">${['🎓','🏫','🎯','🚀','💫','⭐','🌟','💎'].map(e=>`<button onclick="document.getElementById('site-emoji').value='${e}';this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('ring-2'));this.classList.add('ring-2','ring-indigo-500')" class="text-2xl p-2 rounded-lg hover:bg-slate-100 ${e===settings.siteEmoji?'ring-2 ring-indigo-500':''}">${e}</button>`).join('')}<input type="hidden" id="site-emoji" value="${settings.siteEmoji||'🎓'}"></div></div><button onclick="doSaveSiteSettings()" class="w-full py-3 bg-slate-700 text-white rounded-xl font-medium">저장</button></div><div class="p-4 border-t"><button onclick="closeModal()" class="w-full py-3 bg-slate-100 rounded-xl">닫기</button></div></div></div>`);
}
async function doSaveSiteSettings(){const name=document.getElementById('site-name').value.trim();const desc=document.getElementById('site-desc').value.trim();const emoji=document.getElementById('site-emoji').value;if(!name){alert('사이트 이름을 입력하세요');return;}showLoading();const r=await firebaseAdminUpdateSiteSettings({siteName:name,siteDesc:desc,siteEmoji:emoji});hideLoading();if(r.success){closeModal();showToast('⚙️ 설정 저장됨');}else showToast('❌ '+r.error);}
