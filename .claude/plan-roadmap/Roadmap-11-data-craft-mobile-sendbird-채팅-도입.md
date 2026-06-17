# Roadmap 11: data-craft 모바일 Sendbird 채팅 도입

> 작성일: 2026-06-16 | 대상: data-craft-mobile(Flutter) /dm 탭을 Sendbird 기반 1:1·그룹 실시간 채팅으로 구축 — 모바일 전용, 무료 Developer 플랜, OS 푸시(FCM/APNs)는 본 로드맵 제외(종료 후속)

## 프롬프트

🟢 [수동/master·ops — 비코드 선행 (no-skill)] Sendbird 대시보드 프로비저닝 — dev/prod **Sendbird Application 2개 분리 생성**(테스트 사용자가 prod MAU를 소모하지 않게), 각 앱의 **App ID + API 토큰** 확보(App ID는 모바일에 내장 OK, API 토큰=시크릿은 서버 env 전용), **⚠️클라이언트 측 GroupChannel 생성 비활성화 토글**(대시보드 설정 — 멀티테넌시를 Sendbird 레벨에서 강제하는 핵심: 채널 생성은 서버 Platform API로만 허용). 무료 조직에서 앱 복수 생성 가능 여부 확인. 이 단계 산출물(App ID 2개·API 토큰 2개)이 1번 프롬프트의 입력.

🟢 /plan-enterprise data-craft data-craft-server data-craft-mobile — **Sendbird 기반 구축(서버 엔드포인트 + 모바일 SDK 코어)**. ✅완료 2026-06-16(이슈 #339, patch-note v001.808.0 — server/mobile i-dev 머지. 런타임 실측은 master dev 환경에서). ① data-craft-server: `POST /api/chat/session-token`(auth-guard) — Sendbird Platform API로 사용자 idempotent upsert(user_id=`UserInfoDto.id`, nickname=name, profileUrl=프로필이미지) + 세션토큰 발급, `{appId,userId,sessionToken,expiresAt}` 반환. `POST /api/chat/channels` — 멤버 id 목록 받아 **같은 companyId만 허용 검증** 후 Platform API로 GroupChannel 생성(1:1은 `is_distinct=true`), 회사 오너/관리자를 operator로 지정, channel_url 반환. 로그아웃 시 호출할 세션토큰 revoke 엔드포인트. API 시크릿은 서버 env 전용(.env/.env.local, dev/prod 분리). 응답은 표준 봉투(`buildAuthResponse`/`sendResponse`). ② data-craft-mobile: `sendbird_chat_sdk` v4 추가, `lib/chat/` 신설 — `chat_service`(init·connect·SessionEventHandler 토큰갱신·재연결), Riverpod `chatConnectionProvider`(authControllerProvider 연동 — **로그인 시 앱전역 connect**, 로그아웃 시 disconnect + **SDK `clearCachedData` + 서버 세션토큰 revoke 둘 다**). **connect 실패를 `NetworkUnavailableException`으로 변환 금지**(점검중 화면 오전이 차단 — 채팅 오류는 채팅 영역 국한). 프로필 이미지는 기존 웹과 동일 방식 처리(웹 메커니즘 1회 확인 후 미러링). 검증: dev 서버 기동 + 모바일에서 로그인→connect 성공·로그아웃→캐시·토큰 정리 로컬 실측, BE pnpm build(tsc) + fresh 워크트리 pnpm install 선행.

🟢 /plan-enterprise data-craft data-craft-mobile — **채널목록 + 채팅룸 화면**(1번 SDK 코어 선행). ✅완료 2026-06-16(이슈 #343, patch-note v001.821~833 — 본작업 5페이즈 + 핫픽스 6건[빈목록·연결레이스·읽음뱃지·진입읽음·풀스크린·뒤로가기], master 실측 합격). `/dm` 라우트의 `DmPlaceholder`를 `ChatListScreen`으로 교체 — GroupChannelCollection 구독, 채널 목록·마지막 메시지·안읽음 카운트, `_TabDef`의 하드코딩 unread `2`를 Sendbird `totalUnreadMessageCount`로 교체. `/dm/:channelUrl`→`ChatRoomScreen` — MessageCollection 송수신·히스토리·읽음 확인·타이핑 표시. l10n app_en/ko.arb 채팅 키 추가, light/dark 테마 준수. 검증: dev 2계정으로 메시지 송수신·실시간 반영·안읽음 뱃지 갱신 로컬 실측 — P3 인앱 생성 전이라 P1의 `POST /api/chat/channels`로 dev 채널 2개 사전 생성 후 검증. (flutter 신규 화면=dev 서버 재기동 필수.)

🟢 /plan-enterprise data-craft data-craft-mobile data-craft-server — **새 채팅 / 멤버피커 + 그룹 생성·관리**(2번 선행). ✅완료 2026-06-17(이슈 #346, patch-note v001.838~848 — 본작업 5페이즈[서버 invite/leave/rename + 모바일 chat_api·멤버피커·그룹설정] + 핫픽스 5건[설정 멤버표시·멤버 upsert 근본수정·설정화면 레이아웃·본인 포함 표시·그룹 기본 채널명 서버 세팅]). master 실측 합격(1:1·그룹 생성, 멤버피커, 이름변경·초대·나가기, 그룹 기본 채널명=멤버 나열+외 N명이 목록·헤더·설정 일치). `/dm/new`→회사-스코프 멤버피커(기존 회사 user 목록 `/api/user`, 권한/역할 제한 없음 — companyId만), 1:1 선택→서버 채널중개로 `is_distinct=true` 채널 생성·기존 채널 재사용, 다중 선택→그룹 채널 생성. 그룹 멤버 추가/나가기/이름 등 기본 관리 UI(서버 중개 경유). 검증: 동일 2인 재대화 시 중복 채널 미생성(is_distinct) + 그룹 생성·멤버변경 로컬 실측.

🔴 /plan-enterprise data-craft data-craft-server data-craft-mobile — **그룹 관리 심화: 방장(운영자) 권한 + 채팅방 삭제**(3번[새 채팅/그룹 생성·관리] 선행, 채널·설정화면 존재 전제). Sendbird operator를 UI에 노출하고 권한을 분기한다. ① data-craft-server: 신규 `DELETE /api/chat/channels/:channelUrl` — Sendbird `DELETE /v3/group_channels/{url}`, **요청자=operator 검증 후에만 삭제**(아니면 403). 멤버 강퇴(kick) — operator가 타 멤버를 채널에서 제거(타인 leave 또는 `POST .../ban`, **operator 검증 필수**). 방장 위임/추가 — `POST .../operators`(operator 검증). 이름변경 컨트롤러에 **operator 가드 추가**(현 무가드 → operator만 허용). 멤버초대는 **누구나 허용**(가드 없음, 현행 유지). 신규 엔드포인트 전부 `permission.middleware.ts PLAN_ENDPOINTS[FREE]` allowlist 등록(누락=403 PLAN_NOT_ALLOWED). operator 판별의 신뢰원본=서버(채널 operators/멤버 role 조회). sendResponse 봉투. ② data-craft-mobile: 설정 화면(`channel_settings_screen.dart`)에서 MemberListQuery `member.role=='operator'`로 **운영자(방장) 뱃지** 표시, 권한 분기 — **이름변경=운영자만**, **멤버초대=누구나**, 멤버별 강퇴·방장위임 액션은 운영자에게만 노출, 하단 **"채팅방 삭제"**(운영자 전용·빨강·confirm 다이얼로그)→삭제 후 `/dm` 복귀. 비운영자에겐 나가기만 노출. 1:1은 방장 개념 없음(삭제 대신 나가기 유지). 검증: 운영자/비운영자 2계정으로 권한 분기·강퇴·방장위임·방삭제·이름변경 가드 로컬 실측.

🔴 /plan-enterprise data-craft data-craft-mobile — **미디어 메시지**(2번 선행). 이미지·파일·오디오·비디오 메시지 송수신 + 자동 썸네일 표시. 안드로이드 `RECORD_AUDIO`/`READ_MEDIA_*`·iOS 마이크/카메라 usage 등 **미디어 권한 매니페스트** 추가(기존 image_picker는 이미지·카메라 일부만 커버). 파일 크기 제한 UX 처리. 검증: 4종 미디어 송수신·썸네일·권한 프롬프트 실기기/에뮬 실측.

🔴 /plan-enterprise data-craft data-craft-server data-craft-mobile — **프리즈 + 어드민 메시지**(3번 선행, 채널 존재 전제). 무료 플랜은 대시보드 모더레이션 UI 잠김 → data-craft-server가 Platform API로 채널 freeze/unfreeze·admin 메시지 발송(채널 생성 시 지정된 operator 권한). 모바일은 operator(회사 오너/관리자)에게만 프리즈·공지 트리거 노출. 검증: operator만 프리즈 가능·프리즈 중 일반멤버 발송 차단·admin 메시지 수신 로컬 실측.

---

## 로드맵 설명

### 목적

회사 발급 Sendbird 계정으로 data-craft-mobile의 비어있는 `/dm` "Chat" 탭을 1:1·그룹 실시간 채팅으로 채운다. 메시지 전송은 Sendbird 소켓이 담당(서버 소켓 구축 없음), 서버(data-craft-server)는 인증·멀티테넌시 경계만 책임진다. 본 로드맵은 **앱이 켜져 있는 동안의 실시간 채팅·인앱 알림까지** 완성하며, 앱 종료 시 OS 푸시(FCM/APNs)는 외부 자산(Firebase·APNs 키) 대기 항목이라 제외하고 종료 후속으로 안내한다.

### 핵심 결정 (본 세션 동결, advisor 검토 완료)

- **멀티테넌시 = 서버 채널중개(최우선)**: Sendbird 단일 앱엔 회사 격리가 없다. 클라이언트 SDK의 채널 생성을 대시보드에서 끄고, 모든 채널 생성·멤버초대를 data-craft-server가 companyId 일치 검증 후 Platform API로 수행. 대화 후보는 기존 회사-스코프 `/api/user`. 그룹은 기본 private+invite-only라 멤버 선택만 회사-스코프면 격리 유지.
- **인증 = 서버 발급 세션토큰만**: API 시크릿은 서버 env 전용, 모바일 절대 미내장. 세션토큰 발급마다 idempotent upsert로 프로필/닉네임 드리프트 방지.
- **로그아웃 보안 2종 필수**: Sendbird SDK는 메시지를 로컬 캐시하고 세션토큰은 발급 후 잔존하므로, 로그아웃 훅에 SDK `clearCachedData` + Platform API 세션토큰 revoke 둘 다(같은 기기 타사용자 로그인 시 이전 채팅 노출·타기기 재connect 차단).
- **connect 시점 = 앱전역(현 단계)**: 사용자 적어 무료 동시20 안전. 동접 20 근접 시 lazy-connect(채팅 탭에서만 connect)로 전환 — 종료 후속의 트리거.
- **1:1 중복 방지**: `is_distinct=true`.
- **알림 = 소켓 기반 인앱만, 기존 알림함과 분리**: 채팅 안읽음은 Sendbird/채팅탭에서만, 기존 InboxScreen/NotificationApi와 webhook 브리지 안 함(이중구조 방지).
- **dev/prod Sendbird 앱 2개 분리**: prod에 실사용자 유입 후 분리는 채널·메시지 마이그레이션이 사실상 불가하므로 처음부터 분리.
- **DB 무변경**: 서버는 Sendbird에 대해 stateless. 신규 테이블 없음.

### 실행 경로

data-craft 그룹의 멤버 repo 다수(data-craft-server + data-craft-mobile)를 건드린다. plan-enterprise는 멀티-repo 정식 지원(한 플랜이 페이즈별 work_repo로 두 repo 처리)이므로 각 프롬프트가 두 repo를 함께 빌드한다. 단 런타임 의존(모바일이 라이브 세션토큰 엔드포인트 호출)은 빌드가 아닌 배포 차원 — dev에선 로컬 서버 기동으로 검증, prod 배포 시 서버 먼저(BE 배포는 서버 git pull 필요)·모바일 후 순서를 별도로 지킨다. 각 plan-enterprise의 표준 종료점은 i-dev 머지(origin push는 master 명시 시만).

### 위험

- **무료 플랜 하드캡**: 동시 20·MAU 1,000, 오버리지 불가(넘으면 신규 연결 거부). connect하는 모든 사용자가 MAU. POC/소규모까지 안전, 확대 시 유료 승급 + lazy-connect 전환 필요.
- **그룹 100명 상한**: 슈퍼그룹은 무료 제외. 100명 초과 그룹 미지원.
- **메시지 보관 6개월**: 무료 플랜 보관 한도.
- **데이터 거버넌스**: 채팅 내용이 제3자(Sendbird) 서버에 6개월 보관 — master 수용 확정. PIPA 등 컴플라이언스는 master 책임 영역.
- **순차 의존**: 전 단계 순차(병렬 그룹 없음) — 메모리 `feedback_parallel_job_roadmap_track_collision`(병렬 잡이 같은 트랙 동시 집어 i-dev add/add 충돌) 회피. 한 단계 머지 후 다음 단계 착수.

### 종료 조건 + 후속

- 1~5번 i-dev 머지 + 각 dev 실측 통과 → 앱 켜져있는 동안의 1:1·그룹·미디어·프리즈/어드민 채팅 완성.
- **후속 1 — OS 푸시(필수)**: Android+iOS 백그라운드/종료 푸시. 선행 외부 자산 = Firebase 프로젝트(안드 FCM) + Apple Developer 계정의 APNs 인증키(iOS). 자산 확보 후 별도 plan-enterprise — Sendbird 대시보드에 FCM/APNs 키 등록, 모바일 푸시 토큰 등록(connect 시)·포그라운드/백그라운드 상태 관리. (앱 종료 중 알림은 이 후속 완료 전까지 미동작 — 사용자가 앱 열면 소켓이 밀린 메시지 수신.)
- **후속 2 — 스케일 전환**: 동접 20 또는 누적 1,000 MAU 근접 시 유료 플랜 승급 + connect를 앱전역→lazy-connect(채팅 탭 한정) 전환.
- **후속 3 — 웹 채팅**: data-craft(React) 채팅은 별도 로드맵. 본 로드맵의 서버 엔드포인트(session-token·채널중개) 재사용.
