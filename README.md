# C반 놈들 🎓

> Firebase 기반 학급 커뮤니티 PWA 웹서비스
> "C반 놈들, 반 친구들과 함께하는 온라인 카페. 소통과 참여가 한곳에."

- **Live Demo**: https://C-ban-nomdeul.mobile.app
- **개발 형태**: 4인 팀 프로젝트 (신구대학교 소프트웨어 공학 전시회 출품작)
- **개발 기간**: YYYY.MM ~ YYYY.MM *(수정해 주세요)*

<!-- 스크린샷: 아래 경로에 이미지를 넣어 주세요 -->
<!-- ![홈 피드](./docs/home.png) -->

---

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
| 🏠 홈 피드 | 환영 배너, 퀵액션, 미션, 랭킹을 한 화면에 구성 |
| 📋 카테고리 게시판 | 9개 관심사별 분류, 공지 고정, 검색 |
| 💬 실시간 채팅 | 주제별 채팅방, Firestore `onSnapshot`으로 즉시 반영 |
| 🎰 참여형 미니게임 | 룰렛·출석체크·투표로 포인트 획득 |
| 👤 MY · 포인트 | 활동 내역, 보유 포인트, 랭킹 시각화 |

---

## 3. 기술 스택

| 구분 | 사용 기술 |
|---|---|
| Frontend | HTML, JavaScript (Vanilla JS), Tailwind CSS |
| Backend | Firebase Auth, Cloud Functions, Firestore Security Rules |
| Data | Firestore, Firebase Storage |
| App | PWA (Service Worker, Web App Manifest) |
| DevOps | Firebase Hosting, GitHub |
| Design | Figma |

### 시스템 구조

```
Client (Vanilla JS + Tailwind, PWA)
        │
        ▼
Firebase (Auth / Security Rules / Cloud Functions)
        │
        ▼
Firestore (Realtime Snapshot) · Storage

Realtime Sync Layer: onSnapshot · Optimistic UI · Offline Cache
```

---

## 4. 구현 포인트

- **실시간 동기화**: Firestore `onSnapshot`으로 게시글·채팅·댓글 즉시 반영
- **포인트 시스템**: 출석·게시글·투표·게임 참여를 하나의 포인트로 연결하고 랭킹으로 시각화
- **PWA**: Service Worker + manifest로 홈 화면 추가 후 네이티브처럼 동작
- **상태 관리**: Loading / Empty / Error / Retry 상태를 전 화면에 공통 적용

---

## 5. 문제 해결 경험

| # | 문제 | 해결 |
|---|---|---|
| 1 | Firestore 실시간 리스너로 쿼리 수(요금)가 급증 | 쿼리당 `limit`, 조건 필터 적용, 캐시 활용으로 부하 감소 |
| 2 | 모바일에서 긴 글/링크가 가로 스크롤 유발 | `overflow-x: hidden` + `word-break` 전역 CSS 규칙으로 통일 |
| 3 | 익명/실명 혼용으로 책임 소재가 불분명 | 닉네임 + Firebase Auth UID 조합, 관리자 신고 처리 흐름 도입 |

---

## 6. 팀 구성 및 역할

| 이름 | 역할 | 담당 |
|---|---|---|
| 윤희호 | PM · Fullstack | 기획, UI 설계, Firebase 연동·배포 *(직접 구현한 기능을 구체적으로 수정해 주세요. 예: 실시간 채팅, 포인트 시스템, Security Rules)* |
| 김○○ , 윤희호 | Frontend | HTML · Tailwind · JS |
| 전○○ | Backend | Firestore · Rules |
| 이○○ | Design | Figma · 시안 |

---

## 7. 개발 프로세스

`Discover`(학생 인터뷰, 기존 도구 조사) → `Define`(핵심 Task·IA, 문제 우선순위) → `Design`(Wireframe, UI System) → `Develop`(Firebase 연동·배포) → `Test`(Usability, QA, 반응속도) → `Deploy`(Firebase Hosting + PWA)

---

## 8. 실행 방법

```bash
# 1. 저장소 클론
git clone https://github.com/OOKR506/c-ban-firebase-community.git
cd c-ban-firebase-community

# 2. Firebase 설정
#    - Firebase 콘솔에서 프로젝트를 만들고 Auth, Firestore, Hosting을 활성화
#    - 웹 앱 설정값을 firebase-config.js(또는 해당 설정 파일)에 입력
#    ※ 서비스 계정 키(JSON), .env 파일은 절대 커밋하지 않습니다.

# 3. 로컬 실행
npx firebase-tools emulators:start   # 또는 정적 서버로 실행: npx serve .

# 4. 배포
npx firebase-tools deploy
```

> 실제 파일 구조와 설정 파일명에 맞게 수정해 주세요.

---

## 9. 배운 점

- 실시간 리스너 환경에서 **비용과 성능을 함께 고려한 쿼리 설계**의 중요성을 경험했습니다.
- 서버 없이 Firebase만으로 인증·권한·실시간 동기화·배포까지 한 흐름으로 운영하는 방법을 익혔습니다.
- 익명성과 책임 사이의 균형 같은 **커뮤니티 운영 문제를 기능 설계로 풀어보는** 경험을 했습니다.

---

## 10. Contact

- GitHub: [@OOKR506](https://github.com/OOKR506)
- Email: *(개인 이메일로 수정해 주세요)*
