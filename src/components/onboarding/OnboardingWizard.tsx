import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AccountCreationStep } from './steps/AccountCreationStep';
import { ProfilePersonalizationStep } from './steps/ProfilePersonalizationStep';
import { CalendarSyncStep } from './steps/CalendarSyncStep';
import { SocialPreferencesStep } from './steps/SocialPreferencesStep';
import { NotificationsPrivacyStep } from './steps/NotificationsPrivacyStep';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface OnboardingData {
  // Step 1: Account Creation
  firstName: string;
  lastName: string;
  displayName: string;
  phoneNumber: string;
  // Step 2: Profile Personalization
  avatarUrl: string;
  coverPhotoUrl: string;
  homeAddress: string;
  timezone: string;
  neighborhood: string;
  // Step 3: Calendar Sync
  calendarConnected: boolean;
  // Step 4: Social Preferences
  workDays: string[];
  workStartHour: number;
  workEndHour: number;
  socialCap: number | null;
  preferredSocialDays: string[];
  preferredSocialTimes: string[];
  interests: string[];
  friendEmails: string[];
  // Step 5: Notifications & Privacy
  showAvailability: boolean;
  showLocation: boolean;
  showVibeStatus: boolean;
  discoverable: boolean;
  allowAllHangRequests: boolean;
  allowEllyHangouts: boolean;
}

const STEPS = [
  { id: 'account', title: 'Account' },
  { id: 'profile', title: 'Profile' },
  { id: 'calendar', title: 'Calendar' },
  { id: 'social', title: 'Social' },
  { id: 'notifications', title: 'Settings' },
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    firstName: '',
    lastName: '',
    displayName: '',
    phoneNumber: '',
    avatarUrl: '',
    coverPhotoUrl: '',
    homeAddress: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    neighborhood: '',
    calendarConnected: false,
    workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    workStartHour: 9,
    workEndHour: 17,
    socialCap: null,
    preferredSocialDays: ['friday', 'saturday', 'sunday'],
    preferredSocialTimes: ['evening'],
    interests: [],
    friendEmails: [],
    showAvailability: true,
    showLocation: true,
    showVibeStatus: true,
    discoverable: true,
    allowAllHangRequests: true,
    allowEllyHangouts: true,
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
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: data.firstName || null,
          last_name: data.lastName || null,
          display_name: data.displayName || null,
          phone_number: data.phoneNumber || null,
          avatar_url: data.avatarUrl || null,
          cover_photo_url: data.coverPhotoUrl || null,
          home_address: data.homeAddress || null,
          timezone: data.timezone || null,
          neighborhood: data.neighborhood || null,
          show_availability: data.showAvailability,
          show_location: data.showLocation,
          show_vibe_status: data.showVibeStatus,
          discoverable: data.discoverable,
          allow_all_hang_requests: data.allowAllHangRequests,
          allow_elly_hangouts: data.allowEllyHangouts,
          default_work_days: data.workDays,
          default_work_start_hour: data.workStartHour,
          default_work_end_hour: data.workEndHour,
          social_cap: data.socialCap,
          preferred_social_days: data.preferredSocialDays,
          preferred_social_times: data.preferredSocialTimes,
          interests: data.interests,
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
      case 'account':
        return <AccountCreationStep data={data} updateData={updateData} />;
      case 'profile':
        return <ProfilePersonalizationStep data={data} updateData={updateData} />;
      case 'calendar':
        return <CalendarSyncStep data={data} updateData={updateData} />;
      case 'social':
        return <SocialPreferencesStep data={data} updateData={updateData} />;
      case 'notifications':
        return <NotificationsPrivacyStep data={data} updateData={updateData} />;
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
        <div className="mx-auto max-w-lg px-4 py-6 md:py-10">
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
