---
projects:
  - name: Pinlog
    role: FE
    tool: gh-pages
    target: https://team-pingus.github.io/PinLog-Web/
    build_command: pnpm build
    deploy_command: git checkout main && npx gh-pages -d dist
    env_management: manual
  - name: Pinlog-Server
    role: BE
    tool: aws
    target: TBD
    build_command: ./gradlew build
    deploy_command: TBD
    env_management: manual
---

# Pinlog — deploy 환경 규정

## FE 배포 (`Pinlog`) — 확정

- **GitHub Pages 배포**. GitHub 오너 = `Team-Pingus` (조직), 저장소 = `PinLog-Web`.
- `target` = `https://team-pingus.github.io/PinLog-Web/` (project pages — 오너 호스트는 소문자).
- 흐름: 작업 → i-dev 머지 → `main` 머지 → `pre-deploy` (main 기준 검증/빌드) → `deploy_command`.
- `deploy_command` 첫 단계 `git checkout main` — gh-pages CLI 가 `dist/` 산출물을 `gh-pages` 브랜치에 force-publish (GitHub Pages 제약상 불가피, 본 정책 위반 아님 — 소스 브랜치는 `main`).
- ⚠ **후속 코드 과제**: `vite.config.ts` 에 현재 `base` 미설정 (기본값 `/`). project pages 배포에는 `base: '/PinLog-Web/'` 필요 — 미수정 시 배포본의 정적 자산 경로가 깨짐. 이는 FE 저장소 코드 수정이므로 group-policy 범위 밖. `plan-enterprise` 또는 핫픽스로 별도 진행.

## BE 배포 (`Pinlog-Server`) — 부분 확정

- **tool = aws** 확정 (EC2 등). Docker 미사용.
- `target` (인스턴스/도메인) 과 `deploy_command` 는 **TBD** — AWS 인프라 구체값 미정. 인프라 구축 후 `/group-policy Pinlog` 재호출로 채움.
- 이 상태에서 `pre-deploy Pinlog-Server` 호출 시 deploy-validator 가 `deploy_command` 부재로 차단함.
- `build_command` = `./gradlew build` (Spring Boot fat JAR → `build/libs/*.jar`).

## 배포 우선순위

- **서버(`Pinlog-Server`) 우선**. FE 가 BE API 스키마/엔드포인트에 의존하므로 server 먼저 배포 후 `Pinlog` 배포.

## env 관리

- 양쪽 `manual` (각 저장소 운영자 수동 관리). 추후 secret-manager 도입 시 본 문서 갱신.
- 본 정책 파일에는 시크릿 비적재.

## 후속 보강

- BE AWS `target` + `deploy_command` 확정 (`/group-policy Pinlog` 재호출).
- FE `vite.config.ts` `base` 경로 수정 (별도 코드 과제).
