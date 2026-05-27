# 데이터 크래프트 서버 (data-craft-server) — 버그 클래스

> Express 5 + TypeScript REST API. 컨트롤러는 서비스 위 thin CRUD 로 일관된 try/catch+errorCatch(Express 5 에러 미들웨어로 re-throw, 올바름). 검증 VS-1: 6건 전부 CONFIRMED(도달성 포함).

---

## SRV-A-001 (high · bug) — 빌더 page/form/widget 편집 라우트가 forceIncludeAuth 없이 권한 체크 → req.user undefined → 소유자도 거부
- 파일: `src/routes/builder.ts:43` (page/form/widget 라우트군 L39-63)
- `permissionCheckMiddleware`(permission.middleware.ts:328,333)는 `req.user?.isOwner`/`req.user?.permissions` 만 읽음. `req.user` 는 full-auth 경로(includeAuth=true OR forceIncludeAuth)에서만 채워짐(auth.middleware.ts:76,162). light-auth 모드에선 `req.isOwner` 는 설정되나 `req.user` 는 undefined. 빌더 mutation 라우트(saveLayout/createPage/updatePage/deletePage/duplicatePage/create·update·deleteForm/widget 라우트)가 `permissionCheckMiddleware('design_page_edit')` 를 **forceIncludeAuth 없이** 부착 → 기본 light 경로에서 req.user undefined → isOwner short-circuit 실패 → userPermissions=[] → hasPermission=false → ForbiddenError. 소유자·편집자 차단(핵심 빌더 편집 fail-closed). **의도 아님 입증**: roles.ts 전체, auth.ts:218, subscription.ts, promotion.routes.ts, 그리고 같은 builder.ts 의 settings CUD(L70-73) 까지 모든 권한 라우트가 forceIncludeAuth 페어 사용. page/form/widget 블록만 누락. app.ts:135 가 /api 를 forceIncludeAuth 없는 authMiddleware 뒤에 마운트해 도달성 확인.

## SRV-A-002 (low · bug) — `validate()` 가 Express 5 frozen req.query 재할당 시 TypeError (현재 미배선 latent)
- 파일: `src/middlewares/validate.middleware.ts:20`
- L20 `req[target] = result.data`. Express 5 의 req.query 는 getter-only(코드 자체가 auth.middleware.ts:73,264 에 명시). target='query' 호출 시 'Cannot set property query' throw → 미처리 500. body/params 는 무영향. grep 결과 validate() 는 export 되나 어떤 라우트에도 import/배선 안 됨, 'query' target 호출 없음 → latent 정정 트랩(다음 호출자 위험).

## SRV-B-001 (high · bug) — `unhandledRejection` 핸들러가 임의 백그라운드 promise reject 에 서버 전체 종료
- 파일: `src/index.ts:155`
- 두 `process.on('unhandledRejection')` 등록. 첫(L15)은 로그만, 둘째(L155)는 `gracefulShutdown('unhandledRejection')` → HTTP 종료·SSE heartbeat 중지·10s hard `process.exit(1)` 무장. Node 가 모든 리스너 발화하므로 shutdown 핸들러 항상 실행. cron·fire-and-forget `.catch` 체인 등 백그라운드 async 가 언제든 unhandled rejection 생성 가능 → 단 한 건의 stray rejection 이 전 테넌트 서버를 다운. unhandledRejection 은 로그(+알림)여야지 치명적 shutdown 트리거가 아님.

## SRV-B-002 (medium · bug) — 중복 `uncaughtException` 핸들러 — 첫 핸들러의 process.exit(1)이 graceful shutdown 선점
- 파일: `src/index.ts:19`
- 두 `uncaughtException` 핸들러. 첫(L19)은 로그 후 즉시 `process.exit(1)`, 둘째(L150)는 graceful drain. 리스너는 등록 순 발화 → L19 가 동기 종료해 L150 graceful 경로가 dead code, in-flight 요청 드롭. 둘 중 하나 제거 필요(의도=graceful 이 eager exit 로 무효화).

## SRV-B-003 (medium · bug) — DB 저장 `sub_grid_shared_config` 무가드 `JSON.parse` → malformed JSON 에 요청 크래시
- 파일: `src/models/subGridData.model.ts:137` (및 :208)
- `getParentSubGridConfig`/`updateParentSubGridConfig` 가 `JSON.parse(rawConfig)` 를 try/catch 없이 호출. 손상/비-JSON 텍스트(레거시·부분 write·수동 편집) 시 SyntaxError 가 미처리 500 으로 전파, sub-grid config 읽기/갱신 중단. 형제 파싱 사이트(paging.calendar.ts:57, aggregation.distribution.ts:148, dataLink.service.ts:34, subGridData.service.ts:64) 전부 try/catch — 이 둘만 아님. → SYS-005.

## SRV-B-004 (medium · bug) — `buildFilterWhereClause` 가 컬럼명을 backtick 이스케이프 없이 식별자에 보간 (형제 빌더와 불일치)
- 파일: `src/models/viewerPaging.whereclause.ts:141`
- `pv.\`${columnName}\`` 를 backtick 스트립 없이 임베드. 형제 빌더(buildSearchWhereClause:115, buildMultiSearchWhereClause:257, buildMultiExternalFilterWhereClause:324)는 `columnName.replace(/\`/g,'')` 방어 적용. 컬럼명은 사용자 정의라 backtick 포함 시 따옴표 식별자 탈출 → SQL 식별자 손상/주입(값 측은 파라미터화, 식별자는 아님). 분기 자체가 버그. *(검증 메모: 원 보고가 escaped 형제로 인용한 buildExternalFilterWhereClause:227 은 그 자체도 미이스케이프였음 — 그러나 다른 5개 진성 이스케이프 사이트 대비 분기 성립, L141 결함 불변.)*

---

### 검증/양호 (no-pad)
controllers 는 thin CRUD + 일관 errorCatch re-throw(올바름). billing transaction/보상 로직, SAVEPOINT allowlisting, charge() SEC-SRV-45 order-id 검증, WHERE LIKE-escaping 건전. getConnection/release 균형(viewer.paging.aggregation.ts 의 3/4 는 finally 전부 release — 네이밍 false positive). resetPassword timingSafeEqual no-op, change.viewerConfig 무가드 parse(per-update SAVEPOINT catch 보호) 등은 임계 미만 제외.
