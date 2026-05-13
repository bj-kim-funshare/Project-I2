---
targets:
  - name: data-craft
    cwd: /Users/starbox/Documents/GitHub/data-craft
    type: monorepo
    dev_command: pnpm dev
    port: 5173
    cache_paths: []
    lint_command: pnpm typecheck:all
  - name: data-craft-mobile
    cwd: /Users/starbox/Documents/GitHub/data-craft-mobile
    type: monorepo
    dev_command: pnpm dev
    port:
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

## 포트 / lint 미확정 항목

- `data-craft-mobile` 의 `port` 는 미확정. Vite 기본 5173 이 `data-craft` 와 충돌하므로 명시 지정 필요. `/group-policy` 로 확정.
- `data-craft` 의 `lint_command` 는 `pnpm typecheck:all` (turbo 기반 전 패키지 타입체크) 채택. `pnpm lint` (eslint) 도 패키지에 존재하므로 추후 어느 쪽을 lint gate 로 쓸지 마스터 확정 시 변경.

## 기타

- `data-craft`, `data-craft-mobile` 은 pnpm workspace + 모노레포 (`packages/`, `apps/`). `dev-build` 가 모노레포 선택 UI 노출.
- `data-craft-server` 는 `nodemon + ts-node` 기반. `SERVER_PORT=8000` env 변수 기반 (env 참조).
