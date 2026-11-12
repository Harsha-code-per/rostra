"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js is ~600 KB: load it after first paint, never on the server, and skip it where it cannot help.
const StoryScene = dynamic(() => import("./StoryScene"), { ssr: false });

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function SceneLoader() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData || !webglAvailable()) return;
    const small = window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 4) <= 4;
    const start = () => setCount(small ? 200 : 420);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number);
    if (ric) ric(start, { timeout: 1500 });
    else setTimeout(start, 400);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#f4f5ff]">
      {/* Poster: what you see before (or without) the 3D scene. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_75%_45%,#fff_0%,#f4f5ff_70%)]" />
      {count > 0 && <StoryScene count={count} />}
    </div>
  );
}
