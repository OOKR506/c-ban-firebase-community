# C반 놈들 🎓

> Firebase 기반 학급 커뮤니티 PWA 웹서비스
> "C반 놈들, 반 친구들과 함께하는 온라인 카페. 소통과 참여가 한곳에."

- **Live Demo**: https://c-ban-firebase-community.web.app
- **체험 계정** (일반 회원 권한): `demo@c-ban.test` / `Demo1234!`
  - 게시판·홈은 로그인 없이 볼 수 있고, 채팅·게임·포인트 기능은 로그인 후 체험할 수 있습니다.
- **개발 형태**: 4인 팀 프로젝트 (신구대학교 소프트웨어 공학 전시회 출품작)
- **개발 기간**: 2026.02.06 ~ 2026.06.17

<!-- 스크린샷: docs/ 폴더에 이미지를 넣고 아래 주석을 해제하세요 -->
<!-- ![홈 피드](./docs/home.png) -->

## 1. 프로젝트 소개

반 공지·일정·소통 수단이 카카오톡과 오프라인으로 흩어져 있고, 참여 기록이 남지 않아 누가 언제 무엇을 했는지 파악하기 어려웠습니다. 이 문제를 해결하기 위해 **게시판, 실시간 채팅, 투표, 미니게임을 하나의 포인트 시스템으로 연결한 학급 커뮤니티**를 기획하고 개발했습니다.

### 해결하려던 문제
- 반 공지·일정·소통 수단이 카톡/오프라인으로 분산
- 참여 데이터가 남지 않아 활동 파악이 어려움
- 학기 중 반복되는 행사·투표를 매번 수동으로 정리

### 해결 방법
- 통합 피드 + 카테고리 게시판 + 주제별 채팅방
- 투표·D-Day·미니게임을 하나의 포인트 시스템으로 연결
- PWA 지원으로 홈 화면에 추가해 앱처럼 사용

---

## 2. 주요 기능

| 기능 | 설명 |
|---|---|
| 🏠 홈 피드 | 미션, 랭킹, 최근 게시글, 카테고리 바로가기를 한 화면에 구성 |
| 📋 카테고리 게시판 | 9개 관심사별 분류, 공지 고정, 검색, 인기글, 댓글·대댓글, 스크랩 |
| 💬 실시간 채팅 | 5개 주제별 채팅방, Firestore `onSnapshot`으로 즉시 반영 |
| 🗳️ 투표 · D-Day | 투표 생성·참여·마감, 반 일정 D-Day 관리 |
| 🎰 미니게임 | 일일 룰렛, 가위바위보(포인트 베팅), 숫자 게임 |
| 💎 포인트 시스템 | 출석체크·미션·게임·상점·업적을 포인트와 랭킹으로 연결 |
| 📩 소통 | DM, 팔로우, 알림(댓글·좋아요·DM·팔로우) |
| 🛡️ 운영 | 게시글·댓글 신고, 관리자 신고 처리 화면 |

---

## 3. 기술 스택

| 구분 | 사용 기술 |
|---|---|
| Frontend | HTML, JavaScript (Vanilla JS), Tailwind CSS (CDN) |
| Backend (BaaS) | Firebase Authentication (이메일/비밀번호), Cloud Firestore, Firestore Security Rules |
| App | PWA (Service Worker, Web App Manifest) |
| DevOps | Firebase Hosting, GitHub |
| Design | Figma |

별도 빌드 과정 없이 정적 파일로 동작하며, Firebase SDK 9.23(compat)을 CDN으로 불러옵니다.

### 시스템 구조

```
Client (Vanilla JS + Tailwind, PWA)
        │
        ▼
Firebase Auth ── 로그인 · 회원가입 · 비밀번호 재설정
        │
        ▼
Cloud Firestore ── posts · comments · chatRooms · polls · users · reports ...
   (Security Rules로 컬렉션별 읽기·쓰기 권한 제어)
        │
        ▼
Firebase Hosting (정적 배포, Service Worker로 오프라인 폴백)
```

---

## 4. 구현 포인트

- **실시간 채팅**: `chatRooms/{roomId}/messages`를 `onSnapshot`으로 구독하고, 방 전환 시 리스너를 해제해 불필요한 연결을 막았습니다.
- **포인트 시스템**: 출석·미션·미니게임·상점 구매를 하나의 `points` 값으로 연결하고 멤버 랭킹으로 보여줍니다. 룰렛은 `날짜_uid`를 문서 ID로 써서 하루 1회만 돌릴 수 있게 했습니다.
- **PWA**: manifest와 Service Worker로 홈 화면 설치를 지원합니다. 데이터는 항상 최신이어야 하므로 네트워크 우선, 실패 시에만 캐시를 쓰는 전략입니다.
- **오프라인 대응**: Firestore 오프라인 퍼시스턴스를 켜서 연결이 불안정해도 마지막 데이터를 보여줍니다.
- **관리자 기능**: 신고 접수부터 관리자 처리까지 하나의 흐름으로 구현했습니다.
- **보안 규칙**: `firestore.rules`로 작성·수정·삭제는 본인 또는 관리자만 허용하고, 관리자 권한(`isAdmin`)은 사용자가 스스로 바꿀 수 없게 막았습니다. 쪽지·알림은 당사자만 읽을 수 있습니다.

---

## 5. 문제 해결 경험

| # | 문제 | 해결 |
|---|---|---|
| 1 | Firestore 읽기 수(요금)가 늘어나는 문제 | 목록 조회에 `limit`을 적용하고 조건을 좁히고, 오프라인 캐시를 활용해 읽기 부하 감소 |
| 2 | 모바일에서 긴 글·URL 때문에 화면이 넓어지고 가로 스크롤 발생 | `overflow-x: hidden`, `word-break` 등 전역 CSS 규칙으로 모든 화면에 일괄 적용 |
| 3 | 익명/실명 혼용으로 책임 소재가 불분명 | 닉네임과 Firebase Auth UID를 함께 저장하고, 신고 → 관리자 처리 흐름 도입 |

---

## 6. 팀 구성 및 역할

| 이름 | 역할 | 담당 |
|---|---|---|
| 윤희호 | PM · Fullstack | 기획, UI 설계, 프론트엔드 구현, Firebase 연동·배포 |
| 김○○ | Frontend | HTML · Tailwind · JS |
| 전○○ | Backend | Firestore · Rules |
| 이○○ | Design | Figma · 시안 |

※ 프론트엔드·기획(윤희호, 김○○), 백엔드·디자인(전○○, 이○○) 2인 1조로 서로 보완하며 진행

---

## 7. 개발 프로세스

`Discover`(학생 인터뷰, 기존 도구 조사) → `Define`(핵심 Task·IA, 문제 우선순위) → `Design`(Wireframe, UI System) → `Develop`(Firebase 연동·배포) → `Test`(Usability, QA, 반응속도) → `Deploy`(Firebase Hosting + PWA)

---

## 8. 폴더 구조

```
.
├── index.html              # 진입점 (Tailwind CDN, Firebase SDK 로드)
├── app-firebase.js         # 화면 렌더링 · 이벤트 처리
├── firebase-config.js      # Firebase 초기화 (웹 앱 설정값)
├── firebase-auth.js        # 회원가입 · 로그인 · 비밀번호
├── firebase-posts.js       # 게시글 · 카테고리
├── firebase-comments.js    # 댓글
├── firebase-chat.js        # 실시간 채팅
├── firebase-poll.js        # 투표
├── firebase-dday.js        # D-Day
├── firebase-minigame.js    # 룰렛 · 가위바위보 · 숫자 게임
├── firebase-userdata.js    # 출석 · 미션 · 포인트 · 상점 · 업적
├── firebase-dm.js          # DM
├── firebase-follow.js      # 팔로우
├── firebase-notifications.js
├── firebase-admin.js       # 신고 · 관리자 기능
├── sw.js                   # Service Worker
├── manifest.json           # PWA 설정
├── icons/                  # PWA 아이콘
├── firebase.json           # Hosting · Firestore 배포 설정
├── firestore.rules         # Firestore 보안 규칙
├── firestore.indexes.json  # 복합 인덱스
└── .firebaserc             # Firebase 프로젝트 연결
```

---

## 9. 실행 방법

빌드가 필요 없는 정적 사이트라서 로컬 서버만 띄우면 됩니다.

```bash
# 1. 저장소 클론
git clone https://github.com/OOKR506/c-ban-firebase-community.git
cd c-ban-firebase-community

# 2. 로컬 실행 (http://localhost:3000)
npx serve .
```

> ⚠️ `firebase-config.js`는 포트폴리오용 Firebase 프로젝트(`c-ban-firebase-community`)를 가리킵니다. 로컬에서 실행해도 이 프로젝트의 데이터에 연결되므로, 개인 테스트는 아래처럼 본인 프로젝트로 바꿔 사용하세요.

**내 Firebase 프로젝트로 실행하기**
1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만들고 **Authentication(이메일/비밀번호)**, **Firestore**, **Hosting**을 활성화합니다.
2. 웹 앱을 등록하고 발급된 설정값으로 `firebase-config.js`의 `firebaseConfig`를 교체합니다.
3. `.firebaserc`의 프로젝트 ID를 본인 프로젝트 ID로 바꿉니다.
4. 배포(Hosting + 보안 규칙 + 인덱스): `npx firebase-tools deploy`
5. 가입한 계정의 `users` 문서에서 `isAdmin`을 `true`로 바꾸면(콘솔에서 직접) 관리자 기능을 쓸 수 있습니다.

---

## 10. 배운 점

- 실시간 리스너 환경에서 **비용과 성능을 함께 고려한 쿼리 설계**의 중요성을 경험했습니다.
- 서버 없이 Firebase만으로 인증·데이터·실시간 동기화·배포까지 한 흐름으로 운영하는 방법을 익혔습니다.
- 익명성과 책임 사이의 균형 같은 **커뮤니티 운영 문제를 기능 설계로 풀어보는** 경험을 했습니다.

---

## 11. Contact

- GitHub: [@OOKR506](https://github.com/OOKR506)
- Email: yhh0303015@gmail.com
