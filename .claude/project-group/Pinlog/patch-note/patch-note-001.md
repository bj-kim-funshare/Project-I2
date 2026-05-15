# Pinlog — Patch Note (001)

## v001.1.0 — Commit&Push 대기중

## v001.2.0

> 통합일: 2026-05-15
> 플랜 이슈: [#40](https://github.com/Team-Pingus/PinLog-Web/issues/40)

### 페이즈 결과

- **Phase 1 — UI 프리미티브 3종 시드 (feat)**: `src/shared/ui/` 에 StickerRow / PinMini / ScopeToggle 시드 추가. SCREENS.md §08 (핀 상세 리액션 바), §16 (스레드 핀 공유 카드), §05 (핀 작성 공개 범위) 디자인 의도 기반. `role=radiogroup` + 44px 터치 + Tailwind v4 시맨틱 토큰 사용. `index.ts` 재내보내기 갱신. 커밋 `95e3545` (+190/-0).
- **Phase 2 — 구스 마스코트 컴포넌트-자산 동기화 (refactor)**: `Goose.tsx` 의 `GooseMood` 유니온 + `GOOSE_ASSETS` 맵에 `calm`, `collect` 추가. 디스크 자산 10종 ↔ 컴포넌트 타입 10종 정합 (dead asset 2건 해소). 커밋 `7b03c22` (+7/-1).
- **Phase 3 — HANDOFF.md 경로 표준화 (chore)**: `PinLog_ 나만의 추억 SNS/docs/HANDOFF.md` → `docs/HANDOFF.md` `git mv` 이동 (rename 추적). prose sibling 참조 1건 갱신. 4종 sibling (SCREENS/SPEC/DESIGN/TECH) 은 옵션 B 의 문자 그대로 해석에 따라 한글 디렉토리 잔존. 커밋 `c0e4e64` (+1/-1).

### 영향 파일

PinLog-Web:
- `src/shared/ui/StickerRow.tsx` (신규)
- `src/shared/ui/PinMini.tsx` (신규)
- `src/shared/ui/ScopeToggle.tsx` (신규)
- `src/shared/ui/index.ts`
- `src/shared/ui/Goose.tsx`
- `docs/HANDOFF.md` (신규 위치, rename from `PinLog_ 나만의 추억 SNS/docs/HANDOFF.md`)

### 알려진 후속

- 베이스라인 lint 20 errors / 7 warnings (Dialog/Toast/LocationPicker/MapPostFeed) 은 본 플랜 시작 전부터 존재 — 별도 정리 플랜 권장.
- HANDOFF.md 내 코드블록 프롬프트 본문의 sibling 참조 5건 (`docs/SPEC.md` 등) 은 의도적 보존. 4종 sibling 도 `docs/` 로 이동하면 일관성 회복.
- `Goose` 마스코트 9 vs 10 정합 결정: 10유지로 종결. 향후 디자인이 9로 줄어들 경우 추가 정리 필요.
