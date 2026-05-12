// lib/ai/pdfToImages.ts — Convert PDF pages to base64 PNG buffers
// Uses pdfjs-dist + canvas (pure JS, no native ImageMagick dependency)

/**
 * Given a file buffer and its MIME type, returns an array of base64-encoded
 * PNG images (one per page, max 3 pages). Non-PDF files are returned as-is.
 */
export async function toBase64Images(
  buffer: Buffer,
  mimeType: string,
): Promise<string[]> {
  // For images, just return the raw base64 — no conversion needed
  if (mimeType !== 'application/pdf') {
    return [buffer.toString('base64')];
  }

  try {
    // Dynamic import to avoid issues at build time (server-only)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('canvas');

    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdfDoc = await loadingTask.promise;

    const maxPages = Math.min(pdfDoc.numPages, 3);
    const images: string[] = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 }); // 150 DPI equivalent

      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        canvas:        canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;

      // Export as PNG base64 (strip the data: prefix)
      const dataUrl = canvas.toDataURL('image/png');
      images.push(dataUrl.replace(/^data:image\/png;base64,/, ''));
    }

    return images;
  } catch (err) {
    console.error('[pdfToImages] PDF conversion failed, falling back to raw buffer:', err);
    // Fallback: send the raw PDF bytes — some models handle it
    return [buffer.toString('base64')];
  }
}

/** Returns the correct MIME type to use in the image_url content part */
export function imageMime(originalMime: string): string {
  if (originalMime === 'application/pdf') return 'image/png';
  return originalMime;
}
