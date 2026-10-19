import type { ParsedSignature } from "@/lib/types";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Parse a function signature such as `f(x)`, `g(x, y)` or bare `h`.
 * Returns a stable, validated shape even for malformed input.
 */
export function parseSignature(signature: string): ParsedSignature {
  const text = (signature ?? "").trim();
  if (!text) {
    return { name: "", params: [], error: "Function name is required." };
  }

  const match = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^()]*)\))?$/);
  if (!match) {
    return {
      name: "",
      params: [],
      error: 'Use a signature like "f(x)" or "g(x, y)".',
    };
  }

  const name = match[1];
  const rawParams = match[2];
  if (rawParams === undefined) {
    return { name, params: [], error: null };
  }

  const trimmed = rawParams.trim();
  if (!trimmed) return { name, params: [], error: null };

  const params = trimmed.split(",").map((part) => part.trim());
  for (const param of params) {
    if (!IDENTIFIER.test(param)) {
      return {
        name,
        params: [],
        error: `"${param || "(empty)"}" is not a valid variable name.`,
      };
    }
  }
  const unique = new Set(params);
  if (unique.size !== params.length) {
    return { name, params: [], error: "Duplicate parameter names are not allowed." };
  }

  return { name, params, error: null };
}

export function formatSignature(name: string, params: string[]): string {
  return params.length ? `${name}(${params.join(", ")})` : `${name}()`;
}

export function isValidIdentifier(value: string): boolean {
  return IDENTIFIER.test(value);
}
