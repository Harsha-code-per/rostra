"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * "One ordinary Monday": a field of paper cards that is scattered when HR is drowning, then
 * flies into a clock face, a month calendar, a leave board, a payroll chart, a sealed sphere
 * and the clock again. The target for each scroll position is read from the page's
 * <section data-act> elements, so the film follows whatever layout the page has.
 */

const TEAL = new THREE.Color("#3b3bf2");
const TEAL_DARK = new THREE.Color("#10113a");
const SAFFRON = new THREE.Color("#ff6b3d");
const PAPER = [new THREE.Color("#ffffff"), new THREE.Color("#eceeff"), new THREE.Color("#d9dcff")];
const BG = "#f4f5ff";

interface Target {
  pos: Float32Array;
  quat: Float32Array;
  scale: Float32Array;
  color: Float32Array;
  groupScale: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const ease = (x: number) => x * x * (3 - 2 * x);

function makeTarget(n: number, groupScale: number): Target {
  return { pos: new Float32Array(n * 3), quat: new Float32Array(n * 4), scale: new Float32Array(n), color: new Float32Array(n * 3), groupScale };
}

function put(t: Target, i: number, p: THREE.Vector3, q: THREE.Quaternion, s: number, c: THREE.Color) {
  t.pos.set([p.x, p.y, p.z], i * 3);
  t.quat.set([q.x, q.y, q.z, q.w], i * 4);
  t.scale[i] = s;
  t.color.set([c.r, c.g, c.b], i * 3);
}

const faceCamera = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(-0.04, 0.04), rnd(-0.04, 0.04), rnd(-0.06, 0.06)));
const paper = () => PAPER[Math.floor(Math.random() * PAPER.length)];

function chaos(n: number): Target {
  const t = makeTarget(n, 1);
  for (let i = 0; i < n; i++) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(-1.4, 1.4), rnd(-1.4, 1.4), rnd(-3, 3)));
    const c = Math.random() < 0.06 ? SAFFRON : paper();
    put(t, i, new THREE.Vector3(rnd(-9, 9), rnd(-5.5, 5.5), rnd(-7, 3)), q, rnd(0.8, 1.35), c);
  }
  return t;
}

function clockFace(n: number): Target {
  const t = makeTarget(n, 1);
  const ring = Math.round(n * 0.62);
  const hourN = Math.round(n * 0.13);
  const tick = Math.max(1, Math.round(ring / 12));
  for (let i = 0; i < n; i++) {
    let pos: THREE.Vector3;
    let color: THREE.Color;
    let scale = 0.3;
    if (i < ring) {
      const a = (i / ring) * Math.PI * 2;
      const r = 4.1 + rnd(-0.12, 0.12);
      pos = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, rnd(0, 0.1));
      const isTick = i % tick === 0;
      color = isTick ? TEAL : Math.random() < 0.25 ? TEAL.clone().lerp(PAPER[0], 0.55) : paper();
      scale = isTick ? 0.42 : 0.3;
    } else if (i < ring + hourN) {
      const k = (i - ring) / hourN; // hour hand
      const a = (Math.PI / 180) * 150;
      pos = new THREE.Vector3(Math.cos(a) * k * 2.3, Math.sin(a) * k * 2.3, 0.12 + rnd(0, 0.05));
      color = TEAL_DARK;
    } else {
      const k = (i - ring - hourN) / (n - ring - hourN); // minute hand, tangerine
      const a = (Math.PI / 180) * 30;
      pos = new THREE.Vector3(Math.cos(a) * k * 3.4, Math.sin(a) * k * 3.4, 0.18 + rnd(0, 0.05));
      color = SAFFRON;
    }
    put(t, i, pos, faceCamera(), scale, color);
  }
  return t;
}

function calendar(n: number): Target {
  const t = makeTarget(n, 0.62);
  const cols = Math.max(7, Math.round(Math.sqrt(n * 1.9)));
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const cx = i % cols, cy = Math.floor(i / cols);
    const weekend = cx % 7 >= 5;
    const c = Math.random() < 0.08 ? TEAL : Math.random() < 0.03 ? SAFFRON : weekend ? PAPER[2] : PAPER[0];
    put(t, i, new THREE.Vector3((cx - (cols - 1) / 2) * 0.46, -(cy - (rows - 1) / 2) * 0.56, 0), faceCamera(), 0.5, c);
  }
  return t;
}

function board(n: number): Target {
  const t = makeTarget(n, 0.62);
  const shares = [0.3, 0.5, 0.2];
  const centers = [-3.9, 0, 3.9];
  const colors = [SAFFRON, TEAL, PAPER[2]];
  let i = 0;
  shares.forEach((share, col) => {
    const count = col === 2 ? n - i : Math.round(n * share);
    for (let k = 0; k < count && i < n; k++, i++) {
      const sub = k % 4, row = Math.floor(k / 4);
      const c = Math.random() < 0.82 ? colors[col] : PAPER[0];
      put(t, i, new THREE.Vector3(centers[col] + (sub - 1.5) * 0.52, 3.6 - row * 0.2, rnd(0, 0.05)), faceCamera(), 0.46, c);
    }
  });
  return t;
}

function bars(n: number): Target {
  const t = makeTarget(n, 0.7);
  const bars = 14;
  const weights = Array.from({ length: bars }, (_, b) => 0.25 + 0.75 * Math.pow(b / (bars - 1), 1.35));
  const sum = weights.reduce((a, b) => a + b, 0);
  let i = 0;
  weights.forEach((w, b) => {
    const count = b === bars - 1 ? n - i : Math.round((w / sum) * n);
    const c = TEAL.clone().lerp(b === bars - 1 ? SAFFRON : TEAL_DARK, b === bars - 1 ? 1 : b / bars * 0.6);
    for (let k = 0; k < count && i < n; k++, i++) {
      const sub = k % 2, row = Math.floor(k / 2);
      put(t, i, new THREE.Vector3((b - (bars - 1) / 2) * 0.82 + (sub - 0.5) * 0.4, -4 + row * 0.2, rnd(0, 0.05)), faceCamera(), 0.38, Math.random() < 0.88 ? c : PAPER[0]);
    }
  });
  return t;
}

function sphere(n: number): Target {
  const t = makeTarget(n, 1);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const dir = new THREE.Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r);
    const front = dir.z > 0.9 && Math.abs(dir.y) < 0.35;
    const c = front ? SAFFRON : Math.random() < 0.55 ? TEAL.clone().lerp(new THREE.Color("#2525a8"), Math.random()) : paper();
    put(t, i, dir.clone().multiplyScalar(4.1), new THREE.Quaternion().setFromUnitVectors(up, dir), 0.55, c);
  }
  return t;
}

export default function StoryScene({ count }: { count: number }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const N = count;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // no WebGL: the CSS poster stays visible
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(BG, 0.028);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
    camera.position.set(0, 0, 14);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe9e1cf, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(-5, 8, 9);
    scene.add(sun);

    const geo = new RoundedBoxGeometry(1, 1.3, 0.05, 2, 0.06);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }), N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);

    const targets = [chaos(N), clockFace(N), calendar(N), board(N), bars(N), sphere(N), clockFace(N)];
    const delay = Float32Array.from({ length: N }, () => Math.random());
    const phase = Float32Array.from({ length: N }, () => Math.random() * Math.PI * 2);
    const lift = Float32Array.from({ length: N }, () => rnd(0.4, 2.2));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let sections: HTMLElement[] = [];
    const collect = () => (sections = Array.from(document.querySelectorAll<HTMLElement>("[data-act]")));
    collect();

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      collect();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    ro.observe(document.body);

    const pointer = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    // Smoothed "act position": 0 = chaos, 1 = R, 2 = calendar ...
    let act = reduced ? 1 : 0;
    const readAct = () => {
      if (reduced || sections.length === 0) return reduced ? 1 : 0;
      const mid = window.scrollY + window.innerHeight * 0.5;
      const centers = sections.map((s) => s.getBoundingClientRect().top + window.scrollY + s.offsetHeight / 2);
      if (mid <= centers[0]) return 0;
      for (let i = 0; i < centers.length - 1; i++) {
        if (mid < centers[i + 1]) return i + (mid - centers[i]) / (centers[i + 1] - centers[i]);
      }
      return centers.length - 1;
    };

    const dummy = new THREE.Object3D();
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), wob = new THREE.Quaternion(), eul = new THREE.Euler();
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(), col = new THREE.Color(), colB = new THREE.Color();
    const t0 = performance.now();
    let raf = 0;
    let visible = true;

    const render = () => {
      const time = (performance.now() - t0) / 1000;
      act += (readAct() - act) * (reduced ? 1 : 0.075);

      const last = targets.length - 1;
      const i0 = Math.min(last - 1, Math.max(0, Math.floor(act)));
      const frac = Math.min(1, Math.max(0, act - i0));
      const A = targets[i0], B = targets[i0 + 1];
      const wChaos = Math.max(0, 1 - act);

      const aspect = camera.aspect;
      const fit = Math.min(1, Math.max(0.38, aspect / 1.78));
      const wide = aspect > 1.1;
      const gs = THREE.MathUtils.lerp(A.groupScale, B.groupScale, ease(frac)) * fit;
      group.scale.setScalar(gs);
      group.position.set(wide ? aspect * 10.2 * 0.2 : 0, wide ? 0 : 1.6, 0);
      group.rotation.y = act > 4.5 && act < 5.5 ? time * 0.25 : THREE.MathUtils.lerp(group.rotation.y, 0, 0.08);

      for (let i = 0; i < N; i++) {
        const d = delay[i] * 0.45;
        const u = ease(Math.min(1, Math.max(0, (frac * (1 + 0.45) - d) / 1)));
        pa.fromArray(A.pos, i * 3);
        pb.fromArray(B.pos, i * 3);
        pa.lerp(pb, u);
        pa.y += Math.sin(u * Math.PI) * lift[i] * 0.6;
        const float = 0.05 + wChaos * 0.55;
        pa.x += Math.sin(time * 0.5 + phase[i]) * float;
        pa.y += Math.cos(time * 0.43 + phase[i] * 1.3) * float;
        qa.fromArray(A.quat, i * 4);
        qb.fromArray(B.quat, i * 4);
        qa.slerp(qb, u);
        if (wChaos > 0) {
          eul.set(Math.sin(time * 0.3 + phase[i]) * wChaos * 0.5, Math.cos(time * 0.27 + phase[i]) * wChaos * 0.5, 0);
          qa.multiply(wob.setFromEuler(eul));
        }
        dummy.position.copy(pa);
        dummy.quaternion.copy(qa);
        dummy.scale.setScalar(THREE.MathUtils.lerp(A.scale[i], B.scale[i], u));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        col.fromArray(A.color, i * 3).lerp(colB.fromArray(B.color, i * 3), u);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

      camera.position.x += (pointer.x * 0.8 - camera.position.x) * 0.04;
      camera.position.y += (-pointer.y * 0.5 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (visible) render();
    };
    if (reduced) render(); // one static frame, no animation loop
    else frame();

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const onVis = () => (visible = !document.hidden);
    document.addEventListener("visibilitychange", onVis);
    renderer.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      geo.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [count]);

  return <div ref={host} className="absolute inset-0" />;
}
