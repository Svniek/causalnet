// Extract DOI from common URL patterns
const extractDoi = (url) => {
  const patterns = [
    /doi\.org\/(.+)/,
    /dx\.doi\.org\/(.+)/,
    /doi=([^&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return decodeURIComponent(m[1]).replace(/[)\]]+$/, "");
  }
  return null;
};

// Strip HTML to plain text
const htmlToText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ")
    .replace(/\s{3,}/g, "\n\n")
    .trim()
    .slice(0, 40000);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.query.url;
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: "Ongeldige URL" });
  }

  // For DOI URLs: use Semantic Scholar API (no access restrictions)
  const doi = extractDoi(url);
  if (doi) {
    try {
      const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=title,abstract,authors,year,venue,citationCount,externalIds`;
      const ssResp = await fetch(ssUrl, { headers: { "User-Agent": "CausalNet/1.0" } });
      if (ssResp.ok) {
        const data = await ssResp.json();
        if (data.abstract || data.title) {
          const authorStr = (data.authors || []).map(a => a.name).join(", ");
          const text = [
            data.title && `Titel: ${data.title}`,
            authorStr && `Auteurs: ${authorStr}`,
            data.year && `Jaar: ${data.year}`,
            data.venue && `Tijdschrift: ${data.venue}`,
            data.citationCount != null && `Citaties: ${data.citationCount}`,
            `DOI: ${doi}`,
            data.abstract && `\nAbstract:\n${data.abstract}`,
          ].filter(Boolean).join("\n");
          return res.json({ text, url, source: "semanticscholar" });
        }
      }
    } catch (_) { /* fall through to direct fetch */ }

    // Fallback: try Unpaywall for open-access PDF text
    try {
      const upResp = await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=causalnet@example.com`);
      if (upResp.ok) {
        const up = await upResp.json();
        const text = [
          up.title && `Titel: ${up.title}`,
          up.z_authors?.length && `Auteurs: ${up.z_authors.map(a => a.family).join(", ")}`,
          up.published_date && `Gepubliceerd: ${up.published_date}`,
          up.journal_name && `Tijdschrift: ${up.journal_name}`,
          `DOI: ${doi}`,
          up.is_oa && "Open Access: ja",
        ].filter(Boolean).join("\n");
        if (text.length > 30) return res.json({ text, url, source: "unpaywall" });
      }
    } catch (_) { /* fall through */ }
  }

  // General URL: fetch with browser-like headers
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl,en;q=0.9",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });

    if (response.status === 403 || response.status === 401) {
      return res.status(403).json({
        error: "Deze website staat automatisch ophalen niet toe (403). Probeer de tekst handmatig te kopiëren en als PDF op te slaan, of gebruik een DOI-link."
      });
    }
    if (!response.ok) {
      return res.status(502).json({ error: `Server antwoordde met ${response.status}` });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return res.status(415).json({ error: "Alleen HTML- en tekstpagina's worden ondersteund (geen PDF via URL — gebruik het uploadvak)" });
    }

    const html = await response.text();
    const text = htmlToText(html);
    if (!text || text.length < 50) {
      return res.status(422).json({ error: "Pagina bevat te weinig leesbare tekst" });
    }
    res.json({ text, url });
  } catch (err) {
    res.status(502).json({ error: "Ophalen mislukt: " + err.message });
  }
}
