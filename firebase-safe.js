/* ========================================
   🛡️ 공통 안전 유틸 (firebase-config.js 다음, 다른 모듈보다 먼저 로드)
   1) HTML 이스케이프 (XSS 방지)  2) 한국 시간(KST) 날짜  3) 포인트 안전 증감(트랜잭션)
   ======================================== */

// ---------- 1) XSS 방지 ----------
// 이미 이스케이프된 문자열을 다시 이스케이프해도 결과가 같도록(idempotent) 만든 함수
function escapeHtml(t) {
  if (t === undefined || t === null) return '';
  return String(t)
    .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unescapeHtml(t) {
  if (t === undefined || t === null) return '';
  return String(t)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// onclick="fn('...')" 처럼 HTML 속성 안의 JS 문자열에 사용자 값을 넣을 때 사용
// (JS 이스케이프 → HTML 속성 이스케이프 순서)
function jsAttr(t) {
  const raw = unescapeHtml(t);
  const js = raw
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n').replace(/</g, '\\x3c').replace(/>/g, '\\x3e');
  return js.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Firestore 문서의 모든 문자열 값을 읽을 때 자동 이스케이프
// → 어느 화면에서 ${값} 으로 그려도 스크립트가 실행되지 않음
// 원본이 꼭 필요하면 doc.data({ __raw: true }) 사용
(function patchFirestoreSnapshots() {
  try {
    if (!window.firebase || !firebase.firestore) return;
    const SKIP_KEYS = { createdAt: 1, updatedAt: 1 };
    function esc(v) {
      if (typeof v === 'string') return escapeHtml(v);
      if (Array.isArray(v)) return v.map(esc);
      if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
        const o = {};
        for (const k in v) o[k] = SKIP_KEYS[k] ? v[k] : esc(v[k]);
        return o;
      }
      return v; // 숫자, 불리언, Timestamp 등은 그대로
    }
    const targets = [firebase.firestore.DocumentSnapshot, firebase.firestore.QueryDocumentSnapshot];
    targets.forEach(function (C) {
      if (!C || !C.prototype || Object.prototype.hasOwnProperty.call(C.prototype, '__safePatched')) return;
      const orig = C.prototype.data;
      C.prototype.data = function (options) {
        const raw = !!(options && options.__raw);
        const d = orig.call(this, raw ? undefined : options);
        return raw ? d : esc(d);
      };
      Object.defineProperty(C.prototype, '__safePatched', { value: true });
    });
  } catch (e) {
    console.warn('Firestore 안전 패치 실패:', e);
  }
})();

// ---------- 2) 한국 시간(KST) 날짜 ----------
// toISOString() 은 UTC 기준이라 한국에서는 오전 9시에 날짜가 바뀜 → KST 기준으로 계산
function kstDateStr(offsetDays) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 + (offsetDays || 0) * 86400000);
  return d.toISOString().split('T')[0];
}

// ---------- 3) 포인트 안전 증감 (동시 실행에도 안전, 0 미만으로 내려가지 않음) ----------
async function applyPointDelta(uid, delta, requireEnough) {
  const ref = db.collection('users').doc(uid);
  return await db.runTransaction(async function (tx) {
    const snap = await tx.get(ref);
    const cur = (snap.exists && snap.data().points) || 0;
    if (requireEnough && cur + delta < 0) {
      const e = new Error('포인트가 부족합니다'); e.code = 'insufficient-points'; throw e;
    }
    const next = Math.max(0, cur + delta);
    tx.update(ref, { points: next });
    return next;
  });
}

console.log('🛡️ 안전 유틸 로드 완료!');
