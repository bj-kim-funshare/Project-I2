---
engine: postgresql
framework: mybatis
dev_prod_separation: 공유
env_management: manual
migration_approach: Flyway 버전 마이그레이션 (db/migration/V*.sql); MyBatis 매퍼는 데이터 접근 계층
connection_style: DATABASE_URL
---

# Pinlog — db 환경 규정

## 핵심 정책

- BE (`Pinlog-Server`) 가 PostgreSQL 단일 인스턴스에 연결. 데이터 접근 계층은 MyBatis 3.0.5 (매퍼 XML — `src/main/resources/mapper/`).
- FE (`Pinlog`) 는 직접 DB 접속 없음 — `Pinlog-Server` REST API 경유.
- 시크릿 (host / port / DB / user / password / JWT secret / SMTP 등) 은 각 저장소 환경에서 관리. 본 정책 파일에는 비적재.

## 분리 정책

- `dev_prod_separation` = **공유** (조사 확정). `Pingus-Server` 는 단일 `application.yml` 만 보유 — `application-dev.yml` / `application-prod.yml` 등 프로파일 변형 없음. 개발/프로덕트 동일 DB 사용.
- 추후 prod 인스턴스를 분리하면 본 문서 갱신 + `task-db-structure` 가 분리 정책 반영.

## Connection style

- `connection_style` = **DATABASE_URL** (조사 확정). `application.yml` 의 `spring.datasource.url` 이 단일 JDBC URL (`jdbc:postgresql://<host>:<port>/<db>`) 형태. host/port/name 분리 `DB_*` 환경변수 미사용.
- 스키마: `pinlog` — HikariCP `connection-init-sql` 의 `SET search_path TO pinlog` 로 지정.
- `task-db-structure` / `task-db-data` 는 단일 URL contract 로 connection 구성.

## Migration

- **Flyway** 버전 마이그레이션. 마이그레이션 파일 = `src/main/resources/db/migration/V*.sql` (현재 `V1__post_scope_tags_place.sql`, `V2__social_capsule_search.sql`).
- MyBatis 는 데이터 접근(쿼리 매핑) 전용 — 마이그레이션 도구와 별개 계층.
- `task-db-structure` 스킬 사용 시 `db-migration-author` 가 Flyway 규약(`V{N}__*.sql`)에 맞춰 paired migration + rollback 생성.
- DML 변경은 `task-db-data` 스킬 사용.

## Cache / Auxiliary

- README 는 인증 코드 캐시용 Redis 를 언급하나, 현 시점 `build.gradle` / `application.yml` 에 Redis starter·설정 미반영 (구현 미완 또는 외부 Redis 직접 사용). 캐시 정책 구체화 시 본 문서 갱신.

## env 관리

- `env_management` = `manual`. 추후 secret-manager 전환 시 본 문서 갱신.
