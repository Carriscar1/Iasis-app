// ─────────────────────────────────────────────
//  IASIS — Loja · detecção de fotos reais
//  Se o usuário colocar uma foto em site/public/images/<nome>.<ext>,
//  ela é usada automaticamente no lugar da ilustração vetorial.
//  (Roda no servidor — Server Components apenas.)
// ─────────────────────────────────────────────
import fs from 'fs';
import path from 'path';

const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

/** Retorna a URL pública da foto (ex: /images/dispenser.jpg) ou null se não existir. */
export function findPhoto(base: string): string | null {
  const dir = path.join(process.cwd(), 'public', 'images');
  for (const ext of EXTS) {
    const file = path.join(dir, `${base}.${ext}`);
    try {
      if (fs.existsSync(file)) return `/images/${base}.${ext}`;
    } catch {
      /* ignora */
    }
  }
  return null;
}
