import imageCompression from "browser-image-compression";

/** Preset caps for import / general compression. */
export const COMPRESS_PRESETS = {
  tiny: { max: 1200, maxMB: 0.35, quality: 0.68, label: "Tiny (1200 px, ~0.35 MB)" },
  small: { max: 1600, maxMB: 0.55, quality: 0.72, label: "Small (1600 px, ~0.55 MB)" },
  fast: { max: 1800, maxMB: 0.85, quality: 0.78, label: "Fast (1800 px, ~0.85 MB)" },
  balanced: { max: 2400, maxMB: 1.3, quality: 0.82, label: "Balanced (2400 px, ~1.3 MB)" },
  best: { max: 3200, maxMB: 2.2, quality: 0.88, label: "Best (3200 px, ~2.2 MB)" },
} as const;

export type CompressPresetId = keyof typeof COMPRESS_PRESETS;

export type CompressOptions = {
  /** Preset id, or omit and set maxWidthOrHeight / maxSizeMB / quality yourself */
  preset?: CompressPresetId;
  maxWidthOrHeight?: number;
  maxSizeMB?: number;
  quality?: number;
  /** Cap re-encode loops (library default is 10; 3 is much faster) */
  maxIteration?: number;
  /** Keep PNG/WebP/GIF alpha; force JPEG for opaque photos when false-ish for jpeg sources */
  fileType?: string;
  useWebWorker?: boolean;
  signal?: AbortSignal;
};

export type CompressResult = {
  file: File;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  name: string;
  type: string;
  skipped?: boolean;
};

export type CompressManyOptions = CompressOptions & {
  concurrency?: number;
  /** Called after each file finishes (success or failure), with 1-based done count */
  onProgress?: (done: number, total: number, result: CompressResult | null, file: File) => void;
  /** Filter; default accepts common image MIME types */
  accept?: (file: File) => boolean;
};

const DEFAULT_ACCEPT = (f: File) =>
  /^image\/(jpeg|png|webp|gif|bmp)/.test(f.type);

function resolveOpts(options: CompressOptions = {}) {
  const preset = options.preset
    ? COMPRESS_PRESETS[options.preset]
    : COMPRESS_PRESETS.small;
  return {
    maxWidthOrHeight: options.maxWidthOrHeight ?? preset.max,
    maxSizeMB: options.maxSizeMB ?? preset.maxMB,
    quality: options.quality ?? preset.quality,
    maxIteration: options.maxIteration ?? 3,
    useWebWorker: options.useWebWorker !== false,
    fileType: options.fileType,
  };
}

function asResult(file: File, blob: Blob = file, skipped = false): CompressResult {
  return {
    file: blob instanceof File ? blob : file,
    blob,
    originalSize: file.size,
    compressedSize: blob.size,
    name: (blob instanceof File ? blob.name : file.name) || file.name,
    type: blob.type || file.type,
    skipped,
  };
}

/**
 * Compress a single image with browser-image-compression (Web Worker by default).
 * Skips the worker when the file is already within the maxSizeMB budget.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const resolved = resolveOpts(options);
  const budget = resolved.maxSizeMB * 1024 * 1024;
  if (file.size <= budget) {
    return asResult(file, file, true);
  }
  const keepAlpha = /png|webp|gif/i.test(file.type);
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: resolved.maxSizeMB,
      maxWidthOrHeight: resolved.maxWidthOrHeight,
      useWebWorker: resolved.useWebWorker,
      initialQuality: resolved.quality,
      maxIteration: resolved.maxIteration,
      fileType: resolved.fileType ?? (keepAlpha ? undefined : "image/jpeg"),
      preserveExif: false,
      signal: options.signal,
    });
    const blob: Blob = compressed;
    const outFile =
      compressed instanceof File
        ? compressed
        : new File([blob], file.name, {
            type: blob.type || file.type,
            lastModified: Date.now(),
          });
    return asResult(file, outFile, false);
  } catch {
    return asResult(file, file, false);
  }
}

/** Run async work over a list with a concurrency limit; preserves order. */
export async function mapPool<T, R>(
  list: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i);
    }
  }
  const n = Math.min(Math.max(1, limit), list.length) || 1;
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/**
 * Compress many images concurrently (default concurrency 6).
 * Order of results matches the filtered input order.
 */
export async function compressImages(
  files: File[] | FileList,
  options: CompressManyOptions = {},
): Promise<(CompressResult | null)[]> {
  const accept = options.accept || DEFAULT_ACCEPT;
  const list = Array.from(files).filter(accept);
  const concurrency = options.concurrency ?? 6;
  let done = 0;
  return mapPool(list, concurrency, async (file) => {
    try {
      const result = await compressImage(file, options);
      done++;
      options.onProgress?.(done, list.length, result, file);
      return result;
    } catch {
      done++;
      options.onProgress?.(done, list.length, null, file);
      return null;
    }
  });
}

/** Load a Blob/File into an ImageBitmap (preferred) or HTMLImageElement. */
export async function blobToDrawable(
  blob: Blob,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through */
    }
  }
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      res(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

/** Compress (or skip) then decode — alias for gallery pipelines. */
export async function compressAndDecode(
  file: File,
  options: CompressOptions = {},
): Promise<{ drawable: ImageBitmap | HTMLImageElement; result: CompressResult }> {
  return importAndDecode(file, options);
}

/**
 * Single-pass import helper: compress/skip + decode for canvas/gallery use.
 */
export async function importAndDecode(
  file: File,
  options: CompressOptions = {},
): Promise<{ drawable: ImageBitmap | HTMLImageElement; result: CompressResult }> {
  const result = await compressImage(file, options);
  const drawable = await blobToDrawable(result.blob);
  return { drawable, result };
}
