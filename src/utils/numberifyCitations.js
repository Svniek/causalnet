/**
 * numberifyCitations(text)
 *
 * Strategie:
 *  1. Body-citaten worden genummerd op volgorde van eerste verschijnen (1, 2, 3, ...).
 *  2. De AI-bronnenlijst wordt geparseerd; voor elk body-nummer wordt de beste
 *     match gezocht (URL → auteur+jaar → auteur).
 *  3. Een nieuwe bronnenlijst wordt opgebouwd: [1] ... [2] ... [N] ...
 *     Bronnen zonder body-citatie worden ná genummerd.
 *  4. Body-citaten worden vervangen door ([n](url)).
 *
 * Hierdoor:
 *  - Begint de bronnenlijst altijd bij 1.
 *  - Heeft elk in-text nummer een corresponderende bron.
 *  - Worden ontbrekende bronnen aangevuld met de inline-label als fallback.
 */

const CIT_RE = /\(\[([^\]]+)\]\((https?:\/\/[^)]+?)\)\)|\[([^\]]+)\]\((https?:\/\/[^)]+?)\)/g;

const cleanUrl = (u) => (u || "").replace(/[.,;:!?]+$/, "").trim();

// Haal markdown- en bare-URLs uit een regel
const extractUrls = (line) => {
  const urls = [];
  const re = new RegExp(CIT_RE.source, "g");
  let m;
  while ((m = re.exec(line)) !== null) {
    const u = cleanUrl(m[2] || m[4]);
    if (u && !urls.includes(u)) urls.push(u);
  }
  const bare = line.match(/https?:\/\/[^\s)>\]]+/g) || [];
  bare.forEach((b) => {
    const u = cleanUrl(b);
    if (u && !urls.includes(u)) urls.push(u);
  });
  return urls;
};

// "Luo et al., 2012" / "Luo & Smith, 2012" / "Luo, 2012"
const parseInlineLabel = (label) => {
  if (!label) return {};
  const m = label.match(/^([A-Z][a-zA-Z\u00C0-\u017F'\-]+)[^,]*?,\s*(\d{4})/);
  if (!m) return {};
  return { surname: m[1].toLowerCase(), year: m[2] };
};

// "Luo, Y., Hawkley, L. C., ... (2012). Title..."
const parseSourceText = (text) => {
  if (!text) return {};
  const sm = text.match(/^([A-Z][a-zA-Z\u00C0-\u017F'\-]+)/);
  const ym = text.match(/\((\d{4})\)/) || text.match(/\b(19|20)\d{2}\b/);
  return {
    surname: sm ? sm[1].toLowerCase() : null,
    year:    ym ? (ym[1].length === 4 ? ym[1] : ym[0]) : null,
  };
};

export const numberifyCitations = (rawText) => {
  if (!rawText) return { text: rawText, citations: [] };

  // ── Split body en bronnensectie ────────────────────────────────────────────
  const srcHeadRe = /\n## [^\n]*(bron|referentie|source|literature)[^\n]*/i;
  const srcMatch  = srcHeadRe.exec(rawText);
  const splitIdx  = srcMatch ? srcMatch.index : rawText.length;
  const bodyText  = rawText.slice(0, splitIdx);
  const srcSection = rawText.slice(splitIdx);

  // ── Stap 1: nummer body-citaten op volgorde van verschijnen ────────────────
  const urlToNr = new Map();
  const nrToCit = []; // [{nr, label, url, surname, year}]

  const re1 = new RegExp(CIT_RE.source, "g");
  let m;
  while ((m = re1.exec(bodyText)) !== null) {
    const url   = cleanUrl(m[2] || m[4]);
    const label = m[1] || m[3] || "";
    if (!urlToNr.has(url)) {
      const nr = nrToCit.length + 1;
      urlToNr.set(url, nr);
      const { surname, year } = parseInlineLabel(label);
      nrToCit.push({ nr, label, url, surname, year });
    }
  }

  // ── Stap 2: vervang body-citaten door ([n](url)) ───────────────────────────
  const numberedBody = bodyText.replace(new RegExp(CIT_RE.source, "g"), (_, l1, u1, l2, u2) => {
    const url = cleanUrl(u1 || u2);
    const nr  = urlToNr.get(url) ?? "?";
    return `([${nr}](${url}))`;
  });

  // ── Stap 3: parse AI-bronnenlijst ──────────────────────────────────────────
  const srcLines = srcSection.split("\n");
  let headerLine = "";
  let headerSeen = false;
  const aiSources = []; // [{text, urls, surname, year, used}]

  srcLines.forEach((line) => {
    const trimmed = line.trim();
    if (!headerSeen) {
      if (trimmed.startsWith("##")) {
        headerLine = line;
        headerSeen = true;
      }
      return;
    }
    if (!trimmed) return;
    if (trimmed.startsWith("#")) return; // sub-header

    // Verwijder bestaande lijst-prefix ("1. ", "- ", "* ")
    const stripped = trimmed.replace(/^(\d+\.|-|\*)\s+/, "");
    const urls = extractUrls(stripped);
    const { surname, year } = parseSourceText(stripped);
    aiSources.push({ text: stripped, urls, surname, year, used: false });
  });

  // ── Stap 4: bouw nieuwe bronnenlijst gematcht aan body-nummers ────────────
  const findMatch = (cit) => {
    // 1. Exacte URL match
    let idx = aiSources.findIndex((s) => !s.used && s.urls.includes(cit.url));
    if (idx !== -1) return idx;
    // 2. Auteur + jaar
    if (cit.surname && cit.year) {
      idx = aiSources.findIndex((s) => !s.used && s.surname === cit.surname && s.year === cit.year);
      if (idx !== -1) return idx;
    }
    // 3. Alleen auteur
    if (cit.surname) {
      idx = aiSources.findIndex((s) => !s.used && s.surname === cit.surname);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const hasAnySources = nrToCit.length > 0 || aiSources.length > 0;
  const newSrcLines = [];
  if (hasAnySources) {
    // Zorg dat er ALTIJD een lege regel + header is, ook als de AI er geen leverde
    newSrcLines.push("", "");
    newSrcLines.push(headerLine || "## Wetenschappelijke bronnen");
    newSrcLines.push("");
  }

  nrToCit.forEach((cit) => {
    const idx = findMatch(cit);
    if (idx !== -1) {
      aiSources[idx].used = true;
      newSrcLines.push(`[${cit.nr}] ${aiSources[idx].text}`);
    } else {
      // Fallback: gebruik de inline-label (klikbaar als URL bekend is)
      const labelText = cit.label || "Bron";
      if (cit.url) {
        newSrcLines.push(`[${cit.nr}] [${labelText}](${cit.url})`);
      } else {
        newSrcLines.push(`[${cit.nr}] ${labelText}`);
      }
    }
  });

  // Niet-gebruikte AI-bronnen alsnog toevoegen (extra refs niet in body geciteerd)
  aiSources.filter((s) => !s.used).forEach((s) => {
    const nr = nrToCit.length + 1;
    nrToCit.push({
      nr,
      label:   "",
      url:     s.urls[0] || "",
      surname: s.surname,
      year:    s.year,
    });
    newSrcLines.push(`[${nr}] ${s.text}`);
  });

  return {
    text:      numberedBody + newSrcLines.join("\n"),
    citations: nrToCit.map(({ nr, label, url }) => ({ nr, label, url })),
  };
};
