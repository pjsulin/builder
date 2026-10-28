import { describe, expect, it } from "vitest";
import { formatImperial, formatMetric, parseArray, parseLength, parseLengths } from "../src/units";

describe("parseLength", () => {
  it.each([
    ["10'", 120],
    ["8'6\"", 102],
    ["8' 6\"", 102],
    ["8'-6\"", 102],
    ["8' 6 1/2\"", 102.5],
    ["30 1/2\"", 30.5],
    ["30 1/2", 30.5],
    ["1/2", 0.5],
    [".5", 0.5],
    ["6\"", 6],
    ["12", 12],
    ["-4'", -48],
    ["2.4m", 2400 / 25.4],
    ["600mm", 600 / 25.4],
    ["60 cm", 600 / 25.4],
  ])("reads %s", (text, inches) => {
    expect(parseLength(text)).toBeCloseTo(inches, 9);
  });

  it.each(["", "abc", "1/0", "'6", "6\"7", "1.2.3"])("rejects %j", (text) => {
    expect(parseLength(text)).toBeNaN();
  });

  it("reads bare numbers as millimetres in metric", () => {
    expect(parseLength("254", "metric")).toBeCloseTo(10, 9);
  });

  it("reads width and depth pairs", () => {
    const [w, d] = parseLengths("10', 8'6\"");
    expect(w).toBe(120);
    expect(d).toBe(102);
  });
});

describe("format", () => {
  it.each([
    [0, '0"'],
    [6, '6"'],
    [12, "1' 0\""],
    [102.5, "8' 6 1/2\""],
    [0.375, '3/8"'],
    [-30, '-2\' 6"'],
  ])("formats %d", (inches, text) => {
    expect(formatImperial(inches)).toBe(text);
  });

  it("formats metric", () => {
    expect(formatMetric(600 / 25.4)).toBe("600 mm");
    expect(formatMetric(2400 / 25.4)).toBe("2.4 m");
  });

  it("round-trips through parse", () => {
    for (const v of [1, 7.125, 95.5, 120, 1234.875]) expect(parseLength(formatImperial(v))).toBeCloseTo(v, 9);
  });
});


describe("parseArray", () => {
  it.each([
    ["5x", "times", 5],
    ["x5", "times", 5],
    ["5*", "times", 5],
    ["*5", "times", 5],
    ["/5", "divide", 5],
    ["5/", "divide", 5],
    [" 9 X ", "times", 9],
    ["/ 12", "divide", 12],
  ])("reads %s", (text, kind, n) => {
    expect(parseArray(text)).toEqual({ kind, n });
  });

  it.each(["0x", "2.5x", "-3x", "x", "5", "", "5xx", "x5x", "3/4"])("rejects %j", (text) => {
    expect(parseArray(text)).toBeNull();
  });

  it("leaves lengths to parseLength", () => {
    expect(parseLength("3/4")).toBe(0.75);
    expect(parseLength("5x")).toBeNaN();
    expect(parseLength("/5")).toBeNaN();
    expect(parseLength("*5")).toBeNaN();
  });
});
