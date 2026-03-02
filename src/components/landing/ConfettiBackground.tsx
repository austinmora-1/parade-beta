import { useMemo } from 'react';
import { motion } from 'framer-motion';

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
  width: number;
  height: number;
  duration: number;
  delay: number;
  drift: number;
  rotationEnd: number;
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
      opacity: 0.15 + Math.random() * 0.2,
      shape,
      size: 5 + Math.random() * 8,
      width: 5 + Math.random() * 10,
      height: 3 + Math.random() * 5,
      duration: 8 + Math.random() * 12,
      delay: -(Math.random() * 20),
      drift: (Math.random() - 0.5) * 30,
      rotationEnd: Math.random() * 720 - 360,
    });
  }
  return pieces;
}

export function ConfettiBackground({ count = 80 }: { count?: number }) {
  const pieces = useMemo(() => generatePieces(count), [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((p) => {
        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          left: `${p.x}%`,
          willChange: 'transform',
        };

        const animateProps = {
          y: ['-10vh', '110vh'],
          x: [0, p.drift],
          rotate: [p.rotation, p.rotation + p.rotationEnd],
          opacity: [p.opacity, p.opacity * 0.6],
        };

        const transition = {
          duration: p.duration,
          delay: p.delay,
          repeat: Infinity,
          ease: 'linear' as const,
        };

        if (p.shape === 'rect') {
          return (
            <motion.div
              key={p.id}
              style={{
                ...baseStyle,
                width: p.width,
                height: p.height,
                backgroundColor: p.color,
                borderRadius: 1,
              }}
              animate={animateProps}
              transition={transition}
            />
          );
        }

        if (p.shape === 'circle') {
          return (
            <motion.div
              key={p.id}
              style={{
                ...baseStyle,
                width: p.size * 0.6,
                height: p.size * 0.6,
                backgroundColor: p.color,
                borderRadius: '50%',
              }}
              animate={animateProps}
              transition={transition}
            />
          );
        }

        const sz = p.size;
        return (
          <motion.div
            key={p.id}
            style={{
              ...baseStyle,
              width: 0,
              height: 0,
              borderLeft: `${sz * 0.5}px solid transparent`,
              borderRight: `${sz * 0.5}px solid transparent`,
              borderBottom: `${sz}px solid ${p.color}`,
            }}
            animate={animateProps}
            transition={transition}
          />
        );
      })}
    </div>
  );
}
