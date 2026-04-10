export const apiUrl = (apiKey) => {
  if (apiKey.trim()) return "https://api.anthropic.com/v1/messages";
  const isLocal = window.location.hostname === "localhost";
  return isLocal ? "http://localhost:3001/api/messages" : "/api/messages";
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

export const callAPI = async (apiKey, messages, system, maxTokens) => {
  const body = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages };
  if (system) body.system = system;

  let res;
  try {
    res = await fetch(apiUrl(apiKey), {
      method: "POST",
      headers: apiHeaders(apiKey),
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (!apiKey.trim()) {
      throw new Error("Geen API sleutel ingevuld. Klik op 🔑 rechtsboven en voer je Anthropic API sleutel in.");
    }
    throw new Error("Netwerkfout: " + e.message + ". Controleer je internetverbinding.");
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error("Ongeldig antwoord van server (status " + res.status + "). Controleer je API sleutel.");
  }

  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const text = data?.content?.[0]?.text || "";
  if (!text) throw new Error("Leeg antwoord ontvangen. Probeer opnieuw.");
  return text;
};
