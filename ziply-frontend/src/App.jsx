import { useState, useEffect, useRef } from "react";

const GITHUB_REPO = "https://github.com/AyushSriva2598/Ziply";
const API_BASE = import.meta.env.VITE_API_BASE;

const CONTAINER_MAX = 1200;
const CONTAINER_PAD = "clamp(24px, 5vw, 64px)";

const INK = "#16241C";
const ROUTE = "#1F6D45";
const ROUTE_DARK = "#123423";
const AMBER = "#C9862B";
const MUTE = "#6B7B70";
const PAPER = "#F5F7F2";
const TRACK = "#D7E2D9";

const STATIONS = [
  {
    n: "01",
    title: "Snowflake ID generation",
    body: "Every short code starts life as a 64-bit Snowflake ID — a millisecond timestamp, a machine identifier, and a per-millisecond sequence packed into one integer. Any number of workers can mint IDs at once with no shared counter and no collisions.",
    snippet: {
      label: "snowflake.py",
      code: `EPOCH = 1700000000000

class SnowflakeGenerator:
    def __init__(self, machine_id):
        self.machine_id = machine_id
        self.sequence = 0
        self.last_ts = -1
        self._lock = threading.Lock()

    def generate(self) -> int:
        with self._lock:
            ts = int(time.time() * 1000)
            if ts == self.last_ts:
                self.sequence = (self.sequence + 1) & 0xFFF
            else:
                self.sequence = 0
            self.last_ts = ts
            return ((ts - EPOCH) << 22) | (self.machine_id << 12) | self.sequence`,
    },
  },
  {
    n: "02",
    title: "Base62 encoding",
    body: "The Snowflake ID gets encoded into Base62 — the 62 characters that are always safe in a URL — producing a 7 to 9 character code. That's roughly 62 to the 8th possible values before collision is even a question worth asking.",
    charset: "0–9  a–z  A–Z",
  },
  {
    n: "03",
    title: "Redis cache-aside",
    body: "Every redirect checks Redis before it touches MySQL. A hit returns in under a millisecond. A miss falls through to the database and backfills the cache with a 24-hour TTL, so the same link never makes that trip twice in a row.",
    snippet: {
      label: "cache.py",
      code: `REDIRECT_TTL = 60 * 60 * 24  # 24h hot URLs
COLD_TTL     = 60 * 60 * 2   # 2h  cold URLs
KEY_PREFIX   = "url:"

def get_cached_url(short_code: str) -> str | None:
    return cache.get(KEY_PREFIX + short_code)

def set_cached_url(short_code, long_url, ttl=REDIRECT_TTL):
    cache.set(KEY_PREFIX + short_code, long_url, timeout=ttl)`,
    },
  },
  {
    n: "04",
    title: "Token bucket rate limiting",
    body: "Middleware tracks a rolling token bucket per IP — 10 requests, refilling at 10 per minute — sitting in front of the shorten endpoint. Abusive traffic gets throttled there, before it ever reaches Django.",
    snippet: {
      label: "ratelimit.py",
      code: `RATE        = 10
REFILL_RATE = 10 / 60

def is_rate_limited(ip: str) -> bool:
    key = f"rl:{ip}"
    now = time.time()
    bucket = cache.get(key) or {"tokens": RATE, "last": now}
    elapsed = now - bucket["last"]
    bucket["tokens"] = min(RATE, bucket["tokens"] + elapsed * REFILL_RATE)
    bucket["last"] = now
    if bucket["tokens"] < 1:
        cache.set(key, bucket, timeout=60)
        return True
    bucket["tokens"] -= 1
    cache.set(key, bucket, timeout=60)
    return False`,
    },
  },
  {
    n: "05",
    title: "Horizontal scaling",
    body: "Django workers hold no local state. They sit behind Nginx and Docker Compose, so throughput grows by adding containers — not by rewriting the app.",
    formula: "docker compose up --scale web=6",
  },
];

const DEPARTURES = [
  { label: "WRITE CAPACITY", value: "100M+/DAY" },
  { label: "REDIRECT LATENCY", value: "<1MS" },
  { label: "ID COLLISION RISK", value: "ZERO" },
  { label: "CACHE HIT RATE", value: "~95%" },
];

const SNIPPETS = STATIONS.filter(s => s.snippet).map(s => s.snippet);

// Accepts bare domains ("example.com/x") as well as fully-qualified URLs,
// and normalizes to something the API can actually shorten.
function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(candidate);
    if (!u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

function useTypewriter(text, speed = 40) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!text) { setDisplayed(""); return; }
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text]);
  return displayed;
}

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, from = "up", delay = 0 }) {
  const [ref, visible] = useReveal();
  const offsets = {
    up: "translateY(20px)",
    left: "translateX(-24px)",
    right: "translateX(24px)",
  };
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translate(0,0)" : offsets[from],
      transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

function Band({ bg, padding, children, borderTop }) {
  return (
    <div style={{ width: "100%", background: bg, padding: padding || "0", borderTop: borderTop || "none" }}>
      <div style={{ width: "100%", maxWidth: CONTAINER_MAX, margin: "0 auto", padding: `0 ${CONTAINER_PAD}` }}>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ code }) {
  const kwds = ['def ', 'class ', 'return ', 'import ', 'from ', 'if ', 'else', 'with ', 'int', 'str', 'None', 'True', 'False'];
  return (
    <pre style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12.5, lineHeight: 1.8,
      color: "#BFEBCF", margin: 0, whiteSpace: "pre",
    }}>
      {code.split('\n').map((line, i) => {
        const comments = line.match(/#.*/g) || [];
        if (comments.length) {
          const c = comments[0];
          return (
            <div key={i}>
              <span>{line.split(c)[0]}</span>
              <span style={{ color: "#6FBE8C" }}>{c}</span>
              {'\n'}
            </div>
          );
        }
        return (
          <div key={i}>
            {line.split(/(\s+)/).map((tok, j) => {
              if (kwds.some(k => tok.trim() === k.trim()))
                return <span key={j} style={{ color: "#8FE0AE" }}>{tok}</span>;
              if (/^[\d.]+$/.test(tok.trim()) && tok.trim())
                return <span key={j} style={{ color: "#6FBE8C" }}>{tok}</span>;
              return <span key={j}>{tok}</span>;
            })}
            {'\n'}
          </div>
        );
      })}
    </pre>
  );
}

export default function App() {
  const [longUrl, setLongUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [urlError, setUrlError] = useState("");
  const [copied, setCopied] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [openStation, setOpenStation] = useState(null);
  const [activeSnippet, setActiveSnippet] = useState(0);
  const inputRef = useRef(null);
  const typedShort = useTypewriter(shortUrl, 45);

  async function handleShorten() {
    const normalized = normalizeUrl(longUrl);
    if (!normalized) {
      setUrlError(longUrl.trim() ? "That doesn't look like a valid URL." : "Paste a URL first.");
      inputRef.current?.focus();
      return;
    }
    setUrlError("");
    setLoading(true);
    setError("");
    setShortUrl("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/shorten/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ long_url: normalized }),
      });
      if (res.status === 429) throw new Error("Rate limit hit. Wait a moment.");
      if (!res.ok) throw new Error("Something went wrong.");
      const data = await res.json();
      if (!data.short_code) throw new Error("Server didn't return a short code.");
      setShortUrl(`${API_BASE}/${data.short_code}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleShorten();
  }

  function handleChange(e) {
    setLongUrl(e.target.value);
    if (urlError) setUrlError("");
  }

  // Doubles as the field's paste shortcut when empty, and a clear button once it has content.
  async function handleFieldAction() {
    if (longUrl.trim()) {
      setLongUrl("");
      setUrlError("");
      setError("");
      setShortUrl("");
      inputRef.current?.focus();
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLongUrl(text);
        setUrlError("");
      }
    } catch {
      // Clipboard permission denied or unavailable — user can still type/paste manually.
    } finally {
      inputRef.current?.focus();
    }
  }

  const truncatedLong = longUrl.length > 46 ? longUrl.slice(0, 46) + "…" : longUrl;
  const fieldMessage = urlError || error;

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: PAPER, fontFamily: "'Inter', system-ui, sans-serif", color: INK }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html, body, #root{width:100%;min-height:100%;background:${PAPER};}
        @media (prefers-reduced-motion: reduce){ *{transition:none !important;animation:none !important;} }
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${TRACK};border-radius:2px;}
        .snippet-code::-webkit-scrollbar{height:3px;}
        ::selection{background:#D7ECDD;color:${INK};}
        .gh-btn:hover{background:${ROUTE_DARK} !important;}
        .go-btn:hover:not(:disabled){background:${ROUTE_DARK} !important;transform:translateY(-1px);}
        .go-btn:active:not(:disabled){transform:translateY(0);}
        .copy-btn:hover{background:#E4F1E8 !important;}
        .station-toggle:hover{color:${ROUTE} !important;}
        .repo-btn:hover{background:${ROUTE_DARK} !important;color:#fff !important;}
        .field-action-btn:hover{background:${TRACK} !important;color:${INK} !important;}
        .field-action-btn:focus-visible, .go-btn:focus-visible, .copy-btn:focus-visible{
          outline:2px solid ${ROUTE};outline-offset:2px;
        }
        @keyframes pulseDot{0%,100%{opacity:1;}50%{opacity:.35;}}
        .live-dot{animation:pulseDot 1.8s ease-in-out infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .spinner{
          display:inline-block;width:14px;height:14px;border-radius:50%;
          border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;
          animation:spin .7s linear infinite;
        }
        @keyframes shakeX{
          0%,100%{transform:translateX(0);}
          20%{transform:translateX(-4px);}
          40%{transform:translateX(4px);}
          60%{transform:translateX(-3px);}
          80%{transform:translateX(3px);}
        }
        .field-shake{animation:shakeX .32s ease;}
        .station-row{display:grid;grid-template-columns:1fr 64px 1fr;align-items:start;}
        .station-row.left .station-card{grid-column:1;justify-self:end;text-align:right;}
        .station-row.right .station-card{grid-column:3;justify-self:start;text-align:left;}
        .station-node{grid-column:2;justify-self:center;}
        @media(max-width:760px){
          .station-row{grid-template-columns:40px 1fr !important;}
          .station-row.left .station-card, .station-row.right .station-card{
            grid-column:2 !important;justify-self:start !important;text-align:left !important;
          }
          .station-node{grid-column:1 !important;}
          .hero-title{font-size:24px !important;}
          .go-btn{padding:19px 20px !important;}
          .go-btn .go-btn-label{display:none;}
          .departures-grid{grid-template-columns:1fr !important;}
          .repo-row{flex-direction:column !important;align-items:flex-start !important;}
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        width: "100%", borderBottom: `1px solid ${TRACK}`,
        padding: `14px ${CONTAINER_PAD}`, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        background: "rgba(245,247,242,0.92)", backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", border: `2px solid ${ROUTE}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: ROUTE }} />
          </div>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, letterSpacing: "-0.3px" }}>Ziply</span>
        </div>
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="gh-btn" style={{
          display: "flex", alignItems: "center", gap: 6, background: ROUTE, color: "#fff",
          borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500,
          textDecoration: "none", transition: "background .15s",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          GitHub
        </a>
      </nav>

      {/* ORIGIN — hero */}
      <Band bg={PAPER} padding="clamp(28px,4vw,48px) 0 clamp(48px,6vw,72px)">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.15em",
            color: ROUTE, fontWeight: 600, marginBottom: 14,
          }}>
            ORIGIN → DESTINATION
          </div>

          <h1 className="hero-title" style={{
            fontFamily: "'Fraunces', serif", fontWeight: 600, color: INK,
            fontSize: "clamp(26px, 3.4vw, 40px)", lineHeight: 1.15,
            letterSpacing: "-0.4px", marginBottom: 14, maxWidth: 640,
          }}>
            The shortest path between a URL and a click.
          </h1>
          <p style={{ color: MUTE, fontSize: 16, lineHeight: 1.6, marginBottom: 30, maxWidth: 520 }}>
            Ziply turns any link into a Snowflake-ID-backed short code, cached in Redis for
            sub-millisecond redirects — built to carry real traffic, not a toy demo.
          </p>

          <div style={{ width: "100%", maxWidth: 660 }}>
            <label htmlFor="ziply-url-input" style={{
              fontSize: 12, fontWeight: 600, color: INK, display: "block", marginBottom: 8,
              textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Paste your URL
            </label>
            <div className="input-row" style={{ display: "flex", gap: 10 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                <input
                  id="ziply-url-input"
                  ref={inputRef}
                  value={longUrl}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="https://en.wikipedia.org/wiki/..."
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  inputMode="url"
                  aria-invalid={!!urlError}
                  aria-describedby={fieldMessage ? "ziply-field-message" : undefined}
                  className={urlError ? "field-shake" : ""}
                  style={{
                    width: "100%", padding: "19px 50px 19px 22px",
                    border: `1.5px solid ${urlError ? "#D8836E" : (inputFocused ? ROUTE : TRACK)}`,
                    borderRadius: 12, fontSize: 17, fontFamily: "'Inter', sans-serif",
                    outline: "none", color: INK, background: "#FFFFFF",
                    transition: "border-color .15s",
                  }}
                />
                <button
                  type="button"
                  onClick={handleFieldAction}
                  className="field-action-btn"
                  aria-label={longUrl.trim() ? "Clear URL" : "Paste from clipboard"}
                  title={longUrl.trim() ? "Clear" : "Paste"}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    width: 34, height: 34, borderRadius: 8, border: "none",
                    background: "transparent", color: MUTE, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background .15s, color .15s",
                  }}
                >
                  {longUrl.trim() ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="8" y="2" width="8" height="4" rx="1" />
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    </svg>
                  )}
                </button>
              </div>
              <button onClick={handleShorten} disabled={loading} className="go-btn" style={{
                background: ROUTE, color: "#fff", border: "none", borderRadius: 12,
                padding: "19px 32px", fontSize: 17, fontWeight: 650,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                transition: "all .15s", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {loading ? (
                  <><span className="spinner" /><span className="go-btn-label">Shortening</span></>
                ) : (
                  <><span className="go-btn-label">Shorten</span> →</>
                )}
              </button>
            </div>

            {fieldMessage && (
              <div id="ziply-field-message" role="alert" style={{
                background: "#FDF1EE", border: "1px solid #F0C9BE", borderRadius: 8,
                padding: "10px 14px", fontSize: 13, color: "#B4472E", marginTop: 10, textAlign: "left",
              }}>
                {fieldMessage}
              </div>
            )}

            {!fieldMessage && (
              <div style={{ fontSize: 12, color: MUTE, marginTop: 10, textAlign: "left" }}>
                Press Enter to shorten · nothing is saved until you do
              </div>
            )}

            {typedShort && (
              <div style={{
                position: "relative", background: "#FFFFFF", border: `1.5px solid ${ROUTE}`,
                borderRadius: 14, marginTop: 20, textAlign: "left", overflow: "visible",
                boxShadow: "0 6px 20px rgba(31,109,69,0.08)",
              }}>
                <div style={{ padding: "14px 20px 12px" }}>
                  <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: MUTE, marginBottom: 4 }}>FROM</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: MUTE }}>{truncatedLong}</div>
                </div>

                <div style={{ position: "relative", height: 0, borderTop: `1.5px dashed ${TRACK}`, margin: "0 0" }}>
                  <div style={{ position: "absolute", left: -9, top: -9, width: 18, height: 18, borderRadius: "50%", background: PAPER }} />
                  <div style={{ position: "absolute", right: -9, top: -9, width: 18, height: 18, borderRadius: "50%", background: PAPER }} />
                </div>

                <div style={{ padding: "14px 20px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: MUTE, marginBottom: 4 }}>TO</div>
                    <a href={typedShort} target="_blank" rel="noopener noreferrer" style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 600,
                      color: ROUTE, textDecoration: "none", wordBreak: "break-all",
                    }}>
                      {typedShort}
                    </a>
                  </div>
                  <button onClick={handleCopy} className="copy-btn" style={{
                    background: "#EAF5EE", border: "none", borderRadius: 8, padding: "9px 16px",
                    fontSize: 12, fontWeight: 600, color: ROUTE_DARK, cursor: "pointer",
                    transition: "background .15s", whiteSpace: "nowrap", flexShrink: 0,
                  }}>
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Band>

      {/* ROUTE — station timeline */}
      <Band bg={PAPER} padding="clamp(24px,4vw,40px) 0 clamp(56px,7vw,88px)">
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.15em", color: ROUTE, fontWeight: 600, marginBottom: 12 }}>
            THE ROUTE
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: "clamp(24px,3vw,32px)" }}>
            Five stops, every redirect
          </div>
        </div>

        <div style={{ position: "relative" }}>
          {STATIONS.map((s, i) => {
            const side = i % 2 === 0 ? "left" : "right";
            const isOpen = openStation === i;
            return (
              <div key={s.n} className={`station-row ${side}`} style={{ position: "relative", minHeight: 40 }}>
                {/* track segment */}
                <div style={{
                  position: "absolute",
                  left: "calc(50% - 1px)", top: 0, bottom: i === STATIONS.length - 1 ? "50%" : 0,
                  width: 2, background: TRACK, zIndex: 0,
                }} className="station-track-desktop" />

                <div className="station-node" style={{ position: "relative", zIndex: 1, paddingTop: 4 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: PAPER,
                    border: `2.5px solid ${ROUTE}`, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: ROUTE,
                  }}>
                    {s.n}
                  </div>
                </div>

                <div className="station-card" style={{ paddingBottom: 44, maxWidth: 460 }}>
                  <Reveal from={side === "left" ? "left" : "right"}>
                    <div>
                      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 19, marginBottom: 8 }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: 14, color: MUTE, lineHeight: 1.65, marginBottom: 12 }}>
                        {s.body}
                      </div>

                      {s.charset && (
                        <div style={{
                          display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                          color: ROUTE_DARK, background: "#EAF5EE", padding: "5px 12px", borderRadius: 6,
                        }}>{s.charset}</div>
                      )}
                      {s.formula && (
                        <div style={{
                          display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                          color: ROUTE_DARK, background: "#EAF5EE", padding: "5px 12px", borderRadius: 6,
                        }}>{s.formula}</div>
                      )}

                      {s.snippet && (
                        <div>
                          <button
                            className="station-toggle"
                            onClick={() => setOpenStation(isOpen ? null : i)}
                            style={{
                              background: "none", border: "none", cursor: "pointer", padding: 0,
                              fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600,
                              color: INK, display: "flex", alignItems: "center", gap: 6,
                              justifyContent: side === "left" ? "flex-end" : "flex-start",
                              width: "100%", transition: "color .15s",
                            }}
                          >
                            {isOpen ? "▾" : "▸"} {s.snippet.label}
                          </button>
                          {isOpen && (
                            <div style={{
                              marginTop: 10, background: "#152A1D", borderRadius: 10,
                              padding: "16px 18px", overflowX: "auto", textAlign: "left",
                            }}>
                              <CodeBlock code={s.snippet.code} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Reveal>
                </div>
              </div>
            );
          })}
        </div>
      </Band>

      {/* TERMINUS — departures board */}
      <Band bg="#12201A" padding="clamp(56px,7vw,84px) 0">
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.15em", color: "#8FE0AE", fontWeight: 600, marginBottom: 10 }}>
              TERMINUS
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: "clamp(24px,3vw,32px)", color: "#F2F7F3" }}>
              Live departures
            </div>
          </div>

          <div style={{
            maxWidth: 720, margin: "0 auto", background: "#0E1B14",
            border: "1px solid #24402F", borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px", borderBottom: "1px solid #24402F",
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6FA985", letterSpacing: "0.1em" }}>
                BOARD 01 · REDIRECT SERVICE
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8FE0AE" }}>
                <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#8FE0AE" }} />
                LIVE
              </span>
            </div>
            <div className="departures-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {DEPARTURES.map((d, i) => (
                <div key={d.label} style={{
                  padding: "22px 20px",
                  borderBottom: i < DEPARTURES.length - 2 ? "1px solid #1D3527" : "none",
                  borderRight: i % 2 === 0 ? "1px solid #1D3527" : "none",
                }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6FA985", letterSpacing: "0.08em", marginBottom: 8 }}>
                    {d.label}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: AMBER }}>
                    {d.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </Band>

      {/* ROUTE MAP — repo card */}
      <Band bg="#FFFFFF" padding="clamp(56px,7vw,84px) 0" borderTop={`1px solid ${TRACK}`}>
        <Reveal>
          <div className="repo-row" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28,
            background: PAPER, border: `1.5px solid ${TRACK}`, borderRadius: 16, padding: "28px 32px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: "#FFFFFF",
                border: `1.5px solid ${TRACK}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill={ROUTE}>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>AyushSriva2598 / Ziply</div>
                <div style={{ fontSize: 13, color: MUTE, marginTop: 3 }}>Django · DRF · Redis · MySQL · Docker · Nginx</div>
              </div>
            </div>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="repo-btn" style={{
              fontSize: 13, color: ROUTE_DARK, fontWeight: 600, textDecoration: "none",
              background: "#FFFFFF", border: `1.5px solid ${ROUTE}`, padding: "10px 22px",
              borderRadius: 8, flexShrink: 0, transition: "all .15s",
            }}>
              View the map →
            </a>
          </div>
        </Reveal>
      </Band>

      {/* SOURCE — full tabbed code viewer */}
      <Band bg="#FFFFFF" padding="0 0 clamp(56px,7vw,84px)">
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.15em", color: ROUTE, fontWeight: 600, marginBottom: 10 }}>
            ON RECORD
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: "clamp(24px,3vw,32px)" }}>
            The full source, station by station
          </div>
        </div>

        <Reveal>
          <div style={{
            maxWidth: 820, margin: "0 auto", background: "#FFFFFF",
            border: `1.5px solid ${TRACK}`, borderRadius: 16, overflow: "hidden",
            boxShadow: "0 4px 20px rgba(31,109,69,0.06)",
          }}>
            <div style={{
              display: "flex", borderBottom: `1px solid ${TRACK}`,
              background: PAPER, padding: "0 8px", overflowX: "auto",
            }}>
              {SNIPPETS.map((s, i) => (
                <button key={i} className="station-toggle" onClick={() => setActiveSnippet(i)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "14px 18px", fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: activeSnippet === i ? ROUTE : MUTE,
                  fontWeight: activeSnippet === i ? 600 : 400,
                  borderBottom: activeSnippet === i ? `2px solid ${ROUTE}` : "2px solid transparent",
                  transition: "color .15s", marginBottom: -1, whiteSpace: "nowrap",
                }}>{s.label}</button>
              ))}
            </div>

            <div className="snippet-code" style={{
              padding: "24px 28px", background: "#152A1D", overflow: "auto",
              maxHeight: 420, minHeight: 280,
            }}>
              <CodeBlock code={SNIPPETS[activeSnippet].code} />
            </div>

            <div style={{ padding: "12px 24px", borderTop: `1px solid ${TRACK}`, display: "flex", justifyContent: "flex-end" }}>
              <a href={`${GITHUB_REPO}/blob/main/shortner/${SNIPPETS[activeSnippet].label}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: ROUTE, textDecoration: "none", fontFamily: "'JetBrains Mono', monospace" }}>
                View full file on GitHub →
              </a>
            </div>
          </div>
        </Reveal>
      </Band>

      <footer style={{ width: "100%", borderTop: `1px solid ${TRACK}`, background: "#FFFFFF" }}>
        <div style={{
          width: "100%", maxWidth: CONTAINER_MAX, margin: "0 auto", padding: `24px ${CONTAINER_PAD}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, color: MUTE, fontFamily: "'JetBrains Mono', monospace" }}>
            Ziply · end of the line · built by Ayush Srivastava
          </span>
          <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: ROUTE, textDecoration: "none", fontWeight: 500 }}>
            github.com/AyushSriva2598/Ziply
          </a>
        </div>
      </footer>
    </div>
  );
}