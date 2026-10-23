import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminClient,
  ApiError,
  errorResponse,
  readBody,
  requireSameOrigin,
} from "@/lib/server";
import {
  attemptKey,
  passcodeConfig,
  cookieOptions,
  createSession,
  matchesPasscode,
  SESSION_COOKIE,
} from "@/lib/passcode";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    let input;
    try {
      input = z
        .object({ passcode: z.string().min(1).max(128) })
        .strict()
        .parse(JSON.parse(await readBody(request, 2048)));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Enter your password.", 400);
    }
    if (!passcodeConfig())
      throw new ApiError("The editing password is not configured.", 503);
    const { db } = adminClient();
    const { data: allowed, error } = await db.rpc("register_unlock_attempt", {
      client_key: attemptKey(request),
    });
    if (error)
      throw new ApiError(
        "Unlocking is not ready. Run the updated Supabase schema, then try again.",
        503,
      );
    if (allowed !== true)
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        {
          status: 429,
          headers: {
            "Retry-After": "900",
            "Cache-Control": "private, no-store",
          },
        },
      );
    if (!matchesPasscode(input.passcode))
      throw new ApiError("Incorrect password.", 401);
    const response = NextResponse.json(
      { unlocked: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set(
      SESSION_COOKIE,
      createSession(),
      cookieOptions(request),
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
