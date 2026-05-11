import json
from pathlib import Path

source = Path('/home/ubuntu/korea-stock-sector-analyzer/data/kospi_top200.json')
target = Path('/home/ubuntu/korea-stock-sector-analyzer/server/kospiSeed.ts')
data = json.loads(source.read_text(encoding='utf-8'))
records = data['records']
themes = data['themes']

text = "// Auto-generated from data/kospi_top200.json.\n"
text += "// Source: Naver Finance KOSPI market capitalization table.\n\n"
text += "export const KOSPI_THEMES = " + json.dumps(themes, ensure_ascii=False, indent=2) + " as const;\n\n"
text += "export const KOSPI_TOP200_STOCKS = " + json.dumps(records, ensure_ascii=False, indent=2) + " as const;\n"
target.write_text(text, encoding='utf-8')
print(target)
