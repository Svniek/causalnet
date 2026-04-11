import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

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

app.get("/api/fetch-url", async (req, res) => {
  const url = req.query.url;
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: "Ongeldige URL" });
  }
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CausalNet/1.0)" },
      redirect: "follow",
    });
    if (!response.ok) return res.status(502).json({ error: `Server antwoordde met ${response.status}` });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return res.status(415).json({ error: "Alleen HTML- en tekstpagina's worden ondersteund" });
    }
    const html = await response.text();
    // Strip HTML tags to plain text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ")
      .replace(/\s{3,}/g, "\n\n")
      .trim()
      .slice(0, 40000); // Max 10K tokens
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
