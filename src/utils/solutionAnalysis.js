import { callAPI } from "../api";
import { uid } from "../constants";
import { searchPapersForFactors, formatPapersForPrompt } from "./semanticScholar";
import { verifyDoiLinks } from "./verifyDoi";

export const runSolutionAnalysis = async ({ factor, problem, apiKey, onStep, onStepDone, onStepUpdate }) => {
  // Step 1: Search Semantic Scholar for papers
  onStep("Relevante papers zoeken voor factor: " + factor.label + "…");
  let papers = [];
  try {
    papers = await searchPapersForFactors([factor], problem, (msg) => onStepUpdate(msg));
  } catch (e) {
    console.warn("Semantic Scholar zoeken mislukt:", e);
  }
  onStepDone();

  if (papers.length > 0) {
    onStep(`${papers.length} geverifieerde papers gevonden`);
    onStepDone();
  }

  // Step 2: Call 1 — report
  onStep("Wetenschappelijke oplossingen analyseren…");
  const papersPrompt = formatPapersForPrompt(papers);
  const reportPrompt =
    `Probleemstelling: ${problem}\n\n` +
    `Factor: "${factor.label}" (type: ${factor.type})\n` +
    papersPrompt + `\n\n` +
    `CITATIEINSTRUCTIE — VOLG DIT EXACT:\n` +
    `Na elke feitelijke claim of statistiek plaatst u een inline citaat tussen haakjes in dit exacte formaat:\n` +
    `([Auteur et al., jaar](https://doi.org/xxxxx))\n\n` +
    `Schrijf een wetenschappelijke analyse in het Nederlands met precies deze 4 kopjes:\n\n` +
    `## Bewezen interventies\n` +
    `Beschrijf 5-7 specifieke, bewezen interventies om de factor "${factor.label}" te verbeteren of aan te pakken. ` +
    `Per interventie: wat is de interventie, wat is het mechanisme, wat is de effectgrootte, voor welke doelgroep. ` +
    `Gebruik inline citaten na elke claim. Minimaal 300 woorden.\n\n` +
    `## Implementatieoverwegingen\n` +
    `Bespreek praktische overwegingen bij het implementeren van deze interventies: kosten, haalbaarheid, vereiste expertise, tijdsduur. Minimaal 150 woorden.\n\n` +
    `## Synergie tussen interventies\n` +
    `Welke combinaties van interventies versterken elkaar? Welke volgorde is optimaal? Minimaal 100 woorden.\n\n` +
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
  onStep("Oplossingsnetwerk genereren…");
  const jsonPrompt =
    `Probleemstelling: ${problem}\n` +
    `Factor: "${factor.label}" (type: ${factor.type})\n\n` +
    `Geef 5-7 concrete oplossingen/interventies voor deze factor als JSON. Gebruik EXACT dit formaat:\n` +
    `{"solutions":[{"id":"s0","label":"max 5 woorden","type":"interventie|beleid|omgeving|gedrag","influence":0.75},...],` +
    `"correlations":[{"from":"s0","to":"s1","correlation":0.6},...]}` +
    `\n\nRegels:\n- label: max 5 woorden, Nederlands\n- type: ALLEEN interventie, beleid, omgeving, of gedrag\n` +
    `- influence: 0.0-1.0 (hoe sterk is de impact op de factor)\n` +
    `- correlations: correlaties TUSSEN oplossingen (niet verplicht, max 8)`;

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

      // Map temp IDs to real UIDs
      (parsed.solutions || []).forEach(sol => {
        const newId = uid();
        idMap[sol.id] = newId;
        const solType = ["interventie", "beleid", "omgeving", "gedrag"].includes(sol.type)
          ? sol.type : "interventie";
        nodes.push({ id: newId, label: sol.label, type: solType });
        influence[sol.label] = Math.max(0.1, Math.min(0.99, sol.influence || 0.5));
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
    // Fallback: 4 generic nodes
    const fallbackLabels = [
      { label: "Vroege interventie", type: "interventie", influence: 0.8 },
      { label: "Beleidsondersteuning", type: "beleid", influence: 0.65 },
      { label: "Omgevingsaanpassing", type: "omgeving", influence: 0.55 },
      { label: "Gedragsverandering", type: "gedrag", influence: 0.7 },
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
