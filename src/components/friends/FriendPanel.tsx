import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { FriendProfileContent } from './FriendProfileContent';
import { AnimatePresence, motion } from 'framer-motion';

interface FriendPanelProps {
  friendUserId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PanelContent({
  friendUserId,
  onClose,
}: {
  friendUserId: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-medium">Profile</span>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <FriendProfileContent
          userId={friendUserId}
          showBackButton={false}
        />
      </div>
    </div>
  );
}

export function FriendPanel({ friendUserId, open, onOpenChange }: FriendPanelProps) {
  const isMobile = useIsMobile();

  if (!friendUserId) return null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[92dvh] flex flex-col">
          <PanelContent
            friendUserId={friendUserId}
            onClose={() => onOpenChange(false)}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] bg-background border-l border-border shadow-xl z-50 flex flex-col"
          >
            <PanelContent
              friendUserId={friendUserId}
              onClose={() => onOpenChange(false)}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
