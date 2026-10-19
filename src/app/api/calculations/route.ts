import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calculations } from "@/db/schema";
import { getOwnerKey, jsonError, ownerKeyError } from "@/lib/server/owner";
import { calculationCreateSchema, describeZodError } from "@/lib/workspace/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ownerKey = getOwnerKey(request);
  if (!ownerKey) return ownerKeyError();
  try {
    const rows = await db
      .select()
      .from(calculations)
      .where(eq(calculations.ownerKey, ownerKey))
      .orderBy(desc(calculations.createdAt))
      .limit(50);
    return Response.json({
      calculations: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        expression: row.expression,
        result: row.result,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/calculations failed", error);
    return jsonError("Could not load calculation history.", 500);
  }
}

export async function POST(request: Request) {
  const ownerKey = getOwnerKey(request);
  if (!ownerKey) return ownerKeyError();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.");
  }
  const parsed = calculationCreateSchema.safeParse(payload);
  if (!parsed.success) return jsonError(describeZodError(parsed.error));

  try {
    const [row] = await db
      .insert(calculations)
      .values({ ownerKey, ...parsed.data })
      .returning();
    return Response.json(
      {
        calculation: {
          id: row.id,
          kind: row.kind,
          expression: row.expression,
          result: row.result,
          createdAt: row.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/calculations failed", error);
    return jsonError("Could not save the calculation.", 500);
  }
}

export async function DELETE(request: Request) {
  const ownerKey = getOwnerKey(request);
  if (!ownerKey) return ownerKeyError();
  try {
    await db.delete(calculations).where(eq(calculations.ownerKey, ownerKey));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/calculations failed", error);
    return jsonError("Could not clear the history.", 500);
  }
}
