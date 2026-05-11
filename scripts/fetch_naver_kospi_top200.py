import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

OUTPUT = Path('/home/ubuntu/korea-stock-sector-analyzer/data/kospi_top200.json')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
MARKET_CAP_LIMIT = 300

THEMES = [
    {
        'key': 'ai_semiconductor_value_chain',
        'label': 'AI·반도체 밸류체인',
        'keywords': ['삼성전자', 'SK하이닉스', 'DB하이텍', '한미반도체', '삼성전기', '삼성SDI', 'LG이노텍', 'LX세미콘', '두산테스나', 'HPSP', 'ISC', '리노공업', '원익', '주성', '이오테크닉스', '솔브레인', '동진쎄미켐'],
    },
    {
        'key': 'power_infra_machinery',
        'label': '전력·인프라·기계',
        'keywords': ['두산에너빌리티', 'LS ELECTRIC', 'LS', '효성중공업', 'HD현대일렉트릭', '한국전력', '한전', '대한전선', '현대건설', '대우건설', 'GS건설', 'DL이앤씨', 'KCC', '한일시멘트', '두산밥캣'],
    },
    {
        'key': 'battery_mobility',
        'label': '배터리·모빌리티',
        'keywords': ['LG에너지솔루션', '현대차', '기아', '현대모비스', 'HL만도', '현대위아', '한온시스템', '금호타이어', '한국타이어', '세방전지', 'SK아이이테크놀로지', '포스코퓨처엠', '엘앤에프', '에코프로', 'LG화학'],
    },
    {
        'key': 'shipbuilding_defense_aerospace',
        'label': '조선·방산·항공',
        'keywords': ['한화에어로스페이스', 'LIG넥스원', '현대로템', '한국항공우주', 'HD현대중공업', 'HD한국조선해양', 'HD현대미포', '삼성중공업', '한화오션', '대한항공', '한진칼'],
    },
    {
        'key': 'finance_brokerage_insurance',
        'label': '금융·증권·보험',
        'keywords': ['금융', '증권', '보험', '은행', '카드', 'BNK', 'JB', 'KB', '신한지주', '하나금융', '우리금융', '기업은행', '카카오뱅크', '카카오페이', '메리츠금융', '삼성생명', '삼성화재', '현대해상', 'DB손해보험', '한화생명', '미래에셋', 'NH투자', '키움증권'],
    },
    {
        'key': 'platform_telecom_content',
        'label': '플랫폼·통신·콘텐츠',
        'keywords': ['NAVER', '카카오', 'SK텔레콤', 'KT', 'LG유플러스', '엔씨소프트', '크래프톤', '넷마블', '하이브', '제일기획', '이노션', '스튜디오드래곤', '더블유게임즈'],
    },
    {
        'key': 'bio_healthcare',
        'label': '바이오·헬스케어',
        'keywords': ['바이오', '셀트리온', '삼성바이오', '유한양행', '한미약품', '녹십자', '대웅제약', '종근당', 'SK바이오', '한올바이오', '보령'],
    },
    {
        'key': 'consumer_retail_travel',
        'label': '소비재·유통·여행',
        'keywords': ['오리온', '농심', '롯데칠성', '롯데쇼핑', '신세계', '이마트', '현대백화점', '호텔신라', '강원랜드', 'GKL', '아모레', 'LG생활건강', '코웨이', '영원무역', 'F&F', 'BGF', 'GS리테일', '하이트진로', '삼양식품', '오뚜기', 'CJ제일제당'],
    },
    {
        'key': 'chemicals_materials_steel',
        'label': '화학·소재·철강',
        'keywords': ['POSCO', '포스코', '현대제철', '고려아연', '풍산', '금양', '롯데케미칼', '한화솔루션', 'S-Oil', 'SK이노베이션', 'SKC', '효성티앤씨', 'OCI', '대한유화', '영풍', '코스모신소재'],
    },
    {
        'key': 'holding_multi_industry',
        'label': '지주·복합산업',
        'keywords': ['SK', 'LG', 'GS', 'HD현대', 'CJ', '두산', '한화', '삼성물산', 'SK스퀘어', 'LX홀딩스', '롯데지주', '효성', 'DN오토모티브'],
    },
]


def parse_num(text: str) -> Optional[float]:
    cleaned = text.replace(',', '').replace('%', '').strip()
    if not cleaned or cleaned in {'N/A', '-'}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def theme_for(name: str) -> str:
    for theme in THEMES:
        if any(keyword in name for keyword in theme['keywords']):
            return theme['key']
    return 'industrial_business_services'


def fetch_page(page: int):
    url = 'https://finance.naver.com/sise/sise_market_sum.naver'
    params = {'sosok': '0', 'page': str(page)}
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, params=params, headers=headers, timeout=20)
    response.raise_for_status()
    response.encoding = 'euc-kr'
    soup = BeautifulSoup(response.text, 'html.parser')
    rows = []
    for tr in soup.select('table.type_2 tr'):
        cols = [td.get_text(strip=True) for td in tr.select('td')]
        link = tr.select_one('a.tltle[href*="code="]')
        if not link or len(cols) < 12:
            continue
        href = link.get('href', '')
        match = re.search(r'code=(\d+)', href)
        if not match:
            continue
        name = link.get_text(strip=True)
        code = match.group(1)
        current_price = parse_num(cols[2]) or 0
        per = parse_num(cols[10])
        annual_eps = round(current_price / per, 2) if per and per > 0 else 0
        rows.append({
            'sector': theme_for(name),
            'name': name,
            'code': code,
            'marketSuffix': 'KS',
            'currentPrice': current_price,
            'annualEps': annual_eps,
            'dataSource': f'NaverFinance:market_sum:{datetime.now().strftime("%Y%m%d")}',
            'lastPriceFetchedAt': datetime.now().isoformat(),
        })
    return rows


def main():
    records = []
    pages = (MARKET_CAP_LIMIT + 49) // 50
    for page in range(1, pages + 1):
        records.extend(fetch_page(page))
    records = records[:MARKET_CAP_LIMIT]
    for i, row in enumerate(records, start=1):
        row['marketRank'] = i
    output = {
        'generatedAt': datetime.now().isoformat(),
        'source': 'https://finance.naver.com/sise/sise_market_sum.naver?sosok=0',
        'count': len(records),
        'themes': [{'key': item['key'], 'label': item['label']} for item in THEMES] + [{'key': 'industrial_business_services', 'label': '산업재·비즈니스 서비스'}],
        'records': records,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'count': len(records), 'output': str(OUTPUT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
