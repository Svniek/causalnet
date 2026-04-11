export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

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
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ")
      .replace(/\s{3,}/g, "\n\n")
      .trim()
      .slice(0, 40000);
    if (!text || text.length < 50) return res.status(422).json({ error: "Pagina bevat te weinig leesbare tekst" });
    res.json({ text, url });
  } catch (err) {
    res.status(502).json({ error: "Ophalen mislukt: " + err.message });
  }
}
