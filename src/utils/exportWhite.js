// White-background exports: PDF (text-rendered) and Word (.doc HTML)

// Strip markdown to plain text, preserve bold markers for PDF
const stripLinks = (text) =>
  text
    .replace(/\(\[([^\]]+)\]\([^)]+\)\)/g, "[$1]")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)\]]+/g, "");

const stripMarkdown = (text) =>
  stripLinks(text).replace(/\*\*([^*]+)\*\*/g, "$1");

// ─── White PDF ────────────────────────────────────────────────────────────────
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

  // Body: parse markdown lines
  const lines = report.split("\n");
  let inSources = false;

  lines.forEach((line) => {
    if (line.startsWith("## ")) {
      inSources = /bron|referentie|source/i.test(line);
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
    } else if (inSources) {
      const plain = stripMarkdown(line.trim());
      if (!plain) return;
      checkBreak(7);
      pdf.setFontSize(8);
      pdf.setTextColor(...BLUE);
      const wrapped = pdf.splitTextToSize(plain, contentWidth - 4);
      wrapped.forEach(l => { checkBreak(5); pdf.text(l, margin + 2, y); y += 4.5; });
      y += 1;
    } else {
      const plain = stripMarkdown(line);
      if (!plain.trim()) return;
      checkBreak(6);
      pdf.setFontSize(9.5);
      pdf.setTextColor(...MID);
      const wrapped = pdf.splitTextToSize(plain, contentWidth);
      wrapped.forEach(l => { checkBreak(5); pdf.text(l, margin, y); y += 5; });
      y += 1;
    }
  });

  pdf.save(`CausalNet_analyse_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ─── Word (.doc via HTML) ─────────────────────────────────────────────────────
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const mdLineToHtml = (line) => {
  // bold
  let s = line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // citation links ([text](url))
  s = s.replace(
    /\(\[([^\]]+)\]\(([^)]+)\)\)/g,
    (_, txt, url) => `<a href="${esc(url)}" style="color:#2563eb;font-size:0.85em">${esc(txt)}</a>`
  );
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, txt, url) => `<a href="${esc(url)}" style="color:#2563eb">${esc(txt)}</a>`
  );
  // bare URLs
  s = s.replace(
    /https?:\/\/[^\s<>")\]]+/g,
    (url) => `<a href="${esc(url)}" style="color:#2563eb">${esc(url)}</a>`
  );
  return s;
};

export const exportAnalysisWord = (report, problem) => {
  const lines = report.split("\n");
  let body = "";
  let inSources = false;

  lines.forEach((line) => {
    if (line.startsWith("## ")) {
      inSources = /bron|referentie|source/i.test(line);
      body += `<h2 style="font-size:13pt;color:#1e293b;margin:20px 0 4px;border-bottom:1px solid #e2e8f0;padding-bottom:4px">${esc(line.slice(3))}</h2>\n`;
    } else if (line.trim() === "") {
      body += "<p style='margin:2px 0'>&nbsp;</p>\n";
    } else if (inSources) {
      body += `<p style="font-size:9pt;color:#2563eb;margin:4px 0 4px 10px">${mdLineToHtml(line.trim())}</p>\n`;
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
