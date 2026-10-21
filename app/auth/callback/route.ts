import { NextResponse, type NextRequest } from "next/server";
import { authClient } from "@/lib/auth-server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const db = await authClient();
  if (code && db) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (
      error &&
      ["bad_code_verifier", "pkce_code_verifier_not_found"].includes(
        error.code ?? "",
      )
    ) {
      return NextResponse.redirect(
        new URL("/sign-in?error=browser", request.url),
      );
    }
    if (!error) {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (
        user?.email?.toLowerCase() === process.env.ALLOWED_EMAIL?.toLowerCase()
      )
        return NextResponse.redirect(new URL("/", request.url));
      await db.auth.signOut();
      return NextResponse.redirect(
        new URL("/sign-in?error=forbidden", request.url),
      );
    }
  }
  return NextResponse.redirect(new URL("/sign-in?error=link", request.url));
}
