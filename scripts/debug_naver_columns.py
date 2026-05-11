import requests
from bs4 import BeautifulSoup

url = 'https://finance.naver.com/sise/sise_market_sum.naver'
response = requests.get(url, params={'sosok': '0', 'page': '1'}, headers={'User-Agent': 'Mozilla/5.0'}, timeout=20)
response.raise_for_status()
response.encoding = 'euc-kr'
soup = BeautifulSoup(response.text, 'html.parser')
for tr in soup.select('table.type_2 tr'):
    link = tr.select_one('a.tltle[href*="code="]')
    cols = [td.get_text(strip=True) for td in tr.select('td')]
    if link:
        print(link.get_text(strip=True))
        print(list(enumerate(cols)))
        break
