import { useState, useEffect } from "react";
import { SOLUTION_TYPES, PROBLEM_TYPES, uid } from "../constants";
import { extractSourcesFromReport } from "../utils/sources";

export default function SubReanalysePanel({ sub, onExecute, onCancel }) {
  const isProblems = sub.analysisMode === "problems";
  const TYPE_MAP   = isProblems ? PROBLEM_TYPES : SOLUTION_TYPES;
  const accentCol  = isProblems ? "#f87171" : "#34d399";
  const accentBg   = isProblems ? "rgba(248,113,113,0.12)" : "rgba(52,211,153,0.12)";
  const accentBrd  = isProblems ? "rgba(248,113,113,0.35)" : "rgba(52,211,153,0.35)";

  const [step,        setStep]        = useState(1);
  const [sources,     setSources]     = useState([]);
  const [nodes,       setNodes]       = useState([]);
  const [newSource,   setNewSource]   = useState("");
  const [newLabel,    setNewLabel]    = useState("");
  const [newType,     setNewType]     = useState(Object.keys(TYPE_MAP)[0]);
  const [sourceMode,  setSourceMode]  = useState("both");

  // Initialise from existing sub data
  useEffect(() => {
    setSources(extractSourcesFromReport(sub.report || "", []));
    setNodes((sub.nodes || []).map(n => ({ ...n, active: true })));
    setNewType(Object.keys(TYPE_MAP)[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub.id]);

  const addSource = () => {
    if (!newSource.trim()) return;
    const urlMatch = newSource.match(/https?:\/\/[^\s)]+/);
    setSources(p => [...p, { id: uid(), text: newSource.trim(), url: urlMatch?.[0] || null, active: true }]);
    setNewSource("");
  };

  const addNode = () => {
    if (!newLabel.trim()) return;
    setNodes(p => [...p, { id: uid(), label: newLabel.trim(), type: newType, active: true }]);
    setNewLabel("");
  };

  const handleExecute = () => {
    onExecute({
      sources: sources.filter(s => s.active),
      customNodes: nodes.filter(n => n.active),
      sourceMode,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#080d1a" }}>

      {/* Step tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 20px", flexShrink: 0 }}>
        {[{ n: 1, label: "📚 Bronnen" }, { n: 2, label: "🔬 Factoren" }].map(s => (
          <div key={s.n} onClick={() => setStep(s.n)}
            style={{ padding: "12px 18px", fontSize: 12, cursor: "pointer",
              borderBottom: `2px solid ${step === s.n ? accentCol : "transparent"}`,
              color: step === s.n ? accentCol : "#94a3b8", marginBottom: -1 }}>
            {s.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={onCancel}
          style={{ background: "none", border: "none", color: "#475569", fontSize: 20, cursor: "pointer", padding: "0 4px", lineHeight: 1, alignSelf: "center" }}>
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* ── Step 1: Sources ─────────────────────────────── */}
        {step === 1 && (<>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#f1f5f9", fontFamily: "Georgia,serif" }}>Bronnen aanpassen</h3>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#64748b" }}>Vink bronnen aan/uit of voeg nieuwe toe. Actieve bronnen worden meegenomen in de heranalyse.</p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>{sources.filter(s => s.active).length}/{sources.length} geselecteerd</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setSources(p => p.map(s => ({ ...s, active: true })))}
                style={{ background: "none", border: "none", color: accentCol, fontSize: 11, cursor: "pointer", padding: 0 }}>Alles</button>
              <button onClick={() => setSources(p => p.map(s => ({ ...s, active: false })))}
                style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: 0 }}>Geen</button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            {sources.length === 0 && (
              <div style={{ padding: 14, background: "rgba(255,255,255,0.02)", borderRadius: 8, color: "#475569", fontSize: 12, textAlign: "center" }}>
                Geen bronnen gevonden in huidige analyse. Voeg hieronder handmatig bronnen toe.
              </div>
            )}
            {sources.map(src => (
              <div key={src.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 5,
                border: `1px solid ${src.active ? accentBrd : "rgba(255,255,255,0.05)"}`,
                background: src.active ? accentBg.replace("0.12", "0.06") : "rgba(255,255,255,0.02)" }}>
                <div onClick={() => setSources(p => p.map(s => s.id === src.id ? { ...s, active: !s.active } : s))}
                  style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${src.active ? accentCol : "#334155"}`,
                    background: src.active ? accentCol : "transparent", flexShrink: 0, marginTop: 1, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {src.active && <span style={{ color: "#fff", fontSize: 8, fontWeight: 900 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: src.active ? "#e2e8f0" : "#475569", lineHeight: 1.5, wordBreak: "break-word" }}>{src.text}</div>
                  {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, color: src.active ? "#60a5fa" : "#334155", textDecoration: "underline", wordBreak: "break-all", display: "block", marginTop: 2 }}>
                    {src.url.length > 65 ? src.url.slice(0, 62) + "…" : src.url}
                  </a>}
                </div>
                <button onClick={() => setSources(p => p.filter(s => s.id !== src.id))}
                  style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 15, padding: 0, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>

          {/* Add source */}
          <div style={{ padding: 14, background: "rgba(255,255,255,0.025)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>Nieuwe bron toevoegen</div>
            <input value={newSource} onChange={e => setNewSource(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addSource()}
              placeholder="Bijv. 'Cacioppo et al. (2010) — https://doi.org/...'"
              style={{ width: "100%", padding: "8px 11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <button onClick={addSource}
              style={{ padding: "7px 14px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)",
                borderRadius: 7, color: "#60a5fa", fontSize: 12, cursor: "pointer" }}>+ Toevoegen</button>
          </div>

          {/* Source mode */}
          <div style={{ padding: 14, background: "rgba(255,255,255,0.025)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>Brongebruik</div>
            {[
              { val: "own",  label: "📂 Alleen geselecteerde bronnen" },
              { val: "both", label: "🔬 Geselecteerde bronnen + aanvullende literatuur" },
            ].map(opt => (
              <label key={opt.val} onClick={() => setSourceMode(opt.val)}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", borderRadius: 8, marginBottom: 5, cursor: "pointer",
                  border: `1px solid ${sourceMode === opt.val ? accentBrd : "rgba(255,255,255,0.05)"}`,
                  background: sourceMode === opt.val ? accentBg.replace("0.12","0.07") : "transparent" }}>
                <div style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${sourceMode === opt.val ? accentCol : "#334155"}`,
                  background: sourceMode === opt.val ? accentCol : "transparent", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {sourceMode === opt.val && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />}
                </div>
                <span style={{ fontSize: 12, color: sourceMode === opt.val ? "#e2e8f0" : "#475569" }}>{opt.label}</span>
              </label>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setStep(2)}
              style={{ padding: "10px 22px", background: `linear-gradient(135deg,${accentCol},${accentCol}99)`, border: "none",
                borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Volgende: Factoren →
            </button>
          </div>
        </>)}

        {/* ── Step 2: Factors ─────────────────────────────── */}
        {step === 2 && (<>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#f1f5f9", fontFamily: "Georgia,serif" }}>
            {isProblems ? "Oorzaken" : "Oplossingen"} aanpassen
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#64748b" }}>
            Vink {isProblems ? "oorzaken" : "oplossingen"} aan/uit en voeg nieuwe toe. Actieve {isProblems ? "oorzaken" : "oplossingen"} worden als verplichte factoren meegenomen.
          </p>

          {Object.entries(TYPE_MAP).map(([typeKey, typeVal]) => {
            const typeNodes = nodes.filter(n => n.type === typeKey);
            if (!typeNodes.length) return null;
            return (
              <div key={typeKey} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeVal.color }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.7 }}>{typeVal.label}</span>
                </div>
                {typeNodes.map(n => (
                  <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", borderRadius: 8, marginBottom: 5,
                    border: `1px solid ${n.active ? typeVal.color + "44" : "rgba(255,255,255,0.05)"}`,
                    background: n.active ? typeVal.color + "10" : "rgba(255,255,255,0.02)" }}>
                    <div onClick={() => setNodes(p => p.map(nd => nd.id === n.id ? { ...nd, active: !nd.active } : nd))}
                      style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${n.active ? typeVal.color : "#334155"}`,
                        background: n.active ? typeVal.color : "transparent", flexShrink: 0, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {n.active && <span style={{ color: "#fff", fontSize: 8, fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 12, color: n.active ? "#e2e8f0" : "#475569", flex: 1 }}>{n.label}</span>
                    <button onClick={() => setNodes(p => p.filter(nd => nd.id !== n.id))}
                      style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 15, padding: 0, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Nodes without a recognized type */}
          {nodes.filter(n => !TYPE_MAP[n.type]).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 7 }}>Overig</div>
              {nodes.filter(n => !TYPE_MAP[n.type]).map(n => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", borderRadius: 8, marginBottom: 5,
                  border: `1px solid ${n.active ? "rgba(100,116,139,0.4)" : "rgba(255,255,255,0.05)"}`,
                  background: n.active ? "rgba(100,116,139,0.1)" : "rgba(255,255,255,0.02)" }}>
                  <div onClick={() => setNodes(p => p.map(nd => nd.id === n.id ? { ...nd, active: !nd.active } : nd))}
                    style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${n.active ? "#64748b" : "#334155"}`,
                      background: n.active ? "#64748b" : "transparent", flexShrink: 0, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {n.active && <span style={{ color: "#fff", fontSize: 8, fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 12, color: n.active ? "#e2e8f0" : "#475569", flex: 1 }}>{n.label} <span style={{ fontSize: 10, color: "#475569" }}>({n.type})</span></span>
                  <button onClick={() => setNodes(p => p.filter(nd => nd.id !== n.id))}
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 15, padding: 0, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Add node */}
          <div style={{ padding: 14, background: "rgba(255,255,255,0.025)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Nieuwe {isProblems ? "oorzaak" : "oplossing"} toevoegen
            </div>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addNode()}
              placeholder={`Naam van nieuwe ${isProblems ? "oorzaak" : "oplossing"}...`}
              style={{ width: "100%", padding: "8px 11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <select value={newType} onChange={e => setNewType(e.target.value)}
                style={{ flex: 1, padding: "7px 10px", background: "#0d1225", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 7, color: "#e2e8f0", fontSize: 12, outline: "none" }}>
                {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={addNode}
                style={{ padding: "7px 14px", background: accentBg, border: `1px solid ${accentBrd}`,
                  borderRadius: 7, color: accentCol, fontSize: 12, cursor: "pointer" }}>+ Toevoegen</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setStep(1)}
              style={{ padding: "10px 18px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 9, color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>
              ← Terug
            </button>
            <button onClick={handleExecute}
              style={{ padding: "10px 22px", background: `linear-gradient(135deg,${accentCol},${accentCol}99)`, border: "none",
                borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              🔄 Heranalyse uitvoeren →
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}
