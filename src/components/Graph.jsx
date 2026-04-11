import { useState, useRef, useCallback } from "react";
import { TYPES, nodeRadius, edgeWidth } from "../constants";

const TYPE_LEGEND = Object.entries(TYPES).map(([, v]) => ({ label: v.label, color: v.color }));

export default function Graph({ nodes, edges, positions, selected, onSelect, influence, W, H, analysed, posRef, onDragNode }) {
  const [tooltip, setTooltip] = useState(null);
  const dragRef = useRef(null); // { nodeId, startX, startY, origX, origY }
  const svgRef = useRef(null);
  const didDragRef = useRef(false);

  const toSvgCoords = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height),
    };
  }, [W, H]);

  const handleMouseDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    const coords = toSvgCoords(e.clientX, e.clientY);
    const pos = positions[nodeId];
    if (!pos) return;
    didDragRef.current = false;
    dragRef.current = { nodeId, startX: coords.x, startY: coords.y, origX: pos.x, origY: pos.y };
  }, [toSvgCoords, positions]);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const { nodeId, startX, startY, origX, origY } = dragRef.current;
    const coords = toSvgCoords(e.clientX, e.clientY);
    const dx = coords.x - startX, dy = coords.y - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
    const r = nodeRadius(nodes.find(n => n.id === nodeId) || { type: "risk", label: "" }, influence);
    const pad = r + 15;
    onDragNode(nodeId,
      Math.max(pad, Math.min(W - pad, origX + dx)),
      Math.max(pad, Math.min(H - pad, origY + dy))
    );
  }, [toSvgCoords, onDragNode, nodes, influence, W, H]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} width={W} height={H} style={{ display: "block", width: "100%", height: "100%" }}
        onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
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

        {edges.map(e => {
          const fp = positions[e.from], tp = positions[e.to];
          if (!fp || !tp) return null;
          const fromNode = nodes.find(n => n.id === e.from);
          const toNode = nodes.find(n => n.id === e.to);
          const corr = e.correlation ?? 0.3;
          const sw = edgeWidth(corr);
          const toIsMaingoal = toNode?.type === "maingoal";
          const toIsGoal = toNode?.type === "goal";
          const isInterFactor = !toIsMaingoal && !toIsGoal;
          const col = isInterFactor ? "#64748b" : TYPES[fromNode?.type]?.color || "#888";
          const rFrom = nodeRadius(fromNode || { type: "risk", label: "" }, influence);
          const dx = tp.x - fp.x, dy = tp.y - fp.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const sx = fp.x + (dx / d) * rFrom, sy = fp.y + (dy / d) * rFrom;
          const curve = isInterFactor ? 20 : 38;
          const cx = (sx + tp.x) / 2 - (dy / d) * curve, cy = (sy + tp.y) / 2 + (dx / d) * curve;
          const opacity = toIsMaingoal ? 0.65 : toIsGoal ? 0.5 : 0.3;
          const dashArray = isInterFactor ? "5 4" : "none";

          return (
            <g key={e.id}
              onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY,
                text: (isInterFactor ? "factor\u2194factor" : "\u2192 " + toNode?.label) + ` \u00b7 r=${corr.toFixed(2)}` })}
              onMouseLeave={() => setTooltip(null)}>
              {corr > 0.5 && <path d={"M" + sx + "," + sy + " Q" + cx + "," + cy + " " + tp.x + "," + tp.y}
                fill="none" stroke={col} strokeWidth={sw + 6} strokeOpacity={0.07} />}
              {corr > 0.7 && <path d={"M" + sx + "," + sy + " Q" + cx + "," + cy + " " + tp.x + "," + tp.y}
                fill="none" stroke={col} strokeWidth={sw + 2} strokeOpacity={0.13} />}
              <path d={"M" + sx + "," + sy + " Q" + cx + "," + cy + " " + tp.x + "," + tp.y}
                fill="none" stroke={col}
                strokeWidth={isInterFactor ? Math.max(1, sw * 0.55) : sw}
                strokeOpacity={analysed ? opacity : opacity * 0.45}
                strokeDasharray={dashArray}
                strokeLinecap="round"
                style={{ cursor: "crosshair" }} />
              {analysed && corr > 0.45 && !isInterFactor && (
                <text x={(sx + tp.x) / 2 - (dy / d) * 14} y={(sy + tp.y) / 2 + (dx / d) * 14}
                  textAnchor="middle" fontSize={corr > 0.65 ? 10 : 8}
                  fill={col} opacity={corr > 0.65 ? 0.85 : 0.55}
                  fontFamily="sans-serif" fontWeight={corr > 0.65 ? "600" : "400"}>
                  {corr.toFixed(2)}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map(n => {
          const p = positions[n.id]; if (!p) return null;
          const t = TYPES[n.type];
          const r = nodeRadius(n, influence);
          const isSel = selected === n.id;
          const inf = influence?.[n.label];
          return (
            <g key={n.id}
              onMouseDown={e => handleMouseDown(e, n.id)}
              onClick={() => { if (!didDragRef.current) onSelect(isSel ? null : n.id); }}
              onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: n.label + (inf != null ? " \u00b7 invloed: " + (inf * 100).toFixed(0) + "%" : "") })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: dragRef.current ? "grabbing" : "grab" }}>
              <circle cx={p.x} cy={p.y} r={r + 14} fill={t.color} opacity={isSel ? 0.22 : inf > 0.7 ? 0.14 : 0.05} />
              {inf > 0.7 && <circle cx={p.x} cy={p.y} r={r + 7} fill={t.color} opacity={0.08} />}
              {n.type === "maingoal"
                ? <polygon
                    points={p.x + "," + (p.y - r) + " " + (p.x + r) + "," + p.y + " " + p.x + "," + (p.y + r) + " " + (p.x - r) + "," + p.y}
                    fill={t.color} fillOpacity={0.93}
                    stroke={isSel ? "#fff" : t.color} strokeWidth={isSel ? 3 : 2}
                    filter="url(#glow)" />
                : <circle cx={p.x} cy={p.y} r={r}
                    fill={t.color} fillOpacity={0.88}
                    stroke={isSel ? "#fff" : "rgba(255,255,255,0.2)"} strokeWidth={isSel ? 3 : 1}
                    filter={isSel || inf > 0.65 ? "url(#glow-sm)" : ""} />
              }
              {analysed && inf > 0.65 && n.type !== "maingoal" && (
                <circle cx={p.x} cy={p.y} r={r + 6}
                  fill="none" stroke={t.color} strokeWidth={1.5} strokeOpacity={0.5}
                  strokeDasharray="4 3" />
              )}
              {(() => {
                const words = n.label.split(" ");
                const lines = [];
                let cur = "";
                const maxChars = 16;
                words.forEach(w => {
                  if ((cur + " " + w).trim().length <= maxChars) {
                    cur = (cur + " " + w).trim();
                  } else {
                    if (cur) lines.push(cur);
                    cur = w.length > maxChars ? w.slice(0, maxChars - 1) + "\u2026" : w;
                  }
                });
                if (cur) lines.push(cur);
                const fs = Math.max(9, Math.min(11, 9 + (inf || 0) * 2));
                const lineH = fs + 2;
                const totalH = lines.length * lineH;
                const yStart = p.y + r + 13;
                return (
                  <text textAnchor="middle" fontFamily="sans-serif" fontSize={fs}
                    fontWeight={inf > 0.65 ? "600" : "400"} fill="#e2e8f0"
                    style={{ pointerEvents: "none", userSelect: "none" }}>
                    {lines.map((l, li) => (
                      <tspan key={li} x={p.x} y={yStart + li * lineH}>{l}</tspan>
                    ))}
                    {analysed && inf != null && n.type !== "maingoal" && (
                      <tspan x={p.x} y={yStart + totalH + 1} fontSize={9} fill={t.color} opacity={0.85} fontWeight="600">
                        {(inf * 100).toFixed(0)}%
                      </tspan>
                    )}
                  </text>
                );
              })()}
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div style={{ position: "fixed", left: tooltip.x + 12, top: tooltip.y - 8,
          background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6, padding: "4px 9px", fontSize: 11, color: "#e2e8f0", pointerEvents: "none", zIndex: 999, whiteSpace: "nowrap" }}>
          {tooltip.text}
        </div>
      )}

      {/* Type legend — bottom left */}
      <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(8,13,26,0.88)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", fontSize: 10, color: "#475569" }}>
        <div style={{ marginBottom: 7, color: "#64748b", fontWeight: 600, letterSpacing: 0.5, fontSize: 9, textTransform: "uppercase" }}>Legenda</div>
        {TYPE_LEGEND.map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {analysed && (
        <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(8,13,26,0.88)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", fontSize: 10, color: "#475569" }}>
          <div style={{ marginBottom: 7, color: "#64748b", fontWeight: 600, letterSpacing: 0.5, fontSize: 9, textTransform: "uppercase" }}>Legenda</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width={44} height={8}><line x1={0} y1={4} x2={44} y2={4} stroke="#94a3b8" strokeWidth={1.5} /></svg>
            <span>zwak verband (r\u22480.1)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width={44} height={14}><line x1={0} y1={7} x2={44} y2={7} stroke="#94a3b8" strokeWidth={8} /></svg>
            <span>sterk verband (r\u22480.7)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width={44} height={8}><line x1={0} y1={4} x2={44} y2={4} stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" /></svg>
            <span>factor\u2194factor correlatie</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width={20} height={20}><circle cx={10} cy={10} r={5} fill="#94a3b8" /></svg>
            <span>lage invloed \u00b7 ver van doel</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width={20} height={20}><circle cx={10} cy={10} r={10} fill="#94a3b8" /></svg>
            <span>hoge invloed \u00b7 dicht bij doel</span>
          </div>
        </div>
      )}
    </div>
  );
}
