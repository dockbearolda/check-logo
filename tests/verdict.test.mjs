import test from 'node:test'
import assert from 'node:assert/strict'
import { juger as jugerBrut, cm as cmBrut, nomCouleur } from '../lib/verdict.js'
import { analyser } from '../lib/analyse.js'
import { toile, rect, disque, agrandir, photo } from './dessin.mjs'

const BLANC = [255, 255, 255, 255], NOIR = [0, 0, 0, 255], ROUGE = [220, 30, 40]

/* Les phrases portent des espaces insécables (« 17 cm ») : les essais les
   lisent comme des espaces ordinaires. */
const lisse = t => t.replace(/\u00a0/g, ' ')
const cm = (...a) => lisse(cmBrut(...a))
function juger(fichier, m) {
  const v = jugerBrut(fichier, m)
  for (const c of [v.dtf, v.usinage]) { c.titre = lisse(c.titre); c.dire = lisse(c.dire) }
  for (const e of v.dtf.emplacements || []) e.texte = lisse(e.texte)
  for (const c of v.constats) c.texte = lisse(c.texte)
  return v
}

/* Un logo d'essai de `l` pixels de large : un disque rouge, une barre noire. */
function logo(l, fond = [0, 0, 0, 0]) {
  const h = Math.round(l * 0.6), t = toile(l, h, fond)
  disque(t, l * 0.28, h * 0.5, h * 0.36, ROUGE)
  rect(t, Math.round(l * 0.56), Math.round(h * 0.25), Math.round(l * 0.38), Math.round(h * 0.5), NOIR)
  return t
}
const image = (t, format = 'png') => juger({ format, sorte: 'image', natif: { l: t.l, h: t.h } }, analyser(t.d, t.l, t.h))

test('les centimètres : on ne promet jamais trop', () => {
  assert.equal(cm(178), '17 cm')
  assert.equal(cm(89), '8,5 cm')
  assert.equal(cm(55), '5,5 cm')
  assert.equal(cm(47, Math.ceil), '5 cm')
  assert.equal(cm(121, Math.ceil), '13 cm')
})

test('le nom d’une couleur', () => {
  assert.equal(nomCouleur([0, 0, 0]), 'noir')
  assert.equal(nomCouleur([250, 250, 250]), 'blanc')
  assert.equal(nomCouleur([128, 128, 128]), 'gris')
  assert.equal(nomCouleur([251, 11, 12]), 'rouge')
  assert.equal(nomCouleur([20, 60, 200]), 'bleu')
  assert.equal(nomCouleur([30, 160, 60]), 'vert')
  assert.equal(nomCouleur([250, 220, 30]), 'jaune')
})

test('un vectoriel : bon partout', () => {
  const t = logo(1600)
  const v = juger({ format: 'pdf', sorte: 'vecteur', natif: null }, analyser(t.d, t.l, t.h))
  assert.equal(v.dtf.etat, 'ok')
  assert.ok(v.dtf.emplacements.every(e => e.etat === 'ok'))
  assert.equal(v.usinage.etat, 'ok')
  assert.match(v.usinage.dire, /une seule teinte/)   /* deux couleurs : on prévient */
})

test('une grande image nette : toutes les tailles en DTF, à retracer pour l’usinage', () => {
  const v = image(logo(3200))
  assert.equal(v.dtf.etat, 'ok')
  assert.equal(v.dtf.titre, 'Net à toutes les tailles')
  assert.equal(v.usinage.etat, 'limite')
  assert.equal(v.usinage.titre, 'À retracer à l’atelier')
})

test('une image moyenne : une taille maximale, dite en centimètres', () => {
  const v = image(logo(1000, BLANC), 'jpg')
  assert.equal(v.dtf.etat, 'limite')
  /* le dessin fait ~940 px de large : 940 / 200 dpi = 11,9 cm */
  assert.match(v.dtf.titre, /^Net jusqu’à 1[12](,5)? cm de large$/)
  const [coeur, bebe, tote, dos] = v.dtf.emplacements
  assert.equal(coeur.etat, 'ok')
  assert.equal(bebe.etat, 'limite')
  assert.equal(tote.etat, 'non')
  assert.equal(dos.etat, 'non')
  assert.match(v.dtf.dire, /dans le dos par exemple/)
  assert.match(v.dtf.dire, /Nous retirerons le fond blanc/)
})

test('une petite image : non, et on demande le fichier d’origine', () => {
  const v = image(logo(300, BLANC), 'jpg')
  assert.equal(v.dtf.etat, 'non')
  assert.equal(v.dtf.titre, 'Image trop petite')
  assert.equal(v.dtf.emplacements, null)
  assert.match(v.dtf.dire, /fichier d’origine/)
  assert.equal(v.usinage.etat, 'non')
  assert.match(v.usinage.dire, /trop petite/)
})

test('une image agrandie : floue, pas « petite »', () => {
  const v = image(agrandir(logo(250), 4))
  assert.equal(v.dtf.etat, 'non')
  assert.equal(v.dtf.titre, 'Image trop floue')
  assert.equal(v.usinage.etat, 'non')
  assert.match(v.usinage.dire, /trop floue/)
  assert.ok(v.constats.some(c => /floue/.test(c.texte)))
  assert.ok(!v.constats.some(c => /Ombres/.test(c.texte)))   /* le flou n'est pas une ombre */
})

test('une photo : en rectangle pour le DTF, jamais en usinage', () => {
  const p = photo(1600, 1200)
  const v = image(p, 'jpg')
  assert.equal(v.dtf.etat, 'limite')
  assert.equal(v.dtf.titre, 'Photo : imprimable en rectangle')
  assert.match(v.dtf.dire, /jusqu’à 20 cm de large/)
  assert.equal(v.usinage.etat, 'non')
  assert.match(v.usinage.dire, /photo/)
})

test('un fond de couleur : on pose la question', () => {
  const v = image(logo(1200, NOIR), 'jpg')
  assert.match(v.dtf.dire, /le fond noir fait-il partie de votre logo/)
})

test('des traits trop fins : dits, et montrés sur l’aperçu', () => {
  const t = logo(1600)
  rect(t, 100, 900, 1400, 1, NOIR)   /* un filet d'un pixel */
  const v = image(t)
  assert.equal(v.dtf.titre, 'Traits trop fins')
  assert.equal(v.dtf.etat, 'limite')
  assert.ok(v.apercu.finPx > 1)
  assert.ok(v.constats.some(c => c.etat === 'limite' && /Traits/.test(c.texte)))
})

test('ce qui ne s’ouvre pas : une impasse, jamais une erreur', () => {
  for (const impasse of ['eps', 'psd', 'tif', 'bureau', 'inconnu', 'autre-chose']) {
    const v = juger({ format: null, sorte: 'impasse', impasse, natif: null }, null)
    assert.ok(v.dtf.dire.length > 20)
    assert.equal(v.dtf.emplacements, null)
    assert.equal(v.constats.length, 1)
  }
  assert.equal(juger({ sorte: 'impasse', impasse: 'eps' }, null).dtf.etat, 'inconnu')
  assert.equal(juger({ sorte: 'impasse', impasse: 'bureau' }, null).dtf.etat, 'non')
  const vide = toile(200, 200, BLANC)
  assert.equal(image(vide).dtf.titre, 'Fichier vide')
})
