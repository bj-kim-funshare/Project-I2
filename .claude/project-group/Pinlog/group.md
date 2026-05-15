# Pinlog — 그룹 범용 규정

## 확정 정책

| 항목 | 값 |
|---|---|
| 커밋 메시지 언어 | 한국어 (CLAUDE.md §1 언어 분리 정책) |
| 통합 브랜치 | **`i-dev` 필수** (2개 저장소 전부 적용) |
| 머지 경로 | **WIP 브랜치 → `dev-merge` 스킬 경유 PR → `i-dev` 필수** (직접 머지 금지) |
| 코드 리뷰 | `dev-merge` 의 read-only reviewer 2종 (`claude-md-compliance-reviewer` + `bug-detector`) + 필요 시 `code-fixer` 자동 적용 |
| PR 머지 방식 | merge commit (`--no-ff`, dev-merge 디폴트) |
| 배포 우선순위 | 서버 우선 (FE 가 BE 스키마/엔드포인트에 의존 — `Pinlog-Server` 먼저 배포 후 `Pinlog`) |
| 테스트 의무 | 없음 (PR 전 테스트 강제 안 함 — v1 디폴트, 추후 변경 가능) |
| 버전 태그 | git tag 미부여 — `patch-confirmation` 의 패치노트 v{N}.K.0 으로만 버전 추적 |
| SLA / 핫픽스 절차 | 본인 판단 (별도 명시 없음 — v1 디폴트) |
| 보호 브랜치 (dev-merge `--delete-branch` 면제) | `i-dev`, `main` (2개 저장소 모두 적용) |

## 보호 브랜치

`dev-merge` 가 본 그룹 저장소를 처리할 때 from-branch 가 다음 목록에 일치하면 `gh pr merge --delete-branch` 를 생략하여 브랜치를 보존한다.

- `i-dev` — 2개 저장소 통합 브랜치 (그룹 필수).
- `main` — 승격된 안정 브랜치.

## i-dev / dev-merge 필수 정책

- **2개 저장소 (Pinlog / Pinlog-Server) 모두** WIP → i-dev 경로 필수.
- 핫픽스 / 1줄 수정도 예외 없음.
- `dev-merge` 스킬 우회 금지 — 로컬에서 `git merge` 직접 수행으로 main 또는 i-dev 변경 금지.
- `i-dev` → `main` 승격은 별도 결정 (master 가 안정 누적 시점에 trigger).
- **적용 범위 = Pinlog / Pinlog-Server 한정.** I2 harness 저장소 자체는 CLAUDE.md §5 에 따라 `main` 직접 적용 — `new-project-group` / `group-policy` 스킬이 로컬 `git merge` 사용하는 것은 본 정책 위반 아님.

## 운영 메모

- v1 시점 배포 인프라 미확정 — deploy.md 의 TBD 항목 채워질 때까지 `pre-deploy` 스킬 호출은 deploy-validator 단계에서 차단됨.
- `plan-enterprise` 다단계 phase 작업 시 i-dev 가 main 보호막.

## 미확정 항목

- deploy 인프라 4종 결정 (FE host / BE host / build·deploy command / env 관리). `/group-policy Pinlog` 로 보강.
- DB dev/prod 분리 구체 형태 (인스턴스 / DB 명).
