import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const scope = "user-top-read user-read-recently-played";
const clientId = process.env.SPOTIFY_CLIENT_ID!;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI!;

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");

  // ⬇️ Next.js 15+: await cookies()
  const jar = await cookies();
  jar.set("sp_oauth_state", state, { httpOnly: true, path: "/", maxAge: 600, sameSite: "lax" });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    state,
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}
