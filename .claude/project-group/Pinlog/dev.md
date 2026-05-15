---
targets:
  - name: Pinlog
    cwd: /Users/starbox/Documents/GitHub/PinLog-Web
    role: FE
    type: project
    dev_command: pnpm dev
    port: 5173
    cache_paths:
      - node_modules
      - dist
      - .vite
    lint_command: pnpm lint
  - name: Pinlog-Server
    cwd: /Users/starbox/Documents/GitHub/Pingus-Server
    role: BE
    type: project
    dev_command: ./gradlew bootRun
    port: 8443
    cache_paths:
      - build
      - .gradle
    lint_command: ./gradlew compileJava
---

# Pinlog — dev 환경 규정

## 구성 요약

- 2개 저장소 그룹 — FE 1 (Pinlog, React+Vite) + BE 1 (Pinlog-Server, Spring Boot).
- 리더 = `Pinlog` (PinLog-Web). targets[] 첫 항목 LOCK 준수.

## 포트 정책

- `Pinlog` = 5173 (Vite 기본).
- `Pinlog-Server` = 8443 (Spring Boot HTTPS — README / `bootRun` 기준).
- 두 포트 충돌 없음.

## lint 정책

- `Pinlog` lint gate = `pnpm lint` (eslint). 타입체크는 별도 — 추후 강화 시 `pnpm tsc --noEmit && pnpm lint` 형태로 갱신.
- `Pinlog-Server` lint gate = `./gradlew compileJava` (컴파일만 — 자바는 컴파일 자체가 사실상 lint). 본 명령이 실패하면 dev-merge 머지 차단.

## env 정책

- 본 정책 파일에는 시크릿 비적재 (I2 harness 별도 저장소).
- 각 저장소 env 관리 정책은 deploy.md / db.md 참조.

## 미확정 / 후속 보강

- FE 측 cache_paths 의 `.vite` 는 Vite v5+ 의 chunk 캐시. 실측 후 불필요하면 제거.
- BE 측 모듈 구조가 단일 모듈 (현재 `src/main/java`). 멀티모듈 전환 시 `type: monorepo` 로 갱신.
