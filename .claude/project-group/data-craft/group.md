# data-craft — 그룹 범용 규정

## 확정 정책

| 항목 | 값 |
|---|---|
| 커밋 메시지 언어 | 한국어 (CLAUDE.md §1 언어 분리 정책) |
| 통합 브랜치 | **`i-dev` 필수** (4개 저장소 전부 예외 없이 적용 — 마스터 명시) |
| 머지 경로 | **WIP 브랜치 → `dev-merge` 스킬 경유 PR → `i-dev` 필수** (직접 머지 금지) |
| 코드 리뷰 | `dev-merge` 의 read-only reviewer 2종 (`claude-md-compliance-reviewer` + `bug-detector`) + 필요 시 `code-fixer` 자동 적용 |
| PR 머지 방식 | merge commit (`--no-ff`, dev-merge 디폴트) |
| 배포 우선순위 | 서버 우선 (deploy.md 참조) |
| 테스트 의무 | 없음 (PR 전 `pnpm test` 강제 안 함 — 마스터 명시) |
| 버전 태그 | git tag 미부여 — `patch-confirmation` 의 패치노트 v{N}.K.0 으로만 버전 추적 (마스터 명시) |
| SLA / 핫픽스 절차 | 본인 판단 (별도 명시 없음 — 마스터 명시) |

## i-dev / dev-merge 필수 정책 (마스터 명시)

- **4개 저장소 (data-craft / data-craft-mobile / data-craft-ai-preview / data-craft-server) 모두** WIP → i-dev 경로 필수.
- 핫픽스 / 1줄 수정도 예외 없음.
- `dev-merge` 스킬 우회 금지 — 로컬에서 `git merge` 직접 수행으로 main 또는 i-dev 변경 금지.
- `i-dev` → `main` 승격은 별도 결정 (이 그룹의 `i-dev` 가 안정 상태로 누적된 시점에 master 가 trigger).
- **적용 범위 = 4개 data-craft 저장소 한정.** 본 정책 파일이 거주하는 I2 harness 저장소 자체는 CLAUDE.md §5 에 따라 `main` 직접 적용 — `new-project-group` / `group-policy` 스킬이 로컬 `git merge` 사용하는 것은 본 정책 위반 아님.

## 운영 메모

- gh-pages 배포 수동 트리거 (`npx gh-pages`), AWS 서버도 수동 — main 자동 배포 압박 없음.
- `plan-enterprise` 다단계 phase 작업 시 i-dev 가 main 보호막.
- harness 내 `plan-enterprise`, `task-db-structure`, `task-db-data` 등 외부 프로젝트 스킬은 본 정책 자동 준수 (i-dev 통합 표준).

## 미확정 항목

없음 — 4개 정책 영역 (dev / deploy / db / group) 의 모든 결정 사항이 본 라운드로 확정되었다. 추후 추가 항목 발생 시 `/group-policy data-craft` 로 보충.
