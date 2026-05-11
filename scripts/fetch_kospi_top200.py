from datetime import datetime, timedelta
import json
from pathlib import Path

import pandas as pd
from pykrx import stock

OUTPUT = Path('/home/ubuntu/korea-stock-sector-analyzer/data/kospi_top200.json')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
MARKET_CAP_LIMIT = 300


def latest_available_date(max_days: int = 14) -> str:
    today = datetime.now()
    for offset in range(max_days + 1):
        date = (today - timedelta(days=offset)).strftime('%Y%m%d')
        try:
            df = stock.get_market_cap_by_ticker(date, market='KOSPI')
            if df is not None and len(df) > 0 and float(df['시가총액'].sum()) > 0:
                return date
        except Exception:
            continue
    raise RuntimeError('최근 KOSPI 시가총액 데이터를 찾지 못했습니다.')


def theme_for(name: str) -> str:
    rules = [
        ('ai_semiconductor_value_chain', ['삼성전자', 'SK하이닉스', 'DB하이텍', '한미반도체', '원익', '주성', '리노', '이오테크닉스', '솔브레인', '동진쎄미켐', '삼성전기', '삼성SDI', 'LG이노텍', '두산테스나', 'ISC', 'HPSP', 'LX세미콘']),
        ('power_infra_machinery', ['두산에너빌리티', 'LS', 'LS ELECTRIC', '효성중공업', 'HD현대일렉트릭', '한전', '한국전력', '대한전선', '현대건설', '대우건설', 'GS건설', '삼성물산', 'DL이앤씨', 'KCC', '한일시멘트']),
        ('battery_mobility', ['LG에너지솔루션', '현대차', '기아', '현대모비스', 'HL만도', '현대위아', '한온시스템', '금호타이어', '한국타이어', '세방전지', 'SK아이이테크놀로지', '포스코퓨처엠', '엘앤에프', '에코프로', 'LG화학']),
        ('shipbuilding_defense_aerospace', ['한화에어로스페이스', 'LIG넥스원', '현대로템', '한국항공우주', 'HD현대중공업', 'HD한국조선해양', 'HD현대미포', '삼성중공업', '한화오션', '대한항공', '한진칼']),
        ('finance_brokerage_insurance', ['금융', '증권', '보험', '은행', '카드', 'BNK', 'JB', 'KB', '신한지주', '하나금융', '우리금융', '기업은행', '카카오뱅크', '카카오페이', '메리츠금융', '삼성생명', '삼성화재', '현대해상', 'DB손해보험', '한화생명', '미래에셋', 'NH투자', '키움증권']),
        ('platform_telecom_content', ['NAVER', '카카오', 'SK텔레콤', 'KT', 'LG유플러스', '엔씨소프트', '크래프톤', '넷마블', '하이브', '제일기획', '더블유게임즈', '이노션', '스튜디오드래곤']),
        ('bio_healthcare', ['바이오', '셀트리온', '삼성바이오', '유한양행', '한미약품', '녹십자', '대웅제약', '종근당', 'SK바이오', '한올바이오', '보령', '오스템임플란트']),
        ('consumer_retail_travel', ['CJ', '오리온', '농심', '롯데', '신세계', '이마트', '현대백화점', '호텔신라', '강원랜드', 'GKL', '파라다이스', '아모레', 'LG생활건강', '코웨이', '한샘', '영원무역', 'F&F', 'BGF', 'GS리테일', '하이트진로', '삼양식품', '오뚜기']),
        ('chemicals_materials_steel', ['POSCO', '포스코', '현대제철', '고려아연', '풍산', '금양', '롯데케미칼', '한화솔루션', 'S-Oil', 'SK이노베이션', 'SKC', '효성티앤씨', 'OCI', '대한유화', '영풍', '코스모신소재']),
        ('holding_multi_industry', ['SK', 'LG', 'GS', 'HD현대', 'CJ', '두산', '한화', '삼성물산', 'SK스퀘어', 'LX홀딩스', '롯데지주', '효성', 'LS', 'DN오토모티브']),
    ]
    for theme, keywords in rules:
        if any(keyword in name for keyword in keywords):
            return theme
    return 'industrial_business_services'


def main():
    date = latest_available_date()
    cap = stock.get_market_cap_by_ticker(date, market='KOSPI').sort_values('시가총액', ascending=False).head(MARKET_CAP_LIMIT)
    fundamentals = stock.get_market_fundamental_by_ticker(date, market='KOSPI')

    records = []
    for rank, ticker in enumerate(cap.index.tolist(), start=1):
        name = stock.get_market_ticker_name(ticker)
        current_price = float(cap.loc[ticker, '종가']) if '종가' in cap.columns else 0.0
        eps = 0.0
        if ticker in fundamentals.index and 'EPS' in fundamentals.columns:
            raw_eps = fundamentals.loc[ticker, 'EPS']
            eps = 0.0 if pd.isna(raw_eps) else float(raw_eps)
        records.append({
            'rank': rank,
            'sector': theme_for(name),
            'name': name,
            'code': ticker,
            'marketSuffix': 'KS',
            'currentPrice': current_price,
            'annualEps': eps,
            'dataSource': f'KRX/pykrx:{date}',
            'lastPriceFetchedAt': date,
        })

    OUTPUT.write_text(json.dumps({'date': date, 'count': len(records), 'records': records}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'date': date, 'count': len(records), 'output': str(OUTPUT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
