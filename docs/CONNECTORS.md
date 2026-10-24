# 상권 Atlas 베타 외부 연결 명세

확인일: 2026-10-24. 이 폴더는 기존 앱과 독립적이며 배포·키 발급·계약 체결을 수행하지 않았습니다.

## 실제 연결 확인 결과

**계정별 키 없이 공식 최신 응답을 받은 곳은 광화문·덕수궁 한 장소입니다.** 공식 통합 `citydata`의 공개 `sample` 키를 사용했습니다. 다른 지역에 이 값을 대신 표시하거나 전국 실시간으로 소개하면 안 됩니다.

| 항목 | 확인 결과 |
|---|---|
| 공식 endpoint | `http://openapi.seoul.go.kr:8088/sample/json/citydata/1/5/광화문·덕수궁` — URL 인코딩하여 요청 |
| 실제 수신 시각 | 2026-10-24 10:10:03 UTC / 19:10:03 KST |
| 원천 인구 기준시각 | `PPLTN_TIME = 2026-10-24 18:40` KST |
| 정상 결과 | `RESULT["RESULT.CODE"] = "INFO-000"` |
| 장소 | `AREA_CD = POI009`, `AREA_NM = 광화문·덕수궁` |
| 원천 인구 추정 범위 | 32,000–34,000 |
| 확인한 원문 | `seoul-sample-city-json.body`, `seoul-sample-city-json.meta.json`; XML도 별도 보존 |
| 실제 공급 지연 | 수신시각 기준 약 30분. 앱 임계값으로 `freshness: delayed`, `live: false` |

`PPLTN_TIME`은 [공식 필드 설명](https://data.seoul.go.kr/dataList/openApiView.do?infId=OA-21285&srvType=A)상 **데이터 업데이트 시각**입니다. 어댑터의 공통 필드 `observedAt`에 UTC로 정규화하지만 `timestampKind: provider_update_time`을 함께 반환합니다. 정확한 원천 측정 순간과 동일하다고 보증하지 않습니다. 예측 배열 `FCST_PPLTN`은 현재 인구 결과에 섞지 않습니다.

통신 기반 추정치는 구매 고객·점포 앞 보행자·일일 고유 방문객이 아닙니다. [공식 인구 데이터 안내](https://data.seoul.go.kr/dataList/OA-21778/A/1/datasetView.do)는 90일 이하 단기체류 외국인이 추정에서 제외되고, sample은 이 한 장소만 허용된다고 설명합니다. 최근 메타데이터는 121장소이지만 일부 상세 필드 설명에는 120장소 표기가 남아 있으므로 실제 장소 목록의 버전도 관리해야 합니다.

### 성공하지 않은 경로도 구분

- `citydata_ppl` 단독 JSON·XML sample은 같은 확인 시점에 HTTP 200과 함께 `ERROR-500`을 반환했습니다.
- 공식 시각화 페이지 JS의 `/SeoulRtd/api/hotspot` 및 `/hotspot-category` 경로를 확인했으나 실제 응답은 JSON 대신 접속 대기 HTML이었습니다. 이 내부 화면 경로를 운영 API로 사용하지 않았습니다.
- `https://openapi.seoul.go.kr:8088/...`는 503이었습니다. 확인된 HTTP endpoint를 HTTPS 연결이라고 표현하지 않습니다.
- 로컬 Python urllib의 직접 요청은 성공했습니다. 이 실행환경의 Node fetch는 환경 프록시 옵션을 적용해도 `UND_ERR_SOCKET`으로 실패했습니다. 해당 실패는 `seoul-adapter-verification.json`에 보존했습니다. 실제 수신 JSON을 넣은 어댑터 검증은 통과했으나 **Cloudflare Worker에서의 통신 검증은 배포 환경에서 추가로 실행해야 합니다.**

## 공급원별 연결·사용 범위

| 공급원 | 구현 상태·발급 경로 | 데이터와 시간 | 사용 조건 |
|---|---|---|---|
| 서울 실시간 | 통합 JSON 파서·fetch 구현. [키 신청](https://data.seoul.go.kr/together/mypage/actkeyMain.do) | 공식 장소별 인구 범위·연령 원필드·혼잡도. `PPLTN_TIME` 보존 | 공식 메타데이터 공공누리 1유형 출처표시. 한 요청 한 장소. 운영키의 HTTP 전송 방침 결정 필요 |
| 소상공인 상가 API | [활용신청](https://www.data.go.kr/data/15012005/openapi.do), `SBIZ_API_KEY` 필요. 문서 기반 fetch/파서 구현, 키 있는 실호출 미검증 | 전국 점포명·업종·주소·좌표. 반경 최대 2,000m. `stdrYm` 있으면 보존. 현재 공실·임대매물·고객 연령 아님 | 포털은 무료·이용허락범위 제한 없음·자동승인, 개발계정 10,000을 안내. 메타데이터의 '실시간'을 개별 업소 현장 확인시각으로 대체하지 않음 |
| 카카오 장소 | [앱 설정](https://developers.kakao.com/console/app), `KAKAO_REST_API_KEY` 필요. [현재 REST 문서](https://developers.kakao.com/docs/ko/kakaomap/rest-api) 기반 구현 | 음식점 FD6 / 카페 CE7, 주소·좌표·원문 URL. 페이지 최대 45, 페이지당 최대 15, 반경 최대 20km. 전수 목록 아님 | [운영정책](https://developers.kakao.com/terms/ko/site-policies)상 캐시는 사용자 경험 개선 목적과 최신성 조건을 준수. 임의 장기 DB 복제·재판매 권한을 가정하지 않음. 기본 서버 저장 0초 |
| Hot Pepper | [키 발급](https://webservice.recruit.co.jp/register), `HOTPEPPER_API_KEY` 필요. [문서](https://webservice.recruit.co.jp/doc/hotpepper/reference.html) 기반 구현 | 일본 수록 음식점·장르·표시 예산·주소. 반경 300/500/1000/2000/3000m. 표시 예산은 실측 객단가 아님 | [개별 이용안내](https://webservice.recruit.co.jp/doc/hotpepper/guideline.html): 음식점으로부터 대가를 받는 사업 관련 사이트 이용·정보 자체 재판매 금지, 크레딧 필수. [현행 약관](https://cdn.p.recruit.co.jp/terms/rws-t-1001/index.html): 제3자 DB 복제 등 제한, 별도 규정 없으면 24시간 내 캐시 갱신·삭제. 사업모델 검토 전 차단 |
| 도코모 모바쿠 | [서비스 사양](https://mobaku.jp/service/rt_distribution/), [문의·계약](https://mobaku.jp/contact/) | 공식 설명은 1시간 전 인구를 10분마다. 공개 지도 500m 메쉬. 전용 화면·CSV·클라우드 연계 가능 | 계정·공급 계약·외부 표시 및 저장 범위·실제 인증/스키마 미확보. 임의 endpoint를 만들지 않고 `blocked` |
| 상가 매물 피드 | 공급자 미확정. [한국 관리센터](https://landad.naver.com/), [일본 물건 게재 서비스](https://www.inshokuten.com/estate/)는 공급 조건 확인 경로 | 매물별 확인일, 가용 여부, 금액·세금·비공개 항목, 삭제/거래완료 이벤트가 필요 | 열람 가능한 원문은 재배포 계약이 아님. 네이버 관리센터는 무단 체계적 복제·배포·전송 제한을 고지. [飲食店ドットコム 약관](https://www.inshokuten.com/signup/term/)도 무단 전재 제한. 피드 계약·스키마 전 `blocked` |

카카오는 [현재 쿼터 안내](https://developers.kakao.com/docs/ko/getting-started/quota)에 장소 검색별 일간 100,000건과 유료 초과 사용 요금을 안내합니다. 실제 앱의 승인 한도·과금 설정을 운영자가 확인해야 하며 어댑터는 유료 사용을 자동 신청하지 않습니다.

상가 API의 현재 공식 페이지에 포함된 Swagger는 `sbiz-swagger.json`에 추출했습니다. 사용 endpoint는 `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius`이며, 공식 명세의 키 파라미터 대소문자 `ServiceKey`와 반경 제한을 따릅니다. 실호출 전 승인 키로 최신 envelope와 성공 코드를 한 번 더 검증해야 합니다.

## 모듈 계약

```js
import {connectionStatus, runConnector} from './connectors.mjs';

const states = connectionStatus(env); // 키 값은 반환하지 않음
const result = await runConnector('seoul_population', {area: 'POI009'}, env);
// 국내 점포: {lat: 37.54, lng: 127.05, radius: 500, page: 1}
// 카카오: 위 조건 + category: 'FD6' 또는 'CE7'
// Hot Pepper: 같은 좌표 조건, radius는 5개 허용값 중 선택
```

공통 응답:

```js
{
  provider, status: 'ok' | 'blocked' | 'error', reasonCode,
  fetchedAt, observedAt, sourceTimeRaw,
  freshness: 'fresh' | 'delayed' | 'stale' | 'unknown' | 'clock_error',
  ageMinutes, live, data, source, warnings
}
```

- `connectionStatus`의 `ready_to_verify`는 키가 있다는 뜻입니다. 실제 연결 성공과 상업적 권한을 의미하지 않습니다.
- `status: ok`만으로 실시간 표시를 켜지 않습니다. 서울은 원천 시각·대체자료 여부를 확인합니다. 점포 검색은 원천 관측시각이 없어 항상 `live: false`입니다.
- 앱 신선도 기준은 15분 이내 `fresh`, 15분 초과~180분 `delayed`, 180분 초과 `stale`입니다. 공급자의 SLA가 아니라 이 앱의 표시 규칙이며 실제 경과 분을 함께 보여줍니다.
- 응답의 `customerAge`는 null을 유지합니다. 연령 없는 값·비공개 가격·좌표를 0으로 바꾸지 않습니다.
- API키는 Worker `env`로만 받습니다. 사용자 요청의 임의 URL·호스트를 받아 프록시하지 않습니다. 키가 들어간 전체 URL, 오류 메시지, 응답 원문을 클라이언트나 로그로 넘기지 않습니다.
- `SEOUL_HTTP_KEY_APPROVED`, `KAKAO_USE_APPROVED`, `HOTPEPPER_USE_APPROVED`는 운영자 서버 설정입니다. **플래그 자체가 계약·허가를 만들어 주지 않습니다.** 근거 검토 후 운영자가 설정해야 하며 일반 사용자의 토글로 열지 않습니다.
- 도코모·매물은 `*_APPROVED` 같은 값만 설정해도 활성화되지 않습니다. 계약된 공급자의 실제 스키마를 구현해야 합니다.

## Worker + D1 운영 연결 제안

다음은 공급자 정책이 아니라 이 베타의 권장 서버 설계입니다.

1. 읽기 API는 `GET /api/connectors`, `GET /api/population?area=...`, `GET /api/places?provider=...&lat=...&lng=...`처럼 범위를 제한합니다. 공급자 ID·장소코드·좌표·반경·페이지를 검사하고 임의 fetch URL은 받지 않습니다.
2. 키는 Worker Secrets에 보관하고 D1·소스·localStorage·운영 로그에 저장하지 않습니다. 설정 페이지는 구성 여부·차단 사유·공식 발급 링크만 제공합니다. 관리 설정과 일반 조회 권한은 분리합니다.
3. 요청별 10초 timeout, 기본 2MB 응답 상한, redirect 금지, HTTP 상태·JSON 파싱·원천 결과 코드·스키마를 모두 검사합니다. HTTP 200 오류 문서나 HTML 대기 페이지도 실패로 다룹니다. 현재 모듈이 이 부분을 구현합니다.
4. 서버 라우트에서 사용자/IP·공급자별 제한과 총 호출 예산을 적용합니다. 동일 장소 캐시는 기본 5분으로 합치고, 실패 시 즉시 반복 요청하지 않습니다. 백그라운드 재시도는 제한 횟수와 증가하는 간격을 사용합니다. 캐시와 재시도 조정은 이 모듈 외부의 Worker 책임입니다.
5. D1에는 `provider_status`(마지막 시도·성공·오류코드), `source_observations`(원천 시각·수신시각·지역·버전·출처), `plans`(소유자·국가·통화·버전)를 분리합니다. 쿼리는 prepared statement로 실행하고 저장한 운영안의 소유자를 서버 인증에서 결정합니다. 요청 본문의 임의 userId를 신뢰하지 않습니다.
6. 카카오·Hot Pepper 결과를 D1의 영구 점포 원장에 넣지 않습니다. 사용자 작성 메모와 공급자 콘텐츠를 분리하고, 허용된 캐시라면 만료·갱신·삭제를 실제로 구현합니다. 공급자 콘텐츠 만료 후 사용자가 쓴 메모만 남기는 모델을 검토합니다.
7. 최신 호출 실패 시 과거 응답의 `observedAt`을 현재로 바꾸지 않습니다. 마지막 성공 값은 원천 시각·경과 시간·갱신 실패와 함께 표시하거나 너무 오래됐으면 숨깁니다. 설정 완료와 연결 성공, 실시간 공급과 과거 스냅샷을 따로 보여줍니다.
8. Worker의 [custom port 동작](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#allow-specifying-a-custom-port-when-making-a-subrequest-with-the-fetch-api)은 compatibility date 2024-09-02 이후 기본 활성입니다. 서울 8088 호출에서 이를 유지하고 실제 배포 환경에서 sample을 한 번 검증합니다. HTTP 원천으로 운영키를 보낼지 여부는 별도 보안 결정입니다.
9. 공개 CORS를 계정 데이터에 그대로 적용하지 않습니다. 개인 운영안 수정은 인증·소유권 검증·요청 크기 제한을 거치고, 사용자가 자기 기록을 내보내거나 삭제할 수 있게 합니다. 외부 공급자 장애가 사용자 입력 저장을 막지 않게 분리합니다.

### 활성화 전 실제 확인

각 공급자는 운영키·권한 준비 후 정상/빈 결과/잘못된 키/제한 초과/네트워크 실패를 확인하고 응답의 날짜·공간 단위·가격 의미를 화면과 대조해야 합니다. 도코모·매물은 계약되지 않았으므로 이 작업 완료만으로 모든 연동이 된 상용 서비스라고 소개할 수 없습니다.

## 검증 명령

```bash
node tests.mjs
```

실제 서울 sample 원문을 검증한 파서, 장소 제한, 지연·미래·누락 시각, 오류 응답, 키 비노출, redirect 정책, 크기 제한, 조건 미충족 차단을 검사합니다. 상가·카카오·Hot Pepper의 테스트 fixture는 **공식 스키마를 기준으로 만든 합성 자료**이며 해당 공급자의 실제 연결 성공 증거가 아닙니다.
