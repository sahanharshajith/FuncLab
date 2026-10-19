/**
 * Safe mathematical expression engine built on top of mathjs.
 *
 * Hard requirements implemented here:
 *  - never use eval() / new Function() on user input (mathjs compiles its own AST)
 *  - dangerous mathjs entry points (import/createUnit/evaluate/parse/...) are disabled
 *  - AST level validation blocks assignments, blocks, ranges and huge allocations
 *  - expression length limits protect against resource exhaustion
 *  - friendly, user facing error messages
 */
import { all, create, type MathNode } from "mathjs";
import type { AngleMode } from "@/lib/types";

export const MAX_EXPRESSION_LENGTH = 512;

/**
 * Restricted mathjs instance used for *all* user supplied expressions.
 *
 * Instead of monkey patching the namespace (which would also break the parser
 * used internally), every user expression is validated at the AST level: calls
 * to the dangerous entry points below are rejected before compilation, and
 * property access / assignments / blocks are rejected outright. There is no way
 * to reach the mathjs namespace object itself from an expression.
 */
const math = create(all, { number: "number" });

export class ExpressionError extends Error {
  code: string;
  constructor(message: string, code = "invalid-expression") {
    super(message);
    this.name = "ExpressionError";
    this.code = code;
  }
}

/** Identifiers that are constants, never user variables. */
export const CONSTANT_NAMES = [
  "pi",
  "PI",
  "tau",
  "e",
  "E",
  "phi",
  "i",
  "Infinity",
  "NaN",
  "true",
  "false",
  "null",
  "undefined",
] as const;

export const CONSTANT_SET = new Set<string>(CONSTANT_NAMES);

export interface BuiltinFunctionDoc {
  name: string;
  signature: string;
  description: string;
  category: string;
}

export const BUILTIN_FUNCTIONS: BuiltinFunctionDoc[] = [
  { name: "sin", signature: "sin(x)", description: "Sine", category: "Trigonometry" },
  { name: "cos", signature: "cos(x)", description: "Cosine", category: "Trigonometry" },
  { name: "tan", signature: "tan(x)", description: "Tangent", category: "Trigonometry" },
  { name: "asin", signature: "asin(x)", description: "Inverse sine", category: "Trigonometry" },
  { name: "acos", signature: "acos(x)", description: "Inverse cosine", category: "Trigonometry" },
  { name: "atan", signature: "atan(x)", description: "Inverse tangent", category: "Trigonometry" },
  { name: "atan2", signature: "atan2(y, x)", description: "Two argument arctangent", category: "Trigonometry" },
  { name: "sec", signature: "sec(x)", description: "Secant", category: "Trigonometry" },
  { name: "csc", signature: "csc(x)", description: "Cosecant", category: "Trigonometry" },
  { name: "cot", signature: "cot(x)", description: "Cotangent", category: "Trigonometry" },
  { name: "sinh", signature: "sinh(x)", description: "Hyperbolic sine", category: "Hyperbolic" },
  { name: "cosh", signature: "cosh(x)", description: "Hyperbolic cosine", category: "Hyperbolic" },
  { name: "tanh", signature: "tanh(x)", description: "Hyperbolic tangent", category: "Hyperbolic" },
  { name: "sqrt", signature: "sqrt(x)", description: "Square root", category: "Algebra" },
  { name: "cbrt", signature: "cbrt(x)", description: "Cube root", category: "Algebra" },
  { name: "abs", signature: "abs(x)", description: "Absolute value", category: "Algebra" },
  { name: "sign", signature: "sign(x)", description: "Sign (-1, 0, 1)", category: "Algebra" },
  { name: "pow", signature: "pow(x, y)", description: "Power, same as x^y", category: "Algebra" },
  { name: "exp", signature: "exp(x)", description: "e raised to x", category: "Exponential" },
  { name: "log", signature: "log(x), log(x, base)", description: "Natural log, or log to a base", category: "Exponential" },
  { name: "ln", signature: "ln(x)", description: "Natural logarithm (alias of log)", category: "Exponential" },
  { name: "log10", signature: "log10(x)", description: "Base 10 logarithm", category: "Exponential" },
  { name: "log2", signature: "log2(x)", description: "Base 2 logarithm", category: "Exponential" },
  { name: "floor", signature: "floor(x)", description: "Round down", category: "Rounding" },
  { name: "ceil", signature: "ceil(x)", description: "Round up", category: "Rounding" },
  { name: "round", signature: "round(x, n)", description: "Round to n decimals", category: "Rounding" },
  { name: "fix", signature: "fix(x)", description: "Round toward zero", category: "Rounding" },
  { name: "min", signature: "min(a, b, ...)", description: "Smallest value", category: "Aggregation" },
  { name: "max", signature: "max(a, b, ...)", description: "Largest value", category: "Aggregation" },
  { name: "mean", signature: "mean(a, b, ...)", description: "Arithmetic mean", category: "Aggregation" },
  { name: "hypot", signature: "hypot(a, b)", description: "Euclidean distance", category: "Aggregation" },
  { name: "mod", signature: "mod(a, b)", description: "Modulo, also a mod b or a % b", category: "Arithmetic" },
  { name: "gcd", signature: "gcd(a, b)", description: "Greatest common divisor", category: "Arithmetic" },
  { name: "lcm", signature: "lcm(a, b)", description: "Least common multiple", category: "Arithmetic" },
  { name: "factorial", signature: "factorial(n) or n!", description: "Factorial", category: "Arithmetic" },
  { name: "combinations", signature: "combinations(n, k)", description: "Binomial coefficient", category: "Arithmetic" },
  { name: "permutations", signature: "permutations(n, k)", description: "Permutations", category: "Arithmetic" },
  { name: "erf", signature: "erf(x)", description: "Error function", category: "Special" },
  { name: "gamma", signature: "gamma(x)", description: "Gamma function", category: "Special" },
];

export const BUILTIN_FUNCTION_SET = new Set(BUILTIN_FUNCTIONS.map((f) => f.name));

/** Every callable identifier known to the restricted mathjs instance. */
const NAMESPACE_FUNCTIONS = new Set(
  Object.keys(math).filter((key) => {
    const value = (math as unknown as Record<string, unknown>)[key];
    return typeof value === "function";
  }),
);

/** Calls that could allocate huge structures or re-enter the parser. */
const BLOCKED_CALLS = new Set([
  "import",
  "createUnit",
  "createUnitSingle",
  "evaluate",
  "parse",
  "parser",
  "compile",
  "chain",
  "help",
  "config",
  "typed",
  "factory",
  "reviver",
  "replacer",
  "simplify",
  "rationalize",
  "derivative",
  "zeros",
  "ones",
  "identity",
  "range",
  "resize",
  "reshape",
  "concat",
  "map",
  "forEach",
  "filter",
  "apply",
  "random",
  "randomInt",
  "pickRandom",
]);

const BLOCKED_NODE_TYPES: Record<string, string> = {
  AssignmentNode: "Assignments (=) are not allowed inside an expression.",
  FunctionAssignmentNode:
    "Define functions with the function card signature field, not inside the expression.",
  BlockNode: "Only a single expression is allowed (remove ';').",
  ObjectNode: "Object literals are not supported.",
  AccessorNode: "Property access is not supported.",
  RangeNode: "Ranges (a:b) are not supported in function expressions.",
};

export interface ExpressionAnalysis {
  node: MathNode;
  /** Free symbols that are not constants (candidate variables). */
  symbols: string[];
  /** Function names that were called. */
  calls: string[];
  /** Called names that are not mathjs builtins (candidate function references). */
  unknownCalls: string[];
}

const DEG = Math.PI / 180;

const toRad = (value: unknown): number => {
  if (typeof value !== "number") {
    throw new ExpressionError("Trigonometric functions expect a number.", "domain");
  }
  return value * DEG;
};

const degreeScope = (): Record<string, unknown> => ({
  sin: (x: unknown) => Math.sin(toRad(x)),
  cos: (x: unknown) => Math.cos(toRad(x)),
  tan: (x: unknown) => Math.tan(toRad(x)),
  sec: (x: unknown) => 1 / Math.cos(toRad(x)),
  csc: (x: unknown) => 1 / Math.sin(toRad(x)),
  cot: (x: unknown) => 1 / Math.tan(toRad(x)),
  asin: (x: unknown) => Math.asin(Number(x)) / DEG,
  acos: (x: unknown) => Math.acos(Number(x)) / DEG,
  atan: (x: unknown) => Math.atan(Number(x)) / DEG,
  atan2: (y: unknown, x: unknown) => Math.atan2(Number(y), Number(x)) / DEG,
  acot: (x: unknown) => Math.atan(1 / Number(x)) / DEG,
});

/** Builds the evaluation scope: angle mode wrappers + variable values + helpers. */
export function buildScope(
  values: Record<string, unknown>,
  angleMode: AngleMode,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const scope: Record<string, unknown> =
    angleMode === "deg" ? degreeScope() : {};
  Object.assign(scope, extra, values);
  return scope;
}

function friendlyParseError(message: string): string {
  const cleaned = message.replace(/\s*\(char \d+\)/, "");
  if (/Unexpected end of expression/i.test(cleaned)) {
    return "Incomplete expression — check for a missing operand or closing parenthesis.";
  }
  if (/Parenthesis \) expected/i.test(cleaned)) {
    return "Missing closing parenthesis ')'.";
  }
  if (/Value expected/i.test(cleaned)) {
    return "Missing value — check operators such as '+' or '*' with nothing after them.";
  }
  if (/Unexpected operator/i.test(cleaned)) {
    return `Unexpected operator — ${cleaned}`;
  }
  return cleaned;
}

/** Parse an expression to an AST, throwing friendly errors. */
export function parseExpression(expression: string): MathNode {
  const text = expression.trim();
  if (!text) {
    throw new ExpressionError("Expression is empty.", "empty");
  }
  if (text.length > MAX_EXPRESSION_LENGTH) {
    throw new ExpressionError(
      `Expression is too long (max ${MAX_EXPRESSION_LENGTH} characters).`,
      "too-long",
    );
  }
  let node: MathNode;
  try {
    node = math.parse(text);
  } catch (error) {
    throw new ExpressionError(
      friendlyParseError(error instanceof Error ? error.message : String(error)),
      "syntax",
    );
  }
  validateNode(node);
  return node;
}

function validateNode(root: MathNode): void {
  let nodeCount = 0;
  root.traverse((node) => {
    nodeCount += 1;
    if (nodeCount > 600) {
      throw new ExpressionError("Expression is too complex to evaluate.", "too-complex");
    }
    const blockedMessage = BLOCKED_NODE_TYPES[node.type];
    if (blockedMessage) {
      throw new ExpressionError(blockedMessage, "blocked-syntax");
    }
    if (node.type === "FunctionNode") {
      const fnNode = node as MathNode & { fn: { name?: string } };
      const name = fnNode.fn?.name ?? "";
      if (BLOCKED_CALLS.has(name)) {
        throw new ExpressionError(`"${name}" is not allowed in expressions.`, "blocked-function");
      }
    }
  });
}

/** Detect symbols and function calls inside an expression. */
export function analyzeExpression(expression: string): ExpressionAnalysis {
  const node = parseExpression(expression);
  const symbols = new Set<string>();
  const calls = new Set<string>();

  node.traverse((child, path, parent) => {
    if (child.type !== "SymbolNode") return;
    const name = (child as MathNode & { name: string }).name;
    if (parent && parent.type === "FunctionNode" && path === "fn") {
      calls.add(name);
      return;
    }
    symbols.add(name);
  });

  const unknownCalls = [...calls].filter((name) => !NAMESPACE_FUNCTIONS.has(name));

  return {
    node,
    symbols: [...symbols],
    calls: [...calls],
    unknownCalls,
  };
}

/**
 * Detect the user variables of an expression.
 * Constants (pi, e, ...) and builtin/known function names are excluded,
 * declared parameters are always treated as variables (they shadow constants).
 */
export function detectVariables(
  expression: string,
  options: { declaredParams?: string[]; knownFunctions?: Iterable<string> } = {},
): { variables: string[]; dependencies: string[]; unknownFunctions: string[] } {
  const declared = new Set(options.declaredParams ?? []);
  const known = new Set(options.knownFunctions ?? []);
  const analysis = analyzeExpression(expression);

  const variables = analysis.symbols
    .filter((name) => declared.has(name) || (!CONSTANT_SET.has(name) && !known.has(name)))
    .sort(sortVariableNames);

  const dependencies = analysis.calls.filter((name) => known.has(name));
  const unknownFunctions = analysis.unknownCalls.filter((name) => !known.has(name));

  return { variables, dependencies, unknownFunctions };
}

const PREFERRED_ORDER = ["x", "y", "z", "t", "u", "v", "w", "a", "b", "c"];

export function sortVariableNames(a: string, b: string): number {
  const ia = PREFERRED_ORDER.indexOf(a);
  const ib = PREFERRED_ORDER.indexOf(b);
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }
  return a.localeCompare(b);
}

export interface CompiledExpression {
  evaluate: (scope: Record<string, unknown>) => unknown;
  source: string;
}

const compileCache = new Map<string, CompiledExpression>();
const CACHE_LIMIT = 300;

export function compileExpression(expression: string): CompiledExpression {
  const key = expression.trim();
  const cached = compileCache.get(key);
  if (cached) return cached;

  const node = parseExpression(key);
  const code = node.compile();
  const compiled: CompiledExpression = {
    source: key,
    evaluate: (scope) => code.evaluate(scope),
  };
  if (compileCache.size > CACHE_LIMIT) compileCache.clear();
  compileCache.set(key, compiled);
  return compiled;
}

export interface ComplexLike {
  re: number;
  im: number;
}

export function isComplexValue(value: unknown): value is ComplexLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ComplexLike).re === "number" &&
    typeof (value as ComplexLike).im === "number"
  );
}

/** Convert a mathjs result to a plain real number when possible. */
export function toRealNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (isComplexValue(value)) {
    return Math.abs(value.im) < 1e-12 ? value.re : null;
  }
  if (typeof value === "object" && value !== null) {
    const maybe = value as { toNumber?: () => number; isUnit?: boolean };
    if (!maybe.isUnit && typeof maybe.toNumber === "function") {
      try {
        return maybe.toNumber();
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function describeValue(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (value === Infinity) return "∞";
    if (value === -Infinity) return "-∞";
    return String(value);
  }
  if (isComplexValue(value)) {
    const sign = value.im < 0 ? "-" : "+";
    return `${value.re} ${sign} ${Math.abs(value.im)}i`;
  }
  if (value === null || value === undefined) return "undefined";
  if (typeof value === "object" && "toString" in value) return String(value);
  return String(value);
}

/** Convert raw errors coming out of mathjs into user friendly messages. */
export function friendlyEvaluationError(error: unknown): string {
  if (error instanceof ExpressionError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  const undefinedSymbol = message.match(/Undefined symbol (\w+)/);
  if (undefinedSymbol) {
    return `Unknown value "${undefinedSymbol[1]}" — define it as a variable first.`;
  }
  const undefinedFn = message.match(/Undefined function (\w+)/);
  if (undefinedFn) {
    return `Unknown function "${undefinedFn[1]}()". Check the function list in Help.`;
  }
  if (/Cannot convert .* to a number/i.test(message)) {
    return "Result is not a plain number (units or matrices are not supported here).";
  }
  if (/too many arguments|Too few arguments/i.test(message)) {
    return message;
  }
  return message;
}

/** Evaluate a compiled expression and normalise the outcome. */
export interface EvaluationOutcome {
  value: number | null;
  display: string;
  error: string | null;
  raw: unknown;
}

export function evaluateCompiled(
  compiled: CompiledExpression,
  scope: Record<string, unknown>,
): EvaluationOutcome {
  try {
    const raw = compiled.evaluate(scope);
    const value = toRealNumber(raw);
    if (value === null) {
      return {
        value: null,
        display: describeValue(raw),
        error: isComplexValue(raw)
          ? "Result is a complex number — it cannot be plotted on a real graph."
          : "Result is not a real number.",
        raw,
      };
    }
    if (Number.isNaN(value)) {
      return {
        value: null,
        display: "NaN",
        error: "Undefined result (NaN) — the input is outside the function domain.",
        raw,
      };
    }
    if (!Number.isFinite(value)) {
      return {
        value,
        display: value > 0 ? "∞" : "-∞",
        error: "Result is infinite (possible division by zero or vertical asymptote).",
        raw,
      };
    }
    return { value, display: describeValue(raw), error: null, raw };
  } catch (error) {
    return {
      value: null,
      display: "—",
      error: friendlyEvaluationError(error),
      raw: null,
    };
  }
}

/** Convenience helper: parse + evaluate in one step. */
export function evaluateExpression(
  expression: string,
  values: Record<string, number> = {},
  angleMode: AngleMode = "rad",
): EvaluationOutcome {
  try {
    const compiled = compileExpression(expression);
    return evaluateCompiled(compiled, buildScope(values, angleMode));
  } catch (error) {
    return {
      value: null,
      display: "—",
      error: friendlyEvaluationError(error),
      raw: null,
    };
  }
}

export { math as restrictedMath };
