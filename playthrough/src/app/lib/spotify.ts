import { cookies } from "next/headers";
import { GET } from "../api/login/route";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const TOP_TRACKS_ENDPOINT = "https://api.spotify.com/v1/me/top/tracks?limit=5";
const RECENTLY_PLAYED_ENDPOINT = "https://api.spotify.com/v1/me/player/recently-played"
const GET_ALBUM_TRACKS_ENDPOINT = "https://api.spotify.com/v1/albums/{id}/tracks"

const clientId = process.env.SPOTIFY_CLIENT_ID!;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI!;

function b64(s: string) {
  return Buffer.from(s).toString("base64");
}

export async function exchangeCodeForToken(code: string) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${b64(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to exchange code");
  return res.json();
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${b64(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to refresh token");
  return res.json();
}

export async function getValidAccessToken(): Promise<string | null> {
  const jar = await cookies(); // ⬅️ await
  const access = jar.get("sp_access_token")?.value || null;
  const accessExp = jar.get("sp_access_expires_at")?.value || null;
  const refresh = jar.get("sp_refresh_token")?.value || null;

  const now = Date.now();
  if (access && accessExp && Number(accessExp) > now + 10_000) {
    return access;
  }
  if (!refresh) return null;

  const data = await refreshAccessToken(refresh);
  const expiresAt = Date.now() + data.expires_in * 1000;

  jar.set("sp_access_token", data.access_token, { httpOnly: true, sameSite: "lax", path: "/" });
  jar.set("sp_access_expires_at", String(expiresAt), { httpOnly: true, sameSite: "lax", path: "/" });
  if (data.refresh_token) {
    jar.set("sp_refresh_token", data.refresh_token, { httpOnly: true, sameSite: "lax", path: "/" });
  }

  return data.access_token;
}

export async function fetchTopTracks(token: string) {
  const res = await fetch(TOP_TRACKS_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch tracks");
  const json = await res.json();

  // return json.items
  return json.items.map((track: any) => ({
    song_name: track.name,
    artists: track.artists,
    album: track.album.name
  }))
}

export async function fetchRecentlyPlayedTracks(token: string) {
  const res = await fetch(`${RECENTLY_PLAYED_ENDPOINT}?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }); 
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Spotify API error:", res.status, errorText);
    throw new Error(`Failed to fetch recently played tracks: ${res.status} ${errorText}`);
  }
  
  const json = await res.json();
  let albumNamesAndId = json.items.map((item: any) => ({
    albumId: item.track.album.id,
    albumName: item.track.album.name,
  }));
  return albumNamesAndId; 

  // return json.items.map((item: any) => ({
  //   song: item.track.name,
  //   artist: item.track.artists.map((artist: any) => artist.name).join(", "),
  //   album: item.track.album.name,
  //   album_id: item.track.album.id,
  //   total_tracks: item.track.album.total_tracks,
  // }));
}


// This function looks at the top 50 most recent tracks you listened to and gets all the tracks in the album associated to that specific song. 
export async function fetchAlbumTracks(token: string) {
  let albumNamesAndId = await fetchRecentlyPlayedTracks(token);
  const albumTracksPromises = albumNamesAndId.map(async ({ albumId, albumName }: { albumId: string, albumName: string}) => {
    const url = GET_ALBUM_TRACKS_ENDPOINT.replace('{id}', albumId);
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
  });

    if (!res.ok) {
      console.error(`Failed to fetch tracks for album ${albumId}:`, res.status);
      return { albumId, albumName, tracks: [], error: true }; 
    }
    
    const json = await res.json();
    
    return {
      albumId, 
      albumName,
      tracks: json.items.map((track: any) => ({
        song_name: track.name,
        artists: track.artists.map((artist: any) => artist.name).join(", "),
      })),
      error: false
    };
  });
  
  return Promise.all(albumTracksPromises);
}
