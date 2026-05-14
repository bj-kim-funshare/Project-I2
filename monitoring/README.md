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
