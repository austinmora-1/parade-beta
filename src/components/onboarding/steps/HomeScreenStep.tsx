import { useState, useEffect } from 'react';
import { Smartphone, Share, PlusSquare, MoreVertical, Download, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const instructions: Record<Platform, { title: string; steps: { icon: React.ReactNode; text: string }[] }> = {
  'ios-safari': {
    title: 'Add to Home Screen on iPhone',
    steps: [
      { icon: <Share className="h-5 w-5" />, text: 'Tap the Share button at the bottom of Safari' },
      { icon: <PlusSquare className="h-5 w-5" />, text: 'Scroll down and tap "Add to Home Screen"' },
      { icon: <Check className="h-5 w-5" />, text: 'Tap "Add" in the top right corner' },
    ],
  },
  'ios-chrome': {
    title: 'Add to Home Screen on iPhone',
    steps: [
      { icon: <Share className="h-5 w-5" />, text: 'Open this page in Safari (Chrome doesn\'t support this)' },
      { icon: <Share className="h-5 w-5" />, text: 'Tap the Share button at the bottom of Safari' },
      { icon: <PlusSquare className="h-5 w-5" />, text: 'Tap "Add to Home Screen"' },
    ],
  },
  'android': {
    title: 'Add to Home Screen on Android',
    steps: [
      { icon: <MoreVertical className="h-5 w-5" />, text: 'Tap the menu (⋮) in the top right of Chrome' },
      { icon: <Download className="h-5 w-5" />, text: 'Tap "Add to Home screen" or "Install app"' },
      { icon: <Check className="h-5 w-5" />, text: 'Tap "Add" to confirm' },
    ],
  },
  'desktop': {
    title: 'Add to your Dock or Home Screen',
    steps: [
      { icon: <Download className="h-5 w-5" />, text: 'Look for the install icon in your browser\'s address bar' },
      { icon: <Check className="h-5 w-5" />, text: 'Click "Install" to add Parade as a desktop app' },
    ],
  },
  'unknown': {
    title: 'Add to Home Screen',
    steps: [
      { icon: <MoreVertical className="h-5 w-5" />, text: 'Open your browser menu' },
      { icon: <Download className="h-5 w-5" />, text: 'Look for "Add to Home Screen" or "Install"' },
      { icon: <Check className="h-5 w-5" />, text: 'Confirm to add the app' },
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
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Smartphone className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold">Add to Home Screen</h2>
        <p className="mt-2 text-muted-foreground">
          Get the full app experience — launch Parade instantly from your home screen.
        </p>
      </div>

      {alreadyInstalled ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <p className="font-medium text-primary">You're all set!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Parade is already installed on your device.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {info.title}
          </h3>
          <div className="space-y-3">
            {info.steps.map((step, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-soft"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <p className="text-sm">{step.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        You can always do this later from your browser menu.
      </p>
    </div>
  );
}
