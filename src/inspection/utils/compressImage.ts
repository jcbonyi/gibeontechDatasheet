const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.72;

export async function compressImageDataUrl(file: File): Promise<string> {
  const source = await loadImageSource(file);
  const { width, height } = fitWithin(source.width, source.height, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to process image');
  }

  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function fitWithin(width: number, height: number, max: number) {
  if (width <= max && height <= max) {
    return { width, height };
  }
  const scale = max / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

async function loadImageSource(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return bitmap;
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadHtmlImage(dataUrl);
  return image;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
