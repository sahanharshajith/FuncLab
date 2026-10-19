import { describe, expect, it } from "vitest";
import {
  ExpressionError,
  analyzeExpression,
  detectVariables,
  evaluateExpression,
  parseExpression,
} from "@/lib/math/engine";
import { parseSignature } from "@/lib/math/signature";
import { formatNumber, parseNumberInput } from "@/lib/math/format";

describe("variable detection", () => {
  it("detects single and multiple variables", () => {
    expect(detectVariables("x^2").variables).toEqual(["x"]);
    expect(detectVariables("x^2 + 2*y - sin(z)").variables).toEqual(["x", "y", "z"]);
    expect(detectVariables("a*b + sqrt(b)").variables).toEqual(["a", "b"]);
  });

  it("never treats constants or built-in functions as variables", () => {
    const result = detectVariables("sin(x) + cos(pi) + e^2 + log10(x) + sqrt(abs(x))");
    expect(result.variables).toEqual(["x"]);
  });

  it("supports descriptive variable names", () => {
    const result = detectVariables("velocity*sin(theta)*t - 0.5*9.81*t^2");
    expect(result.variables.sort()).toEqual(["t", "theta", "velocity"].sort());
  });

  it("treats declared parameters as variables even when they shadow a constant", () => {
    const result = detectVariables("e^2 + 1", { declaredParams: ["e"] });
    expect(result.variables).toEqual(["e"]);
  });

  it("separates known function references from variables", () => {
    const result = detectVariables("f(x) + g(x) + y", { knownFunctions: ["f", "g"] });
    expect(result.variables).toEqual(["x", "y"]);
    expect(result.dependencies.sort()).toEqual(["f", "g"]);
  });

  it("reports unknown function calls", () => {
    const result = detectVariables("foo(x)");
    expect(result.unknownFunctions).toEqual(["foo"]);
  });

  it("handles implicit multiplication", () => {
    expect(detectVariables("2x + 3").variables).toEqual(["x"]);
    expect(evaluateExpression("2x + 3", { x: 4 }).value).toBe(11);
    expect(evaluateExpression("3(x+1)", { x: 2 }).value).toBe(9);
  });

  it("exposes the called function names", () => {
    expect(analyzeExpression("sin(cos(x))").calls.sort()).toEqual(["cos", "sin"]);
  });
});

describe("expression parsing", () => {
  it("respects operator precedence and parentheses", () => {
    expect(evaluateExpression("2 + 3 * 4").value).toBe(14);
    expect(evaluateExpression("(2 + 3) * 4").value).toBe(20);
    expect(evaluateExpression("2^3^2").value).toBe(512);
    expect(evaluateExpression("-3^2").value).toBe(-9);
    expect(evaluateExpression("10 % 3").value).toBe(1);
    expect(evaluateExpression("7 mod 4").value).toBe(3);
  });

  it("supports negative numbers and scientific notation", () => {
    expect(evaluateExpression("-4.5 + 1").value).toBeCloseTo(-3.5);
    expect(evaluateExpression("1.5e3 + 2").value).toBe(1502);
    expect(evaluateExpression("2e-3").value).toBeCloseTo(0.002);
  });

  it("supports common functions, constants and factorial", () => {
    expect(evaluateExpression("sqrt(16)").value).toBe(4);
    expect(evaluateExpression("max(1, 7, 3)").value).toBe(7);
    expect(evaluateExpression("5!").value).toBe(120);
    expect(evaluateExpression("log10(1000)").value).toBe(3);
    expect(evaluateExpression("log(e)").value).toBeCloseTo(1);
    expect(evaluateExpression("pi").value).toBeCloseTo(Math.PI);
  });

  it("supports conditional (piecewise) expressions", () => {
    expect(evaluateExpression("x < 0 ? -x : x^2", { x: -4 }).value).toBe(4);
    expect(evaluateExpression("x < 0 ? -x : x^2", { x: 3 }).value).toBe(9);
  });

  it("rejects dangerous or unsupported syntax", () => {
    expect(() => parseExpression("a = 5")).toThrow(ExpressionError);
    expect(() => parseExpression("f(x) = x")).toThrow(ExpressionError);
    expect(() => parseExpression("1; 2")).toThrow(ExpressionError);
    expect(() => parseExpression("obj.constructor")).toThrow(ExpressionError);
    expect(() => parseExpression("zeros(100000)")).toThrow(ExpressionError);
    expect(() => parseExpression("x".repeat(600))).toThrow(ExpressionError);
  });

  it("returns friendly errors for invalid syntax", () => {
    const result = evaluateExpression("2 +");
    expect(result.value).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("domain and numeric edge cases", () => {
  it("flags division by zero as infinite", () => {
    const result = evaluateExpression("1/(x - 1)", { x: 1 });
    expect(result.error).toMatch(/infinite/i);
  });

  it("flags complex results from invalid domains", () => {
    const result = evaluateExpression("sqrt(x - 2)", { x: 0 });
    expect(result.value).toBeNull();
    expect(result.error).toMatch(/complex/i);
  });

  it("flags logarithm of zero", () => {
    const result = evaluateExpression("log(x)", { x: 0 });
    expect(result.error).toMatch(/infinite/i);
  });

  it("reports missing variables clearly", () => {
    const result = evaluateExpression("x + y", { x: 1 });
    expect(result.error).toMatch(/Unknown value "y"/);
  });
});

describe("angle modes", () => {
  it("evaluates trigonometry in radians by default", () => {
    expect(evaluateExpression("sin(pi/2)").value).toBeCloseTo(1);
    expect(evaluateExpression("sin(90)").value).toBeCloseTo(Math.sin(90));
  });

  it("evaluates trigonometry in degrees when selected", () => {
    expect(evaluateExpression("sin(90)", {}, "deg").value).toBeCloseTo(1);
    expect(evaluateExpression("cos(180)", {}, "deg").value).toBeCloseTo(-1);
    expect(evaluateExpression("tan(45)", {}, "deg").value).toBeCloseTo(1);
    expect(evaluateExpression("asin(1)", {}, "deg").value).toBeCloseTo(90);
  });
});

describe("signatures", () => {
  it("parses names and parameters", () => {
    expect(parseSignature("f(x)")).toEqual({ name: "f", params: ["x"], error: null });
    expect(parseSignature("g(x, y)")).toEqual({ name: "g", params: ["x", "y"], error: null });
    expect(parseSignature("h")).toEqual({ name: "h", params: [], error: null });
  });

  it("reports malformed signatures", () => {
    expect(parseSignature("f(")).toMatchObject({ error: expect.any(String) });
    expect(parseSignature("f(1x)")).toMatchObject({ error: expect.any(String) });
    expect(parseSignature("f(x, x)")).toMatchObject({ error: expect.any(String) });
  });
});

describe("number formatting", () => {
  it("formats using precision and notation", () => {
    expect(formatNumber(1 / 3, 4)).toBe("0.3333");
    expect(formatNumber(1234.5678, 2, "fixed")).toBe("1234.57");
    expect(formatNumber(0.000012345, 3)).toBe("0.0000123");
    expect(formatNumber(0.00000012345, 4)).toBe("1.2345e-7");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(Infinity)).toBe("∞");
  });

  it("parses numeric input including scientific notation", () => {
    expect(parseNumberInput("-2.5")).toBe(-2.5);
    expect(parseNumberInput("1e3")).toBe(1000);
    expect(parseNumberInput("abc")).toBeNull();
    expect(parseNumberInput("")).toBeNull();
  });
});
