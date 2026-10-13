/* ==================================================================== LA PAGE
   Un fichier se dépose, se choisit ou se colle ; le scan passe ; UNE réponse
   sort — c'est bon, à reprendre, inutilisable — avec ce qu'il faut dire au
   client et, quand ce n'est pas bon, le prompt à lui envoyer.

   La lecture est dans lib/lecture.js, les mesures dans lib/analyse.js (dans
   un fil : lib/travail.js), le jugement, ses phrases et le prompt dans
   lib/verdict.js. Ici, rien que l'écran. */
import { lire } from './lecture.js'
import { juger } from './verdict.js'

const $ = id => document.getElementById(id)
const page = $('page'), entree = $('fichier'), support = $('support'), toile = $('toile')
const role = r => $('verdict').querySelector(`[data-role="${r}"]`)

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
   Un fichier déposé pendant qu'un autre s'analyse l'emporte (`tour`). La
   réponse d'avant reste à l'écran, voilée, jusqu'à ce que la suivante la
   remplace : rien ne se vide, rien ne saute. */
let tour = 0
async function controler(file) {
  if (!file) return
  const moi = ++tour
  const debut = performance.now()
  page.dataset.etat = 'scan'
  $('depot').hidden = true
  $('resultat').hidden = false
  $('autre').hidden = false
  $('verdict').classList.add('en-attente')
  $('constats').classList.add('en-attente')
  $('nom').textContent = file.name || 'Image collée'
  $('meta').textContent = 'Analyse en cours…'

  const illisible = { nom: file.name, format: null, sorte: 'impasse', impasse: 'inconnu', natif: null, ia: null }
  let fichier, m = null
  try {
    const lu = await lire(file)
    if (moi !== tour) return
    fichier = lu.fichier
    poser(lu.toile, fichier)
    if (lu.toile) m = await mesurer(lu.toile)
  } catch (e) {
    console.error(e)
    fichier = illisible
    m = null
    poser(null, fichier)
  }
  const reste = SCAN_MIN - (performance.now() - debut)
  if (reste > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise(ok => setTimeout(ok, reste))
  if (moi !== tour) return
  try {
    afficher(fichier, juger(fichier, m))
  } catch (e) {
    /* Quoi qu'il arrive, le scan s'arrête sur une réponse. */
    console.error(e)
    afficher(illisible, juger(illisible, null))
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
  toile.hidden = !c
  $('format').hidden = !!c
  if (!c) { support.classList.remove('sombre'); $('format').textContent = extension(fichier.nom) || '?'; return }
  toile.width = c.width
  toile.height = c.height
  toile.getContext('2d').drawImage(c, 0, 0)
  support.classList.toggle('sombre', estClair(c))
}

const nombre = n => Math.round(n).toLocaleString('fr-FR')
function meta(fichier) {
  const format = ((fichier.sorte === 'impasse' && extension(fichier.nom)) || fichier.format || extension(fichier.nom) || '').toUpperCase()
  const suite = fichier.sorte === 'vecteur' ? 'vectoriel'
    : fichier.sorte === 'mixte' ? 'vectoriel et images'
      : fichier.sorte === 'image' && fichier.natif ? `${nombre(fichier.natif.l)} × ${nombre(fichier.natif.h)} px` : ''
  return [format, suite].filter(Boolean).join(' · ')
}

/* ----------------------------------------------------------------- LA RÉPONSE
   Le voyant et le mot disent l'état ; le bloc gris dit quoi répondre ; le
   prompt ne paraît que quand le fichier n'est pas bon. */
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

const copies = { dire: '', prompt: '' }

function afficher(fichier, v) {
  $('meta').textContent = meta(fichier)
  role('voyant').className = 'rond marque ' + v.etat
  role('voyant').replaceChildren(picto(v.etat))
  role('mot').textContent = v.mot
  role('titre').textContent = v.titre
  role('titre').hidden = !v.titre

  role('bloc-dire').hidden = !v.dire
  role('dire').textContent = `« ${v.dire} »`
  role('bloc-prompt').hidden = !v.prompt
  role('prompt-nom').textContent = v.promptPour
  role('prompt').textContent = v.prompt
  copies.dire = v.dire
  copies.prompt = v.prompt

  $('constats').hidden = !v.constats.length
  $('liste').replaceChildren(...v.constats.map(c => {
    const li = document.createElement('li'), marque = document.createElement('span'), texte = document.createElement('p')
    marque.className = 'rond serre marque ' + c.etat
    marque.append(picto(c.etat))
    texte.textContent = c.texte
    li.append(marque, texte)
    return li
  }))

  $('verdict').classList.remove('en-attente')
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

for (const quoi of ['dire', 'prompt']) {
  const bouton = role('copier-' + quoi), libelle = bouton.textContent
  let retour = 0
  bouton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copies[quoi])
      bouton.textContent = 'Copié'
      clearTimeout(retour)
      retour = setTimeout(() => { bouton.textContent = libelle }, 1600)
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
