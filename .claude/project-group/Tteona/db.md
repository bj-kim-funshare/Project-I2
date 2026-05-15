---
dev_prod_separation: 공유
env_management: git-tracked
connection_style: DATABASE_URL
---

# Tteona — db 환경 규정

## DB 개요

- **PostgreSQL**. BE (`Tteona-server`) 가 `postgres-js` 드라이버로 직접 연결, `drizzle-orm` 을 사용.
- 연결 방식 (`connection_style`): `DATABASE_URL` — 통합 URL 을 BE 가 우선 파싱한다.
- dev/prod 분리 (`dev_prod_separation`): **공유**. `task-db-structure` / `task-db-data` 는 단일 라벨 실행으로 동작한다.

## 마이그레이션 방식

- `drizzle-orm` 은 **typed query builder 로만** 사용한다. `drizzle-kit` 의 introspect / migrate 는 이 그룹에서 사용하지 않는다 (`drizzle.config.ts` 에 명시).
- 정규(canonical) 스키마는 **외부(Huya)가 소유**한다. 스키마 변경은 외부 스키마 소유자를 경유한다.
- 따라서 `task-db-structure` 는 이 그룹에 DDL 을 발행하지 않는다.

## env 관리

- `env_management: git-tracked` 의 실제 의미: 저장소에는 `.env.example` 템플릿만 추적되고, 실제 `.env` 파일은 `.gitignore` 대상이다. 실제 연결 문자열 값은 git 에 커밋되지 않는다.
