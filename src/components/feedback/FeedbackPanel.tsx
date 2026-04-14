import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Bug, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFeedback } from "./FeedbackContext";
import { supabase } from "@/integrations/supabase/client";

type FeedbackType = "feature" | "bug" | "general";

const feedbackTypes: { type: FeedbackType; label: string; icon: typeof Sparkles; color: string }[] = [
  { type: "feature", label: "Feature Request", icon: Lightbulb, color: "text-amber-500" },
  { type: "bug", label: "Bug Report", icon: Bug, color: "text-red-500" },
  { type: "general", label: "General Feedback", icon: Sparkles, color: "text-primary" },
];

export function FeedbackPanel() {
  const { isOpen, closeFeedback } = useFeedback();
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!selectedType || !message.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("submit-feedback", {
        body: { feedbackType: selectedType, message: message.trim() },
      });

      if (error) throw error;

      toast({
        title: "Thanks for your feedback! 💜",
        description: "We appreciate you taking the time to help us improve.",
      });

      setMessage("");
      setSelectedType(null);
      closeFeedback();
    } catch (err) {
      console.error("Feedback submission error:", err);
      toast({
        title: "Couldn't send feedback",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    closeFeedback();
    setSelectedType(null);
    setMessage("");
  };

  return (
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
            className="fixed top-16 right-4 z-50 w-[calc(100vw-2rem)] max-w-[360px] overflow-hidden rounded-2xl bg-card shadow-2xl md:top-20 md:right-6"
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
                  <MessagesSquare className="h-5 w-5 text-primary" />
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
  );
}
