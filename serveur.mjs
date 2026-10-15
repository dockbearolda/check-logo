/* Le serveur du poste, sans paquet : il sert les fichiers tels quels, rien de
   caché. En ligne, c'est GitHub Pages qui sert le dossier — ce fichier ne
   sert qu'en local (`npm start`, ou l'aperçu « check-logo » de Claude Code). */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('.', import.meta.url))
const PORT = Number(process.env.PORT) || 8140
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf',
}

createServer(async (req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const fichier = normalize(join(RACINE, chemin.endsWith('/') ? chemin + 'index.html' : chemin))
  /* Rien hors du dossier, rien de caché DANS le dossier (le chemin du dossier
     lui-même peut, lui, passer par un `.claude/`). */
  const dedans = fichier.slice(RACINE.length).split(sep)
  if (!fichier.startsWith(RACINE) || dedans.some(p => p.startsWith('.') && p.length > 1)) { res.writeHead(403).end(); return }
  try {
    const corps = await readFile(fichier)
    res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(corps)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable')
  }
}).listen(PORT, () => console.log(`Check logo : http://localhost:${PORT}/`))
