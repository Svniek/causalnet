// White-background exports: PDF (text-rendered) and Word (.doc HTML)
import { numberifyCitations } from "./numberifyCitations";

// Strip markdown to plain text — behoudt [n] nummers, verwijdert URLs
const stripLinks = (text) =>
  text
    .replace(/\(\[(\d+)\]\([^)]+\)\)/g, "[$1]")          // ([n](url)) → [n]
    .replace(/\(\[([^\]]+)\]\([^)]+\)\)/g, "[$1]")        // ([label](url)) → [label]
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")              // [text](url) of [text]() → text
    .replace(/https?:\/\/[^\s)\]]+/g, "");

// jsPDF's Helvetica/Times ondersteunen geen Unicode buiten WinAnsi.
// Vervang Griekse letters en speciale symbolen door leesbare ASCII-equivalenten.
const UNICODE_MAP = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon",
  "η": "eta", "θ": "theta", "λ": "lambda", "μ": "mu", "π": "pi",
  "ρ": "rho", "σ": "sigma", "τ": "tau", "φ": "phi", "χ": "chi",
  "ω": "omega", "Δ": "Delta", "Σ": "Sigma", "Ω": "Omega",
  "≈": "~=", "≠": "!=", "≤": "<=", "≥": ">=", "±": "+/-",
  "×": "x", "÷": "/", "·": ".", "→": "->", "←": "<-", "↑": "^", "↓": "v",
  "²": "2", "³": "3", "½": "1/2", "¼": "1/4", "¾": "3/4",
  "–": "-", "—": "-", "…": "...", "•": "-", "“": '"', "”": '"', "‘": "'", "’": "'",
};
const sanitizeForPdf = (text) =>
  text.replace(/[α-ωΑ-Ω≈≠≤≥±×÷·→←↑↓²³½¼¾–—…•""'']/g, (c) => UNICODE_MAP[c] ?? c);

const stripMarkdown = (text) =>
  sanitizeForPdf(stripLinks(text).replace(/\*\*([^*]+)\*\*/g, "$1"));

// ─── White PDF (analyse only) ─────────────────────────────────────────────────
export const exportAnalysisPdfWhite = async (report, problem) => {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  const WHITE = [255, 255, 255];
  const DARK  = [30, 41, 59];
  const MID   = [71, 85, 105];
  const AMBER = [180, 110, 10];
  const BLUE  = [37, 99, 235];
  const LINE  = [226, 232, 240];

  let y = margin;

  const newPage = () => {
    pdf.addPage();
    pdf.setFillColor(...WHITE);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
    y = margin;
  };

  const checkBreak = (need = 8) => {
    if (y + need > pageHeight - margin) newPage();
  };

  // Cover / header
  pdf.setFillColor(...WHITE);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  pdf.setFontSize(18);
  pdf.setTextColor(...AMBER);
  pdf.setFont(undefined, "bold");
  pdf.text("CausalNet", margin, y + 4);
  pdf.setFontSize(9);
  pdf.setTextColor(...MID);
  pdf.setFont(undefined, "normal");
  pdf.text(new Date().toLocaleDateString("nl-NL"), pageWidth - margin, y + 4, { align: "right" });
  y += 10;

  pdf.setFontSize(12);
  pdf.setTextColor(...DARK);
  pdf.setFont(undefined, "bold");
  const titleLines = pdf.splitTextToSize(problem, contentWidth);
  titleLines.forEach(l => { pdf.text(l, margin, y); y += 6; });
  pdf.setFont(undefined, "normal");

  pdf.setDrawColor(...LINE);
  pdf.line(margin, y + 2, pageWidth - margin, y + 2);
  y += 8;

  // Body: parse markdown lines (met genummerde citaten) + bronnen bottom-aligned
  const allLines = numberifyCitations(report).text.split("\n");
  let srcStart = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].startsWith("## ") && /bron|referentie|source/i.test(allLines[i])) {
      srcStart = i; break;
    }
  }
  const bodyLines = srcStart === -1 ? allLines : allLines.slice(0, srcStart);
  const srcLines  = srcStart === -1 ? []       : allLines.slice(srcStart);

  // ── Body renderen ──
  const renderBody = (line) => {
    if (line.startsWith("## ")) {
      checkBreak(14);
      y += 4;
      pdf.setFontSize(10);
      pdf.setTextColor(...AMBER);
      pdf.setFont(undefined, "bold");
      pdf.text(line.slice(3).toUpperCase(), margin, y);
      pdf.setDrawColor(...LINE);
      pdf.line(margin, y + 1.5, pageWidth - margin, y + 1.5);
      pdf.setFont(undefined, "normal");
      y += 8;
    } else if (line.trim() === "") {
      y += 2;
    } else {
      const plain = stripMarkdown(line);
      if (!plain.trim()) return;
      checkBreak(6);
      const wrapped = pdf.splitTextToSize(plain, contentWidth);
      wrapped.forEach(l => {
        checkBreak(5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        pdf.setTextColor(...MID);
        pdf.text(l, margin, y); y += 5;
      });
      y += 1;
    }
  };
  bodyLines.forEach(renderBody);

  // ── Bronnen bottom-aligned renderen ──
  if (srcLines.length) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);

    // Bereken benodigde hoogte (matcht exact het rendering hieronder)
    let needed = 0;
    srcLines.forEach((line) => {
      if (line.startsWith("## ")) { needed += 10; return; }
      if (line.trim() === "")     { needed += 2;  return; }
      const plain = stripMarkdown(line.trim());
      if (!plain) return;
      const numMatch = plain.match(/^\[(\d+)\]\s+/);
      const rest = numMatch ? plain.slice(numMatch[0].length) : plain;
      const wrapped = pdf.splitTextToSize(rest, contentWidth - 10);
      needed += wrapped.length * 4.5 + 1.5;
    });

    // Forceer een nieuwe pagina zodat de bronnen onafhankelijk bottom-aligned worden
    const bottomY = pageHeight - margin;
    if (y > margin + 5) {
      pdf.addPage();
      pdf.setFillColor(...WHITE);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      y = margin;
    }
    // Schuif y naar beneden zodat de laatste bron op bottomY eindigt
    y = Math.max(margin, bottomY - needed);

    srcLines.forEach((line) => {
      if (line.startsWith("## ")) {
        pdf.setFontSize(10);
        pdf.setTextColor(...AMBER);
        pdf.setFont("helvetica", "bold");
        pdf.text(line.slice(3).toUpperCase(), margin, y);
        pdf.setDrawColor(...LINE);
        pdf.line(margin, y + 1.5, pageWidth - margin, y + 1.5);
        y += 10;
      } else if (line.trim() === "") {
        y += 2;
      } else {
        const plain = stripMarkdown(line.trim());
        if (!plain) return;
        const numMatch = plain.match(/^\[(\d+)\]\s+/);
        const HANG = 10;
        pdf.setFontSize(8.5);
        pdf.setTextColor(...BLUE);
        if (numMatch) {
          const nr   = numMatch[1];
          const rest = plain.slice(numMatch[0].length);
          pdf.setFont("helvetica", "bold");
          pdf.text(`[${nr}]`, margin, y);
          pdf.setFont("helvetica", "normal");
          const wrapped = pdf.splitTextToSize(rest, contentWidth - HANG);
          wrapped.forEach(l => { pdf.text(l, margin + HANG, y); y += 4.5; });
        } else {
          const wrapped = pdf.splitTextToSize(plain, contentWidth - HANG);
          wrapped.forEach(l => { pdf.text(l, margin + HANG, y); y += 4.5; });
        }
        y += 1.5;
      }
    });
  }

  pdf.save(`CausalNet_analyse_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ─── Word (.doc via HTML) ─────────────────────────────────────────────────────
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const mdLineToHtml = (line) => {
  let s = line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(
    /\(\[([^\]]+)\]\(([^)]+)\)\)/g,
    (_, txt, url) => `<a href="${esc(url)}" style="color:#2563eb;font-size:0.85em">${esc(txt)}</a>`
  );
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, txt, url) => `<a href="${esc(url)}" style="color:#2563eb">${esc(txt)}</a>`
  );
  s = s.replace(
    /https?:\/\/[^\s<>")\]]+/g,
    (url) => `<a href="${esc(url)}" style="color:#2563eb">${esc(url)}</a>`
  );
  return s;
};

export const exportAnalysisWord = (report, problem) => {
  const lines = numberifyCitations(report).text.split("\n");
  let body = "";
  let inSources = false;

  lines.forEach((line) => {
    if (line.startsWith("## ")) {
      inSources = /bron|referentie|source/i.test(line);
      body += `<h2 style="font-size:13pt;color:#1e293b;margin:20px 0 4px;border-bottom:1px solid #e2e8f0;padding-bottom:4px">${esc(line.slice(3))}</h2>\n`;
    } else if (line.trim() === "") {
      body += "<p style='margin:2px 0'>&nbsp;</p>\n";
    } else if (inSources) {
      const numMatch = line.trim().match(/^\[(\d+)\]\s+/);
      if (numMatch) {
        const nr   = numMatch[1];
        const rest = line.trim().slice(numMatch[0].length);
        body += `<p style="font-size:9pt;color:#2563eb;margin:4px 0 4px 0;display:flex;gap:6px">
          <span style="display:inline-block;min-width:22px;padding:0 4px;background:#dbeafe;border:1px solid #93c5fd;border-radius:3px;color:#1d4ed8;font-weight:700;font-size:8pt;text-align:center">${esc(nr)}</span>
          <span>${mdLineToHtml(rest)}</span></p>\n`;
      } else {
        body += `<p style="font-size:9pt;color:#2563eb;margin:4px 0 4px 10px">${mdLineToHtml(line.trim())}</p>\n`;
      }
    } else {
      body += `<p style="font-size:11pt;color:#475569;line-height:1.7;margin:4px 0">${mdLineToHtml(line)}</p>\n`;
    }
  });

  const date = new Date().toLocaleDateString("nl-NL");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>CausalNet Analyse</title>
<!--[if gte mso 9]>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
<![endif]-->
<style>
  body { font-family: Calibri, sans-serif; margin: 2cm; background: white; }
  h1   { font-size: 16pt; color: #1e293b; }
  h2   { font-size: 13pt; color: #1e293b; }
  p    { font-size: 11pt; color: #475569; line-height: 1.7; }
  a    { color: #2563eb; }
</style>
</head>
<body>
  <p style="font-size:10pt;color:#64748b;margin-bottom:4px">CausalNet &nbsp;|&nbsp; ${date}</p>
  <h1>${esc(problem)}</h1>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 0 16px">
  ${body}
</body>
</html>`;

  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = problem.slice(0, 40).replace(/[^a-z0-9]/gi, "_").toLowerCase();
  a.href = url;
  a.download = `CausalNet_analyse_${slug}_${new Date().toISOString().slice(0, 10)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Volledig overzichtsdocument PDF (wit) ────────────────────────────────────
export const exportAllPdfWhite = async ({ problem, nodes, edges, influence, report, supplementSections, subAnalyses, screenshots }) => {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M  = 16;
  const CW = PW - M * 2;
  let y = M;
  let pageNum = 1;

  // ── Kleurpalet ──────────────────────────────────────────────────────────────
  const WHITE = [255, 255, 255];
  const DARK  = [30,  41,  59 ];
  const MID   = [71,  85,  105];
  const LIGHT = [148, 163, 184];
  const AMBER = [180, 110, 10 ];
  const BLUE  = [37,  99,  235];
  const LINE  = [226, 232, 240];
  const BG    = [248, 250, 252];

  const TYPE_RGB = {
    maingoal:     [245, 158, 11 ],
    goal:         [52,  211, 153],
    risk:         [248, 113, 113],
    protective:   [96,  165, 250],
    amplifying:   [167, 139, 250],
    interventie:  [16,  185, 129],
    beleid:       [139, 92,  246],
    omgeving:     [249, 115, 22 ],
    gedrag:       [6,   182, 212],
    // PROBLEM_TYPES
    onderliggend: [220, 38,  38 ],
    versterkend:  [249, 115, 22 ],
    trigger:      [234, 179, 8  ],
    structureel:  [168, 85,  247],
  };
  const TYPE_LABEL = {
    maingoal:     "Hoofddoel",
    goal:         "Doel",
    risk:         "Risicofactor",
    protective:   "Beschermende factor",
    amplifying:   "Versterkende factor",
    interventie:  "Interventie",
    beleid:       "Beleidsmaatregel",
    omgeving:     "Omgevingsfactor",
    gedrag:       "Gedragsverandering",
    // PROBLEM_TYPES
    onderliggend: "Onderliggende oorzaak",
    versterkend:  "Versterkende oorzaak",
    trigger:      "Trigger",
    structureel:  "Structurele oorzaak",
  };

  // ── Pagina-helpers ──────────────────────────────────────────────────────────
  const setWhitePage = () => {
    pdf.setFillColor(...WHITE);
    pdf.rect(0, 0, PW, PH, "F");
  };

  const addFooter = () => {
    pdf.setFontSize(7.5);
    pdf.setTextColor(...LIGHT);
    pdf.setFont(undefined, "normal");
    pdf.text(`CausalNet  ·  ${new Date().toLocaleDateString("nl-NL")}`, M, PH - 7);
    pdf.text(`${pageNum}`, PW - M, PH - 7, { align: "right" });
  };

  const newPage = () => {
    addFooter();
    pdf.addPage();
    pageNum++;
    setWhitePage();
    y = M;
  };

  const checkBreak = (need = 8) => {
    if (y + need > PH - M - 12) newPage();
  };

  const hRule = (color = LINE, extra = 0) => {
    pdf.setDrawColor(...color);
    pdf.line(M, y + extra, PW - M, y + extra);
  };

  // ── Sectie-header ───────────────────────────────────────────────────────────
  const sectionHeader = (title, sub = false) => {
    checkBreak(sub ? 12 : 18);
    y += sub ? 5 : 10;
    pdf.setFontSize(sub ? 9.5 : 11);
    pdf.setTextColor(...AMBER);
    pdf.setFont(undefined, "bold");
    pdf.text(title.toUpperCase(), M, y);
    hRule(LINE, 2);
    pdf.setFont(undefined, "normal");
    y += 8;
  };

  // ── Markdown rapport renderer (met genummerde citaten + bottom-aligned bronnen) ──
  const drawReport = (reportText) => {
    if (!reportText) return;
    const { text: numbered } = numberifyCitations(reportText);
    const allLines = numbered.split("\n");

    // Splits body en bronnen
    let srcStart = -1;
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].startsWith("## ") && /bron|referentie|source/i.test(allLines[i])) {
        srcStart = i; break;
      }
    }
    const bodyLines = srcStart === -1 ? allLines : allLines.slice(0, srcStart);
    const srcLines  = srcStart === -1 ? []       : allLines.slice(srcStart);

    // ── Body ──
    bodyLines.forEach(line => {
      if (line.startsWith("# ") && !line.startsWith("## ")) {
        // Single-hash heading — render as bold paragraph, skip as section header
        checkBreak(10);
        y += 3;
        const wrapped = pdf.splitTextToSize(stripMarkdown(line.slice(2)), CW);
        wrapped.forEach(l => {
          checkBreak(6);
          pdf.setFontSize(10);
          pdf.setTextColor(...DARK);
          pdf.setFont("helvetica", "bold");
          pdf.text(l, M, y); y += 6;
        });
        pdf.setFont("helvetica", "normal");
      } else if (line.startsWith("## ")) {
        sectionHeader(line.slice(3), true);
      } else if (line.startsWith("### ")) {
        checkBreak(10);
        y += 3;
        const wrapped = pdf.splitTextToSize(stripMarkdown(line.slice(4)), CW);
        wrapped.forEach(l => {
          checkBreak(6);
          pdf.setFontSize(9.5);
          pdf.setTextColor(...DARK);
          pdf.setFont("helvetica", "bold");
          pdf.text(l, M, y); y += 5.5;
        });
        pdf.setFont("helvetica", "normal");
      } else if (line.trim() === "") {
        y += 2;
      } else {
        const plain = stripMarkdown(line);
        if (!plain.trim()) return;
        checkBreak(6);
        const wrapped = pdf.splitTextToSize(plain, CW);
        // Set state inside loop zodat addFooter()'s LIGHT-kleur niet "lekt" na page breaks
        wrapped.forEach(l => {
          checkBreak(5);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9.5);
          pdf.setTextColor(...MID);
          pdf.text(l, M, y); y += 5;
        });
        y += 1;
      }
    });

    // ── Bronnen bottom-aligned ──
    if (!srcLines.length) return;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);

    // Bereken benodigde hoogte (matcht exact het rendering hieronder)
    let needed = 0;
    srcLines.forEach((line) => {
      if (line.startsWith("## ")) { needed += 10; return; }
      if (line.trim() === "")     { needed += 2;  return; }
      const plain = stripMarkdown(line.trim());
      if (!plain) return;
      const numMatch = plain.match(/^\[(\d+)\]\s+/);
      const rest = numMatch ? plain.slice(numMatch[0].length) : plain;
      const wrapped = pdf.splitTextToSize(rest, CW - 10);
      needed += wrapped.length * 4.5 + 1.5;
    });

    const bottomY = PH - M - 12; // ruimte voor footer
    // Forceer altijd een nieuwe pagina voor bronnen, zodat ze geen overlap met body krijgen
    // én altijd bottom-aligned kunnen worden zonder y omhoog te moeten forceren
    if (y > M + 5) newPage();
    y = Math.max(M, bottomY - needed);

    srcLines.forEach((line) => {
      if (line.startsWith("## ")) {
        pdf.setFontSize(11);
        pdf.setTextColor(...AMBER);
        pdf.setFont("helvetica", "bold");
        pdf.text(line.slice(3).toUpperCase(), M, y);
        pdf.setDrawColor(...LINE);
        pdf.line(M, y + 2, PW - M, y + 2);
        y += 10;
      } else if (line.trim() === "") {
        y += 2;
      } else {
        const plain = stripMarkdown(line.trim());
        if (!plain) return;
        const numMatch = plain.match(/^\[(\d+)\]\s+/);
        const HANG = 10;
        pdf.setFontSize(8.5);
        pdf.setTextColor(...BLUE);
        if (numMatch) {
          const nr   = numMatch[1];
          const rest = plain.slice(numMatch[0].length);
          pdf.setFont("helvetica", "bold");
          pdf.text(`[${nr}]`, M, y);
          pdf.setFont("helvetica", "normal");
          const wrapped = pdf.splitTextToSize(rest, CW - HANG);
          wrapped.forEach(l => { pdf.text(l, M + HANG, y); y += 4.5; });
        } else {
          pdf.setFont("helvetica", "normal");
          const wrapped = pdf.splitTextToSize(plain, CW - HANG);
          wrapped.forEach(l => { pdf.text(l, M + HANG, y); y += 4.5; });
        }
        y += 1.5;
      }
    });
  };

  // ── Screenshot — vult resterende paginahoogte, volgende content op verse pagina ─
  const drawScreenshot = async (dataUrl, caption) => {
    if (!dataUrl) return;
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = dataUrl;
      });
      const captionH = caption ? 10 : 0;
      // Beschikbare ruimte vanaf huidige y tot onderkant pagina (min. footer + caption)
      const availH = PH - M - 12 - captionH - y;
      const availW = CW;
      const ratio = img.naturalHeight / img.naturalWidth;
      let drawW = availW;
      let drawH = drawW * ratio;
      if (drawH > availH) { drawH = availH; drawW = drawH / ratio; }
      const drawX = M + (CW - drawW) / 2;
      pdf.addImage(dataUrl, "PNG", drawX, y, drawW, drawH, undefined, "FAST");
      if (caption) {
        pdf.setFontSize(8);
        pdf.setTextColor(...LIGHT);
        pdf.setFont(undefined, "italic");
        pdf.text(caption, M, PH - M - 18);
        pdf.setFont(undefined, "normal");
      }
      // Volgende content (grafiek/rapport) start op verse pagina
      newPage();
    } catch (_) { /* negeer onverwachte fouten */ }
  };

  // ── Horizontale balkengrafiek ────────────────────────────────────────────────
  const drawBarChart = (items, title) => {
    if (!items.length) return;
    sectionHeader(title, true);
    const BAR_MAX = 58;
    const LABEL_W = CW - BAR_MAX - 24;
    const ROW_H   = 7.5;
    items.forEach(({ label, value, type }) => {
      checkBreak(ROW_H + 1);
      const rgb = TYPE_RGB[type] || [100, 116, 139];
      const barW = Math.max(1.5, value * BAR_MAX);
      // gekleurde stip
      pdf.setFillColor(...rgb);
      pdf.circle(M + 2.5, y - 1.5, 2, "F");
      // label
      pdf.setFontSize(8.5);
      pdf.setTextColor(...DARK);
      const lbl = label.length > 46 ? label.slice(0, 44) + "…" : label;
      pdf.text(lbl, M + 7, y);
      // balk
      const bx = M + LABEL_W + 2;
      pdf.setFillColor(226, 232, 240);
      pdf.roundedRect(bx, y - 4, BAR_MAX, 3.5, 1, 1, "F");
      pdf.setFillColor(...rgb);
      pdf.roundedRect(bx, y - 4, barW, 3.5, 1, 1, "F");
      // percentage
      pdf.setFontSize(8);
      pdf.setTextColor(...rgb);
      pdf.setFont(undefined, "bold");
      pdf.text(`${(value * 100).toFixed(0)}%`, bx + BAR_MAX + 2, y);
      pdf.setFont(undefined, "normal");
      y += ROW_H;
    });
    y += 3;
  };

  // ── Factoren datatabel ───────────────────────────────────────────────────────
  const drawFactorTable = (ns, es, inf) => {
    sectionHeader("Factoren — gegevenstabel", true);
    const center = ns.find(n => n.type === "maingoal") || ns.find(n => n.type === "goal");
    const rows = ns
      .filter(n => n.id !== center?.id)
      .map(n => ({
        label: n.label, type: n.type,
        inf: inf?.[n.label],
        corr: es.find(e => e.from === n.id && e.to === center?.id)?.correlation,
      }))
      .sort((a, b) => (b.inf || 0) - (a.inf || 0));

    const COLS = [
      { h: "Factor",       x: M,       w: 88 },
      { h: "Type",         x: M + 90,  w: 44 },
      { h: "Invloed",      x: M + 136, w: 22 },
      { h: "r Hoofddoel",  x: M + 160, w: 22 },
    ];

    // thead
    checkBreak(10);
    pdf.setFillColor(241, 245, 249);
    pdf.rect(M, y - 4.5, CW, 7, "F");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...LIGHT);
    pdf.setFont(undefined, "bold");
    COLS.forEach(c => pdf.text(c.h, c.x, y));
    pdf.setFont(undefined, "normal");
    y += 4;
    hRule(); y += 2;

    rows.forEach((r, i) => {
      checkBreak(7);
      if (i % 2 === 0) { pdf.setFillColor(...BG); pdf.rect(M, y - 4.5, CW, 6.5, "F"); }
      const rgb = TYPE_RGB[r.type] || [100, 116, 139];
      pdf.setFontSize(8.5);
      pdf.setTextColor(...DARK);
      pdf.text(r.label.length > 42 ? r.label.slice(0, 40) + "…" : r.label, COLS[0].x, y);
      pdf.setFontSize(7.5);
      pdf.setTextColor(...rgb);
      pdf.text(TYPE_LABEL[r.type] || r.type, COLS[1].x, y);
      pdf.setTextColor(...DARK);
      pdf.setFont(undefined, "bold");
      pdf.text(r.inf != null ? `${(r.inf * 100).toFixed(0)}%` : "—", COLS[2].x, y);
      pdf.setFont(undefined, "normal");
      const cRgb = r.corr > 0.6 ? [16, 185, 129] : r.corr > 0.4 ? [180, 110, 10] : LIGHT;
      pdf.setTextColor(...cRgb);
      pdf.text(r.corr != null ? r.corr.toFixed(2) : "—", COLS[3].x, y);
      y += 6.5;
    });
    y += 4;
  };

  // ── Oplossingen datatabel ────────────────────────────────────────────────────
  const drawSolutionTable = (solNodes, solEdges, solInf) => {
    if (!solNodes?.length) return;
    sectionHeader("Oplossingen — gegevenstabel", true);
    const rows = [...solNodes].sort((a, b) => (solInf?.[b.label] || 0) - (solInf?.[a.label] || 0));

    const COLS = [
      { h: "Oplossing",     x: M,       w: 98 },
      { h: "Type",          x: M + 100, w: 52 },
      { h: "Effectiviteit", x: M + 154, w: 28 },
    ];

    checkBreak(10);
    pdf.setFillColor(241, 245, 249);
    pdf.rect(M, y - 4.5, CW, 7, "F");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...LIGHT);
    pdf.setFont(undefined, "bold");
    COLS.forEach(c => pdf.text(c.h, c.x, y));
    pdf.setFont(undefined, "normal");
    y += 4;
    hRule(); y += 2;

    rows.forEach((sn, i) => {
      checkBreak(7);
      if (i % 2 === 0) { pdf.setFillColor(...BG); pdf.rect(M, y - 4.5, CW, 6.5, "F"); }
      const rgb = TYPE_RGB[sn.type] || [100, 116, 139];
      const eff = solInf?.[sn.label];
      pdf.setFontSize(8.5);
      pdf.setTextColor(...DARK);
      pdf.text(sn.label.length > 46 ? sn.label.slice(0, 44) + "…" : sn.label, COLS[0].x, y);
      pdf.setFontSize(7.5);
      pdf.setTextColor(...rgb);
      pdf.text(TYPE_LABEL[sn.type] || sn.type, COLS[1].x, y);
      pdf.setFont(undefined, "bold");
      pdf.text(eff != null ? `${(eff * 100).toFixed(0)}%` : "—", COLS[2].x, y);
      pdf.setFont(undefined, "normal");
      y += 6.5;
    });
    y += 4;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT OPBOUW
  // ═══════════════════════════════════════════════════════════════════════════
  setWhitePage();

  // ── Omslagpagina ─────────────────────────────────────────────────────────────
  pdf.setFontSize(24);
  pdf.setTextColor(...AMBER);
  pdf.setFont(undefined, "bold");
  pdf.text("CausalNet", M, y + 8);
  pdf.setFontSize(9);
  pdf.setTextColor(...LIGHT);
  pdf.setFont(undefined, "normal");
  pdf.text(new Date().toLocaleDateString("nl-NL"), PW - M, y + 8, { align: "right" });
  y += 16;

  pdf.setFontSize(15);
  pdf.setTextColor(...DARK);
  pdf.setFont(undefined, "bold");
  const titleLines = pdf.splitTextToSize(problem, CW);
  titleLines.forEach(l => { pdf.text(l, M, y); y += 7.5; });
  pdf.setFont(undefined, "normal");
  y += 2;
  hRule(AMBER); y += 10;

  // Inhoudsopgave
  pdf.setFontSize(10);
  pdf.setTextColor(...DARK);
  pdf.setFont(undefined, "bold");
  pdf.text("Inhoudsopgave", M, y); y += 7;
  pdf.setFont(undefined, "normal");

  const analysedSubs = (subAnalyses || []).filter(s => s.analysed && s.report);
  const hasSupplement = (supplementSections || []).length > 0;

  const tocItems = [
    { nr: "1", title: "Hoofdanalyse" },
    { nr: "2", title: "Invloedscores per factor" },
  ];
  analysedSubs.forEach((s, i) => {
    const isProb = s.analysisMode === "problems";
    tocItems.push({ nr: `${i + 3}`, title: `${isProb ? "Oorzakenanalyse" : "Oplossingsanalyse"} — ${s.factorLabel}` });
  });
  if (hasSupplement)
    tocItems.push({ nr: `${analysedSubs.length + 3}`, title: "Toegevoegde bronnen" });

  pdf.setFontSize(9);
  tocItems.forEach(t => {
    checkBreak(6);
    pdf.setTextColor(...AMBER);
    pdf.text(`${t.nr}.`, M + 2, y);
    pdf.setTextColor(...MID);
    pdf.text(t.title, M + 10, y);
    y += 6;
  });

  // ── Sectie 1 + 2: Hoofdanalyse + invloedscores ───────────────────────────────
  newPage();
  sectionHeader("1. Hoofdanalyse");

  // Screenshot hoofdnetwerk
  if (screenshots?.main) {
    await drawScreenshot(screenshots.main, "Schermopname hoofdnetwerk");
  }

  const factorChartItems = nodes
    .filter(n => n.type !== "maingoal" && influence?.[n.label] != null)
    .sort((a, b) => (influence[b.label] || 0) - (influence[a.label] || 0))
    .map(n => ({ label: n.label, value: influence[n.label], type: n.type }));

  if (factorChartItems.length) {
    drawBarChart(factorChartItems, "2. Invloedscores per factor");
  }

  sectionHeader("Analyserapport", true);
  drawReport(report);

  // ── Secties 3+: Oplossings- en Oorzakenanalyses ─────────────────────────────
  for (let i = 0; i < analysedSubs.length; i++) {
    const sub = analysedSubs[i];
    newPage();
    const isProb = sub.analysisMode === "problems";
    const rgb = TYPE_RGB[sub.factorType] || [100, 116, 139];

    // Factor-kop
    pdf.setFontSize(8);
    pdf.setTextColor(...rgb);
    pdf.setFont(undefined, "bold");
    pdf.text((TYPE_LABEL[sub.factorType] || sub.factorType).toUpperCase(), M, y);
    pdf.setFont(undefined, "normal");
    y += 5;

    pdf.setFontSize(14);
    pdf.setTextColor(...DARK);
    pdf.setFont(undefined, "bold");
    const sectionTitle = `${i + 3}. ${isProb ? "Oorzakenanalyse" : "Oplossingsanalyse"} — ${sub.factorLabel}`;
    const ftLines = pdf.splitTextToSize(sectionTitle, CW);
    ftLines.forEach(l => { checkBreak(8); pdf.text(l, M, y); y += 7; });
    pdf.setFont(undefined, "normal");
    y += 1;
    hRule(LINE); y += 6;

    // Screenshot sub-netwerk
    if (screenshots?.subs?.[sub.id]) {
      await drawScreenshot(screenshots.subs[sub.id], `Schermopname ${isProb ? "oorzaken" : "oplossingen"}-netwerk`);
    }

    // Scores grafiek
    if (sub.nodes?.length && sub.influence) {
      const solItems = [...sub.nodes]
        .filter(sn => sub.influence[sn.label] != null)
        .sort((a, b) => (sub.influence[b.label] || 0) - (sub.influence[a.label] || 0))
        .map(sn => ({ label: sn.label, value: sub.influence[sn.label], type: sn.type }));
      if (solItems.length) drawBarChart(solItems, isProb ? "Bijdrage oorzaken" : "Effectiviteitsscores oplossingen");
    }

    // Rapport
    if (sub.report) {
      sectionHeader("Analyse", true);
      drawReport(sub.report);
    }
  }

  // ── Toegevoegde bronnen — elk op eigen pagina ────────────────────────────────
  if (hasSupplement) {
    supplementSections.forEach((s, i) => {
      newPage();
      // Sectie-header alleen op de eerste bron
      if (i === 0) {
        sectionHeader(`${analysedSubs.length + 3}. Toegevoegde bronnen`);
      }
      pdf.setFontSize(8.5);
      pdf.setTextColor(...BLUE);
      pdf.setFont(undefined, "bold");
      const srcLabel = `Bron ${i + 1}: ${s.source.length > 85 ? s.source.slice(0, 83) + "…" : s.source}`;
      const srcLines = pdf.splitTextToSize(srcLabel, CW);
      srcLines.forEach(l => { checkBreak(6); pdf.text(l, M, y); y += 5; });
      pdf.setFont(undefined, "normal");
      y += 2;
      hRule(); y += 4;
      drawReport(s.text);
    });
  }

  // Laatste pagina footer
  addFooter();

  const slug = problem.slice(0, 40).replace(/[^a-z0-9]/gi, "_").toLowerCase();
  pdf.save(`CausalNet_volledig_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ─── Volledig overzichtsdocument Word ─────────────────────────────────────────
export const exportAllWord = ({ problem, nodes, edges, influence, report, supplementSections, subAnalyses }) => {
  const TYPE_COLOR = {
    maingoal:     "#f59e0b", goal:        "#34d399", risk:        "#f87171",
    protective:   "#60a5fa", amplifying:  "#a78bfa",
    interventie:  "#10b981", beleid:      "#8b5cf6", omgeving:    "#f97316", gedrag: "#06b6d4",
    // PROBLEM_TYPES
    onderliggend: "#dc2626", versterkend: "#f97316", trigger:     "#eab308", structureel: "#a855f7",
  };
  const TYPE_LABEL = {
    maingoal:     "Hoofddoel",      goal:        "Doel",
    risk:         "Risicofactor",   protective:  "Beschermende factor", amplifying: "Versterkende factor",
    interventie:  "Interventie",    beleid:      "Beleidsmaatregel",
    omgeving:     "Omgevingsfactor",gedrag:      "Gedragsverandering",
    // PROBLEM_TYPES
    onderliggend: "Onderliggende oorzaak", versterkend: "Versterkende oorzaak",
    trigger:      "Trigger",               structureel: "Structurele oorzaak",
  };

  const pageBreak = () => `<div style="page-break-before:always;margin:0;padding:0">&nbsp;</div>`;

  // ── Markdown → HTML ──────────────────────────────────────────────────────────
  const reportToHtml = (rawRep) => {
    if (!rawRep) return "";
    const { text } = numberifyCitations(rawRep);
    let html = "";
    let inSources = false;
    text.split("\n").forEach(line => {
      if (line.startsWith("# ") && !line.startsWith("## ")) {
        html += `<h2 style="font-size:13pt;color:#1e293b;margin:18px 0 3px">${esc(stripMarkdown(line.slice(2)))}</h2>\n`;
      } else if (line.startsWith("## ")) {
        inSources = /bron|referentie|source/i.test(line);
        html += `<h2 style="font-size:12pt;color:#b46a0a;margin:18px 0 3px;border-bottom:1px solid #e2e8f0;padding-bottom:3px">${esc(line.slice(3))}</h2>\n`;
      } else if (line.startsWith("### ")) {
        html += `<h3 style="font-size:10.5pt;color:#1e293b;margin:12px 0 2px">${esc(stripMarkdown(line.slice(4)))}</h3>\n`;
      } else if (line.trim() === "") {
        html += "<p style='margin:2px 0'>&nbsp;</p>\n";
      } else if (inSources) {
        const numMatch = line.trim().match(/^\[(\d+)\]\s+/);
        if (numMatch) {
          const nr   = numMatch[1];
          const rest = line.trim().slice(numMatch[0].length);
          html += `<p style="font-size:8.5pt;color:#2563eb;margin:3px 0 3px 0;display:flex;gap:6px">
            <span style="display:inline-block;min-width:20px;padding:0 3px;background:#dbeafe;border:1px solid #93c5fd;border-radius:3px;color:#1d4ed8;font-weight:700;font-size:7.5pt;text-align:center">${esc(nr)}</span>
            <span>${mdLineToHtml(rest)}</span></p>\n`;
        } else {
          html += `<p style="font-size:8.5pt;color:#2563eb;margin:3px 0 3px 10px">${mdLineToHtml(line.trim())}</p>\n`;
        }
      } else {
        html += `<p style="font-size:10.5pt;color:#475569;line-height:1.7;margin:3px 0">${mdLineToHtml(line)}</p>\n`;
      }
    });
    return html;
  };

  // ── Balkengrafiek als HTML-tabel ─────────────────────────────────────────────
  const barChartHtml = (items, title) => {
    if (!items.length) return "";
    let h = `<h3 style="font-size:10pt;color:#b46a0a;margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.5px">${esc(title)}</h3>`;
    h += `<table style="width:100%;border-collapse:collapse;margin-bottom:12px">`;
    items.forEach(({ label, value, type }) => {
      const col = TYPE_COLOR[type] || "#64748b";
      const pct = (value * 100).toFixed(0);
      const barW = Math.round(value * 200);
      h += `<tr>
        <td style="width:220px;font-size:9pt;color:#1e293b;padding:2px 6px 2px 0;vertical-align:middle">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:5px"></span>${esc(label)}
        </td>
        <td style="vertical-align:middle;padding:2px 0">
          <div style="width:${barW}px;height:8px;background:${col};border-radius:3px;display:inline-block"></div>
          <span style="font-size:9pt;color:${col};font-weight:bold;margin-left:6px">${pct}%</span>
        </td>
      </tr>`;
    });
    h += `</table>`;
    return h;
  };

  const date = new Date().toLocaleDateString("nl-NL");
  const analysedSubs = (subAnalyses || []).filter(s => s.analysed && s.report);
  const hasSupplement = (supplementSections || []).length > 0;

  // ── Inhoudsopgave ────────────────────────────────────────────────────────────
  const tocNrs = ["1. Hoofdanalyse", "2. Invloedscores per factor"];
  analysedSubs.forEach((s, i) => {
    const isProb = s.analysisMode === "problems";
    tocNrs.push(`${i + 3}. ${isProb ? "Oorzakenanalyse" : "Oplossingsanalyse"} — ${s.factorLabel}`);
  });
  if (hasSupplement) tocNrs.push(`${analysedSubs.length + 3}. Toegevoegde bronnen`);

  let toc = `<h2 style="font-size:11pt;color:#1e293b;margin:16px 0 6px">Inhoudsopgave</h2>`;
  toc += `<ul style="list-style:none;padding:0;margin:0">`;
  tocNrs.forEach(t => { toc += `<li style="font-size:9.5pt;color:#64748b;padding:2px 0 2px 6px">${esc(t)}</li>`; });
  toc += `</ul>`;

  // ── Invloedscores ────────────────────────────────────────────────────────────
  const factorItems = nodes
    .filter(n => n.type !== "maingoal" && influence?.[n.label] != null)
    .sort((a, b) => (influence[b.label] || 0) - (influence[a.label] || 0))
    .map(n => ({ label: n.label, value: influence[n.label], type: n.type }));

  // ── Body samenstellen ────────────────────────────────────────────────────────
  let body = "";

  // Omslag
  body += `<p style="font-size:9pt;color:#94a3b8;margin-bottom:6px">CausalNet &nbsp;|&nbsp; ${date}</p>`;
  body += `<h1 style="font-size:18pt;color:#1e293b;margin:0 0 6px">${esc(problem)}</h1>`;
  body += `<hr style="border:none;border-top:2px solid #f59e0b;margin:8px 0 16px">`;
  body += toc;

  // Sectie 1 + 2
  body += pageBreak();
  body += `<h2 style="font-size:13pt;color:#b46a0a;margin:0 0 4px;border-bottom:1px solid #e2e8f0;padding-bottom:3px">1. HOOFDANALYSE</h2>`;
  if (factorItems.length) {
    body += barChartHtml(factorItems, "2. Invloedscores per factor");
  }
  body += `<h3 style="font-size:10pt;color:#b46a0a;margin:14px 0 4px;text-transform:uppercase">Analyserapport</h3>`;
  body += reportToHtml(report);

  // Secties 3+: oplossingen / oorzaken
  analysedSubs.forEach((sub, i) => {
    body += pageBreak();
    const isProb = sub.analysisMode === "problems";
    const col = TYPE_COLOR[sub.factorType] || "#64748b";
    body += `<p style="font-size:8pt;color:${col};font-weight:bold;margin:0 0 3px;text-transform:uppercase;letter-spacing:0.5px">${esc(TYPE_LABEL[sub.factorType] || sub.factorType)}</p>`;
    const wordSectionTitle = `${i + 3}. ${isProb ? "Oorzakenanalyse" : "Oplossingsanalyse"} — ${sub.factorLabel}`;
    body += `<h2 style="font-size:13pt;color:#1e293b;margin:0 0 4px;border-bottom:1px solid #e2e8f0;padding-bottom:3px">${esc(wordSectionTitle)}</h2>`;

    if (sub.nodes?.length && sub.influence) {
      const solItems = [...sub.nodes]
        .filter(sn => sub.influence[sn.label] != null)
        .sort((a, b) => (sub.influence[b.label] || 0) - (sub.influence[a.label] || 0))
        .map(sn => ({ label: sn.label, value: sub.influence[sn.label], type: sn.type }));
      if (solItems.length) body += barChartHtml(solItems, isProb ? "Bijdrage oorzaken" : "Effectiviteitsscores oplossingen");
    }

    if (sub.report) {
      body += `<h3 style="font-size:10pt;color:#b46a0a;margin:14px 0 4px;text-transform:uppercase">Analyse</h3>`;
      body += reportToHtml(sub.report);
    }
  });

  // Toegevoegde bronnen — elk op eigen pagina
  if (hasSupplement) {
    supplementSections.forEach((s, i) => {
      body += pageBreak();
      if (i === 0) {
        body += `<h2 style="font-size:13pt;color:#b46a0a;margin:0 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:3px">${esc(`${analysedSubs.length + 3}. TOEGEVOEGDE BRONNEN`)}</h2>`;
      }
      const srcLabel = s.source.length > 100 ? s.source.slice(0, 98) + "…" : s.source;
      body += `<p style="font-size:9pt;color:#2563eb;font-weight:bold;margin:0 0 4px">${esc(`Bron ${i + 1}: ${srcLabel}`)}</p>`;
      body += `<hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 8px">`;
      body += reportToHtml(s.text);
    });
  }

  // ── HTML document ────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>CausalNet — ${esc(problem)}</title>
<!--[if gte mso 9]>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/></w:WordDocument></xml>
<![endif]-->
<style>
  body  { font-family: Calibri, sans-serif; margin: 2cm; background: white; }
  h1    { font-size: 18pt; color: #1e293b; }
  h2    { font-size: 13pt; color: #1e293b; }
  h3    { font-size: 11pt; color: #1e293b; }
  p     { font-size: 10.5pt; color: #475569; line-height: 1.7; }
  a     { color: #2563eb; }
  table { border-collapse: collapse; }
</style>
</head>
<body>${body}</body>
</html>`;

  const blob = new Blob([html], { type: "application/msword" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const slug = problem.slice(0, 40).replace(/[^a-z0-9]/gi, "_").toLowerCase();
  a.href     = url;
  a.download = `CausalNet_volledig_${slug}_${new Date().toISOString().slice(0, 10)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
};
