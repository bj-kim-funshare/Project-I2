# data-craft — 그룹 범용 규정

## 상태

마스터 미지정. 추후 `/group-policy data-craft` 로 추가 예정.

## 적용 디폴트 (확정 전까지)

- 커밋 메시지: 한국어 (CLAUDE.md §1 언어 분리 정책).
- 통합 브랜치: `i-dev` (CLAUDE.md §5 외부 프로젝트 표준).
- 머지 경로: WIP 브랜치 → `dev-merge` 스킬 경유 PR → `i-dev`.
- 코드 리뷰: `dev-merge` 의 read-only reviewer 2종 (`claude-md-compliance-reviewer` + `bug-detector`) + 필요 시 `code-fixer` 자동 적용.

상기 디폴트는 명시 정책이 아닌 harness 표준값이며, 마스터 확정값으로 대체될 때까지 잠정 적용한다.
