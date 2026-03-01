import { useState, useRef, useCallback } from 'react';
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
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
}

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

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const isMobile = useIsMobile();

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const getCroppedImage = useCallback(async (): Promise<Blob | null> => {
    const image = imgRef.current;
    if (!image || !completedCrop) return null;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const outputSize = Math.min(512, completedCrop.width * scaleX, completedCrop.height * scaleY);
    canvas.width = outputSize;
    canvas.height = outputSize;

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
      outputSize,
      outputSize
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.9
      );
    });
  }, [completedCrop]);

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
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, 1));
    }
  };

  const cropArea = (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-muted-foreground text-center">
        Drag to reposition • Drag corners to resize
      </p>
      <div className="flex items-center justify-center w-full touch-none">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={1}
          circularCrop
          minWidth={50}
          minHeight={50}
          className={isMobile ? 'max-h-[50dvh]' : 'max-h-[400px]'}
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
      <Button
        variant="ghost"
        size="sm"
        onClick={handleReset}
        className="gap-1.5 text-xs text-muted-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset crop
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
            <DrawerTitle>Crop Profile Picture</DrawerTitle>
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
          <DialogTitle>Crop Profile Picture</DialogTitle>
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
