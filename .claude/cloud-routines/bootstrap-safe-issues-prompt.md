# /plan-enterprise data-craft 호출용 bootstrap 프롬프트

> data-craft 그룹의 routine 안전-리스트 파일 초기 생성. 본 문서의 "프롬프트 본문" 블록 전체를 `/plan-enterprise data-craft` 인자로 paste 하면 됨. 1회성 작업.

## 배경

`/review-check data-craft` 와 두 routine (data-craft / data-craft-server) 은 각 멤버 리포의 `i-dev` 브랜치에 있는 `.routine-state/safe-issues.json` 을 안전-리스트로 참조한다. 파일이 아직 없으면 routine 은 fallback 으로 동작하나 review-check 의 첫 갱신 commit 부터 정상화된다. 본 bootstrap 은 두 리포에 빈 안전-리스트 파일을 미리 만들어 routine fetch 의 404 fallback 비용을 제거하는 1회성 작업.

## 프롬프트 본문 (paste 대상)

```
data-craft 그룹의 routine 안전-리스트 파일을 두 멤버 리포의 i-dev 브랜치에 1회성 bootstrap 한다.

- 대상 리포 1: data-craft (bj-kim-funshare/data-craft)
- 대상 리포 2: data-craft-server (bj-kim-funshare/data-craft-server)
- 두 리포 공통 파일 경로: 리포 루트 기준 `.routine-state/safe-issues.json`
- data-craft 의 파일 내용: `{"repo": "data-craft", "safe_issues": []}`
- data-craft-server 의 파일 내용: `{"repo": "data-craft-server", "safe_issues": []}`
- 두 리포 모두 i-dev 브랜치에 commit + push 한 상태로 본 플랜 종결. 라벨 / 이슈 / PR / 코멘트 동작 불필요.

용도: 두 리포에 cron 실행되는 Claude Desktop Routine (`data-craft 클로즈 이슈 다관점 코드리뷰` / `data-craft-server 클로즈 이슈 다관점 코드리뷰`) 의 안전-리스트 fetch (`gh api repos/<owner>/<repo>/contents/.routine-state/safe-issues.json?ref=i-dev`) 가 404 fallback 을 거치지 않도록 사전 초기화. 본 작업 없이도 routine 은 빈 안전-리스트로 fallback 동작 가능하므로, /review-check data-craft 의 첫 안전 확정 commit 이 자연 발생하면 자동 정상화되어 본 bootstrap 은 권장이지 필수가 아님.

페이즈 분할은 plan-enterprise 가 본 free-form 설명을 기반으로 자율 수행 (멤버 리포 2건이므로 통상 2 페이즈 / 각 리포 1 파일).
```

## 사용 시점

마스터가 두 routine 을 Claude Desktop 에 등록하기 직전 또는 직후 1회 호출 권장. 호출 안 해도 routine 은 fallback 으로 동작하며 review-check 의 첫 갱신 commit 시점에 자동 정상화되므로 본 bootstrap 은 권장이지 필수가 아님.
