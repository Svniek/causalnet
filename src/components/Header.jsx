import { useState, useRef } from "react";

export default function Header({ phase, problem, uploadedDocs, analysed, apiKey, setApiKey, onReset, onSave, onLoad }) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef(null);

  const lsSet = (key, val) => { try { localStorage.setItem(key, val); } catch {} };
  const lsRemove = (key) => { try { localStorage.removeItem(key); } catch {} };

  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 22, height: 22, background: "#f59e0b", transform: "rotate(45deg)", borderRadius: 3, boxShadow: "0 0 10px #f59e0b88" }} />
        <div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 17, color: "#f1f5f9" }}>CausalNet</div>
          <div style={{ fontSize: 10, color: "#334155" }}>Evidence-based factor network analyse</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {phase !== "problem" && problem && <span style={{ fontSize: 11, color: "#94a3b8", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{"\ud83d\udccc"} {problem}</span>}
        {uploadedDocs.length > 0 && <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 10, color: "#60a5fa" }}>{"\ud83d\udcc4"} {uploadedDocs.length} doc{uploadedDocs.length > 1 ? "s" : ""}</span>}
        {analysed && <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, color: "#34d399" }}>{"\u25cf"} Gewogen netwerk</span>}
        {/* Hidden file input — rendered in DOM for reliability */}
        <input ref={fileInputRef} type="file"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files[0]) { onLoad(e.target.files[0]); e.target.value = ""; } }} />

        {/* Load button — only when not on start screen */}
        {phase !== "problem" && (
          <button title="Analyse laden (.causalnet bestand)"
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: "5px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, color: "#94a3b8", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            📂 Laden
          </button>
        )}

        {/* Save button — only when there is an analysis */}
        {analysed && (
          <button title="Analyse opslaan als .causalnet bestand"
            onClick={onSave}
            style={{ padding: "5px 10px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 7, color: "#34d399", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            💾 Opslaan
          </button>
        )}

        {phase !== "problem" && <button onClick={() => analysed ? setConfirmReset(true) : onReset()} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>&larr; Nieuw onderwerp</button>}

        {confirmReset && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
            onClick={() => setConfirmReset(false)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 24, maxWidth: 460, boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 16, color: "#f1f5f9", marginBottom: 10, fontWeight: 600 }}>
                ⚠️ Nieuw onderwerp starten?
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 18 }}>
                Alle data van de huidige analyse (factoren, gewichten, rapporten en sub-analyses) gaat verloren. Wil je eerst de analyse opslaan?
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmReset(false)}
                  style={{ padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
                  Annuleren
                </button>
                <button onClick={() => { setConfirmReset(false); onReset(); }}
                  style={{ padding: "7px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, color: "#f87171", fontSize: 12, cursor: "pointer" }}>
                  Doorgaan zonder opslaan
                </button>
                <button onClick={() => { onSave(); setConfirmReset(false); onReset(); }}
                  style={{ padding: "7px 14px", background: "linear-gradient(135deg,#34d399,#10b981)", border: "none", borderRadius: 7, color: "#052e1f", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  💾 Eerst opslaan
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ position: "relative" }}>
          <button onClick={() => setShowKeyInput(v => !v)}
            title="API sleutel instellen (nodig buiten Claude.ai)"
            style={{ padding: "5px 10px", background: apiKey ? "rgba(52,211,153,0.1)" : "rgba(245,158,11,0.1)",
              border: `1px solid ${apiKey ? "rgba(52,211,153,0.3)" : "rgba(245,158,11,0.3)"}`,
              borderRadius: 7, color: apiKey ? "#34d399" : "#f59e0b", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            {"\ud83d\udd11"} {apiKey ? "API \u2713" : "API sleutel"}
          </button>
          {showKeyInput && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 16, zIndex: 1000, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                <strong style={{ color: "#94a3b8" }}>Anthropic API sleutel</strong><br />
                Alleen nodig buiten Claude.ai. Binnen Claude.ai werkt de app zonder sleutel.
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); lsSet("causalnet_apikey", e.target.value); }}
                  placeholder="sk-ant-api03-..."
                  style={{ flex: 1, padding: "7px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 7, color: "#e2e8f0", fontSize: 12, fontFamily: "monospace", outline: "none" }} />
                <button onClick={() => setShowApiKey(v => !v)}
                  style={{ padding: "7px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#64748b", fontSize: 11, cursor: "pointer" }}>
                  {showApiKey ? "\ud83d\ude48" : "\ud83d\udc41"}
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {apiKey && <button onClick={() => { setApiKey(""); lsRemove("causalnet_apikey"); }}
                  style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: 0 }}>
                  Wissen
                </button>}
                <button onClick={() => setShowKeyInput(false)}
                  style={{ marginLeft: "auto", padding: "5px 14px", background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", borderRadius: 7, color: "#000", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Opslaan {"\u2713"}
                </button>
              </div>
              <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(245,158,11,0.06)", borderRadius: 6, border: "1px solid rgba(245,158,11,0.15)" }}>
                <div style={{ fontSize: 10, color: "#78716c", lineHeight: 1.5 }}>
                  {"\ud83d\udd12"} Sleutel wordt alleen lokaal opgeslagen (localStorage) en nooit verstuurd naar andere servers dan api.anthropic.com.
                  Haal je sleutel op via <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: "#f59e0b" }}>console.anthropic.com</a>.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
