"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import type { SetupVariantProps } from "../../types";
import { buildSendingDomains, buildMailboxes, type Mailbox } from "../../../lib/domains";

/**
 * 3D / WebGL build — the infrastructure is CONSTRUCTED in real space, not
 * revealed. A single clock drives every transform as a pure function of elapsed
 * time `t`: meshes interpolate from a SOURCE (their emitter) to a DESTINATION
 * (their formation slot). The primary domain flies in, the seven sending domains
 * physically travel OUT of it into a receding arc, each domain ejects three
 * mailboxes, authentication seals fly in and stamp, and redirect beams grow back
 * to the primary. Replay just resets the clock; reduced-motion pins t to the end.
 */

const MINT = "#7cf5d0";
const VIOLET = "#7c5cff";
const DNS = ["SPF", "DKIM", "DMARC"] as const;

// ---- Phase timeline (seconds). Everything is gated against these. ----
const T = {
  primaryIn: [0.2, 1.3],
  beamsGrow: [1.5, 2.4],
  domainsOut: [1.6, 3.2],
  mailboxesOut: [3.3, 5.0],
  counter: [3.3, 5.0],
  sealsIn: [5.2, 6.4],
  checks: [6.0, 7.0],
  redirect: [6.9, 8.0],
  live: [7.9, 8.8],
  end: 9.0,
} as const;

type TRef = React.MutableRefObject<number>;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// progress of a phase window at time t
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// ---------------------------------------------------------------------------
// Canvas-texture label helpers (offline-safe; no font/network dependency).
// ---------------------------------------------------------------------------
type LabelOpts = {
  text: string;
  sub?: string;
  font?: number;
  subFont?: number;
  color?: string;
  subColor?: string;
  bg?: string;
  border?: string;
  align?: "left" | "center";
  padX?: number;
};

function makeLabelTexture(o: LabelOpts): { texture: THREE.CanvasTexture; aspect: number } {
  const dpr = 2;
  const font = o.font ?? 44;
  const subFont = o.subFont ?? 26;
  const padX = (o.padX ?? 36) * dpr;
  const padY = 26 * dpr;
  const gap = o.sub ? 12 * dpr : 0;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `600 ${font * dpr}px ui-monospace, "SF Mono", Menlo, monospace`;
  const w1 = measure.measureText(o.text).width;
  let w2 = 0;
  if (o.sub) {
    measure.font = `500 ${subFont * dpr}px ui-monospace, Menlo, monospace`;
    w2 = measure.measureText(o.sub).width;
  }
  const contentW = Math.max(w1, w2);
  const lineH = font * dpr * 1.05;
  const subH = o.sub ? subFont * dpr * 1.1 : 0;

  const cw = Math.ceil(contentW + padX * 2);
  const ch = Math.ceil(lineH + gap + subH + padY * 2);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  const radius = 22 * dpr;
  if (o.bg || o.border) {
    roundRect(ctx, 0.5 * dpr, 0.5 * dpr, cw - dpr, ch - dpr, radius);
    if (o.bg) {
      ctx.fillStyle = o.bg;
      ctx.fill();
    }
    if (o.border) {
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = o.border;
      ctx.stroke();
    }
  }

  const align = o.align ?? "center";
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  const x = align === "center" ? cw / 2 : padX;

  ctx.font = `600 ${font * dpr}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.fillStyle = o.color ?? "#ffffff";
  ctx.fillText(o.text, x, padY);

  if (o.sub) {
    ctx.font = `500 ${subFont * dpr}px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = o.subColor ?? "rgba(124,245,208,0.75)";
    ctx.fillText(o.sub.toUpperCase(), x, padY + lineH + gap);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, aspect: cw / ch };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A flat label plane that always faces the camera, sized from texture aspect. */
function Label({
  height,
  position,
  opts,
  renderOrder = 10,
}: {
  height: number;
  position?: [number, number, number];
  opts: LabelOpts;
  renderOrder?: number;
}) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(opts), [
    opts.text,
    opts.sub,
    opts.bg,
    opts.border,
    opts.color,
    opts.align,
    opts.font,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} renderOrder={renderOrder}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Provider logo textures (gmail / outlook / zapmail) with correct colorSpace.
// ---------------------------------------------------------------------------
function useLogo(path: string): THREE.Texture {
  const tex = useLoader(THREE.TextureLoader, path);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }, [tex]);
  return tex;
}

function LogoPlane({
  texture,
  size,
  position,
  renderOrder = 11,
}: {
  texture: THREE.Texture;
  size: number;
  position?: [number, number, number];
  renderOrder?: number;
}) {
  return (
    <mesh position={position} renderOrder={renderOrder}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// Soft additive glow sprite (stand-in for bloom, which isn't installed).
function GlowSprite({
  color,
  scale,
  position,
  opacity = 1,
}: {
  color: string;
  scale: number;
  position?: [number, number, number];
  opacity?: number;
}) {
  const texture = useMemo(() => {
    const s = 128;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[scale, scale, scale]}>
      <spriteMaterial
        map={texture}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </sprite>
  );
}

// ---------------------------------------------------------------------------
// Geometry of the build — positions computed once.
// ---------------------------------------------------------------------------
const PRIMARY_POS = new THREE.Vector3(-6.2, 0, 0);

function useLayout(slug: string) {
  return useMemo(() => {
    const domains = buildSendingDomains(slug);
    const mailboxes = buildMailboxes(domains, 3);
    // Seven domains fan out into a receding arc to the right of the primary.
    const n = domains.length;
    const domainPos = domains.map((_, i) => {
      const f = n > 1 ? i / (n - 1) : 0.5; // 0..1
      const angle = (f - 0.5) * 1.05; // arc spread (radians)
      const radius = 6.6;
      const x = 0.4 + Math.cos(angle) * radius * 0.55;
      const y = (0.5 - f) * 6.4; // top -> bottom column-ish
      const z = -Math.abs(f - 0.5) * 5.2 - 0.6; // ends recede into depth
      return new THREE.Vector3(x, y, z);
    });
    return { domains, mailboxes, domainPos };
  }, [slug]);
}

// ---------------------------------------------------------------------------
// Mailbox — a small card that travels out of its parent domain.
// ---------------------------------------------------------------------------
function MailboxCard({
  source,
  dest,
  logo,
  initials,
  hue,
  startT,
  tRef,
}: {
  source: THREE.Vector3;
  dest: THREE.Vector3;
  logo: THREE.Texture;
  initials: string;
  hue: number;
  startT: number;
  tRef: TRef;
}) {
  const ref = useRef<THREE.Group>(null);
  const initialsTex = useMemo(() => {
    const s = 96;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createConicGradient ? ctx.createConicGradient((hue * Math.PI) / 180, s / 2, s / 2) : null;
    if (g) {
      g.addColorStop(0, MINT);
      g.addColorStop(0.5, VIOLET);
      g.addColorStop(1, MINT);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = MINT;
    }
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a0c10";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `600 34px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, s / 2, s / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [hue, initials]);
  useEffect(() => () => initialsTex.dispose(), [initialsTex]);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = tRef.current;
    const local = seg(t, startT, startT + 0.55);
    const e = easeOutBack(local);
    g.position.lerpVectors(source, dest, easeOutCubic(clamp01(local * 1.2)));
    const sc = 0.001 + e * 1.0;
    g.scale.setScalar(Math.max(0.001, sc));
    g.visible = local > 0.001;
  });

  return (
    <group ref={ref} scale={0.001}>
      <RoundedBox args={[0.92, 0.62, 0.1]} radius={0.07} smoothness={3}>
        <meshStandardMaterial
          color="#0c0f15"
          emissive={VIOLET}
          emissiveIntensity={0.12}
          roughness={0.55}
          metalness={0.2}
        />
      </RoundedBox>
      {/* initials puck */}
      <mesh position={[-0.26, 0, 0.06]} renderOrder={12}>
        <circleGeometry args={[0.18, 32]} />
        <meshBasicMaterial map={initialsTex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* provider logo */}
      <LogoPlane texture={logo} size={0.26} position={[0.22, 0, 0.06]} renderOrder={12} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Authentication seal — a hex prism that flies in from off-camera and stamps.
// ---------------------------------------------------------------------------
function Seal({
  label,
  dest,
  startT,
  tRef,
}: {
  label: string;
  dest: THREE.Vector3;
  startT: number;
  tRef: TRef;
}) {
  const ref = useRef<THREE.Group>(null);
  const source = useMemo(() => new THREE.Vector3(dest.x + 5.5, dest.y + 2.4, 5.5), [dest]);
  const { texture, aspect } = useMemo(
    () =>
      makeLabelTexture({
        text: label,
        font: 40,
        color: VIOLET,
        bg: "rgba(124,92,255,0.10)",
        border: "rgba(124,92,255,0.55)",
        padX: 30,
      }),
    [label]
  );
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = tRef.current;
    const fly = seg(t, startT, startT + 0.45);
    g.position.lerpVectors(source, dest, easeOutCubic(fly));
    // stamp: quick over-shoot punch in Z right as it lands
    const stamp = seg(t, startT + 0.4, startT + 0.6);
    const punch = stamp > 0 && stamp < 1 ? Math.sin(stamp * Math.PI) * 0.5 : 0;
    g.position.z = dest.z + punch;
    const appear = clamp01(fly * 1.4);
    g.scale.setScalar(0.001 + appear);
    g.visible = fly > 0.001;
  });

  return (
    <group ref={ref} scale={0.001}>
      <mesh renderOrder={14}>
        <planeGeometry args={[0.78 * aspect, 0.78]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Beam — a tube that GROWS from a source point to a destination point.
// (feed: primary -> domain; redirect: domain -> primary, dashed-violet feel)
// ---------------------------------------------------------------------------
function Beam({
  from,
  to,
  color,
  startT,
  tRef,
  bow = 0.0,
  radius = 0.03,
  opacity = 0.85,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  startT: number;
  tRef: TRef;
  bow?: number;
  radius?: number;
  opacity?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += bow;
    mid.z += bow * 0.4;
    return new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
  }, [from, to, bow]);
  const geom = useMemo(() => new THREE.TubeGeometry(curve, 40, radius, 8, false), [curve, radius]);
  useEffect(() => () => geom.dispose(), [geom]);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const grow = easeInOut(seg(tRef.current, startT, startT + 0.7));
    // reveal the tube progressively by drawing only a leading fraction
    const count = geom.index ? geom.index.count : geom.attributes.position.count;
    geom.setDrawRange(0, Math.ceil(count * grow));
    m.visible = grow > 0.001;
  });

  return (
    <mesh ref={ref} geometry={geom} renderOrder={5}>
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Domain node — a rounded slab that travels OUT of the primary into formation,
// carries its label + provider logo, gets a check-ring, and spawns 3 mailboxes.
// ---------------------------------------------------------------------------
function DomainNode({
  domain,
  dest,
  providerTex,
  mailboxes,
  startT,
  mailboxStartT,
  checkStartT,
  tRef,
}: {
  domain: string;
  dest: THREE.Vector3;
  providerTex: THREE.Texture;
  mailboxes: Mailbox[];
  startT: number;
  mailboxStartT: number;
  checkStartT: number;
  tRef: TRef;
}) {
  const ref = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const labelOpts = useMemo<LabelOpts>(
    () => ({
      text: domain,
      font: 40,
      color: "#eef3fb",
      align: "left",
      padX: 4,
    }),
    [domain]
  );

  // mailbox destinations are LOCAL to the (moving) domain group: a row to the
  // right of the slab. The slab spans x∈[-1.7,1.7], so start past its edge.
  const mbDest = useMemo(
    () => mailboxes.map((_, i) => new THREE.Vector3(2.0 + i * 1.02, 0, 0.02)),
    [mailboxes]
  );
  // mailboxes emerge from the domain's own center (local origin) and travel out.
  const mbSource = useMemo(() => new THREE.Vector3(0, 0, 0.12), []);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = tRef.current;
    const local = seg(t, startT, startT + 0.85);
    const e = easeOutCubic(local);
    g.position.lerpVectors(PRIMARY_POS, dest, e);
    const sc = 0.12 + e * 0.88;
    g.scale.setScalar(sc);
    g.visible = local > 0.001;

    // check ring grows in on cue
    if (ringRef.current) {
      const c = easeOutBack(seg(t, checkStartT, checkStartT + 0.4));
      ringRef.current.scale.setScalar(Math.max(0.001, c));
      ringRef.current.visible = c > 0.01;
    }
    if (matRef.current) {
      const lit = seg(t, checkStartT, checkStartT + 0.5);
      matRef.current.emissiveIntensity = 0.1 + lit * 0.35;
    }
  });

  return (
    <group ref={ref}>
      {/* slab */}
      <RoundedBox args={[3.4, 0.92, 0.16]} radius={0.1} smoothness={3}>
        <meshStandardMaterial
          ref={matRef}
          color="#0b0e14"
          emissive={MINT}
          emissiveIntensity={0.1}
          roughness={0.5}
          metalness={0.25}
        />
      </RoundedBox>
      {/* provider logo */}
      <LogoPlane texture={providerTex} size={0.5} position={[-1.32, 0, 0.1]} renderOrder={12} />
      {/* domain text */}
      <Label height={0.34} position={[0.32, 0, 0.1]} opts={labelOpts} renderOrder={12} />
      {/* check ring + tick */}
      <group ref={ringRef} position={[-1.32, 0, 0.13]} scale={0.001}>
        <mesh>
          <ringGeometry args={[0.28, 0.34, 40]} />
          <meshBasicMaterial color={MINT} transparent opacity={0.95} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh position={[0.32, 0.3, 0]}>
          <circleGeometry args={[0.12, 24]} />
          <meshBasicMaterial color={MINT} toneMapped={false} depthWrite={false} />
        </mesh>
        <Label height={0.14} position={[0.32, 0.3, 0.01]} opts={{ text: "✓", font: 40, color: "#08110d", padX: 2 }} renderOrder={13} />
      </group>
      {/* small accent glow behind logo */}
      <GlowSprite color={MINT} scale={1.3} position={[-1.32, 0, -0.1]} opacity={0.18} />

      {/* mailboxes spawn from this domain — all coords LOCAL to this group, which
          has already settled to scale 1 by the time they emerge. */}
      {mailboxes.map((m, i) => (
        <MailboxCard
          key={m.handle}
          source={mbSource}
          dest={mbDest[i]}
          logo={providerTex}
          initials={m.name.split(" ").map((w) => w[0]).join("")}
          hue={m.hue}
          startT={mailboxStartT + i * 0.12}
          tRef={tRef}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Primary domain node — flies in from the left, pulses, anchors everything.
// ---------------------------------------------------------------------------
function PrimaryNode({
  mainDomain,
  zapmailTex,
  tRef,
  reduced,
}: {
  mainDomain: string;
  zapmailTex: THREE.Texture;
  tRef: TRef;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const source = useMemo(() => PRIMARY_POS.clone().add(new THREE.Vector3(-4, 0, 2)), []);
  const glowTex = useGlowTex();

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = tRef.current;
    const local = seg(t, T.primaryIn[0], T.primaryIn[1]);
    const e = easeOutBack(local);
    g.position.lerpVectors(source, PRIMARY_POS, easeOutCubic(local));
    g.scale.setScalar(0.2 + e * 0.8);
    g.visible = local > 0.001;
    // gentle living pulse once arrived. Zeroed under reduced motion so the glow
    // does not oscillate forever while t is frozen.
    const amp = reduced ? 0 : 0.03;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.6) * amp * clamp01((t - 1.3) * 2);
    if (glowRef.current) {
      (glowRef.current.material as THREE.SpriteMaterial).opacity = 0.32 * pulse;
    }
  });

  return (
    <group ref={ref} position={source.toArray()}>
      <RoundedBox args={[2.4, 1.4, 0.28]} radius={0.16} smoothness={4}>
        <meshStandardMaterial color="#08130f" emissive={MINT} emissiveIntensity={0.6} roughness={0.35} metalness={0.3} />
      </RoundedBox>
      {/* dot */}
      <mesh position={[-0.78, 0.34, 0.16]}>
        <circleGeometry args={[0.1, 24]} />
        <meshBasicMaterial color={MINT} toneMapped={false} />
      </mesh>
      <Label
        height={0.5}
        position={[0.12, 0.18, 0.16]}
        opts={{ text: mainDomain, sub: "primary domain", font: 46, subFont: 24, color: "#ffffff", subColor: "rgba(124,245,208,0.8)", padX: 4, align: "left" }}
        renderOrder={12}
      />
      {/* provisioned via Zapmail tag */}
      <group position={[0, -0.95, 0.16]}>
        <LogoPlane texture={zapmailTex} size={0.3} position={[-0.86, 0, 0.01]} renderOrder={12} />
        <Label height={0.2} position={[0.18, 0, 0.01]} opts={{ text: "provisioned via Zapmail", font: 28, color: "rgba(231,236,243,0.8)", padX: 4, align: "left" }} renderOrder={12} />
      </group>
      <sprite ref={glowRef} scale={[5.2, 5.2, 5.2]} position={[0, 0, -0.3]}>
        <spriteMaterial map={glowTex} color={MINT} transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}

// shared glow texture (memo per component instance is fine, but reuse helper)
function useGlowTex() {
  return useMemo(() => {
    const s = 128;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d")!;
    const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.3, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }, []);
}

// ---------------------------------------------------------------------------
// Camera rig — a slow cinematic dolly synced to the build (frozen if reduced).
// ---------------------------------------------------------------------------
function CameraRig({ tRef, reduced, tEnd }: { tRef: TRef; reduced: boolean; tEnd: number }) {
  const { camera } = useThree();
  useFrame(() => {
    const tt = reduced ? tEnd : tRef.current;
    const p = clamp01(tt / tEnd);
    // start framed on the primary (left), dolly right + pull back to reveal the
    // full formation, then a gentle settle.
    const startX = -5.6;
    const endX = 1.2;
    const x = startX + (endX - startX) * easeInOut(clamp01(p * 1.05));
    const z = 9.5 + Math.sin(p * Math.PI) * 2.2; // dip in then back out
    const y = 0.4 + Math.sin(p * Math.PI) * 0.6;
    camera.position.set(x, y, z);
    const lookX = -5.6 + (0.6 - -5.6) * easeInOut(clamp01(p * 1.1));
    camera.lookAt(lookX, 0, -1.2);
  });
  return null;
}

// ---------------------------------------------------------------------------
// The full 3D scene. A single `tRef` (mutated each frame) is the source of
// truth; every child reads it inside its own useFrame. The scene itself renders
// only once — no per-frame React state churn, so Vector3/geometry allocations
// stay stable and the 14 tubes are built once, not rebuilt every frame.
// ---------------------------------------------------------------------------
function Scene({
  slug,
  mainDomain,
  reduced,
  startRef,
  onTick,
}: {
  slug: string;
  mainDomain: string;
  reduced: boolean;
  startRef: React.MutableRefObject<number>;
  onTick: (t: number) => void;
}) {
  const { domains, mailboxes, domainPos } = useLayout(slug);
  const tRef = useRef(reduced ? T.end : 0);

  const gmail = useLogo("/logos/gmail.png");
  const outlook = useLogo("/logos/outlook.png");
  const zapmail = useLogo("/logos/zapmail.png");
  const providerTexOf = (i: number) => (i === 3 ? outlook : gmail);

  useFrame((state) => {
    if (reduced) {
      tRef.current = T.end;
      onTick(T.end);
      return;
    }
    const elapsed = state.clock.elapsedTime - startRef.current;
    tRef.current = elapsed;
    // onTick is value-guarded inside the parent (only ~21 counter + 1 live
    // transitions actually setState), so calling it every frame is cheap.
    onTick(elapsed);
  });

  // seal destinations: stamp onto the first three domains' logo corners
  const sealDest = useMemo(
    () => domainPos.slice(0, 3).map((p) => p.clone().add(new THREE.Vector3(-1.32, 0.62, 0.25))),
    [domainPos]
  );

  return (
    <>
      <color attach="background" args={["#050608"]} />
      <fog attach="fog" args={["#050608", 10, 26]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 8]} intensity={0.8} color="#cfe9ff" />
      <pointLight position={[-6, 0, 4]} intensity={2.2} color={MINT} distance={18} />
      <pointLight position={[4, -2, 2]} intensity={1.1} color={VIOLET} distance={16} />

      {/* primary */}
      <PrimaryNode mainDomain={mainDomain} zapmailTex={zapmail} tRef={tRef} reduced={reduced} />

      {/* feed beams: primary -> each domain (grow from the source end) */}
      {domainPos.map((dp, i) => (
        <Beam
          key={`feed-${i}`}
          from={PRIMARY_POS.clone().add(new THREE.Vector3(1.2, 0, 0))}
          to={dp.clone().add(new THREE.Vector3(-1.7, 0, 0))}
          color={MINT}
          startT={T.beamsGrow[0] + i * 0.08}
          tRef={tRef}
          bow={0.5}
          radius={0.028}
          opacity={0.8}
        />
      ))}

      {/* the seven sending domains travel out of the primary */}
      {domainPos.map((dp, i) => (
        <DomainNode
          key={domains[i]}
          domain={domains[i]}
          dest={dp}
          providerTex={providerTexOf(i)}
          mailboxes={mailboxes.slice(i * 3, i * 3 + 3)}
          startT={T.domainsOut[0] + i * 0.16}
          mailboxStartT={T.mailboxesOut[0] + i * 0.12}
          checkStartT={T.checks[0] + i * 0.1}
          tRef={tRef}
        />
      ))}

      {/* authentication seals fly in and stamp */}
      {DNS.map((rec, i) => (
        <Seal key={rec} label={rec} dest={sealDest[i]} startT={T.sealsIn[0] + i * 0.18} tRef={tRef} />
      ))}

      {/* redirect beams: each sending domain -> back to primary */}
      {domainPos.map((dp, i) => (
        <Beam
          key={`redirect-${i}`}
          from={dp.clone().add(new THREE.Vector3(0, -0.55, 0))}
          to={PRIMARY_POS.clone().add(new THREE.Vector3(0.2, -0.7, 0))}
          color={VIOLET}
          startT={T.redirect[0] + i * 0.07}
          tRef={tRef}
          bow={-1.6}
          radius={0.02}
          opacity={0.6}
        />
      ))}

      <CameraRig tRef={tRef} reduced={reduced} tEnd={T.end} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Top-level component: Canvas + DOM HUD overlay + Replay.
// ---------------------------------------------------------------------------
export default function WebglSetup({ businessName, slug, mainDomain }: SetupVariantProps) {
  const reduced = !!useReducedMotion();
  const startRef = useRef(0);
  const clockBaseRef = useRef<number | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [counter, setCounter] = useState(reduced ? 21 : 0);
  const [live, setLive] = useState(reduced);

  // On (re)mount / replay, capture the clock origin once it's available.
  const onTick = (t: number) => {
    const total = 21;
    const c = Math.round(easeOutCubic(seg(t, T.counter[0], T.counter[1])) * total);
    setCounter((prev) => (prev !== c ? c : prev));
    const isLive = t >= T.live[0];
    setLive((prev) => (prev !== isLive ? isLive : prev));
  };

  const replay = () => {
    setCounter(0);
    setLive(false);
    setReplayKey((n) => n + 1);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      {/* ambient backdrop to match the cinematic look */}
      <div className="absolute inset-0 bg-grid-fine opacity-10" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 26% 50%, rgba(124,245,208,0.10), transparent 60%)" }}
      />

      <Canvas
        key={replayKey}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [-5.6, 0.4, 9.5], fov: 42, near: 0.1, far: 100 }}
        onCreated={({ clock }) => {
          clock.start();
          startRef.current = clock.elapsedTime;
          clockBaseRef.current = clock.elapsedTime;
        }}
      >
        <Suspense fallback={null}>
          <ResetClock startRef={startRef} />
          <Scene slug={slug} mainDomain={mainDomain} reduced={reduced} startRef={startRef} onTick={onTick} />
        </Suspense>
      </Canvas>

      {/* ---- DOM HUD overlay (siblings over the canvas) ---- */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute top-12 left-12 max-w-[320px]">
          <div className="chip mb-4">
            <span className="dot" /> Step 01 · Setup · ~1 day
          </div>
          <h2 className="font-display text-[30px] md:text-[40px] leading-[0.97] tracking-[-0.02em]">
            <span className="block text-gradient">We build {businessName}&apos;s</span>
            <span className="block text-gradient-accent">sending infrastructure.</span>
          </h2>
          <div className="mt-5 flex items-end gap-2">
            <span className="font-display text-[44px] leading-none text-white tabular-nums">{counter}</span>
            <span className="pb-1.5 text-[11px] font-mono text-white/45">
              mailboxes
              <br />7 domains × 3
            </span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 chip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/zapmail.png"
              alt=""
              width={14}
              height={14}
              style={{ width: 14, height: 14 }}
              className="object-contain"
            />
            provisioned via Zapmail
          </div>
          <div
            className="mt-4 text-[10px] font-mono uppercase tracking-[0.2em] text-accent/80 transition-opacity duration-500"
            style={{ opacity: live ? 1 : 0 }}
          >
            ✓ all domains live &amp; redirecting
          </div>
        </div>

        {/* auth header (the 3D seals carry the actual SPF/DKIM/DMARC) */}
        <div className="absolute top-12 right-12 flex flex-col items-end gap-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">Authentication</div>
          <div className="flex gap-2">
            {DNS.map((rec) => (
              <span
                key={rec}
                className="inline-flex items-center gap-1.5 rounded-md border border-violet-glow/45 bg-violet-glow/10 px-2.5 py-1.5 text-[11px] font-mono text-violet-glow transition-opacity duration-500"
                style={{ opacity: live ? 1 : 0.4 }}
              >
                <span className="text-accent">✓</span>
                {rec}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ReplayBtn onClick={replay} />
    </div>
  );
}

/** Resets the shared clock origin to "now" whenever the Canvas subtree mounts. */
function ResetClock({ startRef }: { startRef: React.MutableRefObject<number> }) {
  const { clock } = useThree();
  useEffect(() => {
    startRef.current = clock.elapsedTime;
  }, [clock, startRef]);
  return null;
}

function ReplayBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 transition hover:text-accent cursor-pointer"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Replay
    </button>
  );
}
