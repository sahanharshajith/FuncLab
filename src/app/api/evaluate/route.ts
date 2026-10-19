import { evaluateExpression } from "@/lib/math/engine";
import { describeZodError, evaluateRequestSchema } from "@/lib/workspace/schema";
import { jsonError } from "@/lib/server/owner";

export const dynamic = "force-dynamic";

/**
 * Server side evaluation endpoint.
 * The same restricted mathjs engine is used on the server, with validation at
 * the boundary and strict limits on payload size.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.");
  }

  const parsed = evaluateRequestSchema.safeParse(payload);
  if (!parsed.success) return jsonError(describeZodError(parsed.error));
  if (Object.keys(parsed.data.values).length > 50) {
    return jsonError("Too many variables (max 50).");
  }

  const outcome = evaluateExpression(
    parsed.data.expression,
    parsed.data.values,
    parsed.data.angleMode,
  );

  return Response.json({
    value: outcome.value,
    display: outcome.display,
    error: outcome.error,
  });
}
