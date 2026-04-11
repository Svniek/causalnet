import { useState } from "react";
import { TYPES, uid } from "../constants";
import { readFile } from "../utils/sources";

export default function ReanalysePhase({
  reanalyseStep, setReanalyseStep,
  reanalyseSources, setReanalyseSources,
  reanalyseNodes, setReanalyseNodes,
  reanalyseNewFactor, setReanalyseNewFactor,
  reanalyseNewType, setReanalyseNewType,
  reanalyseNewSource, setReanalyseNewSource,
  sourceMode, setSourceMode,
  uploadedDocs, setUploadedDocs,
  onExecute
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleFileDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || e.target?.files || [])
      .filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!files.length) return;
    try {
      const docs = await Promise.all(files.map(readFile));
      setUploadedDocs(p => [...p, ...docs]);
      docs.forEach(doc => {
        setReanalyseSources(p => [...p, { id: uid(), text: doc.name, url: null, active: true, isDoc: true, docId: doc.id }]);
      });
    } catch (err) {
      alert("PDF laden mislukt: " + err.message);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "radial-gradient(ellipse at 50% 0%,#0d1630,#080d1a)" }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 32px" }}>
        {[{ n: 1, label: "\ud83d\udcda Bronnen" }, { n: 2, label: "\ud83d\udd2c Factoren" }].map(s => (
          <div key={s.n} onClick={() => setReanalyseStep(s.n)}
            style={{ padding: "13px 20px", fontSize: 12, cursor: "pointer", borderBottom: `2px solid ${reanalyseStep === s.n ? "#7c3aed" : "transparent"}`,
              color: reanalyseStep === s.n ? "#a78bfa" : "#334155", marginBottom: -1 }}>
            {s.label}
          </div>
        ))}
      </div>

      {reanalyseStep === 1 && (
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          <h2 style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#f1f5f9", margin: "0 0 6px" }}>Bronnen aanpassen</h2>
          <p style={{ fontSize: 12, color: "#475569", margin: "0 0 20px" }}>Vink bronnen aan of uit en voeg nieuwe toe. Alleen actieve bronnen worden meegenomen in de heranalyse.</p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "#475569" }}>{reanalyseSources.filter(s => s.active).length} / {reanalyseSources.length} bronnen geselecteerd</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setReanalyseSources(p => p.map(s => ({ ...s, active: true })))}
                style={{ background: "none", border: "none", color: "#7c3aed", fontSize: 11, cursor: "pointer", padding: 0 }}>Alles</button>
              <button onClick={() => setReanalyseSources(p => p.map(s => ({ ...s, active: false })))}
                style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: 0 }}>Geen</button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            {reanalyseSources.length === 0 && (
              <div style={{ padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 8, color: "#334155", fontSize: 12, textAlign: "center" }}>
                Geen bronnen gevonden. Voeg hieronder handmatig bronnen toe.
              </div>
            )}
            {reanalyseSources.map(src => (
              <div key={src.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 9,
                marginBottom: 6, border: `1px solid ${src.active ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.05)"}`,
                background: src.active ? "rgba(124,58,237,0.07)" : "rgba(255,255,255,0.02)" }}>
                <div onClick={() => setReanalyseSources(p => p.map(s => s.id === src.id ? { ...s, active: !s.active } : s))}
                  style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${src.active ? "#7c3aed" : "#334155"}`,
                    background: src.active ? "#7c3aed" : "transparent", flexShrink: 0, marginTop: 1, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {src.active && <span style={{ color: "#fff", fontSize: 9, fontWeight: 900 }}>{"\u2713"}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: src.active ? "#e2e8f0" : "#475569", lineHeight: 1.5, wordBreak: "break-word" }}>
                    {src.isDoc ? "\ud83d\udcc4 " : ""}{src.text}
                  </div>
                  {src.url && (
                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: src.active ? "#60a5fa" : "#334155",
                        textDecoration: "underline", wordBreak: "break-all", display: "block", marginTop: 2 }}>
                      {src.url.length > 70 ? src.url.slice(0, 67) + "\u2026" : src.url}
                    </a>
                  )}
                </div>
                <button onClick={() => setReanalyseSources(p => p.filter(s => s.id !== src.id))}
                  style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 14, flexShrink: 0, padding: 0 }}>&times;</button>
              </div>
            ))}
          </div>

          {/* PDF drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            style={{ border: `2px dashed ${dragOver ? "#60a5fa" : "rgba(255,255,255,0.12)"}`, borderRadius: 12,
              padding: "22px 20px", textAlign: "center", marginBottom: 20, cursor: "pointer",
              background: dragOver ? "rgba(96,165,250,0.06)" : "rgba(255,255,255,0.02)", transition: "all 0.2s" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{"\ud83d\udcc4"}</div>
            <p style={{ color: "#475569", fontSize: 12, margin: "0 0 8px" }}>Sleep PDF bestanden hierheen</p>
            <label style={{ padding: "6px 14px", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
              borderRadius: 8, color: "#60a5fa", fontSize: 11, cursor: "pointer", display: "inline-block" }}>
              Of selecteer bestanden
              <input type="file" accept=".pdf,application/pdf" multiple onChange={handleFileDrop} style={{ display: "none" }} />
            </label>
            <p style={{ color: "#334155", fontSize: 10, margin: "6px 0 0" }}>PDF bestanden toevoegen</p>
          </div>

          <div style={{ padding: 16, background: "rgba(255,255,255,0.025)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Nieuwe bron toevoegen</div>
            <input value={reanalyseNewSource} onChange={e => setReanalyseNewSource(e.target.value)}
              placeholder="Bijv. 'Cacioppo et al. (2010) \u2014 https://doi.org/...'"
              style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <button onClick={() => {
              if (!reanalyseNewSource.trim()) return;
              const urlMatch = reanalyseNewSource.match(/https?:\/\/[^\s)]+/);
              setReanalyseSources(p => [...p, { id: uid(), text: reanalyseNewSource.trim(), url: urlMatch ? urlMatch[0] : null, active: true }]);
              setReanalyseNewSource("");
            }} style={{ padding: "8px 16px", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
              borderRadius: 7, color: "#60a5fa", fontSize: 12, cursor: "pointer" }}>+ Toevoegen</button>
          </div>

          <div style={{ padding: 14, background: "rgba(255,255,255,0.025)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Brongebruik</div>
            {[
              { val: "own", label: "\ud83d\udcc2 Alleen geselecteerde bronnen" },
              { val: "both", label: "\ud83d\udd2c Geselecteerde bronnen + aanvullende literatuur" }
            ].map(opt => (
              <label key={opt.val} onClick={() => setSourceMode(opt.val)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, marginBottom: 6, cursor: "pointer",
                  border: `1px solid ${sourceMode === opt.val ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.05)"}`,
                  background: sourceMode === opt.val ? "rgba(124,58,237,0.08)" : "transparent" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${sourceMode === opt.val ? "#7c3aed" : "#334155"}`,
                  background: sourceMode === opt.val ? "#7c3aed" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {sourceMode === opt.val && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                </div>
                <span style={{ fontSize: 12, color: sourceMode === opt.val ? "#e2e8f0" : "#475569" }}>{opt.label}</span>
              </label>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setReanalyseStep(2)}
              style={{ padding: "11px 24px", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", border: "none", borderRadius: 9,
                color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
              Volgende: Factoren &rarr;
            </button>
          </div>
        </div>
      )}

      {reanalyseStep === 2 && (
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          <h2 style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#f1f5f9", margin: "0 0 6px" }}>Factoren aanpassen</h2>
          <p style={{ fontSize: 12, color: "#475569", margin: "0 0 20px" }}>Vink factoren aan of uit en voeg nieuwe toe. Alleen actieve factoren worden meegenomen.</p>

          {Object.entries(TYPES).map(([typeKey, typeVal]) => {
            const typeNodes = reanalyseNodes.filter(n => n.type === typeKey);
            if (!typeNodes.length) return null;
            return (
              <div key={typeKey} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: typeVal.color }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>{typeVal.label}</span>
                </div>
                {typeNodes.map(n => (
                  <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, marginBottom: 5,
                    border: `1px solid ${n.active ? typeVal.color + "33" : "rgba(255,255,255,0.05)"}`,
                    background: n.active ? typeVal.color + "0d" : "rgba(255,255,255,0.02)" }}>
                    <div onClick={() => setReanalyseNodes(p => p.map(nd => nd.id === n.id ? { ...nd, active: !nd.active } : nd))}
                      style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${n.active ? typeVal.color : "#334155"}`,
                        background: n.active ? typeVal.color : "transparent", flexShrink: 0, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {n.active && <span style={{ color: "#000", fontSize: 8, fontWeight: 900 }}>{"\u2713"}</span>}
                    </div>
                    <span style={{ fontSize: 12, color: n.active ? "#e2e8f0" : "#475569", flex: 1, lineHeight: 1.4 }}>{n.label}</span>
                    <button onClick={() => setReanalyseNodes(p => p.filter(nd => nd.id !== n.id))}
                      style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 14, padding: 0 }}>&times;</button>
                  </div>
                ))}
              </div>
            );
          })}

          <div style={{ padding: 16, background: "rgba(255,255,255,0.025)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Nieuwe factor toevoegen</div>
            <input value={reanalyseNewFactor} onChange={e => setReanalyseNewFactor(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && reanalyseNewFactor.trim()) {
                  setReanalyseNodes(p => [...p, { id: uid(), label: reanalyseNewFactor.trim(), type: reanalyseNewType, active: true }]);
                  setReanalyseNewFactor("");
                }
              }}
              placeholder="Naam van nieuwe factor..."
              style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <select value={reanalyseNewType} onChange={e => setReanalyseNewType(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", background: "#0d1225", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 7, color: "#e2e8f0", fontSize: 12, outline: "none" }}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={() => {
                if (!reanalyseNewFactor.trim()) return;
                setReanalyseNodes(p => [...p, { id: uid(), label: reanalyseNewFactor.trim(), type: reanalyseNewType, active: true }]);
                setReanalyseNewFactor("");
              }} style={{ padding: "8px 16px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 7, color: "#f59e0b", fontSize: 12, cursor: "pointer" }}>+ Toevoegen</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setReanalyseStep(1)}
              style={{ padding: "11px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, color: "#475569", fontSize: 13, cursor: "pointer" }}>
              &larr; Terug
            </button>
            <button onClick={onExecute}
              style={{ padding: "11px 24px", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", border: "none", borderRadius: 9,
                color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
              {"\ud83d\udd2c"} Heranalyse uitvoeren &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
