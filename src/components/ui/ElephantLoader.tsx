import { motion } from 'framer-motion';
import { useMemo } from 'react';

const CONFETTI_COLORS = [
  'hsl(var(--primary))',
  '#FF6B5B', '#FFAD9E', '#FFE156', '#A8E6CF', '#9DD4F0',
  '#72C4A2', '#F472B6', '#60A5FA', '#FBBF24', '#C084FC', '#34D399',
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
  spin: number;
}

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Full 360° explosion
    const angle = (360 / count) * i + (Math.random() * 20 - 10);
    particles.push({
      id: i,
      angle,
      distance: 32 + Math.random() * 24,
      size: 4 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      duration: 0.9 + Math.random() * 0.5,
      delay: Math.random() * 0.15,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
      spin: (Math.random() * 720) - 360,
    });
  }
  return particles;
}

export function ElephantLoader({ className = '' }: { className?: string }) {
  const particles = useMemo(() => generateParticles(24), []);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative w-24 h-24">
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 96 96">
          {/* Center burst pulse */}
          <motion.circle
            cx={48}
            cy={48}
            r={4}
            fill="hsl(var(--primary))"
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: [0, 2.5, 0], opacity: [0.8, 0, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />

          {particles.map((p) => {
            const rad = (p.angle - 90) * (Math.PI / 180);
            const originX = 48;
            const originY = 48;
            const endX = originX + Math.cos(rad) * p.distance;
            const endY = originY + Math.sin(rad) * p.distance;
            // gravity-ish dip
            const peakY = endY - 6;

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
                      cy: [originY, peakY, endY + 4],
                      opacity: [0, 1, 1, 0],
                      scale: [0, 1, 1, 0.4],
                    }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      repeat: Infinity,
                      repeatDelay: 0.4,
                      ease: 'easeOut',
                      times: [0, 0.2, 0.7, 1],
                    }}
                  />
                ) : (
                  <motion.rect
                    x={originX - p.size / 2}
                    y={originY - p.size / 3}
                    width={p.size}
                    height={p.size * 0.55}
                    rx={1}
                    fill={p.color}
                    initial={{ x: originX, y: originY, opacity: 0, scale: 0, rotate: 0 }}
                    animate={{
                      x: [originX, endX],
                      y: [originY, peakY, endY + 4],
                      opacity: [0, 1, 1, 0],
                      scale: [0, 1, 1, 0.4],
                      rotate: [0, p.spin],
                    }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      repeat: Infinity,
                      repeatDelay: 0.4,
                      ease: 'easeOut',
                      times: [0, 0.2, 0.7, 1],
                    }}
                  />
                )}
              </motion.g>
            );
          })}
        </svg>
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
