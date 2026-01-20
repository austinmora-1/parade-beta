import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, X, Send, Sparkles, Bug, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type FeedbackType = "feature" | "bug" | "general";

const feedbackTypes: { type: FeedbackType; label: string; icon: typeof Sparkles; color: string }[] = [
  { type: "feature", label: "Feature Request", icon: Lightbulb, color: "text-amber-500" },
  { type: "bug", label: "Bug Report", icon: Bug, color: "text-red-500" },
  { type: "general", label: "General Feedback", icon: Sparkles, color: "text-primary" },
];

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!selectedType || !message.trim()) return;
    
    setIsSubmitting(true);
    
    // Simulate submission - replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    toast({
      title: "Thanks for your feedback! 💜",
      description: "We appreciate you taking the time to help us improve.",
    });
    
    setIsSubmitting(false);
    setMessage("");
    setSelectedType(null);
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedType(null);
    setMessage("");
  };

  return (
    <>
      {/* Floating button */}
      <motion.div
        className="fixed top-4 right-4 z-50 md:top-6 md:right-6"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 260, damping: 20 }}
      >
        <motion.button
          onClick={() => setIsOpen(true)}
          className={cn(
            "group relative flex h-14 w-14 items-center justify-center rounded-full",
            "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
            "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
            "transition-shadow duration-300"
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <MessageSquarePlus className="h-6 w-6" />
          
          {/* Pulse ring */}
          <motion.span
            className="absolute inset-0 rounded-full bg-primary/30"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
          
          {/* Tooltip */}
          <span className="absolute right-full mr-3 whitespace-nowrap rounded-lg bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
            Send Feedback
          </span>
        </motion.button>
      </motion.div>

      {/* Feedback panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            />

            {/* Panel */}
            <motion.div
              className="fixed top-16 right-4 z-50 w-[360px] overflow-hidden rounded-2xl bg-card shadow-2xl md:top-20 md:right-6"
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b bg-muted/50 px-5 py-4">
                <div className="flex items-center gap-2">
                  <motion.div
                    initial={{ rotate: -20 }}
                    animate={{ rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <MessageSquarePlus className="h-5 w-5 text-primary" />
                  </motion.div>
                  <h3 className="font-semibold">Send Feedback</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-5">
                {/* Type selector */}
                <div className="mb-4">
                  <p className="mb-3 text-sm text-muted-foreground">What would you like to share?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {feedbackTypes.map(({ type, label, icon: Icon, color }, index) => (
                      <motion.button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors",
                          selectedType === type
                            ? "border-primary bg-primary/10"
                            : "border-transparent bg-muted/50 hover:bg-muted"
                        )}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Icon className={cn("h-5 w-5", color)} />
                        <span className="text-xs font-medium">{label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Message input */}
                <AnimatePresence mode="wait">
                  {selectedType && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Textarea
                        placeholder={
                          selectedType === "feature"
                            ? "Describe the feature you'd like to see..."
                            : selectedType === "bug"
                            ? "Tell us what went wrong..."
                            : "Share your thoughts with us..."
                        }
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="mb-4 min-h-[120px] resize-none"
                      />

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <Button
                          onClick={handleSubmit}
                          disabled={!message.trim() || isSubmitting}
                          className="w-full gap-2"
                        >
                          {isSubmitting ? (
                            <motion.div
                              className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Send Feedback
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
