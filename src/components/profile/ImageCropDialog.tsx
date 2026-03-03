import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  aspect?: number;
  circular?: boolean;
  title?: string;
  outputWidth?: number;
  outputHeight?: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 80,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

function getDistance(t1: React.Touch, t2: React.Touch) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspect = 1,
  circular = true,
  title = 'Crop Profile Picture',
  outputWidth = 1024,
  outputHeight,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef<number>(1);
  const isMobile = useIsMobile();

  // Reset zoom when dialog opens
  useEffect(() => {
    if (open) setZoom(1);
  }, [open]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }, [aspect]);

  const getCroppedImage = useCallback(async (): Promise<Blob | null> => {
    const image = imgRef.current;
    if (!image || !completedCrop) return null;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / (image.width * zoom);
    const scaleY = image.naturalHeight / (image.height * zoom);

    const finalWidth = outputWidth;
    const finalHeight = outputHeight ?? (aspect === 1 ? outputWidth : Math.round(outputWidth / aspect));
    canvas.width = finalWidth;
    canvas.height = finalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      finalWidth,
      finalHeight
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.9
      );
    });
  }, [completedCrop, zoom, outputWidth, outputHeight, aspect]);

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImage();
      if (croppedBlob) {
        onCropComplete(croppedBlob);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setZoom(1);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, aspect));
    }
  };

  // Pinch-to-zoom handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchStartDist.current = getDistance(e.touches[0], e.touches[1]);
      pinchStartZoom.current = zoom;
    }
  }, [zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      e.preventDefault();
      const currentDist = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDist / pinchStartDist.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom.current * scale));
      setZoom(newZoom);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchStartDist.current = null;
  }, []);

  const cropArea = (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-muted-foreground text-center">
        {isMobile ? 'Pinch to zoom • Drag to reposition' : 'Drag to reposition • Drag corners to resize'}
      </p>
      <div
        ref={containerRef}
        className="flex items-center justify-center w-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={aspect}
          circularCrop={circular}
          minWidth={50}
          minHeight={50}
          className={isMobile ? 'max-h-[50dvh]' : 'max-h-[400px]'}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: pinchStartDist.current !== null ? 'none' : 'transform 0.1s ease-out' }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop preview"
            onLoad={onImageLoad}
            className={isMobile ? 'max-h-[50dvh] max-w-full' : 'max-h-[400px] max-w-full'}
            draggable={false}
          />
        </ReactCrop>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-3 w-full max-w-[280px]">
        <button
          onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.2))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <Slider
          value={[zoom]}
          onValueChange={([v]) => setZoom(v)}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          className="flex-1"
        />
        <button
          onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.2))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleReset}
        className="gap-1.5 text-xs text-muted-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
    </div>
  );

  const saveButton = (
    <Button onClick={handleSave} disabled={isProcessing || !completedCrop} className="flex-1 sm:flex-none">
      {isProcessing ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        'Save'
      )}
    </Button>
  );

  const cancelButton = (
    <Button
      variant="outline"
      onClick={() => onOpenChange(false)}
      disabled={isProcessing}
      className="flex-1 sm:flex-none"
    >
      Cancel
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2 overflow-y-auto">
            {cropArea}
          </div>
          <DrawerFooter className="flex-row gap-2 pt-2">
            {cancelButton}
            {saveButton}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {cropArea}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {cancelButton}
          {saveButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
