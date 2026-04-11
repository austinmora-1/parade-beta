import { useState, useEffect } from 'react';
import { Smartphone, Share, PlusSquare, MoreVertical, Download, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import safariShareImg from '@/assets/onboarding/safari-share-button.jpg';
import safariAddHomeImg from '@/assets/onboarding/safari-add-home.jpg';
import chromeAddHomeImg from '@/assets/onboarding/chrome-add-home.jpg';

type Platform = 'ios-safari' | 'ios-chrome' | 'android' | 'desktop' | 'unknown';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|Chrome/.test(ua);

  if (isIOS && isSafari) return 'ios-safari';
  if (isIOS) return 'ios-chrome';
  if (isAndroid) return 'android';
  if (!isIOS && !isAndroid) return 'desktop';
  return 'unknown';
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

interface StepInfo {
  icon: React.ReactNode;
  title: string;
  description: string;
  screenshot?: string;
  screenshotAlt?: string;
}

interface PlatformInstructions {
  title: string;
  subtitle: string;
  steps: StepInfo[];
}

const instructions: Record<Platform, PlatformInstructions> = {
  'ios-safari': {
    title: 'Add Parade to your Home Screen',
    subtitle: 'Parade works best as a Home Screen app — it opens full-screen, loads faster, and you\'ll get notifications just like a native app.',
    steps: [
      {
        icon: <Share className="h-5 w-5" />,
        title: 'Tap the Share button',
        description: 'Look for the square icon with an upward arrow (⬆) at the bottom of your Safari toolbar.',
        screenshot: safariShareImg,
        screenshotAlt: 'Safari toolbar showing the Share button at the bottom',
      },
      {
        icon: <PlusSquare className="h-5 w-5" />,
        title: 'Tap "Add to Home Screen"',
        description: 'Scroll down in the share menu until you see the "Add to Home Screen" option with the ＋ icon. Tap it.',
        screenshot: safariAddHomeImg,
        screenshotAlt: 'Safari share sheet showing Add to Home Screen option',
      },
      {
        icon: <Check className="h-5 w-5" />,
        title: 'Tap "Add" to confirm',
        description: 'The Parade icon will appear on your Home Screen. You can rename it if you like, then tap "Add" in the top right corner.',
      },
    ],
  },
  'ios-chrome': {
    title: 'Add Parade to your Home Screen',
    subtitle: 'To add Parade to your Home Screen on iPhone, you\'ll need to open it in Safari first — Chrome on iOS doesn\'t support this feature.',
    steps: [
      {
        icon: <ExternalLink className="h-5 w-5" />,
        title: 'Open Parade in Safari',
        description: 'Copy the current URL and paste it into Safari, or tap the Safari icon on your Home Screen and navigate to parade.lovable.app.',
      },
      {
        icon: <Share className="h-5 w-5" />,
        title: 'Tap the Share button in Safari',
        description: 'Look for the square icon with an upward arrow (⬆) at the bottom of Safari\'s toolbar.',
        screenshot: safariShareImg,
        screenshotAlt: 'Safari toolbar showing the Share button at the bottom',
      },
      {
        icon: <PlusSquare className="h-5 w-5" />,
        title: 'Tap "Add to Home Screen"',
        description: 'Scroll down in the share menu and tap "Add to Home Screen" with the ＋ icon.',
        screenshot: safariAddHomeImg,
        screenshotAlt: 'Safari share sheet showing Add to Home Screen option',
      },
      {
        icon: <Check className="h-5 w-5" />,
        title: 'Tap "Add" to confirm',
        description: 'The Parade icon will appear on your Home Screen — just like any other app!',
      },
    ],
  },
  'android': {
    title: 'Add Parade to your Home Screen',
    subtitle: 'Install Parade to your Home Screen for instant access, faster loading, and push notifications.',
    steps: [
      {
        icon: <MoreVertical className="h-5 w-5" />,
        title: 'Open the Chrome menu',
        description: 'Tap the three-dot menu (⋮) in the top-right corner of Chrome.',
        screenshot: chromeAddHomeImg,
        screenshotAlt: 'Chrome menu showing Add to Home screen option',
      },
      {
        icon: <Download className="h-5 w-5" />,
        title: 'Tap "Add to Home screen" or "Install app"',
        description: 'You\'ll see one of these options in the menu. Either one will add Parade to your Home Screen.',
      },
      {
        icon: <Check className="h-5 w-5" />,
        title: 'Confirm the install',
        description: 'Tap "Add" or "Install" on the confirmation popup. Parade will appear on your Home Screen ready to go!',
      },
    ],
  },
  'desktop': {
    title: 'Add Parade to your Home Screen',
    subtitle: 'For the best experience, open Parade on your phone and add it to your Home Screen. You can also install it on your computer from Chrome.',
    steps: [
      {
        icon: <Smartphone className="h-5 w-5" />,
        title: 'Open on your phone',
        description: 'Visit parade.lovable.app in Safari (iPhone) or Chrome (Android) on your phone for the full mobile experience.',
      },
      {
        icon: <Share className="h-5 w-5" />,
        title: 'Add to your phone\'s Home Screen',
        description: 'On iPhone, tap the Share button → "Add to Home Screen." On Android, tap the ⋮ menu → "Add to Home screen."',
      },
      {
        icon: <Check className="h-5 w-5" />,
        title: 'Launch it like an app',
        description: 'Once added, Parade opens full-screen from your Home Screen — no browser chrome, just the app.',
      },
    ],
  },
  'unknown': {
    title: 'Add Parade to your Home Screen',
    subtitle: 'Install Parade to your Home Screen for the fastest, most app-like experience.',
    steps: [
      {
        icon: <MoreVertical className="h-5 w-5" />,
        title: 'Open your browser menu',
        description: 'Look for a menu icon (three dots, lines, or a share button) in your browser\'s toolbar.',
      },
      {
        icon: <Download className="h-5 w-5" />,
        title: 'Find "Add to Home Screen"',
        description: 'Tap "Add to Home Screen," "Install app," or a similar option. The exact wording varies by browser.',
      },
      {
        icon: <Check className="h-5 w-5" />,
        title: 'Confirm and launch',
        description: 'Tap "Add" or "Install" to put Parade on your Home Screen. Open it anytime — it runs just like a native app.',
      },
    ],
  },
};

export function HomeScreenStep() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setAlreadyInstalled(isStandalone());
  }, []);

  const info = instructions[platform];

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Smartphone className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-display text-xl font-bold">Add to Home Screen</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {info.subtitle}
        </p>
      </div>

      {alreadyInstalled ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <Check className="h-5 w-5 text-primary" />
          </div>
          <p className="font-medium text-primary">You're all set!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Parade is already installed on your Home Screen.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {info.steps.map((step, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card overflow-hidden shadow-soft"
            >
              <div className="flex items-start gap-3 p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold">{step.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed ml-7">
                    {step.description}
                  </p>
                </div>
              </div>
              {step.screenshot && (
                <div className="px-3.5 pb-3.5">
                  <img
                    src={step.screenshot}
                    alt={step.screenshotAlt || step.title}
                    className="w-full rounded-lg border border-border"
                    loading="lazy"
                    width={512}
                    height={512}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        You can always do this later from your browser's share or menu button.
      </p>
    </div>
  );
}
