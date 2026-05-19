# HCILAB_2026 — Patch Note (001)

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

