import { TYPES } from "../constants";

export default function SuggestionPanel({ suggestions, checked, onToggle, onSelectAll, onDeselectAll, onConfirm, problem }) {
  const total = Object.values(suggestions).flat().length;
  const checkedCount = Object.values(checked).filter(Boolean).length;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "radial-gradient(ellipse at 50% 0%,#0d1630,#080d1a)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 28px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <div style={{ display: "inline-block", padding: "3px 10px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, color: "#f59e0b", fontSize: 10, marginBottom: 10 }}>Stap 2 van 3</div>
          <h2 style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#f1f5f9", margin: "0 0 4px" }}>Gesuggereerde factoren</h2>
          <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Op basis van: <em style={{ color: "#f59e0b" }}>"{problem}"</em></p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6 }}>
          <span style={{ fontSize: 12, color: "#475569" }}>{checkedCount}/{total} geselecteerd</span>
          <button onClick={onSelectAll} style={{ background: "none", border: "none", color: "#f59e0b", fontSize: 12, cursor: "pointer", padding: 0 }}>Alles</button>
          <span style={{ color: "#1e293b" }}>&middot;</span>
          <button onClick={onDeselectAll} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer", padding: 0 }}>Geen</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, padding: "16px 28px", overflowY: "auto", flex: 1 }}>
        {Object.entries(suggestions).map(([type, items]) => {
          if (!items?.length) return null;
          const t = TYPES[type];
          const selCount = items.filter(it => checked[type + "::" + it]).length;
          return (
            <div key={type} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, flex: 1 }}>{t.label}</span>
                <span style={{ fontSize: 10, color: "#334155" }}>{selCount}/{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {items.map(item => {
                  const key = type + "::" + item, on = !!checked[key];
                  return (
                    <label key={key} onClick={() => onToggle(key)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", borderRadius: 7,
                        border: "1px solid " + (on ? t.color + "44" : "rgba(255,255,255,0.05)"),
                        background: on ? t.color + "12" : "transparent", cursor: "pointer" }}>
                      <div style={{ width: 13, height: 13, borderRadius: 3, border: "1.5px solid " + (on ? t.color : "#334155"),
                        background: on ? t.color : "transparent", flexShrink: 0, marginTop: 1,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && <span style={{ color: "#000", fontSize: 8, fontWeight: 900 }}>{"\u2713"}</span>}
                      </div>
                      <span style={{ fontSize: 12, color: on ? "#e2e8f0" : "#475569", lineHeight: 1.4 }}>{item}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "14px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onConfirm} disabled={checkedCount === 0}
          style={{ padding: "12px 24px", background: checkedCount > 0 ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "#1e293b",
            border: "none", borderRadius: 10, color: checkedCount > 0 ? "#fff" : "#334155", fontSize: 13,
            fontWeight: 600, cursor: checkedCount > 0 ? "pointer" : "not-allowed",
            boxShadow: checkedCount > 0 ? "0 4px 18px rgba(124,58,237,0.4)" : "none" }}>
          Gebruik {checkedCount} factoren in netwerk &rarr;
        </button>
      </div>
    </div>
  );
}
