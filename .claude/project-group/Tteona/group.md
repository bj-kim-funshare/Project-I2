# Tteona — 그룹 범용 규정

## 확정 정책

| 항목 | 값 |
|---|---|
| 커밋 메시지 언어 | 한국어 (CLAUDE.md §1 언어 분리 정책) |
| 통합 브랜치 | `i-dev` (2개 저장소 — Tteona / Tteona-server) |
| 머지 경로 | WIP 브랜치 → `dev-merge` 스킬 경유 PR → `i-dev` (직접 머지 금지) |
| 코드 리뷰 | `dev-merge` 의 read-only reviewer 2종 (`claude-md-compliance-reviewer` + `bug-detector`) + 필요 시 `code-fixer` 자동 적용 |
| PR 머지 방식 | merge commit (`--no-ff`, dev-merge 디폴트) |
| 배포 우선순위 | deploy.md 참조 |
| 보호 브랜치 (dev-merge `--delete-branch` 면제) | `main`, `i-dev`, `dev` (아래 `## 보호 브랜치` 절 규칙 참조) |

## 보호 브랜치 (마스터 명시)

- **규칙**: WIP 규칙(`{skill}-문서` / `{skill}-작업`)으로 생성되지 **않은** 모든 브랜치는 `dev-merge` 의 `--delete-branch` 대상에서 면제(보호)한다.
- **현재 두 저장소에 실재하는 보호 대상 인스턴스**: `main` (안정 브랜치), `i-dev` (통합 브랜치), `dev` (기존 브랜치). 셋 다 WIP 규칙으로 생성된 브랜치가 아니므로 보호된다.
- **삭제 예외**: `i-dev-001` 은 위 규칙에도 불구하고 삭제 대상이다. 현재 두 저장소에 미실재 — 미래 대비 마스터 명시 예외로 기록한다.

## 운영 메모

- 통합 브랜치 `i-dev` 는 `main` 의 보호막. `plan-enterprise` 다단계 phase 작업은 `i-dev` 에서 진행한다.
- 적용 범위 = Tteona / Tteona-server 2개 저장소 한정. 본 정책 파일이 거주하는 I2 harness 저장소 자체는 CLAUDE.md §5 에 따라 `main` 직접 적용.

## 미확정 항목

- FE / BE 배포 `target` URL (deploy.md 참조) — 추후 `/group-policy Tteona` 로 보충.
