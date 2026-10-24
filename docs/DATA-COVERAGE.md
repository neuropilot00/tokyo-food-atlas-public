# 데이터 범위와 시장 API 계약

검증일: 2026-10-24. 데이터 관측일·수록 분기·다운로드 날짜는 서로 다릅니다.

## 현재 포함한 자료

| 자료 | 포함 범위 | 자료 시점 | 해석 |
|---|---:|---|---|
| 소진공 음식업소 레코드 | 840,255건, 256시군구, 3,557행정동, 43세부업종 | 2026-06-30 스냅샷 | 원본 업소 id 기준. 물리적 점포 중복 제거·현재 영업 확인·방문 고객 연령 검증을 하지 않음 |
| 행안부 주민등록 연령 | 16시도 + 256시군구 + 3,556행정동 = 3,828개 지역 연결 | 2026-09-30 월말 | 거주자·거주불명자·재외국민 포함, 외국인 제외. 유동인구나 구매 고객 수가 아님 |
| 서울 상권 인구 | 1,650상권, 25구 | 2026년 2분기 수록 | 상주·직장·생활인구. 개별 점포 고객과 다름 |
| 서울 음식업종 집계 | 1,650상권 × 10업종 요청 조합 | 2026년 2분기 | 원본 12,187행 존재, 4,313조합은 null |
| 도쿄 경제센서스 | 5,332개 세부지역 | 2021-06-01 | 민영 사업체/종사자/음식점 집계. 현재 점포 수나 유동인구가 아님 |
| 일본 전국 지역 검색 | 47도도부현, 1,898시구정촌 | Geolonia 제공자 스냅샷 2024-12-25 | 시구정촌 청사 대표점. 상권 중심이나 음식점 좌표가 아님 |
| 도쿄 세부지역 좌표 | 5,332개 중 5,316개 | Geolonia 스냅샷 2024-12-25 | 町字 대표점. 해결되지 않은 16개는 null |

한국 검색 인덱스는 서울 상권 1,650 + 행정동 3,557 + 시군구 256 + 시도 16 = 5,479개입니다. 일본은 도쿄 세부지역 5,332 + 시구정촌 1,898 = 7,230개입니다. 검색 결과에는 서로 겹치는 지리 단위가 있으므로 총합을 인구·점포 총계로 해석하지 않습니다.

소진공 원본은 시도 코드 16개를 사용하며 코드12를 `전남광주통합특별시`로 수록합니다. 과거 광주29/전남46 또는 17개 시도를 하드코딩하지 않습니다. 공급자 코드를 보존했습니다.

행안부 원본은 3,919행(16시도/280시군구/3,623읍면동)입니다. 소진공 지역 코드와 동일한 행정단위를 정확 코드로만 연결했습니다. 시도2자리+0여덟 개, 시군구5자리+0다섯 개, 행정동8자리+0두 개가 행안부10자리 코드와 같고 단위 수준도 같은 경우에만 사용합니다. 검색되는3,557개 행정동 중 구지면 `27710380` 하나는 동일 코드가 없어 인구를 null로 유지합니다. 다른 이름이나 새 경계로 추정 연결하지 않습니다. 원본의0명은 실제값으로 보존하며 없는 행을0명으로 채우지 않습니다.

행안부11개 원연령 구간 합계와 총인구가3,919행 모두 일치합니다. 앱의 첫 구간은0–19세이며 `residents.sourceAgeLabel='0–19세'`로 표시합니다. 서울 상권 자료의 `연령구간10`과 별도로 취급합니다. `residents.censusMonth='2026-09'`와 `observedDate='2026-09-30'`를 기록하며, 지역의 음식업소 자료 시점인 `sourcePeriod='2026-06-30'`를 바꾸지 않습니다. 행안부 값을 서울1,650개 상권 인구에 덮어쓰지 않습니다.

서울 상주인구는 1,633상권, 직장인구는 1,641상권, 생활인구는 1,648상권에 해당 분기 행이 있습니다. 없는 행은 null입니다. 생활인구 총계를 일평균·고유 방문자·현재 거리 인원으로 환산하지 않습니다. `연령구간10`의 범위가 검증되지 않아 임의로 0–19세라고 바꾸지 않습니다.

도쿄 2021 자료를 최신 일본 센서스로 소개하지 않습니다. 2024 기초조사 확정치도 존재하지만 고용자가 없는 개인사업체 제외 등 조사 범위가 달라 이번 町丁目 자료와 곧바로 시계열 비교할 수 없습니다. 공식 안내: https://www.stat.go.jp/data/e-census/2024/kekka.html

## 기존 데이터 보존

`public/data.json`은 한국6/일본6개 초기 지역만 포함합니다. 한국6개는 같은 공식 수치에 원천 필드/결측 메타데이터를 보강했습니다. 일본6개는 기존 id와 주민등록 인구를 유지했고, 도쿄 전체 경제센서스의 동일 지역과 결합했습니다. 동일 지역을 새 id로 중복 등록하지 않았습니다.

일본6개 지도의 기존 표시점은 `legacyCoordinates`에 보존했습니다. 현재 표시점은 출처가 있는 Geolonia 대표점이며 `coordinateMetadata`에 매칭 방법·원천 시점·대표점 수준을 유지합니다. 최초 자료는 `public/market/legacy-core.json`에 있습니다.

## API

### `GET /api/regions`

파라미터: `country=KR|JP`, `q`, `province`(제공자 코드 또는 이름), `limit`(기본20, 최대50), `id`(선택).

`id`가 있으면 선택 국가 안에서 해당 `area.id`만 정확 조회하고 `q/province`는 무시합니다. 저장한 지역을 새로고침 후 복원할 때 사용합니다. 빈 id/지원하지 않는 문자 형식은HTTP400이고 정상 형식의 없는id는 `regions:[],total:0`입니다.

응답은 `{country, q, province, total, limit, regions, provinces, version, coverage}`입니다. `provinces`는 `{id,name}` 목록입니다. `regions`에는 선택 후 바로 상세 화면에 쓸 수 있는 기존 area 모델을 반환합니다.

각 지역에는 `id/name/lat/lng/province/district/kind/areaM2/residents/workers/flow/coverage/sourcePeriod/coordinateBasis`가 포함됩니다. 미연결 인구의 `total`과 `groups`는 null이고 유동인구는 null일 수 있습니다. 좌표도 null일 수 있습니다. 모든 렌더러는 null을 검사해야 합니다. 전국 한국의 행정구역 표시점은 포함된 음식점 좌표 평균이며 공식 행정경계 중심이 아닙니다.

### `GET /api/shops`

한국 파라미터: `country=KR`, `lat`, `lng`, `radius`(기본500m, 1–2000m), `limit`(기본30, 최대100), `offset`(0–10000), `category`, `q`.

`category`는 원자료 세부업종코드, 정확한 업종명 또는 기존 UI 분류 `korean/chinese/japanese/western/bakery/fast_food/chicken/bunsik/pub/cafe`를 받습니다. 알 수 없는 분류는 HTTP400입니다. 업종 매핑은 필터 편의를 위한 명시적 코드 목록이며 새로운 산업분류 추정이 아닙니다.

작은 시군구 bbox 인덱스를 먼저 읽고 범위와 겹치는 여러 시군구 청크를 순차 조회합니다. Haversine 거리로 최종 필터합니다. 선택한 시군구 안으로 제한하지 않으므로 경계 너머 후보도 나옵니다. 한 요청에서 최대8청크를 읽습니다.

응답의 `shops`에는 실제 원본 id/상호/주소/업종/좌표/거리, `sourcePeriod`, `observedAt`, `customerAge:null`, `currentOperation:'unverified'`가 있습니다. `observedAt`은 원본 스냅샷 기준일이며 현장 확인일이 아닙니다. `total`은 조회한 원천 자료에서 매치한 레코드 수입니다. `countUnit='source_food_business_record'`, `physicalOutletDeduplication=false`입니다. 상호·주소가 같아도 원본 id가 다르면 별도 레코드이며 물리적인 고유 매장 수로 해석하지 않습니다. 기존 호환용 `storeCount/foodStores` 필드도 이 레코드 수를 뜻하며 새 `storeRecordCount/foodStoreRecords` 필드와 값이 같습니다.

청크 한도를 넘으면 `coverage.complete=false`, `truncatedByChunkLimit=true`, `totalIsExact=false`입니다. 이를 완전한 반경 경쟁점 수로 표시하면 안 됩니다. `pagination`에는 limit/offset/returned/hasMore/nextOffset/totalIsExact가 있습니다. 현재 영업 여부·모든 점포 포함 여부까지 검증한 총계는 아닙니다.

일본 점포 조회는 `marketApi`에서 null을 반환해 루트의 인증키 기반 제공자 라우트에 위임합니다. 전국 일본 주소 검색이 가능하다는 이유로 일본 음식점 목록까지 연동된 것으로 표시하지 않습니다.

### `GET /api/market/competition?areaId=...`

기존 competition 모델 `{areas:[선택상권],industry_catalog,source,...}`을 반환합니다. 서울 공식 집계가 없는 지역은 HTTP404와 `areas:[]`입니다. 원천 행이 없는 업종은 count가 null입니다. `reported_store_count`는 해당 분기 집계이고 현재 영업점 수가 아닙니다. 원본의 폐업수가 전체 점포수보다 큰 100행은 원천 검증 플래그와 `recommendation_eligible=false`를 유지합니다.

### `GET /api/market/status`

현재 패키지 버전·범위·자료 시점·한계를 반환합니다. 외부 제공자 계정이나 실시간 연결 성공을 의미하지 않습니다.

## 저장소와 릴리스 일관성

`lib/market-data.mjs`는 `marketApi(request, env, path)`와 `readMarketJson(path, env, request?)`를 export합니다.

D1 `market_cache`의 `key='active-market-version'`에서 `{version}`을 읽습니다. 활성 버전이 없으면 `env.ASSETS.fetch`로 내장 자료를 사용합니다. Vite 개발 환경에서는 `readMarketJson(path, env, request)`의 세 번째 인자로 원래 Request를 전달해야 합니다. 허용된 요청 origin을 기준으로 `/market/...` URL을 만들며 기존 query·쿠키·인증헤더를 전달하지 않습니다. 요청이 없는 production/RPC 호출은 Cloudflare가 문서화한 `https://assets.local` 기준 URL을 사용합니다. Vite 공식 문서: https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/

활성 버전이 있으면 R2 `releases/{version}/{path}`만 읽습니다. 활성 릴리스의 파일 누락·읽기 실패는 HTTP503이며 내장 자료와 섞지 않습니다. 요청 하나는 시작 시 선택한 버전을 고정합니다. 오류 응답의 `diagnosticCode`는 고정된 분류코드이며 원문 예외·키·응답본문을 노출하지 않습니다.

최상단 `public/market/manifest.json`은 상대경로·SHA256·바이트수를 나열합니다. manifest 자신의 해시 순환을 피하기 위해 `files`는 자신을 제외하고, `fileCount`는 자신을 포함한 실제 파일 수입니다. 현재 버전은 `2026-10-24-beta-2`, `fileCount=442`, `files.length=dataFileCount=441`, `manifestExcludedFromFiles=true`입니다. 전체 파일은 약249.8MB이며 최대 단일 파일은4,679,506바이트로6MiB 한도 미만입니다. 정확한 합계는 manifest의 `totalBytes`(자신 제외)에 manifest 파일 바이트 수를 더한 값입니다. 업소 레코드 청크는256개/208,287,837바이트이고 gzip 합계는33,322,415바이트였습니다.

## 검증

프로젝트 루트에서 실행합니다.

```bash
node tests/market-data.test.mjs
```

18개 검증: 입력 범위·기존 한국/일본 값 보존·전국 주민연령 코드 연결 및 시점 구분·미매칭 코드 null·한국어 일본 검색·실제 카페 반경 검색·시군구 경계 검색·페이지 중복·전국 테스트 좌표·업종 행 누락·일본 제공자 위임·R2 실패 시 혼합 방지·HTTP 메서드·8청크 부분조회 표시·도쿄 좌표 결측·ASSETS 요청 origin 유지와 자격증명 미전달·요청 없는 production/RPC fallback·exact id 복원. 전국 CSV 전처리에서는 업소 id 중복, 좌표 범위, 시도/시군구/행정동별 합계도 확인했습니다. 업소 id 고유성 검증은 물리적 점포의 중복 제거를 뜻하지 않습니다.
