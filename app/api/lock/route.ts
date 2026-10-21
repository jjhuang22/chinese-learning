import { NextResponse } from "next/server";
import { cookieOptions, SESSION_COOKIE } from "@/lib/passcode";
import { errorResponse, requireSameOrigin } from "@/lib/server";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const response = NextResponse.json(
      { locked: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set(SESSION_COOKIE, "", {
      ...cookieOptions(request),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
