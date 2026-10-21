import { isUnlocked } from "@/lib/passcode";
export async function GET() {
  return new Response(null, {
    status: (await isUnlocked()) ? 204 : 401,
    headers: { "Cache-Control": "private, no-store" },
  });
}
