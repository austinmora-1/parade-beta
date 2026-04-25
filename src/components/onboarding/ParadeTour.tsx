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
  onEnter?: () => void;
  onLeave?: () => void;
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
      "Pick who you want to see and we'll surface windows where you're both free. Great for casual catch-ups.",
    placement: 'bottom',
    onEnter: () => window.dispatchEvent(new Event('parade:open-planning-sheet')),
  },
  {
    target: '[data-tour="flow-plus-one"]',
    route: '/',
    title: '🎟️ Open invites',
    content:
      "Have a spare ticket or want company for something specific? Drop an open invite and friends can claim the spot.",
    placement: 'bottom',
  },
  {
    target: '[data-tour="flow-trip"]',
    route: '/',
    title: '📍 Go somewhere',
    content:
      "Plan a trip or propose dates with a group — Parade auto-updates your location and surfaces nearby friends.",
    placement: 'bottom',
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

    if (friendCount > 0 || planCount > 0) return;

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
  useEffect(() => {
    if (!run) return;
    const step = STEPS[stepIndex];
    if (!step) return;

    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return;
    }

    if (lastEnteredStep.current !== stepIndex) {
      lastEnteredStep.current = stepIndex;
      setTimeout(() => step.onEnter?.(), 250);
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

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
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
        zIndex: 10000,
        targetWaitTimeout: 4000,
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
        buttonNext: {
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
