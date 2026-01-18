import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
}

export function CityAutocomplete({ 
  value, 
  onChange, 
  placeholder = "Search for a city...",
  className 
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Update dropdown position when showing suggestions
  useEffect(() => {
    if (showSuggestions && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [showSuggestions, suggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const dropdown = document.getElementById('city-autocomplete-dropdown');
      if (
        inputRef.current && 
        !inputRef.current.contains(target) &&
        dropdown && 
        !dropdown.contains(target)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on scroll
  useEffect(() => {
    function handleScroll() {
      if (showSuggestions && inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    }
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [showSuggestions]);

  const searchPlaces = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { query: searchQuery, types: '(cities)' }
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
    const displayValue = suggestion.main_text + (suggestion.secondary_text ? `, ${suggestion.secondary_text}` : '');
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

  const dropdown = showSuggestions && suggestions.length > 0 && createPortal(
    <div
      id="city-autocomplete-dropdown"
      style={{
        position: 'absolute',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 9999,
      }}
      className="rounded-lg border border-border bg-popover shadow-lg"
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
            className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-muted active:bg-muted transition-colors"
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-medium truncate">{suggestion.main_text}</p>
              {suggestion.secondary_text && (
                <p className="text-sm text-muted-foreground truncate">{suggestion.secondary_text}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {dropdown}
    </div>
  );
}
