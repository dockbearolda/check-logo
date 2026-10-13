#!/usr/bin/env node
/* ================================================================== LE BANC
   Le contrôle passé sur de vrais fichiers, hors du navigateur : pour régler
   un seuil de lib/regles.js, on regarde ce qu'il change ICI avant de pousser.

     node outils/banc.mjs <fichier|dossier> [...]

   Lit les PNG tels quels ; les JPG, WebP, HEIC… passent par `sips` (macOS).
   Une ligne par fichier : ses mesures, puis les deux verdicts. */
import { readFileSync, readdirSync, statSync, mkdtempSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { lirePng } from './png.mjs'
import { analyser } from '../lib/analyse.js'
import { juger } from '../lib/verdict.js'
import { COTE_ANALYSE } from '../lib/regles.js'

const fichiers = []
const explorer = p => {
  if (statSync(p).isDirectory()) { for (const e of readdirSync(p)) explorer(join(p, e)) }
  else if (/\.(png|jpe?g|webp|gif|heic|bmp|tiff?)$/i.test(p)) fichiers.push(p)
}
for (const a of process.argv.slice(2)) explorer(a)
if (!fichiers.length) { console.error('Usage : node outils/banc.mjs <fichier|dossier> [...]'); process.exit(1) }

/* La réduction au grand côté d'analyse, par moyenne de zone — ce que fait le
   canevas du navigateur, à peu près. */
function reduire({ d, l, h }, cote) {
  const k = Math.max(l, h) / cote
  if (k <= 1) return { d, l, h }
  const L = Math.round(l / k), H = Math.round(h / k)
  const s = new Uint8ClampedArray(L * H * 4)
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < L; X++) {
    const x0 = Math.floor(X * k), x1 = Math.min(l, Math.max(x0 + 1, Math.floor((X + 1) * k)))
    const y0 = Math.floor(Y * k), y1 = Math.min(h, Math.max(y0 + 1, Math.floor((Y + 1) * k)))
    let r = 0, g = 0, b = 0, a = 0
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * l + x) * 4, o = d[i + 3]; r += d[i] * o; g += d[i + 1] * o; b += d[i + 2] * o; a += o }
    const j = (Y * L + X) * 4, n = (x1 - x0) * (y1 - y0)
    s[j] = a ? r / a : 0; s[j + 1] = a ? g / a : 0; s[j + 2] = a ? b / a : 0; s[j + 3] = a / n
  }
  return { d: s, l: L, h: H }
}

const temp = mkdtempSync(join(tmpdir(), 'banc-'))
for (const f of fichiers) {
  try {
    let png = f
    const format = extname(f).slice(1).toLowerCase().replace('jpeg', 'jpg')
    if (format !== 'png') { png = join(temp, basename(f) + '.png'); execFileSync('sips', ['-s', 'format', 'png', f, '--out', png], { stdio: 'ignore' }) }
    const natif = lirePng(readFileSync(png))
    const t0 = performance.now()
    const image = reduire(natif, COTE_ANALYSE)
    const m = analyser(image.d, image.l, image.h)
    const ms = Math.round(performance.now() - t0)
    const v = juger({ format, sorte: 'image', natif: { l: natif.l, h: natif.h } }, m)
    const mesures = m.vide ? 'vide' : `fond ${m.fond.sorte}${m.fond.sorte === 'uni' ? ' ' + m.fond.couleur : ''} · aplat ${m.aplat.toFixed(2)} · ${m.couleurs.length} coul. · flou ${m.flou == null ? '—' : m.flou.toFixed(2)} · fin ${m.fin || '—'} px · fondu ${(m.fondu * 100).toFixed(1)} %`
    console.log(`\n${basename(f)}  ${natif.l}×${natif.h}  (${ms} ms)\n  ${mesures}\n  DTF     [${v.dtf.etat}] ${v.dtf.titre}\n  USINAGE [${v.usinage.etat}] ${v.usinage.titre}`)
  } catch (e) {
    console.log(`\n${basename(f)}\n  illisible par le banc : ${e.message}`)
  }
}
