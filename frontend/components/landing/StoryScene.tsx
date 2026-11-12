"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeBadges, makeCalendar, makeClock, makePaperTextures, makePayslip, makeShield, type Piece } from "./sceneObjects";

/**
 * "One ordinary Monday": paper cards scattered while HR is drowning, which then gather into five
 * real objects as you scroll: a wall clock, staff badges, a leave calendar, a payslip and a shield.
 * The act is read from the page's <section data-act> elements, so the film follows the layout.
 */

const PAPER = ["#ffffff", "#eceeff", "#d9dcff"].map((c) => new THREE.Color(c));
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

    // The "mess" act: spreadsheets, forms and sticky notes in the air.
    const KINDS = 3;
    const per = Math.ceil(count / KINDS);
    const N = per * KINDS;
    const geo = new RoundedBoxGeometry(1, 1.3, 0.04, 2, 0.05);
    const papers = makePaperTextures(Math.min(4, renderer.capabilities.getMaxAnisotropy()));
    const meshes = papers.map((map, k) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.8 }), per);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < per; i++) m.setColorAt(i, PAPER[(i + k) % 2]);
      scene.add(m);
      return m;
    });
    const home = Array.from({ length: N }, () => new THREE.Vector3(rnd(-8.5, 8.5), rnd(-4.6, 4.6), rnd(-9, -1)));
    const spin = Array.from({ length: N }, () => new THREE.Euler(rnd(-0.9, 0.9), rnd(-0.9, 0.9), rnd(-2.6, 2.6)));
    const size = Float32Array.from({ length: N }, () => rnd(0.55, 0.95));
    const phase = Float32Array.from({ length: N }, () => Math.random() * Math.PI * 2);

    // The props. Built once the page fonts are ready, because their text is drawn to textures.
    const stage = new THREE.Group();
    scene.add(stage);
    let pieces: Piece[] = [];
    const disposables: { dispose(): void }[] = [geo, envRT.texture, ...papers, ...meshes.map((m) => m.material as THREE.Material)];
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

      // Each prop holds still for the middle of its section, then hands over quickly: it rises in
      // from below as you scroll down and lifts away upward, so two are never on screen together.
      const win = (d: number) => ease(clamp01((0.58 - Math.abs(d)) / 0.33));
      pieces.forEach((p, k) => {
        const d = act - (k + 1);
        const w = win(d);
        p.root.visible = w > 0.004;
        if (!p.root.visible) return;
        p.root.scale.setScalar(w);
        p.root.position.set(0, d * 2.6, 0);
        p.root.rotation.set(0, d * 1.5, 0);
        p.tick(time, reduced);
      });

      // Mess: drifts apart at the top, then is drawn into the stage and gone before the clock settles.
      const u = act <= 0.25 ? 1 : ease(clamp01((0.6 - act) / 0.35));
      meshes.forEach((m, k) => {
        m.visible = u > 0.004;
        if (!m.visible) return;
        for (let i = 0; i < per; i++) {
          const j = k * per + i;
          dummy.position.copy(home[j]).multiplyScalar(0.15 + 0.85 * u);
          dummy.position.x += Math.sin(time * 0.5 + phase[j]) * 0.45 * u + (wide ? stage.position.x * (1 - u) : 0);
          dummy.position.y += Math.cos(time * 0.43 + phase[j] * 1.3) * 0.45 * u + stage.position.y * (1 - u);
          eul.set(spin[j].x * u + Math.sin(time * 0.3 + phase[j]) * 0.25 * u, spin[j].y * u, spin[j].z * u);
          dummy.quaternion.setFromEuler(eul);
          dummy.scale.setScalar(size[j] * u);
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
      });

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
      meshes.forEach((m) => m.dispose());
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [count]);

  return <div ref={host} className="absolute inset-0" />;
}
