# I2 Monitoring (v2 시각화)

아이OS 자체 토큰 사용량 모니터링. 3 축 (모델 / 스킬 / 세션) + 일자별 타임라인 + 비용을 로컬 대시보드에 시각화한다. Chart.js 기반.

외부 네트워크 의존 0 — `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/*.jsonl` 만 읽음. Chart.js 는 `lib/chart.umd.js` 로 번들링되어 있다 (MIT, `lib/LICENSE-chart.md`).

## 빠른 실행

```bash
python3 monitoring/scripts/serve.py
# → http://127.0.0.1:7777 접속
# → '새로고침' 버튼으로 최신 데이터 수집
```

포트 변경: `--port 8080`. 바인드 변경 (외부 노출 — 권장 X): `--bind 0.0.0.0`.

## 정적 모드

serve.py 없이 정적 파일 서버 (`python3 -m http.server` 등) 로 띄울 수도 있으나, 그 경우 `/api/refresh` 가 동작하지 않는다. 데이터 갱신은 수동:

```bash
python3 monitoring/scripts/collect.py    # data/aggregate.json 갱신
# 페이지 reload
```

## 데이터 흐름

```
~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/<uuid>.jsonl
              │
              ▼   (collect.py 가 파싱)
       monitoring/data/aggregate.json   ← gitignore (런타임 산출물)
       monitoring/data/hourly.json      ← 동시 출력; 최근 14일·시간 단위 희소 집계 (실시간 모드용)
              │
              ▼   (script.js 가 fetch + 렌더)
            대시보드
```

## 실시간 모드

기간 선택기에서 **실시간**을 고르면 `data/hourly.json` (시간 단위 희소 집계) 을 기반으로 렌더링한다. 비교 대상 없이 선택 시 최근 5일(120시간) 롤링 구간을 집계한다. 비교 대상(1시간 전 / 3시간 전 / 7시간 전 / 24시간 전 / 2일 전 / 3일 전 / 5일 전)을 선택하면 `[지금 - N, 지금]` 을 기준 구간, `[지금 - 2N, 지금 - N]` 을 비교 구간으로 잡아 KPI 델타 배지와 차트를 동일 창폭으로 비교한다. `hourly.json` 미존재 시(collect.py 미실행) 화면에 한국어 안내를 표시하고 크래시하지 않는다.

## 집계 축

- **모델별**: claude-opus-4-7 / claude-sonnet-* / claude-haiku-* 등 모델별 토큰 합계 + 추정 비용.
- **스킬별**: JSONL 의 `attributionSkill` 필드로 분류. 페르소나 축은 §D-1 폐기 결정에 따라 빼두었음.
- **세션별**: sessionId (jsonl 파일명 UUID) 기준, 최근 50 개.
- **일자별**: 머신 로컬 자정 기준 일자별 합계.

## 토큰 메트릭

- `input` — 캐시 미사용 input
- `output` — 모델 출력
- `cache_creation_5m` — 5분 ephemeral 캐시 작성
- `cache_creation_1h` — 1시간 ephemeral 캐시 작성
- `cache_read` — 캐시 히트로 절약된 입력

## 가격 추정

`scripts/collect.py` 의 `PRICING` 표 (USD per million tokens). 모델 가격 변경 시 수동 갱신. v1 은 대략 추정용 — 정확한 청구액과 다를 수 있음.

## 대시보드 구성

**KPI 카드 (4)**
- 전체 메시지 — 누적 assistant 메시지 수 + 처리 세션 수
- 전체 토큰 — non-cache (input+output) `/` cache (write+read) 분리 표시, input/output/cache write/cache read 4 줄 내역
- 캐시 효율 — `cache_read / (input + cache write + cache read)` 게이지
- 추정 비용 — 캐시 단가 안내 툴팁 (ⓘ 호버)

**차트 (6) — Chart.js**
- 일자별 토큰 (스택 막대): input / output / cache write / cache read
- 모델 분포 (도넛): 전체 토큰 기준
- 스킬 점유 (도넛): Top 8 + 기타
- 캐시 vs 비-캐시 비중 (도넛)
- 세션 Top 10 (가로 막대): 빈 세션(messages=0) 자동 제외
- 일자별 추정 비용 (막대): 일자별 모델 mix 기반

**보조 테이블 (4, 펼침/접힘)**: 모델별 / 스킬별 / 일자별 / 세션별 (최근 50).

## 스킬 호출별 토큰 사용량

마스터가 `/skillname` 형태로 스킬을 호출한 시점부터 해당 호출이 종료되는 시점까지의 모든 토큰을 한 행으로 귀속해 표시하는 뷰다. 스킬 단위 비용 추적이 목적이다.

**컬럼**: 시작 시각 / 소요 시간 / 스킬 / 제목(원 프롬프트 60자 트렁케이트) / 생성물(이슈 #N | patch-note-NNN | Roadmap-N | -) / 총 사용 / 총 캐시 / 메인 사용 / 메인 캐시 / 서브에이전트(`에이전트명: 사용/캐시` 형식 · 구분)

input + output 은 신규 토큰(사용량)이고 cache_creation_5m + cache_creation_1h + cache_read 는 캐시 토큰으로 가격·동작 특성이 다르므로 분리 표기. 모달의 토큰 분해 테이블에도 기존 채널별 5 컬럼 raw 값 끝에 "사용 합" / "캐시 합" 2 컬럼이 추가된다.

**윈도우 경계 규칙 (5 우선순위)**:

1. **명시적 종료어** — gated 스킬에서 `플랜 완료` 또는 `핫픽스 완료`가 포함된 마스터 프롬프트 도착 → 그 프롬프트까지 포함하여 닫음.
2. **plain_prompt (비gated)** — 비gated 스킬 활성 중 어떤 내용이든 마스터 프롬프트 도착 → 즉시 닫음. 비gated 스킬은 수 턴 내 완료되므로 다음 마스터 프롬프트는 항상 새 scope의 시작이다.
3. **새 스킬 호출** — 다른 `<command-name>/Y</command-name>` 도착 → 이전 윈도우를 닫고 새 윈도우 열림.
4. **attribution_drop (비gated)** — `attributionSkill`이 다른 스킬로 전환 → 직전 동일-attribution 레코드까지로 닫음 (grace window 없음; 규칙 2가 먼저 발동하는 경우 대체로 불필요).
5. **세션 종료** — 위 넷 모두 미발생 시 세션 마지막 레코드까지.

**중첩 처리**: v1은 새 `/Y` 도착 시 이전 `/X`를 즉시 닫는 단순 분할(비-overlap). 향후 마스터 요청 시 외곽 누적 방식 옵션 추가 가능.

**진행 중인 호출 (in_progress)**:
collect.py 가 실행되는 시점에 마지막 레코드 timestamp 가 현재 시각 기준 30분 이내인 세션은 "진행 중" 으로 판정된다. 해당 세션의 마지막 `session_end` 윈도우는 `close_reason: in_progress`, `partial: true`, `last_seen_timestamp` 가 설정된다 (부분 집계임을 의미). 이 윈도우들은 메인 표/페이지네이션과 분리되어 상단 별도 "🔴 진행 중인 호출 (실시간 부분 집계)" 영역에 표시된다. 또는 해당 세션 JSONL 파일 mtime 이 60분 이내면 동일 마킹 (Claude Code 의 batch flush 지연 대비).

**모달 시각 강화 (HOTFIX 3)**:
행 클릭 시 열리는 모달에 다음 레이어가 추가되었다:
- **hero 블록**: 스킬명 chip (해시 색상) + artifact 태그 + close_reason pill 을 상단 1행으로 요약.
- **4-card stat strip**: 총 사용 토큰 / 총 캐시 토큰 / 소요 시간 / 추정 비용.
- **채널별 stacked horizontal bar**: input / output / cache_5m / cache_1h / cache_read 비율 시각화 + 범례.
- **collapsible session footer**: 세션 ID · 시작/종료 timestamp · 종료 사유 · 마지막 활동 시각을 `<details>` 로 접어둠.

**모달 시각 강화 (HOTFIX 4)**:
HOTFIX 3 의 raw 채널 테이블 위에 `.modal-agents-section` 블록 추가 — 각 서브에이전트 1 row, 에이전트명 해시 색상 chip + 총 토큰·비용 요약, "사용" / "캐시" 가로 막대 2개 (윈도우 내 max 대비 비례, X.XXM 라벨). 총 토큰 내림차순 정렬. 기존 채널별 raw 테이블 유지.

**단위 표기**:
스킬 호출별 표의 모든 토큰 수치 (총 사용, 총 캐시, 메인 사용, 메인 캐시) 및 모달 stat-card / "사용 합" / "캐시 합" 컬럼은 `X.XXM` 소수점 M 단위로 통일한다. 예: `1.23M`, `0.05M`, `12.50M`. KPI 카드(`fmtKMB`) 는 적용 대상 외.

**UX**:
- 헤더의 기간/비교 토글 영향을 받지 않음 — 항상 전체 데이터 표시.
- 30개씩 페이지네이션. 1페이지 = 최신, 상단 = 가장 최신.
- 행 클릭 시 모달로 메타데이터 및 토큰 분해 전체 표시.

**데이터 누적/무손실**: `aggregate.json`의 `by_skill_invocation` 키로 직렬화. top-N cap 없음. JSONL 영구 저장이 누적을 보장한다.

**v1 한계**:
- 세션 가로지름 미지원 — 한 호출은 한 JSONL 세션 안에서만 닫힘.
- 미등록 슬래시 커맨드(`/clear`, `/help`, `/model` 등 Claude Code 내장)는 윈도우 미생성.
- `cost_usd`는 `collect.py`의 `PRICING` 표 v1 근사치.
- `periods/*.json` 및 `hourly.json`에는 미포함 (aggregate-only).

## v2 제한

- 페르소나 축 없음 — §D-1 폐기 결정.
- 프로젝트 그룹 축 없음 — I-OS 자체 모니터링이라 그룹 개념이 본 페이지 범위에 없음.
- 프롬프트 단위 데이터 미수집 — 따라서 프롬프트 Top 차트 없음.
- 시간대별 (시·분 단위) 리듬 차트 없음 — `collect.py` 의 집계 단위가 일자.
- 필터 UI 없음 — 모델/스킬 등 다중 선택 필터는 다음 단위로.
- 세션별 비용 분배 X — 세션 막대는 토큰 기준.
- `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/` 경로 하드코딩.
- 인증/접근 제어 X. localhost 바인드가 기본 안전 장치.

## 파일

```
monitoring/
├── README.md               # 본 문서
├── index.html              # 대시보드 페이지 (KPI + 차트 + 테이블)
├── script.js               # 클라이언트 렌더링 + Chart.js 인스턴스
├── styles.css              # 스타일
├── lib/
│   ├── chart.umd.js        # Chart.js (MIT, vendored)
│   └── LICENSE-chart.md
├── scripts/
│   ├── collect.py          # JSONL → aggregate.json (by_day cost 포함)
│   └── serve.py            # 로컬 HTTP 서버 + /api/refresh
└── data/
    ├── .gitkeep
    └── aggregate.json      # 런타임 산출물 (gitignored 권장)
```

권장 `.gitignore` 추가 (루트):
```
monitoring/data/aggregate.json
```

## 구버전 (Project-I) 데이터 백필

본 patch-note 버전부터 구버전 아이OS (Project-I) 의 세션 JSONL 이 `collect.py` 의 `SESSION_DIRS` 다중 디렉토리 확장으로 자동 통합되어, **2026-04-19 부터** 의 토큰·비용·모델·세션 축 데이터가 본 대시보드의 일자 단위 시각화 (`aggregate.json` 의 `by_day`) 에 표시된다.

- **표시되는 축**: 토큰 5종, 비용 (USD), 모델 (`claude-opus-4-6` / `claude-sonnet-4-6` 포함), 일/세션.
- **시간 단위 (`hourly.json`) 는 의도된 14일 롤링 윈도우** — 14일 이전 시간 버킷은 표시되지 않음. 일자 단위 시각화로 과거 이력 조회.
- **해석 주의**: 2026-05-10 이전 구간의 `by_skill` 라벨은 구버전 어휘 (페르소나명, 구 스킬명) 이다. 현재 I2 17 스킬 집합에 없는 라벨이 나타나는 것은 정상.
- **폐기된 축**: 구버전의 페르소나·프로젝트그룹 별도 축은 현재 모델에서 폐지되어 본 대시보드에 표시되지 않는다. 해당 분포가 필요하면 구버전 집계 파일 `/Users/starbox/Documents/GitHub/Project-I/monitoring/data/aggregate.json` 을 직접 참조.

자세한 호환성 분석은 `monitoring/docs/legacy-backfill-analysis.md` 참조.
