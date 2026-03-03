import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background overflow-hidden relative">
      <div className="text-center relative z-10 px-6">
        {/* 404 text */}
        <motion.h1
          className="text-[7rem] sm:text-[9rem] font-display font-bold leading-none tracking-tight text-primary/10 select-none mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          404
        </motion.h1>

        {/* Scene container */}
        <div className="relative h-40 w-72 sm:w-96 mx-auto mb-6">
          {/* Ground line */}
          <div className="absolute bottom-6 left-0 right-0 h-px bg-border" />

          {/* Mouse scurrying in from the left */}
          <motion.div
            className="absolute bottom-6 text-2xl select-none"
            initial={{ left: "-10%", opacity: 0 }}
            animate={{
              left: ["−10%", "38%", "42%", "40%", "42%"],
              opacity: [0, 1, 1, 1, 1],
            }}
            transition={{ duration: 2, delay: 0.5, ease: "easeOut" }}
          >
            <motion.span
              className="inline-block"
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            >
              🐭
            </motion.span>
          </motion.div>

          {/* Elephant — jumps up in fear */}
          <motion.div
            className="absolute bottom-6 right-[15%] text-6xl sm:text-7xl select-none origin-bottom"
            initial={{ y: 0, rotate: 0 }}
            animate={{
              y: [0, 0, -40, -35, -40, -38],
              rotate: [0, 0, -8, -5, -10, -6],
              scale: [1, 1, 1.1, 1.08, 1.12, 1.1],
            }}
            transition={{
              duration: 2,
              delay: 1.2,
              times: [0, 0.1, 0.35, 0.5, 0.7, 1],
              ease: "easeOut",
            }}
          >
            🐘
          </motion.div>

          {/* Sweat drops when scared */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute text-sm select-none"
              style={{ right: `${12 + i * 8}%`, bottom: '65%' }}
              initial={{ opacity: 0, y: 0 }}
              animate={{
                opacity: [0, 0, 1, 0],
                y: [0, 0, -10 - i * 8, -20 - i * 12],
                x: (i - 1) * 10,
              }}
              transition={{
                duration: 2,
                delay: 1.5 + i * 0.15,
                ease: "easeOut",
              }}
            >
              💧
            </motion.div>
          ))}

          {/* Exclamation when scared */}
          <motion.div
            className="absolute right-[8%] bottom-[75%] text-2xl font-display font-bold text-destructive select-none"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0, 1, 1], scale: [0, 0, 1.3, 1] }}
            transition={{ duration: 1.5, delay: 1.3, ease: "easeOut" }}
          >
            ❗
          </motion.div>

          {/* Tiny dust clouds at elephant's feet */}
          {[0, 1].map((i) => (
            <motion.div
              key={`dust-${i}`}
              className="absolute bottom-5 text-xs text-muted-foreground/50 select-none"
              style={{ right: `${18 + i * 12}%` }}
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 0, 0.7, 0],
                y: [0, 0, -5, -15],
                scale: [0.5, 0.5, 1, 1.5],
              }}
              transition={{ duration: 1.5, delay: 1.3 + i * 0.1, ease: "easeOut" }}
            >
              💨
            </motion.div>
          ))}
        </div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            Eek! Wrong turn!
          </h2>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            Our elephant got spooked — <span className="font-mono text-sm text-primary">{location.pathname}</span> doesn't exist. Let's tiptoe back to safety.
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
              Back to safety
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
