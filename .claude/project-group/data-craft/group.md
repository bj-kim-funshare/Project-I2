# data-craft — 그룹 범용 규정

## 확정 정책

| 항목 | 값 |
|---|---|
| 커밋 메시지 언어 | 한국어 (CLAUDE.md §1 언어 분리 정책) |
| 통합 브랜치 | `i-dev` (CLAUDE.md §5 외부 프로젝트 표준 — 유지 확정) |
| 머지 경로 | WIP 브랜치 → `dev-merge` 스킬 경유 PR → `i-dev` |
| 코드 리뷰 | `dev-merge` 의 read-only reviewer 2종 (`claude-md-compliance-reviewer` + `bug-detector`) + 필요 시 `code-fixer` 자동 적용 |
| PR 머지 방식 | merge commit (`--no-ff`, dev-merge 디폴트) |
| 배포 우선순위 | 서버 우선 (deploy.md 참조) |

## i-dev 유지 근거

- gh-pages 배포 수동 트리거 (`npx gh-pages`) → main 자동배포 압박 없음 → i-dev 추가 단계 friction 낮음.
- AWS 서버도 수동 (`git pull && pm2 restart`) — main 이 항상 deployable 일 필요 없음.
- `plan-enterprise` 다단계 phase 작업 시 i-dev 가 main 보호막 역할.

운영 중 i-dev 2단 머지 friction 누적 시 master 판단으로 `/group-policy` 통해 main 직접으로 전환 가능.

## 미확정

- 테스트 의무 정책 (PR 전 `pnpm test` 강제 여부) — 추후 필요 시 추가.
- SemVer git tag 정책 — 패치노트 v{N}.K.0 별도로 git tag 를 부여할지 여부.
- 응답 SLA / 핫픽스 절차.
