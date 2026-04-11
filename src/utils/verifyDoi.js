// Verify DOIs via CrossRef API and replace invalid ones with Google Scholar links

const checkDoi = async (doi) => {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
};

const scholarUrl = (text) => {
  const clean = text.replace(/[[\]()]/g, "").trim();
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(clean)}`;
};

// Process up to N DOIs concurrently
const batchCheck = async (dois, concurrency = 5) => {
  const results = new Map();
  const queue = [...dois];

  const worker = async () => {
    while (queue.length > 0) {
      const doi = queue.shift();
      if (!doi || results.has(doi)) continue;
      results.set(doi, await checkDoi(doi));
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, dois.length) }, worker));
  return results;
};

export const verifyDoiLinks = async (reportText, onProgress) => {
  // Extract all DOI URLs from the report
  const doiRegex = /https?:\/\/doi\.org\/[^\s)\]>"]+/g;
  const allDois = [...new Set((reportText.match(doiRegex) || []).map(d => d.replace(/[.,;:!?]+$/, "")))];

  if (allDois.length === 0) return reportText;

  onProgress?.(`${allDois.length} DOI-links verifi\u00ebren\u2026`);

  // Check all DOIs
  const results = await batchCheck(allDois);

  const valid = [...results.entries()].filter(([, ok]) => ok).length;
  const invalid = [...results.entries()].filter(([, ok]) => !ok).length;
  onProgress?.(`${valid} geldig, ${invalid} ongeldig \u2014 vervangen\u2026`);

  // Replace invalid DOIs with Google Scholar links
  let fixed = reportText;
  for (const [doi, isValid] of results) {
    if (isValid) continue;

    // Find the context around this DOI to build a Scholar search
    // Pattern: ([Author et al., year](DOI)) or [Title](DOI)
    const patterns = [
      // Inline citation: ([label](doi))
      new RegExp(`\\(\\[([^\\]]+)\\]\\(${escapeRegex(doi)}\\)\\)`, "g"),
      // Regular link: [label](doi)
      new RegExp(`\\[([^\\]]+)\\]\\(${escapeRegex(doi)}\\)`, "g"),
    ];

    for (const pattern of patterns) {
      fixed = fixed.replace(pattern, (match, label) => {
        const scholar = scholarUrl(label);
        if (match.startsWith("(")) {
          return `([${label}](${scholar}))`;
        }
        return `[${label}](${scholar})`;
      });
    }

    // Bare DOI URLs not in markdown links
    fixed = fixed.replace(new RegExp(escapeRegex(doi), "g"), scholarUrl(doi.replace("https://doi.org/", "")));
  }

  return fixed;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
