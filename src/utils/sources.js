import { uid } from "../constants";

export const extractSourcesFromReport = (text, uploadedDocs) => {
  const seen = new Set();
  const sources = [];

  const addSource = (rawText, url) => {
    const clean = rawText.replace(/^\s*\d+\.\s*/, "").replace(/^\s*[-*]\s*/, "").trim();
    if (!clean || clean.length < 5) return;
    const key = clean.slice(0, 60).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    sources.push({ id: uid(), text: clean, url: url || null, active: true });
  };

  const lines = text.split("\n");
  let inSources = false;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (/^##\s*(wetenschappelijke\s*)?(bronnen|referenties|literatuur|sources|references)/i.test(trimmed)) {
      inSources = true; return;
    }
    if (/^##\s/.test(trimmed) && inSources) { inSources = false; }
    if (inSources && trimmed) {
      const urlMatch = trimmed.match(/https?:\/\/[^\s)\]]+/);
      const label = trimmed.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1").replace(/https?:\/\/[^\s)]+/g, "").trim();
      addSource(label || trimmed, urlMatch?.[0]);
    }
  });

  const inlineRe = /\(\[([^\]]+)\]\((https?:\/\/[^)]+)\)\)/g;
  let m;
  while ((m = inlineRe.exec(text)) !== null) {
    addSource(m[1], m[2]);
  }

  uploadedDocs.forEach(doc => {
    const key = doc.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({ id: uid(), text: doc.name, url: null, active: true, isDoc: true, docId: doc.id });
    }
  });

  return sources;
};

export const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target.result;
    const commaIdx = result.indexOf(",");
    if (commaIdx === -1) { reject(new Error("Ongeldige bestandsencoding")); return; }
    const b64 = result.slice(commaIdx + 1).replace(/\s/g, "");
    const mediaType = "application/pdf";
    resolve({ id: uid(), name: file.name, base64: b64, mediaType, size: file.size });
  };
  reader.onerror = () => reject(new Error("Kan bestand niet lezen"));
  reader.readAsDataURL(file);
});
