import { useMemo } from 'react';

const COLORS = [
  "#FF6B6B", "#FFB347", "#FFD700", "#55C78E", "#4ECDC4",
  "#A78BFA", "#F472B6", "#60A5FA", "#FBBF24", "#34D399",
];

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  opacity: number;
  shape: 'rect' | 'circle' | 'triangle';
  size: number;
  width?: number;
  height?: number;
}

function generatePieces(count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    const shape = (['rect', 'circle', 'triangle'] as const)[Math.floor(Math.random() * 3)];
    pieces.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      opacity: 0.4 + Math.random() * 0.4,
      shape,
      size: 6 + Math.random() * 10,
      width: 6 + Math.random() * 12,
      height: 3 + Math.random() * 6,
    });
  }
  return pieces;
}

export function ConfettiBackground({ count = 80 }: { count?: number }) {
  const pieces = useMemo(() => generatePieces(count), [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((p) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${p.x}%`,
          top: `${p.y}%`,
          opacity: p.opacity,
          transform: `rotate(${p.rotation}deg)`,
        };

        if (p.shape === 'rect') {
          return (
            <div
              key={p.id}
              style={{
                ...style,
                width: p.width,
                height: p.height,
                backgroundColor: p.color,
                borderRadius: 1,
              }}
            />
          );
        }

        if (p.shape === 'circle') {
          return (
            <div
              key={p.id}
              style={{
                ...style,
                width: p.size * 0.7,
                height: p.size * 0.7,
                backgroundColor: p.color,
                borderRadius: '50%',
              }}
            />
          );
        }

        // triangle via CSS
        const sz = p.size;
        return (
          <div
            key={p.id}
            style={{
              ...style,
              width: 0,
              height: 0,
              borderLeft: `${sz * 0.5}px solid transparent`,
              borderRight: `${sz * 0.5}px solid transparent`,
              borderBottom: `${sz}px solid ${p.color}`,
            }}
          />
        );
      })}
    </div>
  );
}
