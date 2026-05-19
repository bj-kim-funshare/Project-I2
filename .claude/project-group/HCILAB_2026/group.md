---
protected_branches:
  - i-dev
  - main
---

# HCILAB_2026 — 그룹 범용 규정

## 브랜치 정책

- 통합 브랜치: `i-dev` (외부 프로젝트 컨벤션). 모든 WIP 는 `i-dev` 로 머지.
- `main` 은 릴리스 라인. `dev-merge` 의 `--delete-branch` 면제 대상으로 `i-dev` / `main` 보호.

> **main / i-dev 동기화 흐름**: 본 그룹은 외부 작업자가 main 으로 직접 푸시하는 패턴이 발생함 (2026-05-19 plan-enterprise #1 진행 중 발견 — i-dev 가 main 보다 7 커밋 stale 하여 Phase 2 가 plan_contradicts_code 보고). 향후 모든 main 변경은 즉시 i-dev 로 동기화하여 plan-enterprise 의 분기 베이스가 항상 최신 상태이도록 유지. 동기화는 i-dev 가 main 의 strict ancestor 인 경우 fast-forward, 양쪽에 분기가 있으면 main → i-dev 머지.

## 커밋 / PR 컨벤션

- 커밋 메시지 한글 (CLAUDE.md §1 언어 분리 정책 — 모든 외부 프로젝트 그룹 공통).
- WIP 명명: `{skill}-문서` (docs) / `{skill}-작업` (code) — CLAUDE.md §5 공통 규칙.

## 자유 입력 사항

(추후 코드 리뷰 규칙, 사내 SLA, 명명 컨벤션 등이 정립되면 본 절을 확장.)
