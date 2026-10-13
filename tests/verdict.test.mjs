import test from 'node:test'
import assert from 'node:assert/strict'
import { juger, ecrirePrompt, nomCouleur } from '../lib/verdict.js'
import { analyser } from '../lib/analyse.js'
import { toile, rect, disque, flouter, agrandir, photo } from './dessin.mjs'

/* LA RÈGLE (Charlie, 13 octobre 2026) : « ce qui est bon, c'est une photo en
   haute résolution ou un fichier vectoriel ; pour le reste on renvoie un
   prompt si ça vient de ChatGPT » — « un logo non vectoriel, avec un fond
   noir par exemple, c'est une reprise facturée ou un prompt à envoyer ». */

const BLANC = [255, 255, 255, 255], NOIR = [0, 0, 0, 255], ROUGE = [220, 30, 40]

/* Un logo d'essai de `l` pixels de large, à plat : un disque rouge, une
   barre grise. */
function logo(l, fond = [0, 0, 0, 0]) {
  const h = Math.round(l * 0.6), t = toile(l, h, fond)
  disque(t, l * 0.28, h * 0.5, h * 0.36, ROUGE)
  rect(t, Math.round(l * 0.56), Math.round(h * 0.25), Math.round(l * 0.38), Math.round(h * 0.5), [90, 100, 110, 255])
  return t
}
/* Une illustration détourée : un dégradé à l'intérieur d'un rectangle. */
function illustration(l) {
  const h = Math.round(l * 0.6), t = toile(l, h)
  for (let y = Math.round(h * 0.1); y < h * 0.9; y++) for (let x = Math.round(l * 0.05); x < l * 0.95; x++) {
    const i = (y * l + x) * 4, k = x / l, j = y / h
    t.d[i] = 255 * k; t.d[i + 1] = 255 * j; t.d[i + 2] = 255 * (1 - k); t.d[i + 3] = 255
  }
  return t
}
/* Le faux fond transparent d'une IA. */
function surDamier(t, case_ = 16) {
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.l; x++) {
    const i = (y * t.l + x) * 4
    if (t.d[i + 3] > 128) continue
    const v = ((x / case_) | 0) + ((y / case_) | 0) & 1 ? 204 : 255
    t.d[i] = t.d[i + 1] = t.d[i + 2] = v; t.d[i + 3] = 255
  }
  return t
}
/* Une image jugée comme un fichier de `natif` pixels de large (une grande
   photo s'analyse réduite : on ne dessine pas 4 000 pixels pour un essai). */
const image = (t, plus = {}, natif = t.l) => juger({ format: 'png', sorte: 'image', natif: { l: natif, h: Math.round(natif * t.h / t.l) }, ia: null, ...plus }, analyser(t.d, t.l, t.h))

test('le nom d’une couleur', () => {
  assert.equal(nomCouleur([0, 0, 0]), 'noir')
  assert.equal(nomCouleur([250, 250, 250]), 'blanc')
  assert.equal(nomCouleur([251, 11, 12]), 'rouge')
  assert.equal(nomCouleur([20, 60, 200]), 'bleu')
})

test('un fichier vectoriel : c’est bon, sans prompt', () => {
  const t = logo(1600)
  const v = juger({ format: 'pdf', sorte: 'vecteur', natif: null, ia: null }, analyser(t.d, t.l, t.h))
  assert.equal(v.etat, 'ok')
  assert.equal(v.mot, 'C’est bon')
  assert.equal(v.titre, 'Fichier vectoriel.')
  assert.equal(v.prompt, '')
})

test('une photo en haute résolution : c’est bon, sans prompt', () => {
  const v = image(photo(1600, 1200), { format: 'jpg' }, 4032)
  assert.equal(v.etat, 'ok')
  assert.equal(v.mot, 'C’est bon')
  assert.equal(v.titre, 'Photo en haute résolution.')
  assert.equal(v.prompt, '')
})

test('un logo en image, même net et détouré, N’EST PAS bon', () => {
  for (const t of [logo(1400), logo(1400, BLANC), logo(1400, NOIR)]) {
    const v = image(t)
    assert.equal(v.etat, 'limite')
    assert.equal(v.mot, 'À reprendre')
    assert.match(v.titre, /^Logo non vectoriel : reprise facturée, ou prompt à envoyer\.$/)
    assert.match(v.dire, /ce n’est pas un fichier vectoriel/)
    assert.match(v.dire, /S’il a été créé avec ChatGPT/)
    assert.match(v.dire, /cette reprise est facturée/)
    assert.match(v.prompt, /en version vectorielle/)
    assert.match(v.prompt, /vrai fichier vectoriel SVG/)
  }
  /* même en très grand : un logo doit être vectoriel */
  assert.equal(image(logo(1400), {}, 5000).etat, 'limite')
})

test('un logo sur fond noir : le prompt retire le fond noir', () => {
  const v = image(logo(1400, NOIR))
  assert.match(v.prompt, /Retire le fond noir s’il ne fait pas partie du logo/)
  assert.ok(v.constats.some(c => c.texte === 'Fond noir à retirer.'))
  assert.match(image(logo(1400, BLANC)).prompt, /Retire le fond blanc :/)
  assert.ok(!/Retire le fond/.test(image(logo(1400)).prompt))   /* déjà détouré */
})

test('un fichier signé par ChatGPT : le prompt d’abord', () => {
  const v = image(logo(1400, NOIR), { ia: 'ChatGPT' })
  assert.match(v.titre, /prompt à envoyer, ou reprise facturée/)
  assert.match(v.dire, /Il a été créé avec ChatGPT : renvoyez-lui votre logo/)
  assert.match(v.dire, /cette reprise est facturée/)
  assert.equal(v.promptPour, 'Le prompt à lui envoyer, pour ChatGPT')
  assert.ok(v.constats.some(c => c.texte === 'Créé avec ChatGPT.'))
  assert.equal(image(logo(1400)).promptPour, 'S’il vient de ChatGPT : le prompt à lui envoyer')
})

test('une photo ou une illustration trop petite : à reprendre', () => {
  const p = image(photo(1536, 1024), { format: 'jpg' })
  assert.equal(p.etat, 'limite')
  assert.match(p.titre, /^Image trop petite/)
  assert.match(p.dire, /elle n’est pas en haute résolution/)
  assert.match(p.dire, /envoyez-nous plutôt l’originale/)
  assert.match(p.prompt, /plus haute résolution possible : au moins 2\s000 pixels/)
  assert.ok(!/SVG/.test(p.prompt))
  const i = image(illustration(1300), { ia: 'ChatGPT' })
  assert.equal(i.etat, 'limite')
  assert.match(i.dire, /Elle a été créée avec ChatGPT/)
  assert.match(i.prompt, /Garde le même style/)
})

test('un faux damier : à reprendre, et le prompt le nomme', () => {
  const v = image(surDamier(logo(1200)))
  assert.equal(v.etat, 'limite')
  assert.match(v.prompt, /supprime le damier gris et blanc/)
  assert.ok(v.constats.some(c => /Faux fond transparent/.test(c.texte)))
})

test('des ombres : le prompt les retire', () => {
  const t = toile(1200, 700)
  rect(t, 300, 200, 600, 360, [0, 0, 0, 120])
  const o = flouter(t, 12)
  rect(o, 280, 180, 600, 340, NOIR)
  const v = image(o)
  assert.equal(v.etat, 'limite')
  assert.match(v.prompt, /Supprime les ombres portées/)
})

test('trop petit ou trop flou : inutilisable', () => {
  const petit = image(logo(300, BLANC), { format: 'jpg' })
  assert.equal(petit.etat, 'non')
  assert.equal(petit.mot, 'Inutilisable')
  assert.equal(petit.titre, 'Image trop petite.')
  assert.match(petit.dire, /retournez dans la conversation où il a été créé/)
  assert.ok(!/reprise/.test(petit.dire))             /* rien à reprendre */
  assert.ok(petit.prompt.length > 0)
  const flou = image(agrandir(logo(250), 4))
  assert.equal(flou.etat, 'non')
  assert.equal(flou.titre, 'Image trop floue.')
})

test('un PDF qui n’est qu’une image n’est pas un vectoriel', () => {
  const v = image(logo(1400), { format: 'pdf' })
  assert.equal(v.etat, 'limite')
  assert.ok(v.constats.some(c => /PDF qui ne contient qu’une image.*ce n’est pas un fichier vectoriel/.test(c.texte)))
})

test('le prompt ne demande que ce qu’il y a à corriger', () => {
  const p = ecrirePrompt({ logo: true, fond: '', ombres: true })
  assert.match(p, /^Refais ce logo à l’identique, en version vectorielle/)
  assert.match(p, /ombres portées/)
  assert.ok(!/damier|Retire le fond|haute résolution/.test(p))
  const q = ecrirePrompt({ logo: false, fond: 'décor', ombres: false })
  assert.match(q, /^Refais ce visuel à l’identique/)
  assert.match(q, /un fond ou un décor qui ne fait pas partie du dessin/)
  assert.ok(!/SVG/.test(q))
})

test('ce qui ne s’ouvre pas : une impasse, jamais une erreur', () => {
  for (const impasse of ['eps', 'psd', 'tif', 'bureau', 'inconnu', 'autre-chose']) {
    const v = juger({ format: null, sorte: 'impasse', impasse, natif: null }, null)
    assert.ok(v.dire.length > 20)
    assert.equal(v.prompt, '')
    assert.equal(v.constats.length, 1)
  }
  assert.equal(juger({ sorte: 'impasse', impasse: 'eps' }, null).etat, 'inconnu')
  assert.equal(juger({ sorte: 'impasse', impasse: 'bureau' }, null).etat, 'non')
  const vide = toile(200, 200, BLANC)
  assert.equal(image(vide).titre, 'Le fichier est vide.')
  const mixte = logo(1200)
  assert.equal(juger({ format: 'pdf', sorte: 'mixte', natif: null }, analyser(mixte.d, mixte.l, mixte.h)).etat, 'inconnu')
})
