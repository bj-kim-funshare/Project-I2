---
dev_prod_separation: 공유
env_management: manual
connection_style: DATABASE_URL
---

# HCILAB_2026 — db 환경 규정

## DB 사용 여부

- v1 등록 시점: **자체 DB 미사용**. FE 단독 프로젝트로 외부 API 또는 정적 데이터만 다룬다.
- `task-db-structure` / `task-db-data` 스킬은 본 그룹에 대해 호출 불가 (스킬 자체가 db 컨텍스트를 요구).
- 향후 DB 도입 시 `/group-policy` 로 본 파일 갱신 — `dev_prod_separation` (분리/공유), `connection_style` (DATABASE_URL / DB_* 환경변수), 마이그레이션 접근, env_management 를 정식화.

## 자유 입력 사항

- 현재 YAML 의 `dev_prod_separation` / `connection_style` 값은 DB 미사용 상태의 placeholder. 향후 DB 도입 시점에 다시 확정해야 한다.
