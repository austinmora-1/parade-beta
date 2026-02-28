import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Search, PenLine, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LocationSuggestion {
  place_id: string;
  display_name: string;
  main_text: string;
  secondary_text: string;
}

export interface VibeLocation {
  name: string;
  verified: boolean;
}

interface VibeLocationInputProps {
  value: VibeLocation | null;
  onChange: (location: VibeLocation | null) => void;
}

export function VibeLocationInput({ value, onChange }: VibeLocationInputProps) {
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const dropdown = document.getElementById('vibe-location-dropdown');
      if (inputRef.current && !inputRef.current.contains(target) && dropdown && !dropdown.contains(target)) {
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
        body: { query: searchQuery, types: 'establishment' }
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

    if (mode === 'search') {
      setShowSuggestions(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchPlaces(newValue), 300);
    }
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    const displayValue = suggestion.secondary_text
      ? `${suggestion.main_text} · ${suggestion.secondary_text}`
      : suggestion.main_text;
    setQuery(displayValue);
    onChange({ name: displayValue, verified: true });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleCustomConfirm = () => {
    if (query.trim()) {
      onChange({ name: query.trim(), verified: false });
    }
  };

  const handleClear = () => {
    setQuery('');
    onChange(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const switchMode = (newMode: 'search' | 'custom') => {
    setMode(newMode);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onChange(null);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border-2 border-input bg-background px-3 py-2">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-sm truncate flex-1">{value.name}</span>
        {value.verified && (
          <span className="text-[10px] text-primary bg-primary/10 rounded-full px-1.5 py-0.5 shrink-0">verified</span>
        )}
        <button onClick={handleClear} className="shrink-0 rounded-full p-0.5 hover:bg-muted transition-colors">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  const dropdown = mode === 'search' && showSuggestions && suggestions.length > 0 && createPortal(
    <div
      id="vibe-location-dropdown"
      style={{
        position: 'absolute',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 9999,
      }}
      className="rounded-lg border border-border bg-popover shadow-lg"
    >
      <ul className="max-h-48 overflow-y-auto py-1 overscroll-contain">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.place_id}
            onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(suggestion); }}
            onTouchEnd={(e) => { e.preventDefault(); handleSelectSuggestion(suggestion); }}
            className="flex cursor-pointer items-center gap-2 px-3 py-2.5 hover:bg-muted active:bg-muted transition-colors"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{suggestion.main_text}</p>
              {suggestion.secondary_text && (
                <p className="text-xs text-muted-foreground truncate">{suggestion.secondary_text}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          onClick={() => switchMode('search')}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
            mode === 'search'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Search className="h-3 w-3" />
          Search
        </button>
        <button
          onClick={() => switchMode('custom')}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
            mode === 'custom'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <PenLine className="h-3 w-3" />
          Custom
        </button>
      </div>

      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (mode === 'search' && query.length >= 2) setShowSuggestions(true); }}
          onBlur={() => {
            if (mode === 'custom') {
              setTimeout(() => handleCustomConfirm(), 150);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && mode === 'custom' && query.trim()) {
              e.preventDefault();
              handleCustomConfirm();
            }
          }}
          placeholder={mode === 'search' ? "Search for a place..." : "Type a location..."}
          className="h-9 text-sm pl-8 pr-8"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {dropdown}
    </div>
  );
}
