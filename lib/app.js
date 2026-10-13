/* ==================================================================== LA PAGE
   Un fichier se dépose, se choisit ou se colle ; le scan passe ; deux
   verdicts sortent, avec ce qu'il faut dire au client.

   La lecture est dans lib/lecture.js, les mesures dans lib/analyse.js (dans
   un fil : lib/travail.js), le jugement et ses phrases dans lib/verdict.js.
   Ici, rien que l'écran. */
import { lire } from './lecture.js'
import { juger } from './verdict.js'
import { EMPLACEMENTS } from './regles.js'

const $ = id => document.getElementById(id)
const page = $('page'), entree = $('fichier'), support = $('support'), toile = $('toile'), calque = $('calque')

/* L'état d'un verdict : la classe de sa pastille, et son mot. */
const ETATS = {
  ok: ['ok', 'Compatible'],
  limite: ['cours', 'Sous réserve'],
  non: ['bloque', 'Incompatible'],
  inconnu: ['', 'À voir à l’atelier'],
}
/* Le scan dure au moins ça : un résultat qui tombe en 80 ms ne se lit pas
   comme un contrôle, il se lit comme un clignotement. */
const SCAN_MIN = 700

/* ---------------------------------------------------------------- LE CALCUL
   Dans un fil, pour que le scan reste fluide. Sans fil (un vieux navigateur),
   le même calcul se fait sur la page. */
let fil = null, numero = 0
const attentes = new Map()
function ouvrirFil() {
  if (fil) return fil
  fil = new Worker(new URL('./travail.js', import.meta.url), { type: 'module' })
  fil.onmessage = ({ data }) => {
    const a = attentes.get(data.id)
    if (!a) return
    attentes.delete(data.id)
    if (data.erreur) a.ko(new Error(data.erreur)); else a.ok(data.m)
  }
  fil.onerror = () => {
    for (const a of attentes.values()) a.ko(new Error('Le fil de calcul s’est arrêté'))
    attentes.clear()
    fil = null
  }
  return fil
}
async function mesurer(c) {
  const pixels = () => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height)
  try {
    const image = pixels()
    return await new Promise((ok, ko) => {
      const id = ++numero
      attentes.set(id, { ok, ko })
      ouvrirFil().postMessage({ id, tampon: image.data.buffer, l: c.width, h: c.height }, [image.data.buffer])
    })
  } catch (e) {
    console.warn('Calcul sur la page :', e)
    const { analyser } = await import('./analyse.js')
    return analyser(pixels().data, c.width, c.height)
  }
}

/* ---------------------------------------------------------------- LE CONTRÔLE
   Un fichier déposé pendant qu'un autre s'analyse l'emporte (`tour`). Les
   verdicts d'avant restent à l'écran, voilés, jusqu'à ce que les suivants les
   remplacent : rien ne se vide, rien ne saute. */
let tour = 0
async function controler(file) {
  if (!file) return
  const moi = ++tour
  const debut = performance.now()
  page.dataset.etat = 'scan'
  $('depot').hidden = true
  $('resultat').hidden = false
  $('autre').hidden = false
  $('verdicts').classList.add('en-attente')
  $('constats').classList.add('en-attente')
  $('nom').textContent = file.name || 'Image collée'
  $('meta').textContent = 'Analyse en cours…'
  $('legende').hidden = true
  calque.getContext('2d').clearRect(0, 0, calque.width, calque.height)

  let fichier, m = null
  try {
    const lu = await lire(file)
    if (moi !== tour) return
    fichier = lu.fichier
    poser(lu.toile, fichier)
    if (lu.toile) m = await mesurer(lu.toile)
  } catch (e) {
    console.error(e)
    fichier = { nom: file.name, format: null, sorte: 'impasse', impasse: 'inconnu', natif: null }
    m = null
    poser(null, fichier)
  }
  const reste = SCAN_MIN - (performance.now() - debut)
  if (reste > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise(ok => setTimeout(ok, reste))
  if (moi !== tour) return
  try {
    afficher(fichier, m, juger(fichier, m))
  } catch (e) {
    /* Quoi qu'il arrive, le scan s'arrête sur une réponse. */
    console.error(e)
    const illisible = { nom: file.name, format: null, sorte: 'impasse', impasse: 'inconnu', natif: null }
    afficher(illisible, null, juger(illisible, null))
  }
  page.dataset.etat = 'resultat'
}

/* ------------------------------------------------------------------ L'APERÇU */
const extension = nom => { const e = String(nom || '').split('.').pop(); return e && e.length <= 5 && e !== nom ? e.toUpperCase() : '' }

/* LE SUPPORT : un logo clair sur fond transparent ne se lit pas sur du clair.
   Une vignette de 48 pixels suffit à le savoir, dès que le fichier s'ouvre —
   le scan passe déjà sur un logo qu'on voit. */
function estClair(c) {
  const v = document.createElement('canvas')
  v.width = v.height = 48
  const ctx = v.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(c, 0, 0, 48, 48)
  const d = ctx.getImageData(0, 0, 48, 48).data
  let vide = 0, encre = 0, clarte = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) { vide++; continue }
    encre++
    clarte += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  }
  return vide > 48 * 48 * 0.02 && encre > 0 && clarte / encre > 170
}

function poser(c, fichier) {
  toile.hidden = calque.hidden = !c
  $('format').hidden = !!c
  if (!c) { support.classList.remove('sombre'); $('format').textContent = extension(fichier.nom) || '?'; return }
  toile.width = calque.width = c.width
  toile.height = calque.height = c.height
  toile.getContext('2d').drawImage(c, 0, 0)
  support.classList.toggle('sombre', estClair(c))
}

const nombre = n => Math.round(n).toLocaleString('fr-FR')
function meta(fichier) {
  const format = ((fichier.sorte === 'impasse' && extension(fichier.nom)) || fichier.format || extension(fichier.nom) || '').toUpperCase()
  if (fichier.sorte === 'vecteur') return [format, 'vectoriel'].filter(Boolean).join(' · ')
  if (fichier.sorte === 'mixte') return [format, 'vectoriel et images'].filter(Boolean).join(' · ')
  if (fichier.sorte === 'image' && fichier.natif) return [format, `${nombre(fichier.natif.l)} × ${nombre(fichier.natif.h)} px`].filter(Boolean).join(' · ')
  return format
}

/* LE CALQUE : là où ça coince, montré sur le logo. En rouge les traits trop
   fins, en orange les ombres et les transparences. Sur un grand fichier, un
   trait d'un pixel ne se verrait pas dans l'aperçu : chaque marque s'épaissit
   à l'échelle. Et un liseré clair la cerne : du rouge se lit ainsi même sur
   un logo rouge. */
function teinte(jeton) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(jeton).trim().replace('#', '')
  const h = v.length === 3 ? [...v].map(c => c + c).join('') : v
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0)
}
function calquer(m, apercu) {
  const legende = $('legende')
  legende.replaceChildren()
  if (!m || !m.cartes || !apercu) { legende.hidden = true; return }
  const { l, h } = m, { ep, fondu } = m.cartes
  const image = new ImageData(l, h), d = image.data
  const marquer = (x, y, rayon, [r, g, b]) => {
    for (let j = Math.max(0, y - rayon); j <= Math.min(h - 1, y + rayon); j++) {
      for (let i = Math.max(0, x - rayon); i <= Math.min(l - 1, x + rayon); i++) {
        const q = (j * l + i) * 4
        d[q] = r; d[q + 1] = g; d[q + 2] = b; d[q + 3] = 255
      }
    }
  }
  let fins = 0, fondus = 0
  if (apercu.fondu && fondu) {
    const orange = teinte('--warning-2')
    for (let p = 0; p < l * h; p++) if (fondu[p]) { const q = p * 4; d[q] = orange[0]; d[q + 1] = orange[1]; d[q + 2] = orange[2]; d[q + 3] = 200; fondus++ }
  }
  if (apercu.finPx && ep) {
    const seuil = apercu.finPx * 4, rayon = Math.floor(Math.max(l, h) / 500), lisere = Math.max(1, Math.ceil(Math.max(l, h) / 400))
    for (const [r, couleur] of [[rayon + lisere, teinte('--surface')], [rayon, teinte('--danger')]]) {
      for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < l; x++, p++) if (ep[p] && ep[p] < seuil) { marquer(x, y, r, couleur); if (r === rayon) fins++ }
    }
  }
  calque.getContext('2d').putImageData(image, 0, 0)
  const pastille = (classe, texte) => { const s = document.createElement('span'); s.className = 'pastille ' + classe; s.textContent = texte; return s }
  if (fins) legende.append(pastille('bloque', 'En rouge : traits trop fins'))
  if (fondus) legende.append(pastille('cours', 'En orange : ombres, transparences'))
  legende.hidden = !fins && !fondus
}

/* ---------------------------------------------------------------- LES VERDICTS */
const dires = { dtf: '', usinage: '' }

function remplir(id, verdict) {
  const carte = $(id), role = r => carte.querySelector(`[data-role="${r}"]`)
  const [classe, mot] = ETATS[verdict.etat] || ETATS.inconnu
  role('etat').className = ('pastille ' + classe).trim()
  role('etat').textContent = mot
  role('voyant').className = 'rond marque ' + verdict.etat
  role('voyant').replaceChildren(picto(verdict.etat))
  role('titre').textContent = verdict.titre
  role('dire').hidden = !verdict.dire
  role('texte').textContent = `« ${verdict.dire} »`
  dires[id] = verdict.dire
}

const PICTOS = {
  ok: 'M3.5 8.5l3 3 6-7',
  limite: 'M8 3.5V9M8 12.3v.2',
  non: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
  info: 'M8 7.5V12M8 3.8V4',
  inconnu: 'M6 6.2a2 2 0 1 1 3 1.7c-.7.4-1 .9-1 1.6M8 12.3v.2',
}
const SVG = 'http://www.w3.org/2000/svg'
function picto(etat) {
  const svg = document.createElementNS(SVG, 'svg'), trace = document.createElementNS(SVG, 'path')
  for (const [k, v] of Object.entries({ viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v)
  trace.setAttribute('d', PICTOS[etat] || PICTOS.info)
  svg.append(trace)
  return svg
}
function marque(etat) {
  const s = document.createElement('span')
  s.className = 'rond serre marque ' + etat
  s.append(picto(etat))
  return s
}
const el = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e }
const enCm = mm => (mm / 10).toLocaleString('fr-FR')

function afficher(fichier, m, v) {
  $('meta').textContent = meta(fichier)
  remplir('dtf', v.dtf)
  remplir('usinage', v.usinage)
  /* Un fichier qui ne s'ouvre pas n'a qu'une réponse : une seule carte. */
  $('dtf').querySelector('[data-role="nom"]').textContent = v.unique ? 'Impression DTF et usinage' : 'Impression DTF'
  $('usinage').hidden = !!v.unique

  const tailles = $('dtf').querySelector('[data-role="tailles"]')
  tailles.hidden = !v.dtf.emplacements
  tailles.querySelector('[data-role="liste"]').replaceChildren(...(v.dtf.emplacements || []).map((e, i) => {
    const li = el('li'), gauche = el('div')
    gauche.append(el('p', 'tailles__nom', e.nom), el('p', 'note', `${enCm(EMPLACEMENTS[i].de)} à ${enCm(EMPLACEMENTS[i].a)} cm de large`))
    li.append(gauche, el('span', ('pastille ' + ETATS[e.etat][0]).trim(), e.texte))
    return li
  }))

  $('constats').hidden = !v.constats.length
  $('liste').replaceChildren(...v.constats.map(c => {
    const li = el('li')
    li.append(marque(c.etat), el('p', '', c.texte))
    return li
  }))

  calquer(m, v.apercu)
  $('verdicts').classList.remove('en-attente')
  $('constats').classList.remove('en-attente')
}

/* ------------------------------------------------------------------ COPIER */
let fermeture = 0
function prevenir(texte) {
  const msg = $('msg')
  msg.textContent = texte
  msg.classList.add('est-la')
  clearTimeout(fermeture)
  fermeture = setTimeout(() => msg.classList.remove('est-la'), 5000)
}
$('msg').addEventListener('click', () => $('msg').classList.remove('est-la'))

for (const id of ['dtf', 'usinage']) {
  const bouton = $(id).querySelector('[data-role="copier"]')
  let retour = 0
  bouton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(dires[id])
      bouton.textContent = 'Copié'
      clearTimeout(retour)
      retour = setTimeout(() => { bouton.textContent = 'Copier' }, 1600)
    } catch {
      prevenir('La copie n’a pas fonctionné. Sélectionnez le texte à la main.')
    }
  })
}

/* --------------------------------------------- DÉPOSER, CHOISIR, COLLER */
if (/Mac|iPhone|iPad/.test(navigator.platform)) $('aide').textContent = $('aide').textContent.replace('Ctrl + V', '⌘ V')
const ouvrir = () => entree.click()
$('depot').addEventListener('click', ouvrir)
$('choisir').addEventListener('click', e => { e.stopPropagation(); ouvrir() })
$('autre').addEventListener('click', ouvrir)
entree.addEventListener('change', () => { controler(entree.files[0]); entree.value = '' })

const porteFichier = e => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')
let survols = 0
addEventListener('dragenter', e => { if (!porteFichier(e)) return; e.preventDefault(); survols++; page.classList.add('survol') })
addEventListener('dragover', e => { if (porteFichier(e)) e.preventDefault() })
addEventListener('dragleave', () => { if (--survols <= 0) { survols = 0; page.classList.remove('survol') } })
addEventListener('drop', e => {
  if (!porteFichier(e)) return
  e.preventDefault()
  survols = 0
  page.classList.remove('survol')
  controler(e.dataTransfer.files[0])
})
addEventListener('paste', e => {
  const f = e.clipboardData && e.clipboardData.files[0]
  if (f) { e.preventDefault(); controler(f) }
})
