import { useState } from "react";
import { TYPES, SOLUTION_TYPES, PROBLEM_TYPES } from "../constants";

const ALL_TYPES = { ...TYPES, ...SOLUTION_TYPES, ...PROBLEM_TYPES };

export default function DataTab({ nodes, edges, influence, analysed, problem, subAnalyses }) {
  const [csvReady, setCsvReady] = useState("");

  if (!analysed) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360 }}>
          <div style={{ fontSize: 42 }}>{"\ud83d\udcca"}</div>
          <p style={{ color: "#334155", fontSize: 13, marginTop: 10 }}>Voer eerst een AI Analyse uit om de data te exporteren.</p>
        </div>
      </div>
    );
  }

  const center = nodes.find(n => n.type === "maingoal") || nodes.find(n => n.type === "goal");
  const factorRows = nodes.filter(n => n.id !== center?.id).map(n => {
    const inf = influence?.[n.label];
    const edge = edges.find(e => e.from === n.id && e.to === center?.id);
    const subEdges = edges.filter(e => e.from === n.id && e.to !== center?.id);
    return { node: n, inf, corrMain: edge?.correlation, subEdges };
  }).sort((a, b) => (b.inf || 0) - (a.inf || 0));

  const subgoals = nodes.filter(n => n.type === "goal" && n.id !== center?.id);

  // Analysed solution sets
  const solSets = (subAnalyses || []).filter(s => s.analysed && s.nodes?.length > 0);

  const buildCsv = () => {
    const lines = [];
    // Main factors table
    const headers = ["Factor", "Type", "Invloed op hoofddoel (%)", "Correlatie hoofddoel (r)",
      ...subgoals.map(g => `Correlatie: ${g.label} (r)`)];
    lines.push(headers);
    factorRows.forEach(r => {
      lines.push([
        r.node.label,
        TYPES[r.node.type]?.label || r.node.type,
        r.inf != null ? (r.inf * 100).toFixed(1) : "",
        r.corrMain != null ? r.corrMain.toFixed(3) : "",
        ...subgoals.map(g => {
          const e = r.subEdges.find(se => se.to === g.id);
          return e ? e.correlation.toFixed(3) : "";
        })
      ]);
    });
    // Solution tables
    solSets.forEach(s => {
      lines.push([]);
      const isProb = s.analysisMode === "problems";
      lines.push([`${isProb ? "Oorzaken" : "Oplossingen"}: ${s.factorLabel}`]);
      const solRows = [...s.nodes].sort((a, b) => (s.influence?.[b.label] || 0) - (s.influence?.[a.label] || 0));
      const solHeaders = [isProb ? "Oorzaak" : "Oplossing", "Type", isProb ? "Bijdrage (%)" : "Effectiviteit (%)",
        ...solRows.map(n => `Synergie: ${n.label} (r)`)];
      lines.push(solHeaders);
      solRows.forEach(sn => {
        const eff = s.influence?.[sn.label];
        lines.push([
          sn.label,
          ALL_TYPES[sn.type]?.label || sn.type,
          eff != null ? (eff * 100).toFixed(1) : "",
          ...solRows.map(other => {
            if (other.id === sn.id) return "";
            const e = s.edges?.find(e =>
              (e.from === sn.id && e.to === other.id) || (e.from === other.id && e.to === sn.id));
            return e ? e.correlation.toFixed(3) : "";
          })
        ]);
      });
    });
    return lines.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  };

  const exportExcel = () => {
    const csv = buildCsv();
    try {
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
      a.download = `CausalNet_${problem.slice(0, 30).replace(/\s+/g, "_")}.csv`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 100);
    } catch (e) {}
    setCsvReady(csv);
  };

  // Reusable mini toggle
  const Toggle = ({ on }) => (
    <div style={{ width: 26, height: 14, borderRadius: 7,
      background: on ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${on ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)"}`,
      position: "relative", flexShrink: 0, transition: "all 0.15s" }}>
      <div style={{ position: "absolute", top: 2, left: on ? 13 : 2, width: 8, height: 8,
        borderRadius: "50%", background: on ? "#60a5fa" : "#334155", transition: "all 0.15s" }} />
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{problem}</div>
          <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>
            {factorRows.length} factoren &middot; hoofddoel: {center?.label}
            {solSets.length > 0 && ` \u00b7 ${solSets.length} oplossingsset${solSets.length > 1 ? "s" : ""}`}
          </div>
        </div>
        <button onClick={exportExcel}
          style={{ padding: "8px 18px", background: "linear-gradient(135deg,#34d399,#059669)", border: "none", borderRadius: 8, color: "#000", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          {"\u2b07"} Download CSV / Excel
        </button>
      </div>

      {csvReady && (
        <div style={{ marginBottom: 16, padding: 12, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#34d399" }}>{"\u2713"} CSV klaar &mdash; kopieer de inhoud hieronder en plak in Excel of sla op als .csv</span>
            <button onClick={() => { navigator.clipboard?.writeText(csvReady); }}
              style={{ padding: "4px 10px", background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 6, color: "#34d399", fontSize: 11, cursor: "pointer" }}>
              {"\ud83d\udccb"} Kopieer
            </button>
          </div>
          <textarea readOnly value={csvReady} rows={4}
            style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6,
              color: "#64748b", fontSize: 10, fontFamily: "monospace", padding: "6px 8px", boxSizing: "border-box", resize: "vertical" }} />
        </div>
      )}

      {/* ── Factors table ── */}
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#475569", marginBottom: 8 }}>Factoren</div>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {["Factor", "Type", "Invloed %", "r Hoofddoel",
                ...subgoals.map(g => g.label.length > 16 ? g.label.slice(0, 14) + "\u2026" : g.label)
              ].map((h, i) => (
                <th key={i} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "#475569", whiteSpace: "nowrap", background: "rgba(255,255,255,0.02)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factorRows.map((r, ri) => {
              const tc = TYPES[r.node.type]?.color || "#888";
              return (
                <tr key={r.node.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: ri % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                  <td style={{ padding: "7px 10px", color: "#e2e8f0", minWidth: 180, verticalAlign: "top" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: tc, flexShrink: 0, marginTop: 4 }} />
                      <span style={{ lineHeight: 1.4, wordBreak: "break-word" }}>{r.node.label}</span>
                    </div>
                  </td>
                  <td style={{ padding: "7px 10px", color: "#64748b", whiteSpace: "nowrap" }}>{TYPES[r.node.type]?.label}</td>
                  <td style={{ padding: "7px 10px" }}>
                    {r.inf != null ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 60, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: (r.inf * 100) + "%", height: "100%", background: tc, borderRadius: 2 }} />
                        </div>
                        <span style={{ color: tc, fontWeight: 600 }}>{(r.inf * 100).toFixed(0)}%</span>
                      </div>
                    ) : "\u2014"}
                  </td>
                  <td style={{ padding: "7px 10px", color: r.corrMain > 0.6 ? "#34d399" : r.corrMain > 0.4 ? "#f59e0b" : "#94a3b8", fontWeight: r.corrMain > 0.5 ? "600" : "400" }}>
                    {r.corrMain != null ? r.corrMain.toFixed(2) : "\u2014"}
                  </td>
                  {subgoals.map(g => {
                    const e = r.subEdges.find(se => se.to === g.id);
                    return (
                      <td key={g.id} style={{ padding: "7px 10px", color: e && e.correlation > 0.5 ? "#60a5fa" : "#475569" }}>
                        {e ? e.correlation.toFixed(2) : "\u2014"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Solution tables ── */}
      {solSets.map(s => {
        const isProb     = s.analysisMode === "problems";
        const factorColor = ALL_TYPES[s.factorType]?.color || "#888";
        const accentColor = isProb ? "#f87171" : "#60a5fa";
        const solRows = [...s.nodes].sort((a, b) => (s.influence?.[b.label] || 0) - (s.influence?.[a.label] || 0));
        return (
          <div key={s.id} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: factorColor, flexShrink: 0 }} />
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: accentColor }}>
                {isProb ? "Oorzaken" : "Oplossingen"} &mdash; {s.factorLabel}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {[isProb ? "Oorzaak" : "Oplossing", "Type", isProb ? "Bijdrage %" : "Effectiviteit %",
                      ...solRows.map(n => n.label.length > 14 ? n.label.slice(0, 12) + "\u2026" : n.label)
                    ].map((h, i) => (
                      <th key={i} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "#475569", whiteSpace: "nowrap", background: "rgba(255,255,255,0.02)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {solRows.map((sn, ri) => {
                    const sc = ALL_TYPES[sn.type]?.color || "#64748b";
                    const eff = s.influence?.[sn.label];
                    return (
                      <tr key={sn.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: ri % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                        <td style={{ padding: "7px 10px", color: "#e2e8f0", minWidth: 180, verticalAlign: "top" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: sc, flexShrink: 0, marginTop: 4 }} />
                            <span style={{ lineHeight: 1.4, wordBreak: "break-word" }}>{sn.label}</span>
                          </div>
                        </td>
                        <td style={{ padding: "7px 10px", color: "#64748b", whiteSpace: "nowrap" }}>
                          {ALL_TYPES[sn.type]?.label || sn.type}
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          {eff != null ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 60, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ width: (eff * 100) + "%", height: "100%", background: sc, borderRadius: 2 }} />
                              </div>
                              <span style={{ color: sc, fontWeight: 600 }}>{(eff * 100).toFixed(0)}%</span>
                            </div>
                          ) : "\u2014"}
                        </td>
                        {/* Synergie per andere oplossing */}
                        {solRows.map(other => {
                          if (other.id === sn.id) return (
                            <td key={other.id} style={{ padding: "7px 10px", color: "#1e293b" }}>&mdash;</td>
                          );
                          const e = s.edges?.find(e =>
                            (e.from === sn.id && e.to === other.id) || (e.from === other.id && e.to === sn.id));
                          const corr = e?.correlation;
                          return (
                            <td key={other.id} style={{ padding: "7px 10px", color: corr > 0.6 ? "#34d399" : corr > 0.4 ? "#f59e0b" : "#475569", fontWeight: corr > 0.5 ? "600" : "400" }}>
                              {corr != null ? corr.toFixed(2) : "\u2014"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
