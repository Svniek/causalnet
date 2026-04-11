export default function SourcesPhase({ uploadedDocs, setUploadedDocs, sourceMode, setSourceMode, dragOver, setDragOver, handleFileDrop, onBack, onContinue }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, background: "radial-gradient(ellipse at 50% 30%,#0d1a35,#080d1a)" }}>
      <div style={{ width: "100%", maxWidth: 620, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 36 }}>
        <div style={{ display: "inline-block", padding: "3px 10px", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 20, color: "#60a5fa", fontSize: 10, marginBottom: 16, letterSpacing: 0.5 }}>Stap 3 van 4 &mdash; Optioneel</div>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, color: "#f1f5f9", margin: "0 0 8px" }}>Eigen bronnen toevoegen</h2>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: "0 0 22px" }}>
          Voeg wetenschappelijke PDFs toe die Claude als basis voor de analyse gebruikt. Je kunt ook doorgaan zonder eigen bronnen.
        </p>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          style={{ border: `2px dashed ${dragOver ? "#60a5fa" : "rgba(255,255,255,0.12)"}`, borderRadius: 12,
            padding: "28px 20px", textAlign: "center", marginBottom: 16, cursor: "pointer",
            background: dragOver ? "rgba(96,165,250,0.06)" : "rgba(255,255,255,0.02)", transition: "all 0.2s" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{"\ud83d\udcc4"}</div>
          <p style={{ color: "#475569", fontSize: 13, margin: "0 0 10px" }}>Sleep PDF bestanden hierheen</p>
          <label style={{ padding: "7px 18px", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
            borderRadius: 8, color: "#60a5fa", fontSize: 12, cursor: "pointer", display: "inline-block" }}>
            Of selecteer bestanden
            <input type="file" accept=".pdf,application/pdf" multiple onChange={handleFileDrop} style={{ display: "none" }} />
          </label>
          <p style={{ color: "#334155", fontSize: 11, margin: "8px 0 0" }}>PDF bestanden toevoegen</p>
        </div>

        {uploadedDocs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {uploadedDocs.map(doc => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)",
                borderRadius: 8, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{"\ud83d\udcc4"}</span>
                  <div>
                    <div style={{ fontSize: 12, color: "#e2e8f0" }}>{doc.name}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>{(doc.size / 1024).toFixed(0)} KB</div>
                  </div>
                </div>
                <button onClick={() => setUploadedDocs(p => p.filter(d => d.id !== doc.id))}
                  style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, padding: 0 }}>&times;</button>
              </div>
            ))}
          </div>
        )}

        {uploadedDocs.length > 0 && (
          <div style={{ marginBottom: 24, padding: 16, background: "rgba(255,255,255,0.025)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#475569", marginBottom: 12 }}>Hoe wil je de bronnen gebruiken?</div>
            {[
              { val: "own", icon: "\ud83d\udcc2", title: "Alleen eigen bronnen", desc: "Claude baseert de analyse uitsluitend op de ge\u00fcploade documenten." },
              { val: "both", icon: "\ud83d\udd2c", title: "Eigen bronnen + aanvullende literatuur", desc: "Claude gebruikt jouw documenten als primaire bron en vult aan met andere wetenschappelijke literatuur." }
            ].map(opt => (
              <label key={opt.val} onClick={() => setSourceMode(opt.val)}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderRadius: 9,
                  border: `1px solid ${sourceMode === opt.val ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.06)"}`,
                  background: sourceMode === opt.val ? "rgba(96,165,250,0.1)" : "transparent", cursor: "pointer", marginBottom: 8 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${sourceMode === opt.val ? "#60a5fa" : "#334155"}`,
                  background: sourceMode === opt.val ? "#60a5fa" : "transparent", flexShrink: 0, marginTop: 1,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {sourceMode === opt.val && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, marginBottom: 2 }}>{opt.icon} {opt.title}</div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onBack}
            style={{ padding: "11px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 9, color: "#475569", fontSize: 13, cursor: "pointer", flex: "0 0 auto" }}>
            &larr; Terug
          </button>
          <button onClick={onContinue}
            style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 4px 18px rgba(124,58,237,0.4)" }}>
            {uploadedDocs.length > 0
              ? `Doorgaan met ${uploadedDocs.length} document${uploadedDocs.length > 1 ? "en" : ""} \u2192`
              : "Doorgaan zonder eigen bronnen \u2192"}
          </button>
        </div>
      </div>
    </div>
  );
}
