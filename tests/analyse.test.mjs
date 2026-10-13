import test from 'node:test'
import assert from 'node:assert/strict'
import { lireFond, lireEncre, lireCouleurs, lireFondu, lireFlou, analyser } from '../lib/analyse.js'
import { FLOU_REF, FLOU_NET, PART_APLAT, FONDU_PART } from '../lib/regles.js'
import { toile, rect, disque, flouter, agrandir, photo } from './dessin.mjs'

const BLANC = [255, 255, 255, 255], NOIR = [0, 0, 0, 255], ROUGE = [220, 30, 40, 255], BLEU = [20, 60, 200, 255]

/* Un logo d'essai : un disque rouge et une barre bleue, bords lissés. */
function logo(l = 400, h = 300, fond = [0, 0, 0, 0]) {
  const t = toile(l, h, fond)
  disque(t, l * 0.3, h * 0.5, h * 0.3, ROUGE)
  rect(t, Math.round(l * 0.55), Math.round(h * 0.3), Math.round(l * 0.35), Math.round(h * 0.4), BLEU)
  return t
}

test('le fond : transparent, uni ou plein', () => {
  const a = logo()
  assert.equal(lireFond(a.d, a.l, a.h).sorte, 'transparent')
  const b = logo(400, 300, BLANC)
  const fb = lireFond(b.d, b.l, b.h)
  assert.equal(fb.sorte, 'uni')
  assert.equal(fb.blanc, true)
  const c = logo(400, 300, NOIR)
  const fc = lireFond(c.d, c.l, c.h)
  assert.equal(fc.sorte, 'uni')
  assert.equal(fc.blanc, false)
  assert.deepEqual(fc.couleur, [0, 0, 0])
  const p = photo(320, 240)
  assert.equal(lireFond(p.d, p.l, p.h).sorte, 'plein')
})

test('le fond uni tient même quand le logo touche un bord', () => {
  const t = toile(400, 200, BLANC)
  rect(t, 0, 60, 400, 30, NOIR)   /* une barre d'un bord à l'autre */
  assert.equal(lireFond(t.d, t.l, t.h).sorte, 'uni')
})

test('l’encre : son cadre', () => {
  const t = toile(200, 100)
  rect(t, 50, 20, 100, 40, NOIR)
  const { total, cadre } = lireEncre(t.d, t.l, t.h, lireFond(t.d, t.l, t.h))
  assert.equal(total, 4000)
  assert.deepEqual(cadre, { x: 50, y: 20, l: 100, h: 40 })
})

test('les couleurs : deux aplats comptent pour deux', () => {
  for (const fond of [[0, 0, 0, 0], BLANC]) {
    const t = logo(400, 300, fond)
    const f = lireFond(t.d, t.l, t.h)
    const { encre } = lireEncre(t.d, t.l, t.h, f)
    const c = lireCouleurs(t.d, t.l, t.h, encre)
    assert.equal(c.couleurs.length, 2)
    assert.ok(c.aplat >= 0.98, 'aplat ' + c.aplat)
  }
})

test('les couleurs : un dégradé n’est pas un aplat, une photo non plus', () => {
  const t = toile(400, 300)
  for (let y = 50; y < 250; y++) for (let x = 40; x < 360; x++) {
    const i = (y * t.l + x) * 4, k = (x - 40) / 320
    t.d[i] = 255 * k; t.d[i + 1] = 40; t.d[i + 2] = 255 * (1 - k); t.d[i + 3] = 255
  }
  const { encre } = lireEncre(t.d, t.l, t.h, lireFond(t.d, t.l, t.h))
  assert.ok(lireCouleurs(t.d, t.l, t.h, encre).aplat < PART_APLAT)
  const p = photo(320, 240)
  const ep = lireEncre(p.d, p.l, p.h, lireFond(p.d, p.l, p.h))
  assert.ok(lireCouleurs(p.d, p.l, p.h, ep.encre).aplat < PART_APLAT)
})

test('les couleurs : un aplat passé en JPEG (du bruit) reste un aplat', () => {
  const t = logo(400, 300, BLANC)
  let s = 3
  for (let i = 0; i < t.d.length; i++) { if (i % 4 === 3) continue; s = (s * 1103515245 + 12345) >>> 0; t.d[i] += (s >>> 16) % 9 - 4 }
  const f = lireFond(t.d, t.l, t.h)
  assert.equal(f.sorte, 'uni')
  const { encre } = lireEncre(t.d, t.l, t.h, f)
  const c = lireCouleurs(t.d, t.l, t.h, encre)
  assert.ok(c.aplat >= PART_APLAT, 'aplat ' + c.aplat)
  assert.equal(c.couleurs.length, 2)
})

test('le fondu : un contour lissé n’en est pas un, une ombre si', () => {
  const net = logo()
  assert.ok(lireFondu(net.d, net.l, net.h) < FONDU_PART / 4)
  const ombre = toile(400, 300)
  rect(ombre, 150, 100, 140, 120, [0, 0, 0, 120])
  const o = flouter(ombre, 8)
  disque(o, 200, 150, 60, ROUGE)
  assert.ok(lireFondu(o.d, o.l, o.h) > FONDU_PART)
  const translucide = toile(200, 200)
  rect(translucide, 40, 40, 120, 120, [0, 0, 0, 150])
  assert.ok(lireFondu(translucide.d, translucide.l, translucide.h) > 0.5)
})

/* Le faux fond transparent d'une IA : un damier gris et blanc DESSINÉ. */
function damier(l, h, case_ = 16) {
  const t = toile(l, h, BLANC)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    if (((x / case_) | 0) + ((y / case_) | 0) & 1) { const i = (y * l + x) * 4; t.d[i] = t.d[i + 1] = t.d[i + 2] = 204 }
  }
  return t
}

test('le faux damier « transparent » est un fond, pas un dessin', () => {
  const t = damier(400, 300)
  disque(t, 120, 150, 90, ROUGE)
  rect(t, 220, 90, 140, 120, BLEU)
  const f = lireFond(t.d, t.l, t.h)
  assert.equal(f.sorte, 'uni')
  assert.equal(f.damier, true)
  const { encre, cadre } = lireEncre(t.d, t.l, t.h, f)
  assert.ok(cadre.x >= 28 && cadre.x <= 32, 'le cadre serre le logo : ' + cadre.x)
  const c = lireCouleurs(t.d, t.l, t.h, encre)
  assert.equal(c.couleurs.length, 2)
  assert.ok(c.aplat >= 0.98)
  /* un logo gris et blanc sur fond blanc n'est pas un damier */
  const g = toile(400, 300, BLANC)
  rect(g, 100, 100, 200, 100, [204, 204, 204, 255])
  assert.equal(lireFond(g.d, g.l, g.h).damier, false)
  /* ni un vrai fond blanc */
  assert.equal(lireFond(logo(400, 300, BLANC).d, 400, 300).damier, false)
})

test('le flou : net, puis agrandi', () => {
  const net = logo(400, 300, BLANC)
  const f1 = lireFlou(net.d, net.l, net.h, true)
  assert.ok(f1 <= FLOU_NET, 'net mesuré à ' + f1)
  const x2 = agrandir(logo(200, 150, BLANC), 2)
  const x4 = agrandir(logo(100, 75, BLANC), 4)
  const f2 = lireFlou(x2.d, x2.l, x2.h, true), f4 = lireFlou(x4.d, x4.l, x4.h, true)
  assert.ok(f4 > FLOU_NET, '×4 mesuré à ' + f4)
  assert.ok(f4 > f2 && f2 > f1, `ordre : ${f1} < ${f2} < ${f4}`)
  /* les pixels utiles d'une image agrandie × 4 : à peu près le quart */
  const part = FLOU_REF / f4
  assert.ok(part > 0.15 && part < 0.5, 'part utile ×4 : ' + part)
})

test('le flou : trop peu de bords pour juger', () => {
  const t = toile(100, 100, BLANC)
  assert.equal(lireFlou(t.d, t.l, t.h, true), null)
})

test('l’analyse entière', () => {
  const t = logo(800, 600)
  const m = analyser(t.d, t.l, t.h)
  assert.equal(m.vide, false)
  assert.equal(m.fond.sorte, 'transparent')
  assert.equal(m.couleurs.length, 2)
  assert.ok(m.flou <= FLOU_NET)
  assert.ok(m.fondu < FONDU_PART)
  assert.ok(m.cadre.l > 650 && m.cadre.l < 670, 'cadre ' + m.cadre.l)

  const vide = toile(100, 100, BLANC)
  assert.equal(analyser(vide.d, 100, 100).vide, true)
  const p = photo(320, 240)
  assert.equal(analyser(p.d, p.l, p.h).fond.sorte, 'plein')
})
