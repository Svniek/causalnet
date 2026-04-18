import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { TYPES, SOLUTION_TYPES, PROBLEM_TYPES, uid } from "../constants";
import SubReanalysePanel from "./SubReanalysePanel";

const ALL_TYPES = { ...TYPES, ...SOLUTION_TYPES, ...PROBLEM_TYPES };
import { renderReport } from "../utils/renderReport";
import { exportAnalysisPdfWhite, exportAnalysisWord } from "../utils/exportWhite";
import useForceLayout from "../hooks/useForceLayout";

const SOL_W = 800;
const SOL_H = 500;

const CENTER_ID = "__center__";

// Wrapper that measures container dimensions BEFORE mounting the inner graph.
// This ensures useForceLayout initialises positions with the correct W/H from the start,
// so switching from a main tab into the sub-tab no longer produces a messy layout.
function SolutionGraph(props) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState(null); // null until measured

  useLayoutEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || SOL_W;
        const h = containerRef.current.clientHeight || SOL_H;
        setDims(prev => (prev && prev.w === w && prev.h === h) ? prev : { w, h });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {dims && <SolutionGraphInner {...props} W={dims.w} H={dims.h} />}
    </div>
  );
}

function SolutionGraphInner({ nodes, edges, influence, factorLabel, factorType, isProblems, W, H }) {
  const pctColor = "#ffffff";
  const TYPE_MAP = isProblems ? PROBLEM_TYPES : SOLUTION_TYPES;

  // Build augmented graph with the analyzed factor as the central node
  const augNodes = [
    { id: CENTER_ID, label: factorLabel, type: "maingoal" }, // type=maingoal so the force layout pins it to center
    ...nodes,
  ];
  const augInfluence = { ...(influence || {}), [factorLabel]: 1 };
  // Influence edges: each sub-node → center factor
  const influenceEdges = nodes.map(n => ({
    id: `inf_${n.id}`,
    from: n.id,
    to: CENTER_ID,
    correlation: influence?.[n.label] ?? 0.5,
  }));

  const { positions, posRef, onDragNode, centerPinRef } = useForceLayout(augNodes, edges, augInfluence, W, H);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const didDragRef = useRef(false);
  const [tooltip, setTooltip] = useState(null);

  const toSvgCoords = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height),
    };
  };

  const handleMouseDown = (e, nodeId) => {
    e.stopPropagation();
    const coords = toSvgCoords(e.clientX, e.clientY);
    const pos = positions[nodeId];
    if (!pos) return;
    didDragRef.current = false;
    if (nodeId === CENTER_ID) {
      // Snapshot all positions so the whole cluster moves together
      const snapshot = {};
      for (const id in posRef.current) {
        snapshot[id] = { x: posRef.current[id].x, y: posRef.current[id].y };
      }
      dragRef.current = { nodeId, startX: coords.x, startY: coords.y, snapshot };
    } else {
      dragRef.current = { nodeId, startX: coords.x, startY: coords.y, origX: pos.x, origY: pos.y };
    }
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current) return;
    const { nodeId, startX, startY } = dragRef.current;
    const coords = toSvgCoords(e.clientX, e.clientY);
    const dx = coords.x - startX, dy = coords.y - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
    if (nodeId === CENTER_ID) {
      // Shift every node by the same delta — cluster moves as a whole
      const snap = dragRef.current.snapshot;
      for (const id in snap) {
        onDragNode(id,
          Math.max(20, Math.min(W - 20, snap[id].x + dx)),
          Math.max(20, Math.min(H - 20, snap[id].y + dy))
        );
      }
      // Override physics pin so the centre stays where the user drops it
      centerPinRef.current = {
        x: Math.max(20, Math.min(W - 20, snap[CENTER_ID].x + dx)),
        y: Math.max(20, Math.min(H - 20, snap[CENTER_ID].y + dy)),
      };
    } else {
      const { origX, origY } = dragRef.current;
      onDragNode(nodeId,
        Math.max(20, Math.min(W - 20, origX + dx)),
        Math.max(20, Math.min(H - 20, origY + dy))
      );
    }
  };

  const handleMouseUp = () => { dragRef.current = null; };

  return (
    <>
      <svg
        ref={svgRef}
        width={W} height={H}
        style={{ display: "block", width: "100%", height: "100%" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <filter id="sol-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="cb" />
            <feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Influence edges: each sub-node → central factor (rendered first, behind synergie) */}
        {influenceEdges.map(e => {
          const fp = positions[e.from], tp = positions[e.to];
          if (!fp || !tp) return null;
          const fromNode = nodes.find(n => n.id === e.from);
          const col  = TYPE_MAP[fromNode?.type]?.color || ALL_TYPES[fromNode?.type]?.color || "#64748b";
          const corr = e.correlation ?? 0.4;
          const sw   = Math.max(1.5, 1.5 + corr * 5);
          const dx = tp.x - fp.x, dy = tp.y - fp.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const cx = (fp.x + tp.x) / 2 - (dy / d) * 30;
          const cy = (fp.y + tp.y) / 2 + (dx / d) * 30;
          return (
            <g key={e.id}
              onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: `${fromNode?.label} → ${factorLabel} \u00b7 ${(corr * 100).toFixed(0)}%` })}
              onMouseLeave={() => setTooltip(null)}>
              <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: "crosshair" }} />
              {corr > 0.5 && <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke={col} strokeWidth={sw + 6} strokeOpacity={0.07} />}
              {corr > 0.7 && <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke={col} strokeWidth={sw + 2} strokeOpacity={0.13} />}
              <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`}
                fill="none" stroke={col} strokeWidth={sw}
                strokeOpacity={0.5 + corr * 0.35} strokeLinecap="round" />
            </g>
          );
        })}

        {/* Synergie edges — solid colored curves, tooltip on hover only */}
        {edges.map(e => {
          const fp = positions[e.from], tp = positions[e.to];
          if (!fp || !tp) return null;
          const fromNode = nodes.find(n => n.id === e.from);
          const col  = TYPE_MAP[fromNode?.type]?.color || ALL_TYPES[fromNode?.type]?.color || "#64748b";
          const corr = e.correlation ?? 0.3;
          const sw   = Math.max(1.5, 1.5 + corr * 5);
          const dx = tp.x - fp.x, dy = tp.y - fp.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const cx = (fp.x + tp.x) / 2 - (dy / d) * 24;
          const cy = (fp.y + tp.y) / 2 + (dx / d) * 24;
          return (
            <g key={e.id}
              onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: `Synergie \u00b7 r=${corr.toFixed(2)}` })}
              onMouseLeave={() => setTooltip(null)}>
              {/* Invisible wider hit area */}
              <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: "crosshair" }} />
              {corr > 0.5 && <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke={col} strokeWidth={sw + 6} strokeOpacity={0.07} />}
              {corr > 0.7 && <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke={col} strokeWidth={sw + 2} strokeOpacity={0.12} />}
              <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`}
                fill="none" stroke={col} strokeWidth={sw}
                strokeOpacity={0.4 + corr * 0.35} strokeLinecap="round" />
            </g>
          );
        })}

        {/* Central factor node — large circle with avg % inside */}
        {(() => {
          const cp = positions[CENTER_ID];
          if (!cp) return null;
          const cCol = TYPES[factorType]?.color || ALL_TYPES[factorType]?.color || "#f59e0b";
          const cR = 36;
          // Average influence of all sub-nodes as the central score
          const avgInf = nodes.length > 0
            ? nodes.reduce((s, n) => s + (influence?.[n.label] ?? 0.5), 0) / nodes.length
            : 0.5;
          const cWords = (factorLabel || "").split(" ");
          const cLines = []; let cCur = "";
          cWords.forEach(w => {
            if ((cCur + " " + w).trim().length <= 16) { cCur = (cCur + " " + w).trim(); }
            else { if (cCur) cLines.push(cCur); cCur = w; }
          });
          if (cCur) cLines.push(cCur);
          return (
            <g
              onMouseDown={e => handleMouseDown(e, CENTER_ID)}
              onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: `${factorLabel} \u00b7 centrale factor \u00b7 gem. ${(avgInf * 100).toFixed(0)}%` })}
              onMouseLeave={() => setTooltip(null)}
              style={{ pointerEvents: "all", cursor: "grab" }}
            >
              {/* Outer glow ring */}
              <circle cx={cp.x} cy={cp.y} r={cR + 10} fill={cCol} opacity={0.12} />
              <circle
                cx={cp.x} cy={cp.y} r={cR}
                fill={cCol} fillOpacity={0.93}
                stroke="rgba(255,255,255,0.3)" strokeWidth={2}
                filter="url(#sol-glow)"
              />
              {/* Percentage inside */}
              <text x={cp.x} y={cp.y} textAnchor="middle" dominantBaseline="central"
                fontFamily="sans-serif" fontSize={14} fontWeight="700" fill="#ffffff"
                style={{ pointerEvents: "none", userSelect: "none" }}>
                {(avgInf * 100).toFixed(0)}%
              </text>
              {/* Label below */}
              <text textAnchor="middle" fontFamily="sans-serif" fontSize={11} fontWeight="600" fill="#e2e8f0"
                style={{ pointerEvents: "none", userSelect: "none" }}>
                {cLines.map((l, li) => (
                  <tspan key={li} x={cp.x} y={cp.y + cR + 14 + li * 13}>{l}</tspan>
                ))}
              </text>
            </g>
          );
        })()}

        {/* Nodes */}
        {nodes.map(n => {
          const p = positions[n.id];
          if (!p) return null;
          const t = TYPE_MAP[n.type] || ALL_TYPES[n.type] || { color: "#64748b", label: n.type };
          const inf = influence?.[n.label] ?? 0.5;
          const r = 12 + inf * 22;

          const words = n.label.split(" ");
          const lines = [];
          let cur = "";
          words.forEach(w => {
            if ((cur + " " + w).trim().length <= 14) {
              cur = (cur + " " + w).trim();
            } else {
              if (cur) lines.push(cur);
              cur = w;
            }
          });
          if (cur) lines.push(cur);

          return (
            <g
              key={n.id}
              onMouseDown={e => handleMouseDown(e, n.id)}
              onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: `${n.label} · ${t.label} · ${(inf * 100).toFixed(0)}%` })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "grab" }}
            >
              <circle cx={p.x} cy={p.y} r={r + 12} fill={t.color} opacity={0.08} />
              <circle
                cx={p.x} cy={p.y} r={r}
                fill={t.color} fillOpacity={0.9}
                stroke="rgba(255,255,255,0.25)" strokeWidth={1.5}
                filter="url(#sol-glow)"
              />
              {/* Percentage centered inside the circle */}
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                fontFamily="sans-serif" fontSize={Math.max(8, Math.min(13, r * 0.6))}
                fontWeight="700" fill={pctColor}
                style={{ pointerEvents: "none", userSelect: "none" }}>
                {(inf * 100).toFixed(0)}%
              </text>
              {/* Label below the circle */}
              <text
                textAnchor="middle"
                fontFamily="sans-serif"
                fontSize={9}
                fill="#e2e8f0"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {lines.map((l, li) => (
                  <tspan key={li} x={p.x} y={p.y + r + 12 + li * 11}>{l}</tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 12, top: tooltip.y - 8,
          background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6, padding: "4px 9px", fontSize: 11, color: "#e2e8f0",
          pointerEvents: "none", zIndex: 999, whiteSpace: "nowrap"
        }}>
          {tooltip.text}
        </div>
      )}

      {/* Solution type legend */}
      <div style={{
        position: "absolute", bottom: 10, left: 10,
        background: "rgba(8,13,26,0.88)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "10px 14px", fontSize: 10, color: "#475569", userSelect: "none"
      }}>
        <div style={{ marginBottom: 7, color: "#64748b", fontWeight: 600, letterSpacing: 0.5, fontSize: 9, textTransform: "uppercase" }}>Legenda</div>
        {Object.entries(TYPE_MAP).map(([key, { label, color }]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function SolutionTabPanel({ sub, problem, apiKey, onMergeToggle, onVisibleToggle, onClose, onReanalyse }) {
  const [innerTab, setInnerTab] = useState("network");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [screenshotting, setScreenshotting] = useState(false);
  const networkContainerRef = useRef(null);
  const analysisContainerRef = useRef(null);

  const takeScreenshot = async () => {
    const ref = innerTab === "network" ? networkContainerRef : analysisContainerRef;
    if (!ref.current) return;
    setScreenshotting(true);
    try {
      if (!window.html2canvas) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const canvas = await window.html2canvas(ref.current, {
        backgroundColor: "#080d1a", scale: 2,
        useCORS: true, allowTaint: true, logging: false,
      });
      const a = document.createElement("a");
      const slug = sub.factorLabel.slice(0, 30).replace(/\s+/g, "_");
      a.href = canvas.toDataURL("image/png");
      a.download = `CausalNet_${innerTab}_${slug}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (e) {
      alert("Screenshot mislukt: " + e.message);
    }
    setScreenshotting(false);
  };

  if (!sub) return null;

  const typeColors = {
    maingoal: "#f59e0b", goal: "#34d399", risk: "#f87171",
    protective: "#60a5fa", amplifying: "#a78bfa",
    interventie: "#10b981", beleid: "#8b5cf6", omgeving: "#f97316", gedrag: "#06b6d4",
  };
  const factorColor = typeColors[sub.factorType] || "#64748b";
  const isProblems = sub.analysisMode === "problems";
  const modeLabel  = isProblems ? "oorzaken" : "oplossingen";
  const modeEmoji  = isProblems ? "🔎" : "🔍";
  const modeAccent = isProblems ? "#60a5fa" : "#f59e0b";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#080d1a" }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        background: isProblems ? "rgba(96,165,250,0.04)" : "rgba(245,158,11,0.04)",
        borderBottom: `1px solid ${modeAccent}22`,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 12,
              background: factorColor + "22", color: factorColor, border: `1px solid ${factorColor}44`,
              fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0
            }}>
              {ALL_TYPES[sub.factorType]?.label || sub.factorType}
            </span>
            <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
              {modeEmoji} {isProblems ? "Oorzaken van" : "Oplossingen voor"}: {sub.factorLabel}
            </span>
          </div>
          {sub.analysed && (
            <div style={{ fontSize: 10, color: "#475569" }}>
              {sub.nodes.length} {modeLabel} · {sub.edges.length} correlaties
            </div>
          )}
        </div>

        {/* Export controls */}
        {sub.analysed && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {/* Screenshot button — always available when analysed */}
            <button
              onClick={takeScreenshot}
              disabled={screenshotting}
              title={`Screenshot van ${innerTab === "network" ? "netwerk" : "analyse"}`}
              style={{ padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#64748b", fontSize: 10, cursor: screenshotting ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              {screenshotting ? "⏳" : "📷"} Screenshot
            </button>
            {sub.report && (<>
              <button
                onClick={async () => {
                  setPdfLoading(true);
                  const title = isProblems ? `Oorzaken: ${sub.factorLabel}` : `Oplossingen: ${sub.factorLabel}`;
                  try { await exportAnalysisPdfWhite(sub.report, title); }
                  catch (e) { alert("PDF mislukt: " + e.message); }
                  setPdfLoading(false);
                }}
                disabled={pdfLoading}
                style={{ padding: "5px 10px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 7, color: "#60a5fa", fontSize: 10, cursor: pdfLoading ? "wait" : "pointer" }}
              >
                {pdfLoading ? "⏳" : "📄"} PDF (wit)
              </button>
              <button
                onClick={() => {
                  try { exportAnalysisWord(sub.report, isProblems ? `Oorzaken: ${sub.factorLabel}` : `Oplossingen: ${sub.factorLabel}`); }
                  catch (e) { alert("Word export mislukt: " + e.message); }
                }}
                style={{ padding: "5px 10px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 7, color: "#34d399", fontSize: 10, cursor: "pointer" }}
              >
                📝 Word
              </button>
            </>)}
          </div>
        )}

        {/* Merge / visible controls */}
        {sub.analysed && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button
              onClick={onMergeToggle}
              style={{
                padding: "6px 12px", fontSize: 11, borderRadius: 8, cursor: "pointer", fontWeight: 600,
                background: sub.merged ? "rgba(52,211,153,0.15)" : "rgba(245,158,11,0.12)",
                border: `1px solid ${sub.merged ? "rgba(52,211,153,0.4)" : "rgba(245,158,11,0.3)"}`,
                color: sub.merged ? "#34d399" : "#f59e0b",
              }}
            >
              📌 {sub.merged ? "Verwijder uit hoofdnetwerk" : "Voeg toe aan hoofdnetwerk"}
            </button>
            {sub.merged && (
              <button
                onClick={onVisibleToggle}
                style={{
                  padding: "6px 12px", fontSize: 11, borderRadius: 8, cursor: "pointer", fontWeight: 600,
                  background: sub.subVisible ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${sub.subVisible ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.1)"}`,
                  color: sub.subVisible ? "#60a5fa" : "#475569",
                }}
              >
                👁 {sub.subVisible ? "Zichtbaar" : "Verborgen"}
              </button>
            )}
          </div>
        )}

      </div>

      {/* Inner tabs */}
      {sub.analysed && (
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0 16px", alignItems: "center" }}>
          {[["network", "🕸 Netwerk"], ["analysis", "📋 Analyse"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setInnerTab(key)}
              style={{
                padding: "10px 16px", background: "none", border: "none",
                borderBottom: `2px solid ${innerTab === key ? modeAccent : "transparent"}`,
                color: innerTab === key ? modeAccent : "#94a3b8",
                fontSize: 12, cursor: "pointer", marginBottom: -1
              }}
            >
              {label}
            </button>
          ))}
          {onReanalyse && (
            <button
              onClick={() => setInnerTab(innerTab === "reanalyse" ? "network" : "reanalyse")}
              style={{
                padding: "10px 16px", background: "none", border: "none",
                borderBottom: `2px solid ${innerTab === "reanalyse" ? modeAccent : "transparent"}`,
                color: innerTab === "reanalyse" ? modeAccent : "#94a3b8",
                fontSize: 12, cursor: "pointer", marginBottom: -1
              }}
            >
              🔄 Heranalyse
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Loading state */}
        {!sub.analysed && sub.steps.length > 0 && (
          <div style={{ padding: 24 }}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {isProblems ? "Oorzaken" : "Oplossingen"} analyseren voor "{sub.factorLabel}"…
              </div>
              {sub.steps.map((st, i) => (
                <div key={st.id || i} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: st.done ? "#34d399" : "#f59e0b", boxShadow: st.done ? "0 0 7px #34d399" : "0 0 7px #f59e0b" }} />
                  <span style={{ fontSize: 12, color: st.done ? "#334155" : "#e2e8f0" }}>{st.txt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {sub.error && (
          <div style={{ padding: 24 }}>
            <div style={{ padding: 14, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, color: "#f87171", fontSize: 13 }}>
              ⚠️ Fout: {sub.error}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!sub.analysed && !sub.error && sub.steps.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ fontSize: 44 }}>🔍</div>
            <p style={{ color: "#334155", fontSize: 13, marginTop: 10 }}>Oplossingen worden geladen…</p>
          </div>
        )}

        {/* Network tab — always mounted once analysed so ResizeObserver settles before first view */}
        {sub.analysed && sub.nodes.length > 0 && (
          <div ref={networkContainerRef} style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center,#0d1630,#080d1a)", display: innerTab === "network" ? "block" : "none" }}>
            <SolutionGraph nodes={sub.nodes} edges={sub.edges} influence={sub.influence} factorLabel={sub.factorLabel} factorType={sub.factorType} isProblems={isProblems} />
          </div>
        )}

        {sub.analysed && innerTab === "network" && sub.nodes.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ fontSize: 36 }}>🕸</div>
            <p style={{ color: "#334155", fontSize: 13, marginTop: 10 }}>Geen netwerk beschikbaar.</p>
          </div>
        )}

        {/* Analysis tab */}
        {sub.analysed && innerTab === "analysis" && (
          <div ref={analysisContainerRef} style={{ position: "absolute", inset: 0, overflow: "auto", padding: 24 }}>
            {/* Influence scores chart */}
            {sub.nodes.length > 0 && (
              <div style={{ marginBottom: 24, padding: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#475569", marginBottom: 10 }}>{isProblems ? "Bijdrage van oorzaken" : "Effectiviteitsscores oplossingen"}</div>
                {[...sub.nodes].sort((a, b) => (sub.influence?.[b.label] || 0) - (sub.influence?.[a.label] || 0)).map(n => {
                  const inf = sub.influence?.[n.label] ?? 0;
                  const col = (isProblems ? PROBLEM_TYPES : SOLUTION_TYPES)[n.type]?.color || "#64748b";
                  return (
                    <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#64748b", width: 180, flexShrink: 0, lineHeight: 1.4, wordBreak: "break-word" }}>{n.label}</span>
                      <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: (inf * 100) + "%", height: "100%", background: col, borderRadius: 3, opacity: 0.8 }} />
                      </div>
                      <span style={{ fontSize: 10, color: col, width: 30, textAlign: "right" }}>{(inf * 100).toFixed(0)}%</span>
                    </div>
                  );
                })}
                {/* Legenda */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                  {Object.entries(isProblems ? PROBLEM_TYPES : SOLUTION_TYPES).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: "#475569" }}>{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sub.report ? (
              renderReport(sub.report)
            ) : (
              <div style={{ color: "#334155", fontSize: 13 }}>Geen analyse beschikbaar.</div>
            )}
          </div>
        )}

        {/* Heranalyse tab */}
        {sub.analysed && innerTab === "reanalyse" && onReanalyse && (
          <div style={{ position: "absolute", inset: 0 }}>
            <SubReanalysePanel
              sub={sub}
              onExecute={(cfg) => {
                setInnerTab("network");
                onReanalyse(cfg);
              }}
              onCancel={() => setInnerTab("network")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
