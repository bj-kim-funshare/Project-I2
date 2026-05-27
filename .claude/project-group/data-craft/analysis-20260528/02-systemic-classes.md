# 체계적 결함 클래스 (Pass 1.5 횡단 grep)

> 개별 스코프 서브에이전트는 자기 슬라이스만 보므로 임계치 미만으로 누락되는 횡단 패턴이 있다. 두 레포 전체 grep 으로 결함 클래스를 전수 집계한다. 카운트는 본 세션 main 이 `data-craft/src` + `data-craft/packages` + `data-craft-server/src` (dist/node_modules 제외) 전 범위에서 재집계해 확정한 수치다.

---

## SYS-001 (high) — `createDateValue` toISOString off-by-one 이 3개 뷰어 포크 전부에 복제

`createDateValue` 는 `fs-data-viewer`(L249), `fs-sub-data-viewer`(L226), `fs-external-data-viewer`(L226) 에 **동일하게** 정의되어 있다. `date.toISOString().split('T')[0]` 가 UTC 기준이라 KST(UTC+9) 로컬 자정 Date 를 전날로 민다. 정본 한 곳만 고치면 형제 둘이 latent 로 남는다. 현재 KST 동일 존 write→read 라 마스킹. → 정본 발견 DCV-2-001 과 동일 결함이 dedup-inheritance 로 3곳 전파.

## SYS-002 (high) — Rules-of-Hooks 위반이 3개 중 2개 포크에 존재

`ServerPagingOverlay.tsx` 가 `fs-sub-data-viewer`(L22/24)·`fs-external-data-viewer`(L23/25) 에서 nullable prop 조건부 early-return 을 useState/useEffect **앞에** 두고 `eslint-disable react-hooks/rules-of-hooks` 로 억제. prop 이 null↔value 토글 시 훅 카운트 변동 → 크래시. 정본은 disable 없음(올바른 순서). 메모리 `feedback_react_guard_after_hooks.md` 가 정확히 이 클래스. → 상세 SUB-DIFF-B-001(23 문서).

## SYS-003 — (검증 결과 BENIGN, 제외)

`ActionSelector.tsx:19` 의 rules-of-hooks disable 는 3개 포크 전부에 존재하나, VS-4 검증 결과 `useI18n()` 을 감싼 커스텀 훅 `_useI18nButton` 을 **무조건 호출**하는 구조이고 disable 은 언더스코어 접두 명칭이 린트 탐지를 무력화한 데서 비롯된 것. 조건부 훅 아님, 포크 간 분기도 아님 → **버그 아님, 최종 목록에서 제외.**

## SYS-004 (medium) — `react-hooks/exhaustive-deps` 억제 297건 = 체계적 stale-closure 위험 표면

앱+패키지 전반 297개 `exhaustive-deps` disable. 각각 컴파일러의 stale-closure/누락 의존성 가드를 끈다. Pass-1 의 FileUploader 토스트 타이머 리셋(APP-C-001), 검증 에러 effect 등이 이 클래스의 개별 인스턴스. 297개가 전부 버그는 아니나(다수는 의도적 run-once), 볼륨상 통계적으로 결함이 존재하며 개별 리뷰 없이는 탐지 불가. **권고**: effect 본문이 캡처된 prop/state 기반으로 setState/타이머를 거는 서브셋만 트리아지.

## SYS-005 (medium) — 가드 없는 `JSON.parse` (전체 161개 사이트)

전체 161개 `JSON.parse` 호출. SRV-B 가 `sub_grid_shared_config` 의 무가드 2건(poison-row 500)을 확정. FE 뷰어 패키지는 영속 config blob(컬럼 config, 셀 스타일, 대시보드 레이아웃)을 파싱하므로, try/catch·typeof-string 가드가 없는 사이트는 손상/레거시 값에서 throw → 렌더/저장 경로 크래시. 코드베이스 관례가 가드이므로 무가드는 불일치. **권고**: 161개 전수 후 미가드 사이트 가드.

> 검증 메모: VS-3 가 좁은 스코프(fs-data-viewer 한정)에서 141 로 재집계했으나, main 의 전 범위 재집계는 **161 로 확정**. 서버 파일 `subGridData.model.ts` 도 실제 존재 확인. 원 카운트 유지(상세 90 문서의 카운트 조정 항목 참조).

## SYS-006 (low) — double-cast(`as unknown as`) 가 타입 안전성 우회 (83개 사이트)

전체 83개 `as unknown as` + 7개 `as any`. DCV-5-001(`useUserCellCounts` 가 존재하지 않는 `userId`/`cells` 읽어 배지 항상 0)이 바로 `as unknown as PreprocessedRow` 가 shape 불일치를 숨긴 사례. 나머지 82개도 런타임에 존재하지 않는 필드를 읽을 동일 위험. **권고**: 데이터 매핑/렌더 경로의 double-cast 표적 리뷰. (`as any` 7개 카운트는 검증 일치, `as unknown as` 83 도 main 전 범위 재집계로 확정.)

---

## 다크모드 회귀 카탈로그 (Pass 2 의 체계적 상위 집합)

뷰어의 다크모드 아키텍처는 색을 `semanticColors → 인라인 var()` 로 흘린다(메모리 `feedback_data_craft_darkmode_color_architecture.md`). 따라서 뷰어 안에서 `.dark` 페어 없이 하드코딩된 Tailwind light 색 유틸은 테마에 반응하지 못하는 **회귀 후보**다.

- `fs-data-viewer/src` 내 `(bg|text|border)-(white|gray|slate|...)-(50|100|200|300|700|800|900)` 중 같은 줄에 `dark:` 없는 사이트: **1,049건 (상한 카탈로그)**. 다수는 의미적 래퍼(`text-muted-foreground` 등) 안이라 안전하므로 상한값이며, 원시 카탈로그는 분석 작업물로 보존됨.
- 앱 `src` 동일 패턴: **222건**.

Pass 2 가 개별 확정한 다크모드 회귀(UX-1-001~003, UX-2-004/005, UX-3-001/002/003/005/006, UX-4-001/002)는 이 카탈로그의 **확인된 표본**이다. 즉 다크모드 결함은 보고된 ~12건보다 훨씬 체계적이며, 근본 수정은 뷰어 색 소스를 var() 기반 토큰으로 전환하는 것이지 개별 컴포넌트 패치가 아니다.

> ⚠️ lint/build 는 렌더를 보지 못하므로 이 클래스는 자동 게이트로 잡히지 않는다(메모리 동일 경고).

### 원시 카탈로그의 위치 (재생성 안내)
본 분석의 원시 카탈로그(`manifest.tsv`, `darkmode-hardcoded-raw.txt`, `server-routes-raw.txt`, `fe-fetchers-raw.txt`, `consolidated-pass{1,2,3}.json`, `verification-results.json` 등)는 **본 세션의 임시 작업 디렉터리($CLAUDE_JOB_DIR)에 존재하며 잡 종료 시 소멸**한다. 다크모드 카탈로그 재생성:
```
grep -rEn "(bg|text|border)-(white|gray|slate)-(50|100|200|700|800|900)" \
  data-craft/packages/fs-data-viewer/src --include='*.tsx' | grep -v "/dist/" | grep -v "dark:"
```
체계적 카운트(JSON.parse=161, as unknown as=83, exhaustive-deps=297, rules-of-hooks=8)는 90 문서의 재집계 범위(`data-craft/src` + `data-craft/packages` + `data-craft-server/src`, dist/node_modules 제외)로 재현 가능.
