# 원자료 출처, 해시와 재생성

이 문서는 2026-10-24 확보 자료의 기록입니다. 현재 공개 다운로드가 바뀌면 아래 해시와 달라질 수 있으며, 새 관측일/라이선스를 확인한 새 버전으로 수집해야 합니다. 353MB ZIP이나 1.53GB 압축 해제 CSV를 저장소에 추가할 필요는 없습니다. 실행에 필요한 정규화된 JSON은 `public/market`에 있습니다.

## 1. 한국 전국 음식업소 레코드

공식 카탈로그: https://www.data.go.kr/data/15083033/fileData.do

원본명: `소상공인시장진흥공단_상가(상권)정보_20260630.zip`.

- 압축 파일:352,699,739바이트.
- SHA256:`57aa361544108ff4fc73334f87d2ced61e41fe8638dd70bcd842930f865d2386`.
- 내부16개 UTF-8 CSV 합계:1,527,607,589바이트.
- 전체 업종2,772,484행 중 음식 대분류 `I2` 840,255행.
- 제공자:소상공인시장진흥공단. 이용허락범위 제한 없음. 분기 갱신.

정상 공개 다운로드 절차를 사용했습니다. 카탈로그의 다운로드 버튼이 호출하는 `/tcs/dss/selectFileDataDownload.do`에 공개 데이터 id와 공개 상세 id를 POST하여 `status:true`/첨부파일 id를 받은 다음, `/cmm/cmm/check-limit.json`에 첨부파일 id와 일련번호를 POST했습니다. `needCaptcha:false`를 확인하고 파일을 받았습니다. CAPTCHA/로그인이 요구되면 자동화를 멈추고 정식 다운로드 경로를 이용해야 합니다.

당시 첨부파일 id는 `FILE_000000003695831`, 일련번호는1이었습니다. 확인된 파일 URL:

https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003695831&fileDetailSn=1

공개 상세 id는 `uddi:b3094bc9-8756-4ecc-9141-9144b98a531e`였습니다. 파일/상세 id는 영구 API 계약이 아니므로 다음 분기에는 카탈로그의 정상 다운로드 메타데이터를 새로 읽습니다.

전처리는 CSV 헤더 이름으로 필드를 읽고 음식 코드I2만 추출했습니다. 상가업소번호를 키로 중복을 검사했고 시도/시군구/행정동 코드를 원문 그대로 보존했습니다. 상호·주소가 같은 서로 다른 원본 id는 보존했으며 물리적 점포 기준으로 중복 제거하지 않았습니다. WGS84 좌표를 소수점6자리로 반올림했습니다. sourcePeriod는2026-06-30, 실제 영업 상태와 고객 연령은 확인되지 않은 상태입니다.

인증 API 원문: https://www.data.go.kr/data/15012005/openapi.do

공식 base는 `https://apis.data.go.kr/B553077/api/open/sdsc2`이며 `storeListInRadius`, `storeListInDong`, `storeListByDate`를 제공합니다. 반경 조회의 인증 파라미터 이름은 `ServiceKey`, 반경 최대2000m, `cx`는경도/`cy`는위도입니다. 변경분은 `key=YYYYMMDD`, `chgGb=C/U/D`를 사용합니다. 실제 키의 승인/연결을 확인하기 전에는 연동 완료라고 표시하지 않습니다.

인허가 보완 원천: https://www.data.go.kr/data/15154916/openapi.do

새 공식 API는 `https://apis.data.go.kr/1741000/general_restaurants/info`입니다. `serviceKey`와 최대100건 페이지, 갱신시각 구간 필터 `cond[DAT_UPDT_PNT::GTE]`/`cond[DAT_UPDT_PNT::LT]`가 있습니다. 원천 관리번호는 소진공 업소번호와 같지 않습니다. 이번 실행에서는 키가 없어 실제 응답을 취득하지 않았습니다. 연결 설계와 실제 취득 자료를 구분합니다.

## 2. 서울 전체 상권

공식 공개 Sheet 전체 CSV의 POST 내려받기를 사용했습니다. endpoint는 `https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do`입니다. 공통 form:

```json
{"srvType":"S","infId":"데이터셋ID","serviceKind":"1","pageNo":"1","gridTotalCnt":"","ssUserId":"SAMPLE_VIEW","strWhere":"","strOrderby":"STDR_YYQU_CD DESC","filterCol":"","txtFilter":""}
```

영역 자료OA-15560은 strOrderby를 빈 문자열로 보냈습니다. API5행 샘플이 아니라 전체 CSV를 취득했고 CP949로 읽었습니다. 연도/분기는20262만 선택했습니다. 공공누리1유형으로 출처 표시가 필요합니다.

| 원천 | 공식 카탈로그 | 바이트 | SHA256 |
|---|---|---:|---|
| 상주인구 | https://data.seoul.go.kr/dataList/OA-15584/S/1/datasetView.do | 6,687,358 | `d93c24929675302026308ba5f12b097636ec3bf5f97870e802e0b06e8f0e2bb4` |
| 직장인구 | https://data.seoul.go.kr/dataList/OA-15569/S/1/datasetView.do | 5,741,054 | `9987bbbdaf9f1623713839bf4994aa2100e60574f00e83ff03def97f1abbb50d` |
| 생활인구 | https://data.seoul.go.kr/dataList/OA-15568/S/1/datasetView.do | 8,543,807 | `9a481ee97de352d9a69d9c89b05b9d1338ef1fa38c20563f89901ca818b7e0cb` |
| 상권 영역 | https://data.seoul.go.kr/dataList/OA-15560/S/1/datasetView.do | 175,854 | `6a6e19141f39712594a2eb42199e38e98ca2c8c06c5d4c5bd3fa39aee06ffd15` |
| 점포 집계 | https://data.seoul.go.kr/dataList/OA-15577/S/1/datasetView.do | 46,065,487 | `511d4ebb81bfb3f163ef8040b869e30a76bbc78622afa7eb60096874fa678a1a` |

지역은 공식 영역 id로 조인했습니다. 원본 열, 행 번호, 추정 여부와 결측값을 유지했고 다른 해의 자료로 결측을 채우지 않았습니다. 좌표 변환은 영역 원자료의 좌표계에 맞춘 pyproj 처리를 사용했습니다. API 결과 각 수치에는 sourceId/sourceCsvRow가 있습니다.

## 3. 도쿄 경제센서스

공식 설명/라이선스: https://spec.api.metro.tokyo.lg.jp/spec/t000003d2000000954-ab187a0bd49660eedf07684872908142-0

POST endpoint:

`https://service.api.metro.tokyo.lg.jp/api/t000003d2000000954-ab187a0bd49660eedf07684872908142-0/json?limit=1000&offset=0`

API에는 등록이나 키가 필요하지 않습니다. 최대1000건씩 offset을 전진해14페이지를 순차 취득했습니다. `numericAndSearch`에서 `集計項目コード <= 20`을 지정해 사업체수10과 총 종사자수20만 받았습니다. 필요한 column은 지역계층/원본지역코드/시구정촌/町大字/丁目字/지역명/집계항목코드·명/총수/숙박음식서비스 합계/숙박업75/음식점76/포장배달77입니다.

13,134행을 요청/출처 메타데이터와 합친 재현용 JSON은6,920,871바이트이고 SHA256은 `6e544e607bf6c8e729c8b7d860315649561ae343714433ee98f1fb925b0f297d`입니다. 이는 원 CSV 해시가 아니라 이 요청의 병합 JSON 해시입니다.

자료 관측일2021-06-01, API 메타데이터 갱신2024-03-19, CC BY입니다. 지역계층2/3/4를 구분하고 중첩되지 않는 가장 세부 지역을 선택했습니다. 숫자가 아닌 억제/공란은 null이며 원문 값은 별도 전처리 산출물에 보존했습니다. 원본 코드1312105400은 足立区舎人公園/足立区中川에 중복되어 앱 id에 원자료 행 번호 suffix를 붙였습니다.

## 4. 일본 지역 좌표

제공자: https://github.com/geolonia/japanese-addresses-v2

전국 메타데이터: https://japanese-addresses-v2.geoloniamaps.com/api/ja.json

전국 원본314,034바이트, SHA256:`9a642d741607d9ce7b6624a1d2d0a499d810de4fe702410acddb0e4e94ef0a7b`.

시구정촌별 데이터 경로는 제공자 문서대로 `api/ja/{도도부현}/{시구정촌}.json`입니다. 도쿄62개 파일을 순차 취득했습니다. 예를 들어 신주쿠 원본37,967바이트 SHA256은 `8a4a80716a70d403cfde4e0ad2e779cf8fea01d364a52a8e6a5f212782cb3eca`입니다.

원천 라이선스는CC BY4.0, 제공자 스냅샷은2024-12-25입니다. 2026-10-24는 조회일입니다. 좌표는 GeoJSON 순서 longitude/latitude를 해석해 EPSG4326 위경도로 보존했습니다. 이름 매칭은 NFKC/丁目 숫자 정규화, 충돌을 검사한 제한적 표기 변이만 허용했습니다. 매칭되지 않은16개 세부지역은null입니다. 디지털청의 더 최신 자료 메타데이터는 확인했지만 ZIP은403이어서 그 좌표를 사용했다고 표시하지 않습니다.

## 5. 한국 전국 주민등록 연령

공식 조회 화면: https://jumin.mois.go.kr/ageStatMonth.do

공식 카탈로그와 이용 조건: https://www.data.go.kr/data/3033304/fileData.do — 무료, 이용허락범위 제한 없음.

공개 CSV 다운로드 URL: `https://jumin.mois.go.kr/downloadCsvAge.do?searchYearMonth=month&xlsStats=3` (POST).

로그인이나 API 키 없이 공식 화면의 CSV form으로 취득했습니다. 사용한 form은 아래와 같으며 해당 자료월이 제공되는 정상 공개 다운로드를 재현하기 위한 값입니다.

```json
{"sltOrgType":"1","sltOrgLvl1":"A","sltOrgLvl2":"","gender":"","sum":"sum","sltUndefType":"","searchYearStart":"2026","searchMonthStart":"09","searchYearEnd":"2026","searchMonthEnd":"09","sltOrderType":"1","sltOrderValue":"ASC","sltArgTypes":"10","sltArgTypeA":"0","sltArgTypeB":"100","category":"month","state":"3","stateMobile":"3"}
```

원 CSV는CP949,508,803바이트,3,919행+헤더입니다. SHA256은 `e39d5b999bef885669e7ee66bad43a84e22f180ba0bdae0d5d8707c45f788c39`입니다. 기준일은2026-09-30이며 다운로드일2026-10-24와 다릅니다. 주민등록 전체는 거주자·거주불명자·재외국민을 포함하고 외국인을 제외합니다.

행정구역 열의 괄호 속10자리 코드를 보존합니다. 시도16행/시군구280행/읍면동3,623행이며 코드는 모두 고유했습니다.11개 원연령 구간(0–9/10–19/…/90–99/100+)의 합계가 원본 총인구 및 연령구간총계와3,919행 모두 일치합니다. 실제0명15행은0으로 보존하고, 원본에 없는 행은null입니다. UI에서0–19/20–39/40–59/60+로 묶되 원구간도 보존합니다.

소진공 지역 코드와는 같은 행정 수준에서 정확 코드로만 결합합니다. 시도2자리에는0여덟 개, 시군구5자리에는0다섯 개, 행정동8자리에는0두 개를 덧붙여10자리 원코드와 일치하는지 검사합니다.3828개 지역이 매칭되고, 기존3,557행정동 중 구지면 `27710380` 한 곳은 같은 코드가 없어null입니다. 서울 상권 인구에는 이 값을 덮어쓰지 않습니다. 재현 메타데이터/다운로드form/조인 결과는 `public/market/residents/KR-2026-09.json`에 포함했습니다.

## 패키지 빌더

`scripts/build-market-data.py`는 이미 정규화·검증된 작업 산출물을 최종 JSON 청크로 묶는 단계입니다. 이 명령이 원격 데이터를 자동 수집하는 것은 아닙니다. 필요한 입력은 프로젝트 부모 폴더의 다음 파일입니다.

- `beta-data-national/kr-food/manifest.json`, `region-index.json`, `districts/*.json`, `semas-download-receipt.json`.
- `beta-data-national/tokyo-areas-geocoded-2021.json`.
- `beta-data-seoul/seoul-areas.json`, `competition.json`.
- `beta-data-japangeo/japan-municipalities.json`.
- `beta-data-national-residents/residents-verified.json`, `download-metadata.json`.

위 파일들은 각 원천의 관측일·원본 헤더·코드를 유지한 전처리 결과여야 합니다. 새 스냅샷으로 교체할 때는 원자료 취득/정규화 검증을 먼저 수행하고 빌더의 VERSION/자료시점도 새 값으로 바꿉니다. 현재의442개 패키지 파일만으로 앱을 실행할 수 있으며 원본 다운로드는 런타임에 필요하지 않습니다.

```bash
python scripts/build-market-data.py
node tests/market-data.test.mjs
```

패키징은 각 파일6MiB미만/전체1000개미만을 검사하고 manifest에 해시를 기록합니다. 같은 릴리스 id를 다시 덮어쓰기보다 검증된 새 릴리스 id로 저장한 뒤 활성 포인터를 바꿉니다. R2 업로드/활성화 명령은 루트 README의 배포 절차를 따릅니다.
