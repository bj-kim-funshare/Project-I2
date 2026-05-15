---
projects:
  - name: HCILAB_2026
    role: FE
    tool: other
    target: ""
    build_command: pnpm build
    deploy_command: ""
    env_management: manual
---

# HCILAB_2026 — deploy 환경 규정

## 배포 상태

- v1 등록 시점: **배포 경로 미확정**. 빌드 명령 (`pnpm build`) 만 표준화.
- `tool: other` 는 placeholder — 배포 인프라 확정 시 closed-choice (`gh-pages` / `firebase` / `docker` / `kubernetes` / `vercel` / `netlify` / `aws`) 또는 `other` + 구체 명시로 갱신.
- `deploy_command` / `target` 이 빈 문자열인 동안 `pre-deploy` 스킬은 validator 단계에서 차단된다 (정상 동작).
- 배포 경로 확정 시 `/group-policy` 로 `deploy.md` 수정.

## 빌드 cwd

- `build_command` (`pnpm build`) 는 `dev.md` 의 `targets[0].cwd` (`/Users/starbox/Documents/GitHub/HCILAB_2026/app`) 에서 실행되어야 한다. 저장소 루트에서 실행하면 실패한다 (`package.json` 이 `app/` 하위에 있음).

## 자유 입력 사항

- env 관리: 현재 `manual` (로컬 `.env` 수기 관리). 배포 인프라 확정 시 `secret-manager` 또는 `git-tracked` 로 전환 검토.
