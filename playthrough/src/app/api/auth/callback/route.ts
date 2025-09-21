import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken } from "@/app/lib/spotify";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies(); // ⬅️ await
  const storedState = jar.get("sp_oauth_state")?.value;

  // Add debugging
  console.log("Debug OAuth callback:");
  console.log("Code:", code ? "present" : "missing");
  console.log("State from URL:", state);
  console.log("Stored state:", storedState);
  console.log("States match:", state === storedState);

  if (!code || !state || state !== storedState) {
    console.log("OAuth validation failed:", { code: !!code, state: !!state, stateMatch: state === storedState });
    return new NextResponse("Invalid OAuth state or missing code", { status: 400 });
  }

  const token = await exchangeCodeForToken(code);
  const expiresAt = Date.now() + token.expires_in * 1000;

  jar.set("sp_access_token", token.access_token, { httpOnly: true, path: "/", sameSite: "lax" });
  jar.set("sp_refresh_token", token.refresh_token, { httpOnly: true, path: "/", sameSite: "lax" });
  jar.set("sp_access_expires_at", String(expiresAt), { httpOnly: true, path: "/", sameSite: "lax" });
  jar.delete("sp_oauth_state");

  return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL || "/");
}
