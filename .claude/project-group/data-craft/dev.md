---
targets:
  - name: data-craft
    cwd: /Users/starbox/Documents/GitHub/data-craft
    type: monorepo
    dev_command: pnpm dev
    port: 5173
    cache_paths: []
    lint_command: pnpm typecheck:all && pnpm lint
  - name: data-craft-mobile
    cwd: /Users/starbox/Documents/GitHub/data-craft-mobile
    type: monorepo
    dev_command: pnpm dev
    port: 5174
    cache_paths: []
    lint_command: pnpm typecheck
  - name: data-craft-ai-preview
    cwd: /Users/starbox/Documents/GitHub/data-craft-ai-preview
    type: project
    dev_command: npm run dev
    port: 3000
    cache_paths: []
    lint_command: npm run lint
  - name: data-craft-server
    cwd: /Users/starbox/Documents/GitHub/data-craft-server
    type: project
    dev_command: pnpm dev
    port: 8000
    cache_paths: []
    lint_command: pnpm lint
---

# data-craft — dev 환경 규정

## env 정책 (4개 공용)

- 단일 `.env` 정책: 4개 저장소 전부 동일한 env 사용. 개발 / 프로덕트 공용. 모든 브랜치 공유.
- env 파일은 각 저장소에서 **git-tracked** (마스터 명시 정책).
- 본 정책 파일에는 시크릿 값을 적재하지 않음 (I2 harness 별도 저장소이므로).

## 포트 정책 (확정)

- `data-craft` = 5173 (Vite 기본).
- `data-craft-mobile` = 5174 (리더와 충돌 회피, 마스터 명시 지정).
- `data-craft-ai-preview` = 3000 / `data-craft-server` = 8000.

## lint 정책 (확정)

- `data-craft` lint gate = `pnpm typecheck:all && pnpm lint` (직렬 — 타입체크 + eslint 둘 다, 마스터 명시).
- 타입체크 실패 시 eslint 미실행 (직렬 `&&` 단락 평가).
- 나머지 3개 프로젝트 lint 는 기존 유지.

## 기타

- `data-craft`, `data-craft-mobile` 은 pnpm workspace + 모노레포 (`packages/`, `apps/`). `dev-build` 가 모노레포 선택 UI 노출.
- `data-craft-server` 는 `nodemon + ts-node` 기반. `SERVER_PORT=8000` env 변수 기반 (env 참조).
