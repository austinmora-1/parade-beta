import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronRight, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const TOUR_REPLAY_KEY = 'parade.tour.replay';

type Placement = 'top' | 'bottom';

interface TourStep {
  id: string;
  route?: string;
  /** CSS selector for a real DOM target; ignored when `panelRow` is set. */
  selector?: string;
  /** Index 0-2 to spotlight a row inside the tour-owned planning panel. */
  panelRow?: 0 | 1 | 2;
  title: string;
  body: string;
  placement: Placement;
}

const STEPS: TourStep[] = [
  {
    id: 'fab',
    route: '/',
    selector: '[data-tour="fab"]',
    title: '👋 Welcome to Parade',
    body: 'This little plus button is your launchpad — tap it whenever you want to start something new.',
    placement: 'bottom',
  },
  {
    id: 'flow-hang',
    route: '/',
    panelRow: 0,
    title: '🤝 Find time with friends',
    body: "Pick \"Find time with friends\" to choose who you want to see — we'll surface windows where you're both free.",
    placement: 'top',
  },
  {
    id: 'flow-plus-one',
    route: '/',
    panelRow: 1,
    title: '🎟️ Open invites',
    body: '"Open invite" works when you have a spare ticket or want company for something specific. Friends can claim the spot.',
    placement: 'top',
  },
  {
    id: 'flow-trip',
    route: '/',
    panelRow: 2,
    title: '📍 Go somewhere',
    body: '"Go somewhere" plans a trip or proposes dates with a group — Parade auto-updates your location and surfaces nearby friends.',
    placement: 'top',
  },
  {
    id: 'nav-plans',
    route: '/availability',
    selector: '[data-tour="nav-plans"]',
    title: '📅 Plans',
    body: "Swipe week-by-week through your calendar. Tap any day to see who's free, or tap a plan to manage it.",
    placement: 'top',
  },
  {
    id: 'nav-trips',
    route: '/trips',
    selector: '[data-tour="nav-trips"]',
    title: '✈️ Trips',
    body: "Add upcoming travel here so friends know when you're around — and see friends visiting your city.",
    placement: 'top',
  },
  {
    id: 'invite-friends',
    route: '/friends',
    selector: '[data-tour="invite-friends"]',
    title: '💛 Bring your people',
    body: 'Parade is way better with your crew. Invite friends by email, SMS, or shareable link.',
    placement: 'bottom',
  },
];

const PANEL_ROWS = [
  { emoji: '👤', label: 'Find time with friends', hint: '"I want to see Alex this week"' },
  { emoji: '🎟️', label: 'Open invite', hint: '"Mets game Saturday, need someone"' },
  { emoji: '📍', label: 'Go somewhere', hint: '"NYC this fall — or Queens on Saturday"' },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const isPanelStep = (i: number) => STEPS[i]?.panelRow !== undefined;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ParadeTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const panelRowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const step = STEPS[stepIndex];
  const showPanel = isPanelStep(stepIndex);

  // ---------- Prefetch lazy route chunks once tour starts so navigation
  // between steps doesn't trigger the Suspense fallback / loading screen.
  useEffect(() => {
    if (!run) return;
    // Fire-and-forget — chunks get warmed in the background.
    import('@/pages/Availability').catch(() => {});
    import('@/pages/Trips').catch(() => {});
    import('@/pages/Friends').catch(() => {});
  }, [run]);

  // ---------- Boot: replay flag or unfinished walkthrough ----------
  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;

    if (localStorage.getItem(TOUR_REPLAY_KEY) === '1') {
      localStorage.removeItem(TOUR_REPLAY_KEY);
      setStepIndex(0);
      const t = setTimeout(() => setRun(true), 300);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('walkthrough_completed')
        .eq('user_id', user.id)
        .single();
      if (cancelled) return;
      if (data && !data.walkthrough_completed) {
        setTimeout(() => setRun(true), 700);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ---------- Track viewport size ----------
  useEffect(() => {
    if (!run) return;
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [run]);

  // ---------- Route navigation when entering a step ----------
  useEffect(() => {
    if (!run || !step) return;
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [run, step, location.pathname, navigate]);

  // ---------- Measure spotlight target (for resize/scroll listener only) ----------
  const measure = useCallback(() => {
    const currentStep = STEPS[stepIndex];
    if (!currentStep) return;

    let target: Element | null = null;
    if (currentStep.panelRow !== undefined) {
      target = panelRowRefs.current[currentStep.panelRow] ?? null;
    } else if (currentStep.selector) {
      target = document.querySelector(currentStep.selector);
    }

    if (!target) return;
    const r = target.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [stepIndex]);

  // Measure on step change + when panel mounts. Poll until the target appears
  // (covers route transitions where the nav item mounts a few frames later
  // and lazy-loaded routes that take longer to render).
  useLayoutEffect(() => {
    if (!run) return;

    // Reset rect immediately so we don't flash the previous step's spotlight
    // in the wrong place during route transitions.
    setRect(null);

    let stopped = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 180; // ~3 seconds at 60fps

    const tick = () => {
      if (stopped) return;
      const currentStep = STEPS[stepIndex];
      if (!currentStep) return;

      // Don't measure until we're on the right route — otherwise we'd
      // briefly query selectors that only exist on the destination page.
      if (currentStep.route && location.pathname !== currentStep.route) {
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) requestAnimationFrame(tick);
        return;
      }

      let target: Element | null = null;
      if (currentStep.panelRow !== undefined) {
        target = panelRowRefs.current[currentStep.panelRow] ?? null;
      } else if (currentStep.selector) {
        target = document.querySelector(currentStep.selector);
      }

      if (target) {
        const r = target.getBoundingClientRect();
        // Wait until the element actually has a non-zero size (route chunks
        // can mount with 0x0 for a frame).
        if (r.width > 0 && r.height > 0) {
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          // Keep re-measuring at a slower cadence to track layout shifts
          // (e.g. tabs mounting below). Stop after a bit.
          attempts += 1;
          if (attempts < MAX_ATTEMPTS) requestAnimationFrame(tick);
          return;
        }
      }

      attempts += 1;
      if (attempts < MAX_ATTEMPTS) requestAnimationFrame(tick);
    };

    const frameId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    };
  }, [run, stepIndex, location.pathname, showPanel]);

  // Re-measure on resize / scroll
  useEffect(() => {
    if (!run) return;
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [run, measure]);

  // ---------- Finish ----------
  const finish = useCallback(async () => {
    setRun(false);
    if (user) {
      await supabase
        .from('profiles')
        .update({ walkthrough_completed: true })
        .eq('user_id', user.id);
    }
  }, [user]);

  const goNext = useCallback(() => {
    if (stepIndex >= STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, finish]);

  const goBack = useCallback(() => {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
  }, [stepIndex]);

  // ---------- Tooltip position ----------
  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    if (!step) return { display: 'none' };
    const margin = 12;
    const tooltipW = Math.min(360, viewport.w - margin * 2);
    const tooltipMaxH = 220;

    // Anchor: spotlight rect, OR panel top edge for panel steps if rect missing.
    let anchor: Rect | null = rect;
    if (!anchor) {
      // Fallback to viewport center
      return {
        top: viewport.h / 2 - 80,
        left: clamp(viewport.w / 2 - tooltipW / 2, margin, viewport.w - tooltipW - margin),
        width: tooltipW,
      };
    }

    let top: number;
    if (step.placement === 'top') {
      top = anchor.top - tooltipMaxH - 14;
      // If it would clip the top of the viewport, flip below.
      if (top < margin) top = anchor.top + anchor.height + 14;
    } else {
      top = anchor.top + anchor.height + 14;
      if (top + tooltipMaxH > viewport.h - margin) {
        top = anchor.top - tooltipMaxH - 14;
      }
    }
    top = clamp(top, margin, Math.max(margin, viewport.h - tooltipMaxH - margin));

    const centerX = anchor.left + anchor.width / 2;
    const left = clamp(centerX - tooltipW / 2, margin, viewport.w - tooltipW - margin);

    return { top, left, width: tooltipW };
  }, [step, rect, viewport]);

  if (!run || !step) return null;

  // ---------- Build the spotlight cutout via SVG mask ----------
  const padding = 8;
  const radius = 14;
  const spotlight = rect
    ? {
        x: Math.max(0, rect.left - padding),
        y: Math.max(0, rect.top - padding),
        w: rect.width + padding * 2,
        h: rect.height + padding * 2,
      }
    : null;

  const isLast = stepIndex === STEPS.length - 1;

  const content = (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 9000 }}>
      {/* Backdrop with spotlight cutout */}
      <svg
        className="pointer-events-auto absolute inset-0 h-full w-full"
        width={viewport.w}
        height={viewport.h}
        onClick={(e) => e.stopPropagation()}
      >
        <defs>
          <mask id="parade-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.x}
                y={spotlight.y}
                width={spotlight.w}
                height={spotlight.h}
                rx={radius}
                ry={radius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#parade-tour-mask)"
        />
      </svg>

      {/* Highlight ring around the spotlight */}
      {spotlight && (
        <div
          className="pointer-events-none absolute"
          style={{
            top: spotlight.y,
            left: spotlight.x,
            width: spotlight.w,
            height: spotlight.h,
            borderRadius: radius,
            boxShadow: '0 0 0 2px hsl(var(--primary)), 0 0 24px 2px hsl(var(--primary) / 0.45)',
          }}
        />
      )}

      {/* Tour-owned planning panel (steps 2-4) */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            key="tour-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="pointer-events-auto absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-background shadow-2xl"
            style={{ zIndex: 9010 }}
          >
            <div className="mx-auto mt-3 h-1.5 w-[80px] rounded-full bg-muted" />
            <div className="px-4 pt-3 pb-2 text-left">
              <p className="text-base font-semibold text-foreground">What are you planning?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pick whatever comes to mind first — we'll fill in the rest.
              </p>
            </div>
            <div className="px-4 pb-5 space-y-2">
              {PANEL_ROWS.map((row, i) => (
                <button
                  key={row.label}
                  ref={(el) => { panelRowRefs.current[i] = el; }}
                  type="button"
                  // disabled in tour — clicking does nothing, but keeps full-width visual
                  onClick={(e) => e.preventDefault()}
                  className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left"
                >
                  <span className="text-2xl shrink-0" aria-hidden>{row.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{row.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate">{row.hint}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip card */}
      <motion.div
        key={step.id}
        ref={tooltipRef}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pointer-events-auto absolute overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl"
        style={{ ...tooltipStyle, zIndex: 9020 }}
      >
        {/* Progress bar — sits flush inside the rounded/border tooltip */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <button
          type="button"
          onClick={finish}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5">
          <p className="text-[11px] font-medium text-muted-foreground mb-2">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <h3 className="text-base font-bold text-foreground mb-1.5 pr-6">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={finish}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {isLast ? "Let's go!" : 'Next'}
                {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Step dots */}
          <div className="mt-4 flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStepIndex(i)}
                className="h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: i === stepIndex ? 24 : 6,
                  background:
                    i === stepIndex
                      ? 'hsl(var(--primary))'
                      : i < stepIndex
                      ? 'hsl(var(--primary) / 0.4)'
                      : 'hsl(var(--muted-foreground) / 0.25)',
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(content, document.body);
}

export function startParadeTour() {
  localStorage.setItem(TOUR_REPLAY_KEY, '1');
  window.location.href = '/';
}
