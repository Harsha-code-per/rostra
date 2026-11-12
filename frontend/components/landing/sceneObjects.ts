import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * The five "props" of the landing film. Each is a real modelled object (not a cloud of cards) so
 * it reads at a glance: a wall clock, staff ID badges, a leave calendar, a payslip with a coin,
 * and a shield. Text on them is drawn to canvas textures with the site's own fonts.
 */

export const C = { ultra: "#3b3bf2", ink: "#10113a", wash: "#f4f5ff", tang: "#ff6b3d", line: "#dfe1fb", mute: "#5b5c8a", white: "#ffffff" };

export interface Fonts { display: string; body: string }
export interface Piece { root: THREE.Group; tick: (t: number, still: boolean) => void }

type Ctx = CanvasRenderingContext2D;

function texture(w: number, h: number, aniso: number, draw: (c: Ctx, w: number, h: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

const mark = (m: THREE.Mesh, cast = true, receive = true) => {
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
};

/** A thin rounded slab with a canvas drawn on its front, corners cut to match the slab. */
function card(w: number, h: number, depth: number, radius: number, px: number, aniso: number, draw: (c: Ctx, W: number, H: number) => void, edge = C.white) {
  const g = new THREE.Group();
  g.add(mark(new THREE.Mesh(new RoundedBoxGeometry(w, h, depth, 3, radius), new THREE.MeshStandardMaterial({ color: edge, roughness: 0.55 }))));
  const W = Math.round(w * px), H = Math.round(h * px);
  const map = texture(W, H, aniso, (c) => {
    c.save();
    c.beginPath();
    c.roundRect(0, 0, W, H, radius * px);
    c.clip();
    draw(c, W, H);
    c.restore();
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: 0.5, alphaTest: 0.5 }));
  face.position.z = depth / 2 + 0.003;
  face.receiveShadow = true;
  g.add(face);
  return g;
}

const font = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}, system-ui, sans-serif`;

function text(c: Ctx, s: string, x: number, y: number, f: string, color: string, align: CanvasTextAlign = "left", spacing = "0px") {
  c.font = f;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = "alphabetic";
  c.letterSpacing = spacing;
  c.fillText(s, x, y);
  c.letterSpacing = "0px";
}

/** The Rostra mark: three rounded bars and a dot. */
function drawMark(c: Ctx, x: number, y: number, s: number) {
  c.fillStyle = C.ultra;
  const bar = (bx: number, by: number, bw: number, bh: number) => { c.beginPath(); c.roundRect(x + bx * s, y + by * s, bw * s, bh * s, bw * s * 0.45); c.fill(); };
  bar(0, 0.5, 0.28, 0.5);
  bar(0.36, 0.25, 0.28, 0.75);
  bar(0.72, 0.62, 0.28, 0.38);
  c.fillStyle = C.tang;
  c.beginPath();
  c.arc(x + 0.5 * s, y + 0.08 * s, 0.1 * s, 0, Math.PI * 2);
  c.fill();
}

// ---------------------------------------------------------------- clock

export function makeClock(f: Fonts, aniso: number): Piece {
  const root = new THREE.Group();
  const R = 3.0;

  const body = new THREE.CylinderGeometry(R + 0.38, R + 0.46, 0.7, 128).rotateX(Math.PI / 2);
  root.add(mark(new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.32, metalness: 0.25 }))));
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(R + 0.06, 0.13, 32, 160), new THREE.MeshStandardMaterial({ color: "#d9dcff", roughness: 0.22, metalness: 0.85 }));
  bezel.position.z = 0.34;
  root.add(mark(bezel));

  const faceMap = texture(2048, 2048, aniso, (c, W) => {
    const m = W / 2;
    const g = c.createRadialGradient(m, m * 0.85, W * 0.05, m, m, m);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#eef0ff");
    c.fillStyle = g;
    c.fillRect(0, 0, W, W);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const major = i % 5 === 0;
      const r1 = m * 0.94, r2 = m * (major ? 0.84 : 0.89);
      c.strokeStyle = major ? C.ink : "#9a9cc8";
      c.lineWidth = major ? 13 : 5;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(m + Math.sin(a) * r1, m - Math.cos(a) * r1);
      c.lineTo(m + Math.sin(a) * r2, m - Math.cos(a) * r2);
      c.stroke();
    }
    for (let h = 1; h <= 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      const r = m * 0.7;
      text(c, String(h), m + Math.sin(a) * r, m - Math.cos(a) * r + 44, font(700, 130, f.display), h === 12 ? C.ultra : C.ink, "center");
    }
    drawMark(c, m - 70, m * 0.46 - 20, 140);
    text(c, "ROSTRA", m, m * 0.46 + 190, font(700, 50, f.display), C.mute, "center", "14px");
    text(c, "ATTENDANCE", m, m * 1.5 + 4, font(600, 38, f.body), C.mute, "center", "10px");
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(R, 160), new THREE.MeshStandardMaterial({ map: faceMap, roughness: 0.5 }));
  face.position.z = 0.352;
  face.receiveShadow = true;
  root.add(face);

  const hand = (len: number, tail: number, w: number, color: string, z: number, metal = 0.1) => {
    const pivot = new THREE.Group();
    pivot.position.z = z;
    const geo = new RoundedBoxGeometry(w, len + tail, 0.07, 2, Math.min(w / 2, 0.05)).translate(0, (len - tail) / 2, 0);
    pivot.add(mark(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: metal }))));
    root.add(pivot);
    return pivot;
  };
  const hour = hand(1.65, 0.35, 0.2, C.ink, 0.43);
  const minute = hand(2.45, 0.4, 0.14, C.ultra, 0.5);
  const second = hand(2.7, 0.65, 0.05, C.tang, 0.57, 0.3);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 48).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: C.tang, roughness: 0.3, metalness: 0.4 }));
  cap.position.z = 0.62;
  root.add(mark(cap));

  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(R + 0.05, 128),
    new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, envMapIntensity: 2 }),
  );
  glass.position.z = 0.7;
  glass.renderOrder = 2;
  root.add(glass);

  return {
    root,
    tick: () => {
      const d = new Date();
      const s = d.getSeconds() + d.getMilliseconds() / 1000;
      const m = d.getMinutes() + s / 60;
      const h = (d.getHours() % 12) + m / 60;
      second.rotation.z = -(s / 60) * Math.PI * 2;
      minute.rotation.z = -(m / 60) * Math.PI * 2;
      hour.rotation.z = -(h / 12) * Math.PI * 2;
    },
  };
}

// ---------------------------------------------------------------- staff badges

const PEOPLE = [
  { name: "Priya Nair", dept: "Engineering", status: "In · 9:02", kind: "in", tint: "#dfe1ff" },
  { name: "Marcus Webb", dept: "Sales", status: "In · 8:47", kind: "in", tint: "#ffe3d9" },
  { name: "Aiko Tanaka", dept: "Finance", status: "On leave", kind: "leave", tint: "#e4f4ec" },
  { name: "Alex Rivera", dept: "Design", status: "Not in yet", kind: "out", tint: "#ececf6" },
] as const;

export function makeBadges(f: Fonts, aniso: number): Piece {
  const root = new THREE.Group();
  const W = 2.15, H = 2.6;
  const cards = PEOPLE.map((p, i) => {
    const g = card(W, H, 0.09, 0.15, 330, aniso, (c, w, h) => {
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, w, h);
      c.fillStyle = C.ultra;
      c.fillRect(0, 0, w, h * 0.3);
      c.fillStyle = "rgba(16,17,58,0.35)";
      c.beginPath(); c.roundRect(w / 2 - 55, 34, 110, 20, 10); c.fill();
      drawMark(c, 36, h * 0.3 - 78, 44);
      text(c, "ROSTRA", 92, h * 0.3 - 44, font(700, 26, f.display), "#ffffff", "left", "5px");
      const cy = h * 0.3 + 6, r = 100;
      c.fillStyle = "#ffffff";
      c.beginPath(); c.arc(w / 2, cy, r + 12, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.tint;
      c.beginPath(); c.arc(w / 2, cy, r, 0, Math.PI * 2); c.fill();
      const initials = p.name.split(" ").map((s) => s[0]).join("");
      text(c, initials, w / 2, cy + 30, font(700, 84, f.display), C.ink, "center");
      text(c, p.name, w / 2, h * 0.3 + 205, font(700, 52, f.display), C.ink, "center");
      text(c, p.dept, w / 2, h * 0.3 + 255, font(500, 36, f.body), C.mute, "center");
      const bg = p.kind === "in" ? "#dff5e8" : p.kind === "leave" ? "#ffe3d9" : "#ececf6";
      const fg = p.kind === "in" ? "#0c6b3b" : p.kind === "leave" ? "#a8390f" : "#4b4c78";
      const dot = p.kind === "in" ? "#16a05a" : p.kind === "leave" ? C.tang : "#9a9cc8";
      c.font = font(700, 38, f.body);
      const tw = c.measureText(p.status).width + 82;
      const px = (w - tw) / 2, py = h - 120;
      c.fillStyle = bg;
      c.beginPath(); c.roundRect(px, py, tw, 66, 33); c.fill();
      c.fillStyle = dot;
      c.beginPath(); c.arc(px + 36, py + 33, 10, 0, Math.PI * 2); c.fill();
      text(c, p.status, px + 58, py + 46, font(700, 38, f.body), fg);
    });
    g.position.set(i % 2 === 0 ? -1.2 : 1.2, (i < 2 ? 1.5 : -1.5) + (i % 2 === 0 ? 0.28 : -0.28), 0);
    g.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.035;
    root.add(g);
    return g;
  });
  const base = cards.map((g) => g.position.y);
  return {
    root,
    tick: (t, still) => {
      if (still) return;
      cards.forEach((g, i) => {
        g.position.y = base[i] + Math.sin(t * 0.8 + i * 1.7) * 0.07;
        g.rotation.y = Math.sin(t * 0.5 + i) * 0.06;
      });
    },
  };
}

// ---------------------------------------------------------------- leave calendar

export function makeCalendar(f: Fonts, aniso: number): Piece {
  const root = new THREE.Group();
  const W = 5.2, H = 6.2;
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const first = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(year, month + 1, 0).getDate();
  let start = 12;
  while ((new Date(year, month, start).getDay() + 6) % 7 !== 0) start++; // a Monday: three weekdays of leave
  const leave = [start, start + 1, start + 2];
  const monthName = now.toLocaleString("en-US", { month: "long" });

  const page = card(W, H, 0.12, 0.2, 210, aniso, (c, w, h) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, w, h);
    const hh = h * 0.2;
    c.fillStyle = C.ultra;
    c.fillRect(0, 0, w, hh);
    text(c, monthName, 56, hh - 46, font(700, 96, f.display), "#ffffff");
    text(c, String(year), w - 56, hh - 50, font(500, 52, f.body), "rgba(255,255,255,0.8)", "right");
    const padX = 56, gw = (w - padX * 2) / 7;
    const top = hh + 70;
    "MTWTFSS".split("").forEach((d, i) => text(c, d, padX + gw * i + gw / 2, top, font(700, 40, f.body), i > 4 ? "#a9aad0" : C.mute, "center"));
    const rowH = (h - top - 150) / 6;
    // The leave range is one continuous pill.
    const li = leave.map((d) => first + d - 1);
    const ly = top + 30 + rowH * Math.floor(li[0] / 7);
    c.fillStyle = C.tang;
    c.beginPath();
    c.roundRect(padX + gw * (li[0] % 7) + 8, ly + 6, gw * 3 - 16, rowH - 12, rowH / 2);
    c.fill();
    for (let d = 1; d <= days; d++) {
      const idx = first + d - 1, col = idx % 7, row = Math.floor(idx / 7);
      const x = padX + gw * col + gw / 2, y = top + 30 + rowH * row + rowH / 2 + 15;
      const isLeave = leave.includes(d);
      text(c, String(d), x, y, font(isLeave ? 700 : 600, 50, f.display), isLeave ? "#ffffff" : col > 4 ? "#a9aad0" : C.ink, "center");
      if (!isLeave && col < 5 && d < start - 2) {
        c.fillStyle = "#9aa0ff";
        c.beginPath(); c.arc(x, y + 22, 6, 0, Math.PI * 2); c.fill();
      }
    }
    c.fillStyle = C.tang;
    c.beginPath(); c.arc(padX + 12, h - 62, 12, 0, Math.PI * 2); c.fill();
    text(c, "Leave", padX + 36, h - 48, font(600, 36, f.body), C.mute);
    c.fillStyle = "#9aa0ff";
    c.beginPath(); c.arc(padX + 230, h - 62, 12, 0, Math.PI * 2); c.fill();
    text(c, "Present", padX + 254, h - 48, font(600, 36, f.body), C.mute);
  });
  root.add(page);

  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 16, 40), new THREE.MeshStandardMaterial({ color: "#c8caf0", roughness: 0.25, metalness: 0.9 }));
    ring.position.set((i - 2.5) * 0.85, H / 2 - 0.05, 0.09);
    root.add(mark(ring));
  }

  const chip = card(2.7, 0.9, 0.22, 0.45, 220, aniso, (c, w, h) => {
    c.fillStyle = C.ink;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#16a05a";
    c.beginPath(); c.arc(h / 2, h / 2, h * 0.3, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#ffffff"; c.lineWidth = 11; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(h / 2 - 17, h / 2 + 1); c.lineTo(h / 2 - 4, h / 2 + 15); c.lineTo(h / 2 + 20, h / 2 - 14); c.stroke();
    text(c, "Approved", h + 6, h / 2 + 22, font(700, 64, f.display), "#ffffff");
  }, C.ink);
  chip.position.set(1.15, -2.55, 0.75);
  chip.rotation.z = 0.06;
  root.add(chip);

  return {
    root,
    tick: (t, still) => {
      if (!still) chip.position.y = -2.55 + Math.sin(t * 1.1) * 0.08;
    },
  };
}

// ---------------------------------------------------------------- payslip and coin

export function makePayslip(f: Fonts, aniso: number): Piece {
  const root = new THREE.Group();
  const W = 4.5, H = 6.4;
  const slip = card(W, H, 0.05, 0.12, 250, aniso, (c, w, h) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, w, h);
    const px = 70;
    drawMark(c, px, 70, 70);
    text(c, "Rostra", px + 92, 128, font(700, 62, f.display), C.ink);
    text(c, "Payslip", w - px, 108, font(700, 60, f.display), C.ink, "right");
    text(c, new Date().toLocaleString("en-US", { month: "long", year: "numeric" }), w - px, 156, font(500, 38, f.body), C.mute, "right");
    c.fillStyle = "#f1f2ff";
    c.beginPath(); c.roundRect(px - 20, 215, w - px * 2 + 40, 140, 26); c.fill();
    text(c, "Priya Nair", px, 280, font(700, 58, f.display), C.ink);
    text(c, "Engineering · RS-0142 · 22 of 22 days", px, 332, font(500, 34, f.body), C.mute);
    let y = 470;
    const row = (label: string, value: string, bold = false, color = C.ink) => {
      text(c, label, px, y, font(bold ? 700 : 500, 46, f.body), bold ? C.ink : C.mute);
      text(c, value, w - px, y, font(700, 48, f.display), color, "right");
      y += 78;
    };
    text(c, "EARNINGS", px, y - 18, font(700, 30, f.body), "#8e90c0", "left", "6px");
    y += 40;
    row("Basic", "₹30,000");
    row("HRA", "₹15,000");
    row("Allowances", "₹15,000");
    c.fillStyle = C.line; c.fillRect(px, y - 38, w - px * 2, 4);
    y += 4;
    row("Gross", "₹60,000", true);
    y += 30;
    text(c, "DEDUCTIONS", px, y - 18, font(700, 30, f.body), "#8e90c0", "left", "6px");
    y += 40;
    row("Provident fund", "−₹3,600", false, "#b4244f");
    row("Professional tax", "−₹200", false, "#b4244f");
    const by = h - 300;
    c.fillStyle = C.ultra;
    c.beginPath(); c.roundRect(px - 20, by, w - px * 2 + 40, 250, 34); c.fill();
    text(c, "Net pay", px + 20, by + 82, font(600, 44, f.body), "rgba(255,255,255,0.85)");
    text(c, "₹56,200", px + 20, by + 192, font(700, 124, f.display), "#ffffff");
    c.fillStyle = C.tang;
    c.beginPath(); c.arc(w - px - 18, by + 62, 20, 0, Math.PI * 2); c.fill();
  });
  slip.rotation.z = -0.025;
  root.add(slip);

  // A tangerine rupee coin, resting on the corner of the slip.
  const sign = (back: boolean) => texture(512, 512, aniso, (c, sz) => {
    c.clearRect(0, 0, sz, sz);
    c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 16;
    c.beginPath(); c.arc(sz / 2, sz / 2, sz * 0.4, 0, Math.PI * 2); c.stroke();
    if (back) { c.translate(sz, 0); c.scale(-1, 1); }
    text(c, "₹", sz / 2, sz / 2 + 90, font(700, 280, f.display), "#ffffff", "center");
  });
  const body = new THREE.MeshStandardMaterial({ color: "#ff6b3d", roughness: 0.3, metalness: 0.55 });
  const coin = new THREE.Group();
  coin.add(mark(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.2, 96).rotateX(Math.PI / 2), body)));
  const decal = (back: boolean) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.93, 64), new THREE.MeshStandardMaterial({ map: sign(back), transparent: true, roughness: 0.3 }));
    m.position.z = back ? -0.102 : 0.102;
    if (back) m.rotation.y = Math.PI;
    return m;
  };
  coin.add(decal(false), decal(true));
  coin.position.set(1.85, -2.6, 0.6);
  root.add(coin);

  return {
    root,
    tick: (t, still) => {
      if (still) return;
      coin.rotation.y = Math.sin(t * 0.9) * 0.55;
      coin.position.y = -2.6 + Math.sin(t * 1.2) * 0.07;
    },
  };
}

// ---------------------------------------------------------------- shield

export function makeShield(): Piece {
  const root = new THREE.Group();
  const outline = (s: number) => {
    const p = new THREE.Shape();
    p.moveTo(0, 2.8 * s);
    p.bezierCurveTo(0.9 * s, 2.25 * s, 1.7 * s, 2.05 * s, 2.4 * s, 2.1 * s);
    p.lineTo(2.4 * s, 0.35 * s);
    p.bezierCurveTo(2.4 * s, -1.4 * s, 1.2 * s, -2.4 * s, 0, -3.05 * s);
    p.bezierCurveTo(-1.2 * s, -2.4 * s, -2.4 * s, -1.4 * s, -2.4 * s, 0.35 * s);
    p.lineTo(-2.4 * s, 2.1 * s);
    p.bezierCurveTo(-1.7 * s, 2.05 * s, -0.9 * s, 2.25 * s, 0, 2.8 * s);
    return p;
  };
  const extrude = (s: number, depth: number, bevel: number) =>
    new THREE.ExtrudeGeometry(outline(s), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 8, curveSegments: 64 }).translate(0, 0, -depth / 2);

  const outer = mark(new THREE.Mesh(extrude(1, 0.5, 0.18), new THREE.MeshPhysicalMaterial({ color: C.ultra, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 })));
  root.add(outer);
  const inner = mark(new THREE.Mesh(extrude(0.76, 0.08, 0.05), new THREE.MeshPhysicalMaterial({ color: C.ink, roughness: 0.4, clearcoat: 0.6 })));
  inner.position.set(0, 0.05, 0.4);
  root.add(inner);

  const path = new THREE.CurvePath<THREE.Vector3>();
  const pts = [new THREE.Vector3(-0.95, 0.0, 0), new THREE.Vector3(-0.3, -0.72, 0), new THREE.Vector3(1.0, 0.85, 0)];
  path.add(new THREE.LineCurve3(pts[0], pts[1]));
  path.add(new THREE.LineCurve3(pts[1], pts[2]));
  const checkMat = new THREE.MeshStandardMaterial({ color: C.tang, roughness: 0.3, metalness: 0.2 });
  const check = new THREE.Group();
  check.add(mark(new THREE.Mesh(new THREE.TubeGeometry(path, 48, 0.22, 24), checkMat)));
  pts.forEach((p) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), checkMat); b.position.copy(p); check.add(mark(b)); });
  check.position.set(0, 0.1, 0.62);
  root.add(check);

  const ring = new THREE.Group();
  const orbit = mark(new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.04, 16, 160), new THREE.MeshStandardMaterial({ color: C.tang, roughness: 0.4 })), false, false);
  const sat = mark(new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), new THREE.MeshStandardMaterial({ color: C.tang, roughness: 0.3 })), false, false);
  sat.position.set(3.55, 0, 0);
  ring.add(orbit, sat);
  ring.rotation.x = 1.15;
  root.add(ring);

  return {
    root,
    tick: (t, still) => {
      if (still) return;
      ring.rotation.z = t * 0.5;
      root.rotation.y = Math.sin(t * 0.5) * 0.35;
    },
  };
}
