"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Song {
  title: string;
  artist: string;
  emoji: string;
  vibe: string;
  vibeColor: string;
  why: string;
  genre: string;
  spotifyId: string | null;
  spotifyUrl: string;
  previewUrl: string | null;
  albumArt: { large: string | null; medium: string | null; small: string | null };
  hasPreview: boolean;
  hasSpotify: boolean;
}

interface AnalysisData {
  moodLabel: string;
  vibeAnalysis: string;
  aiInsight: string;
  genres: string[];
  spotifyQuery: string;
  vibeColor: string;
  vibeMeters: { label: string; value: number; color: string }[];
  songs: Song[];
}

interface Session {
  mood: string;
  moodLabel: string;
  genres: string[];
  ts: number;
}

/* ─────────────────────────────────────────
   STORAGE
───────────────────────────────────────── */
const store = {
  getSessions: (): Session[] => { try { return JSON.parse(localStorage.getItem("thrumm_s") || "[]"); } catch { return []; } },
  saveSession: (e: Omit<Session, "ts">) => { const s = store.getSessions(); s.push({ ...e, ts: Date.now() }); localStorage.setItem("thrumm_s", JSON.stringify(s.slice(-20))); },
  getLiked: (): { title: string; artist: string }[] => { try { return JSON.parse(localStorage.getItem("thrumm_l") || "[]"); } catch { return []; } },
  toggleLike: (song: Song) => { const l = store.getLiked(); const i = l.findIndex(x => x.title === song.title && x.artist === song.artist); if (i >= 0) l.splice(i, 1); else l.push({ title: song.title, artist: song.artist }); localStorage.setItem("thrumm_l", JSON.stringify(l.slice(-150))); return l; },
  getLikedArtists: (): string[] => [...new Set(store.getLiked().map(l => l.artist))].slice(0, 10) as string[],
};

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const CHIPS = [
  { label: "🔥 main character",  value: "happy and unstoppable, main character energy" },
  { label: "💔 crying hours",    value: "heartbroken and crying, missing someone deeply" },
  { label: "🌿 soft life",       value: "calm and peaceful, cozy soft life vibes" },
  { label: "🌙 nostalgia trip",  value: "deeply nostalgic, missing old memories" },
  { label: "💅 party szn",       value: "hyped and ready to party, high energy" },
  { label: "⚡ grind mode",      value: "focused deep work, locked in grind mode" },
  { label: "🌀 unhinged era",    value: "chaotic unhinged energy, feral and free" },
  { label: "🌸 lovesick",        value: "lovesick and romantic, dreamy and soft" },
  { label: "😮‍💨 spiral mode",  value: "anxious and overthinking, spiral mode" },
  { label: "💎 that girl/guy",   value: "unbothered glowing, confident and radiant" },
  { label: "🌃 midnight drive",  value: "late night drive, introspective cinematic energy" },
  { label: "🕊️ healing era",    value: "healing slowly, recovering and finding peace" },
];

const LOAD_MSGS = [
  "reading your energy...",
  "scanning the sonic universe...",
  "matching your wavelength...",
  "picking the perfect songs...",
  "almost ready...",
];

/* ─────────────────────────────────────────
   COMPONENT
───────────────────────────────────────── */
export default function Home() {
  const [mood, setMood]             = useState("");
  const [loading, setLoading]       = useState(false);
  const [loadMsg, setLoadMsg]       = useState(LOAD_MSGS[0]);
  const [data, setData]             = useState<AnalysisData | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [curSong, setCurSong]       = useState<Song | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [liked, setLiked]           = useState<{ title: string; artist: string }[]>([]);
  const [orbColor, setOrbColor]     = useState("#00ff87");
  const [sessCount, setSessCount]   = useState(1);
  const [hint, setHint]             = useState("");
  const [lastSess, setLastSess]     = useState("");
  const [toast, setToast]           = useState("");
  const [toastOn, setToastOn]       = useState(false);

  const curRef    = useRef<HTMLDivElement>(null);
  const ringRef   = useRef<HTMLDivElement>(null);
  const toastTmr  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadIntv  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mPos      = useRef({ x: 0, y: 0 });
  const fPos      = useRef({ x: 0, y: 0 });
  const rafRef    = useRef<number>(0);

  /* ── init ── */
  useEffect(() => {
    setLiked(store.getLiked());
    const sessions = store.getSessions();
    setSessCount(sessions.length + 1);
    if (sessions.length > 0) {
      const last = sessions[sessions.length - 1];
      const d = Date.now() - last.ts;
      const ago = d < 60000 ? "just now" : d < 3600000 ? `${Math.floor(d/60000)}m ago` : d < 86400000 ? `${Math.floor(d/3600000)}h ago` : `${Math.floor(d/86400000)}d ago`;
      setLastSess(`last session · "${last.mood?.slice(0, 36)}${(last.mood?.length ?? 0) > 36 ? "…" : ""}" · ${ago}`);
    }
    refreshHint(sessions);
  }, []);

  function refreshHint(sessions: Session[]) {
    if (sessions.length < 2) return;
    const gc: Record<string, number> = {};
    sessions.flatMap(s => s.genres || []).forEach(g => gc[g] = (gc[g] || 0) + 1);
    const top = Object.entries(gc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
    if (top.length) setHint(`Learning your taste → ${top.join(", ")}`);
  }

  /* ── cursor ── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mPos.current = { x: e.clientX, y: e.clientY };
      if (curRef.current) { curRef.current.style.left = `${e.clientX}px`; curRef.current.style.top = `${e.clientY}px`; }
    };
    const tick = () => {
      fPos.current.x += (mPos.current.x - fPos.current.x) * 0.12;
      fPos.current.y += (mPos.current.y - fPos.current.y) * 0.12;
      if (ringRef.current) { ringRef.current.style.left = `${fPos.current.x}px`; ringRef.current.style.top = `${fPos.current.y}px`; }
      rafRef.current = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    rafRef.current = requestAnimationFrame(tick);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(rafRef.current); };
  }, []);

  /* ── helpers ── */
  const showToast = useCallback((msg: string) => {
    setToast(msg); setToastOn(true);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToastOn(false), 2600);
  }, []);

  function startLoader() {
    let i = 0; setLoadMsg(LOAD_MSGS[0]);
    loadIntv.current = setInterval(() => { i = (i + 1) % LOAD_MSGS.length; setLoadMsg(LOAD_MSGS[i]); }, 1500);
  }
  function stopLoader() { if (loadIntv.current) clearInterval(loadIntv.current); }

  /* ── song select — shows Spotify embed ── */
  function selectSong(song: Song) {
    const id = song.spotifyId || song.title;
    if (expandedId === id) {
      setExpandedId(null);
      setCurSong(null);
    } else {
      setExpandedId(id);
      setCurSong(song);
      setOrbColor(song.vibeColor || "#00ff87");
      setTimeout(() => {
        document.getElementById("now-playing")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }

  /* ── like ── */
  function handleLike(song: Song) {
    const updated = store.toggleLike(song);
    setLiked([...updated]);
    showToast(updated.some(l => l.title === song.title) ? "Added to liked songs ♥" : "Removed from liked");
  }
  const isLiked    = (s: Song) => liked.some(l => l.title === s.title && l.artist === s.artist);
  const isExpanded = (s: Song) => expandedId === (s.spotifyId || s.title);

  /* ── submit ── */
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!mood.trim()) return;
    setLoading(true); setError(null); setData(null);
    setCurSong(null); setExpandedId(null);
    startLoader();
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood.trim(), sessionHistory: store.getSessions(), likedArtists: store.getLikedArtists() }),
      });
      if (!res.ok) throw new Error("Something went wrong. Please try again.");
      const result: AnalysisData = await res.json();
      store.saveSession({ mood: mood.trim(), moodLabel: result.moodLabel, genres: result.genres });
      setSessCount(store.getSessions().length);
      setData(result);
      setOrbColor(result.vibeColor || "#00ff87");
      refreshHint(store.getSessions());
      showToast("Your playlist is ready ✦");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      stopLoader(); setLoading(false);
    }
  }

  const vc = data?.vibeColor || "#00ff87";

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: #060608; color: #ececf6; font-family: 'Syne', sans-serif; overflow-x: hidden; cursor: none; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px; }
        a { text-decoration: none; color: inherit; }
        button, input { font-family: 'Syne', sans-serif; }

        @keyframes orb     { 0%{transform:translate(0,0)scale(1)} 25%{transform:translate(50px,-60px)scale(1.08)} 50%{transform:translate(-30px,50px)scale(.93)} 75%{transform:translate(60px,30px)scale(1.06)} 100%{transform:translate(0,0)scale(1)} }
        @keyframes scan    { 0%{top:-1px} 100%{top:100vh} }
        @keyframes ptfl    { 0%{transform:translateY(100vh)translateX(0);opacity:0} 8%{opacity:.5} 92%{opacity:.15} 100%{transform:translateY(-5vh)translateX(var(--dx));opacity:0} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(.6)} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:.1} }
        @keyframes eq      { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(.2)} }
        @keyframes hue     { 0%,100%{filter:hue-rotate(0deg)} 50%{filter:hue-rotate(25deg)} }
        @keyframes lbar    { 0%,100%{height:6px;opacity:.25} 50%{height:48px;opacity:1} }
        @keyframes lpulse  { 0%,100%{opacity:.3} 50%{opacity:.9} }
        @keyframes up      { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cin     { from{opacity:0;transform:scale(.92)translateY(10px)} to{opacity:1;transform:scale(1)translateY(0)} }
        @keyframes artpop  { from{transform:scale(.88);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes embedin { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .chip:hover   { background:rgba(255,255,255,.07) !important; color:#ececf6 !important; border-color:rgba(255,255,255,.15) !important; transform:translateY(-1px) scale(1.03) !important; }
        .chip.sel     { background:#00ff87 !important; color:#000 !important; border-color:#00ff87 !important; font-weight:700 !important; }
        .scard:hover  { transform:translateY(-4px) scale(1.02) !important; border-color:rgba(255,255,255,.1) !important; background:#111120 !important; }
        .scard:hover .ovl { opacity:1 !important; }
        .scard:hover img  { transform:scale(1.05) !important; }
        .gobtn:hover  { transform:scale(1.05) !important; box-shadow:0 8px 30px rgba(0,255,135,.3) !important; }
        .gobtn:active { transform:scale(.97) !important; }
        .prime:hover  { transform:scale(1.03) !important; box-shadow:0 8px 30px rgba(0,255,135,.25) !important; }
        .sec:hover    { border-color:rgba(255,255,255,.18) !important; color:#ececf6 !important; }
        .lbtn:hover   { opacity:1 !important; transform:scale(1.3) !important; }
        .spbtn:hover  { background:#00ff87 !important; color:#000 !important; }
        .morebtn:hover { border-color:rgba(255,255,255,.2) !important; color:#ececf6 !important; }
        input:focus   { border-color:rgba(0,255,135,.4) !important; box-shadow:0 0 0 3px rgba(0,255,135,.08) !important; }
      `}</style>

      {/* CURSOR */}
      <div ref={curRef} style={{ position:"fixed", width:"10px", height:"10px", background:"#00ff87", borderRadius:"50%", pointerEvents:"none", zIndex:9999, transform:"translate(-50%,-50%)", mixBlendMode:"screen", boxShadow:"0 0 12px #00ff87" }} />
      <div ref={ringRef} style={{ position:"fixed", width:"32px", height:"32px", border:"1px solid rgba(0,255,135,.3)", borderRadius:"50%", pointerEvents:"none", zIndex:9998, transform:"translate(-50%,-50%)", opacity:.4 }} />

      {/* BG */}
      <div style={{ position:"fixed", inset:0, backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.025'/%3E%3C/svg%3E")`, pointerEvents:"none", zIndex:1001 }} />
      <div style={{ position:"fixed", inset:0, opacity:.013, backgroundImage:"linear-gradient(rgba(0,255,135,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,135,1) 1px,transparent 1px)", backgroundSize:"72px 72px", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", left:0, right:0, height:"1px", background:"linear-gradient(90deg,transparent,#00ff87,transparent)", opacity:.06, pointerEvents:"none", zIndex:999, animation:"scan 10s linear infinite" }} />
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        <div style={{ position:"absolute", width:"750px", height:"750px", background:orbColor, top:"-280px", left:"-220px", opacity:.07, borderRadius:"50%", filter:"blur(120px)", animation:"orb 28s linear infinite", transition:"background 1.5s ease" }} />
        <div style={{ position:"absolute", width:"600px", height:"600px", background:"#9b5cff", bottom:"-180px", right:"-150px", opacity:.07, borderRadius:"50%", filter:"blur(120px)", animation:"orb 32s linear infinite reverse" }} />
        <div style={{ position:"absolute", width:"420px", height:"420px", background:"#ff2d78", top:"32%", left:"28%", opacity:.045, borderRadius:"50%", filter:"blur(120px)", animation:"orb 20s linear infinite" }} />
        <div style={{ position:"absolute", width:"320px", height:"320px", background:"#22d3ee", bottom:"16%", left:"6%", opacity:.04, borderRadius:"50%", filter:"blur(120px)", animation:"orb 24s linear infinite", animationDelay:"-11s" }} />
      </div>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:1 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} style={{ position:"absolute", left:`${(i*43+11)%100}vw`, width:"2px", height:"2px", background:["#00ff87","#9b5cff","#22d3ee","#ff2d78"][i%4], borderRadius:"50%", opacity:0, animation:`ptfl ${9+(i*0.55)%12}s ${-(i*0.7)%15}s linear infinite`, ["--dx" as string]:`${(i*23+7)%140-70}px` }} />
        ))}
      </div>

      {/* ── NAV ── */}
      <nav style={{ position:"sticky", top:0, zIndex:600, backdropFilter:"blur(28px) saturate(180%)", WebkitBackdropFilter:"blur(28px) saturate(180%)", borderBottom:"1px solid rgba(255,255,255,.06)", background:"rgba(6,6,8,.8)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", height:"64px", padding:"0 40px" }}>
          {/* LEFT — logo */}
          <a href="/" style={{ display:"flex", alignItems:"center", gap:"11px", justifySelf:"start" }}>
            <div style={{ width:"28px", height:"28px", position:"relative", flexShrink:0 }}>
              <div style={{ position:"absolute", inset:0, border:"1.5px solid rgba(0,255,135,.45)", borderRadius:"50%", borderTopColor:"transparent", animation:"spin 3s linear infinite" }} />
              <div style={{ position:"absolute", inset:"7px", background:"#00ff87", borderRadius:"50%", boxShadow:"0 0 10px rgba(0,255,135,.9)", animation:"pulse 2s ease infinite" }} />
            </div>
            <span style={{ fontSize:"20px", fontWeight:800, letterSpacing:"-.5px" }}>THRU<span style={{ color:"#00ff87" }}>MM</span></span>
          </a>
          {/* CENTER — EQ */}
          <div style={{ display:"flex", alignItems:"flex-end", gap:"3px", height:"18px", justifySelf:"center" }}>
            {[4,11,18,11,4].map((h, i) => (
              <span key={i} style={{ width:"3px", background:"#00ff87", borderRadius:"3px", display:"block", height:`${h}px`, animation:"eq 1.4s ease infinite", animationDelay:`${[0,.12,.24,.12,0][i]}s`, opacity:.7 }} />
            ))}
          </div>
          {/* RIGHT — session */}
          <div style={{ justifySelf:"end" }}>
            <div style={{ fontFamily:"Space Mono,monospace", fontSize:"10px", letterSpacing:"1.5px", padding:"4px 13px", background: sessCount > 1 ? "rgba(0,255,135,.07)" : "rgba(255,255,255,.03)", border:`1px solid ${sessCount > 1 ? "rgba(0,255,135,.2)" : "rgba(255,255,255,.06)"}`, borderRadius:"100px", color: sessCount > 1 ? "#00ff87" : "#52526e", transition:"all .3s" }}>
              SESSION {sessCount}
            </div>
          </div>
        </div>
      </nav>

      {/* ── PAGE ── */}
      <div style={{ position:"relative", zIndex:2, maxWidth:"1080px", margin:"0 auto", padding:"0 40px" }}>

        {/* HERO */}
        <section style={{ textAlign:"center", padding:"88px 0 64px", animation:"up .9s ease both" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:"rgba(0,255,135,.06)", border:"1px solid rgba(0,255,135,.16)", borderRadius:"100px", padding:"6px 18px", fontSize:"10px", fontFamily:"Space Mono,monospace", color:"#00ff87", marginBottom:"32px", letterSpacing:"2px" }}>
            <span style={{ width:"6px", height:"6px", background:"#00ff87", borderRadius:"50%", animation:"blink 1.2s ease infinite", boxShadow:"0 0 8px #00ff87", display:"inline-block", flexShrink:0 }} />
            THRUMM is listening, share what’s on your mind
             
          </div>
          <h1 style={{ fontSize:"clamp(48px,8vw,96px)", fontWeight:800, lineHeight:.88, letterSpacing:"-3.5px", marginBottom:"22px" }}>
            <span style={{ display:"block" }}>feel every</span>
            <span style={{ display:"block", background:"linear-gradient(125deg,#00ff87,#22d3ee 45%,#9b5cff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", animation:"hue 5s ease infinite" }}>frequency</span>
          </h1>
          <p style={{ fontSize:"16px", color:"rgba(236,236,246,.45)", maxWidth:"400px", margin:"0 auto 20px", lineHeight:1.75, fontWeight:400 }}>
            Pour out your state of mind. THRUMM reads between the lines to curate a soundtrack that hits perfectly.

          </p>
          {lastSess && <div style={{ fontFamily:"Space Mono,monospace", fontSize:"10px", color:"rgba(255,255,255,.2)", letterSpacing:".5px" }}>{lastSess}</div>}
        </section>

        {/* INPUT */}
        <section style={{ maxWidth:"620px", margin:"0 auto 88px", animation:"up .9s .15s ease both" }}>
          <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:"24px", padding:"28px", backdropFilter:"blur(16px)", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:"15%", right:"15%", height:"1px", background:"linear-gradient(90deg,transparent,#00ff87,transparent)", opacity:.5 }} />
            <div style={{ fontSize:"10px", fontFamily:"Space Mono,monospace", color:"rgba(255,255,255,.28)", letterSpacing:"2.5px", textTransform:"uppercase", marginBottom:"14px" }}>
              what&apos;s your mood right now?
            </div>
            <form onSubmit={handleSubmit} style={{ display:"flex", gap:"10px", marginBottom:"16px" }}>
              <input
                value={mood}
                onChange={e => setMood(e.target.value)}
                placeholder="e.g. nostalgic for something i never had..."
                maxLength={220}
                autoComplete="off"
                spellCheck={false}
                style={{ flex:1, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:"12px", padding:"14px 18px", color:"#ececf6", fontSize:"14px", outline:"none", caretColor:"#00ff87", transition:"all .25s" }}
              />
              <button type="submit" disabled={loading} className="gobtn"
                style={{ background:"#00ff87", color:"#000", border:"none", borderRadius:"12px", padding:"0 24px", height:"50px", fontWeight:800, fontSize:"13px", cursor:"none", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:"7px", transition:"all .2s cubic-bezier(.34,1.4,.64,1)", opacity: loading ? .7 : 1, flexShrink:0 }}>
                {loading ? "reading..." : <>go <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>}
              </button>
            </form>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
              {CHIPS.map(c => (
                <button key={c.label} onClick={() => setMood(c.value)} className={`chip${mood === c.value ? " sel" : ""}`}
                  style={{ background:"rgba(255,255,255,.04)", color:"rgba(236,236,246,.4)", border:"1px solid rgba(255,255,255,.07)", borderRadius:"100px", padding:"6px 13px", fontSize:"11px", cursor:"none", transition:"all .2s", letterSpacing:".1px" }}>
                  {c.label}
                </button>
              ))}
            </div>
            {hint && (
              <div style={{ marginTop:"14px", padding:"11px 15px", background:"rgba(155,92,255,.06)", border:"1px solid rgba(155,92,255,.15)", borderRadius:"10px", fontSize:"11px", color:"rgba(155,92,255,.8)", fontFamily:"Space Mono,monospace", lineHeight:1.6, animation:"up .4s ease both" }}>
                {hint}
              </div>
            )}
          </div>
        </section>

        {/* LOADER */}
        {loading && (
          <div style={{ textAlign:"center", padding:"72px 0" }}>
            <div style={{ display:"flex", justifyContent:"center", alignItems:"flex-end", gap:"5px", height:"48px", marginBottom:"24px" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ width:"5px", background:"#00ff87", borderRadius:"5px", animation:"lbar .95s ease infinite", animationDelay:`${[0,.08,.16,.24,.32,.24,.16,.08][i]}s` }} />
              ))}
            </div>
            <div style={{ fontFamily:"Space Mono,monospace", fontSize:"11px", color:"rgba(255,255,255,.28)", letterSpacing:"2px", animation:"lpulse 1.4s ease infinite" }}>{loadMsg}</div>
          </div>
        )}

        {/* ERROR */}
        {error && !loading && (
          <div style={{ textAlign:"center", padding:"56px 0" }}>
            <div style={{ color:"#ff2d78", fontSize:"14px", marginBottom:"8px" }}>Something went wrong</div>
            <div style={{ fontFamily:"Space Mono,monospace", fontSize:"11px", color:"rgba(255,255,255,.25)", marginBottom:"22px" }}>{error}</div>
            <button onClick={() => handleSubmit()}
              style={{ background:"transparent", border:"1px solid rgba(255,255,255,.1)", color:"rgba(236,236,246,.5)", borderRadius:"10px", padding:"11px 24px", fontWeight:600, fontSize:"13px", cursor:"none", transition:"all .2s" }}>
              Try again
            </button>
          </div>
        )}

        {/* RESULTS */}
        {data && !loading && (
          <section style={{ animation:"up .5s ease both" }}>

            {/* header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"24px", flexWrap:"wrap", gap:"10px" }}>
              <div style={{ fontSize:"22px", fontWeight:800, letterSpacing:"-.5px" }}>Your playlist <span style={{ opacity:.35 }}>✦</span></div>
              <div style={{ padding:"6px 16px", borderRadius:"100px", fontSize:"11px", fontWeight:700, fontFamily:"Space Mono,monospace", background:`${vc}12`, color:vc, border:`1px solid ${vc}30` }}>{data.moodLabel}</div>
            </div>

            {/* vibe analysis */}
            <div style={{ background:"rgba(255,255,255,.022)", border:"1px solid rgba(255,255,255,.07)", borderRadius:"18px", padding:"22px 24px", marginBottom:"14px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"1.5px", background:`linear-gradient(90deg,transparent,${vc},#22d3ee,#9b5cff,transparent)` }} />
              <div style={{ fontSize:"10px", fontFamily:"Space Mono,monospace", color:"rgba(0,255,135,.6)", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"10px" }}>Vibe Analysis</div>
              <div style={{ fontSize:"14px", color:"rgba(236,236,246,.55)", lineHeight:1.8, marginBottom:"18px" }}>{data.vibeAnalysis}</div>
              <div style={{ display:"flex", gap:"14px", flexWrap:"wrap" }}>
                {data.vibeMeters?.map(m => (
                  <div key={m.label} style={{ flex:1, minWidth:"70px" }}>
                    <div style={{ fontSize:"10px", fontFamily:"Space Mono,monospace", color:"rgba(255,255,255,.3)", marginBottom:"5px", textTransform:"capitalize" }}>{m.label}</div>
                    <div style={{ height:"4px", background:"rgba(255,255,255,.06)", borderRadius:"4px", overflow:"hidden" }}>
                      <div style={{ width:`${m.value}%`, height:"100%", background:m.color, borderRadius:"4px", transition:"width 1.4s cubic-bezier(.34,1.1,.64,1)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* why these songs */}
            <div style={{ background:"rgba(155,92,255,.05)", border:"1px solid rgba(155,92,255,.12)", borderRadius:"16px", padding:"18px 22px", marginBottom:"20px", display:"flex", gap:"14px", alignItems:"flex-start" }}>
              <span style={{ fontSize:"20px", flexShrink:0 }}>🎯</span>
              <div>
                <div style={{ fontSize:"10px", fontFamily:"Space Mono,monospace", color:"rgba(155,92,255,.7)", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"7px" }}>Why these songs</div>
                <div style={{ fontSize:"13px", color:"rgba(236,236,246,.5)", lineHeight:1.75 }}>{data.aiInsight}</div>
              </div>
            </div>

            {/* taste profile (3+ sessions) */}
            {sessCount > 2 && (() => {
              const gc: Record<string, number> = {};
              store.getSessions().flatMap(s => s.genres || []).forEach(g => gc[g] = (gc[g] || 0) + 1);
              const top = Object.entries(gc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
              return top.length ? (
                <div style={{ background:"rgba(0,255,135,.04)", border:"1px solid rgba(0,255,135,.12)", borderRadius:"16px", padding:"18px 22px", marginBottom:"20px", animation:"up .5s ease both" }}>
                  <div style={{ fontSize:"10px", fontFamily:"Space Mono,monospace", color:"rgba(0,255,135,.6)", letterSpacing:"2px", marginBottom:"10px" }}>YOUR TASTE PROFILE</div>
                  <div style={{ fontSize:"12px", color:"rgba(236,236,246,.4)", lineHeight:1.7, marginBottom:"12px" }}>{sessCount} sessions in — THRUMM is learning what makes you tick.</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                    {top.map(g => <div key={g} style={{ padding:"3px 11px", background:"rgba(0,255,135,.07)", border:"1px solid rgba(0,255,135,.15)", borderRadius:"100px", fontSize:"10px", fontFamily:"Space Mono,monospace", color:"rgba(0,255,135,.7)" }}>{g}</div>)}
                  </div>
                </div>
              ) : null;
            })()}

            {/* NOW PLAYING HERO — shows when a song is selected */}
            {curSong && (
              <div id="now-playing" style={{ borderRadius:"20px", overflow:"hidden", marginBottom:"28px", position:"relative", background:"#0c0c18", border:`1px solid ${vc}25`, animation:"up .4s ease both" }}>
                {curSong.albumArt?.large && (
                  <div style={{ position:"absolute", inset:0, backgroundImage:`url(${curSong.albumArt.large})`, backgroundSize:"cover", backgroundPosition:"center", filter:"blur(48px) brightness(.28) saturate(180%)", transform:"scale(1.15)" }} />
                )}
                <div style={{ position:"relative", padding:"26px", display:"flex", gap:"22px", alignItems:"flex-start", flexWrap:"wrap" }}>
                  {/* album art */}
                  {curSong.albumArt?.medium
                    ? <img src={curSong.albumArt.medium} alt={curSong.title} style={{ width:"110px", height:"110px", borderRadius:"12px", objectFit:"cover", flexShrink:0, boxShadow:"0 12px 40px rgba(0,0,0,.7)", animation:"artpop .4s cubic-bezier(.34,1.4,.64,1)" }} />
                    : <div style={{ width:"110px", height:"110px", borderRadius:"12px", background:"#1a1a2e", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"44px", flexShrink:0 }}>{curSong.emoji}</div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    {/* now playing label */}
                    <div style={{ fontSize:"10px", fontFamily:"Space Mono,monospace", color:"rgba(0,255,135,.7)", letterSpacing:"2px", marginBottom:"8px", display:"flex", alignItems:"center", gap:"8px" }}>
                      <span style={{ display:"flex", alignItems:"flex-end", gap:"2px", height:"11px" }}>
                        {[3,7,11,7,3].map((h, i) => <span key={i} style={{ width:"2px", background:"#00ff87", borderRadius:"2px", height:`${h}px`, display:"block", animation:"eq 1.3s ease infinite", animationDelay:`${i*.1}s` }} />)}
                      </span>
                      NOW PLAYING
                    </div>
                    <div style={{ fontSize:"20px", fontWeight:800, letterSpacing:"-.3px", marginBottom:"3px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{curSong.title}</div>
                    <div style={{ fontSize:"13px", color:"rgba(236,236,246,.45)", marginBottom:"16px" }}>{curSong.artist}</div>

                    {/* SPOTIFY EMBED */}
                    {curSong.spotifyId ? (
                      <div style={{ animation:"embedin .4s ease both" }}>
                        <iframe
                          src={`https://open.spotify.com/embed/track/${curSong.spotifyId}?utm_source=generator&theme=0`}
                          width="100%"
                          height="80"
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          style={{ borderRadius:"10px", display:"block" }}
                        />
                        <div style={{ fontSize:"10px", fontFamily:"Space Mono,monospace", color:"rgba(255,255,255,.2)", marginTop:"8px", letterSpacing:".5px" }}>
                          free account → 30s preview &nbsp;·&nbsp; premium → full track
                        </div>
                      </div>
                    ) : (
                      <a href={curSong.spotifyUrl} target="_blank" rel="noreferrer"
                        style={{ display:"inline-flex", alignItems:"center", gap:"7px", background:"#1DB954", color:"#000", borderRadius:"10px", padding:"11px 20px", fontSize:"12px", fontWeight:800 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                        Open in Spotify
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* songs label */}
            <div style={{ fontSize:"10px", fontFamily:"Space Mono,monospace", color:"rgba(255,255,255,.22)", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"14px" }}>
              tap a song to listen
            </div>

           {/* SONG GRID */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(152px,1fr))",
    gap: "10px",
    marginBottom: "32px"
  }}
>
  {data.songs?.map((song, i) => {
    const expanded = isExpanded(song);
    const songLiked = isLiked(song);

    const album =
      song.albumArt?.medium ??
      song.albumArt?.large ??
      song.albumArt?.small;

    return (
      <div
        key={i}
        className="scard"
        onClick={() => selectSong(song)}
        style={{
          background: expanded ? "#0f0f1e" : "#0c0c18",
          border: `1px solid ${
            expanded ? `${vc}30` : "rgba(255,255,255,.05)"
          }`,
          borderRadius: "14px",
          padding: "12px",
          cursor: "none",
          transition: "all .2s ease",
          position: "relative",
          overflow: "hidden",
          animation: "cin .4s ease both",
          animationDelay: `${i * 0.05}s`
        }}
      >
        {/* left accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: "2px",
            background: vc,
            opacity: expanded ? 1 : 0,
            transition: "opacity .2s"
          }}
        />

        {/* album art */}
        <div
          style={{
            width: "100%",
            aspectRatio: "1/1",
            borderRadius: "9px",
            overflow: "hidden",
            marginBottom: "10px",
            background: "#161628",
            position: "relative"
          }}
        >
          {album ? (
            <img
              src={album}
              alt={song.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                transform: expanded ? "scale(1.05)" : "scale(1)",
                filter: expanded ? "brightness(.7)" : "brightness(1)",
                transition: "all .3s"
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "36px"
              }}
            >
              {song.emoji}
            </div>
          )}

          {/* overlay */}
          <div
            className="ovl"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: expanded ? 1 : 0,
              transition: "opacity .2s",
              backdropFilter: "blur(2px)"
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                background: "#00ff87",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 18px rgba(0,255,135,.4)"
              }}
            >
              {expanded ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="black">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="black">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </div>

          {/* EQ badge when playing */}
          {expanded && (
            <div
              style={{
                position: "absolute",
                bottom: "7px",
                right: "7px",
                background: "rgba(0,0,0,.55)",
                borderRadius: "5px",
                padding: "3px 5px",
                display: "flex",
                alignItems: "flex-end",
                gap: "2px",
                height: "17px"
              }}
            >
              {[4, 8, 12, 8].map((h, j) => (
                <span
                  key={j}
                  style={{
                    width: "2px",
                    background: "#00ff87",
                    borderRadius: "2px",
                    height: `${h}px`,
                    display: "block",
                    animation: "eq 1.3s ease infinite",
                    animationDelay: `${j * 0.1}s`
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  })}
</div>

            {/* actions */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", flexWrap:"wrap", marginBottom:"16px" }}>
              <a href={`https://open.spotify.com/search/${encodeURIComponent(data.spotifyQuery)}`} target="_blank" rel="noreferrer" className="prime"
                style={{ display:"flex", alignItems:"center", gap:"8px", background:"#00ff87", color:"#000", border:"none", borderRadius:"12px", padding:"12px 24px", fontWeight:800, fontSize:"13px", cursor:"none", transition:"all .2s" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Open full playlist on Spotify
              </a>
              <button className="sec" onClick={() => { setData(null); setMood(""); setCurSong(null); setExpandedId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{ display:"flex", alignItems:"center", gap:"7px", background:"rgba(255,255,255,.04)", color:"rgba(236,236,246,.5)", border:"1px solid rgba(255,255,255,.08)", borderRadius:"12px", padding:"12px 22px", fontWeight:600, fontSize:"13px", cursor:"none", transition:"all .2s" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                New mood
              </button>
            </div>
            <button className="morebtn" onClick={() => { showToast("Loading new songs..."); handleSubmit(); }}
              style={{ display:"block", margin:"0 auto 100px", background:"none", border:"1px solid rgba(255,255,255,.07)", color:"rgba(236,236,246,.3)", borderRadius:"100px", padding:"9px 24px", fontFamily:"Space Mono,monospace", fontSize:"10px", cursor:"none", transition:"all .2s", letterSpacing:"1.5px" }}>
              different songs ↓
            </button>

          </section>
        )}

      </div>

      {/* TOAST */}
      <div style={{ position:"fixed", bottom:"20px", right:"20px", background:"rgba(12,12,24,.96)", border:"1px solid rgba(255,255,255,.08)", borderRadius:"10px", padding:"10px 16px", fontSize:"11px", fontFamily:"Space Mono,monospace", zIndex:900, transform: toastOn ? "translateY(0)" : "translateY(14px)", opacity: toastOn ? 1 : 0, transition:"all .28s cubic-bezier(.34,1.3,.64,1)", pointerEvents:"none", color:"rgba(236,236,246,.6)", maxWidth:"240px", lineHeight:1.5 }}>
        {toast}
      </div>
    </>
  );
}
