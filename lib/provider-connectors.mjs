/* Server-side adapters. No credentials, fetches, caches or other side effects at import.
 * Worker/Node compatible; parsers and configuration inspection are pure functions.
 * A configured key is never proof that a provider is connected or licensed.
 */
export const VERSION = '2026-10-24.beta-connectors.1';

export const CONNECTORS = Object.freeze({
  seoul_population: {
    name: '서울 실시간 인구', country: 'KR', keyName: 'SEOUL_API_KEY',
    docs: 'https://data.seoul.go.kr/dataList/OA-21285/A/1/datasetView.do',
    setupUrl: 'https://data.seoul.go.kr/together/mypage/actkeyMain.do',
    coverage: '공식 주요 121장소. sample은 광화문·덕수궁(POI009)만.',
    update: '원천 실시간 공급. PPLTN_TIME은 공식 설명상 데이터 업데이트 시각이며 수신시각과 다릅니다.',
    license: '서울특별시 · 공공누리 1유형 출처표시. 개별 자료의 이용조건 유지.',
    attribution: '서울특별시 서울 열린데이터광장 · 통신 기반 추정 인구',
    cacheSeconds: 300, persistentStorage: '공공자료 출처·관측시각을 보존한 캐시',
  },
  sbiz_stores: {
    name: '전국 상가·상권 업소', country: 'KR', keyName: 'SBIZ_API_KEY',
    docs: 'https://www.data.go.kr/data/15012005/openapi.do',
    setupUrl: 'https://www.data.go.kr/data/15012005/openapi.do',
    coverage: '전국 상가업소. 반경 검색 최대 2,000m; 현재 영업 여부 전수 확인 아님.',
    update: '포털 메타데이터는 실시간. 업소의 실제 현장 갱신시각과 다르며 stdrYm을 별도로 보존합니다.',
    license: '공식 포털: 무료, 이용허락범위 제한 없음. 승인 키와 호출 한도 적용.',
    attribution: '소상공인시장진흥공단 · 공공데이터포털',
    cacheSeconds: 3600, persistentStorage: '원천 기준년월·출처를 보존하고 갱신·삭제 정책 운영',
  },
  kakao_places: {
    name: '카카오 주변 음식점·카페', country: 'KR', keyName: 'KAKAO_REST_API_KEY',
    docs: 'https://developers.kakao.com/docs/ko/kakaomap/rest-api',
    setupUrl: 'https://developers.kakao.com/console/app',
    termsUrl: 'https://developers.kakao.com/terms/ko/site-policies',
    coverage: '검색 결과 일부, 업소 전수 목록 아님. 음식점 FD6 / 카페 CE7.',
    update: '검색 시 공급원 응답. 개별 점포 관측·갱신시각은 이 응답에 없습니다.',
    license: '키 발급·앱 설정 및 약관 준수. 데이터베이스 재판매·장기 복제 권한을 가정하지 않습니다.',
    attribution: '카카오맵 장소 검색 · 원문 링크 제공',
    cacheSeconds: 0, persistentStorage: '기본 미저장. UX 목적 캐시 범위·최신성 정책 별도 확인',
  },
  hotpepper_places: {
    name: 'Hot Pepper 음식점 검색', country: 'JP', keyName: 'HOTPEPPER_API_KEY',
    docs: 'https://webservice.recruit.co.jp/doc/hotpepper/reference.html',
    setupUrl: 'https://webservice.recruit.co.jp/register',
    termsUrl: 'https://webservice.recruit.co.jp/doc/hotpepper/guideline.html',
    coverage: 'Hot Pepper 수록 점포. 전체 음식점·실제 고객 연령 자료 아님.',
    update: '검색 시 응답. 별도 규정이 없을 때 캐시 갱신 또는 삭제는 24시간 이내.',
    license: '음식점에서 대가를 받는 사업 관련 사이트 이용 및 점포정보 자체 재판매 금지. 사업모델별 이용조건 확인 필요.',
    attribution: 'Powered by ホットペッパーグルメ Webサービス',
    attributionUrl: 'https://webservice.recruit.co.jp/',
    cacheSeconds: 0, persistentStorage: '기본 미저장. 제3자 DB 복제 제한 및 개별 이용조건 확인',
  },
  docomo_population: {
    name: '도코모 모바쿠 인구', country: 'JP', keyName: null,
    docs: 'https://mobaku.jp/service/rt_distribution/',
    setupUrl: 'https://mobaku.jp/contact/',
    coverage: '공식 서비스는 일본 인구 분포와 성·연령·거주지. 제공 공간·범위는 계약 확인.',
    update: '공식 설명: 1시간 전 인구를 10분마다. 공개 지도는 500m 메쉬.',
    license: '유료/계약 공급과 외부 서비스 표시·재배포 범위 별도 확인.',
    attribution: 'NTTドコモ モバイル空間統計', cacheSeconds: 0,
    persistentStorage: '계약 전 저장·재배포 금지. 공개 지도의 열람 권한을 API 공급권으로 보지 않음',
  },
  property_feed: {
    name: '상가 매물 공급', country: 'KR/JP', keyName: null,
    docs: 'https://www.inshokuten.com/bukken/howto',
    setupUrl: 'https://www.inshokuten.com/estate/',
    setupUrls: ['https://landad.naver.com/', 'https://www.inshokuten.com/estate/'],
    termsUrls: ['https://landad.naver.com/', 'https://www.inshokuten.com/signup/term/'],
    coverage: '계약한 중개사·공급자의 상가 매물만. 자동 연동 공급자 미확정.',
    update: '공급 계약의 갱신·삭제 주기와 매물별 확인일을 사용해야 합니다.',
    license: '피드/API 계약, 사진·본문·가격 재표시 권한과 삭제 의무 필요.',
    attribution: '매물별 공급자·원문·확인일 표시', cacheSeconds: 0,
    persistentStorage: '공급계약과 검증된 스키마가 정해지기 전 비활성',
  },
});

const truth = value => value === true || value === 'true';
const key = (env, name) => typeof env?.[name] === 'string' ? env[name].trim() : '';
const clean = value => typeof value === 'string' ? value.trim() : '';
const number = value => (typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'string' && value.trim() === '')
  ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const safeNumber = value => { const n = number(value); return n !== null && n >= 0 ? n : null; };
const percentage = value => { const n = safeNumber(value); return n !== null && n <= 100 ? n : null; };
const safeUrl = value => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
const publicSource = provider => ({ ...CONNECTORS[provider] });
const envelope = (provider, status, extra = {}) => ({
  version: VERSION, provider, status, reasonCode: null, fetchedAt: null,
  observedAt: null, sourceTimeRaw: null, ageMinutes: null, freshness: 'unknown',
  live: false, data: null, source: publicSource(provider), warnings: [], ...extra,
});
const blocked = (provider, reasonCode, message) => envelope(provider, 'blocked', { reasonCode, message });
const failure = (provider, reasonCode, message, extra = {}) => envelope(provider, 'error', { reasonCode, message, ...extra });

export function connectionStatus(env = {}) {
  return Object.entries(CONNECTORS).map(([id, meta]) => {
    let status = 'blocked', reasonCode = 'KEY_REQUIRED', message = '운영자 서버 인증키 설정 후 실제 응답 검증이 필요합니다.';
    if (id === 'seoul_population' && (!key(env, meta.keyName) || key(env, meta.keyName) === 'sample')) {
      status = 'sample_only'; reasonCode = 'SAMPLE_ONE_AREA'; message = '광화문·덕수궁 sample만 조회 가능하며 나머지 장소에는 키가 필요합니다.';
    } else if (id === 'seoul_population' && !truth(env.SEOUL_HTTP_KEY_APPROVED)) {
      reasonCode = 'UPSTREAM_HTTP_REVIEW_REQUIRED'; message = '확인된 공식 원천은 HTTP:8088입니다. 운영키 전송 보안 조건을 먼저 결정해야 합니다.';
    } else if (id === 'docomo_population' || id === 'property_feed') {
      reasonCode = 'CONTRACT_AND_SCHEMA_REQUIRED'; message = '공급·표시 계약과 공식 인증·응답 스키마가 아직 확보되지 않았습니다.';
    } else if (id === 'hotpepper_places' && !truth(env.HOTPEPPER_USE_APPROVED)) {
      reasonCode = 'BUSINESS_TERMS_REVIEW_REQUIRED'; message = '음식점 대상 유료 사업 제한·재판매·DB 복제·표시 조건 검토가 필요합니다.';
    } else if (id === 'kakao_places' && !truth(env.KAKAO_USE_APPROVED)) {
      reasonCode = 'DISPLAY_TERMS_REVIEW_REQUIRED'; message = '앱 이용조건·표시 방식·캐시 범위를 운영자가 확인해야 합니다.';
    } else if (key(env, meta.keyName)) {
      status = 'ready_to_verify'; reasonCode = 'NOT_YET_VERIFIED'; message = '설정됨 · 호출 성공과 응답 기준시각을 확인해야 연결 완료로 볼 수 있습니다.';
    }
    return { id, ...meta, status, reasonCode, message, credentialConfigured: Boolean(meta.keyName && key(env, meta.keyName)) };
  });
}

export function parseKstTimestamp(raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(clean(raw));
  if (!m) return null;
  const [,y,mo,d,h,mi,s='00'] = m;
  const utc = Date.UTC(+y,+mo-1,+d,+h-9,+mi,+s);
  const check = new Date(utc + 9*3600000);
  if (check.getUTCFullYear() !== +y || check.getUTCMonth()+1 !== +mo || check.getUTCDate() !== +d || check.getUTCHours() !== +h || check.getUTCMinutes() !== +mi || check.getUTCSeconds() !== +s) return null;
  return new Date(utc).toISOString();
}

export function freshness(observedAt, fetchedAt) {
  const source = Date.parse(observedAt), received = Date.parse(fetchedAt);
  if (!Number.isFinite(source) || !Number.isFinite(received)) return { freshness: 'unknown', ageMinutes: null };
  const ageMinutes = Math.round((received-source)/60000*10)/10;
  // Application thresholds, not a provider SLA. Always show the actual age.
  return { ageMinutes, freshness: ageMinutes < -5 ? 'clock_error' : ageMinutes <= 15 ? 'fresh' : ageMinutes <= 180 ? 'delayed' : 'stale' };
}

export function parseSeoulPopulation(payload, { fetchedAt, requestedArea, sample = false } = {}) {
  const provider = 'seoul_population';
  const code = payload?.RESULT?.['RESULT.CODE'] ?? payload?.RESULT?.CODE;
  if (code !== 'INFO-000') return failure(provider, 'UPSTREAM_RESULT_ERROR', '서울 원천이 정상 데이터 대신 오류를 반환했습니다.', { fetchedAt, upstreamCode: clean(code) || 'unknown' });
  const city = payload?.CITYDATA, rows = city?.LIVE_PPLTN_STTS;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !clean(row.AREA_CD) || !clean(row.AREA_NM)) return failure(provider, 'SCHEMA_MISMATCH', '서울 응답 구조가 검증한 스키마와 다릅니다.', { fetchedAt });
  if (requestedArea && requestedArea !== row.AREA_CD && requestedArea !== row.AREA_NM) return failure(provider, 'AREA_MISMATCH', '요청 장소와 응답 장소가 일치하지 않습니다.', { fetchedAt });
  const min = safeNumber(row.AREA_PPLTN_MIN), max = safeNumber(row.AREA_PPLTN_MAX);
  if (min === null || max === null || min > max) return failure(provider, 'POPULATION_RANGE_INVALID', '인구 범위가 미확인 또는 잘못된 값입니다.', { fetchedAt });
  const observedAt = parseKstTimestamp(row.PPLTN_TIME), age = freshness(observedAt, fetchedAt);
  const replacement = row.REPLACE_YN === 'Y';
  const warnings = ['통신 기반 장소 인구 추정 범위입니다. 일일 고유 방문객·가게 앞 보행자·구매 고객 수가 아닙니다.', '원천 설명상 90일 이하 단기체류 외국인은 인구 추정에서 제외됩니다.', '원천은 HTTP 연결이며 암호화된 원천 전송으로 표시하지 않습니다.'];
  if (sample) warnings.push('공식 sample 범위는 광화문·덕수궁 한 장소뿐입니다. 다른 지역의 값으로 사용하지 않습니다.');
  if (!observedAt) warnings.push('원천 관측시각을 확인할 수 없어 실시간으로 표시하지 않습니다.');
  if (age.freshness === 'delayed' || age.freshness === 'stale') warnings.push('원천 관측 이후 ' + age.ageMinutes + '분 경과했습니다. 조회시각을 관측시각으로 대체하지 않습니다.');
  if (replacement) warnings.push('원천 REPLACE_YN=Y 대체자료입니다. 정상 관측과 구분해 표시하세요.');
  const ages = {};
  for (const band of ['0','10','20','30','40','50','60','70']) ages['PPLTN_RATE_'+band] = percentage(row['PPLTN_RATE_'+band]);
  return envelope(provider, 'ok', {
    fetchedAt, observedAt, timestampKind: 'provider_update_time', sourceTimeRaw: clean(row.PPLTN_TIME), sourceTimezone: 'Asia/Seoul', ...age,
    live: age.freshness === 'fresh' && !replacement, mode: sample ? 'official_sample' : 'authenticated_api',
    data: { areaCode: row.AREA_CD, areaName: row.AREA_NM, populationMin: min, populationMax: max,
      measurement: 'telecom_estimated_population_range', congestion: clean(row.AREA_CONGEST_LVL) || null,
      agePercentages: ages, ageDefinition: '서울 실시간 API 원천 필드. 분기 길단위인구의 연령구간10과 별도 정의.',
      malePercent: percentage(row.MALE_PPLTN_RATE), femalePercent: percentage(row.FEMALE_PPLTN_RATE),
      residentPercent: percentage(row.RESNT_PPLTN_RATE), nonResidentPercent: percentage(row.NON_RESNT_PPLTN_RATE),
      replacement, customerAge: null, forecastsIncluded: false }, warnings,
  });
}

function poiEnvelope(provider, items, fetchedAt, pagination, warnings = [], observedPeriod = null) {
  return envelope(provider, 'ok', { fetchedAt, observedPeriod, mode: 'authenticated_api', data: { items, pagination, exhaustive: false }, warnings: ['개별 점포의 실제 고객 연령·매출·현재 영업 상태는 확인되지 않았습니다.', '검색 응답 수신시각은 개별 점포의 조사·갱신시각이 아닙니다.', ...warnings] });
}

export function parseKakaoPlaces(payload, { fetchedAt } = {}) {
  const provider = 'kakao_places';
  if (!Array.isArray(payload?.documents) || !payload.meta) return failure(provider, 'SCHEMA_MISMATCH', '카카오 장소 응답 스키마를 확인할 수 없습니다.', { fetchedAt });
  const items = payload.documents.map(r => ({ id: clean(r.id), name: clean(r.place_name), category: clean(r.category_name),
    address: clean(r.road_address_name) || clean(r.address_name), lng: number(r.x), lat: number(r.y),
    distanceMetres: safeNumber(r.distance), sourceUrl: safeUrl(r.place_url), price: null, customerAge: null, operatingStatus: 'unverified' }));
  return poiEnvelope(provider, items, fetchedAt, { total: safeNumber(payload.meta.total_count), pageableCount: safeNumber(payload.meta.pageable_count), isEnd: payload.meta.is_end === true });
}

export function parseHotpepperPlaces(payload, { fetchedAt } = {}) {
  const provider = 'hotpepper_places', r = payload?.results;
  if (r?.error) return failure(provider, 'UPSTREAM_RESULT_ERROR', 'Hot Pepper가 오류를 반환했습니다.', { fetchedAt });
  if (!Array.isArray(r?.shop)) return failure(provider, 'SCHEMA_MISMATCH', 'Hot Pepper 응답 스키마를 확인할 수 없습니다.', { fetchedAt });
  const items = r.shop.map(s => ({ id: clean(s.id), name: clean(s.name), category: clean(s.genre?.name),
    address: clean(s.address), lng: number(s.lng), lat: number(s.lat), sourceUrl: safeUrl(s.urls?.pc),
    listedBudgetLabel: clean(s.budget?.name) || clean(s.budget?.average) || null,
    budgetDefinition: '공급원의 표시 예산. 실측 객단가·매출 아님.', price: null, customerAge: null, operatingStatus: 'unverified' }));
  return poiEnvelope(provider, items, fetchedAt, { total: safeNumber(r.results_available), returned: safeNumber(r.results_returned), start: safeNumber(r.results_start) }, ['필수 크레딧과 원문 링크를 유지하고 점포정보를 재판매·장기 DB 복제하지 마세요.']);
}

export function parseSbizStores(payload, { fetchedAt } = {}) {
  const provider = 'sbiz_stores', root = payload?.response || payload;
  const header = root?.header, body = root?.body;
  if (!header || !body || !['00','0000','0'].includes(String(header.resultCode))) return failure(provider, 'UPSTREAM_RESULT_ERROR', '상가 API의 정상 응답을 확인하지 못했습니다.', { fetchedAt, upstreamCode: clean(String(header?.resultCode ?? 'unknown')) });
  let rows = Array.isArray(body.items) ? body.items : body.items?.item;
  if (rows && !Array.isArray(rows)) rows = [rows];
  if (!rows && safeNumber(body.totalCount) === 0) rows = [];
  if (!Array.isArray(rows)) return failure(provider, 'SCHEMA_MISMATCH', '상가 API 결과 목록 스키마가 변경되었거나 누락됐습니다.', { fetchedAt });
  const items = rows.map(s => ({ id: clean(s.bizesId), name: clean(s.bizesNm), branch: clean(s.brchNm),
    category: clean(s.indsSclsNm), industryCode: clean(s.indsSclsCd), address: clean(s.rdnmAdr) || clean(s.lnoAdr),
    lng: number(s.lon), lat: number(s.lat), sourcePeriod: clean(s.stdrYm) || clean(body.stdrYm) || null,
    sourceUrl: CONNECTORS.sbiz_stores.docs, customerAge: null, price: null, operatingStatus: 'unverified' }));
  return poiEnvelope(provider, items, fetchedAt, { total: safeNumber(body.totalCount), page: safeNumber(body.pageNo), pageSize: safeNumber(body.numOfRows) }, ['상가업소 좌표·업종 목록입니다. 현재 공실·임대 매물 목록이 아닙니다.'], clean(body.stdrYm) || null);
}

function validateGeo(p, maxRadius) {
  if (typeof p.lng !== 'number' || !Number.isFinite(p.lng) || p.lng < -180 || p.lng > 180 || typeof p.lat !== 'number' || !Number.isFinite(p.lat) || p.lat < -90 || p.lat > 90) return '유효한 WGS84 위도·경도가 필요합니다.';
  if (p.radius !== undefined && (!Number.isInteger(p.radius) || p.radius < 1 || p.radius > maxRadius)) return '반경은 1–'+maxRadius+'m 정수여야 합니다.';
  return null;
}
function requestPlan(provider, p, env) {
  if (provider === 'docomo_population' || provider === 'property_feed') return { blocked: blocked(provider, 'CONTRACT_AND_SCHEMA_REQUIRED', '공급 계약·재표시 권한·공식 인증 및 응답 스키마가 확정되지 않아 호출하지 않습니다.') };
  const meta = CONNECTORS[provider], apiKey = key(env, meta.keyName);
  if (provider === 'seoul_population') {
    const area = clean(p.area || p.areaCode || 'POI009');
    if (!area || area.length > 80 || /[\u0000-\u001f/\\?#]/.test(area)) return { error: '올바른 공식 장소명 또는 장소코드를 입력해 주세요.' };
    const sample = !apiKey || apiKey === 'sample';
    if (sample && !['POI009','광화문·덕수궁'].includes(area)) return { blocked: blocked(provider, 'KEY_REQUIRED_FOR_AREA', 'sample은 광화문·덕수궁만 지원합니다. 이 장소는 서울 운영 인증키가 필요합니다.') };
    if (!sample && !truth(env.SEOUL_HTTP_KEY_APPROVED)) return { blocked: blocked(provider, 'UPSTREAM_HTTP_REVIEW_REQUIRED', '확인된 서울 원천은 HTTP입니다. 운영키 전송 방침이 승인되지 않아 키를 전송하지 않습니다.') };
    const requestArea = sample ? '광화문·덕수궁' : area;
    return { url: 'http://openapi.seoul.go.kr:8088/'+encodeURIComponent(apiKey || 'sample')+'/json/citydata/1/5/'+encodeURIComponent(requestArea), sample, requestedArea: area, parser: parseSeoulPopulation };
  }
  if (!apiKey) return { blocked: blocked(provider, 'KEY_REQUIRED', '운영자 서버에 '+meta.keyName+' 설정이 필요합니다.') };
  if (provider === 'kakao_places' && !truth(env.KAKAO_USE_APPROVED)) return { blocked: blocked(provider, 'DISPLAY_TERMS_REVIEW_REQUIRED', '카카오 앱 이용조건·표시 방식·캐시 범위 확인 전입니다.') };
  if (provider === 'hotpepper_places' && !truth(env.HOTPEPPER_USE_APPROVED)) return { blocked: blocked(provider, 'BUSINESS_TERMS_REVIEW_REQUIRED', 'Hot Pepper의 음식점 대상 유료 사업·재판매·DB 복제 제한을 먼저 확인해야 합니다.') };
  const geoError = validateGeo(p, provider === 'sbiz_stores' ? 2000 : provider === 'hotpepper_places' ? 3000 : 20000);
  if (geoError) return { error: geoError };
  const page = p.page ?? 1;
  if (!Number.isInteger(page) || page < 1 || page > (provider === 'kakao_places' ? 45 : 100)) return { error: '허용 범위의 정수 페이지 번호가 필요합니다.' };
  if (provider === 'kakao_places') {
    const category = p.category ?? 'FD6';
    if (!['FD6','CE7'].includes(category)) return { error: '이 어댑터는 음식점 FD6와 카페 CE7만 조회합니다.' };
    const url = new URL('https://dapi.kakao.com/v2/local/search/category.json');
    url.search = new URLSearchParams({ category_group_code:category,x:String(p.lng),y:String(p.lat),radius:String(p.radius ?? 500),page:String(page),size:'15',sort:'distance' });
    return { url: url.href, headers: { Authorization:'KakaoAK '+apiKey }, parser: parseKakaoPlaces };
  }
  if (provider === 'hotpepper_places') {
    // Official gourmet/v1 reference (checked 2026-10-24): keyword searches
    // names, addresses, stations and catch text; ASCII spaces are AND terms.
    // https://webservice.recruit.co.jp/doc/hotpepper/reference.html
    if (p.q !== undefined && (typeof p.q !== 'string' || p.q.length > 120 || /[\u0000-\u001f\u007f-\u009f]/.test(p.q))) return { error: 'Hot Pepper 검색어는 제어문자 없는 120자 이하 문자열이어야 합니다.' };
    if (p.category !== undefined && (typeof p.category !== 'string' || !['','all'].includes(p.category.trim()))) return { error: '이 Hot Pepper 연결은 공통 업종 필터를 지원하지 않습니다. 업종 전체와 검색어를 사용하세요.' };
    const keyword = clean(p.q);
    const radius = p.radius ?? 500, ranges = [300,500,1000,2000,3000];
    if (!ranges.includes(radius)) return { error: 'Hot Pepper 반경은 300/500/1000/2000/3000m 중 선택하세요.' };
    const url = new URL('https://webservice.recruit.co.jp/hotpepper/gourmet/v1/');
    url.search = new URLSearchParams({ key:apiKey,format:'json',lat:String(p.lat),lng:String(p.lng),range:String(ranges.indexOf(radius)+1),start:String((page-1)*30+1),count:'30' });
    if (keyword) url.searchParams.set('keyword', keyword);
    return { url:url.href,parser:parseHotpepperPlaces };
  }
  if (provider === 'sbiz_stores') {
    if (p.category !== undefined && (typeof p.category !== 'string' || !['','all'].includes(p.category.trim()))) return { error: '이 상가 API 연결의 업종 필터는 공식 indsLclsCd·indsMclsCd·indsSclsCd를 사용해야 합니다. 공통 업종 필터를 임의로 적용하지 않습니다.' };
    let decodedKey=apiKey; try { decodedKey=decodeURIComponent(apiKey); } catch { /* raw decoded key */ }
    const url=new URL('https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius');
    const q={ServiceKey:decodedKey,type:'json',cx:String(p.lng),cy:String(p.lat),radius:String(p.radius ?? 500),pageNo:String(page),numOfRows:'100'};
    for (const [field,length] of [['indsLclsCd',2],['indsMclsCd',4],['indsSclsCd',6]]) if (p[field] !== undefined) {
      if (typeof p[field] !== 'string' || !new RegExp('^[A-Za-z0-9]{'+length+'}$').test(p[field])) return {error:'공식 상권업종코드 형식을 확인하세요.'};
      q[field]=p[field];
    }
    url.search=new URLSearchParams(q);
    return {url:url.href,parser:parseSbizStores};
  }
  return {error:'구현되지 않은 연결입니다.'};
}

async function limitedText(response, maxBytes) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('BODY_LIMIT');
  if (!response.body?.getReader) { const text=await response.text();if(new TextEncoder().encode(text).byteLength>maxBytes)throw new Error('BODY_LIMIT');return text; }
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try { for (;;) { const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new Error('BODY_LIMIT');}chunks.push(value); } }
  finally { reader.releaseLock(); }
  const merged=new Uint8Array(bytes);let pos=0;for(const chunk of chunks){merged.set(chunk,pos);pos+=chunk.byteLength;}
  return new TextDecoder().decode(merged);
}

export async function runConnector(provider, params = {}, env = {}, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(CONNECTORS,provider)) return failure(null,'UNKNOWN_PROVIDER','지원하지 않는 연결입니다.');
  if (!params || typeof params !== 'object' || Array.isArray(params)) return failure(provider,'INVALID_INPUT','조회 조건 객체가 필요합니다.');
  const plan=requestPlan(provider,params,env);
  if(plan.blocked)return plan.blocked;
  if(plan.error)return failure(provider,'INVALID_INPUT',plan.error);
  const fetchImpl=options.fetchImpl ?? globalThis.fetch;
  if(typeof fetchImpl!=='function')return failure(provider,'FETCH_UNAVAILABLE','서버 fetch 환경이 필요합니다.');
  const now=options.now ?? (()=>new Date());
  const controller=new AbortController(),timeoutMs=options.timeoutMs ?? 10000;
  const timer=setTimeout(()=>controller.abort(),Math.max(100,Math.min(30000,timeoutMs)));
  let fetchedAt=null;
  try {
    const response=await fetchImpl(plan.url,{method:'GET',headers:{Accept:'application/json',...plan.headers},redirect:'error',signal:controller.signal});
    fetchedAt=new Date(now()).toISOString();
    if(!response.ok)return failure(provider,response.status===429?'RATE_LIMITED':response.status===401||response.status===403?'AUTH_OR_SCOPE_ERROR':'UPSTREAM_HTTP_ERROR','원천 응답을 확인하지 못했습니다.',{fetchedAt,httpStatus:response.status});
    const text=await limitedText(response,Math.min(options.maxBytes ?? 2000000,5000000));
    let payload;try{payload=JSON.parse(text);}catch{return failure(provider,'NON_JSON_RESPONSE','원천이 JSON 대신 오류 페이지 또는 다른 형식을 반환했습니다.',{fetchedAt});}
    return plan.parser(payload,{fetchedAt,sample:plan.sample,requestedArea:plan.requestedArea});
  } catch(e) {
    // Do not return URL/error.message: they may contain a credential query/path.
    return failure(provider,controller.signal.aborted?'UPSTREAM_TIMEOUT':e?.message==='BODY_LIMIT'?'RESPONSE_TOO_LARGE':'UPSTREAM_NETWORK_ERROR','원천 연결에 실패했습니다. 기존 관측시각을 최신으로 덮어쓰지 마세요.',{fetchedAt});
  } finally { clearTimeout(timer); }
}
