from pathlib import Path

root = Path('/home/ubuntu/korea-stock-sector-analyzer')
financials = root / 'server/financials.ts'
text = financials.read_text()

text = text.replace('''export type StockFinancialDetail = {
  code: string;
  name?: string;
  marketSuffix: "KS" | "KQ";
  per: number | null;
  pbr: number | null;
  marketCapHundredMillionKrw: number | null;
  latestRevenueHundredMillionKrw: number | null;
  latestOperatingProfitHundredMillionKrw: number | null;
  latestNetIncomeHundredMillionKrw: number | null;
  quarterly: QuarterlyFinancial[];
  source: "NaverFinance";
  fetchedAt: string;
  note?: string;
};''', '''export type StockFinancialDetail = {
  code: string;
  name?: string;
  marketSuffix: "KS" | "KQ";
  per: number | null;
  pbr: number | null;
  roe: number | null;
  bps: number | null;
  operatingProfitMargin: number | null;
  debtRatio: number | null;
  netBorrowingsHundredMillionKrw: number | null;
  dividendYield: number | null;
  revenueGrowthYoY: number | null;
  operatingProfitGrowthYoY: number | null;
  marketCapHundredMillionKrw: number | null;
  latestRevenueHundredMillionKrw: number | null;
  latestOperatingProfitHundredMillionKrw: number | null;
  latestNetIncomeHundredMillionKrw: number | null;
  quarterly: QuarterlyFinancial[];
  source: "NaverFinance";
  fetchedAt: string;
  note?: string;
};''')

text = text.replace('''function latestNumber(values: Array<number | null | undefined>) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}
''', '''function latestNumber(values: Array<number | null | undefined>) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function divideAsPercent(numerator: number | null, denominator: number | null) {
  if (typeof numerator !== "number" || typeof denominator !== "number" || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return (numerator / denominator) * 100;
}

function findYoYGrowth(periods: string[], values: Array<number | null | undefined>) {
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    const currentValue = values[index];
    if (typeof currentValue !== "number" || !Number.isFinite(currentValue)) continue;
    const period = periods[index]?.match(/(\\d{4})\\.(\\d{2})/);
    if (!period) continue;
    const targetPeriod = `${Number(period[1]) - 1}.${period[2]}`;
    const previousIndex = periods.findIndex(candidate => candidate.includes(targetPeriod));
    const previousValue = previousIndex >= 0 ? values[previousIndex] : null;
    if (typeof previousValue !== "number" || !Number.isFinite(previousValue) || previousValue === 0) continue;
    return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  }
  return null;
}
''')

text = text.replace('''  const netIncomeValues = extractMetricValues(table, "당기순이익");
  const perValues = extractMetricValues(table, "PER(배)");
  const pbrValues = extractMetricValues(table, "PBR(배)");
  const quarterlyStartIndex = periods.length >= 10 ? 4 : Math.max(0, periods.length - 6);''', '''  const netIncomeValues = extractMetricValues(table, "당기순이익");
  const perValues = extractMetricValues(table, "PER(배)");
  const pbrValues = extractMetricValues(table, "PBR(배)");
  const roeValues = extractMetricValues(table, "ROE");
  const bpsValues = extractMetricValues(table, "BPS");
  const operatingProfitMarginValues = extractMetricValues(table, "영업이익률");
  const debtRatioValues = extractMetricValues(table, "부채비율");
  const netBorrowingsValues = extractMetricValues(table, "순차입금");
  const dividendYieldValues = extractMetricValues(table, "배당수익률");
  const fallbackDividendYieldValues = dividendYieldValues.length ? dividendYieldValues : extractMetricValues(table, "시가배당률");
  const quarterlyStartIndex = periods.length >= 10 ? 4 : Math.max(0, periods.length - 6);''')

text = text.replace('''  return {
    code: input.code,
    name: input.name,
    marketSuffix: input.marketSuffix,
    per: latestNumber(perValues),
    pbr: latestNumber(pbrValues),
    marketCapHundredMillionKrw: extractMarketCap(html),
    latestRevenueHundredMillionKrw: latestNumber(revenueValues),
    latestOperatingProfitHundredMillionKrw: latestNumber(operatingProfitValues),
    latestNetIncomeHundredMillionKrw: latestNumber(netIncomeValues),
    quarterly,
    source: "NaverFinance",
    fetchedAt: new Date().toISOString(),
    note: quarterly.length ? undefined : "네이버 금융에서 최근 분기 실적 표를 찾지 못했습니다.",
  };''', '''  const latestRevenue = latestNumber(revenueValues);
  const latestOperatingProfit = latestNumber(operatingProfitValues);

  return {
    code: input.code,
    name: input.name,
    marketSuffix: input.marketSuffix,
    per: latestNumber(perValues),
    pbr: latestNumber(pbrValues),
    roe: latestNumber(roeValues),
    bps: latestNumber(bpsValues),
    operatingProfitMargin: latestNumber(operatingProfitMarginValues) ?? divideAsPercent(latestOperatingProfit, latestRevenue),
    debtRatio: latestNumber(debtRatioValues),
    netBorrowingsHundredMillionKrw: latestNumber(netBorrowingsValues),
    dividendYield: latestNumber(fallbackDividendYieldValues),
    revenueGrowthYoY: findYoYGrowth(periods, revenueValues),
    operatingProfitGrowthYoY: findYoYGrowth(periods, operatingProfitValues),
    marketCapHundredMillionKrw: extractMarketCap(html),
    latestRevenueHundredMillionKrw: latestRevenue,
    latestOperatingProfitHundredMillionKrw: latestOperatingProfit,
    latestNetIncomeHundredMillionKrw: latestNumber(netIncomeValues),
    quarterly,
    source: "NaverFinance",
    fetchedAt: new Date().toISOString(),
    note: quarterly.length ? undefined : "네이버 금융에서 최근 분기 실적 표를 찾지 못했습니다.",
  };''')

financials.write_text(text)

home = root / 'client/src/pages/Home.tsx'
text = home.read_text()
text = text.replace('''const formatHundredMillionKrw = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 10000) {
    const trillion = value / 10000;
    return `${trillion.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}조원`;
  }
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억원`;
};''', '''const formatHundredMillionKrw = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 10000) {
    const trillion = value / 10000;
    return `${trillion.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}조원`;
  }
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억원`;
};

const formatSignedPercent = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
};''')

text = text.replace('''              네이버 금융 기준 PER, PBR, 시가총액과 최근 분기별 실적을 확인하고, 야후 가격 이력 기반 RSI·스토캐스틱·52주 고저점 이격도 등 10개 보조지표를 함께 봅니다.''', '''              네이버 금융 기준 기본 지표 12개와 최근 분기별 실적을 확인하고, 야후 가격 이력 기반 RSI·스토캐스틱·52주 고저점 이격도 등 보조지표를 함께 봅니다.''')

old_block = '''              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["PER", formatMultiple(financialDetail.data.per)],
                  ["PBR", formatMultiple(financialDetail.data.pbr)],
                  ["EPS", selectedStock ? `${formatNumber(selectedStock.annualEps)}원` : "-"],
                  ["EPS/주가", selectedStock ? formatPercent(selectedStock.earningsYield) : "-"],
                  ["시가총액", formatHundredMillionKrw(financialDetail.data.marketCapHundredMillionKrw)],
                  ["최근 영업이익", formatHundredMillionKrw(financialDetail.data.latestOperatingProfitHundredMillionKrw)],
                  ["최근 순이익", formatHundredMillionKrw(financialDetail.data.latestNetIncomeHundredMillionKrw)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">{label}</p>
                    <p className="mt-2 break-keep text-xl font-black text-slate-950">{value}</p>
                  </div>
                ))}
              </div>'''
new_block = '''              <div>
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">상단 핵심 카드 12개</h3>
                    <p className="text-sm text-slate-500">회사 크기, 가격 부담, 자본 효율, 재무 안정성, 주주환원, 성장성을 한 번에 비교합니다.</p>
                  </div>
                  <Badge variant="outline" className="w-fit rounded-full bg-slate-50">기본형 12개</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[
                    { label: "시가총액", value: formatHundredMillionKrw(financialDetail.data.marketCapHundredMillionKrw), reason: "회사 크기" },
                    { label: "PER", value: formatMultiple(financialDetail.data.per), reason: "이익 대비 가격" },
                    { label: "PBR", value: formatMultiple(financialDetail.data.pbr), reason: "자산 대비 가격" },
                    { label: "ROE", value: formatPercent(financialDetail.data.roe), reason: "자본 효율" },
                    { label: "EPS", value: selectedStock ? `${formatNumber(selectedStock.annualEps)}원` : "-", reason: "주당순이익" },
                    { label: "BPS", value: financialDetail.data.bps === null ? "자료 없음" : `${formatNumber(financialDetail.data.bps)}원`, reason: "주당순자산" },
                    { label: "영업이익률", value: formatPercent(financialDetail.data.operatingProfitMargin), reason: "본업 수익성" },
                    { label: "부채비율", value: formatPercent(financialDetail.data.debtRatio), reason: "재무 안정성" },
                    { label: "순차입금", value: formatHundredMillionKrw(financialDetail.data.netBorrowingsHundredMillionKrw), reason: "실질 빚" },
                    { label: "배당수익률", value: formatPercent(financialDetail.data.dividendYield), reason: "주주환원" },
                    { label: "매출 성장률 YoY", value: formatSignedPercent(financialDetail.data.revenueGrowthYoY), reason: "성장성" },
                    { label: "영업이익 성장률 YoY", value: formatSignedPercent(financialDetail.data.operatingProfitGrowthYoY), reason: "이익 성장성" },
                  ].map(card => (
                    <div key={card.label} className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-100">{card.reason}</span>
                      </div>
                      <p className="mt-3 break-keep text-xl font-black text-slate-950">{card.value === "-" ? "자료 없음" : card.value}</p>
                    </div>
                  ))}
                </div>
              </div>'''
if old_block not in text:
    raise SystemExit('detail card block not found')
text = text.replace(old_block, new_block)
home.write_text(text)

test = root / 'server/financials.test.ts'
text = test.read_text()
text = text.replace('''        <tr><th>PBR(배)</th><td>1.4</td><td>1.3</td><td>1.2</td><td>1.1</td><td>1.35</td><td>1.32</td><td>1.27</td><td>1.24</td><td>1.21</td><td>1.19</td></tr>''', '''        <tr><th>PBR(배)</th><td>1.4</td><td>1.3</td><td>1.2</td><td>1.1</td><td>1.35</td><td>1.32</td><td>1.27</td><td>1.24</td><td>1.21</td><td>1.19</td></tr>
        <tr><th>ROE(%)</th><td>5.0</td><td>9.8</td><td>11.0</td><td>12.0</td><td>8.1</td><td>9.0</td><td>9.4</td><td>10.2</td><td>10.9</td><td>11.3</td></tr>
        <tr><th>BPS(원)</th><td>53,000</td><td>56,000</td><td>60,000</td><td>64,000</td><td>54,000</td><td>55,000</td><td>56,500</td><td>57,200</td><td>58,600</td><td>60,100</td></tr>
        <tr><th>영업이익률</th><td>2.54</td><td>10.84</td><td>13.66</td><td>14.66</td><td>9.19</td><td>14.10</td><td>11.61</td><td>10.67</td><td>12.34</td><td>12.35</td></tr>
        <tr><th>부채비율</th><td>26.4</td><td>27.5</td><td>28.0</td><td>28.2</td><td>27.1</td><td>27.3</td><td>27.5</td><td>27.7</td><td>27.9</td><td>28.1</td></tr>
        <tr><th>순차입금</th><td>-1,000</td><td>-2,000</td><td>-3,000</td><td>-4,000</td><td>-1,500</td><td>-1,800</td><td>-2,100</td><td>-2,400</td><td>-2,700</td><td>-3,000</td></tr>
        <tr><th>배당수익률</th><td>2.1</td><td>2.3</td><td>2.4</td><td>2.5</td><td>2.2</td><td>2.25</td><td>2.3</td><td>2.35</td><td>2.4</td><td>2.45</td></tr>''')
text = text.replace('''    expect(result.latestOperatingProfitHundredMillionKrw).toBe(100000);
    expect(result.latestNetIncomeHundredMillionKrw).toBe(90000);''', '''    expect(result.latestOperatingProfitHundredMillionKrw).toBe(100000);
    expect(result.latestNetIncomeHundredMillionKrw).toBe(90000);
    expect(result.roe).toBe(11.3);
    expect(result.bps).toBe(60100);
    expect(result.operatingProfitMargin).toBe(12.35);
    expect(result.debtRatio).toBe(28.1);
    expect(result.netBorrowingsHundredMillionKrw).toBe(-3000);
    expect(result.dividendYield).toBe(2.45);
    expect(result.revenueGrowthYoY).toBeCloseTo(9.36, 2);
    expect(result.operatingProfitGrowthYoY).toBeCloseTo(-4.25, 2);''')
test.write_text(text)
