# /plan-enterprise data-craft 호출용 bootstrap 프롬프트

> data-craft 그룹의 routine 안전-리스트 파일 초기 생성. 본 문서의 "프롬프트 본문" 블록 전체를 `/plan-enterprise data-craft` 인자로 paste 하면 됨. 1회성 작업.

## 배경

`/review-check data-craft` 와 두 routine (data-craft / data-craft-server) 은 각 멤버 리포의 `i-dev` 브랜치에 있는 `.routine-state/safe-issues.json` 을 안전-리스트로 참조한다. 파일이 아직 없으면 routine 은 fallback 으로 동작하나 review-check 의 첫 갱신 commit 부터 정상화된다. 본 bootstrap 은 두 리포에 빈 안전-리스트 파일을 미리 만들어 routine fetch 의 404 fallback 비용을 제거하는 1회성 작업.

## 프롬프트 본문 (paste 대상)

```
data-craft 그룹의 routine 안전-리스트 파일 초기 bootstrap.

다음 2개 리포 각각에 빈 `.routine-state/safe-issues.json` 을 i-dev 브랜치 기준으로 생성한다:

### Phase 1 — data-craft 리포
Phase 1 work repo: data-craft
type: doc/new
affected_files:
- .routine-state/safe-issues.json

파일 내용:
{
  "repo": "data-craft",
  "safe_issues": []
}

### Phase 2 — data-craft-server 리포
Phase 2 work repo: data-craft-server
type: doc/new
affected_files:
- .routine-state/safe-issues.json

파일 내용:
{
  "repo": "data-craft-server",
  "safe_issues": []
}

### 작업 완료 시 동작

각 리포의 i-dev 브랜치에 위 파일이 commit + push 된 상태로 본 플랜 종결. 별도 후속 코멘트 / 라벨 / PR 동작 불필요. 본 bootstrap 은 routine 동작에 즉시 반영되며 다음 routine 사이클부터 안전-리스트 fetch 가 정상 200 응답을 받는다.
```

## 사용 시점

마스터가 두 routine 을 Claude Desktop 에 등록하기 직전 또는 직후 1회 호출 권장. 호출 안 해도 routine 은 fallback 으로 동작하며 review-check 의 첫 갱신 commit 시점에 자동 정상화되므로 본 bootstrap 은 권장이지 필수가 아님.
