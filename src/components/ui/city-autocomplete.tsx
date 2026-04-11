import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LocationSuggestion {
  place_id: string;
  display_name: string;
  main_text: string;
  secondary_text: string;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  types?: string;
}

export function CityAutocomplete({ 
  value, 
  onChange, 
  placeholder = "Search for a city...",
  className,
  compact = false,
  types = '(cities)',
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPlaces = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { query: searchQuery, types }
      });

      if (error) throw error;
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error searching places:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    setShowSuggestions(true);

    // Debounce the search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchPlaces(newValue);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    // Remove country from secondary_text (keep only state/region if present)
    let displayValue = suggestion.main_text;
    if (suggestion.secondary_text) {
      const parts = suggestion.secondary_text.split(', ');
      // Take only the first part (usually state/region), skip the country
      if (parts.length > 1) {
        displayValue += `, ${parts[0]}`;
      } else if (parts.length === 1 && parts[0].length <= 3) {
        // If it's a short abbreviation like "CA" or "NY", include it
        displayValue += `, ${parts[0]}`;
      }
    }
    setQuery(displayValue);
    onChange(displayValue);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleFocus = () => {
    if (query.length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow click/touch on suggestion
    setTimeout(() => {
      if (query !== value) {
        onChange(query);
      }
    }, 200);
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className={cn(
          "absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
          compact ? "h-3 w-3" : "h-4 w-4 left-3"
        )} />
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            compact ? "h-8 text-sm pl-7 pr-7" : "pl-10 pr-10"
          )}
        />
        {isLoading && (
          <Loader2 className={cn(
            "absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground",
            compact ? "h-3 w-3" : "h-4 w-4 right-3"
          )} />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg"
          style={{ zIndex: 9999 }}
        >
          <ul className="max-h-60 overflow-y-auto py-1 overscroll-contain">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.place_id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectSuggestion(suggestion);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectSuggestion(suggestion);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 hover:bg-muted active:bg-muted transition-colors",
                  compact ? "px-2 py-2" : "px-3 py-3 gap-3"
                )}
              >
                <MapPin className={cn("shrink-0 text-muted-foreground", compact ? "h-3 w-3" : "h-4 w-4")} />
                <div className="min-w-0">
                  <p className={cn("font-medium truncate", compact && "text-sm")}>{suggestion.main_text}</p>
                  {suggestion.secondary_text && (
                    <p className={cn("text-muted-foreground truncate", compact ? "text-[10px]" : "text-sm")}>{suggestion.secondary_text}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
