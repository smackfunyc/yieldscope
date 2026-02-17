import { useState, useEffect } from "react";

const DEFI_LLAMA_POOLS_URL = "https://yields.llama.fi/pools";
const CHAINS = ["All", "Ethereum", "Arbitrum", "Polygon", "BSC", "Optimism", "Avalanche", "Base", "Solana"];
const SORT_OPTIONS = [
  { key: "apy", label: "Highest APY" },
  { key: "tvlUsd", label: "Highest TVL" },
  { key: "apyMean30d", label: "Best 30d Avg" },
];

const fmt = (n) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n?.toFixed(2) ?? "0"}`;
};

const riskColor = (apy) => {
  if (apy < 5) return "#22c55e";
  if (apy < 20) return "#eab308";
  if (apy < 50) return "#f97316";
  return "#ef4444";
};

const riskLabel = (apy) => {
  if (apy < 5) return "Low";
  if (apy < 20) return "Medium";
  if (apy < 50) return "High";
  return "Very High";
};

const theme = {
  bg: "#0a0b0f",
  surface: "#12131a",
  surfaceHover: "#1a1b25",
  border: "#1e2030",
  borderHover: "#2a2d45",
  text: "#e2e4ed",
  textMuted: "#6b7094",
  accent: "#6366f1",
  accentGlow: "rgba(99, 102, 241, 0.15)",
  green: "#22c55e",
  greenGlow: "rgba(34, 197, 94, 0.12)",
  red: "#ef4444",
  gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)",
};

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "16px 20px", flex: "1 1 160px", minWidth: 140 }}>
      <div style={{ fontSize: 11, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || theme.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function YieldSim({ apy }) {
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState(12);
  const [open, setOpen] = useState(false);
  const invested = parseFloat(amount) || 0;
  const days = months * 30;
  const finalValue = invested * Math.pow(1 + apy / 100 / 365, days);
  const profit = finalValue - invested;

  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
      <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: theme.accent, fontSize: 12, cursor: "pointer", padding: 0, fontWeight: 600 }}>
        {open ? "▾" : "▸"} Yield Simulator
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="number" placeholder="Amount ($)" value={amount} onChange={e => setAmount(e.target.value)}
              style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "7px 10px", color: theme.text, fontSize: 12, outline: "none" }} />
            <select value={months} onChange={e => setMonths(Number(e.target.value))}
              style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "7px 8px", color: theme.text, fontSize: 12, outline: "none" }}>
              {[1,3,6,12,24].map(m => <option key={m} value={m}>{m < 12 ? `${m} mo` : `${m/12} yr`}</option>)}
            </select>
          </div>
          {invested > 0 && (
            <div style={{ background: theme.greenGlow, border: `1px solid ${theme.green}30`, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 10, color: theme.textMuted }}>Est. Return</div><div style={{ fontSize: 14, fontWeight: 700, color: theme.green }}>+${profit.toFixed(2)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: theme.textMuted }}>Final Value</div><div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>${finalValue.toFixed(2)}</div></div>
            </div>
          )}
          <div style={{ fontSize: 9, color: theme.textMuted, fontStyle: "italic" }}>⚠ Simulated. Rates change. Not financial advice.</div>
        </div>
      )}
    </div>
  );
}

function PoolCard({ pool, onAdd, inWatchlist }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? theme.surfaceHover : theme.surface, border: `1px solid ${hover ? theme.borderHover : theme.border}`, borderRadius: 14, padding: "16px 20px", transition: "all 0.2s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 4 }}>{pool.symbol}</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: theme.accentGlow, color: theme.accent, fontWeight: 600 }}>{pool.chain}</span>
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: `${riskColor(pool.apy)}18`, color: riskColor(pool.apy), fontWeight: 600 }}>{riskLabel(pool.apy)} Risk</span>
          </div>
        </div>
        <button onClick={() => onAdd(pool)} style={{ background: inWatchlist ? theme.accentGlow : "transparent", border: `1px solid ${inWatchlist ? theme.accent : theme.border}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: inWatchlist ? theme.accent : theme.textMuted, fontSize: 15 }}>
          {inWatchlist ? "★" : "☆"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><div style={{ fontSize: 10, color: theme.textMuted }}>APY</div><div style={{ fontSize: 20, fontWeight: 700, color: theme.green }}>{pool.apy?.toFixed(2)}%</div></div>
        <div><div style={{ fontSize: 10, color: theme.textMuted }}>TVL</div><div style={{ fontSize: 16, fontWeight: 600, color: theme.text }}>{fmt(pool.tvlUsd)}</div></div>
        <div><div style={{ fontSize: 10, color: theme.textMuted }}>30d Avg</div><div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{pool.apyMean30d?.toFixed(2) ?? "—"}%</div></div>
        <div><div style={{ fontSize: 10, color: theme.textMuted }}>Protocol</div><div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{pool.project}</div></div>
      </div>
      <YieldSim apy={pool.apy} />
    </div>
  );
}

export default function App() {
  const [pools, setPools] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chain, setChain] = useState("All");
  const [sort, setSort] = useState("apy");
  const [search, setSearch] = useState("");
  const [minTvl, setMinTvl] = useState(1000000);
  const [watchlist, setWatchlist] = useState([]);
  const [tab, setTab] = useState("explore");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(DEFI_LLAMA_POOLS_URL).then(r => r.json()).then(json => {
      setPools((json.data || []).filter(p => p.apy > 0 && p.tvlUsd > 100000));
      setLoading(false);
    }).catch(() => { setError("Failed to load. Refresh the page."); setLoading(false); });
  }, []);

  useEffect(() => {
    let r = [...pools];
    if (chain !== "All") r = r.filter(p => p.chain === chain);
    if (search) { const s = search.toLowerCase(); r = r.filter(p => p.symbol?.toLowerCase().includes(s) || p.project?.toLowerCase().includes(s)); }
    r = r.filter(p => p.tvlUsd >= minTvl);
    r.sort((a, b) => (b[sort] || 0) - (a[sort] || 0));
    setFiltered(r);
    setPage(1);
  }, [pools, chain, sort, search, minTvl]);

  const toggle = (pool) => setWatchlist(prev => prev.find(p => p.pool === pool.pool) ? prev.filter(p => p.pool !== pool.pool) : [...prev, pool]);
  const paginated = filtered.slice(0, page * 24);
  const topApy = filtered[0]?.apy?.toFixed(1) ?? "—";
  const avgApy = filtered.length ? (filtered.reduce((s, p) => s + p.apy, 0) / filtered.length).toFixed(1) : "—";
  const totalTvl = filtered.reduce((s, p) => s + (p.tvlUsd || 0), 0);

  const selectStyle = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "9px 12px", color: theme.text, fontSize: 13, outline: "none" };

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: theme.text }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 60px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, background: theme.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>⟡ YieldScope</h1>
            <p style={{ fontSize: 12, color: theme.textMuted }}>Real-time DeFi yield explorer · DeFi Llama</p>
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, background: theme.surface, padding: "6px 12px", borderRadius: 8, border: `1px solid ${theme.border}` }}>
            {pools.length.toLocaleString()} pools
          </div>
        </header>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard label="Top APY" value={`${topApy}%`} color={theme.green} />
          <StatCard label="Avg APY" value={`${avgApy}%`} />
          <StatCard label="Total TVL" value={fmt(totalTvl)} sub={`${filtered.length} pools`} />
          <StatCard label="Watchlist" value={watchlist.length} color={theme.accent} />
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: theme.surface, borderRadius: 10, padding: 3, border: `1px solid ${theme.border}`, width: "fit-content" }}>
          {["explore", "watchlist", "learn"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === t ? theme.accent : "transparent", color: tab === t ? "#fff" : theme.textMuted }}>
              {t === "explore" ? "Explore" : t === "watchlist" ? `Watchlist (${watchlist.length})` : "How It Works"}
            </button>
          ))}
        </div>

        {tab === "explore" && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <input placeholder="Search token or protocol…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...selectStyle, flex: "1 1 200px", minWidth: 180 }} />
              <select value={chain} onChange={e => setChain(e.target.value)} style={selectStyle}>
                {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={sort} onChange={e => setSort(e.target.value)} style={selectStyle}>
                {SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={minTvl} onChange={e => setMinTvl(Number(e.target.value))} style={selectStyle}>
                <option value={100000}>TVL &gt; $100K</option>
                <option value={1000000}>TVL &gt; $1M</option>
                <option value={10000000}>TVL &gt; $10M</option>
                <option value={100000000}>TVL &gt; $100M</option>
              </select>
            </div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: theme.textMuted }}>Loading yield data…</div>
            ) : error ? (
              <div style={{ color: theme.red, textAlign: "center", padding: 40 }}>{error}</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {paginated.map(pool => (
                    <PoolCard key={pool.pool} pool={pool} onAdd={toggle} inWatchlist={!!watchlist.find(w => w.pool === pool.pool)} />
                  ))}
                </div>
                {paginated.length < filtered.length && (
                  <div style={{ textAlign: "center", marginTop: 28 }}>
                    <button onClick={() => setPage(p => p + 1)} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 28px", color: theme.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Load more ({filtered.length - paginated.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "watchlist" && (
          watchlist.length === 0 ? (
            <div style={{ color: theme.textMuted, fontSize: 13, textAlign: "center", padding: 30 }}>Click ☆ on any pool to add it here.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {watchlist.map(p => (
                <div key={p.pool} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "12px 16px" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: theme.text }}>{p.symbol}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted }}>{p.chain} · {p.project}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: theme.green }}>{p.apy?.toFixed(2)}%</div>
                      <div style={{ fontSize: 10, color: theme.textMuted }}>{fmt(p.tvlUsd)}</div>
                    </div>
                    <button onClick={() => setWatchlist(w => w.filter(x => x.pool !== p.pool))} style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: 6, padding: "3px 7px", cursor: "pointer", color: theme.red, fontSize: 11 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "learn" && (
          <div style={{ maxWidth: 640 }}>
            {[
              { q: "What is Yield Farming?", a: "Providing your crypto as liquidity to DeFi protocols in exchange for rewards. Like bank interest, but with higher potential returns and higher risk." },
              { q: "What does APY mean?", a: "Annual Percentage Yield — the projected yearly return with compounding. 10% APY means $1,000 could grow to ~$1,100 over a year if rates stay constant." },
              { q: "What is TVL?", a: "Total Value Locked — how much money is deposited. Higher TVL generally suggests more trust, but isn't a safety guarantee." },
              { q: "What are the risks?", a: "Smart contract bugs, impermanent loss, rug pulls, and market volatility. Higher APY almost always means higher risk." },
              { q: "How do I actually start?", a: "1) Get a wallet (MetaMask). 2) Buy crypto on Coinbase or similar. 3) Transfer to wallet. 4) Connect to a DeFi protocol. 5) Deposit into a pool. Start small." },
            ].map((item, i) => (
              <div key={i} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: theme.accent }}>{item.q}</h3>
                <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>{item.a}</p>
              </div>
            ))}
            <div style={{ background: `${theme.red}12`, border: `1px solid ${theme.red}30`, borderRadius: 12, padding: "16px 20px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: theme.red }}>⚠ Disclaimer</h3>
              <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>Educational only. Not financial advice. DeFi carries significant risk including total loss. DYOR.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
