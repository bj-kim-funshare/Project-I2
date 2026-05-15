# Tteona — Patch Note (001)

## v001.2.0 — 단계0 인프라 동기 코드드롭

> 통합일: 2026-05-15
> 플랜 이슈: bj-kim-funshare/Tteona#1
> 매니페스트 호스팅 노트: skill spec 의 "leader repo 의 patch-note" 경로는 Project-I2 매니페스트 호스팅 사실과 충돌하여 본 엔트리는 I-OS (Project-I2) `main` 브랜치 위에 작성됨. 차회 plan-enterprise tteona 부터 동일 패턴.

### 페이즈 결과
- **Phase 1** (chore, Tteona): `sketch.css` 를 레퍼런스 전용으로 표식 — 토큰 4종 (`--secondary-soft / --accent-soft / --warn-soft / --overlay-dim`) 이 이미 `src/app/globals.css` 에 이관 완료 (각 ≥ 4 회) 확인 후 canonical 경로 `tteona-claude-code-handoff/03-design/wireframes/styles/sketch.css` 상단에 "디자인 레퍼런스 전용 — 런타임 미사용" 주석 6행 추가. 커밋 `e31c045`.
- **Phase 2** (feat, Tteona): `src/app/` 에 라우트 그룹 5종 ((auth)/(buyer)/(seller)/(system)/(social)) 골격 추가 — 각 그룹별 `layout.tsx` (pass-through, `{ children: React.ReactNode }` 명시) + S2 TODO placeholder `page.tsx`. 커밋 `741044a`.
- **Phase 3** (feat, Tteona): `src/components/common/` 에 `AppShell` / `TopBar` / `BottomTabBar` 골격 컴포넌트 추가 — plain HTML + Tailwind v4 토큰만 (shadcn primitives 미사용), `BottomTabBar` 는 정확히 4 탭 (buyer/seller/social/system, auth 미포함), `role="tablist"` 등 ARIA 적용, `index.ts` 배럴. 커밋 `a95a584`.
- **Phase 4** (feat, Tteona): API client 인프라 — `zod` 4.4.3 추가, `src/lib/env.ts` (NEXT_PUBLIC_* zod URL 검증 + freeze), `src/lib/api/{client,errors,index}.ts` (apiFetch: 매 시도 새 AbortController + 8s timeout, 5xx/네트워크 최대 2회 지수 백오프 250/750ms, 4xx 즉시 throw, `credentials: 'include'` 기본, `sessionToken → Authorization: Bearer`, `ApiError/ApiTimeoutError/ApiNetworkError` 클래스). 커밋 `3c0d6f6` + 후속 `.env.example` 보완 `17e08cd`.
- **Phase 5** (feat, Tteona-server): `hono/cors` 미들웨어를 `src/app.ts` 의 honoLogger 다음, requestLogger 이전 위치에 삽입 — origin 콜백이 `config.corsOrigins` 화이트리스트 검사, `credentials: true`, `allowHeaders: [Authorization, Content-Type]`, `allowMethods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]`, `maxAge: 600`. `src/lib/config.ts` zod schema 에 `CORS_ORIGINS` 추가 (default `http://localhost:3000`), `corsOrigins: string[]` split-trim 노출. `.env.example` 에 `CORS_ORIGINS` 라인 추가. 커밋 `7b5a5d4`.

### 영향 파일

**Tteona (FE)**:
- `tteona-claude-code-handoff/03-design/wireframes/styles/sketch.css`
- `src/app/(auth)/layout.tsx`, `src/app/(auth)/page.tsx`
- `src/app/(buyer)/layout.tsx`, `src/app/(buyer)/page.tsx`
- `src/app/(seller)/layout.tsx`, `src/app/(seller)/page.tsx`
- `src/app/(system)/layout.tsx`, `src/app/(system)/page.tsx`
- `src/app/(social)/layout.tsx`, `src/app/(social)/page.tsx`
- `src/components/common/AppShell.tsx`, `src/components/common/TopBar.tsx`, `src/components/common/BottomTabBar.tsx`, `src/components/common/index.ts`
- `src/lib/env.ts`, `src/lib/api/client.ts`, `src/lib/api/errors.ts`, `src/lib/api/index.ts`
- `package.json`, `pnpm-lock.yaml`, `.env.example`

**Tteona-server (BE)**:
- `src/app.ts`, `src/lib/config.ts`, `.env.example`

### 검증

- 모든 5 페이즈 lint/typecheck 게이트 통과 (`pnpm lint` FE, `pnpm typecheck` BE 모두 exit 0).
- advisor 5-관점 (Intent/Logic/Group Policy/Evidence/Command Fulfillment) 계획·완료 시점 양측 PASS.

## v001.1.0 — Commit&Push 대기중
