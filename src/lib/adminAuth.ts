import { timingSafeEqual } from "node:crypto";

export const ADMIN_HEADER = "x-admin-password";

export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const provided = req.headers.get(ADMIN_HEADER) || "";
  if (provided.length === 0 || provided.length !== expected.length) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return timingSafeEqual(a, b);
}
