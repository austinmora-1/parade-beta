import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = [
  'hsl(var(--primary))',
  '#FF6B5B',
  '#FFAD9E',
  '#FFE156',
  '#A8E6CF',
  '#9DD4F0',
  '#72C4A2',
];

interface Piece {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  shape: 'rect' | 'circle';
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  rotation: number;
  opacity: number;
}

function generate(count: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    pieces.push({
      id: i,
      x: side * (8 + Math.random() * 6),
      y: (Math.random() - 0.5) * 10,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 2 + Math.random() * 3,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      duration: 3 + Math.random() * 4,
      delay: -(Math.random() * 7),
      driftX: side * (10 + Math.random() * 14),
      driftY: (Math.random() - 0.5) * 20,
      rotation: Math.random() * 360,
      opacity: 0.35 + Math.random() * 0.3,
    });
  }
  return pieces;
}

export function MiniConfetti({ count = 16 }: { count?: number }) {
  const pieces = useMemo(() => generate(count), [count]);

  return (
    <div className="absolute inset-0 overflow-visible pointer-events-none" aria-hidden="true">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: p.shape === 'circle' ? p.size : p.size * 1.5,
            height: p.shape === 'circle' ? p.size : p.size * 0.8,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : 1,
            willChange: 'transform',
          }}
          animate={{
            x: [p.x, p.x + p.driftX, p.x],
            y: [p.y, p.y + p.driftY, p.y],
            rotate: [0, p.rotation, 0],
            opacity: [p.opacity, p.opacity * 0.4, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
