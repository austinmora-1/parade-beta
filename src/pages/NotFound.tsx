import { useLocation, Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const ELEPHANT_EMOJIS = ["🐘", "🎪", "🎠", "🎡", "🎈", "🎉", "🥜"];

function FloatingParticle({ index }: { index: number }) {
  const config = useMemo(() => ({
    x: Math.random() * 100,
    emoji: ELEPHANT_EMOJIS[index % ELEPHANT_EMOJIS.length],
    size: 16 + Math.random() * 20,
    duration: 6 + Math.random() * 8,
    delay: -(Math.random() * 10),
    drift: (Math.random() - 0.5) * 60,
  }), [index]);

  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ left: `${config.x}%`, fontSize: config.size }}
      animate={{
        y: ['-10vh', '110vh'],
        x: [0, config.drift],
        rotate: [0, 360],
        opacity: [0.6, 0],
      }}
      transition={{
        duration: config.duration,
        delay: config.delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {config.emoji}
    </motion.div>
  );
}

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background overflow-hidden relative">
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <FloatingParticle key={i} index={i} />
        ))}
      </div>

      <div className="text-center relative z-10 px-6">
        {/* Animated 404 number */}
        <motion.div
          className="relative mb-6"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        >
          <h1 className="text-[8rem] sm:text-[10rem] font-display font-bold leading-none tracking-tight text-primary/15 select-none">
            404
          </h1>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="text-7xl sm:text-8xl">🐘</span>
          </motion.div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            This elephant wandered off!
          </h2>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            The page at <span className="font-mono text-sm text-primary">{location.pathname}</span> doesn't exist. Let's get you back to the parade.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
        >
          <Button asChild size="lg" className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Back to Parade
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
