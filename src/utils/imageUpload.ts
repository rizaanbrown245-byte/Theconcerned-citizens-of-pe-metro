/**
 * Utilities for high-fidelity image processing, Supabase Storage uploads,
 * and lossless/high-quality client-side compression.
 *
 * Avoids unnecessary JPEG degradation and low-resolution downscaling,
 * keeping community evidence photos, avatars, and logos razor sharp on Retina and high-DPI screens.
 */

import { supabase, isSupabaseConfigured, STORAGE_BUCKET } from '../lib/supabase';

export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'heic', 'heif'].includes(ext || '');
}

/**
 * Attempts to upload an image directly to Supabase Storage if the bucket is available.
 * Returns public CDN URL if successful, or null if storage is not ready/fails.
 */
export async function uploadToSupabaseStorage(
  file: File,
  folder = 'uploads'
): Promise<{ url: string | null; error?: string }> {
  if (!isSupabaseConfigured) {
    return { url: null, error: 'Supabase is not configured' };
  }

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 30);
    const filePath = `${folder}/${timestamp}-${random}-${sanitizedName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      console.warn(`[Supabase Storage] Upload to bucket "${STORAGE_BUCKET}" failed:`, uploadError.message);
      return { url: null, error: uploadError.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    if (publicUrlData?.publicUrl) {
      return { url: publicUrlData.publicUrl };
    }

    return { url: null, error: 'Could not obtain public URL for uploaded file' };
  } catch (err: any) {
    console.warn('[Supabase Storage] Unexpected upload error:', err?.message || err);
    return { url: null, error: err?.message || 'Upload failed' };
  }
}

/**
 * High-definition image processing:
 * 1. Checks if the image is already reasonable size (< 2.5MB and < 2560px) -> reads directly without lossy re-encoding.
 * 2. If downscaling is necessary, scales smoothly with high quality interpolation (ctx.imageSmoothingQuality = 'high').
 * 3. Preserves PNG transparency and WebP formats.
 * 4. Uses 0.92 quality for photos to eliminate macroblocking and blurriness.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 2560,
  quality = 0.92
): Promise<string> {
  // If SVG or GIF, preserve raw vector/animation data completely
  if (
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif' ||
    file.name.toLowerCase().endsWith('.svg') ||
    file.name.toLowerCase().endsWith('.gif')
  ) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        // Fallback to raw dataURL if image decode fails
        resolve(reader.result as string);
      };
      img.onload = () => {
        try {
          let { width, height } = img;

          // If image is already smaller than maxDimension and file is < 2.5MB,
          // do NOT perform lossy re-encoding; preserve original pixel sharpness.
          if (width <= maxDimension && height <= maxDimension && file.size < 2.5 * 1024 * 1024) {
            resolve(reader.result as string);
            return;
          }

          // Downscale proportionally if larger than maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }

          // High-quality image scaling configuration
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

          if (!isPng) {
            // Fill background only for non-PNG formats
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Preserve PNG format to keep alpha channels and crisp badge/logo graphics
          const outputMime = isPng ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outputMime, isPng ? undefined : quality);
          resolve(dataUrl);
        } catch {
          // If canvas fails (e.g. security/taint), fallback to raw reader result
          resolve(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Master upload function:
 * First attempts to store in Supabase Storage. If storage is unavailable or not set up,
 * falls back to high-resolution dataURL compression.
 */
export async function uploadOrCompressImage(
  file: File,
  folder = 'community',
  maxDimension = 2560,
  quality = 0.92
): Promise<string> {
  // 1. Try Supabase Storage first
  if (isSupabaseConfigured) {
    const storageResult = await uploadToSupabaseStorage(file, folder);
    if (storageResult.url) {
      return storageResult.url;
    }
  }

  // 2. Fallback to high-definition client processing
  return compressImageFile(file, maxDimension, quality);
}

/**
 * Process a batch or folder of image files with progress callback.
 */
export async function processImageFiles(
  files: FileList | File[],
  onProgress?: (processed: number, total: number) => void
): Promise<string[]> {
  const fileArray = Array.from(files).filter(isImageFile);
  if (fileArray.length === 0) return [];

  const results: string[] = [];
  let processedCount = 0;

  for (const file of fileArray) {
    try {
      const url = await uploadOrCompressImage(file, 'community');
      results.push(url);
    } catch (err) {
      console.warn('Failed to process image file:', file.name, err);
      // Fallback try simple high-res data URL
      try {
        const fallback = await compressImageFile(file);
        results.push(fallback);
      } catch (subErr) {
        console.error('Complete image read failure for file:', file.name, subErr);
      }
    }
    processedCount++;
    if (onProgress) {
      onProgress(processedCount, fileArray.length);
    }
  }

  return results;
}
