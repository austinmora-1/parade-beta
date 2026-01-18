import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { OnboardingData } from '../OnboardingWizard';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { CityAutocomplete } from '@/components/ui/city-autocomplete';

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
          // Use reverse geocoding to get city
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&zoom=10`
          );
          const result = await response.json();
          if (result.address) {
            // Extract city-level info
            const city = result.address.city || result.address.town || result.address.village || result.address.municipality;
            const state = result.address.state;
            const country = result.address.country;
            
            const parts = [city, state, country].filter(Boolean);
            if (parts.length > 0) {
              updateData({ homeAddress: parts.join(', ') });
            }
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
          Where's Home Base?
        </h1>
        <p className="text-muted-foreground">
          Help friends know when you're nearby for spontaneous hangouts.
        </p>
      </div>

      <div className="space-y-4">
        <CityAutocomplete
          value={data.homeAddress}
          onChange={(value) => updateData({ homeAddress: value })}
          placeholder="Search for your city..."
          className="[&_input]:h-12 [&_input]:text-lg"
        />

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
          📍 We only share your city, never your exact address.
        </p>
      </div>
    </div>
  );
}
