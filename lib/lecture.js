/* ================================================================ LA LECTURE
   Un fichier entre, une toile sort : le dessin au plus à `COTE_ANALYSE`
   pixels de grand côté, prêt pour l'analyse et pour l'aperçu — avec ce qu'on
   sait du fichier (lib/verdict.js) :
     sorte   'image' | 'vecteur' | 'mixte' | 'impasse'
     natif   la taille de l'image en pixels, quand c'en est une ;
     ia      'ChatGPT' ou 'une IA' quand le fichier porte encore sa signature ;
     capture vrai quand le nom dit que c'est une capture d'écran.

   Les lecteurs lourds (pdf.js, libheif) sont dans vendor/ et ne se chargent
   qu'au premier fichier qui en a besoin : un PNG n'en tire pas un octet. */
import { formatDe, formatParNom, impasseDe, origineIA, estCapture } from './format.js'
import { COTE_ANALYSE } from './regles.js'

const vendor = fichier => new URL('../vendor/' + fichier, import.meta.url).href

/* UN LECTEUR QUI NE SE CHARGE PAS (hors ligne, avant qu'il ait été gardé
   sur l'appareil) n'est pas un fichier abîmé : l'erreur le dit, et la
   réponse aussi (l'impasse « lecteur »). */
const lecteurAbsent = e => Object.assign(e instanceof Error ? e : new Error(String(e)), { lecteur: true })

function canevas(l, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(l))
  c.height = Math.max(1, Math.round(h))
  return c
}

/* Une source (image ou canevas) ramenée au grand côté d'analyse. Une grande
   photo se réduit par moitiés : d'un seul coup, le canevas saute des pixels
   et les bords paraissent plus nets qu'ils ne sont. */
function reduire(source, l, h, cote = COTE_ANALYSE) {
  const k = Math.min(1, cote / Math.max(l, h))
  const L = Math.max(1, Math.round(l * k)), H = Math.max(1, Math.round(h * k))
  let courant = source, cl = l, ch = h
  while (cl > 2 * L) {
    const moitie = canevas(Math.ceil(cl / 2), Math.ceil(ch / 2))
    moitie.getContext('2d').drawImage(courant, 0, 0, moitie.width, moitie.height)
    courant = moitie; cl = moitie.width; ch = moitie.height
  }
  const c = canevas(L, H)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(courant, 0, 0, L, H)
  return c
}

function charger(url) {
  return new Promise((ok, ko) => {
    const img = new Image()
    img.onload = () => (img.naturalWidth && img.naturalHeight ? ok(img) : ko(new Error('Image vide')))
    img.onerror = () => ko(new Error('Image illisible'))
    img.src = url
  })
}

/* Ce que le navigateur sait lire tout seul : PNG, JPG, WebP, GIF, BMP, AVIF —
   et le HEIC d'un iPhone, dans Safari. */
async function lireImage(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const img = await charger(url)
    const natif = { l: img.naturalWidth, h: img.naturalHeight }
    return { natif, toile: reduire(img, natif.l, natif.h) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* ------------------------------------------------------------------- HEIC
   La photo d'un iPhone, hors de Safari : libheif (vendor/). */
let heif = null
async function lireHeic(blob) {
  heif = heif || import(vendor('libheif-bundle.mjs')).then(async mod => {
    const fait = (mod.default || mod)()
    return fait && typeof fait.then === 'function' ? await fait : fait
  }).catch(e => { heif = null; throw lecteurAbsent(e) })
  const lib = await heif
  const images = new lib.HeifDecoder().decode(new Uint8Array(await blob.arrayBuffer()))
  if (!images || !images.length) throw new Error('HEIC illisible')
  const image = images[0]
  const donnees = new ImageData(image.get_width(), image.get_height())
  await new Promise((ok, ko) => image.display(donnees, sortie => (sortie ? ok() : ko(new Error('HEIC illisible')))))
  images.forEach(im => im.free && im.free())
  const c = canevas(donnees.width, donnees.height)
  c.getContext('2d').putImageData(donnees, 0, 0)
  return { natif: { l: c.width, h: c.height }, toile: reduire(c, c.width, c.height) }
}

/* -------------------------------------------------------------------- SVG
   Un SVG n'est vectoriel que s'il contient des tracés. Un SVG qui n'emballe
   qu'une image (un JPG « enregistré en SVG ») se juge sur cette image. */
const TRACES = 'path,rect,circle,ellipse,polygon,polyline,line,text'
async function lireSvg(file) {
  const texte = await file.text()
  const doc = new DOMParser().parseFromString(texte, 'image/svg+xml')
  const racine = doc.documentElement
  const lisible = racine && racine.nodeName.toLowerCase() === 'svg' && !doc.querySelector('parsererror')
  const traces = lisible ? doc.querySelectorAll(TRACES).length : 1
  const images = lisible ? [...doc.querySelectorAll('image')] : []

  if (images.length && traces <= 1) {
    const lien = images[0].getAttribute('href') || images[0].getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
    if (lien.startsWith('data:image/')) {
      const { natif, toile } = await lireImage(await (await fetch(lien)).blob())
      return { sorte: 'image', natif, toile }
    }
  }

  /* Le SVG se rend à la taille d'analyse, pas à sa taille « naturelle » (un
     logo de 120 px de large y perdrait tout) : on lui écrit sa largeur et sa
     hauteur avant de le dessiner. Ses proportions viennent de son `viewBox` ;
     sans lui, d'un premier chargement. */
  const type = { type: 'image/svg+xml' }
  const dessiner = async (source, l, h) => {
    const url = URL.createObjectURL(new Blob([source], type))
    try {
      const img = await charger(url)
      const c = canevas(l || img.naturalWidth, h || img.naturalHeight)
      c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height)
      return c
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  const sorte = images.length ? 'mixte' : 'vecteur'
  if (!lisible) return { sorte, natif: null, toile: await dessiner(texte) }
  let [, , l, h] = (racine.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  if (!(l > 0 && h > 0)) {
    const brut = await dessiner(texte)
    l = brut.width; h = brut.height
    racine.setAttribute('viewBox', `0 0 ${l} ${h}`)
  }
  const k = COTE_ANALYSE / Math.max(l, h)
  racine.setAttribute('width', Math.round(l * k))
  racine.setAttribute('height', Math.round(h * k))
  return { sorte, natif: null, toile: await dessiner(new XMLSerializer().serializeToString(doc), Math.round(l * k), Math.round(h * k)) }
}

/* -------------------------------------------------------------------- PDF
   Un PDF (et un .ai, qui en est un) n'est vectoriel que s'il DESSINE des
   tracés ou du texte. La liste des opérations de la page le dit. Un PDF qui
   n'est qu'une image (un JPG « enregistré en PDF ») se juge sur cette image,
   à sa taille. */
const PEINTS = ['stroke', 'closeStroke', 'fill', 'eoFill', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke', 'shadingFill']
const TEXTES = ['showText', 'showSpacedText', 'nextLineShowText', 'nextLineSetSpacingShowText']
export function compterOperations(fns, args, OPS) {
  const codes = noms => new Set(noms.map(n => OPS[n]).filter(v => v !== undefined))
  const peints = codes(PEINTS), textes = codes(TEXTES)
  let traces = 0
  const images = []
  for (let i = 0; i < fns.length; i++) {
    const f = fns[i], a = args[i] || []
    /* Selon la version de pdf.js, le tracé porte lui-même sa peinture, ou
       elle le suit. */
    if (f === OPS.constructPath) { if (typeof a[0] === 'number' && peints.has(a[0])) traces++ }
    else if (peints.has(f) || textes.has(f)) traces++
    else if (f === OPS.paintImageXObject) images.push({ l: a[1], h: a[2] })
    else if (f === OPS.paintInlineImageXObject) images.push({ l: a[0] && a[0].width, h: a[0] && a[0].height })
  }
  const grande = images.filter(i => i.l > 0 && i.h > 0).sort((a, b) => b.l * b.h - a.l * a.h)[0] || null
  /* Un ou deux tracés autour d'une image : son cadre, son fond blanc. */
  const sorte = images.length ? (traces <= 2 ? 'image' : 'mixte') : 'vecteur'
  return { sorte, traces, image: grande }
}

function cadreUtile(c) {
  const { width: l, height: h } = c
  const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, l, h).data
  let x0 = l, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    if (d[(y * l + x) * 4 + 3] <= 8) continue
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return x1 < 0 ? null : { x: x0, y: y0, l: x1 - x0 + 1, h: y1 - y0 + 1 }
}

let pdfjs = null
function chargerPdfjs() {
  pdfjs = pdfjs || import(vendor('pdf.min.mjs')).then(mod => {
    const lib = mod && mod.getDocument ? mod : globalThis.pdfjsLib
    if (!lib) throw new Error('Lecteur PDF indisponible')
    lib.GlobalWorkerOptions.workerSrc = vendor('pdf.worker.min.mjs')
    return lib
  }).catch(e => { pdfjs = null; throw lecteurAbsent(e) })
  return pdfjs
}

/* UN PDF SE REND EN DEUX PASSES. Un logo de 5 cm au milieu d'une page A4,
   rendu page entière, ne garderait que quelques centaines de pixels. La
   première passe, petite, trouve où est le dessin ; la seconde ne rend que ce
   cadre, sur fond transparent. */
const PASSE_REPERE = 600
async function lirePdf(file) {
  const lib = await chargerPdfjs()
  const tache = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const doc = await tache.promise
    const page = await doc.getPage(1)
    const ops = await page.getOperatorList()
    const compte = compterOperations(ops.fnArray, ops.argsArray, lib.OPS)
    const base = page.getViewport({ scale: 1 })
    const rendre = async (vue, l, h) => {
      const c = canevas(l, h)
      await page.render({ canvasContext: c.getContext('2d', { willReadFrequently: true }), viewport: vue, background: 'rgba(0,0,0,0)' }).promise
      return c
    }
    const e0 = PASSE_REPERE / Math.max(base.width, base.height)
    const esquisse = await rendre(page.getViewport({ scale: e0 }), base.width * e0, base.height * e0)
    const cadre = cadreUtile(esquisse)
    if (!cadre) return { sorte: compte.sorte, natif: null, toile: esquisse }
    const x = Math.max(0, cadre.x - 2) / e0, y = Math.max(0, cadre.y - 2) / e0
    const l = Math.min(esquisse.width, cadre.x + cadre.l + 2) / e0 - x
    const h = Math.min(esquisse.height, cadre.y + cadre.h + 2) / e0 - y
    /* Une image seule : à sa taille, pixel pour pixel — jamais agrandie. */
    const image = compte.sorte === 'image' ? compte.image : null
    const cote = image ? Math.min(COTE_ANALYSE, Math.max(image.l, image.h)) : COTE_ANALYSE
    const e = cote / Math.max(l, h)
    const toile = await rendre(page.getViewport({ scale: e, offsetX: -x * e, offsetY: -y * e }), l * e, h * e)
    return { sorte: compte.sorte, natif: image ? { l: image.l, h: image.h } : null, toile }
  } finally {
    await tache.destroy()
  }
}

/* --------------------------------------------------------------- LE FICHIER
   Tout se dépose. Ce qui ne s'ouvre pas ressort en impasse, avec sa raison —
   jamais en erreur. Le début et la fin du fichier disent son format et, s'il
   la porte encore, la signature de l'IA qui l'a créé. */
const BOUT = 262144
export async function lire(file) {
  const tete = new Uint8Array(await file.slice(0, BOUT).arrayBuffer())
  const queue = file.size > BOUT ? new Uint8Array(await file.slice(Math.max(BOUT, file.size - BOUT)).arrayBuffer()) : new Uint8Array(0)
  const format = formatDe(tete) || formatParNom(file.name)
  const ia = origineIA(tete, file.name) || origineIA(queue)
  const fichier = { nom: file.name || 'Image collée', format, sorte: 'impasse', natif: null, impasse: null, ia, capture: estCapture(file.name) }
  const impasse = impasseDe(format, file.name)
  if (impasse) return { fichier: { ...fichier, impasse }, toile: null }
  try {
    const lu = format === 'pdf' ? await lirePdf(file)
      : format === 'svg' ? await lireSvg(file)
        : format === 'heic' ? await lireImage(file).catch(() => lireHeic(file))
          : await lireImage(file)
    return { fichier: { ...fichier, sorte: lu.sorte || 'image', natif: lu.natif }, toile: lu.toile }
  } catch (e) {
    console.warn('Fichier illisible :', e)
    return { fichier: { ...fichier, impasse: e && e.lecteur ? 'lecteur' : 'inconnu' }, toile: null }
  }
}
