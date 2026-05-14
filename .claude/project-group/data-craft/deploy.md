---
projects:
  - name: data-craft
    role: FE
    tool: gh-pages
    target: https://funshare-inc.github.io/data-craft/
    build_command: pnpm build
    deploy_command: git checkout main && npx gh-pages -d dist
    env_management: git-tracked
  - name: data-craft-mobile
    role: FE
    tool: gh-pages
    target: https://bj-kim-funshare.github.io/data-craft-mobile/
    build_command: pnpm build
    deploy_command: git checkout main && npx gh-pages -d apps/web/dist
    env_management: git-tracked
  - name: data-craft-ai-preview
    role: FE
    tool: gh-pages
    target: https://funshare-inc.github.io/data-craft-ai-preview/
    build_command: npm run build
    deploy_command: git checkout main && npx gh-pages -d dist
    env_management: git-tracked
  - name: data-craft-server
    role: BE
    tool: aws
    target: https://d3u7b7cxusjkuc.cloudfront.net
    build_command: pnpm build
    deploy_command: git checkout main && git push origin main:aws-deploy
    env_management: git-tracked
---

# data-craft — deploy 환경 규정

## 공통 배포 정책

- **기준 브랜치 = `main`**. 모든 `deploy_command` 는 `main` 체크아웃을 첫 단계로 포함.
- 흐름: 작업 → i-dev 머지 → `main` 머지 → `pre-deploy` (main 기준 검증/빌드) → `deploy_command` (main → 각 타겟 deploy 브랜치).
- i-dev → deploy 브랜치 직접 push / force push **금지**.
- 예외: gh-pages CLI 가 `gh-pages` 브랜치에 산출물을 force-publish 하는 동작은 GitHub Pages 제약상 불가피 — 본 정책 위반 아님 (소스 브랜치는 어디까지나 `main`).
- **빌드 소스 정합성 메모**: `build_command` 는 `pre-deploy` 가 `deploy_command` 보다 먼저 호출하므로 현재 `deploy_command` 의 `git checkout main` 만으로는 "빌드도 main 소스" 가 보장되지 않는다. 빌드 소스 == main 보장은 `pre-deploy` 스킬의 entry check (후속 `plan-enterprise-os` 갱신) 에서 enforce 한다. 그 갱신 전까지는 운영자가 호출 시점에 main 체크아웃 상태였는지 직접 책임진다.

## 배포 전략 요약

- `data-craft` (리더), `data-craft-ai-preview` (프리뷰), `data-craft-mobile` (모바일) — GitHub Pages 배포.
- `data-craft-mobile` 은 **플러터 셸 안착 전까지 한시적 gh-pages 배포** (마스터 명시). 안착 후 Flutter WebView Shell 번들 형태로 재정의 예정 — 재정의 시 본 문서 갱신.
- 모바일 빌드 산출물 = `apps/web/dist/` (확정 — 루트 `pnpm build` 시 apps/web 에 dist 생성).
- 모바일 GitHub owner 는 개인 계정 `bj-kim-funshare` (나머지 3개는 조직 `funshare-inc`).
- ⚠️ **모바일 코드 경고**: `vite.config.ts` 의 `base: '/'` 가 gh-pages project pages 와 비호환. `/data-craft-mobile/` 로 변경 필요 (정책 외 — 코드 수정 사안. `plan-enterprise` 또는 수동 핫픽스).
- `data-craft-server` — AWS EC2 (또는 유사). Docker 미사용. **부분 자동 타겟**. `pre-deploy` 가 자동 수행: (1) main 기준 검증, (2) `pnpm build`, (3) `main` → `aws-deploy` 브랜치 fast-forward push. 이후 마스터가 EC2 인스턴스에 SSH 접속하여 `git pull && pnpm build && pm2 restart` 수동 실행 (AWS 측이 `aws-deploy` 브랜치를 pull).

## 배포 우선순위

- **서버 (`data-craft-server`) 가 항상 우선**. FE 의존 변경(API 스키마 변경 등) 이 있을 시 server 먼저 배포 후 FE 배포.
- FE 3종 (data-craft / mobile / ai-preview) 간 우선순위는 미정 — 변경 영역에 따라 master 판단.

## env 관리

- env 파일은 각 저장소에서 git-tracked. 단일 env 공유 (개발/프로덕트 분리 없음).

## 서버 인프라 메모

- `data-craft-server` 의 `target` = CloudFront 분포 (`https://d3u7b7cxusjkuc.cloudfront.net`). EC2 인스턴스 앞단에 CloudFront 가 배치된 구조.
- 리더 저장소 (`data-craft`) 의 `src/shared/config/env.ts` 에 `PRODUCTION_API_URL` / `PRODUCTION_STORAGE_URL` 동일 값으로 참조됨.
- `.env.example` 의 `VITE_API_BASE_URL` / `VITE_BASE_STORAGE_URL` 도 동일 호스트로 명시.
