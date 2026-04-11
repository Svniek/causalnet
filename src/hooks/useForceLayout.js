import { useState, useEffect, useRef } from "react";
import { nodeRadius, targetDist } from "../constants";

export default function useForceLayout(nodes, edges, influence, W, H) {
  const posRef = useRef({});
  const velRef = useRef({});
  const [, setTick] = useState(0);
  const frameRef = useRef(null);
  const iterRef = useRef(0);
  const influenceRef = useRef(influence);
  influenceRef.current = influence;

  useEffect(() => {
    if (nodes.length === 0) { posRef.current = {}; setTick(t => t + 1); return; }
    const centerNode = nodes.find(n => n.type === "maingoal") || nodes.find(n => n.type === "goal");
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const dist = n.id === centerNode?.id ? 0
        : targetDist(influenceRef.current, n.label, W, H) + (Math.random() - 0.5) * 30;
      posRef.current[n.id] = { x: W / 2 + dist * Math.cos(angle), y: H / 2 + dist * Math.sin(angle) };
      velRef.current[n.id] = { x: 0, y: 0 };
    });
    iterRef.current = 0;
    cancelAnimationFrame(frameRef.current);
    const step = () => {
      iterRef.current++;
      const alpha = Math.max(0.01, 1 - iterRef.current / 300);
      const pos = posRef.current, vel = velRef.current;
      const inf = influenceRef.current;
      const cNode = nodes.find(n => n.type === "maingoal") || nodes.find(n => n.type === "goal");
      nodes.forEach(a => {
        if (a.id === cNode?.id) return;
        let fx = 0, fy = 0;
        // Repulsion — stronger to keep nodes apart
        nodes.forEach(b => {
          if (a.id === b.id) return;
          const dx = pos[a.id].x - pos[b.id].x, dy = pos[a.id].y - pos[b.id].y;
          const d2 = dx * dx + dy * dy + 1, d = Math.sqrt(d2);
          const rA = nodeRadius(a, inf), rB = nodeRadius(b, inf);
          const minSep = rA + rB + 60;
          const strength = d < minSep ? 25000 / (d2 + 1) : 8000 / (d2 + 1);
          fx += (dx / d) * strength * alpha; fy += (dy / d) * strength * alpha;
        });
        // Spring to influence-based target distance from center
        if (cNode && pos[cNode.id]) {
          const dx = pos[cNode.id].x - pos[a.id].x;
          const dy = pos[cNode.id].y - pos[a.id].y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const tgt = targetDist(inf, a.label, W, H);
          const f = ((d - tgt) / d) * 0.18 * alpha;
          fx += dx * f; fy += dy * f;
        }
        // Angular spread — push nodes apart angularly around center
        if (cNode && pos[cNode.id]) {
          const cx = pos[cNode.id].x, cy = pos[cNode.id].y;
          nodes.forEach(b => {
            if (b.id === a.id || b.id === cNode.id) return;
            const ax = pos[a.id].x - cx, ay = pos[a.id].y - cy;
            const bx = pos[b.id].x - cx, by = pos[b.id].y - cy;
            const cross = ax * by - ay * bx;
            const dot = ax * bx + ay * by;
            const angle = Math.abs(Math.atan2(cross, dot));
            if (angle < 0.4) {
              const push = (0.4 - angle) * 800 * alpha;
              const sign = cross >= 0 ? 1 : -1;
              const da = Math.sqrt(ax * ax + ay * ay) + 0.01;
              fx += (-ay / da) * push * sign;
              fy += (ax / da) * push * sign;
            }
          });
        }
        // Gentle center gravity
        fx += (W / 2 - pos[a.id].x) * 0.004 * alpha;
        fy += (H / 2 - pos[a.id].y) * 0.004 * alpha;
        vel[a.id].x = (vel[a.id].x + fx) * 0.65;
        vel[a.id].y = (vel[a.id].y + fy) * 0.65;
        const rA = nodeRadius(a, inf);
        const pad = rA + 20;
        pos[a.id].x = Math.max(pad, Math.min(W - pad, pos[a.id].x + vel[a.id].x));
        pos[a.id].y = Math.max(pad, Math.min(H - pad, pos[a.id].y + vel[a.id].y));
      });
      setTick(t => t + 1);
      if (iterRef.current < 500) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [nodes.length, edges.length, influence ? JSON.stringify(influence) : "none", W, H]);
  return { positions: posRef.current, posRef };
}
