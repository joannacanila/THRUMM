import { NextResponse } from "next/server";

let spotifyToken: string | null = null;
let tokenExpiry = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpiry - 60000) return spotifyToken;
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token error: ${await res.text()}`);
  const data = await res.json();
  spotifyToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return spotifyToken;
}

async function searchSpotifyTrack(title: string, artist: string, token: string) {
  try {
    const q = encodeURIComponent(`track:${title} artist:${artist}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=track&limit=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const tracks = data.tracks?.items;
    if (!tracks?.length) return null;
    const match =
      tracks.find((t: any) =>
        t.artists[0].name.toLowerCase().includes(artist.toLowerCase().split(" ")[0])
      ) || tracks[0];
    return {
      spotifyId: match.id,
      spotifyUrl: match.external_urls.spotify,
      previewUrl: match.preview_url,
      albumArt: {
        large:  match.album.images[0]?.url || null,
        medium: match.album.images[1]?.url || null,
        small:  match.album.images[2]?.url || null,
      },
      albumName:   match.album.name,
      durationMs:  match.duration_ms,
      popularity:  match.popularity,
      explicit:    match.explicit,
      releaseDate: match.album.release_date,
      artistUrl:   match.artists[0].external_urls.spotify,
    };
  } catch { return null; }
}

async function searchSpotifyPlaylist(query: string, token: string) {
  try {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=playlist&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pl = data.playlists?.items?.[0];
    if (!pl) return null;
    return { name: pl.name, url: pl.external_urls.spotify, image: pl.images?.[0]?.url || null, trackCount: pl.tracks?.total };
  } catch { return null; }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { mood, sessionHistory = [], likedArtists = [] } = body;

  if (!mood || typeof mood !== "string" || mood.trim().length === 0) {
    return NextResponse.json({ error: "mood is required" }, { status: 400 });
  }

  let prefContext = "";
  if (sessionHistory.length >= 2) {
    const recentMoods = sessionHistory.slice(-3).map((s: any) => s.mood);
    const allGenres = sessionHistory.flatMap((s: any) => s.genres || []);
    const genreCount: Record<string, number> = {};
    allGenres.forEach((g: string) => (genreCount[g] = (genreCount[g] || 0) + 1));
    const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
    prefContext = `\n\nUSER HISTORY (${sessionHistory.length} sessions):\nPrevious moods: ${recentMoods.join(" | ")}\nTop genres: ${topGenres.join(", ")}\nLean into these genres while matching current mood.`;
  }
  if (likedArtists.length) {
    prefContext += `\nUser liked artists: ${likedArtists.slice(0, 5).join(", ")}. Include 1-2 similar artists.`;
  }

  const prompt = `You are THRUMM, a Gen-Z AI music curator. Return ONLY valid JSON — no markdown, no text outside the object.

MOOD: "${mood.trim()}"${prefContext}

{
  "moodLabel": "2-3 word Gen-Z vibe label",
  "vibeAnalysis": "2 raw Gen-Z sentences about their emotional state",
  "aiInsight": "1-2 sentences of music psychology",
  "genres": ["genre1", "genre2", "genre3"],
  "spotifyQuery": "search string for this mood",
  "vibeColor": "#hexcolor",
  "vibeMeters": [
    {"label": "energy",     "value": 65, "color": "#00ff87"},
    {"label": "melancholy", "value": 45, "color": "#9b5cff"},
    {"label": "nostalgia",  "value": 55, "color": "#ff2d78"},
    {"label": "intensity",  "value": 40, "color": "#f59e0b"}
  ],
  "songs": [
    {"title": "Exact Song Title", "artist": "Exact Artist Name", "emoji": "emoji", "vibe": "oneword", "vibeColor": "#hex", "why": "max 10 words", "genre": "genre"}
  ]
}

RULES: Exactly 10 songs. REAL songs only. Mix genres. No duplicate artists. Gen-Z moodLabel.`;

  let aiResult: any;
  try {
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "THRUMM",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.85,
        max_tokens: 1400,
      }),
    });
    if (!aiRes.ok) throw new Error(`OpenRouter error: ${await aiRes.text()}`);
    const aiData = await aiRes.json();
    const rawText = aiData.choices?.[0]?.message?.content || "{}";
    const clean = rawText.replace(/```json|```/g, "").trim();
    try { aiResult = JSON.parse(clean); }
    catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) aiResult = JSON.parse(match[0]);
      else throw new Error("Unparseable JSON");
    }
  } catch (err: any) {
    console.error("AI step failed:", err.message);
    aiResult = {
      moodLabel: "offline vibe",
      vibeAnalysis: "signal lost but the music never stops.",
      aiInsight: "even without AI, these songs carry you through.",
      genres: ["pop", "indie"],
      spotifyQuery: mood,
      vibeColor: "#00ff87",
      vibeMeters: [
        { label: "energy",     value: 55, color: "#00ff87" },
        { label: "melancholy", value: 40, color: "#9b5cff" },
        { label: "nostalgia",  value: 50, color: "#ff2d78" },
        { label: "intensity",  value: 45, color: "#f59e0b" },
      ],
      songs: [
        { title: "Blinding Lights",  artist: "The Weeknd",     emoji: "🌙", vibe: "electric",  vibeColor: "#ff2d78", why: "midnight energy that never fades",     genre: "synth-pop" },
        { title: "Heat Waves",       artist: "Glass Animals",  emoji: "🌊", vibe: "dreamy",    vibeColor: "#22d3ee", why: "hazy emotional waves wash over you",    genre: "indie pop" },
        { title: "As It Was",        artist: "Harry Styles",   emoji: "🌸", vibe: "nostalgic", vibeColor: "#9b5cff", why: "bittersweet and perfectly melancholic", genre: "pop"       },
        { title: "good 4 u",         artist: "Olivia Rodrigo", emoji: "💥", vibe: "chaotic",   vibeColor: "#ff2d78", why: "rage and heartbreak perfectly bottled", genre: "pop punk"  },
        { title: "Levitating",       artist: "Dua Lipa",       emoji: "✨", vibe: "floaty",    vibeColor: "#00ff87", why: "pure feel-good levitation energy",      genre: "disco pop" },
        { title: "Stay",             artist: "The Kid LAROI",  emoji: "💔", vibe: "yearning",  vibeColor: "#9b5cff", why: "raw longing hits every time",           genre: "pop"       },
        { title: "Sunflower",        artist: "Post Malone",    emoji: "🌻", vibe: "warm",      vibeColor: "#f59e0b", why: "warm glow you want to live inside",     genre: "hip-hop"   },
        { title: "drivers license",  artist: "Olivia Rodrigo", emoji: "🚗", vibe: "aching",    vibeColor: "#22d3ee", why: "the ache of something unrealized",      genre: "pop"       },
        { title: "Watermelon Sugar", artist: "Harry Styles",   emoji: "🍉", vibe: "summery",   vibeColor: "#ff2d78", why: "sweet carefree summer in a song",       genre: "pop"       },
        { title: "Peaches",          artist: "Justin Bieber",  emoji: "🍑", vibe: "smooth",    vibeColor: "#f59e0b", why: "effortlessly smooth and easy",          genre: "r&b"       },
      ],
    };
  }

  let spotifyData: any[] = new Array(aiResult.songs?.length || 0).fill(null);
  let moodPlaylist = null;
  try {
    const token = await getSpotifyToken();
    const [trackResults, playlist] = await Promise.all([
      Promise.all((aiResult.songs || []).map((s: any) => searchSpotifyTrack(s.title, s.artist, token as string))),
      searchSpotifyPlaylist(aiResult.spotifyQuery || mood, token as string),
    ]);
    spotifyData = trackResults;
    moodPlaylist = playlist;
  } catch (err: any) {
    console.error("Spotify enrichment failed:", err.message);
  }

  const enrichedSongs = (aiResult.songs || []).map((song: any, i: number) => {
    const sp = spotifyData[i];
    return {
      title:       song.title,
      artist:      song.artist,
      emoji:       song.emoji  || "🎵",
      vibe:        song.vibe   || "vibe",
      vibeColor:   song.vibeColor || "#00ff87",
      why:         song.why    || "",
      genre:       song.genre  || "",
      spotifyId:   sp?.spotifyId   || null,
      spotifyUrl:  sp?.spotifyUrl  || `https://open.spotify.com/search/${encodeURIComponent(song.title + " " + song.artist)}`,
      previewUrl:  sp?.previewUrl  || null,
      albumArt: {
        large:  sp?.albumArt?.large  || null,
        medium: sp?.albumArt?.medium || null,
        small:  sp?.albumArt?.small  || null,
      },
      albumName:   sp?.albumName   || null,
      durationMs:  sp?.durationMs  || null,
      popularity:  sp?.popularity  || null,
      explicit:    sp?.explicit    ?? null,
      releaseDate: sp?.releaseDate || null,
      artistUrl:   sp?.artistUrl   || null,
      hasPreview:  !!sp?.previewUrl,
      hasSpotify:  !!sp?.spotifyId,
    };
  });

  return NextResponse.json({
    moodLabel:    aiResult.moodLabel    || "your frequency",
    vibeAnalysis: aiResult.vibeAnalysis || "",
    aiInsight:    aiResult.aiInsight    || "",
    genres:       aiResult.genres       || [],
    spotifyQuery: aiResult.spotifyQuery || mood,
    vibeColor:    aiResult.vibeColor    || "#00ff87",
    vibeMeters:   aiResult.vibeMeters   || [],
    songs:        enrichedSongs,
    moodPlaylist,
    meta: {
      sessionCount:     (sessionHistory?.length || 0) + 1,
      songsWithPreview: enrichedSongs.filter((s: any) => s.hasPreview).length,
      songsWithSpotify: enrichedSongs.filter((s: any) => s.hasSpotify).length,
      generatedAt:      new Date().toISOString(),
    },
  });
}