import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isIP } from "node:net";
export const SESSION_COOKIE = "everyday_session";
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export function passcodeConfig() {
  const passcode = process.env.APP_PASSCODE;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const learnerId = process.env.LEARNER_USER_ID;
  if (
    !passcode ||
    passcode.length < 8 ||
    passcode.length > 128 ||
    !serviceKey ||
    !learnerId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      learnerId,
    )
  )
    return null;
  return { passcode, serviceKey, learnerId };
}
function sessionKey() {
  const config = passcodeConfig();
  if (!config) throw new Error("Passcode setup is incomplete.");
  return createHmac("sha256", config.serviceKey)
    .update("everyday-session-v1\0" + config.passcode + "\0" + config.learnerId)
    .digest();
}
export function matchesPasscode(input: string) {
  const config = passcodeConfig();
  if (!config) return false;
  return timingSafeEqual(
    createHash("sha256").update(input).digest(),
    createHash("sha256").update(config.passcode).digest(),
  );
}
export function createSession(now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, exp: Math.floor(now / 1000) + SESSION_SECONDS }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", sessionKey()).update(payload).digest("base64url")
  );
}
export function verifySession(token: string | undefined, now = Date.now()) {
  if (!token || token.length > 1024 || !passcodeConfig()) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const expected = createHmac("sha256", sessionKey())
      .update(payload)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      data.v === 1 &&
      Number.isInteger(data.exp) &&
      data.exp > Math.floor(now / 1000) &&
      data.exp <= Math.floor(now / 1000) + SESSION_SECONDS
    );
  } catch {
    return false;
  }
}
export async function isUnlocked() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
export function attemptKey(request: Request) {
  const forwarded =
    process.env.VERCEL === "1"
      ? (request.headers.get("x-vercel-forwarded-for") ??
        request.headers.get("x-forwarded-for"))
      : null;
  const ip = forwarded?.split(",")[0].trim();
  return createHmac("sha256", sessionKey())
    .update("unlock-attempt\0" + (ip && isIP(ip) ? ip : "unknown"))
    .digest("hex");
}
export function cookieOptions(request: Request) {
  return {
    httpOnly: true,
    secure:
      process.env.VERCEL === "1" || new URL(request.url).protocol === "https:",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}
