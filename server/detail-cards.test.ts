import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("stock detail modal core financial cards", () => {
  it("renders the requested 12 core financial card labels", () => {
    const labels = [
      "시가총액",
      "PER",
      "PBR",
      "ROE",
      "EPS",
      "BPS",
      "영업이익률",
      "부채비율",
      "순차입금",
      "배당수익률",
      "매출 성장률 YoY",
      "영업이익 성장률 YoY",
    ];

    for (const label of labels) {
      expect(homeSource).toContain(`label: "${label}"`);
    }
  });

  it("keeps concise investment reasons and a clear missing-data fallback in the modal", () => {
    const reasons = [
      "회사 크기",
      "이익 대비 가격",
      "자산 대비 가격",
      "자본 효율",
      "주당순이익",
      "주당순자산",
      "본업 수익성",
      "재무 안정성",
      "실질 빚",
      "주주환원",
      "성장성",
      "이익 성장성",
    ];

    for (const reason of reasons) {
      expect(homeSource).toContain(`reason: "${reason}"`);
    }
    expect(homeSource).toContain("자료 없음");
  });
});
