---
targets:
  - name: HCILAB_2026
    cwd: /Users/starbox/Documents/GitHub/HCILAB_2026/app
    type: project
    role: FE
    dev_command: pnpm dev
    port: 5180
    cache_paths:
      - node_modules/.vite
      - dist
    lint_command: pnpm lint
  - name: HCILAB_2026-server
    cwd: /Users/starbox/Documents/GitHub/HCILAB_2026/server
    type: project
    role: BE
    dev_command: pnpm dev
    port: 3002
    cache_paths: []
    lint_command: ""
---

# HCILAB_2026 — dev 환경 규정

## 개발 환경 개요

- FE (`app/`, 포트 5180) + BE (`server/`, 포트 3002) 2-target 그룹.
- BE 는 Express.js + nodemailer 로 메일 송신을 담당 (`POST /api/contact`). 자세한 사항은 `server/README.md`.
- 다른 그룹과의 포트 분리:
  - data-craft 그룹 점유: 5173 / 5174 / 3000 / 8000.
  - Pinlog 그룹 점유: 5173 / 8443.
  - Tteona 그룹 점유: 3000 / 3001.
  - 본 그룹은 충돌을 피해 FE 5180, BE 3002 로 분리.
- 패키지 매니저: pnpm (양 target 의 lockfile 기준).
- 빌드/타입체크 (FE): `tsc -b && vite build` (`app/package.json` `build`).
- HMR 포트 기본 5180 — 충돌 발생 시 마스터가 dev.md `port` 필드 갱신.

## dev-start 동작 조건

- **FE target (HCILAB_2026)**: `dev-start` 호출 시 `cwd` (= `app/`) 에서 `pnpm dev` 실행. 캐시 정리 대상: `node_modules/.vite`, `dist`.
- **BE target (HCILAB_2026-server)**: `cwd` (= `server/`) 에서 `pnpm dev` 실행 (`node --watch src/index.js`). 캐시 정리 대상 없음 (`cache_paths: []`) — server 측은 빌드 캐시가 없으므로 `node_modules` 도 보존.
- BE 의 환경 변수 (`MAIL_*`, `DISABLE_MAIL`, `PORT`, `CORS_ORIGIN`) 는 `server/.env` 로 수동 관리 (gitignored, `server/.env.example` 가 placeholder 제공).
- BE 의 `server/.env` `PORT` 값은 본 dev.md 의 `port` 필드 (3002) 와 일치시켜야 dev-start 의 listening 대기가 정상 종료됨 (불일치 시 timeout). `.env.example` 은 placeholder 로 3001 을 명시하고 있으므로, 신규 머신에서 클론 직후 master 가 `server/.env` 의 `PORT=3002` 로 갱신해야 한다.

## 자유 입력 사항

(추후 사내 컨벤션이 정해지면 이 절을 갱신.)
