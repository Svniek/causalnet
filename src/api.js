export const apiUrl = (apiKey) => {
  if (apiKey.trim()) return "https://api.anthropic.com/v1/messages";
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isLocal ? `http://${window.location.hostname}:3001/api/messages` : "/api/messages";
};

export const apiHeaders = (apiKey) => {
  const h = { "Content-Type": "application/json" };
  if (apiKey.trim()) {
    h["x-api-key"] = apiKey.trim();
    h["anthropic-version"] = "2023-06-01";
    h["anthropic-dangerous-allow-browser"] = "true";
  }
  return h;
};

const MODELS = [
  "claude-sonnet-4-20250514",
  "claude-haiku-4-5-20251001",
];

export const callAPI = async (apiKey, messages, system, maxTokens) => {
  let lastError;

  for (const model of MODELS) {
    const body = { model, max_tokens: maxTokens, messages };
    if (system) body.system = system;

    let res;
    try {
      res = await fetch(apiUrl(apiKey), {
        method: "POST",
        headers: apiHeaders(apiKey),
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error("Netwerkfout: " + e.message + ". Controleer je internetverbinding.");
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error("Ongeldig antwoord van server (status " + res.status + "). Controleer je API sleutel.");
    }

    if (data.error) {
      const msg = data.error.message || JSON.stringify(data.error);
      if (/overloaded|529|capacity/i.test(msg) && model !== MODELS[MODELS.length - 1]) {
        console.warn(`Model ${model} overbelast, probeer ${MODELS[MODELS.indexOf(model) + 1]}...`);
        lastError = msg;
        continue;
      }
      throw new Error(msg);
    }

    const text = data?.content?.[0]?.text || "";
    if (!text) throw new Error("Leeg antwoord ontvangen. Probeer opnieuw.");
    return text;
  }

  throw new Error("Alle modellen overbelast: " + lastError);
};
