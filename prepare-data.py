"""Prepare a dated, source-attributed prototype snapshot. No live data is claimed."""
import json
from pathlib import Path

project_root = Path(__file__).resolve().parent
root = project_root / 'inputs'
out = project_root / 'work' / 'legacy-snapshot'
out.mkdir(parents=True, exist_ok=True)
jp_raw = json.loads((root/'population-verified.json').read_text())
meta = {
    '百人町1丁目': ('hyakunin1','햐쿠닌초 1초메','오쿠보역 일대','햐쿠닌초1',35.6996,139.6996),
    '大久保1丁目': ('okubo1','오쿠보 1초메','신오쿠보 동쪽','오쿠보1',35.6995,139.7054),
    '歌舞伎町2丁目': ('kabukicho2','가부키초 2초메','가부키초 북쪽','가부키초2',35.6966,139.7051),
    '高田馬場1丁目': ('takadanobaba1','다카다노바바 1초메','다카다노바바역 동쪽','다카다노바바1',35.7109,139.7070),
    '西新宿1丁目': ('nishishinjuku1','니시신주쿠 1초메','신주쿠역 서쪽','니시신주쿠1',35.6902,139.6968),
    '西新宿4丁目': ('nishishinjuku4','니시신주쿠 4초메','니시신주쿠고초메 일대','니시신주쿠4',35.6895,139.6826),
}
areas=[]
for key in meta:
    a=next(a for a in jp_raw['areas'] if a['normalized_name_ja']==key)
    ident,name,subtitle,short,lat,lng=meta[key]
    r,e=a['residents'],a['economy']
    areas.append(dict(id=ident,name=name,localName=key,subtitle=subtitle,short=short,lat=lat,lng=lng,kind='町丁目',
        residents=dict(total=r['total'],groups={'first':r['age_groups']['0-19'],**{k:v for k,v in r['age_groups'].items() if k!='0-19'}},date='2026.10.01',note='일본인·외국인을 포함한 주민등록 인구입니다. 동 전체를 집계하며 방문자·음식점 고객 연령이 아닙니다.'),
        workers=dict(total=e.get('all_private_workers'),establishments=e.get('all_private_establishments'),food=e.get('restaurant_establishments_jsic76'),date='2021.06.01'),flow=None))

def src(title,status,description,observed,refresh,unit,*links):
    return dict(title=title,status=status,description=description,observed=observed,refresh=refresh,unit=unit,links=[dict(label=t,url=u) for t,u in links])

jp=dict(label='일본 · 도쿄',city='도쿄',scope='신주쿠구 · 6개 동네',currency='JPY',currencyName='엔',center=[35.6994,139.6985],zoom=13,defaultLayer='residents',
    areaObservation='거주 2026.10 / 종사자 2021.06',workerLabel='민영 사업장 종사자',
    areaSource='https://www.city.shinjuku.lg.jp/kusei/file02_00026.html',areaSourceTitle='신주쿠구 원자료',
    caveat='거주인구는 유동인구·직장인·구매 고객이 아닙니다. 동네마다 면적이 달라 절대 인구를 인구밀도로 해석할 수 없습니다. 주민(2026년)과 종사자(2021년)는 관측 시점이 달라 동시점의 주야간 비율을 만들지 않습니다.',
    currentFeatures='6개 동네 주민 연령 · 2021 종사자 · 매물 3건 · 엔화 손익',areas=areas,
    propertyNotice='공개 매물 3건의 2026.10.24 조회 시점 정보입니다. 현재 공실·계약 가능 여부는 원문과 중개사에게 재확인해야 합니다. 면적은 ㎡와 일본 坪이며, 초기 비용의 미공개 항목은 미확인으로 남깁니다.',
    propertyLinks=[dict(label='飲食店ドットコム',url='https://www.inshokuten.com/bukken/')],
    properties=[
      dict(id='jp-405698',title='오쿠보 · 이자카야 승계',localTitle='百人町1',floor='B1',rent=302500,management=None,deposit=None,transfer=3300000,areaDisplay='33.88㎡ · 10.25坪',condition='기존 이자카야',taxNote='임대료 소비세 포함 여부 미확인',sourceDate='2026.10.22',source='https://www.inshokuten.com/bukken/bukkens/405698',note='지하 1층. 설비양도금 330만 엔. 음식점 가능으로 게시되며 세부 업종·주방 조건은 확인이 필요합니다.'),
      dict(id='jp-404586',title='니시신주쿠 · 1층 노면',localTitle='西新宿4',floor='1F',rent=660000,management=0,additionalMonthly=1100,deposit=None,transfer=None,areaDisplay='45.52㎡ · 13.77坪',condition='스켈레톤',taxNote='임대료 소비세 포함 · 관리/공익비 없음',sourceDate='2026.10.11',source='https://www.inshokuten.com/bukken/bukkens/404586',note='중음식·영업시간 협의. 보증금 3개월(산정액 확인 필요), 별도 지원비 월 1,100엔은 월 계산에 추가 반영합니다. 사례금·보증회사·열쇠 비용은 개점 부대비로 확인하세요.'),
      dict(id='jp-405549',title='다카다노바바 · 포커바 승계',localTitle='高田馬場1',floor='2F',rent=462000,management=None,deposit=None,transfer=None,areaDisplay='72.23㎡ · 21.85坪',condition='기존 포커바',taxNote='임대료 소비세 포함 여부 미확인',sourceDate='2026.10.21',source='https://www.inshokuten.com/bukken/bukkens/405549',note='중음식 가능으로 게시. 설비양도금 협의, 기획료 1개월, 1년 미만 해지 위약금. 실제 주방·인허가는 별도 확인합니다.'),
    ],sources=[
      src('신주쿠구 연령별 거주인구','실제 자료 수록','공식 XLSX의 일본인+외국인 합계. 5세 구간을 0–19/20–39/40–59/60+로 합산하고 전체 합계를 검증했습니다.','2026.10.01','원천 월별 / 이 앱은 확인 시점 자료','町丁目 전체',('신주쿠구','https://www.city.shinjuku.lg.jp/kusei/file02_00026.html'),('원본 XLSX','https://www.city.shinjuku.lg.jp/content/000467645.xlsx')),
      src('도쿄 경제센서스','실제 자료 수록','전산업 민영 사업체와 종사자입니다. 오피스만의 수나 현재 낮 체류인구가 아닙니다. 2021 음식점 수를 현재 경쟁점 수로 표시하지 않습니다.','2021.06.01','경제센서스 공표 시 / 자동 갱신 미연결','町丁目·산업중분류',('도쿄도 API·CC BY','https://spec.api.metro.tokyo.lg.jp/spec/t000003d2000000954-ab187a0bd49660eedf07684872908142-0')),
      src('도코모 모바쿠 실시간판','연동 후보','인구·성별·연령·거주지의 시스템 연동이 가능합니다. 데이터 공급과 외부 앱 표시 권한은 계약 확인이 필요합니다. 현재 이 앱에는 연결되지 않았습니다.','공식 사양: 1시간 전','10분마다','최소 500m 메쉬',('공식 사양','https://mobaku.jp/service/rt_distribution/'),('공개 인구 지도','https://mobakumap.jp/')),
      src('Location AI · 人流アナリティクス','기존 서비스','무료 2지점 분석, 시간대·연령·방문 특성. 유료 Starter 월 1만 엔(세전, 6개월 계약). 서비스 이용료와 앱 데이터 재배포 권한은 다릅니다.','서비스별 분석 기간','최단 전일 자료 · 계약 사양 확인','지점·주변 지역',('분석 서비스','https://location-ai.com/service/jinryu-analytics/'),('현재 요금표','https://location-ai.com/service/lap/lap-plans/')),
      src('음식점 임대 매물','참조 3건','공개 페이지의 월세·면적·층수·설비 상태를 확인했습니다. 상세 주소가 없는 매물은 건물 핀을 표시하지 않습니다. 공실 자동 동기화는 미연결입니다.','조회 2026.10.24','원문 개별 갱신 / 이 앱 수동 확인','개별 공개 매물',('매물 검색','https://www.inshokuten.com/bukken/')),
      src('Hot Pepper · GEO×DIGITAL','연동 후보','점포 좌표·업종·예산 또는 체인점과 상권 데이터 연동 경로입니다. Hot Pepper의 점포 목록은 전체 음식점 전수도, 실제 고객 연령 데이터도 아닙니다.','공급원별','API별 조건 확인','점포·상권',('Hot Pepper API','https://webservice.recruit.co.jp/doc/hotpepper/reference.html'),('GEO×DIGITAL','https://www.giken.co.jp/products/geodigital/')),
    ])

kr_areas=[
  dict(id='seongsu',name='성수',subtitle='성동구 · 후보 지역',lat=37.5446,lng=127.0559),
  dict(id='yeonnam',name='연남',subtitle='마포구 · 후보 지역',lat=37.5628,lng=126.9250),
  dict(id='hongdae',name='홍대입구',subtitle='마포구 · 후보 지역',lat=37.5565,lng=126.9238),
  dict(id='yeoksam',name='역삼',subtitle='강남구 · 후보 지역',lat=37.5007,lng=127.0365),
  dict(id='euljiro',name='을지로',subtitle='중구 · 후보 지역',lat=37.5662,lng=126.9920),
  dict(id='gongdeok',name='공덕',subtitle='마포구 · 후보 지역',lat=37.5447,lng=126.9514),
]
for a in kr_areas:a.update(kind='자료 연결 전',residents=None,workers=None,flow=None)
kl=json.loads((root/'korea-listings.json').read_text())['listings']
kr_props=[]
for p in kl:
    kr_props.append(dict(id=p['id'],title=p['title_ko'],localTitle=p['area_ko'],floor='1F' if p['area_ko']=='성수' else '1 / 1.5F',rent=p['monthly_rent'],management=p['monthly_management_fee'],deposit=p['deposit'],transfer=p['key_money'],areaDisplay=f"전용 {p['exclusive_area_sqm']}㎡",condition='무권리' if p['key_money']==0 else '권리금 5,000만원',taxNote='월세 부가세 별도 · 관리비 부가세 미확인' if p['rent_vat_status']=='excluded' else '월세 부가세 포함 여부 미확인',sourceDate=p['source_published_date'] or '1개월 전 표기 · 정확 날짜 미확인',source=p['source_url'],note='식당 가능으로 광고. 공급 34.286㎡, 전용 30.24㎡를 구분하며 인허가·임대인 허용은 확인 전입니다.' if p['area_ko']=='성수' else '전용 93.26㎡, 권리금 5,000만원(시설집기 포함). 1층/설명 1.5층 표기 차이. 음식점 가능 여부는 확인 전입니다.'))
kr=dict(label='대한민국 · 서울',city='서울',scope='서울 시범 · 전국 확장 구조',currency='KRW',currencyName='원',center=[37.549,126.989],zoom=11.5,defaultLayer='residents',workerLabel='직장 인구',
    areaObservation='자료별 기준기간을 표시합니다',areaSource='https://golmok.seoul.go.kr/source.do',areaSourceTitle='서울시 데이터 출처',
    caveat='상주·직장·생활인구와 음식점 구매 고객은 서로 다른 지표입니다. 유동인구의 분기 집계를 하루 방문자나 고유 인원으로 바꾸지 않습니다. 매출은 지역·업종 추정이며 특정 점포의 실제 매출이 아닙니다.',
    currentFeatures='서울 자료 연동 경로 · 한국 참조 매물 2건 · 원화 손익',areas=kr_areas,properties=kr_props,
    propertyNotice='한국 공개 매물 2건의 2026.10.24 조회 시점 정보입니다. 보증금·월세·관리비·권리금과 부가세를 구분합니다. 전용면적을 기준으로 보여주며, 원문과 현장 상태가 다른 항목은 확인 필요로 남깁니다. 공실·인허가를 검증한 매물이 아닙니다.',
    propertyLinks=[dict(label='딱자리 매물',url='https://ddak.disco.re/'),dict(label='당근부동산',url='https://realty.daangn.com/')],
    sources=[
      src('서울 상권분석 공개 데이터','자료 추출 중','상권 단위 상주·직장·길단위인구·추정매출의 공식 자료입니다. 같은 자료 분기라도 원천 기준연도가 다를 수 있습니다.','현재 서비스 출처표: 항목별 2023–2026년','분기·반기·연별 / 원천별 다름','상권·행정동·표준단위구역',('서울 상권분석','https://golmok.seoul.go.kr/'),('출처·기준일','https://golmok.seoul.go.kr/source.do'),('길단위인구 공개자료','https://data.seoul.go.kr/dataList/OA-15568/A/1/datasetView.do')),
      src('서울 실시간 도시데이터','연동 후보','공식 121개 주요 장소의 실시간 인구 등입니다. 서울 모든 골목의 데이터는 아니며 샘플키는 광화문·덕수궁만, 다른 장소는 인증키가 필요합니다. 90일 이하 단기체류 외국인은 인구 추정에서 제외됩니다.','각 응답의 인구 관측 시각','실시간 / API 관측시각 표시 필요','지정된 주요 121장소',('공식 API 안내','https://data.seoul.go.kr/dataList/OA-21285/A/1/datasetView.do')),
      src('전국 상가(상권)정보','연동 후보','소상공인시장진흥공단의 전국 점포명·업종·주소·좌표. 무료 공식 API 활용 신청 후 점포 기본 목록을 구성할 수 있습니다. 고객 연령·실매출을 제공하는 API가 아닙니다.','점포 원자료의 기준일 확인','파일 분기 / API 메타만으로 실시간 영업 보장 불가','전국 개별 상가',('공식 API','https://www.data.go.kr/data/15012005/openapi.do'),('공식 CSV','https://www.data.go.kr/data/15083033/fileData.do')),
      src('서울 업종별 추정매출','연동 후보','성·연령·시간별 소비 구조를 보는 자료입니다. 개인·법인 매출의 분모가 달라 연령 구성비를 별도 계산해야 합니다. 개별 음식점의 실제 매출이나 고객 수가 아닙니다.','공식 서비스 표: 2026.06','분기 / 제공기관 게시시점 확인','상권 × 업종',('공개 데이터·공공누리1','https://data.seoul.go.kr/dataList/OA-15572/S/1/datasetView.do?tab=A')),
      src('한국 임대 매물','참조 2건','성수·연남의 공개 원문에서 금액과 면적을 확인했습니다. 연남 매물은 1층/1.5층 표기 차이를 함께 표시합니다. 공개 API 또는 제휴 공급망은 아직 연결되지 않았습니다.','조회 2026.10.24','매물 개별 갱신 / 이 앱 수동 확인','개별 공개 매물',('성수 원문',kr_props[0]['source']),('연남 원문',kr_props[1]['source'])),
      src('이미 이용할 수 있는 서비스','기존 서비스','소상공인365는 공공 상권분석, 딱자리는 매물·창업 정보, 오픈업은 추정매출 등을 제공합니다. 이들 화면이 무료로 보인다는 사실이 새 앱에 재배포할 권한을 의미하지 않습니다.','각 서비스의 표시 기준일','상품·지표별','전국·서울 / 상품별 범위',('소상공인365','https://bigdata.sbiz.or.kr/'),('딱자리','https://ddak.disco.re/'),('오픈업','https://www.openub.com/')),
    ])

kr_verified_path=root/'korea-verified.json'
if kr_verified_path.exists():
    kv=json.loads(kr_verified_path.read_text())
    kr['areas']=[]
    for a in kv['areas']:
        r,w,f=a['residents'],a['economy'],a['flow']
        def groups(x):
            return {'first':x['연령대10(원자료)'],'20-39':x['20-39'],'40-59':x['40-59'],'60+':x['60+']}
        kr['areas'].append(dict(id=a['id'],name=a['name'],localName=f"{a['district']} · {a['geography_type']}",subtitle=a['administrative_neighborhood'],short=a['name'].replace('(홍대)','').replace('동카페거리','카페거리'),lat=a.get('lat'),lng=a.get('lng'),kind=a['geography_type'],areaM2=a['area_m2'],
            residents=dict(total=r['total'],groups=groups(r['age_groups']),date='2026년 2분기 수록',note='상권 영역 내 상주인구입니다. 수록 분기와 원천 관측일은 다릅니다. 원자료 연령구간10의 범위는 미확인으로 원래 이름을 유지합니다.'),
            workers=dict(total=w['workers'],date='2026년 2분기 수록',estimated=True),
            flow=dict(total=f['raw_total'],groups=groups(f['age_groups']),date='2026년 2분기',unit='원자료 지표',timeBands=f['time_bands'],weekdays=f['weekday_values'],note='서울시·KT 기반 생활인구 추정. 원자료 구성비이며 특정 음식점 고객 연령이 아닙니다. 총계의 시간 집계 분모가 미검증이므로 일평균·고유 방문자로 표시하지 않습니다. 연령구간10의 정확한 범위는 확인 전입니다.')))
    kr['scope']='서울 · 공식 상권 6곳'
    kr['defaultLayer']='flow'
    kr['workerLabel']='직장 인구 (SKT 기반)'
    kr['areaObservation']='서울 공식자료 · 2026년 2분기 수록'
    kr['areaSource']='https://data.seoul.go.kr/dataList/OA-15568/A/1/datasetView.do'
    kr['areaSourceTitle']='서울 열린데이터광장'
    kr['currentFeatures']='서울 6개 상권 인구·연령·시간구성 · 매물 2건 · 원화 손익'
    kr['sources'][0]=src('서울 6개 상권 인구·연령','실제 자료 수록','전체 공식 CSV에서 상권코드로 상주·직장·길단위인구·상권영역을 결합했습니다. 상주·직장 자료는 수록 분기와 원천 관측일이 다릅니다. 원천 설명의 갱신 안내와 서비스 출처표의 차이가 있어 해당 행의 원천 기준일은 미확인으로 남겼습니다.','2026년 2분기 수록 / 원천일 별도','인구 자료별 상이 / 이 앱은 확인 시점 자료','서울시가 지정한 상권 / 행정동 전체 아님',('상주인구','https://data.seoul.go.kr/dataList/OA-15584/A/1/datasetView.do'),('직장인구','https://data.seoul.go.kr/dataList/OA-15569/A/1/datasetView.do'),('길단위인구','https://data.seoul.go.kr/dataList/OA-15568/A/1/datasetView.do'),('상권영역','https://data.seoul.go.kr/dataList/OA-15560/A/1/datasetView.do'))
    (out/'provenance-korea.json').write_text(json.dumps(kv,ensure_ascii=False,indent=2))

data=dict(version=1,checkedOn='2026-10-24',countries=dict(KR=kr,JP=jp))
(out/'data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
(out/'provenance-japan.json').write_text(json.dumps(jp_raw,ensure_ascii=False,indent=2))
(out/'provenance-korea-listings.json').write_text(json.dumps(kl,ensure_ascii=False,indent=2))
print(f"Prepared {len(areas)} Japanese districts and {len(kr_props)} Korean property references")
