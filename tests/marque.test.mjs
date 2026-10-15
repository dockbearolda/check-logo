import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

/* AUCUNE MARQUE. L'app se vend seule : aucun nom d'entreprise, et « nous »
   pour celui qui fabrique. Les mots refusés sont encodés ici, pour ne pas
   les écrire eux-mêmes dans le dépôt. On lit tout ce qui se publie — pas
   `vendor/` (du code tiers copié tel quel), pas `essais/` (local, ignoré),
   pas les fichiers binaires. */
const INTERDITS = ['b2xkYQ==', 'YXRlbGllcg=='].map(m => Buffer.from(m, 'base64').toString())
const RACINE = fileURLToPath(new URL('..', import.meta.url))
const ECARTES = new Set(['vendor', 'essais', 'node_modules'])
const BINAIRES = new Set(['.png', '.jpg', '.woff2', '.pdf', '.heic', '.ico'])

function fichiers(dossier) {
  const tous = []
  for (const nom of readdirSync(dossier)) {
    if (nom.startsWith('.') || ECARTES.has(nom)) continue
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) tous.push(...fichiers(chemin))
    else if (!BINAIRES.has(extname(nom).toLowerCase())) tous.push(chemin)
  }
  return tous
}

test('aucun nom d’entreprise, nulle part', () => {
  const trouves = []
  for (const chemin of fichiers(RACINE)) {
    const lignes = readFileSync(chemin, 'utf8').split('\n')
    lignes.forEach((ligne, i) => {
      if (INTERDITS.some(m => ligne.toLowerCase().includes(m))) trouves.push(`${relative(RACINE, chemin)}:${i + 1}`)
    })
  }
  assert.deepEqual(trouves, [])
})
