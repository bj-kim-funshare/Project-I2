# Chart.js — Vendored Copy

본 디렉토리의 `chart.umd.js` 는 OSRef-174 (I-OS 토큰 추적 대시보드) 의 외부 네트워크 0 의존 정책에 따라 vendor 한 사본이다. CDN 또는 npm 갱신 시 본 파일과 SHA-256 을 함께 갱신한다.

| Field | Value |
|---|---|
| **Version** | Chart.js v4.5.1 (UMD build) |
| **Origin URL** | https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.js |
| **SHA-256** | `ecc3cd1eeb8c34d2178e3f59fd63ec5a3d84358c11730af0b9958dc886d7652a` |
| **File size** | 208,518 bytes |
| **Downloaded** | 2026-04-29 |
| **License** | MIT |
| **Upstream license** | https://github.com/chartjs/Chart.js/blob/master/LICENSE.md |

## MIT License (요약)

```
The MIT License (MIT)

Copyright (c) 2014-2024 Chart.js Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## 갱신 절차

```bash
# 1) 신버전 다운로드
curl -sSL "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.js" -o monitoring/lib/chart.umd.js

# 2) 무결성 기록
shasum -a 256 monitoring/lib/chart.umd.js
wc -c monitoring/lib/chart.umd.js

# 3) 본 파일의 Version / SHA-256 / Downloaded / File size 필드 갱신

# 4) 별도 OSRef 발의 (vendor 갱신은 단독 단위)
```
