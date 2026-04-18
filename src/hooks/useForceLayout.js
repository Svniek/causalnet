import { useState, useEffect, useRef } from "react";
import { nodeRadius, targetDist } from "../constants";

export default function useForceLayout(nodes, edges, influence, W, H) {
  const posRef = useRef({});
  const velRef = useRef({});
  const centerPinRef = useRef(null);
  const skipPlacementRef = useRef(false);
  const [, setTick] = useState(0);
  const frameRef = useRef(null);
  const iterRef = useRef(0);
  const influenceRef = useRef(influence);
  influenceRef.current = influence;
  const wRef = useRef(W);
  const hRef = useRef(H);
  wRef.current = W;
  hRef.current = H;

  useEffect(() => {
    const w = wRef.current, h = hRef.current;
    if (nodes.length === 0) { posRef.current = {}; setTick(t => t + 1); return; }
    const centerNode = nodes.find(n => n.type === "maingoal") || nodes.find(n => n.type === "goal");
    const others = nodes.filter(n => n.id !== centerNode?.id);

    // Skip placement only when explicitly loaded from file
    const skipPlacement = skipPlacementRef.current && nodes.every(n => posRef.current[n.id]);
    skipPlacementRef.current = false; // clear flag after use

    if (!skipPlacement) {
      // Place center node in the middle
      if (centerNode) {
        posRef.current[centerNode.id] = { x: w / 2, y: h / 2 };
        velRef.current[centerNode.id] = { x: 0, y: 0 };
      }

      // Place other nodes evenly around center at their target distance
      others.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / others.length - Math.PI / 2;
        const dist = targetDist(influenceRef.current, n.label, w, h);
        posRef.current[n.id] = {
          x: w / 2 + dist * Math.cos(angle),
          y: h / 2 + dist * Math.sin(angle)
        };
        velRef.current[n.id] = { x: 0, y: 0 };
      });
    } else {
      // Positions loaded from file — init velocities to zero without moving nodes
      nodes.forEach(n => { velRef.current[n.id] = { x: 0, y: 0 }; });
    }

    iterRef.current = 0;
    cancelAnimationFrame(frameRef.current);

    // When positions were loaded from file, skip the physics simulation entirely
    // so the saved layout is preserved exactly. User can still drag nodes.
    if (skipPlacement) {
      setTick(t => t + 1);
      return;
    }

    const step = () => {
      iterRef.current++;
      const curW = wRef.current, curH = hRef.current;
      // Slow cooling — starts strong, fades to near-zero
      const alpha = Math.max(0.005, 0.8 * Math.pow(0.985, iterRef.current));
      const pos = posRef.current, vel = velRef.current;
      const inf = influenceRef.current;

      // Keep center node pinned — either to canvas centre, or to user-set pin location
      if (centerNode && pos[centerNode.id]) {
        const pin = centerPinRef.current;
        pos[centerNode.id].x = pin ? pin.x : curW / 2;
        pos[centerNode.id].y = pin ? pin.y : curH / 2;
      }

      others.forEach(a => {
        let fx = 0, fy = 0;
        const rA = nodeRadius(a, inf);

        // 1. Collision avoidance (soft, only when overlapping)
        others.forEach(b => {
          if (a.id === b.id) return;
          const dx = pos[a.id].x - pos[b.id].x;
          const dy = pos[a.id].y - pos[b.id].y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
          const rB = nodeRadius(b, inf);
          const minSep = rA + rB + 20;
          if (d < minSep) {
            const force = (minSep - d) * 2;
            fx += (dx / d) * force;
            fy += (dy / d) * force;
          }
        });

        // 2. Dominant spring toward target distance from center
        if (centerNode && pos[centerNode.id]) {
          const cx = pos[centerNode.id].x, cy = pos[centerNode.id].y;
          const dx = pos[a.id].x - cx;
          const dy = pos[a.id].y - cy;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
          const tgt = targetDist(inf, a.label, curW, curH);
          const springForce = (tgt - d) * 0.4;
          fx += (dx / d) * springForce;
          fy += (dy / d) * springForce;
        }

        // Apply with damping
        vel[a.id].x = (vel[a.id].x * 0.35 + fx * alpha);
        vel[a.id].y = (vel[a.id].y * 0.35 + fy * alpha);

        const pad = rA + 15;
        pos[a.id].x = Math.max(pad, Math.min(curW - pad, pos[a.id].x + vel[a.id].x));
        pos[a.id].y = Math.max(pad, Math.min(curH - pad, pos[a.id].y + vel[a.id].y));
      });

      setTick(t => t + 1);
      if (iterRef.current < 400) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
    // W and H are tracked via refs — no restart on resize
  }, [nodes.length, edges.length, influence ? JSON.stringify(influence) : "none"]);

  const onDragNode = (nodeId, x, y) => {
    if (posRef.current[nodeId]) {
      posRef.current[nodeId] = { x, y };
      setTick(t => t + 1);
    }
  };

  return { positions: posRef.current, posRef, onDragNode, skipPlacementRef, centerPinRef };
}
