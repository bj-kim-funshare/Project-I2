# Roadmap 14: data-craft FE AWS 이전 + 서버 도커화 + 크로스사이트 쿠키 해결

> 작성일: 2026-06-22 | 대상: data-craft(FE)+data-craft-server(BE) — GitHub Pages/CloudFront → AWS(S3+CloudFront / EC2 도커+ALB) 이전, api.datacraft.ai.kr same-site 정렬로 크로스사이트·시크릿 결제 쿠키 해결

## 프롬프트

🔴 /plan-enterprise data-craft data-craft-server BE 도커화 + 컨테이너 배포 기반 (Roadmap-14 1번). 호스팅은 기존 EC2 유지, 실행/배포만 컨테이너화. ① `Dockerfile`+`.dockerignore` 신규 작성(멀티스테이지: pnpm install→`pnpm build`(tsc)→런타임 이미지, `NODE_ENV=production`, 포트 노출). BE `.env` 는 정책상 git-tracked(메모리 `project_data_craft_env_secrets_git_tracked_by_policy`)이므로 이미지 베이크 대신 **런타임 마운트/주입** 설계(시크릿 레이어 잔존 방지). ② **`/storage` 퍼시스턴트 볼륨**: `app.use('/storage', …express.static('storage'))` 가 EC2 로컬 디스크를 읽으므로 호스트 `storage/` 디렉토리를 컨테이너에 볼륨 마운트 — 이미지 교체 시 업로드 파일 보존(미마운트 시 전손). ③ **`trust proxy` 재검증**: 현재 "CloudFront 프록시 뒤" 가정으로 X-Forwarded-For 기반 클라이언트 IP→rate limiting(`app.ts:20`). 앞단이 ALB 로 바뀌므로 `app.set('trust proxy', …)` 와 IP 추출 경로가 ALB forwarded 체인과 맞는지 점검·교정. ④ 컨테이너 기동·이미지 빌드·ECR 푸시·EC2 재기동을 묶는 배포 스크립트(`.claude/scripts/` 또는 repo) 작성 — 단 ECR/ALB 자원 생성 자체는 3·4번(인프라) 소관, 본 프롬프트는 **코드·스크립트·Dockerfile 까지**. 헬스체크는 기존 `/health`(DB 체크) 재사용. 페이즈마다 `pnpm build`(tsc) 검증 + fresh 워크트리 `pnpm install` 선행, 로컬 `docker build`+컨테이너 기동 실측.

🔴 /plan-enterprise data-craft data-craft data-craft-server 도메인·쿠키·URL same-site 정렬 (Roadmap-14 2번). 신 토폴로지(FE=datacraft.ai.kr, BE=api.datacraft.ai.kr)에 맞춰 코드 정렬 — **크로스사이트·시크릿 결제 쿠키 해결의 코드 본체**. ① BE `src/utils/cookie.ts`: prod 분기를 `sameSite:'none'`→**`sameSite:'lax'`** + **`domain:'.datacraft.ai.kr'`** 로 전환(secure 유지, dev 분기 무변경). set/clear 옵션 동일성 유지(clearCookie 가 발급과 같은 domain/path/sameSite 필요). ② FE `src/shared/config/env.ts`: `PRODUCTION_API_URL`·`PRODUCTION_STORAGE_URL`(현 `d3u7b7cxusjkuc.cloudfront.net`)을 **`https://api.datacraft.ai.kr`** 로 교체(스토리지도 api 통합). ③ FE `public/CNAME`(=datacraft.ai.kr) 처리: GitHub Pages 전환이므로 AWS(S3/CloudFront) 빌드에서 CNAME 의존 제거 검토 — vite `base:'/'` 는 유지(루트 배포). SPA 딥링크(`/login` 등)는 CloudFront 403/404→`/index.html` 에러응답으로 처리하므로(4번 인프라) 코드측은 기존 라우터 유지. ④ BE CORS(`app.ts:28`)는 이미 `*.datacraft.ai.kr` 허용 → 무변경 확인, 전환기 동안 구 cloudfront origin 병행 허용 여부만 판단. 페이즈마다 `pnpm build`(tsc)+fresh `pnpm install`. ⚠️ 본 프롬프트의 쿠키 전환은 BE 가 실제 `api.datacraft.ai.kr`(same-site)로 서빙돼야 효과가 나므로 4·6번 인프라/핸드오프 완료 후 배포에서 검증.

1️⃣ 🔴 (마스터 직접 — AWS 작업, 스킬 외) FE AWS 인프라 구성 (Roadmap-14 3번). ① S3 버킷(비공개, 정적 산출물) + **OAC(Origin Access Control)** 로 CloudFront 만 접근. ② CloudFront 배포 + **ACM 인증서(us-east-1, `*.datacraft.ai.kr` 와일드카드 권장)**. ③ **SPA 라우팅**: CloudFront 커스텀 에러응답 `403/404 → /index.html (200)`(현 GitHub Pages `/login` 404 문제도 해소). ④ Route 53 호스티드존 생성(apex ALIAS 지원 위해). 자원 식별자(버킷명·배포 ID·인증서 ARN)는 5번 group-policy 입력으로 기록. 4번과 독립 — 병렬 가능.

1️⃣ 🔴 (마스터 직접 — AWS 작업, 스킬 외) BE AWS 인프라 구성 (Roadmap-14 4번). ① **ECR** 리포 생성 + 1번 산출 이미지 빌드/푸시 + EC2 도커 기동(`/storage` 볼륨 마운트, `.env` 주입). ② **ALB**(HTTPS 종단) + 타겟그룹(EC2 컨테이너, 헬스체크 `/health`) + **ACM 인증서(서울 ap-northeast-2, `api.datacraft.ai.kr` 또는 `*.datacraft.ai.kr`)**. ③ 보안그룹·trust proxy 정합 확인(3번 코드와 대조). 앞단 = ALB 단독(확정). 3번과 독립 — 병렬 가능.

🔴 /group-policy data-craft deploy.md/dev.md AWS 토폴로지 갱신 (Roadmap-14 5번, 3·4번 자원 확정 후). deploy.md: `data-craft` deploy_command = **S3 sync + CloudFront invalidation**(gh-pages 대체), `data-craft-server` deploy_command = **도커 이미지 빌드→ECR 푸시→EC2 컨테이너 재기동**(`aws-deploy` 브랜치 pull 대체), target/인프라 메모를 신 자원(S3·CloudFront·ALB·ECR)으로 갱신. env_management 정합 유지, DB 드리프트 게이트 psql 좌표·admin 제외 규칙은 무변경 보존. 필요 시 dev.md `build_command`(예: AWS 빌드 변형) 동반 갱신. (.claude/project-group 파일은 I2 main 거주 — 단일 doc WIP.)

🔴 (마스터 직접 — 계정 보유자 핸드오프 1차) ACM 검증 + api 레코드 활성화 (Roadmap-14 6번). hosting.kr(메가존) 계정 보유자에게 **복붙용 레코드 표** 전달: ① Route 53 네임서버 4개로 교체(또는 hosting.kr 존에 직접 레코드), ② ACM 검증 CNAME(FE us-east-1 + BE 서울 인증서), ③ **`api.datacraft.ai.kr` → ALB ALIAS/A** 레코드. **apex `datacraft.ai.kr` 는 아직 GitHub Pages 유지**(컷오버는 10번). 입력 완료·인증서 ISSUED·api HTTPS 응답 확인까지. (account-gated — 본 단계 전까지 인증서 발급 대기.)

🔴 /dev-merge data-craft i-dev → main (Roadmap-14 7번, 1·2번 i-dev 머지 완료 후). 1·2번 코드(도커화 + 쿠키/URL 정렬)를 배포 기준 브랜치 main 으로 머지(브랜치 조합 카드 = i-dev → main). 멤버 repo(data-craft, data-craft-server) 일괄.

🔴 /pre-deploy data-craft AWS 빌드/배포 (Roadmap-14 8번, 5·6·7번 완료 후). 갱신된 deploy.md 기준으로 검증→FE(S3+CloudFront 배포)·BE(도커 이미지 ECR 푸시+EC2 컨테이너 재기동) 빌드/배포. DB 드리프트 게이트 통과 확인(dev=prod 미러). apex 컷오버 전이라 임시 도메인(CloudFront 기본 도메인 / api.datacraft.ai.kr)으로 신 환경 가동.

🔴 (마스터 직접 — 사전 실측 검증) 컷오버 前 신 환경 점검 (Roadmap-14 9번). apex 전환 전에 `api.datacraft.ai.kr` + CloudFront 기본 도메인(또는 임시 호스트)으로: HTTPS 정상, 로그인/세션 refresh(same-site 쿠키 set·동봉), **시크릿 모드 결제 1회 성공**, `/storage` 파일 접근, rate-limit IP 정상, SPA 딥링크(`/login`). 실패 시 2·4번으로 회귀. (시크릿 결제 = 본 로드맵 핵심 완료 기준.)

🔴 (마스터 직접 — 핸드오프 2차 + 컷오버) apex DNS 전환 + 롤백 대비 (Roadmap-14 10번, 9번 통과 후). ① 컷오버 前 apex TTL 인하(전파 단축). ② 계정 보유자에게 apex `datacraft.ai.kr` A/ALIAS → **CloudFront** 전환 요청. ③ GitHub Pages·기존 CloudFront(BE) 병행 유지(롤백 = DNS 즉시 복귀). 전파 확인.

🔴 (마스터 직접 — 컷오버 후 최종 실측) 운영 도메인 검증 (Roadmap-14 11번). `datacraft.ai.kr` 운영 도메인으로: HTTPS, 로그인/세션 refresh, **시크릿 모드 결제 1회 성공**, 딥링크, `/storage`, rate-limit, funshare.co.kr 랜딩 "무료 체험"→datacraft.ai.kr 동선. 안정 확인 후 구 GitHub Pages/구 CloudFront 정리는 후속(즉시 삭제 금지 — 롤백 윈도우).

🔴 /patch-confirmation data-craft origin 푸시 + patch-note (Roadmap-14 12번, 전체 검증 완료 후). 머지된 변경을 origin 으로 푸시하고 본 이전 작업 patch-note 정리.

---

## 로드맵 설명

마스터와의 검토(2026-06-22)로 확정한 **data-craft 인프라 이전 + 크로스사이트 쿠키 해결**을 12개 프롬프트로 분해한 로드맵. 핵심 동인은 두 가지: (1) FE 를 GitHub Pages 에서 AWS 로 이전, (2) **시크릿 모드 결제 실패**를 포함한 크로스사이트 쿠키 이슈를 BE 도메인을 `api.datacraft.ai.kr` 로 same-site 정렬해 근본 해결.

**핵심 결정**: ① BE 는 호스팅 이전 없이 **EC2 유지 + 도커화** — 도커화 ROI(prod 빌드 제거·환경버그 제거·즉시 롤백·이식성)는 이전 타이밍에 최적, 쿠버네티스(EKS)는 단일 Node API·소규모에 오버엔지니어링이라 제외(필요 시 후속 Fargate/App Runner). ② BE 앞단 = **ALB 단독**(`/storage` 가 인증 게이트라 CDN 이점 적음, CloudFront→ALB 의 쿠키 forwarding 복잡성 회피). ③ 스토리지 = `api.datacraft.ai.kr` 통합(BE 가 `express.static` 직접 서빙). ④ 쿠키 = `sameSite:'lax'`+`domain:'.datacraft.ai.kr'`(퍼스트파티화 → 시크릿 모드 포함 차단 면역, 멀티테넌트 `*.datacraft.ai.kr` 공유 부수효과).

**병렬 그룹 1(3·4번)**: FE 인프라(S3/CloudFront/us-east-1 ACM)와 BE 인프라(ECR/ALB/서울 ACM)는 서로 다른 자원·repo 무관으로 독립 → 동시 진행 가능. 그 외는 의존성상 순차.

**순차 의존 근거**: 1(도커화)→4(이미지 ECR 푸시 전제), 1·2(코드)→7(i-dev→main)→8(배포), 3·4(자원)→5(deploy.md 가 자원 식별자 참조)→8, 6(핸드오프1=인증서·api 활성)→8(HTTPS 배포)·9(검증), 9(사전검증 통과)→10(apex 컷오버)→11(운영 실측). 코드 plan-enterprise 2건(1·2번)은 **동일 리더 병렬 금지**(메모리 `feedback_patchnote_version_collision_shared_main`·`feedback_parallel_job_roadmap_track_collision` — i-dev/patch-note 충돌) 근거로 순차.

**계정 의존 분리(6·10번)**: 도메인 계정은 마스터 미보유 — "계정이 해야 할 작업 외 전부 처리 후 전달" 방침에 맞춰, AWS 자원·코드는 전부 선구축하고 계정 보유자 작업(네임서버·검증 CNAME·api 레코드=6번 / apex 컷오버=10번)만 복붙 레코드 표로 모아 핸드오프. 인증서 발급은 6번 전까지 대기 상태로 멈추는 구조적 제약 존재.

**완료 기준(핵심)**: 9번·11번의 **시크릿 모드 결제 1회 성공** — 크로스사이트 쿠키 해결의 직접 증거. 부수로 SPA 딥링크 404 해소(CloudFront 에러응답), HTTPS 무손실(ACM 무료).

**위험**: ① `/storage` 볼륨 미마운트 시 업로드 전손(1번 명시). ② trust proxy 오설정 시 rate-limit IP 오작동(1번 점검). ③ apex 는 CNAME 불가 → Route 53 ALIAS 필요(3번). ④ 인증서 리전 혼동(CloudFront=us-east-1, ALB=서울 — 각 1장). ⑤ 컷오버 롤백 윈도우 동안 구 GitHub Pages/CloudFront 즉시 삭제 금지(11번). ⑥ funshare.co.kr(Firebase 랜딩, harness 밖)은 본 이전과 무관 — "무료 체험"이 datacraft.ai.kr 유지 시 무변경. ⑦ 도메인 등록인=펀셰어/메가존(hosting.kr), funshare.co.kr 만료 2026-10-27 별건 점검 권장.
