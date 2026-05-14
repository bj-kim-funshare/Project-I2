# data-craft 서버/프론트 npm 의존성 advisory — 40건 정리

> 작성: 2026-05-13
> 출처: 보안 점검 보고서 `/Users/starbox/.claude/plans/data-craft-payment-security-review.md` Phase 2 (npm/pnpm audit)

## 결제 결함 32건과 무엇이 다른가

- **결제 결함 32건** = 우리 코드의 버그 → 우리가 직접 고침
- **의존성 advisory 40건** = 우리가 쓰는 외부 라이브러리의 알려진 CVE → 대부분 `pnpm up <pkg>` 한 줄로 해결
- 두 카테고리는 다른 작업 흐름 (전자는 plan-enterprise, 후자는 단순 버전 업)

## 결제와의 직접 관련성

- **40건 중 5건만 결제 흐름에 직접 닿을 가능성** (high 등급, 후술)
- 나머지 35건은 결제와 무관하거나 dev-only dependency → 서버 전체 보안 위생 작업으로 분리 진행

---

# 🔴 결제 직결 가능성 — 5건 (high 등급)

## 1. `jsonwebtoken` (data-craft-server)

🎯 인증 토큰 발급/검증에 사용. 결제 API 호출 시 모든 요청에 첨부됨.

💥 알려진 CVE: JWT 검증 우회 / 알고리즘 혼동 (`alg: none` 수용 등) → 인증 우회 → 다른 사용자의 결제 API 호출 가능.

🛠 `pnpm up jsonwebtoken` 으로 최신 패치 버전 적용. 적용 후 `verify()` 호출에 `algorithms` 옵션이 명시되어 있는지 코드 점검 (`algorithms: ['HS256']` 권장).

## 2. `jws` (data-craft-server)

🎯 `jsonwebtoken` 의 하위 의존성. JWT 서명/검증 실제 구현.

💥 `jsonwebtoken` CVE 와 연동. 별도 업데이트 필요한 경우 있음.

🛠 `jsonwebtoken` 업데이트 후 `pnpm why jws` 로 버전 확인. 필요 시 resolutions 강제.

## 3. `nodemailer` (data-craft-server)

🎯 결제 영수증 / 결제 실패 알림 메일 발송에 사용.

💥 알려진 CVE: 헤더 인젝션 / SSRF / 첨부파일 처리 취약점.

🛠 `pnpm up nodemailer`. 메일 발송 호출지에서 `to` 헤더에 사용자 입력이 직접 들어가는지 확인 (CRLF 인젝션 방어).

## 4. `path-to-regexp` (data-craft-server)

🎯 Express 라우팅 내부 의존성. 결제 라우트 매칭에도 사용.

💥 ReDoS (정규식 폭주) 취약점 → 악의적 path 로 요청 시 서버 CPU 100% 점유 → 결제 API 응답 지연 / 다운.

🛠 `pnpm up path-to-regexp` → 보통 Express 본체 업데이트로 따라옴.

## 5. `xlsx` (data-craft-server + data-craft FE 양쪽)

🎯 결제 리포트 / 정산 데이터 엑셀 다운로드에 사용.

💥 알려진 CVE: prototype pollution, 메모리 폭주. 사용자가 업로드한 xlsx 파싱 시 위험.

🛠 SheetJS 공식 권장: `xlsx` 는 npm 배포 중단 → CDN 또는 `@e965/xlsx` fork 로 교체. 또는 server-side 만 사용하고 신뢰 가능한 데이터로만 파싱하도록 격리.

---

# 🟡 결제와 무관하지만 서버 전체 보안 — 31건

## data-craft-server (36 중 31)

세부 패키지 목록은 보안 보고서 원문 참조. 일반 가이드:

### high 등급 7건 (위 5건 외 잔여 2건)
🛠 즉시 `pnpm up <pkg>`. 메이저 버전 점프가 필요한 건만 별도 task 로.

### medium 등급 18건
🛠 분기에 1회 일괄 `pnpm up`. 메이저 버전 점프는 changelog 검토 후.

### low 등급 6건
🛠 다음 dev-security-inspection 사이클까지 deferred 가능. CVSS 3 미만이면 사실상 무시 가능.

### 처리 전략
1. `pnpm audit --json > audit.json` 으로 현재 상태 스냅샷
2. `pnpm audit --fix` 로 자동 해결 가능한 것 일괄 처리
3. 자동 해결 안 되는 항목만 수동 검토:
   - 메이저 버전 점프 → changelog 확인
   - 의존성 트리 깊은 곳 → `pnpm.overrides` 강제 버전 지정
4. 처리 후 빌드/테스트 → 회귀 없으면 머지

---

## data-craft FE (4건)

| 패키지 | 등급 | 결제 관련 | 처리 |
|---|---|---|---|
| xlsx (high 2건) | high | △ (정산 export) | 서버 측과 동일 — SheetJS 정책 변경 대응 |
| postcss | medium | × | `pnpm up postcss` 또는 메이저 점프 |
| tootallnate | low | × | deferred 가능 |

---

## `@tosspayments/*` 본체 — 0건 ✅

토스페이먼츠 SDK 자체에는 알려진 CVE 없음.

---

# 한눈 요약

| 카테고리 | 건수 | 처리 방식 |
|---|---|---|
| 🔴 결제 직결 high | 5 | 우선 `pnpm up` + 호출지점 코드 점검 |
| 🟡 결제 무관 high | 7 | 일괄 `pnpm up` |
| 🟡 medium | 19 (서버 18 + FE 1) | 분기 1회 일괄 |
| 🟢 low | 7 | deferred 가능 |
| ✅ 토스 SDK | 0 | 조치 불요 |
| **합계** | **40** | |

## 권장 진행 순서

1. **즉시 (반나절)**: 위 결제 직결 5건 + jwt 검증 옵션 코드 점검
2. **이번 주**: 결제 무관 high 7건 `pnpm audit --fix`
3. **이번 달**: medium 19건 일괄
4. **다음 사이클**: low 7건 + `xlsx` 대체 정책 결정

## 결제 결함 32건과 함께 묶을지 분리할지

- **분리 권장**: 의존성 업데이트는 단순 작업 + 회귀 테스트 위주라 plan-enterprise 의 phase-by-phase 흐름과 결이 다름
- 별도 WIP 브랜치 `deps-audit-202605` 같은 형태로 한 번에 처리 후 PR 1개로 머지
- 결제 결함 32건의 patch 와 의존성 PR 은 충돌 가능성 낮으므로 병렬 진행 가능
