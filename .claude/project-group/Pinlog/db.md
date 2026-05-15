---
engine: postgresql
framework: mybatis
dev_prod_separation: 분리
env_management: manual
migration_approach: 수동 SQL (MyBatis 매퍼 기반, ORM 미사용)
connection_style: DB_* 환경변수
---

# Pinlog — db 환경 규정

## 핵심 정책

- BE (`Pinlog-Server`) 가 PostgreSQL 단일 인스턴스에 MyBatis 3.0.5 로 연결.
- FE (`Pinlog`) 는 직접 DB 접속 없음 — `Pinlog-Server` REST API 경유.
- 시크릿 (host / port / DB / user / password / JWT secret / SMTP / Redis URL) 은 각 저장소 환경 변수로 관리. 본 정책 파일에는 비적재.

## 분리 정책

- `dev_prod_separation` = **분리** (v1 디폴트). 개발/프로덕트 DB 인스턴스 분리 가정. 실제 분리 형태(같은 인스턴스의 다른 DB / 다른 인스턴스 / Docker 로컬 vs 클라우드 prod 등)는 후속 `/group-policy` 에서 명세화.

## Connection style

- `DB_*` 환경변수 (Spring Boot `application.yml` 의 `spring.datasource.url` 등을 환경변수에서 주입). `DATABASE_URL` 단일 변수 형태 미사용.
- `task-db-structure` / `task-db-data` 스킬은 `DB_*` fallback 정책으로 connection 구성.

## Migration

- ORM 미사용 (MyBatis 매퍼 기반 raw SQL 흐름). 스키마 변경은 수동 SQL — `task-db-structure` 스킬이 `db-migration-author` 로 paired migration + rollback SQL 생성.
- DML 변경은 `task-db-data` 스킬 사용.

## Cache / Auxiliary

- `Pinlog-Server` 는 Redis (Lettuce) 사용. v1 시점 캐시 키 네임스페이스 / TTL 정책은 코드 측 책임 — 본 문서 범위 외.

## 미확정 / 후속 보강

- 실제 dev/prod 분리 형태(인스턴스 / DB명 / 호스트) 구체화.
- env_management = manual → secret-manager 전환 시 본 문서 갱신.
