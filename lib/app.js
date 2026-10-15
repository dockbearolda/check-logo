/* ==================================================================== LA PAGE
   Un fichier se dépose, se choisit, se colle — ou arrive partagé depuis
   WhatsApp, quand l'app est installée ; le scan passe ; UNE réponse sort —
   c'est bon, à reprendre, inutilisable — avec ce qu'il faut dire au client
   et, quand ce n'est pas bon, le prompt à lui envoyer. Le tout part au
   client d'un seul geste.

   Plusieurs fichiers d'un coup (le client en envoie souvent trois versions) :
   chacun est contrôlé, le meilleur s'affiche, les autres restent à un clic.

   La lecture est dans lib/lecture.js, les mesures dans lib/analyse.js (dans
   un fil : lib/travail.js), le jugement, ses phrases et le prompt dans
   lib/verdict.js. Ici, rien que l'écran. */
import { lire } from './lecture.js'
import { juger, meilleur } from './verdict.js'

const $ = id => document.getElementById(id)
const page = $('page'), entree = $('fichier'), support = $('support'), toile = $('toile')
const role = r => $('verdict').querySelector(`[data-role="${r}"]`)

/* Le scan dure au moins ça : un résultat qui tombe en 80 ms ne se lit pas
   comme un contrôle, il se lit comme un clignotement. */
const SCAN_MIN = 700
/* Au-delà, on s'arrête : personne ne compare vingt versions d'un logo, et
   chaque fichier garde son aperçu en mémoire. */
const MAX_FICHIERS = 12
/* L'aperçu gardé pour chaque fichier, pour passer de l'un à l'autre sans le
   relire : son grand côté, en pixels — de quoi remplir l'aperçu d'un écran
   très dense. */
const COTE_APERCU = 1200

const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const attendre = ms => new Promise(ok => setTimeout(ok, ms))
/* Sur le téléphone, la réponse peut être sortie de l'écran (on était
   descendu lire le prompt, ou la liste des fichiers) : on y remonte. */
/* LE VOILE d'une réponse qui va être remplacée : éteinte (`.en-attente`), et
   hors d'atteinte — ni le doigt, ni le clavier ne peuvent agir sur une
   réponse qui n'est plus celle du fichier à l'écran. */
function voiler(ids, oui) {
  for (const id of ids) { $(id).classList.toggle('en-attente', oui); $(id).inert = oui }
}
function remonter() {
  if ($('resultat').getBoundingClientRect().top < 0) $('resultat').scrollIntoView({ block: 'start', behavior: reduit() ? 'auto' : 'smooth' })
}

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

function vignette(c) {
  const k = COTE_APERCU / Math.max(c.width, c.height)
  if (k >= 1) return c
  const v = document.createElement('canvas')
  v.width = Math.max(1, Math.round(c.width * k))
  v.height = Math.max(1, Math.round(c.height * k))
  const ctx = v.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(c, 0, 0, v.width, v.height)
  return v
}

function poser({ fichier, apercu, sombre }) {
  $('nom').textContent = fichier.nom
  toile.hidden = !apercu
  $('format').hidden = !!apercu
  if (!apercu) { support.classList.remove('sombre'); $('format').textContent = extension(fichier.nom) || '?'; return }
  toile.width = apercu.width
  toile.height = apercu.height
  toile.getContext('2d').drawImage(apercu, 0, 0)
  support.classList.toggle('sombre', sombre)
}

const nombre = n => Math.round(n).toLocaleString('fr-FR')
function meta(fichier) {
  const format = ((fichier.sorte === 'impasse' && extension(fichier.nom)) || fichier.format || extension(fichier.nom) || '').toUpperCase()
  const suite = fichier.sorte === 'vecteur' ? 'vectoriel'
    : fichier.sorte === 'mixte' ? 'vectoriel et images'
      : fichier.sorte === 'image' && fichier.natif ? `${nombre(fichier.natif.l)} × ${nombre(fichier.natif.h)} px` : ''
  return [format, suite].filter(Boolean).join(' · ')
}

/* ------------------------------------------------------------ UN FICHIER
   Lu, montré pendant qu'on le mesure, jugé. Quoi qu'il arrive, il en sort
   une réponse : un fichier qui ne s'ouvre pas est une impasse, pas une
   erreur. */
const illisible = file => ({ nom: file.name || 'Image collée', format: null, sorte: 'impasse', impasse: 'inconnu', natif: null, ia: null, capture: false })

async function examiner(file, montrer) {
  let r
  try {
    const lu = await lire(file)
    const apercu = lu.toile && vignette(lu.toile)
    r = { fichier: lu.fichier, apercu, sombre: !!apercu && estClair(apercu) }
    montrer(r)
    r.v = juger(r.fichier, lu.toile ? await mesurer(lu.toile) : null)
  } catch (e) {
    console.error(e)
    r = { fichier: illisible(file), apercu: null, sombre: false }
    r.v = juger(r.fichier, null)
    montrer(r)
  }
  return r
}

/* ---------------------------------------------------------------- LE CONTRÔLE
   Des fichiers déposés pendant que d'autres s'analysent l'emportent
   (`tour`). La réponse d'avant reste à l'écran, voilée, jusqu'à ce que la
   suivante la remplace : rien ne se vide, rien ne saute. */
let tour = 0, resultats = []
async function controler(liste) {
  const tous = [...(liste || [])].filter(Boolean)
  const files = tous.slice(0, MAX_FICHIERS)
  if (!files.length) return
  if (tous.length > files.length) prevenir(`${tous.length} fichiers déposés : seuls les ${MAX_FICHIERS} premiers sont contrôlés.`)
  const moi = ++tour
  const debut = performance.now()
  page.dataset.etat = 'scan'
  $('depot').hidden = true
  $('resultat').hidden = false
  $('autre').hidden = false
  remonter()
  voiler(['verdict', 'constats', 'fichiers'], true)

  const lus = []
  for (const [k, file] of files.entries()) {
    $('meta').textContent = files.length > 1 ? `Analyse en cours… ${k + 1} sur ${files.length}` : 'Analyse en cours…'
    const r = await examiner(file, r => { if (moi === tour) poser(r) })
    if (moi !== tour) return
    lus.push(r)
  }
  const reste = SCAN_MIN - (performance.now() - debut)
  if (reste > 0 && !reduit()) await attendre(reste)
  if (moi !== tour) return

  resultats = lus
  lister()
  choisir(meilleur(lus.map(r => r.v.etat)))
  page.dataset.etat = 'resultat'
}

/* ------------------------------------------------- PLUSIEURS FICHIERS
   La liste ne paraît qu'à partir de deux. Le meilleur est choisi d'office ;
   un clic sur un autre l'affiche à sa place. */
function lister() {
  const plusieurs = resultats.length > 1
  $('resultat').classList.toggle('plusieurs', plusieurs)
  $('fichiers').hidden = !plusieurs
  voiler(['fichiers'], false)
  if (!plusieurs) return
  $('fichiers-titre').textContent = `${resultats.length} fichiers déposés`
  $('fichiers-liste').replaceChildren(...resultats.map((r, i) => {
    const li = document.createElement('li'), b = document.createElement('button')
    const marque = document.createElement('span'), nom = document.createElement('span'), mot = document.createElement('span')
    b.type = 'button'
    b.className = 'fichier'
    marque.className = 'rond serre marque ' + r.v.etat
    marque.append(picto(r.v.etat))
    nom.className = 'fichier__nom'
    nom.textContent = r.fichier.nom
    mot.className = 'fichier__mot'
    mot.textContent = r.v.mot
    b.append(marque, nom, mot)
    b.addEventListener('click', () => { choisir(i); remonter() })
    li.append(b)
    return li
  }))
}

function choisir(i) {
  const r = resultats[i]
  if (!r) return
  poser(r)
  afficher(r.fichier, r.v)
  $('fichiers-liste').querySelectorAll('.fichier').forEach((b, k) => {
    if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current')
  })
}

/* ----------------------------------------------------------------- LA RÉPONSE
   Le voyant et le mot disent l'état ; le bouton noir envoie tout au client ;
   le bloc gris dit quoi répondre ; le prompt ne paraît que quand le fichier
   n'est pas bon. */
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

/* ENVOYER AU CLIENT : sur un téléphone, la feuille de partage (WhatsApp,
   SMS, courriel…) ; sur un ordinateur, le presse-papiers. */
const partage = typeof navigator.share === 'function' && matchMedia('(hover: none)').matches
const copies = { dire: '', prompt: '', envoi: '' }

function libeller(bouton, texte) {
  bouton.dataset.libelle = texte
  bouton.textContent = texte
}

function afficher(fichier, v) {
  $('meta').textContent = meta(fichier)
  role('voyant').className = 'rond marque ' + v.etat
  role('voyant').replaceChildren(picto(v.etat))
  role('mot').textContent = v.mot
  role('titre').textContent = v.titre
  role('titre').hidden = !v.titre

  libeller(role('envoyer'), partage ? 'Envoyer au client' : v.prompt ? 'Copier le message et le prompt' : 'Copier le message')
  role('envoyer').hidden = false
  role('bloc-dire').hidden = !v.dire
  role('dire').textContent = v.dire
  /* Sans prompt, le bouton noir copie déjà le message : pas deux fois. */
  role('copier-dire').hidden = !v.prompt
  role('bloc-prompt').hidden = !v.prompt
  role('prompt-nom').textContent = v.promptPour
  role('prompt').textContent = v.prompt
  copies.dire = v.dire
  copies.prompt = v.prompt
  copies.envoi = v.envoi

  $('constats').hidden = !v.constats.length
  $('liste').replaceChildren(...v.constats.map(c => {
    const li = document.createElement('li'), marque = document.createElement('span'), texte = document.createElement('p')
    marque.className = 'rond serre marque ' + c.etat
    marque.append(picto(c.etat))
    texte.textContent = c.texte
    li.append(marque, texte)
    return li
  }))

  voiler(['verdict', 'constats'], false)
}

/* ------------------------------------------------------- COPIER, ENVOYER */
let fermeture = 0
function prevenir(texte) {
  const msg = $('msg')
  msg.textContent = texte
  msg.classList.add('est-la')
  clearTimeout(fermeture)
  fermeture = setTimeout(() => msg.classList.remove('est-la'), 5000)
}
$('msg').addEventListener('click', () => $('msg').classList.remove('est-la'))

const retours = new WeakMap()
async function copier(bouton, texte) {
  try {
    await navigator.clipboard.writeText(texte)
    bouton.textContent = 'Copié'
    clearTimeout(retours.get(bouton))
    retours.set(bouton, setTimeout(() => { bouton.textContent = bouton.dataset.libelle }, 1600))
  } catch {
    prevenir('La copie n’a pas fonctionné. Sélectionnez le texte à la main.')
  }
}

for (const quoi of ['dire', 'prompt']) {
  const bouton = role('copier-' + quoi)
  libeller(bouton, bouton.textContent)
  bouton.addEventListener('click', () => copier(bouton, copies[quoi]))
}
role('envoyer').addEventListener('click', async ({ currentTarget: bouton }) => {
  if (partage) {
    try { await navigator.share({ text: copies.envoi }); return }
    catch (e) { if (e && e.name === 'AbortError') return }
  }
  copier(bouton, copies.envoi)
})

/* --------------------------------------------- DÉPOSER, CHOISIR, COLLER */
if (/Mac|iPhone|iPad/.test(navigator.platform)) $('aide').textContent = $('aide').textContent.replace('Ctrl + V', '⌘ V')

const ouvrir = () => entree.click()
$('depot').addEventListener('click', ouvrir)
$('choisir').addEventListener('click', e => { e.stopPropagation(); ouvrir() })
$('autre').addEventListener('click', ouvrir)
/* La liste est lue AVANT d'être vidée : `controler` la recopie d'entrée. */
entree.addEventListener('change', () => { controler(entree.files); entree.value = '' })

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
  controler(e.dataTransfer.files)
})
addEventListener('paste', e => {
  const f = e.clipboardData && e.clipboardData.files
  if (f && f.length) { e.preventDefault(); controler(f) }
})

/* ------------------------------------------------ L'APP, SUR L'APPAREIL
   Installée (sur l'écran d'accueil, ou sur le bureau), elle s'ouvre sans
   réseau, et — sur Android — reçoit le fichier qu'on lui partage depuis
   WhatsApp ou la galerie : sw.js le pose dans le cache « partage », sur
   l'appareil, et rouvre la page avec `?partage`. Rien ne quitte le poste. */
const PARTAGE = 'check-logo-partage'
async function recevoirPartage() {
  if (!new URLSearchParams(location.search).has('partage')) return
  history.replaceState(null, '', location.pathname)
  try {
    const cache = await caches.open(PARTAGE)
    const files = []
    for (const requete of await cache.keys()) {
      const reponse = await cache.match(requete)
      const blob = await reponse.blob()
      files.push(new File([blob], decodeURIComponent(reponse.headers.get('X-Nom') || 'Fichier partagé'), { type: blob.type }))
    }
    await caches.delete(PARTAGE)
    if (files.length) controler(files)
  } catch (e) {
    console.error(e)
    prevenir('Le fichier partagé n’a pas pu s’ouvrir. Déposez-le ici.')
  }
}
recevoirPartage()

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Mode hors ligne indisponible :', e)))
}
