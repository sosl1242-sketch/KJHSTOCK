export type QuarterlyFinancial = {
  period: string;
  revenue: number | null;
  operatingProfit: number | null;
  netIncome: number | null;
};

export type StockFinancialDetail = {
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
};

export type StockFinancialSummary = Pick<
  StockFinancialDetail,
  "code" | "name" | "marketSuffix" | "per" | "pbr" | "marketCapHundredMillionKrw" | "latestOperatingProfitHundredMillionKrw" | "source" | "fetchedAt"
> & {
  success: true;
} | {
  code: string;
  name?: string;
  marketSuffix: "KS" | "KQ";
  success: false;
  error: string;
  fetchedAt: string;
};

const NAVER_FINANCE_BASE_URL = "https://finance.naver.com/item/main.naver";

function decodeHtml(value: string) {
  return value
    .replace(/&#40;/g, "(")
    .replace(/&#41;/g, ")")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number.parseInt(code, 10)));
}

export function cleanCellText(html: string) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRows(html: string) {
  return html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
}

function extractCells(rowHtml: string) {
  return (rowHtml.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) ?? []).map(cleanCellText);
}

function findRowCells(html: string, label: string) {
  const row = extractRows(html).find(candidate => cleanCellText(candidate).includes(label));
  return row ? extractCells(row) : [];
}

export function parseNumericValue(value: string | null | undefined) {
  if (!value) return null;
  const normalized = cleanCellText(value)
    .replace(/,/g, "")
    .replace(/%|배|억원|원/g, "")
    .replace(/\(E\)/g, "")
    .trim();
  if (!normalized || normalized === "-" || normalized === "N/A") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseKoreanMarketCapToHundredMillion(value: string | null | undefined) {
  if (!value) return null;
  const text = cleanCellText(value).replace(/,/g, "").replace(/억원/g, "").trim();
  if (!text) return null;

  const trillionMatch = text.match(/(-?\d+(?:\.\d+)?)\s*조/);
  const afterTrillion = text.split("조")[1] ?? "";
  const restMatch = afterTrillion.match(/(-?\d+(?:\.\d+)?)/);
  if (trillionMatch) {
    const trillionAsHundredMillion = Number(trillionMatch[1]) * 10000;
    const rest = restMatch ? Number(restMatch[1]) : 0;
    const total = trillionAsHundredMillion + rest;
    return Number.isFinite(total) ? total : null;
  }

  const parsed = parseNumericValue(text);
  return parsed;
}

function extractFinancialTable(html: string) {
  const anchor = html.indexOf("최근 연간 실적");
  if (anchor === -1) return "";
  const start = html.lastIndexOf("<table", anchor);
  const end = html.indexOf("</table>", anchor);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + "</table>".length);
}

function extractPeriodLabels(tableHtml: string) {
  const labels = Array.from(tableHtml.matchAll(/<th\b[^>]*scope=["']col["'][^>]*>([\s\S]*?)<\/th>/gi))
    .map(match => cleanCellText(match[1]).replace(/\s+/g, ""))
    .filter(label => /\d{4}\.\d{2}/.test(label));
  return labels;
}

function extractMetricValues(tableHtml: string, label: string) {
  const cells = findRowCells(tableHtml, label);
  return cells.slice(1).map(parseNumericValue);
}

function latestNumber(values: Array<number | null | undefined>) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function extractMarketCap(html: string) {
  const directTableIndex = html.indexOf("<caption>시가총액</caption>");
  if (directTableIndex !== -1) {
    const directTableEnd = html.indexOf("</table>", directTableIndex);
    const directTable = html.slice(directTableIndex, directTableEnd === -1 ? directTableIndex + 1600 : directTableEnd);
    const directCells = findRowCells(directTable, "시가총액");
    const directValue = directCells[1] ? parseKoreanMarketCapToHundredMillion(directCells[1]) : null;
    if (directValue !== null) return directValue;
  }

  const comparableCells = findRowCells(html, "시가총액(억)");
  return comparableCells[1] ? parseKoreanMarketCapToHundredMillion(comparableCells[1]) : null;
}

export function parseNaverFinancialDetail(html: string, input: { code: string; name?: string; marketSuffix: "KS" | "KQ" }): StockFinancialDetail {
  const table = extractFinancialTable(html);
  const periods = extractPeriodLabels(table);
  const revenueValues = extractMetricValues(table, "매출액");
  const operatingProfitValues = extractMetricValues(table, "영업이익");
  const netIncomeValues = extractMetricValues(table, "당기순이익");
  const perValues = extractMetricValues(table, "PER(배)");
  const pbrValues = extractMetricValues(table, "PBR(배)");
  const quarterlyStartIndex = periods.length >= 10 ? 4 : Math.max(0, periods.length - 6);

  const quarterly = periods.slice(quarterlyStartIndex).map((period, offset) => {
    const index = quarterlyStartIndex + offset;
    return {
      period,
      revenue: revenueValues[index] ?? null,
      operatingProfit: operatingProfitValues[index] ?? null,
      netIncome: netIncomeValues[index] ?? null,
    };
  }).filter(row => row.revenue !== null || row.operatingProfit !== null || row.netIncome !== null);

  return {
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
  };
}

function decodeResponseBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  try {
    const decoded = new TextDecoder("euc-kr").decode(bytes);
    if (decoded.includes("시가총액") || decoded.includes("최근 연간 실적")) return decoded;
  } catch {
    // Node 런타임의 인코딩 지원 여부에 따라 UTF-8 폴백을 사용합니다.
  }
  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchTextWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ManusStockDashboard/1.0)",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    if (!response.ok) {
      throw new Error(`네이버 금융 응답 오류: ${response.status}`);
    }
    return decodeResponseBuffer(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNaverFinancialDetailWithOptions(
  input: { code: string; name?: string; marketSuffix: "KS" | "KQ" },
  options: { timeoutMs: number; attempts: number; retryDelayMs?: number }
) {
  const code = input.code.padStart(6, "0");
  const url = `${NAVER_FINANCE_BASE_URL}?code=${encodeURIComponent(code)}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const html = await fetchTextWithTimeout(url, options.timeoutMs);
      return parseNaverFinancialDetail(html, { ...input, code });
    } catch (error) {
      lastError = error;
      if (attempt < options.attempts) {
        await new Promise(resolve => setTimeout(resolve, (options.retryDelayMs ?? 600) * attempt));
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : "알 수 없는 오류";
  throw new Error(`재무 상세 정보를 가져오지 못했습니다. ${reason}`);
}

export async function fetchNaverFinancialDetail(input: { code: string; name?: string; marketSuffix: "KS" | "KQ" }) {
  return fetchNaverFinancialDetailWithOptions(input, { timeoutMs: 12000, attempts: 2, retryDelayMs: 700 });
}

async function fetchNaverFinancialSummary(input: { code: string; name?: string; marketSuffix: "KS" | "KQ" }): Promise<StockFinancialSummary> {
  try {
    const detail = await fetchNaverFinancialDetailWithOptions(input, { timeoutMs: 4500, attempts: 1 });
    return {
      code: detail.code,
      name: detail.name,
      marketSuffix: detail.marketSuffix,
      per: detail.per,
      pbr: detail.pbr,
      marketCapHundredMillionKrw: detail.marketCapHundredMillionKrw,
      latestOperatingProfitHundredMillionKrw: detail.latestOperatingProfitHundredMillionKrw,
      source: detail.source,
      fetchedAt: detail.fetchedAt,
      success: true,
    };
  } catch (error) {
    return {
      code: input.code.padStart(6, "0"),
      name: input.name,
      marketSuffix: input.marketSuffix,
      success: false,
      error: error instanceof Error ? error.message : "재무 요약 정보를 가져오지 못했습니다.",
      fetchedAt: new Date().toISOString(),
    };
  }
}

export async function fetchNaverFinancialSummaries(
  inputs: Array<{ code: string; name?: string; marketSuffix: "KS" | "KQ" }>
): Promise<StockFinancialSummary[]> {
  const limitedInputs = inputs.slice(0, 25);
  const concurrency = 6;
  const results: StockFinancialSummary[] = new Array(limitedInputs.length);
  let cursor = 0;

  async function worker() {
    while (cursor < limitedInputs.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fetchNaverFinancialSummary(limitedInputs[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, limitedInputs.length) }, () => worker()));
  return results;
}
