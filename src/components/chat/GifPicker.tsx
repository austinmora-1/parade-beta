import { useState, useCallback, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GifResult {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  onGifSelect: (gifUrl: string) => void;
  children: React.ReactNode;
}

export function GifPicker({ onGifSelect, children }: GifPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchGifs = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (searchQuery) params.set('q', searchQuery);

      const { data, error } = await supabase.functions.invoke('giphy-search', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: undefined,
      });

      // Use fetch directly for GET with query params
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/giphy-search?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || anonKey}`,
            'apikey': anonKey,
          },
        }
      );

      if (!res.ok) throw new Error('Failed to fetch GIFs');
      const result = await res.json();
      setGifs(result.gifs || []);
    } catch (err) {
      console.error('GIF fetch error:', err);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchGifs('');
  }, [open, fetchGifs]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, fetchGifs]);

  const handleSelect = (gif: GifResult) => {
    onGifSelect(gif.url);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 overflow-hidden"
        side="top"
        align="start"
        sideOffset={8}
      >
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search GIFs..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="h-64 overflow-y-auto p-1.5">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground">
                {query ? 'No GIFs found' : 'Loading trending GIFs...'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {gifs.map(gif => (
                <button
                  key={gif.id}
                  onClick={() => handleSelect(gif)}
                  className="rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <img
                    src={gif.preview}
                    alt={gif.title}
                    className="w-full h-24 object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-2 py-1.5 flex items-center justify-end">
          <span className="text-[9px] text-muted-foreground/50 tracking-wide uppercase">Powered by GIPHY</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
