import { desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { ensureTemplatesSeeded } from "@/lib/server/seed";
import { TEMPLATE_OWNER, getOwnerKey, jsonError, ownerKeyError } from "@/lib/server/owner";
import { describeZodError, workspaceCreateSchema } from "@/lib/workspace/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ownerKey = getOwnerKey(request);
  if (!ownerKey) return ownerKeyError();

  try {
    await ensureTemplatesSeeded();
    const rows = await db
      .select()
      .from(workspaces)
      .where(or(eq(workspaces.ownerKey, ownerKey), eq(workspaces.ownerKey, TEMPLATE_OWNER)))
      .orderBy(desc(workspaces.updatedAt))
      .limit(100);

    return Response.json({
      workspaces: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isTemplate: row.isTemplate,
        data: row.data,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/workspaces failed", error);
    return jsonError("Could not load cloud workspaces.", 500);
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

  const parsed = workspaceCreateSchema.safeParse(payload);
  if (!parsed.success) return jsonError(describeZodError(parsed.error));

  try {
    const [row] = await db
      .insert(workspaces)
      .values({
        ownerKey,
        name: parsed.data.name,
        description: parsed.data.description ?? "",
        data: parsed.data.data,
      })
      .returning();

    return Response.json(
      {
        workspace: {
          id: row.id,
          name: row.name,
          description: row.description,
          isTemplate: row.isTemplate,
          data: row.data,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/workspaces failed", error);
    return jsonError("Could not save the workspace to the cloud.", 500);
  }
}
