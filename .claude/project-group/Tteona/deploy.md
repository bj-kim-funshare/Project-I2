---
projects:
  - name: Tteona
    role: FE
    tool: vercel
    target: 미정
    build_command: pnpm build
    deploy_command: git checkout main && vercel deploy --prod
    env_management: git-tracked
  - name: Tteona-server
    role: BE
    tool: aws
    target: 미정
    build_command: pnpm build
    deploy_command: git checkout main && git push origin main:aws-deploy
    env_management: git-tracked
---

# Tteona — deploy 환경 규정

## 공통 배포 정책

- **기준 브랜치 = `main`**. 모든 `deploy_command` 는 데이터크래프트 그룹과 동일하게 `git checkout main` 을 첫 단계로 포함 (FE/BE 일관).
- 흐름: 작업 → WIP → `i-dev` 머지 → `main` 머지 → `pre-deploy` (main 기준 검증/빌드) → `deploy_command`.

## 프로젝트별 배포

- **Tteona** (FE): Vercel 배포. `pnpm build` 후 `vercel deploy --prod`.
- **Tteona-server** (BE): AWS 배포. 데이터크래프트 그룹과 동일한 **`aws-deploy` 브랜치 머지 배포 방식** — `pre-deploy` 가 `main` → `origin/aws-deploy` 로 push 하면 AWS 측이 해당 브랜치를 pull 하여 반영.

## env 관리

- `env_management: git-tracked` 의 실제 의미: 저장소에는 `.env.example` 템플릿만 추적되고, 실제 `.env` 파일은 `.gitignore` 대상이다. 각 배포 환경의 실제 시크릿 값은 수동으로 채운다 (Vercel env vars / AWS 측 설정). 실제 시크릿이 git 에 커밋되지는 않는다.

## 미확정 항목

- FE / BE 의 배포 `target` URL — 추후 `/group-policy Tteona` 로 보강. `pre-deploy` 실행 전까지 확정 필요.
