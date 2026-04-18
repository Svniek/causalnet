import { useRef } from "react";

export default function ProblemPhase({ problem, setProblem, apiKey, sugLoading, sugError, onGenerate, onLoad }) {
  const fileInputRef = useRef(null);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28, background: "radial-gradient(ellipse at 50% 30%,#0d1a35,#080d1a)" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 36 }}>
        <div style={{ display: "inline-block", padding: "3px 10px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, color: "#f59e0b", fontSize: 10, marginBottom: 16 }}>Stap 1 van 3</div>
        <h1 style={{ fontFamily: "Georgia,serif", fontSize: 24, color: "#f1f5f9", margin: "0 0 10px" }}>Wat is je onderwerp of probleemstelling?</h1>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: "0 0 18px" }}>Claude genereert wetenschappelijk onderbouwde factoren en berekent na analyse de correlatiesterktes en invloeden &mdash; zichtbaar in de dikte van de lijnen en de grootte van de bollen.</p>

        <textarea value={problem} onChange={e => setProblem(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onGenerate(); } }}
          placeholder="Bijv. 'Schooluitval bij jongeren met ADHD'..." rows={3}
          style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#e2e8f0", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6, marginBottom: 14, fontFamily: "sans-serif" }} />
        {sugError && <div style={{ padding: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 7, color: "#f87171", fontSize: 12, marginBottom: 12 }}>{sugError}</div>}
        <button onClick={onGenerate} disabled={sugLoading || !problem.trim()}
          style={{ width: "100%", padding: "13px", background: (!problem.trim() || sugLoading) ? "#1e293b" : "linear-gradient(135deg,#f59e0b,#d97706)",
            border: "none", borderRadius: 10, color: (!problem.trim() || sugLoading) ? "#334155" : "#000",
            fontSize: 14, fontWeight: 600, cursor: (!problem.trim() || sugLoading) ? "not-allowed" : "pointer",
            boxShadow: (!problem.trim() || sugLoading) ? "none" : "0 4px 20px rgba(245,158,11,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "sans-serif" }}>
          {sugLoading
            ? [<span key="s" style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000", display: "inline-block", animation: "spin 0.7s linear infinite" }} />, " Factoren genereren\u2026"]
            : "\u2728 Genereer factoren voor dit onderwerp \u2192"}
        </button>

        {onLoad && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
              <span style={{ fontSize: 11, color: "#334155" }}>of</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            </div>
            <input ref={fileInputRef} type="file" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files[0]) { onLoad(e.target.files[0]); e.target.value = ""; } }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ width: "100%", padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#64748b", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              📂 Opgeslagen analyse laden
            </button>
          </>
        )}

      </div>
    </div>
  );
}
