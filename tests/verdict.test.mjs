import test from 'node:test'
import assert from 'node:assert/strict'
import { juger, ecrirePrompt, nomCouleur } from '../lib/verdict.js'
import { analyser } from '../lib/analyse.js'
import { toile, rect, disque, flouter, agrandir, photo } from './dessin.mjs'

const BLANC = [255, 255, 255, 255], NOIR = [0, 0, 0, 255], ROUGE = [220, 30, 40]

/* Un logo d'essai de `l` pixels de large, à plat : un disque rouge, une
   barre noire. */
function logo(l, fond = [0, 0, 0, 0]) {
  const h = Math.round(l * 0.6), t = toile(l, h, fond)
  disque(t, l * 0.28, h * 0.5, h * 0.36, ROUGE)
  rect(t, Math.round(l * 0.56), Math.round(h * 0.25), Math.round(l * 0.38), Math.round(h * 0.5), NOIR)
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
const image = (t, plus = {}) => juger({ format: 'png', sorte: 'image', natif: { l: t.l, h: t.h }, ia: null, ...plus }, analyser(t.d, t.l, t.h))

test('le nom d’une couleur', () => {
  assert.equal(nomCouleur([0, 0, 0]), 'noir')
  assert.equal(nomCouleur([250, 250, 250]), 'blanc')
  assert.equal(nomCouleur([251, 11, 12]), 'rouge')
  assert.equal(nomCouleur([20, 60, 200]), 'bleu')
  assert.equal(nomCouleur([30, 160, 60]), 'vert')
})

test('un vectoriel : c’est bon, sans prompt', () => {
  const t = logo(1600)
  const v = juger({ format: 'pdf', sorte: 'vecteur', natif: null, ia: null }, analyser(t.d, t.l, t.h))
  assert.equal(v.etat, 'ok')
  assert.equal(v.mot, 'C’est bon')
  assert.equal(v.titre, 'Logo vectorisé.')
  assert.equal(v.prompt, '')
  assert.match(v.dire, /fichier vectoriel/)
})

test('une image propre (nette, à plat, détourée) : c’est bon, l’atelier la vectorise', () => {
  const v = image(logo(1400))
  assert.equal(v.etat, 'ok')
  assert.equal(v.mot, 'C’est bon')
  assert.match(v.titre, /l’atelier la vectorise/)
  assert.equal(v.prompt, '')
  assert.ok(!/facturée/.test(v.dire))
})

test('une image propre sur fond blanc : c’est bon, le fond part à l’atelier', () => {
  const v = image(logo(1200, BLANC), { format: 'jpg' })
  assert.equal(v.etat, 'ok')
  assert.match(v.dire, /Nous retirerons le fond blanc/)
  assert.equal(image(logo(1200, NOIR)).etat, 'ok')
  assert.match(image(logo(1200, NOIR)).dire, /le fond noir fait-il partie de votre logo/)
})

test('une illustration riche et nette : bonne telle quelle, toute reprise est facturée', () => {
  const v = image(illustration(1400))
  assert.equal(v.etat, 'ok')
  assert.equal(v.mot, 'C’est bon, tel quel')
  assert.match(v.titre, /facturée/)
  assert.match(v.dire, /toute reprise ou modification pour l’améliorer sera facturée/)
  assert.equal(v.prompt, '')
})

test('un fond ou un décor : à refaire, avec le prompt qui le retire', () => {
  const p = photo(1600, 1200)
  const v = image(p, { format: 'png' })
  assert.equal(v.etat, 'limite')
  assert.equal(v.mot, 'À refaire')
  assert.equal(v.titre, 'Un fond à retirer.')
  assert.match(v.prompt, /Retire complètement le fond et le décor/)
  assert.match(v.dire, /S’il a été créé avec ChatGPT ou une autre IA/)
  assert.match(v.dire, /en rectangle avec son fond/)
  assert.match(v.dire, /sera facturée/)
})

test('un faux damier : à refaire, et le prompt le nomme', () => {
  const v = image(surDamier(logo(1200)))
  assert.equal(v.etat, 'limite')
  assert.equal(v.titre, 'Faux fond transparent.')
  assert.match(v.prompt, /supprime le damier gris et blanc/)
  assert.match(v.prompt, /Style vectoriel/)          /* un logo à plat le reste */
  assert.ok(!/Retire complètement le fond/.test(v.prompt))
})

test('des ombres : à refaire, et le prompt les retire', () => {
  const t = toile(1200, 700)
  rect(t, 300, 200, 600, 360, [0, 0, 0, 120])
  const o = flouter(t, 12)
  rect(o, 280, 180, 600, 340, NOIR)
  const v = image(o)
  assert.equal(v.etat, 'limite')
  assert.equal(v.titre, 'Des ombres à retirer.')
  assert.match(v.prompt, /Supprime les ombres portées/)
})

test('une image floue mais grande : à refaire, en plus grand', () => {
  const v = image(agrandir(logo(600), 3))
  assert.equal(v.etat, 'limite')
  assert.equal(v.titre, 'Image floue.')
  assert.match(v.prompt, /très haute résolution/)
  assert.ok(!v.constats.some(c => /Ombres/.test(c.texte)))   /* le flou n'est pas une ombre */
})

test('une illustration trop petite : à refaire, en plus grand', () => {
  const v = image(illustration(800))
  assert.equal(v.etat, 'limite')
  assert.equal(v.titre, 'Image trop petite.')
  assert.match(v.prompt, /très haute résolution/)
  assert.match(v.prompt, /Garde le même style/)       /* on ne l'aplatit pas */
})

test('trop petite ou trop floue : inutilisable', () => {
  const petite = image(logo(300, BLANC), { format: 'jpg' })
  assert.equal(petite.etat, 'non')
  assert.equal(petite.mot, 'Inutilisable')
  assert.equal(petite.titre, 'Image trop petite.')
  assert.match(petite.dire, /Retournez dans la conversation où il a été créé/)
  assert.match(petite.prompt, /très haute résolution/)
  const floue = image(agrandir(logo(250), 4))
  assert.equal(floue.etat, 'non')
  assert.equal(floue.titre, 'Image trop floue.')
})

test('un fichier signé par ChatGPT : on le dit', () => {
  const v = image(surDamier(logo(1200)), { ia: 'ChatGPT' })
  assert.match(v.dire, /Il a été créé avec ChatGPT : le plus simple est de lui redemander/)
  assert.ok(v.constats.some(c => c.texte === 'Créé avec ChatGPT.'))
})

test('un PDF qui n’est qu’une image n’est pas un vectoriel', () => {
  const v = image(logo(1400), { format: 'pdf' })
  assert.ok(v.constats.some(c => /PDF qui ne contient qu’une image/.test(c.texte)))
})

test('le prompt ne demande que ce qu’il y a à corriger', () => {
  const p = ecrirePrompt({ aplat: true, fond: false, damier: false, ombres: true, grand: false })
  assert.match(p, /^Refais ce logo à l’identique/)
  assert.match(p, /ombres portées/)
  assert.ok(!/damier|décor|haute résolution, le plus grand/.test(p))
  assert.match(p, /en SVG si tu peux/)
  const q = ecrirePrompt({ aplat: false, fond: true, damier: false, ombres: false, grand: true })
  assert.match(q, /^Refais ce visuel à l’identique/)
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
