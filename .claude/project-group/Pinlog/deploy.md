---
projects:
  - name: Pinlog
    role: FE
    tool: other
    target: TBD
    build_command: pnpm build
    deploy_command: TBD
    env_management: manual
  - name: Pinlog-Server
    role: BE
    tool: other
    target: TBD
    build_command: ./gradlew build
    deploy_command: TBD
    env_management: manual
---

# Pinlog — deploy 환경 규정

## 현재 상태 (v1 미확정)

본 그룹은 v1 등록 시점에 **배포 인프라 미확정**. `tool` / `target` / `deploy_command` 는 모두 `TBD` 로 표기 — `pre-deploy` 스킬은 이 상태에서 실행하면 deploy-validator 검증 단계에서 차단됨.

## 빌드 명령 (확정)

- `Pinlog` = `pnpm build` (Vite production 번들 → `dist/`).
- `Pinlog-Server` = `./gradlew build` (Spring Boot fat JAR → `build/libs/*.jar`).

## env 관리

- v1 = `manual` (각 저장소 운영자가 수동 관리). 추후 secret-manager 도입 시 본 문서 갱신.

## 후속 보강 (필수 — `/group-policy Pinlog` 로 진행)

- FE 호스팅 결정 (gh-pages / vercel / netlify / S3+CloudFront 등) → `tool` + `target` + `deploy_command` 채움.
- BE 호스팅 결정 (Docker / EC2 / Heroku / Render 등) → `tool` + `target` + `deploy_command` 채움.
- env 관리 정책 갱신 (manual → secret-manager 등).
