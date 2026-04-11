import { useState, useRef, useEffect, useMemo } from "react";
import { TYPES } from "../constants";
import Graph from "./Graph";
import AnalysisTab from "./AnalysisTab";
import DataTab from "./DataTab";

export default function NetworkPhase({
  nodes, edges, positions, posRef, onDragNode, selected, setSelected, influence, analysed,
  newLabel, setNewLabel, newType, setNewType, addNode, removeNode,
  tab, setTab, steps, anaLoading, anaError, report, showRaw, setShowRaw,
  problem, onAnalyze, onReanalyse, supplementSections, addSourceQuick,
  screenshotting, takeScreenshot, onResize,
  fullPanelRef, networkPanelRef, analysisPanelRef
}) {
  const graphContainerRef = useRef(null);
  const [W, setW] = useState(900);
  const [H, setH] = useState(600);
  const [corrThreshold, setCorrThreshold] = useState(0.01);

  useEffect(() => {
    const update = () => {
      if (graphContainerRef.current) {
        const w = graphContainerRef.current.clientWidth || 900;
        const h = graphContainerRef.current.clientHeight || 600;
        setW(w);
        setH(h);
        onResize?.(w, h);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (graphContainerRef.current) ro.observe(graphContainerRef.current);
    return () => ro.disconnect();
  }, [tab]);

  return (
    <div ref={fullPanelRef} style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <aside style={{ width: 220, background: "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.05)", padding: 14, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#334155", marginBottom: 8 }}>Factor toevoegen</label>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addNode()} placeholder="Naam factor\u2026"
            style={{ width: "100%", padding: "7px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 7, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 6, fontFamily: "sans-serif" }} />
          <select value={newType} onChange={e => setNewType(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", background: "#0d1225", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 7, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 6 }}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={addNode} style={{ width: "100%", padding: "7px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 7, color: "#f59e0b", fontSize: 12, cursor: "pointer" }}>+ Toevoegen</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#334155", marginBottom: 8 }}>Legenda</label>
          {Object.entries(TYPES).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#475569" }}>{v.label}</span>
            </div>
          ))}
        </div>

        {nodes.length > 0 && (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#334155", marginBottom: 8 }}>Factoren ({nodes.length})</label>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {nodes.map(n => {
                const inf = influence?.[n.label];
                return (
                  <div key={n.id} onClick={() => setSelected(selected === n.id ? null : n.id)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 7px", borderRadius: 6, marginBottom: 3, cursor: "pointer", background: selected === n.id ? "rgba(255,255,255,0.07)" : "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", flex: 1 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: TYPES[n.type]?.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#94a3b8", flex: 1, lineHeight: 1.4, wordBreak: "break-word" }}>{n.label}</span>
                      {inf != null && <span style={{ fontSize: 9, color: TYPES[n.type]?.color, flexShrink: 0 }}>{(inf * 100).toFixed(0)}%</span>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeNode(n.id); }} style={{ background: "none", border: "none", color: "#1e293b", cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 4 }}>&times;</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button onClick={() => onAnalyze(nodes)} disabled={anaLoading || nodes.length < 2}
          style={{ width: "100%", padding: "10px", background: nodes.length >= 2 ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "#1e293b",
            border: "none", borderRadius: 8, color: nodes.length >= 2 ? "#fff" : "#334155", fontSize: 13,
            fontWeight: 600, cursor: nodes.length < 2 ? "not-allowed" : "pointer",
            boxShadow: nodes.length >= 2 ? "0 4px 16px rgba(124,58,237,0.35)" : "none" }}>
          {anaLoading ? "Analyseren\u2026" : "\ud83d\udd2c AI Analyse"}
        </button>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0 14px", gap: 8 }}>
          <div style={{ display: "flex", flex: 1 }}>
            {["graph", "analysis", "data"].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: "11px 16px", background: "none", border: "none",
                  borderBottom: "2px solid " + (tab === t ? "#f59e0b" : "transparent"),
                  color: tab === t ? "#f59e0b" : "#334155", fontSize: 12, cursor: "pointer", marginBottom: -1 }}>
                {t === "graph" ? "\ud83d\udd78 Netwerk" : t === "analysis" ? "\ud83d\udccb Analyse" : "\ud83d\udcca Data export"}
              </button>
            ))}
          </div>
          {tab === "graph" && analysed && edges.length > 0 && (() => {
            const visible = edges.filter(e => (e.correlation ?? 0) >= corrThreshold).length;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
                <span style={{ fontSize: 10, color: "#334155", whiteSpace: "nowrap" }}>r &ge;</span>
                <input type="range" min="0.01" max="1.00" step="0.01"
                  value={corrThreshold}
                  onChange={e => setCorrThreshold(parseFloat(e.target.value))}
                  style={{ width: 180, accentColor: "#f59e0b", cursor: "pointer" }} />
                <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, minWidth: 28 }}>{corrThreshold.toFixed(2)}</span>
                <span style={{ fontSize: 10, color: "#334155", whiteSpace: "nowrap" }}>({visible}/{edges.length})</span>
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 6, paddingLeft: 12 }}>
            {tab === "graph" && nodes.length > 0 && (
              <>
                <button disabled={screenshotting} onClick={() => takeScreenshot(networkPanelRef, "CausalNet_netwerk")}
                  title="Screenshot alleen netwerk"
                  style={{ padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#64748b", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  {"\ud83d\udcf7"} Netwerk
                </button>
                <button disabled={screenshotting} onClick={() => takeScreenshot(fullPanelRef, "CausalNet_volledig")}
                  title="Screenshot netwerk + zijbalk"
                  style={{ padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#64748b", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  {"\ud83d\udcf7"} Volledig
                </button>
              </>
            )}
            {tab === "analysis" && report && (
              <button disabled={screenshotting} onClick={() => takeScreenshot(analysisPanelRef, "CausalNet_analyse")}
                title="Screenshot analyse tekst"
                style={{ padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#64748b", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {"\ud83d\udcf7"} Analyse
              </button>
            )}
            {screenshotting && <span style={{ fontSize: 10, color: "#475569", alignSelf: "center" }}>{"\u23f3"}</span>}
          </div>
        </div>

        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Network graph — always rendered for PDF capture */}
          <div ref={networkPanelRef} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at center,#0d1630,#080d1a)" }}>
            <div ref={graphContainerRef} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {nodes.length === 0
                ? <div style={{ textAlign: "center" }}><div style={{ fontSize: 44 }}>{"\ud83d\udd78\ufe0f"}</div><p style={{ color: "#334155", fontSize: 13, marginTop: 10 }}>Geen factoren.</p></div>
                : <Graph nodes={nodes}
                    edges={analysed ? edges.filter(e => (e.correlation ?? 0) >= corrThreshold) : edges}
                    positions={positions} posRef={posRef} onDragNode={onDragNode}
                    selected={selected} onSelect={setSelected}
                    influence={influence} W={W} H={H} analysed={analysed} />
              }
            </div>
          </div>

          {/* Other tabs overlay on top */}
          {tab === "analysis" && (
            <div style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "auto", background: "#080d1a" }}>
              <AnalysisTab nodes={nodes} steps={steps} anaError={anaError} anaLoading={anaLoading}
                report={report} showRaw={showRaw} setShowRaw={setShowRaw}
                influence={influence} analysed={analysed} onReanalyse={onReanalyse}
                analysisPanelRef={analysisPanelRef} networkPanelRef={networkPanelRef} problem={problem}
                supplementSections={supplementSections} addSourceQuick={addSourceQuick} />
            </div>
          )}

          {tab === "data" && (
            <div style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "auto", background: "#080d1a" }}>
              <DataTab nodes={nodes} edges={edges} influence={influence} analysed={analysed} problem={problem} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
