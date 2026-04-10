import { TYPES } from "../constants";

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

const ensureHtml2Canvas = async () => {
  if (window.html2canvas) return window.html2canvas;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = () => resolve(window.html2canvas);
    s.onerror = reject;
    document.head.appendChild(s);
  });
};

const captureElement = async (ref) => {
  const el = ref.current;
  const html2canvas = await ensureHtml2Canvas();

  // Temporarily show hidden elements for capture
  const wasHidden = el.style.display === "none";
  if (wasHidden) {
    el.style.display = "flex";
    el.style.position = "absolute";
    el.style.left = "-9999px";
    el.style.width = "900px";
    el.style.height = "600px";
    // Allow layout to settle
    await new Promise(r => setTimeout(r, 100));
  }

  const canvas = await html2canvas(el, {
    backgroundColor: "#080d1a",
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
  });

  if (wasHidden) {
    el.style.display = "none";
    el.style.position = "";
    el.style.left = "";
    el.style.width = "";
    el.style.height = "";
  }

  return canvas;
};

const addHeader = (pdf, problem, pageWidth, margin) => {
  pdf.setFontSize(16);
  pdf.setTextColor(245, 158, 11);
  pdf.text("CausalNet", margin, 15);
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  const date = new Date().toLocaleDateString("nl-NL");
  pdf.text(date, pageWidth - margin, 15, { align: "right" });
  pdf.setFontSize(11);
  pdf.setTextColor(226, 232, 240);
  pdf.text(problem.length > 80 ? problem.slice(0, 77) + "\u2026" : problem, margin, 22);
  pdf.setDrawColor(255, 255, 255, 30);
  pdf.line(margin, 25, pageWidth - margin, 25);
  return 30;
};

const canvasToJpeg = (canvas) => canvas.toDataURL("image/jpeg", 0.92);

const addImagePaginated = (pdf, canvas, startY, margin, pageWidth, pageHeight) => {
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height / canvas.width) * imgWidth;
  const availableHeight = pageHeight - startY - margin;

  if (imgHeight <= availableHeight) {
    pdf.addImage(canvasToJpeg(canvas), "JPEG", margin, startY, imgWidth, imgHeight);
    return;
  }

  const scale = canvas.width / imgWidth;
  let srcY = 0;
  let firstPage = true;

  while (srcY < canvas.height) {
    if (!firstPage) {
      pdf.addPage();
      pdf.setFillColor(8, 13, 26);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      startY = margin;
    }
    const sliceHeight = (firstPage ? availableHeight : pageHeight - margin * 2) * scale;
    const actualSlice = Math.min(sliceHeight, canvas.height - srcY);

    const chunk = document.createElement("canvas");
    chunk.width = canvas.width;
    chunk.height = actualSlice;
    const ctx = chunk.getContext("2d");
    ctx.drawImage(canvas, 0, srcY, canvas.width, actualSlice, 0, 0, canvas.width, actualSlice);

    const chunkImgHeight = (actualSlice / canvas.width) * imgWidth;
    pdf.addImage(canvasToJpeg(chunk), "JPEG", margin, startY, imgWidth, chunkImgHeight);

    srcY += actualSlice;
    firstPage = false;
  }
};

export const exportTextPdf = async (analysisPanelRef, problem) => {
  if (!analysisPanelRef?.current) throw new Error("Analyse panel niet beschikbaar");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;

  pdf.setFillColor(8, 13, 26);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  const startY = addHeader(pdf, problem, pageWidth, margin);

  const canvas = await captureElement(analysisPanelRef);
  addImagePaginated(pdf, canvas, startY, margin, pageWidth, pageHeight);

  pdf.save(`CausalNet_analyse_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportFullPdf = async (networkPanelRef, analysisPanelRef, nodes, influence, problem) => {
  if (!networkPanelRef?.current) throw new Error("Netwerk panel niet beschikbaar — ga eerst naar het Netwerk tabblad");
  if (!analysisPanelRef?.current) throw new Error("Analyse panel niet beschikbaar");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;

  // --- Page 1: Network graph ---
  pdf.setFillColor(8, 13, 26);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  let y = addHeader(pdf, problem, pageWidth, margin);

  const graphCanvas = await captureElement(networkPanelRef);
  const graphWidth = pageWidth - margin * 2;
  const graphHeight = (graphCanvas.height / graphCanvas.width) * graphWidth;
  const maxGraphHeight = pageHeight - y - margin;
  const finalGraphHeight = Math.min(graphHeight, maxGraphHeight);
  const finalGraphWidth = graphHeight > maxGraphHeight
    ? (graphCanvas.width / graphCanvas.height) * finalGraphHeight
    : graphWidth;
  const graphX = margin + (graphWidth - finalGraphWidth) / 2;
  pdf.addImage(canvasToJpeg(graphCanvas), "JPEG", graphX, y, finalGraphWidth, finalGraphHeight);

  // --- Page 2: Influence scores ---
  pdf.addPage();
  pdf.setFillColor(8, 13, 26);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  y = addHeader(pdf, problem, pageWidth, margin);

  pdf.setFontSize(11);
  pdf.setTextColor(245, 158, 11);
  pdf.text("Invloedscores per factor", margin, y);
  y += 8;

  const sortedNodes = nodes
    .filter(n => n.type !== "maingoal")
    .sort((a, b) => (influence?.[b.label] || 0) - (influence?.[a.label] || 0));

  const barMaxWidth = pageWidth - margin * 2 - 80;
  const rowHeight = 7;

  sortedNodes.forEach(n => {
    if (y > pageHeight - margin - 10) {
      pdf.addPage();
      pdf.setFillColor(8, 13, 26);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      y = margin + 5;
    }

    const inf = influence?.[n.label] ?? 0;
    const t = TYPES[n.type];
    const [r, g, b] = hexToRgb(t.color);

    // Colored dot
    pdf.setFillColor(r, g, b);
    pdf.circle(margin + 2, y - 1.5, 1.5, "F");

    // Label
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    const label = n.label.length > 30 ? n.label.slice(0, 27) + "\u2026" : n.label;
    pdf.text(label, margin + 6, y);

    // Bar background
    const barX = margin + 55;
    pdf.setFillColor(30, 41, 59);
    pdf.rect(barX, y - 3, barMaxWidth, 4, "F");

    // Bar fill
    pdf.setFillColor(r, g, b);
    pdf.rect(barX, y - 3, barMaxWidth * inf, 4, "F");

    // Percentage
    pdf.setFontSize(8);
    pdf.setTextColor(r, g, b);
    pdf.text(`${(inf * 100).toFixed(0)}%`, barX + barMaxWidth + 3, y);

    y += rowHeight;
  });

  // --- Page 3+: Analysis text ---
  pdf.addPage();
  pdf.setFillColor(8, 13, 26);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  y = addHeader(pdf, problem, pageWidth, margin);

  pdf.setFontSize(11);
  pdf.setTextColor(245, 158, 11);
  pdf.text("Wetenschappelijke analyse", margin, y);
  y += 6;

  const analysisCanvas = await captureElement(analysisPanelRef);
  addImagePaginated(pdf, analysisCanvas, y, margin, pageWidth, pageHeight);

  pdf.save(`CausalNet_volledig_${new Date().toISOString().slice(0, 10)}.pdf`);
};
