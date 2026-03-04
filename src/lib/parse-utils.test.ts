import { describe, expect, it } from "vitest";
import { groupWordsByRows, parseNumberID, type TextWord } from "./parse-utils";

describe("parseNumberID", () => {
  it("parses shares with Indonesian thousand separators", () => {
    expect(parseNumberID("1.234.567", "shares")).toBe(1234567);
    expect(parseNumberID(" 98.001 ", "shares")).toBe(98001);
    expect(parseNumberID("-", "shares")).toBeNull();
  });

  it("parses percentages with Indonesian decimal commas", () => {
    expect(parseNumberID("12,34", "percentage")).toBeCloseTo(12.34);
    expect(parseNumberID("1.234,56", "percentage")).toBeCloseTo(1234.56);
    expect(parseNumberID("12.50", "percentage")).toBeCloseTo(12.5);
    expect(parseNumberID("N/A", "percentage")).toBeNull();
  });
});

describe("groupWordsByRows", () => {
  it("groups words on near-equal y into same row", () => {
    const words: TextWord[] = [
      { text: "DATE", x: 12, yTop: 20, width: 20, height: 8 },
      { text: "INVESTOR", x: 66, yTop: 20.9, width: 40, height: 8 },
      { text: "2026-03-01", x: 12, yTop: 32.1, width: 38, height: 8 },
      { text: "CITIBANK", x: 66, yTop: 32.7, width: 52, height: 8 },
    ];

    const rows = groupWordsByRows(words, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].words.map((w) => w.text)).toEqual(["DATE", "INVESTOR"]);
    expect(rows[1].words.map((w) => w.text)).toEqual(["2026-03-01", "CITIBANK"]);
  });
});
