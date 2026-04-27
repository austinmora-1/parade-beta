import { useEffect, useState, useCallback, useRef } from 'react';
import { Joyride, EVENTS, STATUS, ACTIONS, type Step, type EventData } from 'react-joyride';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFriendsStore } from '@/stores/friendsStore';
import { usePlansStore } from '@/stores/plansStore';

const TOUR_REPLAY_KEY = 'parade.tour.replay';

type TourStep = Step & {
  route?: string;
  onLeave?: () => void;
};

/**
 * Wait for an element matching `selector` to exist in the DOM, then resolve
 * after a short settle delay so the spotlight measures a stable rect.
 */
function waitForSelector(selector: string, timeoutMs = 3000, settleMs = 220) {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const check = () => {
      if (document.querySelector(selector)) {
        setTimeout(resolve, settleMs);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

/**
 * Step `before` hook: opens the planning sheet and waits for the
 * referenced flow button to mount before letting Joyride spotlight it.
 */
const openSheetAndWait = (selector: string) => async () => {
  window.dispatchEvent(new Event('parade:open-planning-sheet'));
  await waitForSelector(selector);
};

const STEPS: TourStep[] = [
  {
    target: '[data-tour="fab"]',
    route: '/',
    title: '👋 Welcome to Parade',
    content:
      "This little plus button is your launchpad — tap it whenever you want to start something new.",
    placement: 'bottom',
  },
  {
    target: '[data-tour="flow-hang"]',
    route: '/',
    title: '🤝 Find time with friends',
    content:
      "Pick \"Find time with friends\" to choose who you want to see — we'll surface windows where you're both free.",
    placement: 'top',
    isFixed: true,
    skipScroll: true,
    before: openSheetAndWait('[data-tour="flow-hang"]'),
  },
  {
    target: '[data-tour="flow-plus-one"]',
    route: '/',
    title: '🎟️ Open invites',
    content:
      "Pick \"Open invite\" when you have a spare ticket or want company for something specific. Friends can claim the spot.",
    placement: 'top',
    isFixed: true,
    skipScroll: true,
    before: openSheetAndWait('[data-tour="flow-plus-one"]'),
  },
  {
    target: '[data-tour="flow-trip"]',
    route: '/',
    title: '📍 Go somewhere',
    content:
      "Pick \"Go somewhere\" to plan a trip or propose dates with a group — Parade auto-updates your location and surfaces nearby friends.",
    placement: 'top',
    isFixed: true,
    skipScroll: true,
    before: openSheetAndWait('[data-tour="flow-trip"]'),
    onLeave: () => window.dispatchEvent(new Event('parade:close-planning-sheet')),
  },
  {
    target: '[data-tour="nav-plans"]',
    route: '/availability',
    title: '📅 Plans',
    content:
      "Swipe week-by-week through your calendar. Tap any day to see who's free, or tap a plan to manage it.",
    placement: 'top',
  },
  {
    target: '[data-tour="nav-trips"]',
    route: '/trips',
    title: '✈️ Trips',
    content:
      "Add upcoming travel here so friends know when you're around — and see friends visiting your city.",
    placement: 'top',
  },
  {
    target: '[data-tour="invite-friends"]',
    route: '/friends',
    title: '💛 Bring your people',
    content:
      "Parade is way better with your crew. Invite friends by email, SMS, or shareable link.",
    placement: 'bottom',
  },
];

export function ParadeTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const friendCount = useFriendsStore((s) => s.friends.length);
  const planCount = usePlansStore((s) => s.plans.length);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const lastEnteredStep = useRef<number>(-1);

  // Decide whether to run on mount.
  useEffect(() => {
    if (!user) return;

    if (localStorage.getItem(TOUR_REPLAY_KEY) === '1') {
      localStorage.removeItem(TOUR_REPLAY_KEY);
      setStepIndex(0);
      lastEnteredStep.current = -1;
      setTimeout(() => setRun(true), 400);
      return;
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
        setTimeout(() => setRun(true), 800);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, friendCount, planCount]);

  // Navigate to the right route + fire onEnter when entering a step.
  // For steps whose target lives inside a portal/drawer, we briefly pause
  // Joyride, fire onEnter (which opens the sheet), wait for the target
  // to actually mount + settle, then resume so the spotlight measures the
  // correct rect.
  useEffect(() => {
    if (!run && lastEnteredStep.current === stepIndex) return;
    if (!run) return;
    const step = STEPS[stepIndex];
    if (!step) return;

    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return;
    }

    if (lastEnteredStep.current !== stepIndex) {
      lastEnteredStep.current = stepIndex;

      if (step.onEnter) {
        // Pause Joyride so it doesn't try to spotlight a yet-to-mount target.
        setRun(false);
        step.onEnter();

        // Wait for the target element to mount, then give the drawer a
        // moment to finish its open animation before resuming.
        const targetSel = typeof step.target === 'string' ? step.target : null;
        const start = Date.now();
        const waitForTarget = () => {
          const el = targetSel ? document.querySelector(targetSel) : null;
          if (el || Date.now() - start > 2000) {
            // Allow drawer transform to settle
            setTimeout(() => setRun(true), 220);
          } else {
            requestAnimationFrame(waitForTarget);
          }
        };
        requestAnimationFrame(waitForTarget);
      }
    }
  }, [run, stepIndex, location.pathname, navigate]);

  const finish = useCallback(async () => {
    setRun(false);
    window.dispatchEvent(new Event('parade:close-planning-sheet'));
    if (user) {
      await supabase
        .from('profiles')
        .update({ walkthrough_completed: true })
        .eq('user_id', user.id);
    }
  }, [user]);

  const handleEvent = useCallback(
    (data: EventData) => {
      const { status, type, action, index } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        STEPS[index]?.onLeave?.();
        finish();
        return;
      }

      if (action === ACTIONS.CLOSE && type === EVENTS.STEP_AFTER) {
        STEPS[index]?.onLeave?.();
        finish();
        return;
      }

      // TARGET_NOT_FOUND fires while the target is mounting (e.g. Drawer
      // portal opening). Do NOT auto-advance — let Joyride keep waiting up
      // to `targetWaitTimeout`. Only advance on explicit user STEP_AFTER.
      if (type === EVENTS.STEP_AFTER) {
        const next = action === ACTIONS.PREV ? index - 1 : index + 1;
        STEPS[index]?.onLeave?.();
        if (next >= STEPS.length) {
          finish();
          return;
        }
        if (next < 0) return;
        setStepIndex(next);
      }
    },
    [finish],
  );

  if (!run) return null;

  return (
    <Joyride
      steps={STEPS}
      stepIndex={stepIndex}
      run={run}
      continuous
      onEvent={handleEvent}
      locale={{
        back: 'Back',
        close: 'Close',
        last: "Let's go!",
        next: 'Next',
        skip: 'Skip tour',
      }}
      options={{
        primaryColor: '#E6533C',
        backgroundColor: 'hsl(var(--card))',
        textColor: 'hsl(var(--foreground))',
        overlayColor: 'rgba(0, 0, 0, 0.55)',
        showProgress: true,
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 14,
        // Higher than the Drawer (which renders at z-50) so the tooltip,
        // overlay, and spotlight all sit above the open bottom sheet.
        zIndex: 100000,
        targetWaitTimeout: 8000,
        buttons: ['back', 'skip', 'primary'],
      }}
      styles={{
        tooltip: {
          borderRadius: 16,
          padding: 18,
          fontSize: 14,
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 6,
        },
        tooltipContent: {
          padding: 0,
          lineHeight: 1.5,
          color: 'hsl(var(--muted-foreground))',
        },
        buttonPrimary: {
          backgroundColor: '#E6533C',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 14px',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          fontSize: 13,
          marginRight: 6,
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
          fontSize: 12,
        },
      }}
    />
  );
}

export function startParadeTour() {
  localStorage.setItem(TOUR_REPLAY_KEY, '1');
  window.location.href = '/';
}
