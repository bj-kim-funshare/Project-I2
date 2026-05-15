# Roadmap 3: data-craft Flutter 웹뷰 통합 · BE/DB 신규 · 네이티브 브리지

> 작성일: 2026-05-15 | 대상: Roadmap-1 의 모바일 React 산출물을 Flutter Android APK 셸에 탑재하고, /v2/social/* BE 신규 네임스페이스·푸시·오프라인 동기화·네이티브 능력 (JS Bridge 경유) 전부 구현

## 프롬프트

🔴 /task-db-structure data-craft 단계0 — social/dm/notifications 등 신규 10 테이블 (social_posts, social_comments, social_reactions, social_follows, social_activities, dm_conversations, dm_conversation_members, dm_messages, notifications, record_access_grants) + 마스터 추가 (push_tokens, device_sessions, offline_sync_queue). 인덱스·제약·UNIQUE 키 (예: social_follows uk(follower_id, target_type, target_id)) 포함. 기술 스펙 v0.2 §5 정의 그대로.

🔴 /db-security-inspection data-craft today

🔴 /plan-enterprise data-craft 단계1 BE 기반 — 모바일 origin CORS/CSRF/쿠키 도메인 정비 + device_sessions 미들웨어 + fs_api JWT 인터셉터 모바일 호환 + /v2 네임스페이스 스캐폴딩. **Roadmap-1 0-B BLOCK 해소 단계** (Roadmap-1 0-B BLOCK 발생 시 Roadmap-1 진행을 일시 중단하고 본 단계 먼저 수행 후 Roadmap-1 0-B 재시도).

🔴 /plan-enterprise data-craft 단계2 BE /v2/social/* 그룹 A — feed (활동+포스트 통합) + posts + comments + reactions. 라우터 `socialFeedRouter`, `socialPostsRouter`, `socialCommentsRouter`, `socialReactionsRouter` 분리. 멘션 파서·소프트 삭제 (posts/comments 5분 이내 수정) 포함.

🔴 /plan-enterprise data-craft 단계3 BE /v2/social/* 그룹 B — follows + users/profile + pages/followers. **D4 자동 팔로우** (페이지 생성·이전 시 작성자 자동 follow, auto=1 강제 언팔 불가) 포함. notify_level 토글 (all/mention_assign/none).

🔴 /plan-enterprise data-craft 단계4 BE /v2/social/* 그룹 C — DM (conversations / conversation_members / messages) + record-access grants (**D5**: 발신자 승인 기반 TTL 7 일 임시 뷰 권한, 감사 로그 보존). 레코드 카드 첨부 메시지 타입.

🔴 /plan-enterprise data-craft 단계5 BE 그룹 D — notifications 인박스 (kind: mention/assign/reply/page_update/dm) + push_tokens 등록·갱신·만료 + 푸시 발송 큐 (§9). FCM 발송 워커. 토큰 ↔ device_sessions 연결.

🔴 /plan-enterprise data-craft 단계6 BE 오프라인 동기화 큐 (§8) — 클라이언트 outbox 수신·재시도·충돌 해소 엔드포인트 (offline_sync_queue 테이블 운용). idempotency-key 헤더 처리, 충돌 응답 스키마.

🔴 /dev-inspection data-craft today

🔴 /dev-security-inspection data-craft today

🔴 /db-security-inspection data-craft today

🔴 /plan-enterprise data-craft 단계7 JS Bridge 계약 — fs-shared-mobile/bridge 모듈 (채널 정의 / 메시지 프로토콜 / TypeScript 타입 / 에러 핸들링 / 타임아웃 / 양방향 ack). 8 채널 (push / camera / files / biometric / share / vibration / network / deep-link) 의 request·response·event 스키마 단일 진실원. Flutter (Dart) · React (TS) 양측에서 import.

🔴 /plan-enterprise data-craft 단계8 Flutter shell 통합 — apps/flutter-shell WebView 컨테이너 (flutter_inappwebview), apps/web 빌드 산출물 탑재 경로, 안드로이드 뒤로가기 오버라이드 (history vs WebView pop 분기), 딥링크 라우팅 (intent-filter + WebView URL 동기화), 세션 쿠키 공유 (CookieManager 와 fs_api 인터셉터 정합).

🔴 /plan-enterprise data-craft 단계9 네이티브 능력 구현 — 푸시 / 카메라 / 파일 / 생체인증 / 공유시트 / 진동 / 네트워크 상태 / 딥링크 8 능력을 단일 plan 내 phase 직렬 (apps/flutter-shell 및 fs-shared-mobile/bridge 공유 자원 충돌 회피). 각 능력 Phase = Flutter handler 구현 + React hook 구현 + e2e 메시지 검증.

🔴 /dev-inspection data-craft today

🔴 /dev-security-inspection data-craft today

🔴 /plan-enterprise data-craft 단계10 React 측 통합 — Roadmap-1 단계4 의 메시징·알림·피드/홈/프로필 UI 를 신규 /v2/social/* 엔드포인트로 실연결 + 브리지 hook 연동. 푸시 권한 안내 화면, 모바일 알림 채널 표시, 오프라인 큐 상태/재시도 UI, DM 레코드 카드 권한 요청·승인 화면 (D5), 페이지 자동 팔로우 안내 (D4).

🔴 /dev-inspection data-craft today

🔴 /project-verification data-craft today

🔴 /pre-deploy data-craft

🔴 /patch-confirmation data-craft

---

## 로드맵 설명

### 목적

Roadmap-1 이 BE/DB 무수정 제약으로 만든 모바일 React 산출물을 (1) Flutter Android APK 셸에 웹뷰로 탑재하고, (2) Flutter ↔ React JS Bridge 로 네이티브 능력을 React 측에 노출하며, (3) 기술 스펙 v0.2 가 정의한 `/v2/social/*` 신규 BE 네임스페이스와 동반 DDL 을 전부 구현해 모바일 전용 기능 (DM·피드·댓글·반응·팔로우·푸시·오프라인 동기화) 을 가동한다. **앱스토어 작업 0** — APK 빌드만.

### 구성 개요

총 10 개 `/plan-enterprise` + DDL 1 개 + 게이트 7 개 + 마감 2 개. 병렬 그룹 미사용 (전부 순차).

- **단계 0** — DDL 일괄. 13 테이블 (기술 스펙 10 + 마스터 추가 3) 단일 마이그레이션.
- **단계 1** — BE 기반 (CORS/CSRF/쿠키, device_sessions, /v2 스캐폴딩). Roadmap-1 0-B BLOCK 해소 진입점.
- **단계 2~6** — `/v2/social/*` 도메인 그룹 4 + 푸시·오프라인 BE 5 단계. 모두 직렬 (공유 라우터·미들웨어·인터셉터 충돌 회피).
- **단계 7** — JS Bridge 계약 (Flutter · React 양측 import 단일 진실원).
- **단계 8** — Flutter shell WebView 통합.
- **단계 9** — 8 종 네이티브 능력 (단일 plan 내 phase 직렬, 공유 자원 충돌 회피).
- **단계 10** — React UI 실연결 (Roadmap-1 단계4 의 mock 가 본 단계에서 실제 BE 와 연결).

### 품질 게이트 배치

- DDL 직후: `/db-security-inspection` 의무.
- BE 묶음 (단계 1~6) 종료 후: `/dev-inspection` → `/dev-security-inspection` → `/db-security-inspection` 3 종.
- 브리지·네이티브 묶음 (단계 7~9) 종료 후: `/dev-inspection` → `/dev-security-inspection`.
- 최종 (단계 10) 종료 후: `/dev-inspection` → `/project-verification`.

품질 게이트 BLOCK 이슈는 후속 `/plan-enterprise` 가 흡수 — 본 로드맵은 미리 박지 않음.

### 위험·결정 사항

- **Roadmap-1 0-B BLOCK 타이밍 (advisor flag)** — Roadmap-1 0-B 가 CORS/CSRF 로 BLOCK 났다면 Roadmap-1 을 끝까지 진행할 수 없다. 이 경우 Roadmap-1 진행 중단 → 본 로드맵 **단계 0~1 우선 수행** → Roadmap-1 0-B 재시도 → Roadmap-1 잔여 단계 진행 → Roadmap-2 단계 2 부터 재개. Roadmap-1 이 BLOCK 없이 완주했다면 본 로드맵은 정상 순차.
- **Roadmap-1 단계4 정정 (마스터 확정)** — Roadmap-1 단계4 "기존 API 재사용" 은 사실상 mock/stub 진행. 본 로드맵 단계 10 에서 신규 `/v2/social/*` 엔드포인트로 실연결. Roadmap-1 문서 자체는 수정하지 않음 — Roadmap-2 단계 10 이 그 갭을 메우는 후속이라는 사실로 일관성 유지.
- **BE 직렬 (마스터 확정)** — `/v2/social/*` 도메인 그룹들이 라우터 마운트·미들웨어·JWT 인터셉터를 공유하며 `data-craft-server` 단일 i-dev 머지 시점 충돌 위험 → 5 개 BE 단계 모두 직렬. 병렬 그룹 미사용.
- **네이티브 능력 단일 plan 의 phase 직렬** — 8 능력 (push/camera/files/biometric/share/vibration/network/deep-link) 이 모두 `apps/flutter-shell` 의 Dart 코드와 `fs-shared-mobile/bridge` 의 TS 코드를 동시에 건드린다. 단일 plan-enterprise 의 phase 직렬로 강제.
- **앱스토어 금지** — Apple App Store / Google Play 등록 절차 본 로드맵에서 일절 다루지 않음. `pre-deploy data-craft` 의 Flutter APK 빌드 타겟은 사이드로딩용 APK 산출까지만.
- **FCM 토큰 발급 의존** — 단계 5 의 푸시 발송 큐는 FCM 프로젝트·서비스 계정이 사전에 준비돼 있어야 한다. 누락 시 본 단계 BLOCK 후 마스터 인프라 결정 필요.

### 종료 조건

- 모든 `/plan-enterprise` 가 issue close 상태.
- 마지막 `/pre-deploy data-craft` 합격 보고서 발행 (Flutter APK 빌드 산출물 포함).
- `/patch-confirmation data-craft` origin push 완료.
- 본 파일의 모든 프롬프트 상태가 🟢 (마스터가 plan-roadmap edit 모드로 수동 갱신).
- Roadmap-1 ↔ Roadmap-2 갭 (Roadmap-1 단계4 mock 부분) 이 단계 10 으로 실연결 완료.
