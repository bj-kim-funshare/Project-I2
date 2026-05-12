# I2 Monitoring (v1 minimal)

아이OS 자체 토큰 사용량 모니터링. 3 축 (모델 / 스킬 / 세션) + 일자별 타임라인을 로컬 대시보드에 시각화한다.

외부 네트워크 의존 0 — `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/*.jsonl` 만 읽음.

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

## v1 제한

- 그래프 X (테이블 view only). 향후 polish 단위에서 Chart.js 등 추가.
- 세션별 비용 분배 X (모델 비율 알고리즘 미구현 — '—' 로 표시).
- 일자별 비용 분배 X (모델 mix 가 일자별로 다른 경우 분배 알고리즘 필요).
- `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/` 경로 하드코딩. 다른 프로젝트 경로 모니터링 X.
- 인증/접근 제어 X. localhost 바인드가 기본 안전 장치.

## 파일

```
monitoring/
├── README.md               # 본 문서
├── index.html              # 대시보드 페이지
├── script.js               # 클라이언트 렌더링
├── styles.css              # 스타일
├── scripts/
│   ├── collect.py          # JSONL → aggregate.json
│   └── serve.py            # 로컬 HTTP 서버 + /api/refresh
└── data/
    ├── .gitkeep
    └── aggregate.json      # 런타임 산출물 (gitignored 권장)
```

권장 `.gitignore` 추가 (루트):
```
monitoring/data/aggregate.json
```
