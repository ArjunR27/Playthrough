import { NextResponse } from "next/server";
import { getValidAccessToken, fetchTopTracks, fetchRecentlyPlayedTracks, fetchAlbumTracks} from "@/app/lib/spotify";

export async function GET() {
  try {
    // try to get your access token (will be null until login is set up)
    const token = await getValidAccessToken();

    if (!token) {
      return NextResponse.json({ error: "No valid token yet. Try logging in first." }, { status: 401 });
    }

    // const tracks = await fetchTopTracks(token);
    // const tracks = await fetchRecentlyPlayedTracks(token);
    const tracks = await fetchAlbumTracks(token); 
    return NextResponse.json(tracks);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
