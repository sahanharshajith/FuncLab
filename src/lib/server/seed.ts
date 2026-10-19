import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { STARTER_TEMPLATES } from "@/lib/workspace/defaults";
import { TEMPLATE_OWNER } from "./owner";

let seedPromise: Promise<void> | null = null;

/** Idempotently insert the shared starter templates. */
export async function ensureTemplatesSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      for (const template of STARTER_TEMPLATES) {
        const existing = await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(and(eq(workspaces.ownerKey, TEMPLATE_OWNER), eq(workspaces.name, template.name)))
          .limit(1);
        if (existing.length) continue;
        await db.insert(workspaces).values({
          ownerKey: TEMPLATE_OWNER,
          name: template.name,
          description: template.description,
          data: template.build(),
          isTemplate: true,
        });
      }
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}
