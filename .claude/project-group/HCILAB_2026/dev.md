---
targets:
  - name: HCILAB_2026
    cwd: /Users/starbox/Documents/GitHub/HCILAB_2026/app
    type: project
    role: FE
    dev_command: pnpm dev
    port: 5173
    cache_paths:
      - node_modules/.vite
      - dist
    lint_command: pnpm lint
---

# HCILAB_2026 — dev 환경 규정

## 개발 환경 개요

- 단일 FE 프로젝트 — 백엔드는 별도 저장소 없음 (필요 시 외부 API 또는 향후 추가).
- 패키지 매니저: pnpm (lockfile 기준).
- 빌드/타입체크: `tsc -b && vite build` (package.json `build` 스크립트).
- HMR 포트 기본 5173 (Vite 기본값) — 충돌 시 마스터가 `port` 필드 수정.

## dev-start 동작 조건

- `dev-start` 호출 시 `cwd` (= `app/`) 에서 `pnpm dev` 실행.
- 캐시 정리 대상: `node_modules/.vite`, `dist`.

## 자유 입력 사항

(추후 사내 컨벤션이 정해지면 이 절을 갱신.)
