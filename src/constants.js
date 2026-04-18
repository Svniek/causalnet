export const SOLUTION_TYPES = {
  interventie: { label: "Interventie",        color: "#10b981" },
  beleid:      { label: "Beleidsmaatregel",   color: "#8b5cf6" },
  omgeving:    { label: "Omgevingsfactor",    color: "#f97316" },
  gedrag:      { label: "Gedragsverandering", color: "#06b6d4" },
};

export const TYPES = {
  maingoal:   { label: "Hoofddoel",           color: "#f59e0b" },
  goal:       { label: "Doel",                color: "#34d399" },
  risk:       { label: "Risicofactor",        color: "#f87171" },
  protective: { label: "Beschermende factor", color: "#60a5fa" },
  amplifying: { label: "Versterkende factor", color: "#a78bfa" },
};

export const uid = () => Math.random().toString(36).slice(2, 8);

export const nodeRadius = (n, influence) => {
  if (n.type === "maingoal") return 26;
  const score = influence?.[n.label] ?? 0.4;
  // 50%→14, 70%→20, 85%→28, 95%→34 — clear visual difference
  return 6 + score * 30;
};

export const edgeWidth = (corr) => 1 + (corr ?? 0.3) * 8;

export const targetDist = (influence, label, W = 900, H = 600) => {
  const score = Math.max(0.05, influence?.[label] ?? 0.5);
  // Quadratic curve: 95%→40px, 80%→150px, 50%→400px, 5%→600px
  const t = 1 - score;
  return Math.max(40, -520 * t * t + 1200 * t - 60);
};
