const OWNER_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const TEMPLATE_OWNER = "__funclab_templates__";

/** Resolve and validate the anonymous owner key sent by the client. */
export function getOwnerKey(request: Request): string | null {
  const header = request.headers.get("x-owner-key");
  if (!header) return null;
  const value = header.trim();
  return OWNER_KEY_PATTERN.test(value) ? value : null;
}

export function ownerKeyError(): Response {
  return Response.json(
    { error: "A valid x-owner-key header is required (8-64 url safe characters)." },
    { status: 400 },
  );
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}
