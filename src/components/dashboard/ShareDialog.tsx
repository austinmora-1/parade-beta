import { useEffect, useState } from 'react';
import { Eye, ExternalLink } from 'lucide-react';
import { CalendarShareIcon } from '@/components/ui/CalendarShareIcon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ShareLinkDialog } from '@/components/share/ShareLinkDialog';

interface ShareDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type ViewDuration = '1w' | '1m' | '3m';

const VIEW_DURATION_OPTIONS: { value: ViewDuration; label: string }[] = [
  { value: '1w', label: '1 Week' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
];

const PRIMARY_DOMAIN = 'https://helloparade.app';

export function ShareDialog({ trigger, open: controlledOpen, onOpenChange }: ShareDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [viewDuration, setViewDuration] = useState<ViewDuration>('3m');
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('share_code')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.share_code) setShareCode(data.share_code);
      });
  }, [user]);

  const inviterName =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';

  const generateLink = async () => {
    if (!shareCode) throw new Error('Share code not loaded yet');
    return `${PRIMARY_DOMAIN}/share/${shareCode}?view=${viewDuration}`;
  };

  const topSlot = (
    <div className="space-y-3">
      {/* View Duration Picker */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {VIEW_DURATION_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setViewDuration(option.value)}
            className={cn(
              'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
              viewDuration === option.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Preview Profile */}
      {shareCode && (
        <Link
          to={`/share/${shareCode}?view=${viewDuration}`}
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-2.5 text-left transition-all hover:bg-primary/10 hover:border-primary/50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Eye className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">Preview Your Profile</h3>
            <p className="text-xs text-muted-foreground truncate">See what friends will see</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Link>
      )}
    </div>
  );

  return (
    <>
      {trigger && (
        <span onClick={() => setOpen(true)} className="contents">
          {trigger}
        </span>
      )}
      {!trigger && controlledOpen === undefined && (
        <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => setOpen(true)}>
          <CalendarShareIcon className="h-4 w-4" />
          Share
        </Button>
      )}
      <ShareLinkDialog
        open={open}
        onOpenChange={setOpen}
        title="My availability"
        shareMessage={`${inviterName} shared their availability on Parade. Tap to see when they're free:`}
        emailSubject={`${inviterName} shared their Parade availability`}
        generateLink={generateLink}
        topSlot={topSlot}
        regenerateKey={`${viewDuration}:${shareCode ?? ''}`}
      />
    </>
  );
}
