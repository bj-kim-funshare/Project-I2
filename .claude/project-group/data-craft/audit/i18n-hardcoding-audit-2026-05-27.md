# data-craft 다국어/하드코딩 전수 감사

> 감사일: 2026-05-27
> 대상: `data-craft` (FE, pnpm 모노레포) · `data-craft-server` (BE, Node/TS)
> 플랜 이슈: funshare-inc/data-craft#180
> 성격: **감사(조사) 전용 — 코드 무수정.** 본 문서가 정본(source-of-truth).
> 작성 위치 정책: 마스터 지정으로 결과물을 아이OS(harness) 저장소 `.claude` 내부에 보관.

---

## 1. 조사 범위·방법·제외 기준

### 범위
- `data-craft` (FE) — 메인 앱 `src/` + 사용자 노출 패키지(`packages/fs-*`).
- `data-craft-server` (BE) — API 응답 메시지·검증 메시지·이메일 템플릿·알림.
- 조사 시점 양 저장소 브랜치 = `i-dev`.

### 방법
- read-only 탐색 3종 병렬(i18n 아키텍처 / FE 하드코딩 / 서버 문자열) + 메인 세션 spot-check 검증.
- 서버 영문 누출 6건은 파일:라인 단위로 grep 직접 확인(전수 정확).
- FE 하드코딩은 영역별 대표 경로·규모로 분류(전수 카운트는 근사치).

### "논리적으로 합당한 하드코딩" — 결함 아님(제외)
- 코드 주석, 개발자 콘솔/로그 메시지.
- 기술 식별자·에러코드 상수(`INTERNAL_SERVER_ERROR`, `BAD_REQUEST`, `TOKEN_NOT_FOUND` 등).
- 브랜드명(`DataCraft`), HTTP status enum 표현(`'OK'` 등 내부 표현).
- 테스트 픽스처/테스트 데이터, 타입 정의·JSDoc.
- 서버 한국어 전용 문자열(검증/CALL_ID/이메일/알림) — i18n 부재가 **설계 정합**이므로 결함 아님(§3 참조).

---

## 2. data-craft (FE)

### 2.1 i18n 아키텍처
- 라이브러리: `react-i18next` + `i18next` (+ `i18next-browser-languagedetector`).
- 설정: `src/shared/i18n/i18n.ts` (`src/main.tsx` 에서 앱 마운트 전 init). fallback = `ko`, localStorage 키 `i18nextLng`.
- 소비 패턴: 메인 앱 = `useTranslation()` → `t('a.b.c')` 점표기. 일부 패키지 = 자체 Context + `useI18n()` → `t.section.key` 직접 접근.
- 보간: `{{var}}`.

### 2.2 번역 리소스·완전성
- 메인 앱: `src/shared/i18n/locales/{en,ko}.ts` (각 ~1,000여 키). **KO↔EN 완전 정합 — 누락 키/빈 값 없음.**
- 패키지 i18n 5종:
  - en/ko: `fs-file-attachment`, `fs-relation-builder`, `fs-data-link`
  - en/ko/zh/ja: `fs-data-viewer`, `fs-sub-data-viewer`, `fs-external-data-viewer`
- **결론: 영문 표기는 번역 파일 레벨에서 다 들어가 있음(완전).**

### 2.3 진짜 갭 — 하드코딩 한국어가 `t()` 우회
번역 파일은 완전하나, UI 코드 다수가 `t()` 를 호출하지 않고 한국어 리터럴을 JSX/props 에 직접 박음 → **영문 번역이 존재해도 런타임에서 EN UI 가 불가능.** 약 100+ 파일, ~600+ 인스턴스(근사).

| 영역 | 대표 경로 | 규모(근사) | 후속 호출 단위 제안 |
|------|-----------|-----------|----------------------|
| toast/error 메시지 | 전역 산재 (`src/features/**`, `src/pages/**`, `registerErrorHandlers.ts`, `use*Loader.ts`, `GlobalErrorFallback.tsx`) | ~282 | 별도 호출 (최대 영역) |
| form-builder UI | `src/features/form-builder/ui/` (`ConditionValueInput.tsx`, `WidgetTypeSection.tsx`, `ConnectionFieldRenderer.tsx`, `SelectionFieldRenderer.tsx`, `FormEditorPanel.tsx`, `OptionListEditor.tsx`, `FieldSettingsSection.tsx` …) | ~96 | 별도 호출 |
| property-drawer / widget designer | `src/widgets/property-drawer/ui/` 및 하위 `style-editors/`·`property-editors/` (`style-editors/WidgetDesignGroup.tsx`, `SectionStylesEditor.tsx`, `AreaBackgroundSection.tsx`, `PropertyDrawer.tsx`, `property-editors/InputPropertiesEditor.tsx`·`TextPropertiesEditor.tsx`·`TabsButtonDesignSection.tsx` …) | ~76 | 별도 호출 |
| viewer 패키지 | `packages/fs-sub-data-viewer/`, `packages/fs-external-data-viewer/`, `packages/fs-data-viewer/` (print steps, cell-renderers, data-viewer-header, grid-table 등) | ~60 | 별도 호출 (패키지별 i18n 정합 점검 포함) |
| subscription/billing UI | `src/features/subscription/ui/` (`PaymentPasswordSetupStep.tsx`, `PaymentPasswordInputDialog.tsx`, `SeatManageDialog.tsx`, `PromotionPurchaseDialog.tsx`) | ~20 | 별도 호출 |
| logo/file upload UI | `src/features/logo-upload/ui/LogoUploadDialog.tsx`, `src/widgets/file-uploader-widget/ui/FileListItem.tsx`, `src/widgets/file-attachment/ui/FileListTable.tsx` | ~15 | misc 와 병합 가능 |
| 기타 misc | `PeriodSelector.tsx`, `CompanyLogo.tsx`, `ColorPalette.tsx`, `mode-switching/ModeToggle.tsx`, `shared/ui/number-input-with-return.tsx` 등 | ~20 | misc 와 병합 가능 |

표면 유형: JSX 내용(버튼/라벨/다이얼로그 제목), props(`placeholder`/`title`/`aria-label`), toast/error 문자열, `<SelectItem>` 옵션 라벨.

#### spot-check 검증(실재 확인)
- `src/features/form-builder/ui/ConnectionFieldRenderer.tsx:151` — `<SelectItem value="_none_">선택안함</SelectItem>` ✓
- `src/features/form-builder/ui/ConditionValueInput.tsx:36` — `placeholder="값 입력"` ✓
- `src/widgets/property-drawer/ui/style-editors/WidgetDesignGroup.tsx` 존재 ✓ (탐색 보고의 `ui/WidgetDesignGroup.tsx` 경로는 `style-editors/` 누락 — 본 문서에서 정정)
- `src/shared/i18n/{i18n.ts, locales/en.ts, locales/ko.ts}` 모두 존재 ✓

### 2.4 근본 원인(참고)
- i18n 채택이 비일관적 — 후기 기능(form-builder, property-drawer, 결제 PIN)에서 하드코딩 회귀.
- 하드코딩 한국어를 거르는 lint 규칙 부재.
- 패키지별 i18n 분절 — 메인 앱 중앙 시스템과 미통합.

---

## 3. data-craft-server (BE)

### 3.1 i18n 부재 = 한국어 전용 설계(정합)
- i18n 라이브러리·locale 파일·`Accept-Language` 처리 전무.
- 검증 메시지(zod ~28건, `src/schemas/`), CALL_ID 194건(`src/config/constant.ts`), 이메일 템플릿(`email.service.ts` 인증코드 / `contact.service.ts` Enterprise 문의), 알림(`notification.service.ts`) **전부 한국어 = 설계 정합, 결함 아님.**
- 이메일 템플릿: 제목·본문 모두 한국어, HTML 정상(UTF-8). 영문 미존재 → "영문 품질" 평가 대상 아님.

### 3.2 영문 누출 6건 — "영문 표기 정확성" 관점의 실제 결함
한국어여야 할 사용자 노출 응답에 영어가 박혀 있음(전수 grep 확인 완료):

| # | 파일:라인 | 현재값(영문) | 제안(한국어) | 심각도 |
|---|-----------|-------------|--------------|--------|
| 1 | `src/middlewares/error.middleware.ts:128-129` | `'Internal Server Error'` (message fallback + error 필드) | `'내부 서버 오류'` | HIGH (500 응답 기본 노출) |
| 2 | `src/controllers/auth.controller.ts:501` | `isActive ? 'User activated' : 'User deactivated'` | `'사용자 활성화됨'` / `'사용자 비활성화됨'` | MEDIUM |
| 3 | `src/controllers/auth.controller.ts:505` | `'Failed to toggle user active status'` (errorCatch message) | 한국어화 | MEDIUM |
| 4 | `src/routes/file.ts:405,526` | `'File deleted successfully'` / `'File group deleted successfully'` | `'파일이 삭제되었습니다'` / `'파일 그룹이 삭제되었습니다'` | MEDIUM |
| 5 | `src/services/user.service.ts:125` | `'Password updated successfully'` | `'비밀번호가 변경되었습니다'` | MEDIUM |
| 6 | `src/controllers/webhook.controller.ts:62,119` | `'OK (duplicate)'` / `'OK'` | 내부 ack(웹훅) — 한국어화 또는 표준화 검토 | LOW |

> 참고: `src/utils/error.ts` 의 `StatusCode.OK.information = 'OK'` 등은 내부 HTTP status enum 표현 → 결함 아님(제외).

---

## 4. "영문 표기 정확성" 종합 결론

- **FE(data-craft)**: 영문 번역 파일은 **완전**. 그러나 ~600+ 하드코딩 한국어가 `t()` 를 우회해 **런타임에서 영문이 노출되지 않는 것**이 핵심 갭. 즉 "영문이 안 들어가 있다"기보다 "영문이 있어도 코드가 안 쓴다".
- **BE(data-craft-server)**: 한국어 전용 설계(정합). "영문 표기" 결함은 한국어여야 할 곳의 **영문 누출 6건**으로 한정.

---

## 5. 후속 triage 권고 (영역별 분리 enterprise 호출 단위)

수정은 본 감사 범위 밖(다른 세션 enterprise 처리). 권장 분할:

1. **서버 영문 누출 6건 한국어화** — 소규모, 단일 페이즈. 가장 명확/저위험. 우선 권장.
2. **FE toast/error i18n 편입** (~282) — 최대 영역, 별도 호출.
3. **FE form-builder UI i18n 편입** (~96).
4. **FE property-drawer UI i18n 편입** (~76).
5. **FE viewer 패키지 i18n 편입** (~60) — 패키지별 en/ko(/zh/ja) 정합 점검 포함.
6. **FE subscription / logo·file / misc i18n 편입** (~55) — 병합 가능.

> 예방 메커니즘(하드코딩 한국어 거르는 eslint 규칙 신설 등)은 본 감사 범위 밖이며, 도입 시 CLAUDE.md §6 net-positive 3질문 선행 필요.
