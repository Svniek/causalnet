import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.post("/api/messages", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: "ANTHROPIC_API_KEY niet ingesteld. Maak een .env bestand aan met ANTHROPIC_API_KEY=sk-ant-..." } });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: "Proxy fout: " + err.message } });
  }
});

const extractDoi = (url) => {
  for (const p of [/doi\.org\/(.+)/, /dx\.doi\.org\/(.+)/, /doi=([^&]+)/]) {
    const m = url.match(p);
    if (m) return decodeURIComponent(m[1]).replace(/[)\]]+$/, "");
  }
  return null;
};

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

app.get("/api/fetch-url", async (req, res) => {
  const url = req.query.url;
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: "Ongeldige URL" });
  }

  // DOI: use Semantic Scholar first
  const doi = extractDoi(url);
  if (doi) {
    try {
      const ssResp = await fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=title,abstract,authors,year,venue,citationCount`, { headers: { "User-Agent": "CausalNet/1.0" } });
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
    } catch (_) {}

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
        ].filter(Boolean).join("\n");
        if (text.length > 30) return res.json({ text, url, source: "unpaywall" });
      }
    } catch (_) {}
  }

  // General URL
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
      return res.status(403).json({ error: "Deze website staat automatisch ophalen niet toe (403). Probeer een DOI-link of sla de tekst op als PDF." });
    }
    if (!response.ok) return res.status(502).json({ error: `Server antwoordde met ${response.status}` });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return res.status(415).json({ error: "Alleen HTML- en tekstpagina's worden ondersteund (geen PDF via URL — gebruik het uploadvak)" });
    }
    const html = await response.text();
    const text = htmlToText(html);
    if (!text || text.length < 50) return res.status(422).json({ error: "Pagina bevat te weinig leesbare tekst" });
    res.json({ text, url });
  } catch (err) {
    res.status(502).json({ error: "Ophalen mislukt: " + err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CausalNet proxy draait op http://localhost:${PORT}`);
  console.log(`API key: ${process.env.ANTHROPIC_API_KEY ? "✓ ingesteld" : "✗ ONTBREEKT — maak .env aan"}`);
});
