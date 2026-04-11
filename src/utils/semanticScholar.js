const API_BASE = "https://api.semanticscholar.org/graph/v1";
const FIELDS = "title,abstract,doi,citationCount,publicationDate,authors";

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const searchPapers = async (query, limit = 3) => {
  const url = `${API_BASE}/paper/search/bulk?query=${encodeURIComponent(query)}&fields=${FIELDS}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || [])
    .filter(p => p.doi && p.abstract)
    .map(p => ({
      title: p.title,
      abstract: p.abstract,
      doi: p.doi,
      citationCount: p.citationCount || 0,
      year: p.publicationDate?.slice(0, 4) || "",
      authors: (p.authors || []).map(a => a.name).slice(0, 3).join(", "),
    }));
};

export const searchPapersForFactors = async (nodes, problem, onProgress) => {
  const factors = nodes.filter(n => n.type !== "maingoal");
  const allPapers = [];
  const seenDois = new Set();

  for (let i = 0; i < factors.length; i++) {
    const factor = factors[i];
    onProgress?.(`Papers zoeken: ${factor.label} (${i + 1}/${factors.length})\u2026`);

    // Search with factor + problem context for better results
    const query = `${factor.label} ${problem}`;
    try {
      const papers = await searchPapers(query, 3);
      for (const p of papers) {
        if (!seenDois.has(p.doi)) {
          seenDois.add(p.doi);
          allPapers.push({ ...p, factor: factor.label });
        }
      }
    } catch {}

    // Rate limit: max 1 req/sec to be safe
    if (i < factors.length - 1) await delay(200);
  }

  // Sort by citation count (most cited first)
  allPapers.sort((a, b) => b.citationCount - a.citationCount);

  return allPapers;
};

export const formatPapersForPrompt = (papers) => {
  if (!papers.length) return "";

  const lines = papers.slice(0, 20).map((p, i) => {
    const authorShort = p.authors.split(", ")[0] + (p.authors.includes(",") ? " et al." : "");
    return `${i + 1}. ${p.title} (${authorShort}, ${p.year}) \u2014 DOI: https://doi.org/${p.doi} \u2014 ${p.citationCount}x geciteerd\n   Abstract: ${p.abstract.slice(0, 300)}${p.abstract.length > 300 ? "\u2026" : ""}`;
  });

  return `\n\n## Geverifieerde wetenschappelijke bronnen (gebruik deze bij voorkeur):\nDe volgende bronnen zijn opgehaald uit Semantic Scholar en hebben geverifieerde DOI-links. Gebruik bij voorkeur deze bronnen en hun exacte DOI-links in je citaten.\n\n${lines.join("\n\n")}`;
};
