---
targets:
  - name: Tteona
    cwd: /Users/starbox/Documents/GitHub/Tteona
    type: project
    role: FE
    dev_command: pnpm dev
    port: 3000
    cache_paths:
      - .next
    lint_command: pnpm lint
  - name: Tteona-server
    cwd: /Users/starbox/Documents/GitHub/Tteona-server
    type: project
    role: BE
    dev_command: pnpm dev
    port: 3001
    cache_paths:
      - dist
    lint_command: pnpm typecheck
---

# Tteona — dev 환경 규정

## 프로젝트별 dev 환경

- **Tteona** (리더 저장소, FE): Next.js 16 개발 서버를 `pnpm dev` 로 기동, 포트 3000. 빌드 캐시는 `.next`. `dev-start` 가 FE 타겟이므로 기동 대상으로 삼는다.
- **Tteona-server** (BE): Hono 개발 서버를 `pnpm dev` (`tsx watch src/index.ts`) 로 기동, 포트 3001 (`PORT` env 기본값). 빌드 산출물은 `dist`. BE 이므로 `dev-start` 기동 대상은 아니나 매니페스트에 포함되어 `dev-build` 등 다른 스킬이 사용한다.

## lint 게이트

- Tteona: `pnpm lint` (eslint, eslint-config-next).
- Tteona-server: `pnpm typecheck` (`tsc --noEmit`) — `dev-merge` / `plan-enterprise` per-phase lint 게이트에서 사용.
