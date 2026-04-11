export const TYPES = {
  maingoal:   { label: "Hoofddoel",           color: "#f59e0b" },
  goal:       { label: "Doel",                color: "#34d399" },
  risk:       { label: "Risicofactor",        color: "#f87171" },
  protective: { label: "Beschermende factor", color: "#60a5fa" },
  amplifying: { label: "Versterkende factor", color: "#a78bfa" },
};

export const uid = () => Math.random().toString(36).slice(2, 8);

export const nodeRadius = (n, influence) => {
  if (n.type === "maingoal") return 28;
  const score = influence?.[n.label] ?? 0.4;
  // Quadratic scaling for visible difference: 84% → 32px, 71% → 26px, 50% → 18px
  return 10 + score * score * 30;
};

export const edgeWidth = (corr) => 1 + (corr ?? 0.3) * 8;

export const targetDist = (influence, label, W = 900, H = 600) => {
  const score = Math.max(0.05, influence?.[label] ?? 0.5);
  // High influence → close to center, low influence → far away
  // Linear inverse: 90% → 15% of radius, 50% → 55%, 10% → 95%
  const maxDist = Math.min(W, H) * 0.42;
  const minDist = Math.min(W, H) * 0.12;
  return minDist + (1 - score) * (maxDist - minDist);
};
