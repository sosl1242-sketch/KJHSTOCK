import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PER/PBR display labels", () => {
  const homeSource = readFileSync(join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

  it("keeps PER and PBR as separate table headers instead of a combined ratio label", () => {
    expect(homeSource).not.toContain("PER/PBR");
    expect(homeSource).not.toContain("PER·PBR");
    expect(homeSource).toContain('text-right font-medium">PER</th>');
    expect(homeSource).toContain('text-right font-medium">PBR</th>');
  });

  it("keeps the latest-screen marker explicit about separate PER and PBR columns", () => {
    expect(homeSource).toContain("PER 별도, PBR 별도");
  });
});
