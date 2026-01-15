import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import paradeLogo from '@/assets/parade-logo.png';

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-lg md:hidden">
      <Link to="/" className="flex items-center gap-2">
        <img src={paradeLogo} alt="Parade" className="h-8 w-8 rounded-lg" />
        <span className="font-display text-lg font-bold">Parade</span>
      </Link>
      <Link
        to="/settings"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Settings className="h-5 w-5" />
      </Link>
    </header>
  );
}
