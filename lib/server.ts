import { createClient } from "@supabase/supabase-js";
import { isUnlocked, passcodeConfig } from "./passcode";
import { supabaseProjectUrl } from "./supabase-config";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}
export function adminClient() {
  const config = passcodeConfig();
  const url = supabaseProjectUrl(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const missing = [
    "APP_PASSCODE",
    "SUPABASE_SERVICE_ROLE_KEY",
    "LEARNER_USER_ID",
  ].filter((name) => !process.env[name]);
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (missing.length)
    throw new ApiError(
      "Missing Vercel setting: " + missing.join(", ") + ".",
      503,
    );
  if (!config)
    throw new ApiError(
      "Check APP_PASSCODE (8–128 characters) and LEARNER_USER_ID (your existing user UUID).",
      503,
    );
  if (config.serviceKey.startsWith("sb_publishable_"))
    throw new ApiError(
      "The server requires the Supabase service-role or secret key.",
      503,
    );
  return {
    db: createClient(url!, config.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
    learnerId: config.learnerId,
  };
}
export async function requireUser() {
  if (!(await isUnlocked()))
    throw new ApiError("Unlock the app to continue.", 401);
  return adminClient();
}
export function requireSameOrigin(request: Request) {
  // Next can reconstruct request.url with its internal listening hostname.
  // Host preserves the public request destination, including its port.
  const target = new URL(request.url);
  const host = request.headers.get("host");
  if (host) target.host = host;
  if (request.headers.get("origin") !== target.origin)
    throw new ApiError("Use the app to make this request.", 403);
}
export async function readBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new ApiError("The request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("The request is empty.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ApiError("The request is too large.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return Response.json(
      { error: error.message },
      {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  console.error(
    "App request failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  return Response.json(
    { error: "Could not complete the request. Please try again." },
    { status: 502, headers: { "Cache-Control": "private, no-store" } },
  );
}
