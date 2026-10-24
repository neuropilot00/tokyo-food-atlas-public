"""Package verified source snapshots for the beta without inventing missing metrics."""
import collections
import copy
import hashlib
import json
import pathlib
import shutil

PROJECT = pathlib.Path(__file__).resolve().parents[1]
WORKSPACE = PROJECT.parent
OUT = PROJECT / 'public' / 'market'
VERSION = '2026-10-24-beta-2'
MAX_BYTES = 6 * 1024 * 1024
RECORD_DEFINITION = '소진공 원본 상가업소번호 기준 음식업소 레코드 수입니다. 동일 상호·주소의 서로 다른 id를 물리적 점포 하나로 중복 제거하지 않았으며 현재 영업 여부를 뜻하지 않습니다.'

def read(path):
    return json.loads(path.read_text())

def write(path, data):
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
    if len(raw) > MAX_BYTES:
        raise ValueError(f'Asset exceeds 6 MiB: {path} ({len(raw)})')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)

def unavailable():
    return {'total': None, 'groups': None, 'date': None, 'note': '이 지역의 해당 지표는 연결되지 않았습니다.'}

def coverage(area, directory=False, economic=False):
    return {'residents': (area.get('residents') or {}).get('total') is not None, 'workers': (area.get('workers') or {}).get('total') is not None, 'flow': (area.get('flow') or {}).get('total') is not None, 'shops': directory, 'customerAge': False, 'economicSnapshot': economic}

def skeleton(ident, name, lat, lng, province, district, kind):
    return {'id': ident, 'name': name, 'country': 'KR', 'lat': lat, 'lng': lng, 'province': province, 'district': district, 'localName': ' · '.join(x for x in [province, district] if x), 'subtitle': kind, 'short': name, 'kind': kind, 'areaM2': None, 'residents': unavailable(), 'workers': unavailable(), 'flow': None}

def resident_metric(row):
    """Preserve the source's resident definition and month, independently of shop dates."""
    groups = {'first': row['ageGroups']['0-19'], **{k: row['ageGroups'][k] for k in ['20-39', '40-59', '60+']}}
    assert sum(groups.values()) == sum(row['ageGroupsNative'].values()) == row['total']
    return {
        'total': row['total'], 'groups': groups, 'ageGroupsNative': row['ageGroupsNative'],
        'date': row['observedDate'].replace('-', '.'), 'censusMonth': row['month'],
        'sourcePeriod': row['month'], 'observedDate': row['observedDate'], 'estimated': False,
        'note': row['definition'], 'definition': row['definition'],
        'sourceId': 'MOIS_RESIDENT_AGE_MONTH', 'sourceUrl': row['sourceUrl'],
        'sourceCode': row['sourceCode'], 'sourceCsvRow': row['sourceCsvRow'],
        'sourceAgeLabel': row['sourceAgeLabel'], 'sourceAgeRangesVerified': row['sourceAgeRangesVerified'],
        'unitLevel': row['unitLevel'], 'joinPolicy': 'exact_administrative_code_only',
    }

def index_entry(area, detail_path):
    keys = ['id', 'name', 'country', 'lat', 'lng', 'province', 'provinceCode', 'district', 'districtCode', 'kind', 'coverage', 'sourcePeriod', 'coordinateBasis', 'storeCount', 'storeRecordCount', 'canonicalId']
    item = {k: area[k] for k in keys if k in area}
    item['searchText'] = ' '.join(str(area.get(k) or '') for k in ['name', 'localName', 'subtitle', 'short', 'province', 'district', 'neighborhood', 'searchText', 'aliases'])
    item['detailPath'] = detail_path
    return item

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    core_path = PROJECT / 'public' / 'data.json'
    core = read(core_path)
    legacy_path = OUT / 'legacy-core.json'
    if not legacy_path.exists():
        old_path = PROJECT / 'dist' / 'data.json'
        old_core = read(old_path) if old_path.exists() else core
        write(legacy_path, {'schemaVersion': 1, 'source': 'curated core before nationwide beta expansion', 'countries': {c: old_core['countries'][c]['areas'] for c in ['KR', 'JP']}})
    legacy_jp = {a['id']: a for a in read(legacy_path)['countries']['JP']}
    national = read(WORKSPACE / 'beta-data-national' / 'kr-food' / 'manifest.json')
    region_source = read(WORKSPACE / 'beta-data-national' / 'kr-food' / 'region-index.json')
    tokyo = read(WORKSPACE / 'beta-data-national' / 'tokyo-areas-geocoded-2021.json')
    japan = read(WORKSPACE / 'beta-data-japangeo' / 'japan-municipalities.json')
    seoul = read(WORKSPACE / 'beta-data-seoul' / 'seoul-areas.json')
    competition = read(WORKSPACE / 'beta-data-seoul' / 'competition.json')
    resident_source = read(WORKSPACE / 'beta-data-national-residents' / 'residents-verified.json')
    resident_rows = {r['sourceCode']: r for r in resident_source['areas']}
    assert len(resident_rows) == len(resident_source['areas'])
    resident_join = {level: {'regions': 0, 'matched': 0, 'missing': 0} for level in ['province', 'district', 'administrative_dong']}
    resident_missing = []
    all_regions = {'KR': [], 'JP': []}
    details = collections.defaultdict(dict)

    for source in (WORKSPACE / 'beta-data-national' / 'kr-food').glob('*.json'):
        if source.name != 'sample-stores.json':
            dest = OUT / 'kr-food' / source.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, dest)
    for source in (WORKSPACE / 'beta-data-national' / 'kr-food' / 'districts').glob('*.json'):
        dest = OUT / 'kr-food' / 'districts' / source.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, dest)
    write(OUT / 'kr-food' / 'manifest.json', {**national, 'totalRecordCount': national['totalStoreCount'], 'countUnit': 'source_food_business_record', 'physicalOutletDeduplication': False, 'recordCountDefinition': RECORD_DEFINITION})
    write(OUT / 'kr-food' / 'search-index.json', {'schemaVersion': 1, 'sourcePeriod': national['sourcePeriod'], 'sourceUrl': national['sourceUrl'], 'categories': region_source['categories'], 'districts': [{k: d[k] for k in ['code', 'name', 'provinceCode', 'provinceName', 'centroid', 'bbox', 'chunk', 'storeCount']} for d in region_source['districts']]})

    seoul_by_id = {}
    for original in seoul:
        area = copy.deepcopy(original)
        area.update(country='KR', province='서울특별시', provinceCode='11', sourcePeriod='2026-Q2', coordinateBasis='official_trade_area_source_representative_coordinate', sourceUrl='https://data.seoul.go.kr/dataList/OA-15560/A/1/datasetView.do')
        area['coverage'] = coverage(area, True)
        path = f'areas/KR/seoul-{area["districtCode"]}.json'
        details[path][area['id']] = area
        all_regions['KR'].append(index_entry(area, path))
        seoul_by_id[area['id']] = area

    for level, rows in [('province', region_source['provinces']), ('district', region_source['districts']), ('administrative_dong', region_source['administrativeDongs'])]:
        for row in rows:
            pc = row['code'] if level == 'province' else row['provinceCode']
            pn = row['name'] if level == 'province' else row['provinceName']
            dn = row['name'] if level == 'district' else row.get('districtName', '')
            prefix = {'province': 'KR-PROV-', 'district': 'KR-DIST-', 'administrative_dong': 'KR-ADONG-'}[level]
            point = row.get('centroid') or {}
            area = skeleton(prefix + row['code'], row['name'], point.get('lat'), point.get('lon'), pn, dn, {'province': '시도 · 음식점 좌표 평균', 'district': '시군구 · 음식점 좌표 평균', 'administrative_dong': '행정동 · 음식점 좌표 평균'}[level])
            area.update(provinceCode=pc, districtCode=row['code'] if level == 'district' else row.get('districtCode'), sourcePeriod=national['sourcePeriod'], coordinateBasis=row['centroidBasis'], sourceUrl=national['sourceUrl'], storeCount=row['storeCount'], storeRecordCount=row['storeCount'], storeCountDefinition=RECORD_DEFINITION, categoryCounts=row['categoryCounts'], geographicLevel=level)
            if level == 'administrative_dong':
                area['neighborhoodCode'] = row['code']
                area['neighborhood'] = row['name']
            resident_code = row['code'] + '0' * {'province': 8, 'district': 5, 'administrative_dong': 2}[level]
            resident_row = resident_rows.get(resident_code)
            resident_join[level]['regions'] += 1
            if resident_row is not None:
                assert resident_row['unitLevel'] == {'administrative_dong': 'neighborhood'}.get(level, level)
                assert resident_row['canonicalCode'] == row['code']
                area['residents'] = resident_metric(resident_row)
                resident_join[level]['matched'] += 1
            else:
                area['residents'].update(note='같은 행정코드의 주민등록 인구 원자료 행이 없습니다. 이름으로 추정하거나 0명으로 채우지 않습니다.', missingReason='administrative_code_not_in_resident_source', requestedSourceCode=resident_code, checkedSourceMonth=resident_source['metadata']['month'])
                resident_join[level]['missing'] += 1
                resident_missing.append({'id': area['id'], 'name': area['name'], 'sourceCode': resident_code, 'geographicLevel': level})
            area['coverage'] = coverage(area, True)
            area['aliases'] = ('광주 전남 전라남도' if pc == '12' else '')
            path = f'areas/KR/national-{pc}.json'
            details[path][area['id']] = area
            all_regions['KR'].append(index_entry(area, path))

    core_jp_by_name = {'新宿区' + a['localName']: a for a in core['countries']['JP']['areas']}
    tokyo_municipalities = {a['municipalityCode']: a for a in tokyo['areas'] if a['geographyLevel'] == 2 and not a.get('boundaryUnspecified')}
    updated_core_jp = {}
    for census in tokyo['areas']:
        if not census['isLeaf']:
            continue
        previous = core_jp_by_name.get(census['name'])
        ident = previous['id'] if previous else census['id']
        area = skeleton(ident, census['addressTown'] or census['name'], census['lat'], census['lon'], '東京都', census['municipality'], '町丁目 · 2021 경제센서스')
        area.update(country='JP', canonicalId=census['id'], provinceCode='130001', districtCode=census['municipalityCode'], localName=census['name'], subtitle=census['municipality'], sourcePeriod='2021-06-01', sourceUrl=tokyo['sourceUrl'], coordinateBasis=census['coordinateMetadata'].get('coordinate_level'), coordinateMetadata=census['coordinateMetadata'], workers={'total': census['employees']['allIndustries'], 'establishments': census['establishments']['allIndustries'], 'food': census['establishments']['restaurants'], 'date': '2021.06.01', 'note': '2021년 민영 사업체 종사자 수입니다. 현재 직장인구·유동인구가 아닙니다.'}, censusSourceRows=census['sourceRows'], restaurantCount=census['establishments']['restaurants'])
        if previous:
            area.update({key: copy.deepcopy(previous[key]) for key in ['id', 'name', 'localName', 'subtitle', 'short', 'residents', 'workers', 'flow'] if key in previous})
            original_point = legacy_jp.get(previous['id'], previous)
            area['legacyCoordinates'] = {'lat': original_point.get('lat'), 'lng': original_point.get('lng'), 'basis': 'previous_curated_area_display_point_replaced_by_attributed_representative_point'}
            updated_core_jp[area['id']] = area
        area['coverage'] = coverage(area, False, True)
        path = f'areas/JP/tokyo-{census["municipalityCode"]}.json'
        details[path][area['id']] = area
        all_regions['JP'].append(index_entry(area, path))

    for row in japan['municipalities']:
        area = skeleton(row['id'], row['name'], row['lat'], row['lng'], row['prefecture'], row['name'], '시구정촌 · 청사 대표점')
        area.update(country='JP', provinceCode=row['prefecture_code'], districtCode=row['code_without_check_digit'], sourcePeriod='2024-12-25', coordinateBasis=row['coordinate_level'], coordinateMetadata={'provider': 'Geolonia', 'sourcePeriod': '2024-12-25', 'license': 'CC BY 4.0', 'sourceUrl': 'https://github.com/geolonia/japanese-addresses-v2'}, sourceUrl='https://github.com/geolonia/japanese-addresses-v2', searchText=row['searchText'])
        census = tokyo_municipalities.get(row['code_without_check_digit'])
        if census:
            area['workers'] = {'total': census['employees']['allIndustries'], 'establishments': census['establishments']['allIndustries'], 'food': census['establishments']['restaurants'], 'date': '2021.06.01', 'note': '2021년 민영 사업체 종사자 수, 시구정촌 전체 집계입니다.'}
            area['sourcePeriod'] = '2021-06-01'
            area['economicSourceUrl'] = tokyo['sourceUrl']
        area['coverage'] = coverage(area, False, bool(census))
        path = f'areas/JP/municipalities-{row["prefecture_code"]}.json'
        details[path][area['id']] = area
        all_regions['JP'].append(index_entry(area, path))

    for path, areas in details.items():
        write(OUT / path, {'schemaVersion': 1, 'version': VERSION, 'areas': areas})
    provinces = {'KR': [{'id': p['code'], 'name': p['name']} for p in region_source['provinces']], 'JP': [{'id': p['code'], 'name': p['name']} for p in japan['prefectures']]}
    for country in ['KR', 'JP']:
        assert len(all_regions[country]) == len({a['id'] for a in all_regions[country]})
        write(OUT / 'regions' / f'{country}.json', {'schemaVersion': 1, 'version': VERSION, 'country': country, 'provinces': provinces[country], 'total': len(all_regions[country]), 'regions': all_regions[country]})

    comp_groups = collections.defaultdict(list)
    comp_index = {}
    for area in competition['areas']:
        district = seoul_by_id[area['id']]['districtCode']
        comp_groups[district].append(area)
        comp_index[area['id']] = f'competition/KR/{district}.json'
    comp_metadata = {k: v for k, v in competition.items() if k not in ['areas', 'missing_combinations']}
    for district, areas in comp_groups.items():
        write(OUT / 'competition' / 'KR' / f'{district}.json', {**comp_metadata, 'areas': areas})
    write(OUT / 'competition' / 'index.json', {'schemaVersion': 1, 'country': 'KR', 'areaPaths': comp_index})
    old_ids = {a['id'] for a in core['countries']['KR']['areas']}
    write(PROJECT / 'public' / 'competition.json', {**comp_metadata, 'areas': [a for a in competition['areas'] if a['id'] in old_ids]})

    core['version'] = 2
    core['marketVersion'] = VERSION
    core['marketApi'] = {'regions': '/api/regions', 'shops': '/api/shops', 'competition': '/api/market/competition', 'status': '/api/market/status'}
    core['countries']['KR'].update(label='대한민국', city='전국', scope='전국 음식업소 레코드 · 행정구역 주민연령 · 서울 상권 인구', currentFeatures=f'전국 음식업소 {national["totalStoreCount"]:,}레코드 · {national["administrativeDongCount"]:,}개 행정동 검색 · {resident_join["administrative_dong"]["matched"]:,}개 행정동 주민연령 · 서울 {len(seoul):,}개 상권 인구')
    core['countries']['JP'].update(label='일본', city='전국 · 도쿄', scope='전국 시구정촌 검색 · 도쿄 5,332개 세부지역', currentFeatures='전국 1,898개 시구정촌 검색 · 도쿄 5,332개 세부지역 2021 경제센서스')
    for country in ['KR', 'JP']:
        core['countries'][country]['provinces'] = provinces[country]
        core['countries'][country]['searchableRegionCount'] = len(all_regions[country])
    core['countries']['KR']['areas'] = [seoul_by_id[a['id']] for a in core['countries']['KR']['areas']]
    core['countries']['JP']['areas'] = [updated_core_jp[a['id']] for a in core['countries']['JP']['areas']]
    write(core_path, core)

    resident_coverage = {'sourceMonth': resident_source['metadata']['month'], 'observedDate': resident_source['metadata']['observedDate'], 'sourceRows': len(resident_source['areas']), 'matchedRegions': sum(r['matched'] for r in resident_join.values()), 'missingRegions': sum(r['missing'] for r in resident_join.values()), 'byLevel': resident_join, 'unmatched': resident_missing, 'joinPolicy': resident_source['metadata']['joinPolicy'], 'definition': resident_source['metadata']['definition']}
    resident_download = read(WORKSPACE / 'beta-data-national-residents' / 'download-metadata.json')
    write(OUT / 'residents' / 'KR-2026-09.json', {'metadata': resident_source['metadata'], 'coverage': resident_coverage, 'downloadRequest': {k: resident_download[k] for k in ['sourceUrl', 'landingUrl', 'method', 'form', 'bytes', 'sha256']}})
    write(OUT / 'sources.json', {'verifiedOn': '2026-10-24', 'providers': [
        {'id': 'semas', 'provider': national['provider'], 'sourceUrl': national['sourceUrl'], 'sourcePeriod': national['sourcePeriod'], 'license': national['license'], 'sourceSha256': read(WORKSPACE / 'beta-data-national' / 'semas-download-receipt.json')['sha256'], 'recordCountDefinition': RECORD_DEFINITION},
        {'id': 'mois-residents', 'provider': '행정안전부', 'sourceUrl': resident_source['metadata']['sourceUrl'], 'sourcePeriod': resident_source['metadata']['month'], 'observedDate': resident_source['metadata']['observedDate'], 'license': resident_source['metadata']['license'], 'sourceSha256': resident_source['metadata']['rawSha256'], 'definition': resident_source['metadata']['definition'], 'coverage': resident_coverage, 'provenance': 'residents/KR-2026-09.json'},
        {'id': 'seoul', 'provider': '서울특별시 / 서울신용보증재단', 'sourcePeriod': '2026-Q2', 'license': '공공누리 제1유형 (출처표시)', 'sourceUrl': 'https://data.seoul.go.kr/dataList/OA-15568/A/1/datasetView.do'},
        {'id': 'tokyo-census', 'provider': '東京都総務局', 'sourcePeriod': '2021-06-01', 'license': tokyo['license'], 'sourceUrl': tokyo['sourceUrl']},
        {'id': 'geolonia', **japan['source']}
    ], 'warnings': ['지역의 인구 연령 구성은 특정 음식점의 고객 연령이 아닙니다.', '스냅샷의 업소 레코드 존재는 현재 영업 확인이 아니며 물리적 점포 기준으로 중복 제거하지 않았습니다.', '행정구역 주민등록 인구를 서울 상권 인구나 유동인구로 대체하지 않습니다.', '미연결 지표는 null이며 0이 아닙니다.', '서로 겹치는 상권/행정구역/센서스 계층을 합산하지 않습니다.']})
    assets = []
    for path in sorted(OUT.rglob('*.json')):
        if path == OUT / 'manifest.json':
            continue
        raw = path.read_bytes()
        if len(raw) > MAX_BYTES:
            raise ValueError(f'Asset exceeds 6 MiB: {path}')
        assets.append({'path': path.relative_to(OUT).as_posix(), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'contentType': 'application/json'})
    manifest = {'schemaVersion': 1, 'version': VERSION, 'builtAt': '2026-10-24', 'files': assets, 'fileCount': len(assets) + 1, 'dataFileCount': len(assets), 'manifestExcludedFromFiles': True, 'totalBytes': sum(x['bytes'] for x in assets), 'maxFileBytes': max(x['bytes'] for x in assets), 'regions': {'KR': {'path': 'regions/KR.json', 'total': len(all_regions['KR'])}, 'JP': {'path': 'regions/JP.json', 'total': len(all_regions['JP'])}}, 'coverage': {'KR': {'foodStores': national['totalStoreCount'], 'foodStoreRecords': national['totalStoreCount'], 'foodCountUnit': 'source_food_business_record', 'physicalOutletDeduplication': False, 'provinceCodesInSource': national['provinceCount'], 'districts': national['districtCount'], 'administrativeDongs': national['administrativeDongCount'], 'seoulTradeAreas': len(seoul), 'sourcePeriod': national['sourcePeriod'], 'populationPeriod': '2026-Q2', 'seoulTradeAreaPopulationPeriod': '2026-Q2', 'administrativeResidents': resident_coverage}, 'JP': {'municipalities': len(japan['municipalities']), 'tokyoLeafAreas': tokyo['leafAreaCount'], 'tokyoLeafAreasWithCoordinates': tokyo['coordinateCoverage']['coordinate_available_leaf_regions'], 'economicPeriod': '2021-06-01', 'coordinatePeriod': '2024-12-25', 'places': 'external_provider_required'}}, 'sourceManifest': 'sources.json', 'shopManifest': 'kr-food/manifest.json', 'shopRegionIndex': 'kr-food/search-index.json', 'competitionIndex': 'competition/index.json', 'residentProvenance': 'residents/KR-2026-09.json', 'limitations': ['No store-level customer age.', 'No live foot traffic or verified current opening status.', 'Food business records are not deduplicated physical outlets.', 'Administrative resident populations are not trade-area visitors.', 'Source administrative region codes and coordinate precision are preserved.']}
    assert len(assets) < 1000
    write(OUT / 'manifest.json', manifest)
    print(json.dumps({k: manifest[k] for k in ['fileCount', 'totalBytes', 'maxFileBytes', 'regions', 'coverage']}, ensure_ascii=False))

if __name__ == '__main__':
    main()
