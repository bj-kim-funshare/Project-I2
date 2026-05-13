---
projects:
  - name: data-craft
    role: FE
    tool: gh-pages
    target: https://funshare-inc.github.io/data-craft/
    build_command: pnpm build
    deploy_command: npx gh-pages -d dist
    env_management: git-tracked
  - name: data-craft-mobile
    role: FE
    tool: gh-pages
    target: https://bj-kim-funshare.github.io/data-craft-mobile/
    build_command: pnpm build
    deploy_command: npx gh-pages -d apps/web/dist
    env_management: git-tracked
  - name: data-craft-ai-preview
    role: FE
    tool: gh-pages
    target: https://funshare-inc.github.io/data-craft-ai-preview/
    build_command: npm run build
    deploy_command: npx gh-pages -d dist
    env_management: git-tracked
  - name: data-craft-server
    role: BE
    tool: aws
    target:
    build_command: pnpm build
    deploy_command:
    env_management: git-tracked
---

# data-craft — deploy 환경 규정

## 배포 전략 요약

- `data-craft` (리더), `data-craft-ai-preview` (프리뷰), `data-craft-mobile` (모바일) — GitHub Pages 배포.
- `data-craft-mobile` 은 **플러터 셸 안착 전까지 한시적 gh-pages 배포** (마스터 명시). 안착 후 Flutter WebView Shell 번들 형태로 재정의 예정 — 재정의 시 본 문서 갱신.
- 모바일 빌드 산출물 = `apps/web/dist/` (확정 — 루트 `pnpm build` 시 apps/web 에 dist 생성).
- 모바일 GitHub owner 는 개인 계정 `bj-kim-funshare` (나머지 3개는 조직 `funshare-inc`).
- ⚠️ **모바일 코드 경고**: `vite.config.ts` 의 `base: '/'` 가 gh-pages project pages 와 비호환. `/data-craft-mobile/` 로 변경 필요 (정책 외 — 코드 수정 사안. `plan-enterprise` 또는 수동 핫픽스).
- `data-craft-server` — AWS EC2 (또는 유사). Docker 미사용. **수동 배포 전용 — `pre-deploy` 자동 실행 대상 외**. 머지 후 마스터가 AWS 인스턴스에 SSH 접속하여 `git pull && pnpm build && pm2 restart` 수동 실행. `deploy_command` 는 의도적으로 빈값 (`pre-deploy` 가 자동 실행을 거부하도록).

## 배포 우선순위

- **서버 (`data-craft-server`) 가 항상 우선**. FE 의존 변경(API 스키마 변경 등) 이 있을 시 server 먼저 배포 후 FE 배포.
- FE 3종 (data-craft / mobile / ai-preview) 간 우선순위는 미정 — 변경 영역에 따라 master 판단.

## env 관리

- env 파일은 각 저장소에서 git-tracked. 단일 env 공유 (개발/프로덕트 분리 없음).

## 미확정

- `data-craft-server` 의 `target` (EC2 IP / 도메인) 미수집. `pre-deploy` 실행 전 마스터 확정 필요.
