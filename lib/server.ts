import { authClient } from "./auth-server";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}
export async function requireUser() {
  if (!process.env.ALLOWED_EMAIL)
    throw new ApiError("Complete the account setup before importing.", 503);
  const db = await authClient();
  if (!db) throw new ApiError("Connect Supabase before importing.", 503);
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new ApiError("Please sign in before importing.", 401);
  if (user.email?.toLowerCase() !== process.env.ALLOWED_EMAIL.toLowerCase())
    throw new ApiError("This account does not have access.", 403);
  return { user, db };
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Import failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  return Response.json(
    { error: "Could not save the lesson. Please try again." },
    { status: 502 },
  );
}
