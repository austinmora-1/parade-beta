import { useState, useMemo } from 'react';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import { usePlannerStore } from '@/stores/plannerStore';
import { usePods } from '@/hooks/usePods';
import { MapPin, Navigation, Loader2, X, ChevronDown, Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

type ShareMode = 'all' | 'select';

export function LiveLocationSharing() {
  const {
    isSharing, isLoading, sharedWith, friendLocations,
    suggestedFriendIds, startSharing, stopSharing, updateSharedWith,
  } = useLiveLocation();
  const { friends } = usePlannerStore();
  const { pods } = usePods();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareMode, setShareMode] = useState<ShareMode>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const connectedFriends = useMemo(
    () => friends.filter(f => f.status === 'connected' && f.friendUserId),
    [friends]
  );

  const friendNameMap = useMemo(
    () => Object.fromEntries(connectedFriends.map(f => [f.friendUserId!, f])),
    [connectedFriends]
  );

  // Build suggested friends from upcoming plans
  const suggestedFriends = useMemo(
    () => connectedFriends.filter(f => suggestedFriendIds.includes(f.friendUserId!)),
    [connectedFriends, suggestedFriendIds]
  );

  const otherFriends = useMemo(
    () => connectedFriends.filter(f => !suggestedFriendIds.includes(f.friendUserId!)),
    [connectedFriends, suggestedFriendIds]
  );

  const toggleFriend = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectPod = (podId: string) => {
    const pod = pods.find(p => p.id === podId);
    const members = pod?.memberUserIds || [];
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const m of members) next.add(m);
      return next;
    });
  };

  const handleStartSharing = async () => {
    const ids = shareMode === 'all' ? null : Array.from(selectedIds);
    if (shareMode === 'select' && selectedIds.size === 0) {
      toast.error('Select at least one friend to share with');
      return;
    }
    const success = await startSharing(ids);
    if (success) {
      const label = shareMode === 'all'
        ? 'all friends'
        : `${selectedIds.size} friend${selectedIds.size > 1 ? 's' : ''}`;
      toast.success(`Sharing location with ${label} for 8 hours`);
      setPickerOpen(false);
    } else {
      toast.error('Could not access your location. Check browser permissions.');
    }
  };

  const handleStopSharing = async () => {
    await stopSharing();
    toast.success('Location sharing stopped');
    setSelectedIds(new Set());
  };

  const sharingLabel = isSharing
    ? sharedWith
      ? `Sharing with ${sharedWith.length} friend${sharedWith.length > 1 ? 's' : ''}`
      : 'Sharing with all friends'
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Live Location</h3>
        </div>

        {isSharing ? (
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 h-7 text-xs bg-primary"
            onClick={handleStopSharing}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Stop Sharing
          </Button>
        ) : (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                Share Location
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="p-3 space-y-3">
                {/* Mode toggle */}
                <div className="flex gap-1.5">
                  <button
                    className={cn(
                      "flex-1 text-xs py-1.5 rounded-md font-medium transition-colors",
                      shareMode === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                    onClick={() => setShareMode('all')}
                  >
                    All Friends
                  </button>
                  <button
                    className={cn(
                      "flex-1 text-xs py-1.5 rounded-md font-medium transition-colors",
                      shareMode === 'select' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                    onClick={() => setShareMode('select')}
                  >
                    Select
                  </button>
                </div>

                {shareMode === 'select' && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {/* Pod quick-select */}
                    {pods.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pods</p>
                        <div className="flex flex-wrap gap-1">
                          {pods.map(pod => (
                            <button
                              key={pod.id}
                              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                              onClick={() => selectPod(pod.id)}
                            >
                              {pod.emoji} {pod.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested from upcoming plans */}
                    {suggestedFriends.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          From upcoming plans
                        </p>
                        {suggestedFriends.map(f => (
                          <FriendCheckItem
                            key={f.friendUserId}
                            name={f.name}
                            avatar={f.avatar}
                            checked={selectedIds.has(f.friendUserId!)}
                            onToggle={() => toggleFriend(f.friendUserId!)}
                            suggested
                          />
                        ))}
                      </div>
                    )}

                    {/* All other friends */}
                    {otherFriends.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Friends
                        </p>
                        {otherFriends.map(f => (
                          <FriendCheckItem
                            key={f.friendUserId}
                            name={f.name}
                            avatar={f.avatar}
                            checked={selectedIds.has(f.friendUserId!)}
                            onToggle={() => toggleFriend(f.friendUserId!)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={handleStartSharing}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                  Start Sharing
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {isSharing && sharingLabel && (
        <p className="text-xs text-muted-foreground">
          📍 {sharingLabel} · expires in 8h
        </p>
      )}

      {friendLocations.length > 0 && (
        <div className="space-y-1.5">
          {friendLocations.map((loc) => {
            const friend = friendNameMap[loc.user_id];
            const name = friend?.name || 'Friend';
            const avatar = friend?.avatar;
            const timeAgo = formatDistanceToNow(new Date(loc.updated_at), { addSuffix: true });

            return (
              <a
                key={loc.user_id}
                href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2",
                  "hover:bg-muted/80 transition-colors cursor-pointer"
                )}
              >
                {avatar ? (
                  <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-[10px] text-muted-foreground">{loc.label || 'Sharing location'} · {timeAgo}</p>
                </div>
                <Navigation className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FriendCheckItem({
  name, avatar, checked, onToggle, suggested,
}: {
  name: string; avatar?: string; checked: boolean; onToggle: () => void; suggested?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left transition-colors",
        checked ? 'bg-primary/10' : 'hover:bg-muted/60'
      )}
      onClick={onToggle}
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
          <Users className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
      <span className="text-sm flex-1 truncate">{name}</span>
      {suggested && !checked && (
        <span className="text-[9px] uppercase tracking-wider text-primary font-medium">Plan today</span>
      )}
      {checked && (
        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
      )}
    </button>
  );
}
