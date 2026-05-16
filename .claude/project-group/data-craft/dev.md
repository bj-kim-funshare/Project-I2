---
targets:
  - name: data-craft
    cwd: /Users/starbox/Documents/GitHub/data-craft
    role: FE
    type: monorepo
    dev_command: pnpm dev
    port: 5173
    cache_paths: []
    lint_command: pnpm typecheck:all && pnpm lint
  - name: data-craft-mobile
    cwd: /Users/starbox/Documents/GitHub/data-craft-mobile
    role: FE
    type: monorepo
    dev_command: pnpm dev
    port: 5174
    cache_paths: []
    lint_command: pnpm typecheck
  - name: data-craft-ai-preview
    cwd: /Users/starbox/Documents/GitHub/data-craft-ai-preview
    role: FE
    type: project
    dev_command: npm run dev
    port: 3000
    cache_paths: []
    lint_command: npm run lint
  - name: data-craft-server
    cwd: /Users/starbox/Documents/GitHub/data-craft-server
    role: BE
    type: project
    dev_command: pnpm dev
    port: 8000
    cache_paths: []
    lint_command: pnpm lint
---

# data-craft — dev 환경 규정

## env 정책 (4개 공용)

- 단일 `.env` 정책: 4개 저장소 전부 동일한 env 사용. 개발 / 프로덕트 공용. 모든 브랜치 공유.
- env 파일은 각 저장소에서 **git-tracked** (마스터 명시 정책).
- 본 정책 파일에는 시크릿 값을 적재하지 않음 (I2 harness 별도 저장소이므로).

## env 환경별 차등 변수 표준 — BE 페어 패턴 (BE 운영 표준 — v001.143.0 도입)

단일 git-tracked `.env` 정책 (위 절) 위에 환경별로 값이 달라야 하는 변수는 `data-craft-server` (BE, Node 런타임) 에서 다음 페어 패턴으로 운영한다.

### 명명 규칙
- 공통 / dev fallback: `{NAME}`
- prod-only: `{NAME}_PROD`

### 코드 분기
`process.env.NODE_ENV === 'production'` 일 때 `{NAME}_PROD` 채택, 그 외 `{NAME}` 폴백.

### 미설정 가드
prod 환경에서 `{NAME}_PROD` 미설정 시 `{NAME}_PROD_NOT_CONFIGURED` 식별자로 즉시 throw — dev 값으로의 사일런트 회귀 차단. 구현체는 application-internal error class (예: data-craft-server `InternalServerError`).

### 도입 사례
- v001.143.0 (#83): `data-craft-server/src/services/email.service.ts` `getFrontendUrl()` — `FRONTEND_URL` / `FRONTEND_URL_PROD` 페어, `FRONTEND_URL_PROD_NOT_CONFIGURED` throw. `.env` 에 `FRONTEND_URL_PROD=https://datacraft.ai.kr` 추가, dev 값 `FRONTEND_URL=http://localhost:5173` 은 양측 보존 통합본 (v001.142.0 / #82) 그대로 유지.

### 신규 변수 추가 체크리스트
1. `.env` 에 `{NAME}` + `{NAME}_PROD` 두 줄 추가 (양측 보존 통합본 원칙 — 모든 멤버 레포 + EC2 동기).
2. 코드 사용 지점에 NODE_ENV 분기 + 미설정 가드 throw 도입.
3. 정적 토큰 매칭 e2e 테스트 추가 권장 (`{NAME}_PROD_NOT_CONFIGURED` / `process.env.NODE_ENV === 'production'`) — 회귀 방지.

### 비-차등 변수
`SERVER_URL=0.0.0.0` 처럼 모든 환경에서 동일 값으로 동작하는 항목은 페어 분리 불필요 — 단일 라인 유지 (v001.142.0 선택 사례).

## 포트 정책 (확정)

- `data-craft` = 5173 (Vite 기본).
- `data-craft-mobile` = 5174 (리더와 충돌 회피, 마스터 명시 지정).
- `data-craft-ai-preview` = 3000 / `data-craft-server` = 8000.

## lint 정책 (확정)

- `data-craft` lint gate = `pnpm typecheck:all && pnpm lint` (직렬 — 타입체크 + eslint 둘 다, 마스터 명시).
- 타입체크 실패 시 eslint 미실행 (직렬 `&&` 단락 평가).
- 나머지 3개 프로젝트 lint 는 기존 유지.

## 기타

- `data-craft`, `data-craft-mobile` 은 pnpm workspace + 모노레포 (`packages/`, `apps/`). `dev-build` 가 모노레포 선택 UI 노출.
- `data-craft-server` 는 `nodemon + ts-node` 기반. `SERVER_PORT=8000` env 변수 기반 (env 참조).
