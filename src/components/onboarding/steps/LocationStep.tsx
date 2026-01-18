import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OnboardingData } from '../OnboardingWizard';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

interface LocationStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function LocationStep({ data, updateData }: LocationStepProps) {
  const [isLocating, setIsLocating] = useState(false);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Use reverse geocoding to get address
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
          );
          const data = await response.json();
          if (data.display_name) {
            updateData({ homeAddress: data.display_name });
          }
        } catch (error) {
          console.error('Error getting location:', error);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
      }
    );
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <MapPin className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          Where's Home?
        </h1>
        <p className="text-muted-foreground">
          Help friends know when you're nearby for spontaneous hangouts.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Input
            placeholder="Enter your city or neighborhood"
            value={data.homeAddress}
            onChange={(e) => updateData({ homeAddress: e.target.value })}
            className="h-12 text-lg"
          />
        </div>

        <div className="text-center">
          <span className="text-sm text-muted-foreground">or</span>
        </div>

        <Button
          variant="outline"
          className="w-full h-12 gap-2"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4" />
              Use current location
            </>
          )}
        </Button>
      </div>

      <div className="mt-8 rounded-xl bg-primary/5 border border-primary/20 p-4">
        <p className="text-sm text-primary">
          📍 We only share your general area (city/neighborhood), never your exact address.
        </p>
      </div>
    </div>
  );
}
