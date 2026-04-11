import { useState, useRef } from "react";
import { TYPES, uid } from "./constants";
import { apiUrl, apiHeaders, callAPI } from "./api";
import useForceLayout from "./hooks/useForceLayout";
import { extractSourcesFromReport, readFile } from "./utils/sources";
import Header from "./components/Header";
import ProblemPhase from "./components/ProblemPhase";
import SuggestionPanel from "./components/SuggestionPanel";
import SourcesPhase from "./components/SourcesPhase";
import ReanalysePhase from "./components/ReanalysePhase";
import NetworkPhase from "./components/NetworkPhase";
import ScreenshotModal from "./components/ScreenshotModal";

export default function App() {
  const networkPanelRef = useRef(null);
  const fullPanelRef = useRef(null);
  const analysisPanelRef = useRef(null);

  const [screenshotting, setScreenshotting] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem("causalnet_apikey") || ""; } catch { return ""; }
  });

  const [phase, setPhase] = useState("problem");
  const [problem, setProblem] = useState("");
  const [sugLoading, setSugLoading] = useState(false);
  const [suggestions, setSuggestions] = useState({});
  const [checked, setChecked] = useState({});
  const [sugError, setSugError] = useState("");
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("risk");
  const [tab, setTab] = useState("graph");
  const [steps, setSteps] = useState([]);
  const [anaLoading, setAnaLoading] = useState(false);
  const [report, setReport] = useState("");
  const [anaError, setAnaError] = useState("");
  const [influence, setInfluence] = useState(null);
  const [analysed, setAnalysed] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [sourceMode, setSourceMode] = useState("both");
  const [dragOver, setDragOver] = useState(false);

  const [reanalyseStep, setReanalyseStep] = useState(1);
  const [reanalyseSources, setReanalyseSources] = useState([]);
  const [reanalyseNodes, setReanalyseNodes] = useState([]);
  const [reanalyseNewFactor, setReanalyseNewFactor] = useState("");
  const [reanalyseNewType, setReanalyseNewType] = useState("risk");
  const [reanalyseNewSource, setReanalyseNewSource] = useState("");

  // Refine sources (extracted from report)
  const [refineSources, setRefineSources] = useState([]);

  const { positions, posRef } = useForceLayout(nodes, edges, influence, 900, 600);

  const takeScreenshot = async (ref, filename) => {
    if (!ref.current) return;
    setScreenshotting(true);
    try {
      if (!window.html2canvas) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const canvas = await window.html2canvas(ref.current, {
        backgroundColor: "#080d1a", scale: 2,
        useCORS: true, allowTaint: true, logging: false,
      });
      setScreenshot({ dataUrl: canvas.toDataURL("image/png"), name: filename + "_" + new Date().toISOString().slice(0, 10) + ".png" });
    } catch (e) {
      alert("Screenshot mislukt: " + e.message);
    }
    setScreenshotting(false);
  };

  const addStep = txt => setSteps(s => [...s, { id: uid(), txt, done: false }]);
  const doneStep = () => setSteps(s => s.map((st, i) => i === s.length - 1 ? { ...st, done: true } : st));

  const generateSuggestions = async () => {
    if (!problem.trim()) return;
    setSugLoading(true); setSugError(""); setSuggestions({}); setChecked({});
    const prompt = `Je bent een klinisch-wetenschappelijke expert in causal factor network analyse.\nProbleemstelling: "${problem}"\nGenereer factoren. Geef ALLEEN geldig JSON (geen uitleg, geen backticks):\n{"maingoal":["..."],"goal":["..."],"risk":["...","...","...","..."],"protective":["...","...","..."],"amplifying":["...","..."]}\nRegels: maingoal 1-2, goal 2-4, risk 4-6, protective 3-5, amplifying 2-4. Max 5 woorden per factor. Nederlands.`;
    try {
      const raw = await callAPI(apiKey, [{ role: "user", content: prompt }], null, 800);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setSuggestions(parsed);
      const init = {};
      Object.entries(parsed).forEach(([type, items]) => items.forEach(item => { init[type + "::" + item] = true; }));
      setChecked(init);
      setPhase("suggestions");
    } catch (e) { setSugError("Fout: " + e.message); }
    setSugLoading(false);
  };

  const confirmSuggestions = () => {
    const newNodes = [];
    Object.entries(checked).forEach(([key, on]) => {
      if (!on) return;
      const idx = key.indexOf("::");
      newNodes.push({ id: uid(), label: key.slice(idx + 2), type: key.slice(0, idx) });
    });
    setNodes(newNodes); setEdges([]); setReport(""); setSteps([]);
    setInfluence(null); setAnalysed(false);
    setPhase("sources");
  };

  const handleFileDrop = async (e) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || e.target?.files || [])
      .filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!files.length) return;
    try {
      const docs = await Promise.all(files.map(readFile));
      setUploadedDocs(prev => [...prev, ...docs]);
    } catch (err) {
      alert("PDF laden mislukt: " + err.message);
    }
  };

  const addNode = () => {
    if (!newLabel.trim()) return;
    setNodes(p => [...p, { id: uid(), label: newLabel.trim(), type: newType }]);
    setNewLabel("");
  };

  const removeNode = id => {
    setNodes(p => p.filter(n => n.id !== id));
    setEdges(p => p.filter(e => e.from !== id && e.to !== id));
    if (selected === id) setSelected(null);
  };

  const analyze = async (overrideNodes) => {
    const currentNodes = overrideNodes || nodes;
    if (currentNodes.length < 2) return;
    setAnaLoading(true); setAnaError(""); setReport(""); setSteps([]);
    setInfluence(null); setAnalysed(false);

    const byType = t => currentNodes.filter(n => n.type === t).map(n => n.label);
    const center = currentNodes.find(n => n.type === "maingoal") || currentNodes.find(n => n.type === "goal");
    const centerLabel = center?.label || "hoofddoel";
    const goalNodes = currentNodes.filter(n => n.type === "goal" && n.id !== center?.id);
    const allNonCenter = currentNodes.filter(n => n.id !== center?.id);
    const indexed = allNonCenter.map((n, i) => ({ idx: i, id: n.id, label: n.label, type: n.type }));

    setTab("analysis");

    // CALL 1: Text report
    addStep(reanalyseSources.length > 0
      ? `Wetenschappelijke literatuur raadplegen (${reanalyseSources.filter(s => s.active).length} geselecteerde bronnen)\u2026`
      : uploadedDocs.length > 0
        ? `Wetenschappelijke literatuur raadplegen (${uploadedDocs.length} eigen doc${uploadedDocs.length > 1 ? "s" : ""})\u2026`
        : "Wetenschappelijke literatuur raadplegen\u2026");
    let reportText = "";
    try {
      const activeTextSources = reanalyseSources.filter(s => s.active && !s.isDoc);
      const activeDocIds = reanalyseSources.filter(s => s.active && s.isDoc).map(s => s.docId);
      const activeUploadedDocs = reanalyseSources.length > 0
        ? uploadedDocs.filter(d => activeDocIds.includes(d.id))
        : uploadedDocs;

      let docInstruction = "";
      if (activeTextSources.length > 0 && activeUploadedDocs.length > 0) {
        const srcList = activeTextSources.map(s => `- ${s.text}${s.url ? " (" + s.url + ")" : ""}`).join("\n");
        docInstruction = sourceMode === "own"
          ? `\n\nBelangrijk: baseer de analyse UITSLUITEND op de meegestuurde documenten en de onderstaande bronnen. Gebruik GEEN andere bronnen.\nGeselecteerde bronnen:\n${srcList}`
          : `\n\nGebruik de meegestuurde documenten en onderstaande bronnen als primaire basis. Vul aan met andere literatuur.\nGeselecteerde bronnen:\n${srcList}`;
      } else if (activeTextSources.length > 0) {
        const srcList = activeTextSources.map(s => `- ${s.text}${s.url ? " (" + s.url + ")" : ""}`).join("\n");
        docInstruction = sourceMode === "own"
          ? `\n\nBelangrijk: baseer de analyse UITSLUITEND op de onderstaande bronnen. Gebruik GEEN andere bronnen:\n${srcList}`
          : `\n\nGebruik bij voorkeur de onderstaande bronnen. Vul aan met andere wetenschappelijke literatuur:\n${srcList}`;
      } else if (activeUploadedDocs.length > 0) {
        docInstruction = sourceMode === "own"
          ? `\n\nBelangrijk: baseer de analyse UITSLUITEND op de meegestuurde documenten. Gebruik geen andere bronnen.`
          : `\n\nEr zijn ${activeUploadedDocs.length} eigen document(en) meegestuurd. Gebruik deze als primaire bronnen en vul aan met andere wetenschappelijke literatuur.`;
      }

      const userContent = [
        { type: "text", text:
          `Probleemstelling: ${problem}\n\nFactoren:\n` +
          `- Hoofddoel: ${centerLabel}\n` +
          `- Subdoelen: ${goalNodes.map(n => n.label).join(", ") || "\u2014"}\n` +
          `- Risicofactoren: ${byType("risk").join(", ") || "\u2014"}\n` +
          `- Beschermende factoren: ${byType("protective").join(", ") || "\u2014"}\n` +
          `- Versterkende factoren: ${byType("amplifying").join(", ") || "\u2014"}\n` +
          docInstruction + `\n\n` +
          `CITATIEINSTRUCTIE \u2014 VOLG DIT EXACT:\n` +
          `Na elke feitelijke claim of statistiek plaatst u een inline citaat tussen haakjes, ALTIJD met een klikbare DOI-link in dit exacte formaat:\n` +
          `([Auteur et al., jaar](https://doi.org/xxxxx))\n` +
          `Voorbeeld: "Verlies van partner verhoogt eenzaamheid significant (OR = 2,3) ([Cacioppo & Hawkley, 2010](https://doi.org/10.1111/j.1467-9280.2010.02634.x))"\n` +
          `Gebruik ECHTE bestaande DOI-links. Gebruik MINIMAAL 2 inline citaten per alinea.\n\n` +
          `Schrijf een uitgebreide wetenschappelijke analyse in het Nederlands met precies deze 5 kopjes:\n\n` +
          `## Causale verbanden\nBespreek per factor hoe deze causaal gerelateerd is aan het hoofddoel. Noem voor elke relatie de richting, het mechanisme en de effect size. Gebruik inline citaten na elke claim. Minimaal 200 woorden.\n\n` +
          `## Centrale knooppunten\nAnalyseer welke 3-5 factoren de hoogste betweenness centrality hebben. Gebruik inline citaten. Minimaal 150 woorden.\n\n` +
          `## Prioritaire interventies\nBeschrijf 5-6 interventies gesorteerd op effectgrootte. Per interventie: wat, welke factor, effectgrootte, doelgroep. Gebruik inline citaten. Minimaal 250 woorden.\n\n` +
          `## Risicowaarschuwing\nBespreek 3-4 urgente risicofactoren en cascade-effecten. Gebruik inline citaten. Minimaal 100 woorden.\n\n` +
          `## Wetenschappelijke bronnen\nGeef alle geciteerde bronnen als genummerde lijst. Formatteer ELKE bron EXACT zo (op een eigen regel):\n` +
          `1. [Auteur et al. (jaar). Titel. Tijdschrift, volume(nummer), pagina's.](https://doi.org/xxxxx)\nGebruik dezelfde DOI-links als in de inline citaten hierboven.`
        },
        ...(activeUploadedDocs).map(doc => ({
          type: "document",
          source: { type: "base64", media_type: doc.mediaType, data: doc.base64 },
          title: doc.name
        }))
      ];

      reportText = await callAPI(apiKey,
        [{ role: "user", content: userContent }],
        `Je bent een klinisch-wetenschappelijke expert. Schrijf uitgebreid en grondig in het Nederlands. ` +
        `Gebruik ALTIJD inline citaten na elke feitelijke claim in het formaat ([Auteur, jaar](https://doi.org/xxxxx)). ` +
        `Gebruik echte, bestaande DOI-links \u2014 verzin geen DOIs. ` +
        `Gebruik ## voor hoofdkopjes. Gebruik **vetgedrukt** voor sleuteltermen.`,
        2800
      );
      doneStep();
    } catch (e) {
      doneStep();
      setAnaError("Tekstanalyse mislukt: " + e.message);
      setAnaLoading(false);
      return;
    }

    // CALL 2: Correlation matrix
    addStep("Volledige correlatiematrix berekenen\u2026");
    const allGoalLabels = [centerLabel, ...goalNodes.map(n => n.label)];
    const flatSkeleton = {};
    indexed.forEach(f => {
      flatSkeleton[`F${f.idx}_INF`] = 0.0;
      allGoalLabels.forEach((gl, gi) => {
        flatSkeleton[`F${f.idx}_G${gi}`] = 0.0;
      });
    });

    const goalLegend = allGoalLabels.map((gl, gi) => `G${gi}="${gl}"`).join(", ");
    const factorLegend = indexed.map(f => `F${f.idx}="${f.label}"(${f.type})`).join(", ");

    const jsonUserMsg =
      `Fill in scientific values (0.01-0.99) for: ${problem}\n` +
      `Factors: ${factorLegend}\n` +
      `Goals: ${goalLegend}\n` +
      `F{n}_INF=influence on main goal G0, F{n}_G{m}=Pearson r with goal Gm\n\n` +
      JSON.stringify(flatSkeleton);

    let pw = null;
    try {
      const rawJson = await callAPI(apiKey,
        [{ role: "user", content: jsonUserMsg }],
        "You are a JSON-only assistant. Output ONLY a valid JSON object. No explanation, no markdown, no backticks. Replace every 0.0 with a float between 0.01 and 0.99.",
        1200
      );
      const s = rawJson.indexOf("{"), e = rawJson.lastIndexOf("}");
      if (s !== -1 && e !== -1) pw = JSON.parse(rawJson.slice(s, e + 1));
      doneStep();
    } catch (err) {
      doneStep();
    }

    // Build edges
    addStep("Verbanden toepassen op netwerk\u2026");
    await new Promise(r => setTimeout(r, 150));

    const newEdges = [];
    if (center) {
      indexed.forEach(f => {
        const v = parseFloat(pw?.[`F${f.idx}_G0`]);
        const corr = isNaN(v) ? 0.35 : Math.max(0.05, Math.min(0.99, v));
        newEdges.push({ id: uid(), from: f.id, to: center.id, correlation: corr });
      });
    }

    goalNodes.forEach((goalNode, gi) => {
      indexed.filter(f => f.type !== "goal").forEach(f => {
        const v = parseFloat(pw?.[`F${f.idx}_G${gi + 1}`]);
        if (isNaN(v) || v < 0.25) return;
        newEdges.push({ id: uid(), from: f.id, to: goalNode.id, correlation: Math.min(0.99, v) });
      });
    });

    setEdges(newEdges);

    // Node influence scores
    const infMap = {};
    indexed.forEach(f => {
      const v = parseFloat(pw?.[`F${f.idx}_INF`]);
      if (!isNaN(v)) infMap[f.label] = Math.max(0.05, Math.min(0.99, v));
    });

    if (Object.keys(infMap).length > 0) {
      setInfluence(infMap);
      Object.keys(posRef.current || {}).forEach(id => {
        const node = currentNodes.find(n => n.id === id);
        if (node && node.type !== "maingoal") {
          const angle = Math.random() * 2 * Math.PI;
          const inf = infMap[node.label] ?? 0.5;
          const r = 80 + (1 - inf) * 200;
          if (posRef.current[id]) {
            posRef.current[id].x = 450 + r * Math.cos(angle);
            posRef.current[id].y = 300 + r * Math.sin(angle);
          }
        }
      });
    }

    doneStep();
    addStep("Netwerk bijgewerkt \u2713"); doneStep();
    setReport(reportText);
    setAnalysed(true);

    // Extract sources from report
    const sourceLines = reportText.split("\n").filter(l =>
      /https?:\/\//.test(l) || /^\d+\.\s+\[/.test(l.trim()) || /^\[/.test(l.trim())
    );
    const extracted = sourceLines.map((l, i) => {
      const urlMatch = l.match(/https?:\/\/[^\s)>]+/);
      const labelMatch = l.match(/\[([^\]]+)\]/);
      return {
        id: uid(),
        label: labelMatch?.[1] || l.replace(/https?:\/\/\S+/g, "").replace(/[\[\]\d.]/g, "").trim() || `Bron ${i + 1}`,
        url: urlMatch?.[0]?.replace(/[.,;]+$/, "") || "",
        active: true
      };
    }).filter(s => s.label.length > 2);
    setRefineSources(extracted);

    setTab("graph");
    setAnaLoading(false);
  };

  const resetAll = () => {
    setPhase("problem"); setNodes([]); setEdges([]); setReport(""); setSteps([]);
    setSuggestions({}); setChecked({}); setProblem(""); setInfluence(null); setAnalysed(false);
    setUploadedDocs([]); setSourceMode("both"); setShowRaw(false);
    setScreenshot(null); setReanalyseSources([]); setReanalyseNodes([]); setReanalyseStep(1);
  };

  return (
    <div style={{ height: "100vh", background: "#080d1a", color: "#e2e8f0", fontFamily: "sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>

      <ScreenshotModal screenshot={screenshot} onClose={() => setScreenshot(null)} />

      <Header phase={phase} problem={problem} uploadedDocs={uploadedDocs} analysed={analysed}
        apiKey={apiKey} setApiKey={setApiKey} onReset={resetAll} />

      {phase === "problem" && (
        <ProblemPhase problem={problem} setProblem={setProblem} apiKey={apiKey}
          sugLoading={sugLoading} sugError={sugError} onGenerate={generateSuggestions} />
      )}

      {phase === "suggestions" && (
        <SuggestionPanel suggestions={suggestions} checked={checked}
          onToggle={key => setChecked(p => ({ ...p, [key]: !p[key] }))}
          onSelectAll={() => { const all = {}; Object.entries(suggestions).forEach(([t, items]) => items.forEach(it => { all[t + "::" + it] = true; })); setChecked(all); }}
          onDeselectAll={() => setChecked({})}
          onConfirm={confirmSuggestions} problem={problem} />
      )}

      {phase === "sources" && (
        <SourcesPhase uploadedDocs={uploadedDocs} setUploadedDocs={setUploadedDocs}
          sourceMode={sourceMode} setSourceMode={setSourceMode}
          dragOver={dragOver} setDragOver={setDragOver} handleFileDrop={handleFileDrop}
          onBack={() => setPhase("suggestions")}
          onContinue={() => { setPhase("network"); setTab("graph"); }} />
      )}

      {phase === "reanalyse" && (
        <ReanalysePhase
          reanalyseStep={reanalyseStep} setReanalyseStep={setReanalyseStep}
          reanalyseSources={reanalyseSources} setReanalyseSources={setReanalyseSources}
          reanalyseNodes={reanalyseNodes} setReanalyseNodes={setReanalyseNodes}
          reanalyseNewFactor={reanalyseNewFactor} setReanalyseNewFactor={setReanalyseNewFactor}
          reanalyseNewType={reanalyseNewType} setReanalyseNewType={setReanalyseNewType}
          reanalyseNewSource={reanalyseNewSource} setReanalyseNewSource={setReanalyseNewSource}
          sourceMode={sourceMode} setSourceMode={setSourceMode}
          uploadedDocs={uploadedDocs} setUploadedDocs={setUploadedDocs}
          onExecute={() => {
            const activeNodes = reanalyseNodes.filter(n => n.active);
            if (activeNodes.length < 2) return;
            const freshNodes = activeNodes.map(({ active, ...n }) => n);
            setNodes(freshNodes);
            setEdges([]);
            setReport("");
            setAnalysed(false);
            setInfluence(null);
            setPhase("network");
            setTab("analysis");
            setTimeout(() => analyze(freshNodes), 50);
          }} />
      )}

      {phase === "network" && (
        <NetworkPhase
          nodes={nodes} edges={edges} positions={positions}
          selected={selected} setSelected={setSelected}
          influence={influence} analysed={analysed}
          newLabel={newLabel} setNewLabel={setNewLabel}
          newType={newType} setNewType={setNewType}
          addNode={addNode} removeNode={removeNode}
          tab={tab} setTab={setTab}
          steps={steps} anaLoading={anaLoading} anaError={anaError}
          report={report} showRaw={showRaw} setShowRaw={setShowRaw}
          problem={problem} onAnalyze={analyze}
          onReanalyse={() => {
            setReanalyseSources(extractSourcesFromReport(report, uploadedDocs));
            setReanalyseNodes(nodes.map(n => ({ ...n, active: true })));
            setReanalyseStep(1);
            setPhase("reanalyse");
          }}
          screenshotting={screenshotting} takeScreenshot={takeScreenshot}
          fullPanelRef={fullPanelRef} networkPanelRef={networkPanelRef} analysisPanelRef={analysisPanelRef} />
      )}
    </div>
  );
}
