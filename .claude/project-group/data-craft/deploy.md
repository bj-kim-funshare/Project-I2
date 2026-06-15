---
projects:
  - name: data-craft
    role: FE
    tool: gh-pages
    target: https://funshare-inc.github.io/data-craft/
    build_command: pnpm build
    deploy_command: git checkout main && npx gh-pages -d dist
    env_management: code-constants
  - name: data-craft-mobile
    role: FE
    tool: gh-pages
    target: https://bj-kim-funshare.github.io/data-craft-mobile/
    build_command: pnpm build
    deploy_command: git checkout main && npx gh-pages -d apps/web/dist
    env_management: code-constants
  - name: data-craft-ai-preview
    role: FE
    tool: gh-pages
    target: https://funshare-inc.github.io/data-craft-ai-preview/
    build_command: npm run build
    deploy_command: git checkout main && npx gh-pages -d dist
    env_management: code-constants
  - name: data-craft-server
    role: BE
    tool: other
    target: https://d3u7b7cxusjkuc.cloudfront.net
    build_command: pnpm build
    deploy_command: git checkout main && git push origin main:aws-deploy
    env_management: git-tracked
  - name: data-craft-admin
    role: FE
    tool: none
    deploy_excluded: true
    build_command: pnpm build
    env_management: code-constants
  - name: data-craft-admin-server
    role: BE
    tool: none
    deploy_excluded: true
    build_command: pnpm build
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

- **`data-craft-admin` / `data-craft-admin-server` (관리자 콘솔, Roadmap-7 신규) — 배포 제외**(`deploy_excluded: true`, `deploy_command` 미부여, `tool: none`). 운영자 로컬에서 `pnpm dev` 로만 기동하는 콘솔이라 `pre-deploy` / `deploy_command` 대상이 아니다. `pre-deploy` 호출 시 본 2종은 배포 타깃에서 제외. (마스터 명시 — Roadmap-7)
- `data-craft` (리더), `data-craft-ai-preview` (프리뷰), `data-craft-mobile` (모바일) — GitHub Pages 배포.
- `data-craft-mobile` 은 **플러터 셸 안착 전까지 한시적 gh-pages 배포** (마스터 명시). 안착 후 Flutter WebView Shell 번들 형태로 재정의 예정 — 재정의 시 본 문서 갱신.
- 모바일 빌드 산출물 = `apps/web/dist/` (확정 — 루트 `pnpm build` 시 apps/web 에 dist 생성).
- 모바일 GitHub owner 는 개인 계정 `bj-kim-funshare` (나머지 3개는 조직 `funshare-inc`).
- 모바일 base 처리 (v001.449.0 검증 확정): `apps/web/vite.config.ts` 가 `base: mode === 'production' ? '/data-craft-mobile/' : '/'` 로 조건부 base 적용 중. 프로덕션 빌드 시 `dist/index.html` 에 `/data-craft-mobile/...` 경로로 출력되어 gh-pages project pages 호환. 루트 `vite.config.ts` 의 `base: '/'` 는 `pnpm dev` (포트 5174) 용으로 별개 — 빌드 산출물에 영향 없음.
- `data-craft-server` — AWS EC2 (또는 유사). Docker 미사용. **부분 자동 타겟**. `pre-deploy` 가 자동 수행: (1) main 기준 검증, (2) `pnpm build`, (3) `main` → `aws-deploy` 브랜치 fast-forward push. 이후 마스터가 EC2 인스턴스에 SSH 접속하여 `git pull && pnpm build && pm2 restart` 수동 실행 (AWS 측이 `aws-deploy` 브랜치를 pull).

## 배포 우선순위

- **서버 (`data-craft-server`) 가 항상 우선**. FE 의존 변경(API 스키마 변경 등) 이 있을 시 server 먼저 배포 후 FE 배포.
- FE 3종 (data-craft / mobile / ai-preview) 간 우선순위는 미정 — 변경 영역에 따라 master 판단.

## env 관리

> **env_management 값 의미 (2026-06-15 정정 — 역할별 구분)**. 기존 전 타겟 `git-tracked` 오선언이 deploy-validator 의 FE false-block 을 유발해 바로잡음.

- **`git-tracked`** (BE — `data-craft-server`, `data-craft-admin-server`): 비시크릿 런타임 `.env` 를 git 에 커밋한다. 환경별 차등 값은 `{NAME}`/`{NAME}_PROD` 페어 + `NODE_ENV` 분기 (dev.md §"env 페어 패턴"). (`data-craft-admin-server` 는 추가로 `ADMIN_JWT_SECRET` + dev/prod 토글 풀 + `.env.local` 분리 운영 — db.md 참조.)
- **`code-constants`** (FE/클라이언트 — `data-craft`, `data-craft-mobile`, `data-craft-ai-preview`, `data-craft-admin`): **prod 배포 산출물이 git-tracked `.env` 를 요구하지 않는다.** 시크릿(`VITE_TOSS_CLIENT_KEY`·`VITE_DEV_*`·`VITE_ADMIN_*`)을 보유하므로 `.env` 는 gitignore 하고(dev.md §보안정책 정합), dev 값은 gitignored `.env.local`, `.env.example` 은 커밋된 키 템플릿이다. 타겟별 prod 설정 출처:
  - `data-craft`: `src/shared/config/env.ts` `resolveUrl` 이 PROD 빌드에서 localhost/`.local`/사설IP 를 `PRODUCTION_API_URL`(CloudFront)로 강제 → 빌드 env 없이 prod URL 정합.
  - `data-craft-mobile`: Flutter — `lib/config/web_config.dart` 코드 상수 구동(env 파일 없음).
  - `data-craft-ai-preview`: 배포 = `vite build` 정적 클라이언트(`dist`), vite.config 가 env 주입을 제거(SEC-DC-011, 번들 유출 차단) → 배포 산출물은 빌드 env 미사용. `.env.example` 의 `SMTP_*`/`GEMINI_API_KEY` 는 dev 서버(`tsx server.ts`, dotenv)용이지 gh-pages 배포 산출물의 일부가 아니다.
  - `data-craft-admin`: `deploy_excluded`(운영자 로컬 `pnpm dev` 전용) — `VITE_ADMIN_*` 를 gitignored 로컬 env 로 주입, 배포 대상 아님.
- **deploy-validator 규칙**: `code-constants` 타겟에서는 **git-tracked `.env` 부재를 배포 차단(block) 사유로 올리지 않는다.** (백스톱: pre-deploy Branch B 는 `build_command` 실패 시 halt 하므로 env 가 실제 필요한데 빠진 경우는 빌드에서 잡힌다.)
- **PROD psql 컷오버 (Roadmap-6 PROD-1) — BE prod 배포 env 요건**: 컷오버 후 `data-craft-server` 는 **단일 pg 엔진**(#258, `DB_ENGINE` 토글 없음)으로 prod psql 에 접속한다. EC2(aws-deploy) `.env` 에 prod psql 좌표를 `_PROD` 페어로 주입 필수: `PG_HOST_PROD`/`PG_USER_PROD`/`PG_PASSWORD_PROD`(`PG_PORT` 는 5432 단일) + `DB_NAME_PROD`= psql DB명(`postgres`). ⚠️ **선행**: `constant.ts` 의 PG 좌표 `_PROD` 분기 코드가 미구현이라(db.md §전환 상태 "선행 코드 갭"), 이 코드 반영 + EC2 `.env` 주입이 **프롬프트 5 배포보다 먼저** 끝나야 prod BE 가 올바른 prod psql 로 접속한다(미반영 시 dev psql 로 오접속). 레거시 `DB_*`(MySQL) env 는 롤백 윈도우 동안 보존 후 폐기.

## 서버 인프라 메모

- `data-craft-server` 의 `target` = CloudFront 분포 (`https://d3u7b7cxusjkuc.cloudfront.net`). EC2 인스턴스 앞단에 CloudFront 가 배치된 구조.
- 리더 저장소 (`data-craft`) 의 `src/shared/config/env.ts` 에 `PRODUCTION_API_URL` / `PRODUCTION_STORAGE_URL` 동일 값으로 참조됨.
- `.env.example` 의 `VITE_API_BASE_URL` / `VITE_BASE_STORAGE_URL` 도 동일 호스트로 명시.
