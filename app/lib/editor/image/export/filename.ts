const RESERVED_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizeImageExportFilename(value: string | null | undefined, fallback = "image-export") {
  const compact = (value ?? "")
    .replace(RESERVED_FILENAME_CHARS, "-")
    .replace(/\s+/g, " ")
    .trim();

  const withoutTrailingDots = compact.replace(/[. ]+$/g, "");
  return withoutTrailingDots || fallback;
}

export function withPngExtension(filename: string) {
  return filename.toLowerCase().endsWith(".png") ? filename : `${filename}.png`;
}
