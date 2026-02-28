import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2 } from 'lucide-react';

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

const PAGE_SIZE = 20;

export function GifPicker({ onGifSelect, children }: GifPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchGifs = useCallback(async (searchQuery: string, offset = 0, append = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (searchQuery) params.set('q', searchQuery);

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
      const newGifs: GifResult[] = result.gifs || [];

      setHasMore(newGifs.length >= PAGE_SIZE);
      offsetRef.current = offset + newGifs.length;

      if (append) {
        setGifs(prev => [...prev, ...newGifs]);
      } else {
        setGifs(newGifs);
      }
    } catch (err) {
      console.error('GIF fetch error:', err);
      if (!append) setGifs([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load trending on open
  useEffect(() => {
    if (!open) return;
    offsetRef.current = 0;
    fetchGifs('');
  }, [open, fetchGifs]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      offsetRef.current = 0;
      fetchGifs(query);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, fetchGifs]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loading || loadingMore || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      fetchGifs(query, offsetRef.current, true);
    }
  }, [loading, loadingMore, hasMore, query, fetchGifs]);

  const handleSelect = (gif: GifResult) => {
    onGifSelect(gif.url);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-80 p-0 overflow-hidden gap-0 rounded-xl">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search GIFs..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          <div
            ref={scrollRef}
            className="h-72 overflow-y-auto p-1.5 overscroll-contain"
            onScroll={handleScroll}
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
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
                {loadingMore && (
                  <div className="col-span-2 flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border px-2 py-1.5 flex items-center justify-end">
            <span className="text-[9px] text-muted-foreground/50 tracking-wide uppercase">Powered by GIPHY</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
