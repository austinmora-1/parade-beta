import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParticipantAvailability {
  userId: string;
  name: string;
  available: boolean;
}

interface AvailabilityWarningProps {
  availability: ParticipantAvailability[];
}

export function AvailabilityWarning({ availability }: AvailabilityWarningProps) {
  if (availability.length === 0) return null;

  const conflicts = availability.filter(a => !a.available);
  const allFree = conflicts.length === 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 text-xs space-y-1",
        allFree
          ? "border-green-500/20 bg-green-500/5"
          : "border-amber-500/20 bg-amber-500/5"
      )}
    >
      <div className="flex items-center gap-1.5 font-medium">
        {allFree ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-500" />
            <span className="text-green-600 dark:text-green-400">All participants are free</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400">
              {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
      {!allFree && (
        <div className="space-y-0.5 pl-5">
          {availability.map(a => (
            <div key={a.userId} className="flex items-center gap-1.5">
              <div className={cn(
                "h-1.5 w-1.5 rounded-full",
                a.available ? "bg-green-500" : "bg-amber-500"
              )} />
              <span className={cn(
                a.available ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400 font-medium"
              )}>
                {a.name} — {a.available ? 'free' : 'busy'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
