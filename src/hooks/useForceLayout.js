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
    const others = nodes.filter(n => n.id !== centerNode?.id);

    // Place center node in the middle
    if (centerNode) {
      posRef.current[centerNode.id] = { x: W / 2, y: H / 2 };
      velRef.current[centerNode.id] = { x: 0, y: 0 };
    }

    // Place other nodes evenly around center at their target distance
    others.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / others.length - Math.PI / 2;
      const dist = targetDist(influenceRef.current, n.label, W, H);
      posRef.current[n.id] = {
        x: W / 2 + dist * Math.cos(angle),
        y: H / 2 + dist * Math.sin(angle)
      };
      velRef.current[n.id] = { x: 0, y: 0 };
    });

    iterRef.current = 0;
    cancelAnimationFrame(frameRef.current);

    const step = () => {
      iterRef.current++;
      // Slow cooling — starts strong, fades to near-zero
      const alpha = Math.max(0.005, 0.8 * Math.pow(0.985, iterRef.current));
      const pos = posRef.current, vel = velRef.current;
      const inf = influenceRef.current;

      others.forEach(a => {
        let fx = 0, fy = 0;
        const rA = nodeRadius(a, inf);

        // 1. Repulsion from all other non-center nodes
        others.forEach(b => {
          if (a.id === b.id) return;
          const dx = pos[a.id].x - pos[b.id].x;
          const dy = pos[a.id].y - pos[b.id].y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
          const rB = nodeRadius(b, inf);
          const minSep = rA + rB + 70;
          const force = d < minSep
            ? (minSep - d) * 4
            : 5000 / (d * d);
          fx += (dx / d) * force;
          fy += (dy / d) * force;
        });

        // 2. Spring toward target distance from center
        if (centerNode && pos[centerNode.id]) {
          const cx = pos[centerNode.id].x, cy = pos[centerNode.id].y;
          const dx = pos[a.id].x - cx;
          const dy = pos[a.id].y - cy;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
          const tgt = targetDist(inf, a.label, W, H);
          const springForce = (tgt - d) * 0.08;
          fx += (dx / d) * springForce;
          fy += (dy / d) * springForce;
        }

        // 3. Gentle pull toward canvas center (prevents drift)
        fx += (W / 2 - pos[a.id].x) * 0.002;
        fy += (H / 2 - pos[a.id].y) * 0.002;

        // Apply with damping
        vel[a.id].x = (vel[a.id].x * 0.5 + fx * alpha);
        vel[a.id].y = (vel[a.id].y * 0.5 + fy * alpha);

        const pad = rA + 25;
        pos[a.id].x = Math.max(pad, Math.min(W - pad, pos[a.id].x + vel[a.id].x));
        pos[a.id].y = Math.max(pad, Math.min(H - pad, pos[a.id].y + vel[a.id].y));
      });

      setTick(t => t + 1);
      if (iterRef.current < 300) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [nodes.length, edges.length, influence ? JSON.stringify(influence) : "none", W, H]);

  return { positions: posRef.current, posRef };
}
