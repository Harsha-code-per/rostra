"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeBadges, makeCalendar, makeClock, makePayslip, makeShield, type Piece } from "./sceneObjects";

/**
 * "One ordinary Monday": paper cards scattered while HR is drowning, which then gather into five
 * real objects as you scroll: a wall clock, staff badges, a leave calendar, a payslip and a shield.
 * The act is read from the page's <section data-act> elements, so the film follows the layout.
 */

const PAPER = ["#ffffff", "#eceeff", "#d9dcff"].map((c) => new THREE.Color(c));
const SAFFRON = new THREE.Color("#ff6b3d");
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export default function StoryScene({ count }: { count: number }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // no WebGL: the CSS poster stays visible
    }
    let cancelled = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.3;
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
    camera.position.set(0, 0, 15);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc9ccff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(-5, 7, 9);
    scene.add(sun);

    // Paper swarm for the "mess" act.
    const N = count;
    const geo = new RoundedBoxGeometry(1, 1.3, 0.05, 2, 0.06);
    const swarm = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), N);
    swarm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const home = Array.from({ length: N }, () => new THREE.Vector3(rnd(-9, 9), rnd(-5, 5), rnd(-7, 3)));
    const spin = Array.from({ length: N }, () => new THREE.Euler(rnd(-1.4, 1.4), rnd(-1.4, 1.4), rnd(-3, 3)));
    const size = Float32Array.from({ length: N }, () => rnd(0.8, 1.35));
    const phase = Float32Array.from({ length: N }, () => Math.random() * Math.PI * 2);
    for (let i = 0; i < N; i++) swarm.setColorAt(i, Math.random() < 0.06 ? SAFFRON : PAPER[Math.floor(Math.random() * 3)]);
    scene.add(swarm);

    // The props. Built once the page fonts are ready, because their text is drawn to textures.
    const stage = new THREE.Group();
    scene.add(stage);
    let pieces: Piece[] = [];
    const disposables: { dispose(): void }[] = [geo, swarm.material as THREE.Material, envRT.texture];
    const css = getComputedStyle(document.documentElement);
    const fonts = { display: css.getPropertyValue("--font-display").trim() || "system-ui", body: css.getPropertyValue("--font-sans-body").trim() || "system-ui" };
    Promise.all([
      document.fonts.load(`700 40px ${fonts.display}`),
      document.fonts.load(`500 40px ${fonts.display}`),
      document.fonts.load(`700 40px ${fonts.body}`),
      document.fonts.load(`500 40px ${fonts.body}`),
    ]).catch(() => undefined).then(() => {
      if (cancelled) return;
      const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      pieces = [makeClock(fonts, aniso), makeBadges(fonts, aniso), makeCalendar(fonts, aniso), makePayslip(fonts, aniso), makeShield()];
      pieces.forEach((p) => {
        p.root.visible = false;
        stage.add(p.root);
        p.root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          disposables.push(m.geometry);
          [m.material].flat().forEach((mat) => {
            disposables.push(mat);
            const map = (mat as THREE.MeshStandardMaterial).map;
            if (map) disposables.push(map);
          });
        });
      });
    });

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

    // Smoothed act position: 0 = mess, 1 = clock, 2 = badges, 3 = calendar, 4 = payslip, 5 = shield.
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
    const eul = new THREE.Euler();
    const t0 = performance.now();
    let raf = 0;
    let visible = true;
    let last = t0;

    const render = () => {
      const now = performance.now();
      const time = (now - t0) / 1000;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // Frame-rate independent easing, so slow devices still arrive.
      act += (readAct() - act) * (reduced ? 1 : 1 - Math.exp(-dt * 7));

      const aspect = camera.aspect;
      const wide = aspect > 1.1;
      const fit = Math.min(1, Math.max(0.42, aspect / 1.78));
      // Sits right of the copy and below the nav, never under it.
      stage.position.set(wide ? aspect * 10.8 * 0.19 : 0, wide ? -0.45 : 1.5, 0);
      stage.scale.setScalar((wide ? 0.98 : 0.66) * fit);

      pieces.forEach((p, k) => {
        const d = act - (k + 1);
        const w = ease(clamp01(1 - Math.abs(d) * 1.7));
        p.root.visible = w > 0.004;
        if (!p.root.visible) return;
        p.root.scale.setScalar((0.35 + 0.65 * w) * (k === 1 ? 1.3 : 1));
        p.root.position.set(d * 1.2, Math.abs(d) * -0.5, -Math.abs(d) * 2);
        const bank = k === 4 ? 0 : -d * 0.9;
        p.root.rotation.set(0, bank, 0);
        p.tick(time, reduced);
      });

      // Paper swarm: scattered at the top, drawn into the clock as the first act arrives.
      const wSwarm = clamp01(1 - act);
      swarm.visible = wSwarm > 0.004;
      if (swarm.visible) {
        const u = ease(wSwarm);
        for (let i = 0; i < N; i++) {
          dummy.position.copy(home[i]).multiplyScalar(0.2 + 0.8 * u);
          dummy.position.x += Math.sin(time * 0.5 + phase[i]) * 0.5 * u + (wide ? stage.position.x * (1 - u) : 0);
          dummy.position.y += Math.cos(time * 0.43 + phase[i] * 1.3) * 0.5 * u;
          eul.set(spin[i].x * u + Math.sin(time * 0.3 + phase[i]) * 0.3 * u, spin[i].y * u, spin[i].z * u);
          dummy.quaternion.setFromEuler(eul);
          dummy.scale.setScalar(size[i] * u);
          dummy.updateMatrix();
          swarm.setMatrixAt(i, dummy.matrix);
        }
        swarm.instanceMatrix.needsUpdate = true;
      }

      camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.04;
      camera.position.y += (-pointer.y * 0.55 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (visible) render();
    };
    if (reduced) {
      // One static frame once the props exist.
      const wait = setInterval(() => {
        if (pieces.length) { clearInterval(wait); render(); }
      }, 100);
      disposables.push({ dispose: () => clearInterval(wait) });
    } else frame();

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const onVis = () => (visible = !document.hidden);
    document.addEventListener("visibilitychange", onVis);
    renderer.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      disposables.forEach((d) => d.dispose());
      swarm.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [count]);

  return <div ref={host} className="absolute inset-0" />;
}
