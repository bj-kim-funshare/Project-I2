---
dev_prod_separation: 공유
env_management: git-tracked
migration_approach: 수동 SQL (ORM 미사용)
connection_style: DB_* 환경변수
---

# data-craft — db 환경 규정

## 핵심 정책

- 4개 프로젝트 전부 **동일한 DB 접속 정보**를 단일 `.env` 의 `DB_*` 변수로 공유. 개발 / 프로덕트 분리 없음.
- 그룹 운영 DB 인스턴스에는 두 개의 데이터베이스가 존재 — `data_craft_ver_001` 과 `data_craft_test`. **명시적 변경 전까지 개발 / 프로덕트 양쪽 모두 `data_craft_test` 사용** (마스터 명시).
- 호스트 / 포트 / DB명 / 계정 / 비밀번호 / 토큰 / API 키 등 시크릿은 각 저장소 `.env` 의 `DB_*`, `JWT_*`, `SMTP_*`, `TOSS_*`, `NTS_*` 변수 참조. env 는 각 저장소에서 git-tracked, **본 I2 정책 파일에는 비적재** (별도 저장소이므로 노출 방지).

## Migration

- ORM 미사용. 스키마 변경은 수동 SQL. `task-db-structure` 스킬 사용 시 `db-migration-author` 가 paired migration + rollback SQL 생성.
- DML 변경은 `task-db-data` 스킬 사용.

## Connection

- `data-craft-server` 가 `mysql2` 패키지로 직접 연결. 풀 설정 / 트랜잭션 패턴은 server 코드 참조.
- FE 측 (data-craft / data-craft-mobile / data-craft-ai-preview) 은 직접 DB 접속하지 않고 `data-craft-server` REST API 경유.

## 미확정

- 추후 `data_craft_ver_001` 로 prod 분리 시 본 문서 갱신 필요.
