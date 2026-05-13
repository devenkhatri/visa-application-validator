// lib/ai/pdfToImages.ts — Convert PDF pages to base64 PNG buffers or pure text
// Uses pdfjs-dist/legacy + node-canvas with a proper NodeCanvasFactory

import type { Canvas, CanvasRenderingContext2D as NodeCanvasRenderingContext2D } from 'canvas';

/**
 * pdfjs-dist requires a CanvasFactory when rendering in Node.js.
 * Without it, pdfjs tries to call drawImage() with internal image objects
 * that node-canvas cannot handle, causing "Image or Canvas expected" errors.
 */
class NodeCanvasFactory {
  private createCanvas: (w: number, h: number) => Canvas;

  constructor(createCanvas: (w: number, h: number) => Canvas) {
    this.createCanvas = createCanvas;
  }

  create(width: number, height: number) {
    const w = Math.ceil(Math.max(1, width));
    const h = Math.ceil(Math.max(1, height));
    const canvas  = this.createCanvas(w, h);
    const context = canvas.getContext('2d');

    // Intercept drawImage to natively bypass node-canvas strict C++ prototype validation errors
    const originalDrawImage = context.drawImage;
    context.drawImage = function (img: any, ...args: any[]) {
      try {
        return originalDrawImage.apply(this, [img, ...args] as any);
      } catch (err: any) {
        // Fallback: If drawing an internal sub-canvas/XObject fails, extract pixel ImageData directly
        if (img && typeof img.getContext === 'function') {
          try {
            const srcCtx  = img.getContext('2d');
            const imgData = srcCtx.getImageData(0, 0, img.width, img.height);
            // If pdf.js draws at explicit target coordinates, extract destX/destY from arguments
            const destX = args.length > 2 ? args[args.length - 2] : 0;
            const destY = args.length > 1 ? args[args.length - 1] : 0;
            context.putImageData(imgData, destX, destY);
            return;
          } catch (e) {
            console.warn('[NodeCanvasFactory] Secondary putImageData copy failed:', e);
          }
        }
        throw err;
      }
    };

    return { canvas, context };
  }

  reset(
    canvasAndContext: { canvas: Canvas; context: NodeCanvasRenderingContext2D },
    width: number,
    height: number,
  ) {
    canvasAndContext.canvas.width  = Math.ceil(Math.max(1, width));
    canvasAndContext.canvas.height = Math.ceil(Math.max(1, height));
  }

  destroy(canvasAndContext: { canvas: Canvas; context: NodeCanvasRenderingContext2D }) {
    // Release memory
    canvasAndContext.canvas.width  = 0;
    canvasAndContext.canvas.height = 0;
  }
}

/**
 * Highly robust fallback: Extracts pure embedded text from all PDF pages using
 * standard stream parsing. 100% immune to canvas graphics errors.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data:      new Uint8Array(buffer),
      verbosity: 0,
    });

    const pdfDoc = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page    = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }

    return fullText.trim();
  } catch (err) {
    console.error('[extractPdfText] Failed to extract text from PDF:', err);
    return '';
  }
}

/**
 * Given a file buffer and its MIME type, returns an array of base64-encoded
 * PNG images (one per page, max 3 pages). Non-PDF files are returned as-is.
 */
export async function toBase64Images(
  buffer: Buffer,
  mimeType: string,
): Promise<string[]> {
  // For standard images, return the raw base64 — no conversion needed
  if (mimeType !== 'application/pdf') {
    return [buffer.toString('base64')];
  }

  try {
    // Dynamic imports — server-only; avoided at build time
    const pdfjs           = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('canvas');

    const canvasFactory = new NodeCanvasFactory(createCanvas);

    const loadingTask = pdfjs.getDocument({
      data:      new Uint8Array(buffer),
      verbosity: 0,
    });

    const pdfDoc   = await loadingTask.promise;
    const maxPages = Math.min(pdfDoc.numPages, 3);
    const images: string[] = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page     = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 }); // ~144 DPI

      const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
        canvasFactory,
      } as any).promise;

      // Export as PNG base64 (strip the data: URI prefix)
      const dataUrl = canvas.toDataURL('image/png');
      images.push(dataUrl.replace(/^data:image\/png;base64,/, ''));

      canvasFactory.destroy({ canvas, context });
    }

    return images;
  } catch (err) {
    console.error('[pdfToImages] Canvas rasterization failed, falling back gracefully:', err);
    // Return raw base64 buffer so Gemini 2.0 Flash natively decodes the PDF visual/image layers directly
    return [buffer.toString('base64')];
  }
}

/** Returns the MIME type to declare in the vision API image_url content part */
export function imageMime(originalMime: string): string {
  if (originalMime === 'application/pdf') return 'image/png';
  return originalMime;
}
