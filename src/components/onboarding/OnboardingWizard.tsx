import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { WelcomeStep } from './steps/WelcomeStep';
import { PrivacyStep } from './steps/PrivacyStep';
import { AvailabilityStep } from './steps/AvailabilityStep';
import { CalendarStep } from './steps/CalendarStep';
import { LocationStep } from './steps/LocationStep';
import { FriendsStep } from './steps/FriendsStep';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface OnboardingData {
  displayName: string;
  showAvailability: boolean;
  showLocation: boolean;
  showVibeStatus: boolean;
  discoverable: boolean;
  allowAllHangRequests: boolean;
  workDays: string[];
  workStartHour: number;
  workEndHour: number;
  calendarConnected: boolean;
  homeAddress: string;
  friendEmails: string[];
}

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'availability', title: 'Availability' },
  { id: 'calendar', title: 'Calendar' },
  { id: 'location', title: 'Location' },
  { id: 'friends', title: 'Friends' },
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    showAvailability: true,
    showLocation: true,
    showVibeStatus: true,
    discoverable: true,
    allowAllHangRequests: true,
    workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    workStartHour: 9,
    workEndHour: 17,
    calendarConnected: false,
    homeAddress: '',
    friendEmails: [],
  });

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    if (!session?.user) return;
    
    setIsSubmitting(true);
    try {
      // Update profile with onboarding data
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: data.displayName || null,
          show_availability: data.showAvailability,
          show_location: data.showLocation,
          show_vibe_status: data.showVibeStatus,
          discoverable: data.discoverable,
          allow_all_hang_requests: data.allowAllHangRequests,
          home_address: data.homeAddress || null,
        })
        .eq('user_id', session.user.id);

      if (error) throw error;

      toast.success('Welcome to Parade! 🎉');
      navigate('/');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigate('/');
  };

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return <WelcomeStep data={data} updateData={updateData} />;
      case 'privacy':
        return <PrivacyStep data={data} updateData={updateData} />;
      case 'availability':
        return <AvailabilityStep data={data} updateData={updateData} />;
      case 'calendar':
        return <CalendarStep data={data} updateData={updateData} />;
      case 'location':
        return <LocationStep data={data} updateData={updateData} />;
      case 'friends':
        return <FriendsStep data={data} updateData={updateData} />;
      default:
        return null;
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-display font-semibold">Setup</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          Skip for now
        </Button>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 md:px-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <span className="text-sm font-medium">{STEPS[currentStep].title}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-8 md:py-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isFirstStep}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isLastStep ? (
              isSubmitting ? 'Finishing...' : 'Get Started'
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
