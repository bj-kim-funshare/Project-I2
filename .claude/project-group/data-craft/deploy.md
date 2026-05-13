---
projects:
  - name: data-craft
    role: FE
    tool: gh-pages
    target:
    build_command: pnpm build
    deploy_command: npx gh-pages -d dist
    env_management: git-tracked
  - name: data-craft-mobile
    role: FE
    tool: gh-pages
    target:
    build_command: pnpm build
    deploy_command: npx gh-pages -d dist
    env_management: git-tracked
  - name: data-craft-ai-preview
    role: FE
    tool: gh-pages
    target:
    build_command: npm run build
    deploy_command: npx gh-pages -d dist
    env_management: git-tracked
  - name: data-craft-server
    role: BE
    tool: aws
    target:
    build_command: pnpm build
    deploy_command: 수동 — AWS 인스턴스 터미널에서 `git pull && pnpm build && pm2 restart`
    env_management: git-tracked
---

# data-craft — deploy 환경 규정

## 배포 전략 요약

- `data-craft` (리더), `data-craft-ai-preview` (프리뷰), `data-craft-mobile` (모바일) — GitHub Pages 배포.
- `data-craft-mobile` 은 **플러터 셸 안착 전까지 한시적 gh-pages 배포** (마스터 명시). 안착 후 Flutter WebView Shell 번들 형태로 재정의 예정 — 재정의 시 본 문서 갱신. 빌드 산출물 경로 미확정 (루트 `dist/` 가정 — 모노레포에 `apps/web`, `apps/flutter-shell` 존재하므로 실제 배포 산출물이 `apps/web/dist` 일 가능성 검증 필요).
- `data-craft-server` — AWS EC2 (또는 유사). Docker 미사용. 머지 후 마스터가 AWS 인스턴스에 SSH 접속하여 `git pull → pnpm build → pm2 restart` 수동 실행.

## env 관리

- env 파일은 각 저장소에서 git-tracked. 단일 env 공유 (개발/프로덕트 분리 없음).

## 미확정

- 모든 프로젝트의 `target` URL/호스트 미수집. `pre-deploy` 실행 전 마스터가 `/group-policy` 로 보충 권장.
