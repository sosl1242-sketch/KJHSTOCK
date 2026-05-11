import { describe, expect, it } from "vitest";
import { parseKoreanMarketCapToHundredMillion, parseNaverFinancialDetail } from "./financials";

const sampleHtml = `
<html>
  <body>
    <table><caption>시가총액</caption><tr><th>시가총액</th><td>401조 2,345억원</td></tr></table>
    <table>
      <caption>최근 연간 실적</caption>
      <thead>
        <tr>
          <th scope="col">2023.12</th><th scope="col">2024.12</th><th scope="col">2025.12(E)</th><th scope="col">2026.12(E)</th>
          <th scope="col">2024.03</th><th scope="col">2024.06</th><th scope="col">2024.09</th><th scope="col">2024.12</th><th scope="col">2025.03</th><th scope="col">2025.06</th>
        </tr>
      </thead>
      <tbody>
        <tr><th>매출액</th><td>2,589,355</td><td>3,008,709</td><td>3,220,000</td><td>3,410,000</td><td>719,156</td><td>740,683</td><td>790,987</td><td>750,000</td><td>770,000</td><td>810,000</td></tr>
        <tr><th>영업이익</th><td>65,670</td><td>326,000</td><td>440,000</td><td>500,000</td><td>66,060</td><td>104,439</td><td>91,834</td><td>80,000</td><td>95,000</td><td>100,000</td></tr>
        <tr><th>당기순이익</th><td>154,871</td><td>315,000</td><td>360,000</td><td>410,000</td><td>67,547</td><td>98,413</td><td>82,200</td><td>75,000</td><td>88,000</td><td>90,000</td></tr>
        <tr><th>PER(배)</th><td>12.3</td><td>10.1</td><td>9.2</td><td>8.4</td><td>11.4</td><td>10.8</td><td>10.5</td><td>9.9</td><td>9.5</td><td>9.1</td></tr>
        <tr><th>PBR(배)</th><td>1.4</td><td>1.3</td><td>1.2</td><td>1.1</td><td>1.35</td><td>1.32</td><td>1.27</td><td>1.24</td><td>1.21</td><td>1.19</td></tr>
      </tbody>
    </table>
  </body>
</html>`;

describe("financial detail parser", () => {
  it("converts Korean market cap text into hundred-million KRW units", () => {
    expect(parseKoreanMarketCapToHundredMillion("401조 2,345억원")).toBe(4012345);
    expect(parseKoreanMarketCapToHundredMillion("12,345억원")).toBe(12345);
  });

  it("extracts PER, PBR, market cap and recent quarterly performance rows", () => {
    const result = parseNaverFinancialDetail(sampleHtml, { code: "005930", name: "삼성전자", marketSuffix: "KS" });

    expect(result.per).toBe(9.1);
    expect(result.pbr).toBe(1.19);
    expect(result.marketCapHundredMillionKrw).toBe(4012345);
    expect(result.latestOperatingProfitHundredMillionKrw).toBe(100000);
    expect(result.latestNetIncomeHundredMillionKrw).toBe(90000);
    expect(result.quarterly).toHaveLength(6);
    expect(result.quarterly.at(-1)).toEqual({ period: "2025.06", revenue: 810000, operatingProfit: 100000, netIncome: 90000 });
  });
});
