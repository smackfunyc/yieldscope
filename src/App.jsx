import { useState, useEffect, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const HL_API = "https://api.hyperliquid.xyz/info";
const DEFI_LLAMA_POOLS_URL = "https://yields.llama.fi/pools";
const CHAINS = ["All", "Ethereum", "Arbitrum", "Polygon", "BSC", "Optimism", "Avalanche", "Base", "Solana"];
const SORT_OPTIONS = [
  { key: "apy", label: "Highest APY" },
  { key: "tvlUsd", label: "Highest TVL" },
  { key: "apyMean30d", label: "Best 30d Avg" },
];

// ─── Utility ─────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n == null) return "$0";
  const v = Math.abs(n);
  if (v >= 1e9) return `${n < 0 ? "-" : ""}$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${n < 0 ? "-" : ""}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${n < 0 ? "-" : ""}$${(v / 1e3).toFixed(1)}K`;
  return `$${n?.toFixed(2) ?? "0"}`;
};

const fmtNum = (n, decimals = 2) => {
  if (n == null) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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

const shortenAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

// ─── Theme ───────────────────────────────────────────────────────────────────
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
  redGlow: "rgba(239, 68, 68, 0.12)",
  yellow: "#eab308",
  gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)",
  hlGradient: "linear-gradient(135deg, #00d4aa 0%, #00b894 50%, #009975 100%)",
};

// ─── Hyperliquid API helpers (read-only, no auth needed) ─────────────────────
async function hlFetch(body) {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getHlPerpsState(address) {
  return hlFetch({ type: "clearinghouseState", user: address });
}

async function getHlSpotBalances(address) {
  return hlFetch({ type: "spotClearinghouseState", user: address });
}

async function getHlOpenOrders(address) {
  return hlFetch({ type: "openOrders", user: address });
}

async function getHlUserFills(address) {
  return hlFetch({ type: "userFills", user: address });
}

async function getHlMeta() {
  return hlFetch({ type: "meta" });
}

async function getHlAllMids() {
  return hlFetch({ type: "allMids" });
}

// ─── Shared Components ───────────────────────────────────────────────────────

function Loader({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 12 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${theme.border}`, borderTop: `3px solid ${theme.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ color: theme.textMuted, fontSize: 13 }}>{text || "Loading…"}</span>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "18px 22px", flex: "1 1 180px", minWidth: 160 }}>
      <div style={{ fontSize: 11, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || theme.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Badge({ children, color }) {
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${color}18`, color, fontWeight: 600 }}>
      {children}
    </span>
  );
}

function PnlText({ value, size = 14 }) {
  const n = parseFloat(value) || 0;
  const color = n >= 0 ? theme.green : theme.red;
  return <span style={{ color, fontWeight: 700, fontSize: size }}>{n >= 0 ? "+" : ""}{fmtNum(n)}</span>;
}

// ─── Wallet Connect Button ──────────────────────────────────────────────────
function WalletConnect({ address, onConnect, onDisconnect, loading }) {
  const [input, setInput] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleMetaMask = async () => {
    if (typeof window.ethereum === "undefined") {
      alert("MetaMask not detected. Install it from metamask.io or paste your address manually below.");
      setShowInput(true);
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts[0]) onConnect(accounts[0]);
    } catch (e) {
      alert("Wallet connection cancelled. You can paste your address manually instead.");
      setShowInput(true);
    }
  };

  const handleManual = () => {
    const addr = input.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      onConnect(addr);
      setShowInput(false);
      setInput("");
    } else {
      alert("Please enter a valid Ethereum address (0x followed by 40 hex characters).");
    }
  };

  if (address) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ background: theme.greenGlow, border: `1px solid ${theme.green}40`, borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.green, boxShadow: `0 0 6px ${theme.green}` }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{shortenAddr(address)}</span>
        </div>
        <button onClick={onDisconnect} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: theme.textMuted, fontSize: 12, fontWeight: 500 }}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleMetaMask}
          disabled={loading}
          style={{
            background: theme.hlGradient,
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            cursor: loading ? "wait" : "pointer",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            transition: "all 0.15s",
            opacity: loading ? 0.7 : 1,
          }}
        >
          🦊 Connect MetaMask
        </button>
        <button
          onClick={() => setShowInput(!showInput)}
          style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: theme.textMuted, fontSize: 12, fontWeight: 500 }}
        >
          Or paste address
        </button>
      </div>
      {showInput && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="0x your Hyperliquid wallet address…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "9px 14px", color: theme.text, fontSize: 13, outline: "none", minWidth: 260 }}
          />
          <button onClick={handleManual} style={{ background: theme.accent, border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600 }}>
            Connect
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Hyperliquid Portfolio Tab ──────────────────────────────────────────────
function HLPortfolio({ address }) {
  const [perpsState, setPerpsState] = useState(null);
  const [spotState, setSpotState] = useState(null);
  const [openOrders, setOpenOrders] = useState([]);
  const [fills, setFills] = useState([]);
  const [mids, setMids] = useState({});
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState("overview");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [perps, spot, orders, userFills, allMids] = await Promise.all([
        getHlPerpsState(address),
        getHlSpotBalances(address),
        getHlOpenOrders(address),
        getHlUserFills(address),
        getHlAllMids(),
      ]);
      setPerpsState(perps);
      setSpotState(spot);
      setOpenOrders(orders || []);
      setFills((userFills || []).slice(0, 50));
      setMids(allMids || {});
    } catch (e) {
      console.error("HL fetch error:", e);
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll, autoRefresh]);

  if (loading) return <Loader text="Fetching Hyperliquid portfolio…" />;

  const margin = perpsState?.marginSummary || perpsState?.crossMarginSummary || {};
  const accountValue = parseFloat(margin.accountValue) || 0;
  const totalNtlPos = parseFloat(margin.totalNtlPos) || 0;
  const totalMarginUsed = parseFloat(margin.totalMarginUsed) || 0;
  const withdrawable = parseFloat(perpsState?.withdrawable) || 0;

  const positions = (perpsState?.assetPositions || [])
    .map((p) => p.position || p)
    .filter((p) => parseFloat(p.szi) !== 0);

  const spotBalances = (spotState?.balances || []).filter((b) => parseFloat(b.total) > 0);

  const totalUnrealizedPnl = positions.reduce((s, p) => s + (parseFloat(p.unrealizedPnl) || 0), 0);

  const subTabs = [
    { id: "overview", label: "Overview" },
    { id: "positions", label: `Positions (${positions.length})` },
    { id: "spot", label: `Spot (${spotBalances.length})` },
    { id: "orders", label: `Orders (${openOrders.length})` },
    { id: "history", label: "Trade History" },
  ];

  return (
    <div>
      {/* Auto-refresh toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 4, background: theme.surface, borderRadius: 10, padding: 3, border: `1px solid ${theme.border}` }}>
          {subTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                background: subTab === t.id ? theme.accent : "transparent",
                color: subTab === t.id ? "#fff" : theme.textMuted,
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={fetchAll} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: theme.textMuted, fontSize: 11 }}>
            ↻ Refresh
          </button>
          <label style={{ fontSize: 11, color: theme.textMuted, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} style={{ accentColor: theme.accent }} />
            Auto (10s)
          </label>
        </div>
      </div>

      {/* ─── Overview ─── */}
      {subTab === "overview" && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard label="Account Value" value={`$${fmtNum(accountValue)}`} color={theme.text} />
            <StatCard label="Unrealized PnL" value={<PnlText value={totalUnrealizedPnl} size={26} />} />
            <StatCard label="Margin Used" value={`$${fmtNum(totalMarginUsed)}`} sub={`${totalMarginUsed > 0 ? ((totalMarginUsed / accountValue) * 100).toFixed(1) : 0}% utilized`} />
            <StatCard label="Withdrawable" value={`$${fmtNum(withdrawable)}`} color={theme.green} />
          </div>

          {/* Quick position summary */}
          {positions.length > 0 && (
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 14 }}>Open Positions</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {positions.slice(0, 5).map((p, i) => {
                  const side = parseFloat(p.szi) > 0 ? "LONG" : "SHORT";
                  const sideColor = side === "LONG" ? theme.green : theme.red;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: theme.bg, borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{p.coin}</span>
                        <Badge color={sideColor}>{side}</Badge>
                        {p.leverage && <Badge color={theme.yellow}>{p.leverage.value}x</Badge>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: theme.textMuted }}>Size</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{fmtNum(Math.abs(parseFloat(p.szi)), 4)} ({fmt(parseFloat(p.positionValue || 0))})</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: theme.textMuted }}>Entry → Mark</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>${fmtNum(parseFloat(p.entryPx))} → ${fmtNum(parseFloat(mids[p.coin] || 0))}</div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 80 }}>
                          <div style={{ fontSize: 11, color: theme.textMuted }}>uPnL</div>
                          <PnlText value={p.unrealizedPnl} size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {positions.length > 5 && (
                  <button onClick={() => setSubTab("positions")} style={{ background: "none", border: "none", color: theme.accent, fontSize: 12, cursor: "pointer", padding: 4, fontWeight: 600 }}>
                    View all {positions.length} positions →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Spot balances quick view */}
          {spotBalances.length > 0 && (
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 14 }}>Spot Balances</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {spotBalances.map((b, i) => (
                  <div key={i} style={{ background: theme.bg, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 700, color: theme.text }}>{b.coin}</span>
                    <span style={{ color: theme.textMuted, fontSize: 13 }}>{fmtNum(parseFloat(b.total), 4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {positions.length === 0 && spotBalances.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: theme.textMuted, fontSize: 14 }}>
              No open positions or spot balances found for this address. If you have funds on Hyperliquid, make sure you're using the correct wallet address.
            </div>
          )}
        </>
      )}

      {/* ─── Positions Detail ─── */}
      {subTab === "positions" && (
        <div>
          {positions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>No open positions.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {positions.map((p, i) => {
                const side = parseFloat(p.szi) > 0 ? "LONG" : "SHORT";
                const sideColor = side === "LONG" ? theme.green : theme.red;
                const pnl = parseFloat(p.unrealizedPnl) || 0;
                const entryPx = parseFloat(p.entryPx) || 0;
                const markPx = parseFloat(mids[p.coin]) || 0;
                const liqPx = parseFloat(p.liquidationPx) || null;
                const posValue = parseFloat(p.positionValue) || 0;
                const returnPct = entryPx > 0 ? ((markPx - entryPx) / entryPx * 100 * (side === "LONG" ? 1 : -1)).toFixed(2) : "—";

                return (
                  <div key={i} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "18px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 18, color: theme.text }}>{p.coin}</span>
                        <Badge color={sideColor}>{side}</Badge>
                        {p.leverage && <Badge color={theme.yellow}>{p.leverage.value}x {p.leverage.type}</Badge>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <PnlText value={pnl} size={20} />
                        <div style={{ fontSize: 11, color: pnl >= 0 ? theme.green : theme.red }}>{returnPct}%</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                      <div><div style={{ fontSize: 10, color: theme.textMuted }}>Size</div><div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{fmtNum(Math.abs(parseFloat(p.szi)), 4)}</div></div>
                      <div><div style={{ fontSize: 10, color: theme.textMuted }}>Notional</div><div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{fmt(posValue)}</div></div>
                      <div><div style={{ fontSize: 10, color: theme.textMuted }}>Entry Price</div><div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>${fmtNum(entryPx)}</div></div>
                      <div><div style={{ fontSize: 10, color: theme.textMuted }}>Mark Price</div><div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>${fmtNum(markPx)}</div></div>
                      <div><div style={{ fontSize: 10, color: theme.textMuted }}>Liq. Price</div><div style={{ fontSize: 14, fontWeight: 600, color: liqPx ? theme.red : theme.textMuted }}>{liqPx ? `$${fmtNum(liqPx)}` : "—"}</div></div>
                      <div><div style={{ fontSize: 10, color: theme.textMuted }}>Margin Used</div><div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>${fmtNum(parseFloat(p.marginUsed) || 0)}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Spot Balances ─── */}
      {subTab === "spot" && (
        <div>
          {spotBalances.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>No spot balances.</div>
          ) : (
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Token", "Balance", "Hold", "Available"].map((h) => (
                      <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 11, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spotBalances.map((b, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: "12px 18px", fontWeight: 700, color: theme.text }}>{b.coin}</td>
                      <td style={{ padding: "12px 18px", color: theme.text }}>{fmtNum(parseFloat(b.total), 4)}</td>
                      <td style={{ padding: "12px 18px", color: theme.textMuted }}>{fmtNum(parseFloat(b.hold), 4)}</td>
                      <td style={{ padding: "12px 18px", color: theme.green }}>{fmtNum(parseFloat(b.total) - parseFloat(b.hold), 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Open Orders ─── */}
      {subTab === "orders" && (
        <div>
          {openOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>No open orders.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {openOrders.map((o, i) => (
                <div key={i} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{o.coin}</span>
                    <Badge color={o.side === "B" ? theme.green : theme.red}>{o.side === "B" ? "BUY" : "SELL"}</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    <div><div style={{ fontSize: 10, color: theme.textMuted }}>Price</div><div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>${fmtNum(parseFloat(o.limitPx))}</div></div>
                    <div><div style={{ fontSize: 10, color: theme.textMuted }}>Size</div><div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{o.sz}</div></div>
                    <div><div style={{ fontSize: 10, color: theme.textMuted }}>Order ID</div><div style={{ fontSize: 13, color: theme.textMuted }}>{o.oid}</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Trade History ─── */}
      {subTab === "history" && (
        <div>
          {fills.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>No recent trades found.</div>
          ) : (
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Time", "Coin", "Side", "Price", "Size", "Direction", "PnL", "Fee"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.8, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fills.map((f, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: theme.textMuted, whiteSpace: "nowrap" }}>
                        {new Date(f.time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, color: theme.text }}>{f.coin}</td>
                      <td style={{ padding: "10px 14px" }}><Badge color={f.side === "B" ? theme.green : theme.red}>{f.side === "B" ? "BUY" : "SELL"}</Badge></td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: theme.text }}>${fmtNum(parseFloat(f.px))}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: theme.text }}>{f.sz}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: theme.textMuted }}>{f.dir}</td>
                      <td style={{ padding: "10px 14px" }}><PnlText value={f.closedPnl} size={12} /></td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: theme.textMuted }}>${fmtNum(parseFloat(f.fee), 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Yield Explorer Components (from v1) ─────────────────────────────────────

function YieldSimulator({ apy }) {
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
            <input type="number" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)}
              style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "7px 10px", color: theme.text, fontSize: 12, outline: "none" }} />
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))}
              style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "7px 8px", color: theme.text, fontSize: 12, outline: "none" }}>
              {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m < 12 ? `${m} mo` : `${m / 12} yr`}</option>)}
            </select>
          </div>
          {invested > 0 && (
            <div style={{ background: theme.greenGlow, border: `1px solid ${theme.green}30`, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 10, color: theme.textMuted }}>Est. Return</div><div style={{ fontSize: 14, fontWeight: 700, color: theme.green }}>+${profit.toFixed(2)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: theme.textMuted }}>Final Value</div><div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>${finalValue.toFixed(2)}</div></div>
            </div>
          )}
          <div style={{ fontSize: 9, color: theme.textMuted, fontStyle: "italic" }}>Simulated. Rates change. Not financial advice.</div>
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
            <Badge color={theme.accent}>{pool.chain}</Badge>
            <Badge color={riskColor(pool.apy)}>{riskLabel(pool.apy)} Risk</Badge>
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
      <YieldSimulator apy={pool.apy} />
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  // Wallet state
  const [hlAddress, setHlAddress] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // DeFi Llama state
  const [pools, setPools] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [poolsLoading, setPoolsLoading] = useState(true);
  const [poolsError, setPoolsError] = useState(null);
  const [chain, setChain] = useState("All");
  const [sort, setSort] = useState("apy");
  const [search, setSearch] = useState("");
  const [minTvl, setMinTvl] = useState(1_000_000);
  const [watchlist, setWatchlist] = useState([]);
  const [page, setPage] = useState(1);

  // Tab state
  const [tab, setTab] = useState("portfolio");

  // Fetch DeFi Llama pools
  useEffect(() => {
    setPoolsLoading(true);
    fetch(DEFI_LLAMA_POOLS_URL)
      .then((r) => r.json())
      .then((json) => {
        setPools((json.data || []).filter((p) => p.apy > 0 && p.tvlUsd > 100000));
        setPoolsLoading(false);
      })
      .catch(() => { setPoolsError("Failed to load yield data."); setPoolsLoading(false); });
  }, []);

  // Filter & sort pools
  useEffect(() => {
    let r = [...pools];
    if (chain !== "All") r = r.filter((p) => p.chain === chain);
    if (search) { const s = search.toLowerCase(); r = r.filter((p) => p.symbol?.toLowerCase().includes(s) || p.project?.toLowerCase().includes(s)); }
    r = r.filter((p) => p.tvlUsd >= minTvl);
    r.sort((a, b) => (b[sort] || 0) - (a[sort] || 0));
    setFiltered(r);
    setPage(1);
  }, [pools, chain, sort, search, minTvl]);

  const toggleWatchlist = (pool) => setWatchlist((prev) => prev.find((p) => p.pool === pool.pool) ? prev.filter((p) => p.pool !== pool.pool) : [...prev, pool]);
  const paginated = filtered.slice(0, page * 24);

  const selectStyle = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "9px 12px", color: theme.text, fontSize: 13, outline: "none" };

  const mainTabs = [
    { id: "portfolio", label: "⟡ Portfolio", accent: true },
    { id: "explore", label: "Explore Yields" },
    { id: "watchlist", label: `Watchlist (${watchlist.length})` },
    { id: "learn", label: "How It Works" },
  ];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${theme.bg}; font-family: 'DM Sans', sans-serif; color: ${theme.text}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        ::selection { background: ${theme.accent}40; }
        input:focus, select:focus { border-color: ${theme.accent} !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${theme.bg}; }
        ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }
        table { font-size: 13px; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 60px" }}>
        {/* Header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, background: theme.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>
              ⟡ YieldScope
            </h1>
            <p style={{ fontSize: 12, color: theme.textMuted }}>
              DeFi yield explorer + Hyperliquid portfolio tracker
            </p>
          </div>
          <WalletConnect
            address={hlAddress}
            onConnect={(addr) => { setHlAddress(addr); setTab("portfolio"); }}
            onDisconnect={() => setHlAddress(null)}
            loading={walletLoading}
          />
        </header>

        {/* Main Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: theme.surface, borderRadius: 12, padding: 4, border: `1px solid ${theme.border}`, width: "fit-content", flexWrap: "wrap" }}>
          {mainTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 18px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                background: tab === t.id ? (t.accent ? theme.hlGradient : theme.accent) : "transparent",
                color: tab === t.id ? "#fff" : theme.textMuted,
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Portfolio Tab ─── */}
        {tab === "portfolio" && (
          hlAddress ? (
            <HLPortfolio address={hlAddress} />
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⟡</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Connect Your Hyperliquid Wallet</h2>
              <p style={{ fontSize: 14, color: theme.textMuted, maxWidth: 500, margin: "0 auto 24px", lineHeight: 1.6 }}>
                Connect via MetaMask or paste your wallet address to view your live positions, balances, open orders, and trade history — all read-only and secure.
              </p>
              <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 24, maxWidth: 480, margin: "0 auto", textAlign: "left" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.accent, marginBottom: 12 }}>What you'll see:</h3>
                {["Account value and margin summary", "Open perp positions with live PnL", "Spot token balances", "Open orders", "Recent trade history with fees"].map((item, i) => (
                  <div key={i} style={{ padding: "6px 0", fontSize: 13, color: theme.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: theme.green }}>✓</span> {item}
                  </div>
                ))}
                <div style={{ marginTop: 16, padding: "10px 14px", background: theme.accentGlow, borderRadius: 10, fontSize: 12, color: theme.accent }}>
                  100% read-only — no transactions, no approvals, no risk to your funds.
                </div>
              </div>
            </div>
          )
        )}

        {/* ─── Explore Tab ─── */}
        {tab === "explore" && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <input placeholder="Search token or protocol…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ ...selectStyle, flex: "1 1 200px", minWidth: 180 }} />
              <select value={chain} onChange={(e) => setChain(e.target.value)} style={selectStyle}>
                {CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}>
                {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={minTvl} onChange={(e) => setMinTvl(Number(e.target.value))} style={selectStyle}>
                <option value={100_000}>TVL &gt; $100K</option>
                <option value={1_000_000}>TVL &gt; $1M</option>
                <option value={10_000_000}>TVL &gt; $10M</option>
                <option value={100_000_000}>TVL &gt; $100M</option>
              </select>
            </div>
            {poolsLoading ? <Loader text="Loading yield data…" /> : poolsError ? (
              <div style={{ color: theme.red, textAlign: "center", padding: 40 }}>{poolsError}</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {paginated.map((pool) => (
                    <PoolCard key={pool.pool} pool={pool} onAdd={toggleWatchlist} inWatchlist={!!watchlist.find((w) => w.pool === pool.pool)} />
                  ))}
                </div>
                {paginated.length < filtered.length && (
                  <div style={{ textAlign: "center", marginTop: 28 }}>
                    <button onClick={() => setPage((p) => p + 1)} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 28px", color: theme.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Load more ({filtered.length - paginated.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ─── Watchlist Tab ─── */}
        {tab === "watchlist" && (
          watchlist.length === 0 ? (
            <div style={{ color: theme.textMuted, fontSize: 13, textAlign: "center", padding: 30 }}>Click ☆ on any pool in Explore to add it here.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {watchlist.map((p) => (
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
                    <button onClick={() => setWatchlist((w) => w.filter((x) => x.pool !== p.pool))} style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: 6, padding: "3px 7px", cursor: "pointer", color: theme.red, fontSize: 11 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ─── Learn Tab ─── */}
        {tab === "learn" && (
          <div style={{ maxWidth: 640 }}>
            {[
              { q: "What is Yield Farming?", a: "Providing your crypto as liquidity to DeFi protocols in exchange for rewards. Like bank interest, but with higher potential returns and higher risk." },
              { q: "What is Hyperliquid?", a: "Hyperliquid is a high-performance decentralized exchange (DEX) for perpetual futures trading. It runs on its own L1 blockchain and offers sub-second execution, deep liquidity, and an on-chain order book — similar to a centralized exchange but fully decentralized." },
              { q: "What does this Portfolio tab show?", a: "It reads your Hyperliquid account data in real-time using their public API. You can see your account value, open perp positions with live PnL, spot balances, open orders, and trade history. It's 100% read-only — no transactions are ever made." },
              { q: "What does APY mean?", a: "Annual Percentage Yield — the projected yearly return with compounding. 10% APY means $1,000 could grow to ~$1,100 over a year if rates stay constant." },
              { q: "What is TVL?", a: "Total Value Locked — how much money is deposited. Higher TVL generally suggests more trust, but isn't a safety guarantee." },
              { q: "What are the risks?", a: "Smart contract bugs, impermanent loss, rug pulls, liquidation risk on leveraged positions, and market volatility. Higher returns almost always mean higher risk. Never invest more than you can afford to lose." },
            ].map((item, i) => (
              <div key={i} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: theme.accent }}>{item.q}</h3>
                <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>{item.a}</p>
              </div>
            ))}
            <div style={{ background: `${theme.red}12`, border: `1px solid ${theme.red}30`, borderRadius: 12, padding: "16px 20px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: theme.red }}>Disclaimer</h3>
              <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>Educational only. Not financial advice. DeFi and leveraged trading carry significant risk including total loss. DYOR. This tool does not execute trades or hold your funds.</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${theme.border}`, textAlign: "center", fontSize: 12, color: theme.textMuted }}>
          YieldScope · Yields by{" "}
          <a href="https://defillama.com" target="_blank" rel="noopener" style={{ color: theme.accent, textDecoration: "none" }}>DeFi Llama</a>
          {" · Portfolio by "}
          <a href="https://hyperliquid.xyz" target="_blank" rel="noopener" style={{ color: theme.accent, textDecoration: "none" }}>Hyperliquid API</a>
          {" · Not financial advice"}
        </footer>
      </div>
    </>
  );
}