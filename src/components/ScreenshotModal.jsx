export default function ScreenshotModal({ screenshot, onClose }) {
  if (!screenshot) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}>
      <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 20, maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 12 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{"\ud83d\udcf7"} Screenshot klaar</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>Rechtsklik op de afbeelding &rarr; <strong style={{ color: "#94a3b8" }}>"Afbeelding opslaan als\u2026"</strong> om op te slaan als <em>{screenshot.name}</em></div>
          </div>
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#64748b", fontSize: 18, cursor: "pointer", width: 34, height: 34, flexShrink: 0 }}>&times;</button>
        </div>
        <img src={screenshot.dataUrl} alt="screenshot"
          style={{ maxWidth: "80vw", maxHeight: "70vh", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", objectFit: "contain" }} />
      </div>
    </div>
  );
}
