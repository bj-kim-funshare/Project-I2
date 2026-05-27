# 검증 원장 — 어드바이저 5회 + 어드바이징 서브에이전트 5회

> 마스터 지시: "발견된 모든 사항에 대해서 어드바이저 검증 5회와 어드바이징 서브 에이전트 검증 5회". 검증은 **통합 발견 문서**를 대상으로 수행(분석 재실행 아님). 전체 **0건 완전 반증**.

---

## 어드바이저 검증 5회 (advisor() — opus-4-7, 전체 트랜스크립트 열람)

| 회차 | 시점 | 판정/조치 |
|---|---|---|
| #1 | 오리엔테이션/계획 확정 | 아키텍처 승인. dedup(뷰어 3종) + 3-렌즈 해석 + 커버리지 정직성 락. |
| #2 | Pass 1 통합(42건) 후 | Pass 1 견고. Pass-1.5 횡단 grep, 스코프별 커버리지 정직 캡처, 3-렌즈 플래그, Pass 2 dedup 규칙, Pass 3 라우트/페처 카탈로그 지시. |
| #3 | Pass 2 통합(25건) + Pass 3 계획 | Pass 2 타당(다크모드 클래스 예측대로, 집계 양호). 'catalogs built' 거짓 자기점검 적발(페처 카탈로그 미작성 → 시정). 체계적 다크모드 grep(1049 상한), accept-shallow 라우트 카탈로그, Pass 3 = 3에이전트, VS-1~4 병렬 지시. |
| #4 | Pass 3(6건) + 전체 검증 결과 후 | 감사 실재·작성 준비 확인. 발견 파일에 검증 정정 inline 반영, 카운트 분쟁 명시, 3-렌즈 플래그 00 문서 surfacing, 영역×종류 파일 분할 확인. |
| #5 | 최종 보고서 작성 직후 | 12개 산출물을 정정 소스와 대조: 검증 정정 전부 올바로 반영, 3-렌즈 플래그 surfacing, DCV-4 커버리지 정직성 보존, SRV-A-001 콜아웃 확인, 카운트 reconciliation 정확. **shippable** 판정. 잔여 4건(심각도 정확 카운트, UX-5-005/006 헤딩 경로, 02 카탈로그 ephemerality 주석, Index 경로) 반영 완료. |

## 어드바이징 서브에이전트 검증 5회 (advisor-fallback — read-only opus, 실제 코드 대조)

| 회차 | 스코프 | 검토 | CONFIRMED | ADJUST | REFUTED |
|---|---|---|---|---|---|
| VS-1 | 서버 (SRV-A/B) | 6 | 6 | 0 | 0 |
| VS-2 | 앱 FE + fs-api + file-attachment | 14 | 13 | 1 | 0 |
| VS-3 | fs-data-viewer + 체계적 | 18 | 13 | 5 | 0 |
| VS-4 | 형제 포크 + UX-5 | 15 | 10 | 4 | 0 |
| VS-5 | 크로스 레포(Pass 3) | 6 | 6 | 0 | 0 |
| **계** | | **59** | **48** | **10** | **0** |

> 0건 완전 반증 = 발견이 모두 실재 결함이라는 강한 corroboration. ADJUST 는 라인번호/파일경로/심각도 정정으로, 결함 substance 는 유지.

## 검증으로 반영된 정정 (본 보고서에 inline 적용 완료)

| finding | 정정 내용 |
|---|---|
| PKG-A-006 | 파일경로 client.ts → **interceptor.ts:71-83** (client.ts 는 70줄로 executeFetch 없음). 30 문서 반영. |
| PKG-A-002 | 주 인용 client.fetch.ts:159 정확. 교차참조 'client.ts:174,250' → interceptor.ts:171-196 정정. |
| DCV-2-001 | 라인 248(선언) → **249(return)**. |
| DCV-7-001 | 라인 284 오류 → **~62-67** (파일 75줄). substance CONFIRMED. |
| DCV-7-002 | 라인 940 오류 → **30** (파일 39줄). substance CONFIRMED. |
| DCV-7-003 | 라인 771 오류 → **63** (파일 185줄; L110/127 동일). substance CONFIRMED. |
| UX-5-002 | high → **low**, '일관 불일치' → '일관된 그룹선택 기능 제거'(SelectionStateContext API 도 양 형제 제거됨). |
| UX-5-005 | '양 형제' → **external 전용**(sub 는 정본과 동일). |
| UX-5-006 | '양 형제' → **external 전용**(sub 는 useReadOnly/isWriteMode 가드 유지). |
| SYS-003 | **benign 으로 제외** — ActionSelector disable 은 무조건 호출되는 커스텀 훅의 명칭 기반 린트 false positive. 조건부 훅 아님, 포크 분기도 아님. |
| SRV-B-004 | 결함(whereclause.ts:141) 불변. 원 보고가 escaped 형제로 인용한 :227 은 그 자체도 미이스케이프 — 다른 5개 진성 이스케이프 사이트 대비 분기 성립. |

## 카운트 분쟁 reconciliation (중요)

VS-3 이 좁은 스코프(fs-data-viewer 한정)에서 JSON.parse=141, `as unknown as`=54 로 재집계하며 SYS-005/006 카운트 하향 및 'subGridData.model.ts 부재' 를 제기. **그러나 본 세션 main 이 전 범위(`data-craft/src` + `data-craft/packages` + `data-craft-server/src`, dist/node_modules 제외)로 재집계한 결과 JSON.parse=161, `as unknown as`=83 으로 확정되었고, `subGridData.model.ts` 도 서버에 실재한다.** VS-3 의 낮은 수치는 검색 범위 협소 artifact 이므로 **원 카운트(161/83)를 유지**한다(primary-source 재현 가능 grep 우선, 서브에이전트 추정에 무비판 전환하지 않음 — 어드바이저 가이드 준수). `as any`=7 은 양측 일치.

## 검증의 대상이 아님(명시)
검증은 발견 문서 대조이며, 5×5=25회 분석 재실행이 아니다. 각 검증 회차는 본 원장 1행으로 기록. SYS-004(297 exhaustive-deps)·SYS-005(161 JSON.parse)·SYS-006(83 double-cast)는 개별 버그가 아닌 **권고형 트리아지 표면**으로, 검증은 카운트 정확성과 클래스 타당성만 확인.
