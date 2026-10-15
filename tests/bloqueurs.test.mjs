import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

/* UN NOM QUE LES BLOQUEURS DE PUB NE PRENNENT PAS POUR UN MOUCHARD.
   15 octobre 2026 : chez Charlie, chaque image répondait « Le fichier ne
   s'ouvre pas ». Son bloqueur de pub refusait `lib/analyse.js` : la liste
   EasyPrivacy, active d'office dans uBlock Origin, AdGuard et Brave, bloque
   tout fichier nommé ainsi — elle y voit des statistiques de visite. Le
   contrôle ne pouvait plus rien mesurer.
   Ces listes bloquent par le NOM du fichier. Aucun fichier publié ne porte
   donc un mot qu'elles visent : statistiques, suivi, publicité. */
const VISES = /analy[sz]|track|traq|stat(s|istic)?([^a-z]|$)|pixel|beacon|metric|telemetr|counter|compteur|advert|banner|banniere|(^|[^a-z])ads?([^a-z]|$)|pub([^a-z]|$)|gtag|piwik|matomo|hotjar|fingerprint|collect|audience|visit|cookie|utm|referr|plausible|fbevent/i
const RACINE = fileURLToPath(new URL('..', import.meta.url))
const PRIVES = new Set(['tests', 'outils', 'essais', 'node_modules'])

function publies(dossier) {
  const tous = []
  for (const nom of readdirSync(dossier)) {
    if (nom.startsWith('.') || PRIVES.has(nom)) continue
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) tous.push(chemin, ...publies(chemin))
    else tous.push(chemin)
  }
  return tous
}

test('aucun fichier publié ne porte un nom que les bloqueurs de pub visent', () => {
  const vises = publies(RACINE).map(c => relative(RACINE, c)).filter(c => VISES.test(basename(c)))
  assert.deepEqual(vises, [])
})

test('le motif attrape bien le nom qui a cassé le contrôle', () => {
  assert.ok(VISES.test('analyse.js'))
  for (const sain of ['mesures.js', 'lecture.js', 'verdict.js', 'regles.js', 'travail.js', 'format.js', 'app.js', 'sw.js']) assert.ok(!VISES.test(sain), sain)
})
