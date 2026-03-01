import { useState, useEffect } from 'react';
import { resolveMediaUrl } from '@/lib/storage';

interface SignedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  bucket?: string;
}

/**
 * An <img> wrapper that automatically resolves Supabase storage URLs
 * to signed URLs for private buckets. External URLs (e.g., Giphy) pass through.
 */
export function SignedImage({ src, bucket, ...props }: SignedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    resolveMediaUrl(src, bucket).then(url => {
      if (!cancelled) setResolvedSrc(url);
    });
    return () => { cancelled = true; };
  }, [src, bucket]);

  return <img src={resolvedSrc} {...props} />;
}
