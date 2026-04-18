import { useState, useRef, useEffect, useMemo } from "react";
import { TYPES } from "../constants";
import Graph from "./Graph";
import AnalysisTab from "./AnalysisTab";
import DataTab from "./DataTab";
import SolutionTabPanel from "./SolutionTabPanel";
import { exportAllPdfWhite, exportAllWord } from "../utils/exportWhite";

export default function NetworkPhase({
  nodes, edges, positions, posRef, onDragNode, selected, setSelected, influence, analysed,
  newLabel, setNewLabel, newType, setNewType, addNode, removeNode,
  tab, setTab, steps, anaLoading, anaError, report, showRaw, setShowRaw,
  problem, onAnalyze, onReanalyse, supplementSections, addSourceQuick,
  screenshotting, takeScreenshot, onResize,
  fullPanelRef, networkPanelRef, analysisPanelRef,
  subAnalyses, activeMainTab, setActiveMainTab, onSolutionAnalyse, onProblemAnalyse, onMergeToggle, onVisibleToggle, onCloseSubTab, onDragSubNode,
  onRerunSubAnalysis
}) {
  const graphContainerRef  = useRef(null);
  const sliderTrackRef     = useRef(null);
  const isDraggingSlider   = useRef(false);
  const [W, setW] = useState(900);
  const [H, setH] = useState(600);
  const [corrThreshold, setCorrThreshold] = useState(0.01);
  const [hiddenNodes, setHiddenNodes] = useState(new Set());
  const [confirmClose, setConfirmClose] = useState(null); // subId to confirm closing
  const [pdfAllLoading, setPdfAllLoading] = useState(false);
  const [pdfShotsLoading, setPdfShotsLoading] = useState(false);
  const subPanelRefs = useRef({});

  // Custom vertical slider drag
  const SLIDER_H = 95;
  const applySliderY = (clientY) => {
    const rect = sliderTrackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setCorrThreshold(parseFloat(Math.max(0.01, Math.min(1.00, ratio)).toFixed(2)));
  };
  useEffect(() => {
    const onMove = e => { if (isDraggingSlider.current) applySliderY(e.clientY); };
    const onUp   = () => { isDraggingSlider.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const toggleNode = (id) => setHiddenNodes(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

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
      <aside onClick={() => setSelected(null)} style={{ width: 250, background: "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.05)", padding: 14, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#334155", marginBottom: 8 }}>Factor toevoegen</label>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addNode()} placeholder="Naam factor..."
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ display: "block", fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#334155" }}>Factoren ({nodes.length})</label>
              <button
                onClick={() => {
                  const allHidden = nodes.every(n => hiddenNodes.has(n.id));
                  if (allHidden) {
                    setHiddenNodes(new Set());
                  } else {
                    setHiddenNodes(new Set(nodes.map(n => n.id)));
                  }
                }}
                title={nodes.every(n => hiddenNodes.has(n.id)) ? "Alles tonen" : "Alles verbergen"}
                style={{ fontSize: 9, padding: "2px 7px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, color: "#475569", cursor: "pointer" }}
              >
                {nodes.every(n => hiddenNodes.has(n.id)) ? "Alles aan" : "Alles uit"}
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {nodes.map(n => {
                const inf = influence?.[n.label];
                const on = !hiddenNodes.has(n.id);
                const color = TYPES[n.type]?.color;
                return (
                  <div key={n.id} onClick={e => { e.stopPropagation(); setSelected(selected === n.id ? null : n.id); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 7px", borderRadius: 6, marginBottom: 3,
                      cursor: "pointer", background: selected === n.id ? "rgba(255,255,255,0.07)" : "transparent",
                      opacity: on ? 1 : 0.4, transition: "opacity 0.15s" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: on ? color : "#334155", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#94a3b8", flex: 1, lineHeight: 1.4, wordBreak: "break-word" }}>{n.label}</span>
                    {inf != null && <span style={{ fontSize: 9, color: color, flexShrink: 0 }}>{(inf * 100).toFixed(0)}%</span>}
                    {/* Toggle */}
                    <div onClick={e => { e.stopPropagation(); toggleNode(n.id); }}
                      title={on ? "Verbergen" : "Tonen"}
                      style={{ width: 24, height: 13, borderRadius: 7, flexShrink: 0, cursor: "pointer",
                        background: on ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${on ? "rgba(96,165,250,0.45)" : "rgba(255,255,255,0.1)"}`,
                        position: "relative", transition: "all 0.15s" }}>
                      <div style={{ position: "absolute", top: 2, left: on ? 11 : 2, width: 7, height: 7,
                        borderRadius: "50%", background: on ? "#60a5fa" : "#334155", transition: "all 0.15s" }} />
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeNode(n.id); }}
                      style={{ background: "none", border: "none", color: "#1e293b", cursor: "pointer", fontSize: 14, padding: 0, flexShrink: 0 }}>&times;</button>
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
          <div style={{ display: "flex", flex: 1, overflowX: "auto", alignItems: "center" }}>
            {["graph", "analysis", "data"].map(t => (
              <button key={t} onClick={() => { setTab(t); setActiveMainTab?.("main"); }}
                style={{ padding: "11px 16px", background: "none", border: "none",
                  borderBottom: "2px solid " + (activeMainTab === "main" && tab === t ? "#f59e0b" : "transparent"),
                  color: activeMainTab === "main" && tab === t ? "#f59e0b" : "#94a3b8", fontSize: 12, cursor: "pointer", marginBottom: -1, flexShrink: 0 }}>
                {t === "graph" ? "\ud83d\udd78 Netwerk" : t === "analysis" ? "\ud83d\udccb Analyse" : "\ud83d\udcca Data export"}
              </button>
            ))}
            {subAnalyses && subAnalyses.length > 0 && (
              <span style={{ color: "#1e293b", padding: "0 8px", fontSize: 14, flexShrink: 0 }}>|</span>
            )}
            {(subAnalyses || []).map(sub => (
              <div key={sub.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <button
                  onClick={() => setActiveMainTab?.(sub.id)}
                  style={{
                    padding: "11px 12px", border: "none",
                    borderBottom: "2px solid " + (activeMainTab === sub.id
                      ? (sub.analysisMode === "problems" ? "#f87171" : "#34d399")
                      : "transparent"),
                    background: sub.analysisMode === "problems"
                      ? (activeMainTab === sub.id ? "rgba(248,113,113,0.10)" : "rgba(220,38,38,0.04)")
                      : (activeMainTab === sub.id ? "rgba(52,211,153,0.10)" : "rgba(16,185,129,0.04)"),
                    color: activeMainTab === sub.id
                      ? (sub.analysisMode === "problems" ? "#fca5a5" : "#6ee7b7")
                      : (sub.analysisMode === "problems" ? "#c47a7a" : "#5a9e86"),
                    fontSize: 11, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap",
                    maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis",
                    borderRadius: activeMainTab === sub.id ? "4px 4px 0 0" : "4px 4px 0 0",
                    transition: "background 0.15s, color 0.15s"
                  }}
                >
                  {sub.analysisMode === "problems" ? "🔎" : "🔍"} {sub.factorLabel}
                </button>
                <button
                  onClick={() => setConfirmClose(sub.id)}
                  style={{
                    padding: "2px 4px", background: "none", border: "none",
                    color: "#334155", cursor: "pointer", fontSize: 13, marginLeft: -6, flexShrink: 0
                  }}
                  title="Sluiten"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
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
            {analysed && report && (
              <>
                <button
                  disabled={pdfAllLoading}
                  onClick={async () => {
                    setPdfAllLoading(true);
                    try {
                      await exportAllPdfWhite({ problem, nodes, edges, influence, report, supplementSections, subAnalyses });
                    } catch (e) { alert("PDF mislukt: " + e.message); }
                    setPdfAllLoading(false);
                  }}
                  title="Volledig overzichtsdocument als PDF (wit)"
                  style={{ padding: "5px 10px", background: "rgba(180,110,10,0.12)", border: "1px solid rgba(180,110,10,0.3)", borderRadius: 7, color: "#b46a0a", fontSize: 11, cursor: pdfAllLoading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                  {pdfAllLoading ? "⏳" : "📄"} Volledig PDF
                </button>
                <button
                  disabled={pdfShotsLoading}
                  onClick={async () => {
                    setPdfShotsLoading(true);
                    try {
                      if (!window.html2canvas) {
                        await new Promise((res, rej) => {
                          const s = document.createElement("script");
                          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                          s.onload = res; s.onerror = rej;
                          document.head.appendChild(s);
                        });
                      }
                      const shotOpts = { backgroundColor: "#080d1a", scale: 2, useCORS: true, allowTaint: true, logging: false };
                      const screenshots = { main: null, subs: {} };
                      // Hoofdnetwerk
                      const prevActive = activeMainTab;
                      if (prevActive && prevActive !== "main") setActiveMainTab("main");
                      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                      if (networkPanelRef.current) {
                        const c = await window.html2canvas(networkPanelRef.current, shotOpts);
                        screenshots.main = c.toDataURL("image/png");
                      }
                      // Sub-netwerken — tijdelijk zichtbaar maken
                      const analysedSubs = (subAnalyses || []).filter(s => s.analysed && s.nodes?.length);
                      for (const sub of analysedSubs) {
                        const el = subPanelRefs.current[sub.id];
                        if (!el) continue;
                        const prevDisplay = el.style.display;
                        el.style.display = "block";
                        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                        try {
                          const c = await window.html2canvas(el, shotOpts);
                          screenshots.subs[sub.id] = c.toDataURL("image/png");
                        } catch (_) { /* sla over */ }
                        el.style.display = prevDisplay;
                      }
                      if (prevActive && prevActive !== activeMainTab) setActiveMainTab(prevActive);
                      await exportAllPdfWhite({ problem, nodes, edges, influence, report, supplementSections, subAnalyses, screenshots });
                    } catch (e) { alert("PDF mislukt: " + e.message); }
                    setPdfShotsLoading(false);
                  }}
                  title="Volledig PDF inclusief schermopnames"
                  style={{ padding: "5px 10px", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 7, color: "#60a5fa", fontSize: 11, cursor: pdfShotsLoading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                  {pdfShotsLoading ? "⏳" : "📸"} PDF + screenshots
                </button>
                <button
                  onClick={() => {
                    try { exportAllWord({ problem, nodes, edges, influence, report, supplementSections, subAnalyses }); }
                    catch (e) { alert("Word export mislukt: " + e.message); }
                  }}
                  title="Volledig overzichtsdocument als Word"
                  style={{ padding: "5px 10px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 7, color: "#34d399", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                  📝 Volledig Word
                </button>
              </>
            )}
            {screenshotting && <span style={{ fontSize: 10, color: "#475569", alignSelf: "center" }}>{"\u23f3"}</span>}
          </div>
        </div>

        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

          {/* Solution tab panels — all mounted so node positions persist across tab switches */}
          {(subAnalyses || []).map(sub => {
            const isActive = activeMainTab === sub.id;
            return (
              <div key={sub.id}
                ref={el => { if (el) subPanelRefs.current[sub.id] = el; else delete subPanelRefs.current[sub.id]; }}
                style={{ position: "absolute", inset: 0, zIndex: 2, background: "#080d1a", display: isActive ? "block" : "none" }}>
                <SolutionTabPanel
                  sub={sub}
                  problem={problem}
                  apiKey={undefined}
                  onMergeToggle={() => onMergeToggle?.(sub.id)}
                  onVisibleToggle={() => onVisibleToggle?.(sub.id)}
                  onClose={() => onCloseSubTab?.(sub.id)}
                  onReanalyse={onRerunSubAnalysis ? (cfg) => onRerunSubAnalysis(sub.id, cfg) : undefined}
                />
              </div>
            );
          })}

          {/* Network graph — always rendered for PDF capture */}
          <div ref={networkPanelRef} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at center,#0d1630,#080d1a)" }}>

            {/* ── Custom vertical correlation slider ── */}
            {(!activeMainTab || activeMainTab === "main") && tab === "graph" && analysed && edges.length > 0 && (() => {
              const visible = edges.filter(e => (e.correlation ?? 0) >= corrThreshold).length;
              const thumbTop = (1 - (corrThreshold - 0.01) / 0.99) * SLIDER_H;
              return (
                <div style={{ position: "absolute", top: 10, left: 10, zIndex: 5,
                  background: "rgba(8,13,26,0.88)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "10px 10px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  userSelect: "none" }}>
                  <span style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>r ≥</span>
                  {/* Track */}
                  <div ref={sliderTrackRef}
                    style={{ position: "relative", width: 8, height: SLIDER_H,
                      background: "rgba(255,255,255,0.08)", borderRadius: 4, cursor: "pointer" }}
                    onMouseDown={e => {
                      e.preventDefault();
                      isDraggingSlider.current = true;
                      applySliderY(e.clientY);
                    }}
                    onClick={e => applySliderY(e.clientY)}>
                    {/* Filled portion below thumb */}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                      height: (SLIDER_H - thumbTop) + "px",
                      background: "rgba(245,158,11,0.25)", borderRadius: "0 0 4px 4px" }} />
                    {/* Thumb */}
                    <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)",
                      top: thumbTop - 6 + "px",
                      width: 14, height: 14, borderRadius: "50%", pointerEvents: "none",
                      background: "#f59e0b", boxShadow: "0 0 8px rgba(245,158,11,0.6)" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>{corrThreshold.toFixed(2)}</span>
                  <span style={{ fontSize: 9, color: "#334155" }}>{visible}/{edges.length}</span>
                </div>
              );
            })()}

            <div ref={graphContainerRef} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {nodes.length === 0
                ? <div style={{ textAlign: "center" }}><div style={{ fontSize: 44 }}>{"\ud83d\udd78\ufe0f"}</div><p style={{ color: "#334155", fontSize: 13, marginTop: 10 }}>Geen factoren.</p></div>
                : <Graph
                    nodes={nodes.filter(n => !hiddenNodes.has(n.id))}
                    edges={(analysed ? edges.filter(e => (e.correlation ?? 0) >= corrThreshold) : edges)
                      .filter(e => !hiddenNodes.has(e.from) && !hiddenNodes.has(e.to))}
                    positions={positions} posRef={posRef} onDragNode={onDragNode}
                    selected={selected} onSelect={setSelected}
                    influence={influence} W={W} H={H} analysed={analysed}
                    subNetworks={(subAnalyses || []).filter(s => s.merged && !hiddenNodes.has(s.factorId)).map(s => ({
                      factorId: s.factorId, nodes: s.nodes, edges: s.edges,
                      influence: s.influence, visible: s.subVisible, nodePositions: s.nodePositions || {},
                      analysisMode: s.analysisMode
                    }))}
                    onSolutionAnalyse={onSolutionAnalyse ? (nodeId) => {
                      const node = nodes.find(n => n.id === nodeId);
                      if (node) onSolutionAnalyse(node);
                    } : undefined}
                    onProblemAnalyse={onProblemAnalyse ? (nodeId) => {
                      const node = nodes.find(n => n.id === nodeId);
                      if (node) onProblemAnalyse(node);
                    } : undefined}
                    onDragSubNode={onDragSubNode}
                    showZoom={(!activeMainTab || activeMainTab === "main") && tab === "graph"}
                  />
              }
            </div>
          </div>

          {/* Other tabs overlay on top */}
          {(!activeMainTab || activeMainTab === "main") && tab === "analysis" && (
            <div style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "auto", background: "#080d1a" }}>
              <AnalysisTab nodes={nodes} steps={steps} anaError={anaError} anaLoading={anaLoading}
                report={report} showRaw={showRaw} setShowRaw={setShowRaw}
                influence={influence} analysed={analysed} onReanalyse={onReanalyse}
                analysisPanelRef={analysisPanelRef} networkPanelRef={networkPanelRef} problem={problem}
                supplementSections={supplementSections} addSourceQuick={addSourceQuick} />
            </div>
          )}

          {(!activeMainTab || activeMainTab === "main") && tab === "data" && (
            <div style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "auto", background: "#080d1a" }}>
              <DataTab nodes={nodes} edges={edges} influence={influence} analysed={analysed} problem={problem} subAnalyses={subAnalyses} />
            </div>
          )}
        </div>
      </main>

      {/* ── Bevestigingsdialog sluiten oplossingen-tab ── */}
      {confirmClose && (() => {
        const sub = (subAnalyses || []).find(s => s.id === confirmClose);
        return (
          <>
            <div onClick={() => setConfirmClose(null)}
              style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.55)" }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 2001, background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14, padding: "24px 28px", minWidth: 320, boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>
                Oplossingen verwijderen?
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20, lineHeight: 1.6 }}>
                Weet je zeker dat je de oplossingsanalyse voor <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                {sub?.factorLabel}</span> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmClose(null)}
                  style={{ padding: "8px 18px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
                  Annuleren
                </button>
                <button onClick={() => { onCloseSubTab?.(confirmClose); setConfirmClose(null); }}
                  style={{ padding: "8px 18px", background: "linear-gradient(135deg,#dc2626,#b91c1c)", border: "none",
                    borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Verwijderen
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
