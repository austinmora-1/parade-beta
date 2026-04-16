import { motion } from 'framer-motion';
import { useMemo } from 'react';

const CONFETTI_COLORS = [
  'hsl(var(--primary))',
  '#FF6B5B', '#FFAD9E', '#FFE156', '#A8E6CF', '#9DD4F0',
  '#72C4A2', '#F472B6', '#60A5FA', '#FBBF24',
];

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  shape: 'circle' | 'rect';
}

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      angle: -60 + Math.random() * 120, // spray upward from trunk
      distance: 30 + Math.random() * 60,
      size: 3 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      duration: 0.8 + Math.random() * 0.6,
      delay: Math.random() * 1.2,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    });
  }
  return particles;
}

export function ElephantLoader({ className = '' }: { className?: string }) {
  const particles = useMemo(() => generateParticles(18), []);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative w-24 h-24">
        {/* Confetti particles from trunk tip area */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 96 96">
          {particles.map((p) => {
            const rad = (p.angle - 90) * (Math.PI / 180);
            const originX = 68; // trunk tip area
            const originY = 28;
            const endX = originX + Math.cos(rad) * p.distance;
            const endY = originY + Math.sin(rad) * p.distance;

            return (
              <motion.g key={p.id}>
                {p.shape === 'circle' ? (
                  <motion.circle
                    cx={originX}
                    cy={originY}
                    r={p.size / 2}
                    fill={p.color}
                    initial={{ cx: originX, cy: originY, opacity: 0, scale: 0 }}
                    animate={{
                      cx: [originX, endX],
                      cy: [originY, endY],
                      opacity: [0, 0.9, 0],
                      scale: [0, 1, 0.3],
                    }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      repeat: Infinity,
                      repeatDelay: 1.4 - p.delay,
                      ease: 'easeOut',
                    }}
                  />
                ) : (
                  <motion.rect
                    x={originX - p.size / 2}
                    y={originY - p.size / 3}
                    width={p.size}
                    height={p.size * 0.6}
                    rx={1}
                    fill={p.color}
                    initial={{ x: originX, y: originY, opacity: 0, scale: 0, rotate: 0 }}
                    animate={{
                      x: [originX, endX],
                      y: [originY, endY],
                      opacity: [0, 0.9, 0],
                      scale: [0, 1, 0.3],
                      rotate: [0, Math.random() * 360],
                    }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      repeat: Infinity,
                      repeatDelay: 1.4 - p.delay,
                      ease: 'easeOut',
                    }}
                  />
                )}
              </motion.g>
            );
          })}
        </svg>

        {/* Elephant SVG */}
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 96 96"
          fill="none"
          className="absolute inset-0 w-full h-full text-primary"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Body */}
          <ellipse cx="42" cy="58" rx="24" ry="18" fill="currentColor" opacity="0.15" />
          <ellipse cx="42" cy="58" rx="24" ry="18" stroke="currentColor" strokeWidth="2.5" fill="none" />

          {/* Head */}
          <circle cx="58" cy="40" r="16" fill="currentColor" opacity="0.15" />
          <circle cx="58" cy="40" r="16" stroke="currentColor" strokeWidth="2.5" fill="none" />

          {/* Ear */}
          <ellipse cx="48" cy="38" rx="8" ry="11" fill="currentColor" opacity="0.1" />
          <ellipse cx="48" cy="38" rx="8" ry="11" stroke="currentColor" strokeWidth="2" fill="none" />

          {/* Trunk - curling upward */}
          <motion.path
            d="M70 44 C76 40, 78 34, 74 28 C72 24, 68 26, 68 28"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            animate={{ d: [
              "M70 44 C76 40, 78 34, 74 28 C72 24, 68 26, 68 28",
              "M70 44 C76 40, 80 32, 76 26 C74 22, 68 24, 67 27",
              "M70 44 C76 40, 78 34, 74 28 C72 24, 68 26, 68 28",
            ]}}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Eye */}
          <circle cx="62" cy="37" r="2" fill="currentColor" />

          {/* Legs */}
          <line x1="30" y1="72" x2="30" y2="82" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line x1="40" y1="74" x2="40" y2="84" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="74" x2="50" y2="84" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line x1="58" y1="72" x2="58" y2="82" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

          {/* Tail */}
          <path d="M18 54 C14 50, 12 46, 14 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </motion.svg>
      </div>

      <motion.span
        className="text-sm text-muted-foreground font-medium"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        Loading…
      </motion.span>
    </div>
  );
}
