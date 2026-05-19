# Roadmap 1: data-craft 모바일 React 기능 패리티 (BE/DB 무수정)

> 작성일: 2026-05-15 | 대상: data-craft-mobile 모노레포에서 기존 웹 BE/DB 그대로 두고 모바일 규격 React 프론트엔드 기능 패리티 달성 (Flutter / 네이티브 작업 0)

## 프롬프트

🟢 /plan-enterprise data-craft 단계0-A 모노레포 골격·디자인 토큰·라우팅 보강 (fs-shared-mobile, apps/web/src/mobile/styles, route-paths.ts, AppShell). data-craft-mobile/DataCraft/handoff/phase0 참고. BE/DB 변경 0. — 완료 (이슈 #58, v001.98.0)

🟢 /plan-enterprise data-craft 단계0-B 인증 화면 (login / forgot-password / workspace-select). 첫 phase 에서 data-craft-server /auth/* CORS·CSRF·쿠키 도메인을 모바일 origin 에서 그대로 사용 가능한지 검증 후 진입. 불가 시 본 phase 만 BLOCK 하고 Roadmap-2 로 이관 보고. apps/web/src/mobile/auth/ 와 routes/login.tsx, routes/forgot-password.tsx, routes/workspace-select.tsx 구현. — 완료 (이슈 #64, v001.108.0 + 핫픽스1 v001.110.0)

🟢 /dev-inspection data-craft today — 완료 (2026-05-15)

🟢 /dev-security-inspection data-craft today — 완료 (2026-05-15)

🟢 /plan-enterprise data-craft 단계1-A fs-api-mobile 어댑터 정비 — 기존 data-craft-server REST 엔드포인트 그대로 호출, 모바일 보조 헬퍼 (재시도·타임아웃·세션 헤더) 만 추가. 신규 BE 엔드포인트 추가 금지. — 완료 (이슈 #72, v001.121.0 + 핫픽스1 v001.123.0)

1️⃣ 🟢 /plan-enterprise data-craft 단계1-B 페이지 트리 / 페이지 뷰어 (apps/web/src/mobile/screens/page-tree, screens/page-viewer, routes/page-tree.tsx, routes/page-viewer/). 기존 page 관련 GET API 재사용. — 완료 (이슈 #95, v001.167.0)

1️⃣ 🟢 /plan-enterprise data-craft 단계1-C 레코드 상세 / 검색 (apps/web/src/mobile/screens/record-detail, screens/search, routes/record/, routes/search.tsx). 기존 record / search API 재사용. — 완료 (이슈 #97, v001.171.0, 작업 0; records-tab 실 데이터 연결은 Roadmap-3 또는 후속 Roadmap 으로 이관)

🔴 /dev-inspection data-craft today

🟢 /plan-enterprise data-craft 단계2 데이터 뷰어 5종 모바일 화면 — fs-data-viewer-mobile 단일 패키지 내부의 grid / kanban / calendar / gantt / dashboard 를 5 phase 로 순차 구현 (공유 features/column-settings, features/state-manager, widgets 충돌 회피). apps/web/src/mobile/screens/{grid,kanban,calendar,gantt,dashboard}-viewer 와 연결. BE 재사용. — 완료 (이슈 #101, v001.182.0; Grid·Kanban·Calendar·Gantt 4종은 enterprise-454/457/459 선행 완료, Dashboard 차트 wiring 만 본 plan 단일 phase 로 마감; Scatter/UserList row-data 후속은 별도 처리 가능)

🔴 /dev-inspection data-craft today

🔴 /project-verification data-craft today

2️⃣ 🟢 /plan-enterprise data-craft 단계3-A 유저폼 / 컴포저 (fs-form-builder-mobile, apps/web/src/mobile/routes/user-form, routes/compose.tsx). 기존 form / record write API 재사용. — 완료 (이슈 #103, v001.189.0; ScreenUserForm 신규 구현 + fs-form-builder-mobile export 활성, 저장은 inputStoreApi.save 사용; compose 는 Roadmap-005 SNS 후속 이관; widget→user-form 네비 시 widgetId/pageId location.state 누락 후속 필수)

2️⃣ 🟢 /plan-enterprise data-craft 단계3-B 데이터 링크 (fs-data-link-mobile). 기존 data-link API 재사용. — 완료 (이슈 #106, v001.196.0; AppHeader 우측 Bot 아이콘 trigger + DataLinkDialog 마운트; 후속 권장: 권한 게이트 / flat-path 죽은 테스트 / 모바일 dialog 시각 보강)

2️⃣ 🟢 /plan-enterprise data-craft 단계3-C 관계 빌더 (fs-relation-builder-mobile). 기존 relation API 재사용. — 완료 (이슈 #108, v001.201.0 + 핫픽스1 v001.202.0 DesignerDialog 모바일 fit + 핫픽스2 v001.206.0 DataLinkDialog 전역 CSS fit; 모바일 첫 React Query 도입 milestone; 잔존: QueryProvider 검증 / 권한 게이트 BE 데이터 부재 / 아이콘 그룹화 3-D 진입 시 재검토)

2️⃣ 🟢 /plan-enterprise data-craft 단계3-D 파일 첨부 (fs-file-attachment-mobile). 기존 attachment 업로드/다운로드 API 재사용 (S3 presigned 등 BE 변경 없이). — 완료 (이슈 #112, v001.222.0; FormFieldRenderer 'file-attachment' dispatch + FileAttachmentFieldRenderer 신규 + FormFieldWidgetType 12→13 + FormField 첨부 옵션 5개 추가; BE/DB 변경 없음; 후속: per-record identifier 스코핑 (ScreenUserForm → FormFieldRenderer 에 recordId 전파), 데이터뷰어 셀 fileCellWidget wiring 미연결 — 단계3-E 후보)

🔴 /dev-inspection data-craft today

🔴 /dev-security-inspection data-craft today

🟢 /plan-enterprise data-craft 단계4 메시징·알림·피드 통합 — DM (목록/채팅/권한), 알림/인박스, 피드/홈/프로필/팔로우 를 단일 plan 으로 묶고 phase 분해 (apps/web/src/mobile/layouts/AppShell 및 bottom-nav 위젯 공유 → 직렬 진행). routes/dm/, routes/inbox.tsx, routes/notifications.tsx, routes/feed.tsx, routes/home.tsx, routes/profile/, routes/page-follow/. 기존 message / notification / feed / profile API 재사용. — 완료 (이슈 #113, v001.231.0; Roadmap-1 의 BE/DB 무수정 lock 에 따라 BE 완비 영역만 wiring: Notification + Inbox + Profile-이미지 2 phase 11 파일. ScreenNotifications/ScreenInbox + notificationApi 호출, ScreenProfile + profileApi 신규. DM/피드/페이지팔로우/프로필 상세는 BE 신규가 필요하여 본 Roadmap-1 범위 외 — 전부 Roadmap-3 (data-craft Flutter + BE /v2/social/* 신규) 의 해당 단계에서 이미 다룸: DM=Roadmap-3 단계4, 피드/포스트=단계2, 팔로우/프로필=단계3, notification 인박스=단계5)

🔴 /dev-inspection data-craft today

🔴 /project-verification data-craft today

🟢 /plan-enterprise data-craft 단계5-A PWA 마감 — service worker 활성화 (apps/web/src/mobile/sw-register.ts), 정적 자원 캐시·오프라인 fallback·로딩/에러 바운더리·접근성 라벨. BE 변경 0. — 완료 (이슈 #115, v001.242.0; 명령 7개 항목 중 대부분이 이미 구현 완료 (sw-register / vite-plugin-pwa workbox / manifest / OfflineBanner / ScreenErrorBoundary / Suspense / aria-label) 임이 Explore 로 확인되어, 남은 5개 polish gap 만 단일 phase 12 파일 +192/-7 로 마감. AppErrorBoundary (최상위 React class) + LoadingSpinner (재사용 fallback, 5 라우트 적용; grid/kanban/calendar 는 라우트 파일 부재로 노터치) + offline.html + vite navigateFallback (SW cold-start 오프라인) + BottomTabs `aria-current="page"` + AppShell skip-to-main 링크. BE/DB 변경 없음. 잔여 검증/후속: LoadingSpinner `@keyframes spin` 동작 / grid·kanban·calendar 라우트 생성 시 LoadingSpinner 교체 phase / Lighthouse 점수 변화)

🔴 /dev-inspection data-craft today

🔴 /dev-security-inspection data-craft today

🔴 /project-verification data-craft today

🔴 /pre-deploy data-craft

🔴 /patch-confirmation data-craft

---

## 로드맵 설명

### 목적

마스터 요청 — DataCraft 웹의 기존 BE / DB 인프라를 **단 한 줄도 손대지 않고**, 모바일 규격 React 프론트엔드를 처음부터 끝까지 완성한다. 본 로드맵의 모든 코드 작업은 `data-craft-mobile/` 모노레포 한 곳에서만 일어나며 (`data-craft/` 웹 본 리포 및 `data-craft-server/` BE 리포는 read-only 참조), Flutter / 네이티브 / 안드로이드 / iOS 디렉터리는 본 로드맵에서 일절 건드리지 않는다. Flutter 웹뷰 통합 및 모바일 전용 기능 (BE/DB 변경 동반) 은 별도 Roadmap-2 에서 다룬다.

### 구성 개요

총 7 단계, 14 개 `/plan-enterprise` 프롬프트 + 단계간 품질 게이트 + 최종 배포·패치노트 마감.

- **단계 0** (0-A, 0-B 순차) — 모노레포·토큰·라우팅 골격 보강 후 인증 화면. 0-B 첫 phase 에서 모바일 origin 의 CORS/CSRF/쿠키 호환성 검증 필수.
- **단계 1** (1-A 선행, 1-B/1-C 병렬 그룹 1) — `fs-api-mobile` 어댑터를 먼저 정비한 뒤 페이지/레코드 두 축을 동시 진행. 패키지 경계가 갈리므로 병렬 안전.
- **단계 2** — 데이터 뷰어 5종은 `fs-data-viewer-mobile` 단일 패키지에 공유 features (column-settings, state-manager) 와 widgets 가 얽혀 있어 **단일 plan 내부 phase 직렬** 로 진행 (병렬 그룹화 금지).
- **단계 3** (병렬 그룹 2, 4 개) — 폼·데이터링크·관계·파일첨부는 각자 독립 패키지 (`fs-form-builder-mobile`, `fs-data-link-mobile`, `fs-relation-builder-mobile`, `fs-file-attachment-mobile`) → 4 개 plan-enterprise 병렬 진행 가능.
- **단계 4** — DM·알림·피드/홈/프로필 은 `apps/web/src/mobile/layouts/AppShell.tsx` 및 bottom-nav 위젯을 공유하므로 단일 plan 으로 묶어 phase 직렬 (병렬 금지).
- **단계 5** — PWA 마감 (service worker, offline cache, 에러 바운더리).
- **단계 6** — `/pre-deploy data-craft` 로 모바일 웹 빌드 검증 후 `/patch-confirmation data-craft` 로 패치노트 푸시 마감.

### 품질 게이트 배치

- 각 단계 사이 1 회 `/dev-inspection data-craft today`.
- 보안 민감 단계 (0 인증, 3 첨부·관계, 5 PWA) 종료 직후 `/dev-security-inspection data-craft today`.
- 단계 2·4·5 종료 후 `/project-verification data-craft today` 로 구조·중복·dead 코드 점검.

품질 게이트 결과로 BLOCK 이슈가 생기면 후속 `/plan-enterprise` 프롬프트로 자연스럽게 흡수 (plan-enterprise 가 이슈 hand-off 받음). 본 로드맵은 그 흐름을 가정하고 추가 프롬프트는 미리 박지 않는다.

### 위험·결정 사항

- **BE 호환성 가정 (0-B 첫 phase)** — 기존 `data-craft-server` 의 `/auth/*` 가 모바일 origin (`data-craft-mobile` 의 배포 도메인) 의 CORS·CSRF·쿠키를 그대로 수용하지 못하면 Roadmap-1 으로는 인증 불가. 이 경우 0-B 첫 phase 가 BLOCK 보고를 내고 본 로드맵 진행 중단 → 마스터가 Roadmap-2 로 이관 결정. 본 로드맵은 BE 변경 0 이 핵심 제약이므로 우회 금지.
- **PWA 푸시 / 디바이스 권한** — 본 로드맵 단계 5 의 PWA 는 service worker 캐시·오프라인 fallback 까지만 다룬다. Web Push, 카메라, 파일 시스템, 딥링크 등 디바이스 권한이 필요한 기능은 Flutter 브리지에 의존하므로 Roadmap-2 전담.
- **뷰어 5종 단일 패키지 충돌** — 5 개를 병렬화하면 `fs-data-viewer-mobile` 의 공유 `index.ts` · `features/column-settings` · `features/state-manager` 가 i-dev 머지 시점에 매번 충돌. 의도적으로 단일 plan 의 phase 직렬로 강제했다.
- **AppShell 공유** — 단계 4 의 3 영역도 같은 이유로 직렬. bottom-nav 추가 항목·라우트 가드·딥링크 패턴이 모두 AppShell 을 건드린다.

### 작업 범위 (Roadmap-1 ↔ Roadmap-2 경계)

| 항목 | Roadmap-1 | Roadmap-2 |
|---|---|---|
| 모노레포·토큰·라우팅·AppShell | O | 보강만 |
| 인증 (기존 API 활용) | O | — |
| 데이터 뷰어 5종 | O | — |
| 폼·데이터링크·관계·첨부 | O | — |
| 메시징·알림·피드·홈·프로필 | O | — |
| PWA 기본 (SW, offline cache) | O | — |
| Flutter 쉘 통합 / JS Bridge | — | O |
| 네이티브 푸시 알림 / 카메라 / 파일 | — | O |
| BE / DB 변경이 필요한 모든 모바일 전용 기능 | — | O |
| APK 빌드 / 배포 | — | O |

### 종료 조건

- 모든 단계의 `/plan-enterprise` 가 issue close 상태.
- 마지막 `/pre-deploy data-craft` 합격 보고서 발행.
- `/patch-confirmation data-craft` 가 origin push 완료.
- 본 파일의 모든 프롬프트 상태가 🟢 로 갱신 (마스터가 plan-roadmap edit 모드로 수동 갱신).
