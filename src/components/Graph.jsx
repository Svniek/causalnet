import { useState, useRef, useCallback, useEffect } from "react";
import { TYPES, SOLUTION_TYPES, PROBLEM_TYPES, nodeRadius, edgeWidth } from "../constants";

const TYPE_ENTRIES = Object.entries(TYPES);
const ALL_TYPES = { ...TYPES, ...SOLUTION_TYPES, ...PROBLEM_TYPES };

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 6;
const ZOOM_STEP = 1.25;

export default function Graph({ nodes, edges, positions, selected, onSelect, influence, W, H, analysed, posRef, onDragNode, subNetworks, onSolutionAnalyse, onProblemAnalyse, onDragSubNode, showZoom }) {
  const [tooltip, setTooltip]           = useState(null);
  const [hiddenTypes, setHiddenTypes]   = useState(new Set());
  const [contextMenu, setContextMenu]   = useState(null);
  const [hoverNodeId, setHoverNodeId]   = useState(null);
  const [solutionsVisible, setSolutionsVisible] = useState(true);
  const [problemsVisible, setProblemsVisible]   = useState(true);
  const [hiddenSolTypes, setHiddenSolTypes]     = useState(new Set());
  const [hiddenProbTypes, setHiddenProbTypes]   = useState(new Set());
  const [showMainPct, setShowMainPct]           = useState(true);
  const [showSolPct,  setShowSolPct]            = useState(true);

  const toggleSolType = (key) => setHiddenSolTypes(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const toggleProbType = (key) => setHiddenProbTypes(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  // ── Zoom / Pan ──────────────────────────────────────────────────────────────
  const [vt, setVt] = useState({ x: 0, y: 0, scale: 1 }); // viewTransform
  const vtRef = useRef({ x: 0, y: 0, scale: 1 });
  const panRef = useRef(null); // { startClientX, startClientY, origX, origY }
  const [isPanning, setIsPanning] = useState(false);

  const applyVt = (next) => { vtRef.current = next; setVt(next); };
  const resetZoom = () => applyVt({ x: 0, y: 0, scale: 1 });
  const zoomBy = (factor) => {
    const t = vtRef.current;
    const cx = W / 2, cy = H / 2; // zoom toward canvas center
    const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, t.scale * factor));
    applyVt({ scale: ns, x: cx - (cx - t.x) * (ns / t.scale), y: cy - (cy - t.y) * (ns / t.scale) });
  };

  const svgRef     = useRef(null);
  const dragRef    = useRef(null);
  const subDragRef = useRef(null); // { factorId, nodeId, startX, startY, origX, origY }
  const didDragRef = useRef(false);

  // Raw SVG coords (before transform group) from client coords
  const toRawSvg = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) };
  }, [W, H]);

  // World coords (inside transform group) from client coords
  const toSvgCoords = useCallback((clientX, clientY) => {
    const raw = toRawSvg(clientX, clientY);
    const t = vtRef.current;
    return { x: (raw.x - t.x) / t.scale, y: (raw.y - t.y) / t.scale };
  }, [toRawSvg]);

  // Wheel zoom (non-passive so we can preventDefault)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const raw = toRawSvg(e.clientX, e.clientY);
      const t = vtRef.current;
      const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, t.scale * factor));
      applyVt({ scale: ns, x: raw.x - (raw.x - t.x) * (ns / t.scale), y: raw.y - (raw.y - t.y) * (ns / t.scale) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toRawSvg]);

  // Escape closes context menu
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") setContextMenu(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const toggleType = (key) => setHiddenTypes(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  const visibleNodes = nodes.filter(n => !hiddenTypes.has(n.type));
  const visibleIds   = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = edges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));

  // ── Node drag ───────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    const coords = toSvgCoords(e.clientX, e.clientY);
    const pos = positions[nodeId];
    if (!pos) return;
    didDragRef.current = false;
    dragRef.current = { nodeId, startX: coords.x, startY: coords.y, origX: pos.x, origY: pos.y };
  }, [toSvgCoords, positions]);

  // ── Canvas pan (mousedown on SVG background) ────────────────────────────────
  const handleSvgMouseDown = useCallback((e) => {
    if (dragRef.current) return; // node drag takes priority
    setContextMenu(null);
    panRef.current = { startClientX: e.clientX, startClientY: e.clientY, origX: vtRef.current.x, origY: vtRef.current.y };
    setIsPanning(true);
    didDragRef.current = false;
  }, []);

  // ── Move: handle node drag, sub-node drag and canvas pan ────────────────────
  const handleMouseMove = useCallback((e) => {
    if (dragRef.current) {
      const { nodeId, startX, startY, origX, origY } = dragRef.current;
      const coords = toSvgCoords(e.clientX, e.clientY);
      const dx = coords.x - startX, dy = coords.y - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
      const r   = nodeRadius(nodes.find(n => n.id === nodeId) || { type: "risk", label: "" }, influence);
      const pad = r + 15;
      onDragNode(nodeId, Math.max(pad, Math.min(W - pad, origX + dx)), Math.max(pad, Math.min(H - pad, origY + dy)));
    } else if (subDragRef.current) {
      const { factorId, nodeId, startX, startY, origX, origY } = subDragRef.current;
      const coords = toSvgCoords(e.clientX, e.clientY);
      const dx = coords.x - startX, dy = coords.y - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
      onDragSubNode?.(factorId, nodeId, origX + dx, origY + dy);
    } else if (panRef.current) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = (e.clientX - panRef.current.startClientX) * (W / rect.width);
      const dy = (e.clientY - panRef.current.startClientY) * (H / rect.height);
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
      applyVt({ ...vtRef.current, x: panRef.current.origX + dx, y: panRef.current.origY + dy });
    }
  }, [toSvgCoords, onDragNode, onDragSubNode, nodes, influence, W, H]);

  const handleMouseUp = useCallback(() => {
    dragRef.current    = null;
    subDragRef.current = null;
    panRef.current     = null;
    setIsPanning(false);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={svgRef}
        width={W} height={H}
        style={{ display: "block", width: "100%", height: "100%", cursor: isPanning ? "grabbing" : "default" }}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="cb" />
            <feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="cb" />
            <feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Everything inside the pan/zoom transform group */}
        <g transform={`translate(${vt.x},${vt.y}) scale(${vt.scale})`}>

          {/* ── Main edges ─────────────────────────────────────────────────── */}
          {visibleEdges.map(e => {
            const fp = positions[e.from], tp = positions[e.to];
            if (!fp || !tp) return null;
            const fromNode = nodes.find(n => n.id === e.from);
            const toNode   = nodes.find(n => n.id === e.to);
            const corr = e.correlation ?? 0.3;
            const sw   = edgeWidth(corr);
            const toIsMaingoal  = toNode?.type === "maingoal";
            const toIsGoal      = toNode?.type === "goal";
            const isInterFactor = !toIsMaingoal && !toIsGoal;
            const col   = isInterFactor ? "#64748b" : ALL_TYPES[fromNode?.type]?.color || "#888";
            const rFrom = nodeRadius(fromNode || { type: "risk", label: "" }, influence);
            const dx = tp.x - fp.x, dy = tp.y - fp.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            const sx = fp.x + (dx / d) * rFrom, sy = fp.y + (dy / d) * rFrom;
            const curve = isInterFactor ? 20 : 38;
            const cx = (sx + tp.x) / 2 - (dy / d) * curve, cy = (sy + tp.y) / 2 + (dx / d) * curve;
            const opacity   = toIsMaingoal ? 0.65 : toIsGoal ? 0.5 : 0.3;
            const dashArray = isInterFactor ? "5 4" : "none";
            return (
              <g key={e.id}
                onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: (isInterFactor ? "factor\u2194factor" : "\u2192 " + toNode?.label) + ` \u00b7 r=${corr.toFixed(2)}` })}
                onMouseLeave={() => setTooltip(null)}>
                {corr > 0.5 && <path d={`M${sx},${sy} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke={col} strokeWidth={sw + 6} strokeOpacity={0.07} />}
                {corr > 0.7 && <path d={`M${sx},${sy} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke={col} strokeWidth={sw + 2} strokeOpacity={0.13} />}
                <path d={`M${sx},${sy} Q${cx},${cy} ${tp.x},${tp.y}`}
                  fill="none" stroke={col}
                  strokeWidth={isInterFactor ? Math.max(1, sw * 0.55) : sw}
                  strokeOpacity={analysed ? opacity : opacity * 0.45}
                  strokeDasharray={dashArray} strokeLinecap="round"
                  style={{ cursor: "crosshair" }} />
              </g>
            );
          })}

          {/* ── Main nodes ─────────────────────────────────────────────────── */}
          {visibleNodes.map(n => {
            const p = positions[n.id]; if (!p) return null;
            const t    = ALL_TYPES[n.type] || { color: "#64748b", label: n.type };
            const r    = nodeRadius(n, influence);
            const isSel = selected === n.id;
            const inf  = influence?.[n.label];
            const words = n.label.split(" ");
            const lines = []; let cur = "";
            words.forEach(w => {
              if ((cur + " " + w).trim().length <= 16) { cur = (cur + " " + w).trim(); }
              else { if (cur) lines.push(cur); cur = w.length > 16 ? w.slice(0, 15) + "\u2026" : w; }
            });
            if (cur) lines.push(cur);
            const fs = Math.max(9, Math.min(11, 9 + (inf || 0) * 2));
            const lineH = fs + 2, totalH = lines.length * lineH, yStart = p.y + r + 13;
            return (
              <g key={n.id}
                onMouseDown={e => handleMouseDown(e, n.id)}
                onClick={e => {
                  if (!didDragRef.current) {
                    onSelect(isSel ? null : n.id);
                    if (analysed && onSolutionAnalyse)
                      setContextMenu({ nodeId: n.id, screenX: e.clientX + 8, screenY: e.clientY + 8, label: n.label, type: n.type });
                  }
                }}
                onMouseEnter={ev => { setTooltip({ x: ev.clientX, y: ev.clientY, text: n.label + (inf != null ? " \u00b7 invloed: " + (inf * 100).toFixed(0) + "%" : "") }); setHoverNodeId(n.id); }}
                onMouseLeave={() => { setTooltip(null); setHoverNodeId(null); }}
                style={{ cursor: dragRef.current ? "grabbing" : "grab" }}>
                {isSel && <circle cx={p.x} cy={p.y} r={r + 10} fill={t.color} opacity={0.18} />}
                {n.type === "maingoal"
                  ? <polygon points={`${p.x},${p.y - r} ${p.x + r},${p.y} ${p.x},${p.y + r} ${p.x - r},${p.y}`}
                      fill={t.color} fillOpacity={0.93} stroke={isSel ? "#fff" : t.color} strokeWidth={isSel ? 3 : 2} filter="url(#glow)" />
                  : <circle cx={p.x} cy={p.y} r={r} fill={t.color} fillOpacity={0.88}
                      stroke={isSel ? "#fff" : "rgba(255,255,255,0.2)"} strokeWidth={isSel ? 3 : 1}
                      filter={isSel ? "url(#glow-sm)" : ""} />
                }

                {/* Percentage centered inside the circle */}
                {showMainPct && analysed && inf != null && n.type !== "maingoal" && (
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                    fontFamily="sans-serif" fontSize={Math.max(8, Math.min(13, r * 0.65))}
                    fontWeight="700" fill="#000" fillOpacity={0.75}
                    style={{ pointerEvents: "none", userSelect: "none" }}>
                    {(inf * 100).toFixed(0)}%
                  </text>
                )}
                {/* Label below the circle */}
                <text textAnchor="middle" fontFamily="sans-serif" fontSize={fs}
                  fontWeight={inf > 0.65 ? "600" : "400"} fill="#e2e8f0"
                  style={{ pointerEvents: "none", userSelect: "none" }}>
                  {lines.map((l, li) => <tspan key={li} x={p.x} y={yStart + li * lineH}>{l}</tspan>)}
                </text>
              </g>
            );
          })}

          {/* ── Merged sub-networks ─────────────────────────────────────────── */}
          {(subNetworks || []).map(subNet => {
            const isProblems = subNet.analysisMode === "problems";
            if (isProblems ? !problemsVisible : !solutionsVisible) return null;
            const hiddenSet = isProblems ? hiddenProbTypes : hiddenSolTypes;
            const parentPos = positions[subNet.factorId];
            if (!parentPos || !subNet.nodes?.length) return null;
            const count = subNet.nodes.length;
            const isHovering = hoverNodeId === subNet.factorId;
            const baseOpacity = subNet.visible ? 1 : (isHovering ? 0.5 : 0);
            if (!subNet.visible && !isHovering) return null;
            const ringR = 110;

            // Pre-compute sub-node positions — use persisted position if available, else ring formula
            const snPos = subNet.nodes.map((sn, i) => {
              if (subNet.nodePositions?.[sn.id]) return { id: sn.id, ...subNet.nodePositions[sn.id] };
              const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
              return { id: sn.id, x: parentPos.x + ringR * Math.cos(angle), y: parentPos.y + ringR * Math.sin(angle) };
            });
            const snPosMap = Object.fromEntries(snPos.map(p => [p.id, p]));

            const parentNode = nodes.find(n => n.id === subNet.factorId);
            const parentR = parentNode ? nodeRadius(parentNode, influence) : 20;

            return (
              <g key={subNet.factorId} style={{ transition: "opacity 0.2s" }} opacity={baseOpacity}>
                {/* Influence edges: each sub-node → parent factor */}
                {subNet.nodes.filter(sn => !hiddenSet.has(sn.type)).map(sn => {
                  const sp = snPosMap[sn.id];
                  if (!sp) return null;
                  const col  = ALL_TYPES[sn.type]?.color || "#64748b";
                  const corr = subNet.influence?.[sn.label] ?? 0.5;
                  const sw   = Math.max(1.5, 1.5 + corr * 4);
                  const dx = parentPos.x - sp.x, dy = parentPos.y - sp.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
                  // Stop edge at the parent's circle edge
                  const tx = parentPos.x - (dx / d) * parentR;
                  const ty = parentPos.y - (dy / d) * parentR;
                  const cx = (sp.x + tx) / 2 - (dy / d) * 12;
                  const cy = (sp.y + ty) / 2 + (dx / d) * 12;
                  return (
                    <g key={`inf_${sn.id}`}
                      onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: `${sn.label} → ${parentNode?.label || ""} \u00b7 ${(corr * 100).toFixed(0)}%` })}
                      onMouseLeave={() => setTooltip(null)}>
                      <path d={`M${sp.x},${sp.y} Q${cx},${cy} ${tx},${ty}`} fill="none" stroke="transparent" strokeWidth={12} style={{ cursor: "crosshair" }} />
                      {corr > 0.5 && <path d={`M${sp.x},${sp.y} Q${cx},${cy} ${tx},${ty}`} fill="none" stroke={col} strokeWidth={sw + 5} strokeOpacity={0.07} />}
                      <path d={`M${sp.x},${sp.y} Q${cx},${cy} ${tx},${ty}`}
                        fill="none" stroke={col} strokeWidth={sw}
                        strokeOpacity={0.45 + corr * 0.35} strokeLinecap="round" />
                    </g>
                  );
                })}

                {/* Inter-solution synergie edges — solid colored curves, hover tooltip only */}
                {(subNet.edges || []).map(se => {
                  const fp = snPosMap[se.from], tp = snPosMap[se.to];
                  if (!fp || !tp) return null;
                  const fromNode = subNet.nodes.find(n => n.id === se.from);
                  const toNode   = subNet.nodes.find(n => n.id === se.to);
                  if (hiddenSet.has(fromNode?.type) || hiddenSet.has(toNode?.type)) return null;
                  const col  = ALL_TYPES[fromNode?.type]?.color || "#64748b";
                  const corr = se.correlation ?? 0.4;
                  const sw   = Math.max(1.5, 1.5 + corr * 5);
                  const dx = tp.x - fp.x, dy = tp.y - fp.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
                  const cx = (fp.x + tp.x) / 2 - (dy / d) * 18, cy = (fp.y + tp.y) / 2 + (dx / d) * 18;
                  return (
                    <g key={se.id}
                      onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: `Synergie \u00b7 r=${corr.toFixed(2)}` })}
                      onMouseLeave={() => setTooltip(null)}>
                      {/* Invisible wider hit area */}
                      <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: "crosshair" }} />
                      {corr > 0.5 && <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`} fill="none" stroke={col} strokeWidth={sw + 5} strokeOpacity={0.08} />}
                      <path d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`}
                        fill="none" stroke={col} strokeWidth={sw}
                        strokeOpacity={0.4 + corr * 0.35} strokeLinecap="round" />
                    </g>
                  );
                })}

                {/* Sub-nodes — no lines to parent, draggable */}
                {subNet.nodes.filter(sn => !hiddenSet.has(sn.type)).map((sn) => {
                  const sp = snPosMap[sn.id];
                  const snInf = subNet.influence?.[sn.label] ?? 0.5;
                  const snCol = ALL_TYPES[sn.type]?.color || "#64748b";
                  const snR   = 6 + snInf * 14;
                  const snWords = sn.label.split(" ");
                  const snLines = []; let snCur = "";
                  snWords.forEach(w => {
                    if ((snCur + " " + w).trim().length <= 12) { snCur = (snCur + " " + w).trim(); }
                    else { if (snCur) snLines.push(snCur); snCur = w; }
                  });
                  if (snCur) snLines.push(snCur);
                  return (
                    <g key={sn.id}
                      style={{ cursor: "grab" }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        const coords = toSvgCoords(e.clientX, e.clientY);
                        subDragRef.current = { factorId: subNet.factorId, nodeId: sn.id, startX: coords.x, startY: coords.y, origX: sp.x, origY: sp.y };
                        didDragRef.current = false;
                      }}
                      onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: `${sn.label} \u00b7 ${(snInf * 100).toFixed(0)}% effectiviteit` })}
                      onMouseLeave={() => setTooltip(null)}>
                      <circle cx={sp.x} cy={sp.y} r={snR} fill={snCol} fillOpacity={0.85} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                      {showSolPct && (
                        <text x={sp.x} y={sp.y} textAnchor="middle" dominantBaseline="central"
                          fontFamily="sans-serif" fontSize={Math.max(7, snR * 0.55)}
                          fontWeight="700"
                          fill="#ffffff"
                          style={{ pointerEvents: "none", userSelect: "none" }}>
                          {(snInf * 100).toFixed(0)}%
                        </text>
                      )}
                      <text textAnchor="middle" fontFamily="sans-serif" fontSize={8} fill="#e2e8f0"
                        style={{ pointerEvents: "none", userSelect: "none" }}>
                        {snLines.map((l, li) => <tspan key={li} x={sp.x} y={sp.y + snR + 10 + li * 10}>{l}</tspan>)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>{/* end transform group */}
      </svg>

      {/* ── Zoom buttons (only visible on network/graph tab) ─────────────────── */}
      <div style={{ position: "absolute", top: 10, right: 10, display: showZoom ? "flex" : "none", flexDirection: "column", gap: 4, zIndex: 10 }}>
        {[
          { label: "+", title: "Inzoomen",     action: () => zoomBy(ZOOM_STEP) },
          { label: "−", title: "Uitzoomen",    action: () => zoomBy(1 / ZOOM_STEP) },
          { label: "⟳", title: "Zoom resetten", action: resetZoom },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action} title={btn.title}
            style={{ width: 28, height: 28, background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 7, color: "#94a3b8", fontSize: btn.label === "⟳" ? 14 : 17, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
              lineHeight: 1, padding: 0 }}>
            {btn.label}
          </button>
        ))}
        {vt.scale !== 1 && (
          <div style={{ fontSize: 9, color: "#334155", textAlign: "center", marginTop: 2 }}>
            {(vt.scale * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* ── Context menu backdrop ─────────────────────────────────────────────── */}
      {contextMenu && <div onClick={() => setContextMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 999 }} />}

      {/* ── Context menu ─────────────────────────────────────────────────────── */}
      {contextMenu && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: "fixed", left: contextMenu.screenX, top: contextMenu.screenY,
            background: "#0f172a", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10,
            padding: "10px 0", zIndex: 1000, minWidth: 220, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
          <div style={{ padding: "4px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{contextMenu.label}</div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{ALL_TYPES[contextMenu.type]?.label || contextMenu.type}</div>
          </div>
          <button onClick={() => { onSolutionAnalyse(contextMenu.nodeId); setContextMenu(null); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px",
              background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#f59e0b", fontWeight: 600,
              backgroundImage: "linear-gradient(90deg, rgba(245,158,11,0.08) 0%, transparent 100%)" }}>
            🔍 Analyseer oplossingen
          </button>
          {analysed && onProblemAnalyse && (
            <button onClick={() => { onProblemAnalyse(contextMenu.nodeId); setContextMenu(null); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px",
                background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#60a5fa", fontWeight: 600,
                backgroundImage: "linear-gradient(90deg, rgba(96,165,250,0.08) 0%, transparent 100%)" }}>
              🔎 Analyseer oorzaken
            </button>
          )}
          <button onClick={() => setContextMenu(null)}
            style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none",
              color: "#475569", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}

      {/* ── Tooltip ──────────────────────────────────────────────────────────── */}
      {tooltip && (
        <div style={{ position: "fixed", left: tooltip.x + 12, top: tooltip.y - 8,
          background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6, padding: "4px 9px", fontSize: 11, color: "#e2e8f0", pointerEvents: "none", zIndex: 1001, whiteSpace: "nowrap" }}>
          {tooltip.text}
        </div>
      )}

      {/* ── Type legend bottom-left ───────────────────────────────────────────── */}
      <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(8,13,26,0.88)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", fontSize: 10, color: "#475569", userSelect: "none" }}>
        <div style={{ marginBottom: 7, color: "#64748b", fontWeight: 600, letterSpacing: 0.5, fontSize: 9, textTransform: "uppercase" }}>Legenda</div>
        {TYPE_ENTRIES.map(([key, { label, color }]) => {
          const on = !hiddenTypes.has(key);
          return (
            <div key={key} onClick={() => toggleType(key)}
              style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, cursor: "pointer", opacity: on ? 1 : 0.35, transition: "opacity 0.15s" }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: on ? color : "#334155", flexShrink: 0, transition: "background 0.15s" }} />
              <span style={{ flex: 1 }}>{label}</span>
              <div style={{ width: 26, height: 14, borderRadius: 7, background: on ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${on ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)"}`, position: "relative", flexShrink: 0, transition: "all 0.15s" }}>
                <div style={{ position: "absolute", top: 2, left: on ? 13 : 2, width: 8, height: 8, borderRadius: "50%", background: on ? "#60a5fa" : "#334155", transition: "all 0.15s" }} />
              </div>
            </div>
          );
        })}
        {(subNetworks || []).some(s => s.analysisMode !== "problems") && (
          <>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />
            <div onClick={() => setSolutionsVisible(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", opacity: solutionsVisible ? 1 : 0.35, transition: "opacity 0.15s" }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: solutionsVisible ? "#10b981" : "#334155", flexShrink: 0, transition: "background 0.15s" }} />
              <span style={{ flex: 1 }}>Oplossingen</span>
              <div style={{ width: 26, height: 14, borderRadius: 7, background: solutionsVisible ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${solutionsVisible ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)"}`, position: "relative", flexShrink: 0, transition: "all 0.15s" }}>
                <div style={{ position: "absolute", top: 2, left: solutionsVisible ? 13 : 2, width: 8, height: 8, borderRadius: "50%", background: solutionsVisible ? "#60a5fa" : "#334155", transition: "all 0.15s" }} />
              </div>
            </div>
          </>
        )}
        {(subNetworks || []).some(s => s.analysisMode === "problems") && (
          <div onClick={() => setProblemsVisible(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", marginTop: 5, opacity: problemsVisible ? 1 : 0.35, transition: "opacity 0.15s" }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: problemsVisible ? "#dc2626" : "#334155", flexShrink: 0, transition: "background 0.15s" }} />
            <span style={{ flex: 1 }}>Oorzaken</span>
            <div style={{ width: 26, height: 14, borderRadius: 7, background: problemsVisible ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${problemsVisible ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)"}`, position: "relative", flexShrink: 0, transition: "all 0.15s" }}>
              <div style={{ position: "absolute", top: 2, left: problemsVisible ? 13 : 2, width: 8, height: 8, borderRadius: "50%", background: problemsVisible ? "#60a5fa" : "#334155", transition: "all 0.15s" }} />
            </div>
          </div>
        )}
        {analysed && (
          <>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />
            {[
              { label: "% factoren",    on: showMainPct, toggle: () => setShowMainPct(v => !v) },
              { label: "% oplossingen", on: showSolPct,  toggle: () => setShowSolPct(v => !v) },
            ].map(({ label, on, toggle }) => (
              <div key={label} onClick={toggle}
                style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, cursor: "pointer", opacity: on ? 1 : 0.35, transition: "opacity 0.15s" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: on ? "#e2e8f0" : "#334155", width: 9, textAlign: "center", flexShrink: 0 }}>%</span>
                <span style={{ flex: 1 }}>{label}</span>
                <div style={{ width: 26, height: 14, borderRadius: 7, background: on ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${on ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)"}`, position: "relative", flexShrink: 0, transition: "all 0.15s" }}>
                  <div style={{ position: "absolute", top: 2, left: on ? 13 : 2, width: 8, height: 8, borderRadius: "50%", background: on ? "#60a5fa" : "#334155", transition: "all 0.15s" }} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Sub-network type legends bottom-center ──────────────────────────── */}
      {(subNetworks || []).length > 0 && (
        <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
          {solutionsVisible && (subNetworks || []).some(s => s.analysisMode !== "problems") && (
            <div style={{
              background: "rgba(8,13,26,0.88)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "10px 14px", fontSize: 10, color: "#475569", userSelect: "none",
              display: "flex", flexDirection: "column", gap: 0
            }}>
              <div style={{ color: "#64748b", fontWeight: 600, letterSpacing: 0.5, fontSize: 9, textTransform: "uppercase", marginBottom: 7 }}>Oplossingen</div>
              {Object.entries(SOLUTION_TYPES).map(([key, { label, color }]) => {
                const on = !hiddenSolTypes.has(key);
                return (
                  <div key={key} onClick={() => toggleSolType(key)}
                    style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, cursor: "pointer", opacity: on ? 1 : 0.35, transition: "opacity 0.15s" }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: on ? color : "#334155", flexShrink: 0, transition: "background 0.15s" }} />
                    <span style={{ flex: 1, whiteSpace: "nowrap" }}>{label}</span>
                    <div style={{ width: 26, height: 14, borderRadius: 7, background: on ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${on ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)"}`, position: "relative", flexShrink: 0, transition: "all 0.15s" }}>
                      <div style={{ position: "absolute", top: 2, left: on ? 13 : 2, width: 8, height: 8, borderRadius: "50%", background: on ? "#60a5fa" : "#334155", transition: "all 0.15s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {problemsVisible && (subNetworks || []).some(s => s.analysisMode === "problems") && (
            <div style={{
              background: "rgba(8,13,26,0.88)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "10px 14px", fontSize: 10, color: "#475569", userSelect: "none",
              display: "flex", flexDirection: "column", gap: 0
            }}>
              <div style={{ color: "#64748b", fontWeight: 600, letterSpacing: 0.5, fontSize: 9, textTransform: "uppercase", marginBottom: 7 }}>Oorzaken</div>
              {Object.entries(PROBLEM_TYPES).map(([key, { label, color }]) => {
                const on = !hiddenProbTypes.has(key);
                return (
                  <div key={key} onClick={() => toggleProbType(key)}
                    style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, cursor: "pointer", opacity: on ? 1 : 0.35, transition: "opacity 0.15s" }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: on ? color : "#334155", flexShrink: 0, transition: "background 0.15s" }} />
                    <span style={{ flex: 1, whiteSpace: "nowrap" }}>{label}</span>
                    <div style={{ width: 26, height: 14, borderRadius: 7, background: on ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${on ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)"}`, position: "relative", flexShrink: 0, transition: "all 0.15s" }}>
                      <div style={{ position: "absolute", top: 2, left: on ? 13 : 2, width: 8, height: 8, borderRadius: "50%", background: on ? "#60a5fa" : "#334155", transition: "all 0.15s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Correlation legend bottom-right ──────────────────────────────────── */}
      {analysed && (
        <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(8,13,26,0.88)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", fontSize: 10, color: "#475569" }}>
          <div style={{ marginBottom: 7, color: "#64748b", fontWeight: 600, letterSpacing: 0.5, fontSize: 9, textTransform: "uppercase" }}>Legenda</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width={44} height={8}><line x1={0} y1={4} x2={44} y2={4} stroke="#94a3b8" strokeWidth={1.5} /></svg>
            <span>zwak verband</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width={44} height={14}><line x1={0} y1={7} x2={44} y2={7} stroke="#94a3b8" strokeWidth={8} /></svg>
            <span>sterk verband</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width={20} height={20}><circle cx={10} cy={10} r={5} fill="#94a3b8" /></svg>
            <span>lage invloed</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width={20} height={20}><circle cx={10} cy={10} r={10} fill="#94a3b8" /></svg>
            <span>hoge invloed</span>
          </div>
        </div>
      )}
    </div>
  );
}
