import { useState } from "react";
import { TYPES } from "../constants";
import { renderReport } from "../utils/renderReport";
import { exportTextPdf, exportFullPdf } from "../utils/exportPdf";
import { exportAnalysisPdfWhite, exportAnalysisWord } from "../utils/exportWhite";

export default function AnalysisTab({ nodes, steps, anaError, anaLoading, report, showRaw, setShowRaw, influence, analysed, onReanalyse, analysisPanelRef, networkPanelRef, problem, supplementSections, addSourceQuick }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [quickSource, setQuickSource] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState("");
  return (
    <div ref={analysisPanelRef} style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      {steps.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
          {steps.map(st => (
            <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: st.done ? "#34d399" : "#f59e0b", boxShadow: st.done ? "0 0 7px #34d399" : "0 0 7px #f59e0b" }} />
              <span style={{ fontSize: 12, color: st.done ? "#334155" : "#e2e8f0" }}>{st.txt}</span>
            </div>
          ))}
        </div>
      )}
      {anaError && <div style={{ padding: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 7, color: "#f87171", fontSize: 12, marginBottom: 12 }}>{anaError}</div>}
      {!anaLoading && !report && steps.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360 }}>
          <div style={{ fontSize: 42 }}>{"\ud83d\udccb"}</div>
          <p style={{ color: "#334155", fontSize: 13, marginTop: 10 }}>Klik "AI Analyse" om correlaties en invloeden te berekenen.</p>
        </div>
      )}
      {report && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "inline-block", padding: "5px 12px", background: "rgba(52,211,153,0.09)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 20, color: "#34d399", fontSize: 11 }}>
              {"\u2713"} Gewogen analyse compleet &middot; {nodes.length} factoren
            </div>
            <button onClick={async () => {
              setPdfLoading(true);
              try { await exportAnalysisPdfWhite(report, problem); }
              catch (e) { alert("PDF mislukt: " + e.message); }
              setPdfLoading(false);
            }} disabled={pdfLoading}
              style={{ padding: "4px 10px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, color: "#60a5fa", fontSize: 10, cursor: pdfLoading ? "wait" : "pointer" }}>
              {pdfLoading ? "\u23f3" : "\ud83d\udcc4"} PDF (wit)
            </button>
            <button onClick={() => {
              try { exportAnalysisWord(report, problem); }
              catch (e) { alert("Word export mislukt: " + e.message); }
            }}
              style={{ padding: "4px 10px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 8, color: "#34d399", fontSize: 10, cursor: "pointer" }}>
              📝 Word
            </button>
            <button onClick={async () => {
              setPdfLoading(true);
              try { await exportFullPdf(networkPanelRef, analysisPanelRef, nodes, influence, problem); }
              catch (e) { alert("PDF mislukt: " + e.message); }
              setPdfLoading(false);
            }} disabled={pdfLoading}
              style={{ padding: "4px 10px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 8, color: "#a78bfa", fontSize: 10, cursor: pdfLoading ? "wait" : "pointer" }}>
              {pdfLoading ? "\u23f3" : "\ud83d\udcc4"} PDF Volledig
            </button>
            <button onClick={() => setShowRaw(r => !r)}
              style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#475569", fontSize: 10, cursor: "pointer" }}>
              {showRaw ? "\u25b2 Verberg ruwe tekst" : "\u25bc Toon ruwe tekst (debug)"}
            </button>
          </div>
          {/* ── Invloedscores grafiek — bovenaan ── */}
          {influence && nodes.filter(n => n.type !== "maingoal").length > 0 && (
            <div data-pdf-hide style={{ marginBottom: 20, padding: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#475569", marginBottom: 10 }}>Invloedscores per factor</div>
              {nodes.filter(n => n.type !== "maingoal").sort((a, b) => (influence?.[b.label] || 0) - (influence?.[a.label] || 0)).map(n => {
                const inf = influence?.[n.label] ?? 0;
                const t = TYPES[n.type];
                return (
                  <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#64748b", width: 180, flexShrink: 0, lineHeight: 1.4, wordBreak: "break-word" }}>{n.label}</span>
                    <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: (inf * 100) + "%", height: "100%", background: t.color, borderRadius: 3, opacity: 0.8 }} />
                    </div>
                    <span style={{ fontSize: 10, color: t.color, width: 30, textAlign: "right" }}>{(inf * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
              {/* Legenda */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                {Object.entries(TYPES).filter(([k]) => k !== "maingoal").map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "#475569" }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showRaw && (
            <pre style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", background: "rgba(0,0,0,0.3)",
              padding: 12, borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap", marginBottom: 16, maxHeight: 300, overflowY: "auto" }}>
              {report}
            </pre>
          )}
          {renderReport(report)}

          <div data-pdf-hide style={{ marginTop: 24, padding: 16, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 12 }}>
            <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>{"\ud83d\udd04"} Heranalyse uitvoeren</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12, lineHeight: 1.6 }}>
              Pas bronnen en/of factoren aan en voer de analyse opnieuw uit met je nieuwe selectie.
            </div>
            <button onClick={onReanalyse}
              style={{ padding: "10px 20px", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
              {"\ud83d\udd04"} Bronnen &amp; factoren aanpassen &rarr;
            </button>
          </div>

          {/* Quick add source */}
          <div data-pdf-hide style={{ marginTop: 24, padding: 16, background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 12 }}>
            <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>{"\u2795"} Bron toevoegen</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12, lineHeight: 1.6 }}>
              Voeg een bron toe en krijg een korte analyse van de relevantie voor je factoren &mdash; zonder volledige heranalyse.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={quickSource} onChange={e => setQuickSource(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && quickSource.trim() && !quickLoading) {
                    setQuickLoading(true); setQuickError("");
                    addSourceQuick(quickSource.trim())
                      .then(() => setQuickSource(""))
                      .catch(e => setQuickError(e.message))
                      .finally(() => setQuickLoading(false));
                  }
                }}
                placeholder="URL of referentie (bijv. https://doi.org/... of Auteur et al., 2023)"
                style={{ flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, color: "#e2e8f0", fontSize: 12, outline: "none" }} />
              <button onClick={() => {
                if (!quickSource.trim() || quickLoading) return;
                setQuickLoading(true); setQuickError("");
                addSourceQuick(quickSource.trim())
                  .then(() => setQuickSource(""))
                  .catch(e => setQuickError(e.message))
                  .finally(() => setQuickLoading(false));
              }} disabled={quickLoading || !quickSource.trim()}
                style={{ padding: "9px 18px", background: quickSource.trim() && !quickLoading ? "linear-gradient(135deg,#60a5fa,#3b82f6)" : "#1e293b",
                  border: "none", borderRadius: 8, color: quickSource.trim() && !quickLoading ? "#fff" : "#334155",
                  fontSize: 12, fontWeight: 600, cursor: quickSource.trim() && !quickLoading ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                {quickLoading ? "\u23f3 Analyseren\u2026" : "+ Analyseer bron"}
              </button>
            </div>
            {quickError && <div style={{ marginTop: 8, fontSize: 11, color: "#f87171" }}>{quickError}</div>}
          </div>

          {/* Supplementary sections */}
          {supplementSections?.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#60a5fa", marginBottom: 12 }}>Toegevoegde bronnen</div>
              {supplementSections.map((s, i) => (
                <div key={i} style={{ marginBottom: 16, padding: 16, background: "rgba(96,165,250,0.06)",
                  border: "1px solid rgba(96,165,250,0.2)", borderLeft: "3px solid #60a5fa", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, marginBottom: 8 }}>
                    {"\ud83d\udcc4"} {s.source.length > 80 ? s.source.slice(0, 77) + "\u2026" : s.source}
                  </div>
                  {renderReport(s.text)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
