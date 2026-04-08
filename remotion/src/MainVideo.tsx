import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/BungeeShade";

const { fontFamily } = loadFont("normal", { weights: ["400"], subsets: ["latin"] });

const COLORS = [
  "#FF6B6B", "#FFB347", "#FFD700", "#55C78E", "#4ECDC4",
  "#A78BFA", "#F472B6", "#60A5FA", "#FBBF24", "#34D399",
];

interface ConfettiPiece {
  x: number;
  color: string;
  shape: "rect" | "circle" | "triangle";
  width: number;
  height: number;
  size: number;
  speed: number;
  drift: number;
  rotSpeed: number;
  startRot: number;
  delay: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generatePieces(count: number): ConfettiPiece[] {
  const rand = seededRandom(42);
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    const shapes = ["rect", "circle", "triangle"] as const;
    pieces.push({
      x: rand() * 100,
      color: COLORS[Math.floor(rand() * COLORS.length)],
      shape: shapes[Math.floor(rand() * 3)],
      width: 6 + rand() * 12,
      height: 4 + rand() * 6,
      size: 6 + rand() * 10,
      speed: 60 + rand() * 120,
      drift: (rand() - 0.5) * 40,
      rotSpeed: 100 + rand() * 300,
      startRot: rand() * 360,
      delay: rand() * 80,
    });
  }
  return pieces;
}

const PIECES = generatePieces(100);

export const MainVideo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Wordmark spring animation
  const wordmarkScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 }, delay: 10 });
  const wordmarkOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Subtitle
  const subOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subY = interpolate(frame, [30, 50], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      {/* Confetti */}
      {PIECES.map((p, i) => {
        const t = Math.max(0, frame - p.delay) / fps;
        const y = -20 + p.speed * t;
        const xOff = Math.sin(t * 2) * p.drift;
        const rot = p.startRot + p.rotSpeed * t;
        const opacity = interpolate(frame, [p.delay, p.delay + 15], [0, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

        if (y > 850) return null;

        const style: React.CSSProperties = {
          position: "absolute",
          left: `${p.x}%`,
          top: y,
          transform: `translateX(${xOff}px) rotate(${rot}deg)`,
          opacity,
        };

        if (p.shape === "rect") {
          return <div key={i} style={{ ...style, width: p.width, height: p.height, backgroundColor: p.color, borderRadius: 1 }} />;
        }
        if (p.shape === "circle") {
          return <div key={i} style={{ ...style, width: p.size * 0.6, height: p.size * 0.6, backgroundColor: p.color, borderRadius: "50%" }} />;
        }
        // triangle
        return (
          <div key={i} style={{
            ...style,
            width: 0, height: 0,
            borderLeft: `${p.size * 0.5}px solid transparent`,
            borderRight: `${p.size * 0.5}px solid transparent`,
            borderBottom: `${p.size}px solid ${p.color}`,
          }} />
        );
      })}

      {/* Wordmark */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
      }}>
        <div style={{
          fontFamily,
          fontSize: 96,
          color: "#55C78E",
          letterSpacing: 4,
          transform: `scale(${wordmarkScale})`,
          opacity: wordmarkOpacity,
          textShadow: "0 4px 30px rgba(85,199,142,0.3)",
        }}>
          parade
        </div>
        <div style={{
          fontFamily: "'sans-serif'",
          fontSize: 16,
          color: "#55C78E",
          letterSpacing: 6,
          textTransform: "uppercase" as const,
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
          marginTop: 8,
          fontWeight: 600,
        }}>
          Designed for Fun
        </div>
      </div>
    </AbsoluteFill>
  );
};
