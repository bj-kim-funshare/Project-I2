# Roadmap 4: Pinlog 디자인 핸드오프 → 구현 (Phase 1~4 풀 진행, BE 확장 동반)

> 작성일: 2026-05-15 | 대상: PinLog-Web FE + Pingus-Server BE 의 디자인팀 핸드오프 자료 18 종 화면을 Phase 1 MVP 폴리시부터 Phase 4 친구/DM/알림 realtime 까지 단일 로드맵으로 이행

## 프롬프트

🟢 /plan-enterprise Pinlog 단계0 디자인 시스템 정착 — `shared/styles/index.css` 에 디자인 토큰 (color/mood/spacing/radius/shadow) CSS 변수 이식, Pretendard + Gowun Batang + Caveat 폰트 임포트, Tailwind v4 `@theme inline` 매핑 (`docs/HANDOFF.md` §7), 구스 마스코트 9 표정 SVG 자산 `shared/assets/goose/` 정리, 공통 UI 프리미티브 `shared.ui` 보강 (Toast / Dialog / StickerRow / EmptyState / PinMini / ScopeToggle 시드). FE only, BE 변경 0.

🔴 /dev-inspection Pinlog today

🟢 /plan-enterprise Pinlog 단계1-A 진입 플로우 — Splash 라우트 (`/`, 2.5s 타임아웃 + 인증/온보딩 분기), Onboarding 3 step (구스 인사 → 닉네임 핸들 검증 debounce 400ms → 위치 권한), LayoutPickerPage 폴리시 (4 카드 미니 프리뷰), FirstPinPrompt EmptyState. AuthPage 진입 전 게이팅 추가. `widgets/onboarding/` 신설.

🟢 /plan-enterprise Pinlog 단계1-C 홈 4 레이아웃 폴리시 — MainPage 의 feedModeStore 토글 확장, home-grid · home-collage · home-list (B 타임라인 신설) · map-post-feed (D 지도우선) 4 위젯 디자인 시안 적용, main-layout 의 AppHeader (로고 + 알림 배지) + BottomNav + 중앙 FAB, Pull-to-refresh 구스 sleepy→happy 전환. `homeLayout` 사용자 설정 적용.

1️⃣ 🔴 /plan-enterprise Pinlog 단계1-B 핀 작성 4단계 — WritePage 분해 (Photo Pick → Details → Success 애니), PostPhotoStep (카메라/앨범/권한 폴백), PostDetailsStep (장소 자동 제안 500m POI · 메모 textarea · 태그 칩 시드 · ScopeToggle 시드 · 캡슐 토글 시드 — 본 단계는 UI 만, 실제 scope/tags/capsule 동작은 Phase 2/3 에서 활성), location-picker 정비, PostSuccess 풀스크린 애니 (300ms drop) → tab:home 1.5s.

1️⃣ 🔴 /plan-enterprise Pinlog 단계1-D 핀 상세 + 메모리 맵 — `widgets/post-detail` 시안 적용 (사진 4:5, 작성자 구스 아바타, 메모 Gaegu 17px, 태그 칩, Scope 배지, StickerRow 구스 5표정, 댓글 입력 하단 고정), `routes/post/:uuid` 신설, MemoryMapScreen 정비 (필터 칩 기간/태그/scope, 핀 탭 바텀시트 프리뷰, 빈 상태 EmptyState). post-detail 의 본인/타인 ⋯ 메뉴 (편집/삭제/신고/뮤트). 본 단계의 scope 배지 / 태그 칩 표시는 Phase 2 BE 확장 전까지 mock 데이터 fallback.

1️⃣ 🔴 /plan-enterprise Pinlog 단계1-E 프로필 + 활동 + 설정 폴리시 — MyPage (프로필 카드 큰 구스 + 핸들 + 통계 핀/친구/캡슐 카운트, 탭 핀 그리드/추억지도/캡슐 보관함 — 캡슐 탭은 Phase 3 까지 비활성), ActivityPage / NotificationPage 6 kind 분기 UI, SettingsPage 6 섹션, ProfileEditPage / AccountManagePage 정비. 친구 카운트는 Phase 4 까지 0 고정.

🔴 /dev-inspection Pinlog today

🔴 /dev-security-inspection Pinlog today

🔴 /project-verification Pinlog today

🔴 /task-db-structure Pinlog Phase 2 — Pingus-Server PostgreSQL `post` 테이블에 `scope` (enum: PRIVATE/FRIENDS/PUBLIC, default FRIENDS), `place` (varchar 120), `tags` (jsonb) 컬럼 추가 + 부분 인덱스 (scope, GIN tags), `post_search_idx` (place / tags 복합). 기존 row 백필 (scope=FRIENDS, place=NULL, tags='[]'). 마이그레이션 + 롤백 페어.

🔴 /plan-enterprise Pinlog 단계2-A BE 확장 (scope/tags/place + 검색) — `PostController/Service/Mapper` 에 scope/place/tags 입출력 적용, `/api/post/list` 에 filter 파라미터 (scope, tags[], place) 추가, `/api/post/search` 신규 엔드포인트 (q + scope + 페이징), JWT 컨텍스트의 friendship 정책은 Phase 4 까지 mock — Phase 2 단계에서는 본인+PUBLIC 만 노출하는 단순화 정책으로 우선 진입 (Phase 4 후속 BE plan 에서 friends 정책 확장).

🔴 /db-security-inspection Pinlog version

🔴 /plan-enterprise Pinlog 단계2-B FE 적용 + Explore/Search — `entities/post/model/types.ts` 확장 (scope/place/tags), ScopeToggle 활성화, Compose 의 태그 칩 + 장소 입력 활성화, post-detail 의 Scope 배지 / 태그 표시 활성화, ExplorePage 신설 (`/discover`, 근처/태그/이번주 탭, 공개 핀만), SearchPage 신설 (`/search`, 장소/핸들/태그 섹션, 최근 검색 zustand persist).

🔴 /dev-inspection Pinlog today

🔴 /task-db-structure Pinlog Phase 3 — `post` 테이블에 `is_capsule` (boolean default false), `opens_at` (timestamp), `sealed` (boolean default false) 추가. `capsule_reply` 신규 테이블 (id, original_post_uuid, author_uuid, recipient_uuid nullable, recipient_label varchar, note text, opens_at, sealed, createdAt). `like` 테이블에 `mood` (varchar 16 enum: happy/calm/awe/love/blue) 추가, 기존 unique (target_uuid, target_type, account_uuid) 유지하면서 mood 만 update 가능하도록.

🔴 /plan-enterprise Pinlog 단계3-A BE 확장 (capsule + mood) — Capsule lifecycle: `sealed=true && opens_at>now()` 인 경우 본인 포함 read 차단, `opens_at<=now()` 도달 시 자동 read 허용 + `sealed=false` 트리거. `/api/post/create` 에 isCapsule/opensAt/sealed 입력. `/api/capsule/reply` 신규. `/api/like/toggle` 시그니처 확장 (mood 파라미터 — POST 만 mood 적용, COMMENT 는 binary 유지). 캡슐 미열림 상태 list 노출 정책 정의.

🔴 /db-security-inspection Pinlog version

🔴 /plan-enterprise Pinlog 단계3-B FE (캡슐 화면 + 구스 mood) — Compose 의 캡슐 토글 활성화 (날짜 다이얼 7일~5년), CapsuleOpenScreen scripted animation (봉투 → 구스 surprised → 플립 오픈 → 편지 페이드인), CapsuleReplyScreen (받는 대상 [미래의 나]/[친구], 날짜 다이얼, textarea), CapsuleSealedScreen (구스 proud + n일 카운트), MyPage 의 캡슐 보관함 탭 활성화, post-detail 의 StickerRow 5 mood 활성화 (낙관적 업데이트 + haptic).

🔴 /dev-inspection Pinlog today

🔴 /task-db-structure Pinlog Phase 4 — `friendship` (a_uuid, b_uuid, close boolean, since timestamp, status enum REQUESTED/ACCEPTED/BLOCKED), `thread` (uuid, name nullable, last_message_at), `thread_member` (thread_uuid, account_uuid, joined_at, muted boolean), `message` (uuid, thread_uuid, author_uuid, kind enum TEXT/PIN_SHARE/CAPSULE_INVITE, text nullable, post_uuid nullable, capsule_post_uuid nullable, createdAt), `notification` (uuid, account_uuid, kind enum CAPSULE/FRIEND/MEMORY/DM/COMMENT/LIKE, title, body, mood, thread_uuid nullable, post_uuid nullable, capsule_uuid nullable, read boolean, createdAt). 인덱스: thread_member (account_uuid), message (thread_uuid, createdAt desc), notification (account_uuid, read, createdAt desc).

🔴 /plan-enterprise Pinlog 단계4-A BE (친구/DM/알림 + realtime) — Friendship API (request/accept/promote-close/block), Thread API (list/create/leave/mute), Message API (list 페이징, send 3 kind), Notification API (list/read/read-all), STOMP over WSS realtime (`/ws/inbox`, JWT handshake) — 새 메시지 / 알림 / 캡슐 오픈 push. `/api/post/list` friends scope 정책 활성화 (Phase 2 의 단순화 정책 대체 — friendship.status=ACCEPTED 가 노출 조건). 캡슐 오픈 도달 시 server-side scheduled job 으로 notification 생성.

🔴 /db-security-inspection Pinlog version

🔴 /plan-enterprise Pinlog 단계4-B FE (친구/메시지/알림 realtime) — FriendsPage (`/friends`, 친한친구 sticky + 모든 친구), FriendAddPage (`/friends/add`, 핸들 검색), MessagesListPage (`/dm`, 친한친구 sticky), ThreadPage (`/dm/:threadId`, 3 kind 메시지 + PinMini 카드 + 봉투 카드, 인풋바 [📷][🪿][전송]), NotificationPage realtime 갱신 (WebSocket 연결 useNotificationSocket hook), 알림 배지 실시간 업데이트, MyPage 의 친구 카운트 활성화. DM 핀 공유 카드 위젯 신설.

🔴 /dev-inspection Pinlog today

🔴 /dev-security-inspection Pinlog today

🔴 /project-verification Pinlog today

🔴 /plan-enterprise Pinlog 단계5 마감 — i18n ko/en/ja 전수 키 보강 (HANDOFF §3 다국어), 접근성 (44px 터치 영역 audit, ARIA 레이블, 키보드 내비게이션), 다크모드 토큰 검증, 오프라인 배너 + 사진 업로드 재시도, safe-area (iOS 노치 / Android 제스처바), 웹뷰 호환 audit (`window.alert/confirm/prompt` 잔존 grep + 제거). EXIF 서버 측 제거 동작 검증.

🔴 /pre-deploy Pinlog

🔴 /patch-confirmation Pinlog

---

## 로드맵 설명

### 목적

Pinlog 디자인팀이 인계한 18 종 화면 시안 + 5 종 docs (`HANDOFF` / `SPEC` / `SCREENS` / `DESIGN` / `TECH`) 를 코드에 도달시키되, **Phase 1 MVP 폴리시 → Phase 4 친구/DM/알림 realtime** 까지 단일 로드맵으로 이행한다. PinLog-Web (FE) 와 Pingus-Server (BE) 양쪽 리포에 BE 스키마/엔드포인트 확장이 동반되며, 현행 BE 로 즉시 가능한 Phase 1 부분은 FE-only 로 빠르게 마감하고, Phase 2~4 는 매 단계 `/task-db-structure` → BE plan-enterprise → `/db-security-inspection` → FE plan-enterprise 직렬로 진행.

### 구성 개요 (총 7 묶음, 23 프롬프트)

- **단계 0** — 디자인 토큰 + 폰트 + 구스 마스코트 + 공통 UI 프리미티브 정착. 이후 모든 화면 작업의 전제.
- **단계 1** (1-A 단독, 1-C 단독, 1-B/1-D/1-E 병렬 그룹 1) — Phase 1 MVP 5 영역 폴리시. 1-A (진입 플로우) 와 1-C (홈 4 레이아웃 — main-layout AppShell 변경 동반) 는 단독 직렬, 나머지 3 개 (Compose / Detail+Map / Profile+Activity+Settings) 는 페이지 트리가 갈라져 병렬 안전.
- **단계 2** — BE post 확장 (scope/tags/place) + 검색 엔드포인트. DDL → BE → DB security → FE 직렬.
- **단계 3** — 캡슐 lifecycle + 구스 mood 리액션. DDL → BE → DB security → FE 직렬.
- **단계 4** — 친구/DM/알림 + WSS realtime. DDL → BE → DB security → FE 직렬. 캡슐 오픈 알림 server-side job 도 본 단계에서 결합.
- **단계 5** — i18n / 접근성 / 다크모드 / 웹뷰 호환 audit 마감.
- **단계 6** — `/pre-deploy Pinlog` 합격 후 `/patch-confirmation Pinlog` 푸시 마감.

### 품질 게이트 배치

- 각 큰 묶음 사이 1 회 `/dev-inspection Pinlog today`.
- 보안 민감 묶음 (단계 1 종료 — 인증 폴리시, 단계 4 종료 — friend/DM/notification realtime) 직후 `/dev-security-inspection Pinlog today`.
- 단계 1 종료 후 + 단계 4 종료 후 `/project-verification Pinlog today`.
- BE 확장 phase (단계 2/3/4) 의 BE plan-enterprise 직후 `/db-security-inspection Pinlog version` (DDL + ORM + 라우트 코드 종합 검사).

품질 게이트 BLOCK 이슈는 후속 `/plan-enterprise Pinlog` 가 자연스럽게 흡수.

### 위험·결정 사항

- **Phase 2 의 friends scope 정책 임시 단순화** — 단계 2 BE 진입 시점에는 friendship 테이블이 아직 없다. 따라서 단계 2-A 에서는 `scope=FRIENDS` 를 본인+PUBLIC 만 노출하는 단순화 정책으로 우선 처리하고, 단계 4-A 에서 friendship.status=ACCEPTED 기반 정책으로 대체한다. 이 임시 정책은 단계 2~3 동안의 친구 미정의 구간을 막기 위한 의도적 trade-off.
- **단계 1 의 시안 mock fallback** — 단계 1-D 의 핀 상세 / 메모리 맵에서 scope 배지·태그 칩은 BE 확장 (단계 2) 전까지 mock 으로 표시. 단계 2-B FE 적용에서 실제 데이터로 자동 전환. 시안과 코드가 단계 2 종료까지 임시 어긋난다는 점은 마스터에게 사전 양해.
- **단계 1-B/1-D/1-E 병렬 안전성** — Compose / Detail+Map / Profile-Activity-Settings 는 페이지 디렉터리가 분리돼 i-dev 머지 충돌 위험은 낮으나, `widgets/index.ts` 와 `shared.ui` 의 export 추가가 같은 시점에 일어나면 충돌 가능. 각 plan 내부에서 export 추가 시 conflict-aware 머지 (양측 보존) 가 표준 동작이므로 허용 범위.
- **Phase 4 realtime (WSS + JWT handshake)** — Pingus-Server 가 STOMP/WebSocket 을 신규 도입하므로 Spring Security WSS 핸드셰이크 정책 + Redis pubsub (multi-instance 대비) 설계가 단계 4-A 의 첫 phase 에 포함된다. Redis 가 이미 운영 중 (그룹 stack 자동 감지) 이므로 인프라 추가 없음.
- **캡슐 lifecycle BE 트리거** — `opens_at <= now()` 도달 시 자동 read 허용은 read 시점 lazy 평가 (DB query 단에서 조건부) 로 처리. server-side scheduled job 은 알림 생성 트리거에만 사용 (단계 4-A 결합) — 별도 batch 인프라 도입 회피.
- **EXIF 제거 / 위치 권한** — 디자인 SPEC 비기능 요구 (EXIF 서버 측 제거, 위치 "앱 사용 중에만" 기본값) 는 단계 5 마감 audit 에서 검증한다.

### 작업 범위 (Roadmap-4 안 / 밖)

| 항목 | Roadmap-4 |
|---|---|
| 디자인 토큰 + 구스 마스코트 + shared.ui 프리미티브 | O |
| Phase 1 18 종 화면 폴리시 (Splash/Onboarding/Layout/Compose 4단계/Home 4 레이아웃/Detail/Memory Map/Profile/Activity/Notification/Settings) | O |
| Phase 2 scope/tags/place/Search/Explore (BE+FE) | O |
| Phase 3 타임캡슐 + 구스 mood 리액션 (BE+FE) | O |
| Phase 4 Friendship/DM/Notification realtime (BE+FE+WSS) | O |
| 네이티브 앱 웹뷰 쉘 / iOS/Android 빌드 | — (별도) |
| 푸시 결제 / 프리미엄 / 데스크탑 앱 | — (Post-MVP, SPEC §4) |
| 다수 사진 / 동영상 / 해시태그 탐색 / 지도 경로 | — (Post-MVP, SPEC §4) |

### 종료 조건

- 모든 단계의 `/plan-enterprise Pinlog` issue close.
- `/pre-deploy Pinlog` 합격 보고서 발행.
- `/patch-confirmation Pinlog` origin push 완료.
- 본 파일의 모든 프롬프트 상태가 🟢 (마스터가 plan-roadmap edit 모드로 수동 갱신).
