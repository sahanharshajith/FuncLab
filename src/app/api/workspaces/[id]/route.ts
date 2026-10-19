import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { TEMPLATE_OWNER, getOwnerKey, jsonError, ownerKeyError } from "@/lib/server/owner";
import { describeZodError, workspaceUpdateSchema } from "@/lib/workspace/schema";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-fA-F-]{36}$/;

export async function GET(request: Request, context: Context) {
  const ownerKey = getOwnerKey(request);
  if (!ownerKey) return ownerKeyError();
  const { id } = await context.params;
  if (!UUID.test(id)) return jsonError("Invalid workspace id.", 404);

  try {
    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (!row || (row.ownerKey !== ownerKey && row.ownerKey !== TEMPLATE_OWNER)) {
      return jsonError("Workspace not found.", 404);
    }
    return Response.json({
      workspace: {
        id: row.id,
        name: row.name,
        description: row.description,
        isTemplate: row.isTemplate,
        data: row.data,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/workspaces/[id] failed", error);
    return jsonError("Could not load the workspace.", 500);
  }
}

export async function PATCH(request: Request, context: Context) {
  const ownerKey = getOwnerKey(request);
  if (!ownerKey) return ownerKeyError();
  const { id } = await context.params;
  if (!UUID.test(id)) return jsonError("Invalid workspace id.", 404);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.");
  }
  const parsed = workspaceUpdateSchema.safeParse(payload);
  if (!parsed.success) return jsonError(describeZodError(parsed.error));

  try {
    const [row] = await db
      .update(workspaces)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.data !== undefined ? { data: parsed.data.data } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(workspaces.id, id), eq(workspaces.ownerKey, ownerKey)))
      .returning();

    if (!row) return jsonError("Workspace not found (templates are read only).", 404);

    return Response.json({
      workspace: {
        id: row.id,
        name: row.name,
        description: row.description,
        isTemplate: row.isTemplate,
        data: row.data,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/workspaces/[id] failed", error);
    return jsonError("Could not update the workspace.", 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  const ownerKey = getOwnerKey(request);
  if (!ownerKey) return ownerKeyError();
  const { id } = await context.params;
  if (!UUID.test(id)) return jsonError("Invalid workspace id.", 404);

  try {
    const deleted = await db
      .delete(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.ownerKey, ownerKey)))
      .returning({ id: workspaces.id });
    if (!deleted.length) return jsonError("Workspace not found (templates are read only).", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/workspaces/[id] failed", error);
    return jsonError("Could not delete the workspace.", 500);
  }
}
