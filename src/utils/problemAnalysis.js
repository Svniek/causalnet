import { callAPI } from "../api";
import { uid } from "../constants";
import { searchPapersForFactors, formatPapersForPrompt } from "./semanticScholar";
import { verifyDoiLinks } from "./verifyDoi";

export const runProblemAnalysis = async ({ factor, problem, apiKey, onStep, onStepDone, onStepUpdate, extraSources = [], requiredNodes = [], sourceMode = "both" }) => {
  // Step 1: Search Semantic Scholar for papers (skip if sourceMode === "own")
  onStep("Relevante papers zoeken voor factor: " + factor.label + "…");
  let papers = [];
  if (sourceMode !== "own") {
    try {
      papers = await searchPapersForFactors([factor], problem, (msg) => onStepUpdate(msg));
    } catch (e) {
      console.warn("Semantic Scholar zoeken mislukt:", e);
    }
  }
  onStepDone();

  if (papers.length > 0) {
    onStep(`${papers.length} geverifieerde papers gevonden`);
    onStepDone();
  }

  // Step 2: Call 1 — report
  onStep("Onderliggende oorzaken en problemen analyseren…");
  const papersPrompt = formatPapersForPrompt(papers);

  const extraSourcesPrompt = extraSources.length > 0
    ? `\n\n## Door gebruiker geselecteerde bronnen (verplicht opnemen):\n` +
      extraSources.map((s, i) => `${i + 1}. ${s.text}${s.url ? " — " + s.url : ""}`).join("\n")
    : "";

  const requiredNodesPrompt = requiredNodes.length > 0
    ? `\n\n## Verplicht te bespreken oorzaken (neem deze zeker op):\n` +
      requiredNodes.map(n => `- ${n.label} (type: ${n.type})`).join("\n")
    : "";

  const reportPrompt =
    `Probleemstelling: ${problem}\n\n` +
    `Factor: "${factor.label}" (type: ${factor.type})\n` +
    papersPrompt + extraSourcesPrompt + requiredNodesPrompt + `\n\n` +
    `CITATIEINSTRUCTIE — VOLG DIT EXACT:\n` +
    `Na elke feitelijke claim of statistiek plaatst u een inline citaat tussen haakjes in dit exacte formaat:\n` +
    `([Auteur et al., jaar](https://doi.org/xxxxx))\n\n` +
    `Schrijf een wetenschappelijke analyse in het Nederlands met precies deze 4 kopjes:\n\n` +
    `## Oorzaken en mechanismen\n` +
    `Beschrijf 5-7 specifieke, wetenschappelijk onderbouwde oorzaken en onderliggende mechanismen die bijdragen aan "${factor.label}". ` +
    `Per oorzaak: wat is de oorzaak, hoe werkt het mechanisme, wat is de relatieve bijdrage, voor welke groepen is dit relevant. ` +
    `Gebruik inline citaten na elke claim. Minimaal 300 woorden.\n\n` +
    `## Risicogroepen en kwetsbare populaties\n` +
    `Welke groepen zijn het meest kwetsbaar of hebben het hoogste risico in relatie tot "${factor.label}"? ` +
    `Bespreek demografische, sociale en contextuele risicofactoren. Minimaal 150 woorden.\n\n` +
    `## Synergie tussen oorzaken\n` +
    `Welke oorzaken versterken elkaar (cumulatieve risicofactoren)? Welke vicieuze cirkels bestaan er? Minimaal 100 woorden.\n\n` +
    `## Wetenschappelijke bronnen\n` +
    `Geef alle geciteerde bronnen als genummerde lijst. Formatteer ELKE bron EXACT zo (op een eigen regel):\n` +
    `1. [Auteur et al. (jaar). Titel. Tijdschrift, volume(nummer), pagina's.](https://doi.org/xxxxx)`;

  let report = "";
  try {
    report = await callAPI(
      apiKey,
      [{ role: "user", content: reportPrompt }],
      `Je bent een wetenschappelijk expert. Schrijf uitgebreid en grondig in het Nederlands. ` +
      `Gebruik ALTIJD inline citaten na elke feitelijke claim in het formaat ([Auteur, jaar](https://doi.org/xxxxx)). ` +
      `Gebruik echte, bestaande DOI-links — verzin geen DOIs. ` +
      `Gebruik ## voor hoofdkopjes. Gebruik **vetgedrukt** voor sleuteltermen.`,
      2000
    );
    onStepDone();
  } catch (e) {
    onStepDone();
    throw new Error("Rapportgeneratie mislukt: " + e.message);
  }

  // Step 3: Call 2 — JSON nodes + correlations
  onStep("Probleemnetwerk genereren…");
  const requiredJsonHint = requiredNodes.length > 0
    ? `\nNeem deze verplichte oorzaken op (gebruik exact dezelfde labels): ${requiredNodes.map(n => `"${n.label}" (${n.type})`).join(", ")}.\n`
    : "";
  const jsonPrompt =
    `Probleemstelling: ${problem}\n` +
    `Factor: "${factor.label}" (type: ${factor.type})\n` +
    requiredJsonHint + `\n` +
    `Geef 5-7 onderliggende oorzaken/problemen die bijdragen aan deze factor als JSON. Gebruik EXACT dit formaat:\n` +
    `{"problems":[{"id":"p0","label":"max 5 woorden","type":"onderliggend|versterkend|trigger|structureel","influence":0.75},...],` +
    `"correlations":[{"from":"p0","to":"p1","correlation":0.6},...]}` +
    `\n\nRegels:\n- label: max 5 woorden, Nederlands\n` +
    `- type: ALLEEN onderliggend (root cause), versterkend (amplifies the problem), trigger (acute triggering event/state), of structureel (structural/systemic cause)\n` +
    `- influence: 0.0-1.0 (hoe sterk draagt deze oorzaak bij aan de factor)\n` +
    `- correlations: correlaties TUSSEN oorzaken (niet verplicht, max 8)`;

  let nodes = [];
  let edges = [];
  let influence = {};

  try {
    const rawJson = await callAPI(
      apiKey,
      [{ role: "user", content: jsonPrompt }],
      "You are a JSON-only assistant. Output ONLY valid JSON. No explanation, no markdown, no backticks.",
      800
    );
    onStepDone();

    const s = rawJson.indexOf("{");
    const e = rawJson.lastIndexOf("}");
    if (s !== -1 && e !== -1) {
      const parsed = JSON.parse(rawJson.slice(s, e + 1));
      const idMap = {};
      const validTypes = ["onderliggend", "versterkend", "trigger", "structureel"];

      (parsed.problems || []).forEach(prob => {
        const newId = uid();
        idMap[prob.id] = newId;
        const probType = validTypes.includes(prob.type) ? prob.type : "onderliggend";
        nodes.push({ id: newId, label: prob.label, type: probType });
        influence[prob.label] = Math.max(0.1, Math.min(0.99, prob.influence || 0.5));
      });

      (parsed.correlations || []).forEach(corr => {
        const fromId = idMap[corr.from];
        const toId = idMap[corr.to];
        if (fromId && toId) {
          edges.push({
            id: uid(),
            from: fromId,
            to: toId,
            correlation: Math.max(0.05, Math.min(0.99, corr.correlation || 0.4))
          });
        }
      });
    }
  } catch (e) {
    onStepDone();
    console.warn("JSON parse mislukt, fallback nodes aanmaken:", e);
    const fallbackLabels = [
      { label: "Sociale isolatie", type: "onderliggend", influence: 0.8 },
      { label: "Versterkende omgeving", type: "versterkend", influence: 0.65 },
      { label: "Acute trigger", type: "trigger", influence: 0.7 },
      { label: "Structurele context", type: "structureel", influence: 0.55 },
    ];
    fallbackLabels.forEach(f => {
      const id = uid();
      nodes.push({ id, label: f.label, type: f.type });
      influence[f.label] = f.influence;
    });
  }

  // Step 4: Verify DOIs
  onStep("DOI-links verifiëren…");
  try {
    report = await verifyDoiLinks(report, (msg) => onStepUpdate(msg));
  } catch (e) {
    console.warn("DOI verificatie mislukt:", e);
  }
  onStepDone();

  return { nodes, edges, influence, report };
};
