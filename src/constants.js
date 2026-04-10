export const TYPES = {
  maingoal:   { label: "Hoofddoel",           color: "#f59e0b" },
  goal:       { label: "Doel",                color: "#34d399" },
  risk:       { label: "Risicofactor",        color: "#f87171" },
  protective: { label: "Beschermende factor", color: "#60a5fa" },
  amplifying: { label: "Versterkende factor", color: "#a78bfa" },
};

export const uid = () => Math.random().toString(36).slice(2, 8);

export const nodeRadius = (n, influence) => {
  if (n.type === "maingoal") return 24;
  const score = influence?.[n.label] ?? 0.4;
  return 8 + score * 16;
};

export const edgeWidth = (corr) => 1 + (corr ?? 0.3) * 8;

export const targetDist = (influence, label, W = 900, H = 600) => {
  const score = Math.max(0.05, influence?.[label] ?? 0.5);
  const base = Math.min(W, H) * 0.28;
  return Math.min(Math.min(W, H) * 0.52, Math.max(base, base / score));
};
