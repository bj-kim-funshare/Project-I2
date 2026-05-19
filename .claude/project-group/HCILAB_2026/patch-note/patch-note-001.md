# HCILAB_2026 — Patch Note (001)

## v001.4.0

> 통합일: 2026-05-19
> 플랜 이슈: [jieun410/HCILAB_2026#3](https://github.com/jieun410/HCILAB_2026/issues/3)

### 페이즈 결과

- **Phase 1 — BE phone 필드 통과** (커밋 `aa6dfcd`): `server/src/routes/contact.js` 가 `req.body` 에서 `phone` 도 추출하도록 보완 (선택 필드, 값이 있으면 string 타입만 검사 — 정규식 강제 X). `server/src/lib/mailer.js` `send()` 시그니처에 `phone` 인자 추가. Phase 2 의 정식 템플릿 교체를 위한 임시 통과 단계로, plain-text 본문에 "전화: <phone>" 한 줄을 임시 삽입했다가 Phase 2 에서 제거.
- **Phase 2 — HTML 메일 템플릿 적용** (커밋 `e1c4388`): `server/src/lib/emailTemplates.js` 신규 생성 — `buildContactEmail({name, email, subject, phone, message})` 가 `{html, text}` 반환. 모든 사용자 입력에 `escapeHtml` 적용, `phone` 빈 값 시 전화번호 행 자체 생략. HTML 은 600px max-width 카드 (HCI LAB 워드마크 + "Human-Computer Interaction Lab" 부제 + divider + 안내 문구 + 5행 정보 카드 (이름·이메일·제목·전화번호·문의 내용) + 자동발신 안내 + 3컬럼 풋터) 의 이메일 호환 table 레이아웃, 인라인 스타일 only. `mailer.js` 의 Phase 1 임시 plain-text 본문을 제거하고 `buildContactEmail()` 호출로 교체하여 `sendMail` 에 html + text 양쪽 전달.

### 영향 파일

**HCILAB_2026** (커밋된 파일 3개, +172 / -4):

```
server/src/lib/emailTemplates.js     (신규 — buildContactEmail 함수 + LAB_INFO 상수 + escapeHtml 헬퍼)
server/src/lib/mailer.js             (수정 — buildContactEmail 호출, sendMail 에 text + html 양쪽 전달, phone 시그니처)
server/src/routes/contact.js         (수정 — phone 추출 + 선택 검증 + send payload 통과)
```

### 비고

- 로고는 자산 부재로 1차 워드마크 텍스트 로고로 완성 (HCI LAB + 부제). 첨부 이미지의 lightbulb/gear/magnifier 아이콘 정확 매칭 필요 시 정적 자산 추가 후속 핫픽스 가능.
- 풋터 전화번호는 마스터 입력 이미지 그대로 `053-850-xxxx` 마스킹 사용.
- 메일 클라이언트 호환을 위해 table 레이아웃 + 인라인 스타일만 사용. `<tr>` 의 `border-bottom` 은 Gmail/Outlook 이 무시할 수 있어 행 구분이 약하게 보일 수 있음 — 시각 차이 발생 시 `<td>` 의 border 로 옮기는 후속 가능.
- 검증: `DISABLE_MAIL=true` 로그 분기는 새 템플릿을 호출하지 않음 (subject/email 만 로그). 실제 렌더링 확인은 `DISABLE_MAIL=false` 로 본인 메일에 실송 후 Gmail 웹/앱에서 시각 비교 필요.

## v001.3.0

> 통합일: 2026-05-19
> 플랜 이슈: [jieun410/HCILAB_2026#1](https://github.com/jieun410/HCILAB_2026/issues/1)
> 핫픽스: 2차

### 핫픽스 페이즈 결과

- **Phase 4 (HOTFIX 2) — 포트 통일 (FE 5180 strict + BE 3002 default 정렬)** (커밋 `e6c2af9`): 마스터가 dev 서버 기동 시 FE 가 5174 로 떠 CORS 차단된 사건 후속. 원인은 (a) `app/vite.config.ts` 가 port 를 강제하지 않아 Vite 기본 5173 + fallback 으로 5174 에 안착, (b) BE 코드의 기본 fallback (`3001`) 이 dev.md (3002) 와 불일치. 7개 파일에서 8건 stale port 참조를 일괄 정렬했고, FE 는 `strictPort: true` 로 5180 점유 시 부팅 실패하도록 강제 (fail-fast 신규 동작 도입).

### 영향 파일

**HCILAB_2026** (커밋된 파일 7개, +12 / -8):

```
app/vite.config.ts                                  (수정 — server.port 5180 + strictPort true 추가)
app/.env.example                                    (수정 — VITE_API_BASE_URL :3001 → :3002)
app/src/_domain/contact/Contact.tsx                 (수정 — axios fallback :3001 → :3002)
app/src/_domain/component/molecule/logo/logo.tsx    (수정 — 하드코딩 http://localhost:5173/home → 상대 경로 /home)
server/src/index.js                                 (수정 — CORS default :5173 → :5180, PORT default 3001 → 3002)
server/.env.example                                 (수정 — PORT 3001 → 3002, CORS_ORIGIN :5173 → :5180)
server/README.md                                    (수정 — 3001 표기 → 3002)
```

gitignored 로컬 파일 (커밋 외):
- `server/.env`: `CORS_ORIGIN` 을 5180 으로 원복 (직전 임시조정 5174 → 정식 5180).

### 신규 동작 — fail-fast

- `vite.config.ts` `strictPort: true` 도입 → 5180 점유 시 dev 서버가 fallback 없이 부팅 실패. 의도된 동작 (재발 방지). 점유 시 master 가 즉시 인지 가능.

### 운영 메모

- **원인 깊이**: vite 의 port fallback 은 silent 실패였음 — dev.md 의 5180 선언이 코드와 unenforced 분리되어 있던 게 본질. policy ↔ code 간 단일 진실 (dev.md 가 진리, 코드가 동기화) 회복.
- **logo.tsx 절대 URL 제거**: 하드코딩 `http://localhost:5173/home` 은 포트뿐 아니라 production 배포 환경에서도 깨질 잠재 버그였음. same-origin 상대 경로 `/home` 으로 정정.
- **수동 검증**: `pnpm dev` 실행 시 콘솔에 `Local: http://localhost:5180/` 출력 확인. 5180 점유 시 부팅 실패 확인 (별도 프로세스로 5180 선점 후 재시도).

### advisor 검증

- 핫픽스 완료 시점 advisor #2 5관점 (Intent/Logic/Group Policy/Evidence/Command Fulfillment) 모두 PASS, BLOCK 없음.

---

## v001.2.0

> 통합일: 2026-05-19
> 플랜 이슈: [jieun410/HCILAB_2026#1](https://github.com/jieun410/HCILAB_2026/issues/1)
> 핫픽스: 1차

### 핫픽스 페이즈 결과

- **Phase 3 (HOTFIX 1) — 누락 이미지 자산 복구 + .gitignore 정정** (커밋 `311cf5a`): `app/.gitignore` 의 `peopleImg/` 와 `image/` 두 bare-pattern 라인 제거. 마스터가 제공한 `/Users/starbox/Downloads/assets.zip` 에서 peopleImg/ 4종 (eunbin/geuna/jeonghoon/jieun, 약 9.8MB) + publicationImg/ conference 9종 + journals 1종 (약 5.2MB) 총 14개 이미지 파일을 추출하여 `app/src/common/assets/image/peopleImg/` 와 `.../publicationImg/{conference,journals}/` 로 배치 후 커밋. `_index.ts` 의 모든 import 경로가 이제 실제 파일로 resolve 됨.

### 영향 파일

**HCILAB_2026** (커밋된 파일 15개):

```
app/.gitignore                                                                    (수정 — peopleImg/, image/ 제거)
app/src/common/assets/image/peopleImg/eunbin.jpeg                                 (신규)
app/src/common/assets/image/peopleImg/geuna.jpeg                                  (신규)
app/src/common/assets/image/peopleImg/jeonghoon.png                               (신규)
app/src/common/assets/image/peopleImg/jieun.jpeg                                  (신규)
app/src/common/assets/image/publicationImg/conference/CEIC2025Platforms.png       (신규)
app/src/common/assets/image/publicationImg/conference/ICCT2025WebRTC.png          (신규)
app/src/common/assets/image/publicationImg/conference/KICSP2023GAME.png           (신규)
app/src/common/assets/image/publicationImg/conference/KICSP2023VR.png             (신규)
app/src/common/assets/image/publicationImg/conference/KICSP2024Metaverse.png      (신규)
app/src/common/assets/image/publicationImg/conference/KICSP2024PulseWave.png      (신규)
app/src/common/assets/image/publicationImg/conference/KICSP2024Ticket.png         (신규)
app/src/common/assets/image/publicationImg/conference/KICSP2025Relationship.png   (신규)
app/src/common/assets/image/publicationImg/conference/KICSP2025STTSER.png         (신규)
app/src/common/assets/image/publicationImg/journals/KCI2024.png                   (신규)
```

### 운영 메모

- **원인**: `app/.gitignore` 의 `peopleImg/` `image/` bare-pattern 이 git 추적을 차단하여 마스터의 원본 머신에만 이미지가 존재. plan-enterprise #1 의 Phase 2 i-dev sync 시 main 의 `_index.ts` 가 합류하면서 import 경로 부재 사실이 드러남 — Vite import-analysis 실패로 사이트 전체 부팅 차단.
- **사전 확인**: `_index.ts`, `logo/HCI.png`, `logo/HciLabLogo.png` 는 `.gitignore` 추가 이전에 이미 추적된 상태였음 (`git ls-files` 확인). 신규 클론에서도 부팅 가능.
- **수동 검증**: `cd app && pnpm dev` → http://localhost:5180 에서 `/`, `/contact`, `/members`, `/publications` 모두 정상 렌더링.

### advisor 검증

- 핫픽스 완료 시점 advisor #2 5관점 (Intent/Logic/Group Policy/Evidence/Command Fulfillment) 모두 PASS, BLOCK 없음.

---

## v001.1.0

> 통합일: 2026-05-19
> 플랜 이슈: [jieun410/HCILAB_2026#1](https://github.com/jieun410/HCILAB_2026/issues/1)

### 페이즈 결과

- **Phase 1 — Express.js 서버 스캐폴딩 + 메일 전송 엔드포인트** (커밋 `a635117`): 저장소 루트에 `server/` 신규 생성 (Express.js ESM). nodemailer + Gmail SMTP (`smtp.gmail.com:587`) 트랜스포터, `POST /api/contact` 라우터 (이름/이메일/제목/문의 입력 검증, Reply-To = 제출자), `DISABLE_MAIL=true` 시 송신 없이 로그만 남기는 분기, CORS 는 `http://localhost:5173` 허용. `.gitignore` 가 `.env` 를 먼저 가린 뒤 자격증명 `.env` 는 워킹트리에만 작성 (커밋 제외). pnpm 으로 deps 설치 + lockfile 생성 (+788 lines).
- **Phase 2 — FE Contact 폼 ↔ 백엔드 연동** (커밋 `ae20830`): `app/src/_domain/contact/Contact.tsx` 를 controlled component 로 전환 (네 필드 useState), axios 로 `${VITE_API_BASE_URL}/api/contact` 에 POST. 클라이언트 검증 (빈 값 + 이메일 정규식), MUI Snackbar 성공/실패 피드백, 전송 중 버튼 비활성화/라벨 전환. 기존 sx 스타일/InfoCard 구조 무수정 (+81/-5 lines). `app/.env.example` 신규, `app/.env` 는 워킹트리에만.

### 영향 파일

**HCILAB_2026** (커밋된 파일 10개 — `.env` 2개는 gitignored 로 워킹트리에만 존재):

```
app/.env.example
app/src/_domain/contact/Contact.tsx
server/.gitignore
server/.env.example
server/README.md
server/package.json
server/pnpm-lock.yaml
server/src/index.js
server/src/lib/mailer.js
server/src/routes/contact.js
```

### 운영 메모

- **베이스 브랜치 동기화**: Phase 2 첫 디스패치 시 `plan_contradicts_code` 발생 — i-dev (`275eafc`) 가 main (`aebc6e4`) 보다 7 커밋 stale 하여 Contact.tsx 가 분기 시점에 부재. i-dev ← main fast-forward 후 갱신 i-dev 를 WIP 에 `--no-ff` 머지 (`c4249dd`, 충돌 없음) 하고 재디스패치. **향후 본 그룹의 모든 main 변경은 i-dev 경유 필요** — 외부 작업자에게 안내 필요.
- **`.env` 보존**: 워크트리 제거 전 `server/.env` 와 `app/.env` 를 메인 working tree 로 복사. 마스터는 `pnpm dev` 즉시 실행 가능.
- **dev.md targets[] 갱신 후속**: server 를 `targets[]` 에 등록하면 `/dev-start` 등 후속 스킬이 인식 가능. 별도 `/group-policy` 호출 권장.
- **수동 검증 시나리오**:
  1. `cd /Users/starbox/Documents/GitHub/HCILAB_2026/server && pnpm dev` → `[server] listening on 3001` 확인.
  2. `cd /Users/starbox/Documents/GitHub/HCILAB_2026/app && pnpm dev` → `http://localhost:5173/contact` 접속.
  3. 네 필드 입력 후 "메일 보내기" → 성공 Snackbar + `easyeun410@gmail.com` 수신함 도착.
  4. 빈 필드 / 잘못된 이메일 → 클라이언트 차단 및 서버 400.
  5. `server/.env` 의 `DISABLE_MAIL=true` 로 변경 + 재시작 → 폼 제출 시 송신 없이 `[DISABLE_MAIL] would send: ...` 로그.

### advisor 검증

- 계획 시점 (#1): Intent/Logic/Group Policy/Evidence/Command Fulfillment 모두 PASS.
- 완료 시점 (#2): 동일 5관점 PASS, `BLOCK:` 없음. 운영 사항 2건 (`.env` 보존 / patch-note 버전) 모두 본 머지 전 처리됨.

