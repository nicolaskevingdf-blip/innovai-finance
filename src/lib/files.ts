/** Detecta o tipo real pelo conteúdo (assinatura do arquivo), sem confiar no tipo informado pelo navegador. */
export function sniffType(b: Uint8Array): string | null {
  const has = (sig: number[], off = 0) => sig.every((v, i) => b[off + i] === v);
  if (has([0x25, 0x50, 0x44, 0x46])) return "application/pdf"; // %PDF
  if (has([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (has([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (has([0x52, 0x49, 0x46, 0x46]) && has([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  if (has([0x66, 0x74, 0x79, 0x70], 4)) { // ....ftyp (HEIC/HEIF)
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (["heic", "heix", "mif1", "msf1", "heif"].includes(brand)) return "image/heic";
  }
  return null;
}
