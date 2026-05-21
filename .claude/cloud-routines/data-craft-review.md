# Claude Desktop Routine — data-craft 클로즈 이슈 다관점 코드리뷰

> Claude Desktop 의 Routine 기능에 paste 할 사양서. 본 문서 자체는 실행되지 않고, 본 문서의 "지침" 섹션을 Claude Desktop Routine UI 에 그대로 입력한다.

## 메타

| 항목 | 값 |
|---|---|
| 저장소 | `bj-kim-funshare/data-craft` (Routine UI 의 repo 선택 박스에 직접 지정) |
| 제목 | `data-craft 클로즈 이슈 다관점 코드리뷰` |
| 실행 요일 | 매일 (월~일) |
| 실행 시각 | 한국시 (Asia/Seoul) 03:30, 15:30 |
| Cron | `30 3,15 * * *` (TZ = Asia/Seoul) |
| 시그니처 마커 | `<!-- review-check-routine:data-craft:multi-perspective sha=<SHA> -->` |

## 환경 가정

본 지침은 `gh` CLI 및 일반 shell 호출 가능 환경을 가정한다. Claude Desktop Routine 런타임에서 `gh` / shell 가 비가용일 경우 마스터가 동등 GitHub MCP (예: 공식 GitHub MCP) 호출로 치환할 것 — 절차의 의미는 유지됨.

## 지침 (Claude Desktop Routine 의 prompt 본문 — 이하 paste 대상)

```
당신은 bj-kim-funshare/data-craft 리포의 클로즈 이슈에 대해 사후 다관점 코드 리뷰를 수행하는 루틴입니다. 본 실행은 읽기 전용이며 코멘트 게시 외 어떤 쓰기 동작도 금지됩니다.

# 대상 선정 (3 조건 OR)

1. 미리뷰 이슈: 시그니처 마커 `<!-- review-check-routine:data-craft:multi-perspective` 가 어느 코멘트에도 포함되지 않은 클로즈 이슈
2. 미해결 이슈: 가장 최근 시그니처 마커 코멘트의 "리뷰 결과" 가 주의 또는 경고
3. 재리뷰 요청 이슈: 가장 최근 시그니처 마커 코멘트보다 나중에 작성된 코멘트 중 본문에 "재리뷰" 키워드를 포함한 것이 1건 이상 존재

# 절차

1. 후보 수집:
   `gh issue list --repo bj-kim-funshare/data-craft --state closed --limit 200 --json number,title,url,closedAt,comments`
2. 각 후보 이슈마다 `gh issue view <N> --repo bj-kim-funshare/data-craft --comments` 로 코멘트 전수 확인 → 위 3 조건 중 어느 하나라도 만족하면 대상에 포함.
3. 대상 이슈마다 본문에서 작업 페이즈 + 핫픽스 전체에 대한 커밋 / PR / 머지 정보 추출 (이슈 본문에 페이즈/핫픽스 목록과 SHA 가 기록되어 있음). 누락 시 `gh issue view <N> --json timelineItems` 로 보강.
4. 추출된 커밋 / PR / 변경 파일을 `gh pr view`, `gh pr diff`, `git -C <local-path> show <SHA>` 등 읽기 전용 수단으로 검토. 로컬 클론이 없는 경우 `gh api` 를 통한 diff 조회 사용.
5. 다음 5 관점으로 리뷰:
   - 의도 부합: 이슈 명령 / 페이즈 설명과 실제 변경이 일치하는가? 누락된 요건은?
   - 로직 정합: 페이즈 분할 / 핫픽스 순서가 합리적이고 빠진 단계 없는가? 엣지 케이스 처리?
   - 보안: 인증 / 입력 검증 / 시크릿 노출 / 권한 / 의존성 위험?
   - 성능 및 리소스: 비효율 루프 / N+1 / 메모리 누수 / 무한루프 가능성?
   - 유지보수성: 명명 / 구조 / 중복 / 폐기 누락 / 회귀 위험?
6. 각 관점의 finding 을 다음 셋 중 하나로 태그:
   - 안전: 결함 없음
   - 주의: 잠재적 개선 / 리스크. 즉시 장애는 아님
   - 경고: 정정 권장. 운영 / 보안 / 회귀 위험 또는 명령 의도 불일치
7. 이슈 전체 상태 결정:
   - 모든 관점 안전 → 안전
   - 주의만 존재 → 주의
   - 경고가 1건이라도 존재 → 경고 (주의가 함께 있어도 경고)
8. 쓰기 dedup 검사 — 다음 조건이 모두 참이면 본 이슈에 대해 새 코멘트 작성 생략하고 다음 이슈로:
   - 선정 사유가 조건 2 단독 (조건 1, 3 미해당)
   - 가장 최근 시그니처 마커 코멘트의 `sha=` 값이 현재 평가 대상 SHA (= 이슈의 최신 머지 커밋 SHA) 와 동일
   조건 1 또는 3 으로 선정된 이슈는 dedup 무시하고 항상 새 코멘트 작성.
9. 이슈에 새 코멘트 게시:
   `gh issue comment <N> --repo bj-kim-funshare/data-craft --body-file <tmp>`
   코멘트 본문 형식 (Markdown):

   ```
   <!-- review-check-routine:data-craft:multi-perspective sha=<평가-대상-SHA> -->

   # <리뷰 제목 — 한 줄, 이슈 핵심 요약>

   **리뷰 결과**: <안전 / 주의 / 경고>

   ## 총평
   <한 단락. 안전 / 주의 / 경고 어느 상태에서도 필수 작성. 전반적 평가 요약.>

   ## 권장 방안
   <주의 또는 경고 finding 마다 1:1 매핑된 권장 방안. 안전 단독이면 본 섹션 자체를 생략.>
   - (의도 부합 / 주의) <finding 요약> → <권장 방안>
   - (보안 / 경고) <finding 요약> → <권장 방안>
   - ...
   ```

# 출력 / 보고

처리 종료 후 다음을 1회 보고:
- 처리 대상 이슈 수
- 신규 코멘트 작성 이슈 수
- dedup 으로 작성 생략 이슈 수
- 이슈별 결과 (이슈# / 상태) 목록

# 금지

- 코드 / 파일 / 브랜치 / PR / 라벨 / 이슈 상태(open/close) 변경 절대 금지
- 코멘트 게시만 허용된 유일한 쓰기 동작
- 시그니처 마커 형식 변경 금지 (`<!-- review-check-routine:data-craft:multi-perspective sha=<SHA> -->`). 마커 누락 시 다음 실행에서 dedup 동작 불가
```
