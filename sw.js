/* ============================================================ HORS LIGNE
   Le service worker de l'app installée. Deux métiers, et rien d'autre :

   1. LA PAGE S'OUVRE SANS RÉSEAU. La coquille (la page, ses feuilles, ses
      scripts, sa police) est gardée sur l'appareil. En ligne, chaque fichier
      vient du réseau et met sa copie à jour — une nouvelle version arrive
      donc d'elle-même ; hors ligne, la copie sert. Les lecteurs lourds
      (vendor/ : PDF, photos d'iPhone) se gardent aussi, dans un second
      temps : sans eux, un PDF déposé hors ligne ne s'ouvrirait pas.

   2. RECEVOIR UN FICHIER PARTAGÉ (Android, l'app installée) : WhatsApp ou la
      galerie POSTent le fichier sur ./partage ; il est posé dans le cache
      PARTAGE, sur l'appareil, et la page s'ouvre avec ?partage pour le
      prendre (lib/app.js). Rien ne quitte le poste.

   Le stockage des caches est commun à tout le domaine qui héberge l'app
   (d'autres pages peuvent y vivre) : chaque cache d'ici porte le préfixe
   « check-logo- », et on ne supprime jamais que les nôtres.
   Changer la liste de la coquille : changer VERSION. */
const PREFIXE = 'check-logo-'
const VERSION = PREFIXE + '1'
const PARTAGE = PREFIXE + 'partage'
const COQUILLE = [
  './', 'index.html', 'app.css', 'phare.css', 'phare-composants.css', 'manifest.webmanifest',
  'favicon.svg', 'manrope-latin.woff2', 'manrope-latin-ext.woff2',
  'lib/app.js', 'lib/lecture.js', 'lib/format.js', 'lib/analyse.js', 'lib/travail.js', 'lib/verdict.js', 'lib/regles.js',
]
/* 3 Mo : ils se téléchargent une fois, après la coquille. S'ils manquent, la
   coquille s'installe quand même — ils viendront au premier usage. */
const LECTEURS = ['vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs', 'vendor/libheif-bundle.mjs']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(async c => { await c.addAll(COQUILLE); await c.addAll(LECTEURS).catch(() => {}) })
    .then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(c => c.startsWith(PREFIXE) && c !== VERSION && c !== PARTAGE).map(c => caches.delete(c))))
    .then(() => self.clients.claim()))
})

async function recevoir(requete) {
  const donnees = await requete.formData()
  await caches.delete(PARTAGE)
  const cache = await caches.open(PARTAGE)
  let k = 0
  for (const f of donnees.getAll('fichiers')) {
    if (!(f instanceof File)) continue
    await cache.put(`partage/${k++}`, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Nom': encodeURIComponent(f.name || 'Fichier partagé') } }))
  }
  return Response.redirect(new URL('./?partage', self.registration.scope).href, 303)
}

async function reseauDabord(requete) {
  try {
    const reponse = await fetch(requete)
    if (reponse.ok && reponse.type === 'basic') {
      const copie = reponse.clone()
      caches.open(VERSION).then(c => c.put(requete, copie))
    }
    return reponse
  } catch (e) {
    const garde = await caches.match(requete, { ignoreSearch: requete.mode === 'navigate' })
    if (garde) return garde
    throw e
  }
}

/* Seul ce qui est sous le dossier de l'app passe ici : les autres pages du
   même domaine ne sont jamais gardées. */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (!url.href.startsWith(self.registration.scope)) return
  if (e.request.method === 'POST' && url.pathname.endsWith('/partage')) { e.respondWith(recevoir(e.request)); return }
  if (e.request.method !== 'GET') return
  e.respondWith(reseauDabord(e.request))
})
