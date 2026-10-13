import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDe, formatParNom, impasseDe } from '../lib/format.js'
import { compterOperations } from '../lib/lecture.js'

const octets = (...o) => new Uint8Array([...o, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const texte = t => new TextEncoder().encode(t)

test('le format se lit dans les octets', () => {
  assert.equal(formatDe(texte('%PDF-1.7')), 'pdf')
  assert.equal(formatDe(octets(0x89, 0x50, 0x4e, 0x47)), 'png')
  assert.equal(formatDe(octets(0xff, 0xd8, 0xff, 0xe0)), 'jpg')
  assert.equal(formatDe(texte('GIF89a')), 'gif')
  assert.equal(formatDe(texte('%!PS-Adobe-3.0 EPSF-3.0')), 'eps')
  assert.equal(formatDe(texte('8BPS')), 'psd')
  assert.equal(formatDe(texte('RIFF\0\0\0\0WEBPVP8 ')), 'webp')
  assert.equal(formatDe(texte('\0\0\0\x20ftypheic\0\0\0\0')), 'heic')
  assert.equal(formatDe(texte('\0\0\0\x20ftypavif\0\0\0\0')), 'avif')
  assert.equal(formatDe(texte('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">')), 'svg')
  assert.equal(formatDe(texte('PK\x03\x04')), 'zip')
  assert.equal(formatDe(texte('rien de connu')), null)
  assert.equal(formatDe(new Uint8Array(2)), null)
})

test('le nom, en dernier recours', () => {
  assert.equal(formatParNom('Logo Client.AI'), 'pdf')
  assert.equal(formatParNom('photo.HEIC'), 'heic')
  assert.equal(formatParNom('sans-extension'), null)
})

test('ce qui ne s’ouvre pas ici', () => {
  assert.equal(impasseDe('eps', 'logo.eps'), 'eps')
  assert.equal(impasseDe('psd', 'logo.psd'), 'psd')
  assert.equal(impasseDe('zip', 'logo.docx'), 'bureau')
  assert.equal(impasseDe('ole', 'logo.ppt'), 'bureau')
  assert.equal(impasseDe('zip', 'archive.zip'), 'inconnu')
  assert.equal(impasseDe('png', 'logo.png'), null)
  assert.equal(impasseDe('pdf', 'logo.ai'), null)
})

test('un PDF : vectoriel, image seule, ou les deux', () => {
  const OPS = { constructPath: 91, fill: 22, stroke: 20, endPath: 28, showText: 44, paintImageXObject: 85, save: 10, restore: 11 }
  /* pdf.js récent : le tracé porte sa peinture */
  const vecteur = compterOperations([91, 91, 91, 91], [[22], [20], [22], [22]], OPS)
  assert.equal(vecteur.sorte, 'vecteur')
  assert.equal(vecteur.traces, 4)
  /* pdf.js ancien : la peinture suit le tracé */
  assert.equal(compterOperations([91, 22, 91, 20, 91, 22], [[[13]], [], [[13]], [], [[13]], []], OPS).traces, 3)
  /* un JPG enregistré en PDF : une image, et un tracé de découpe qui ne peint rien */
  const seule = compterOperations([10, 91, 85, 11], [[], [28], ['img_p0_1', 1406, 1300], []], OPS)
  assert.equal(seule.sorte, 'image')
  assert.deepEqual(seule.image, { l: 1406, h: 1300 })
  /* des tracés ET une image */
  assert.equal(compterOperations([91, 91, 91, 44, 85], [[22], [22], [22], [], ['i', 300, 200]], OPS).sorte, 'mixte')
})
