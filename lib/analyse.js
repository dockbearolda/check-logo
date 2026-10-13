/* ================================================================= L'ANALYSE
   Des pixels entrent (RGBA, ligne par ligne), des mesures sortent. Aucune
   décision ici : ce fichier MESURE, lib/verdict.js juge.

   Cinq mesures, dans l'ordre :
   1. LE FOND      transparent, uni (une couleur à retirer — ou le faux damier
                   « transparent » qu'une IA dessine dans l'image), ou plein
                   (un décor, une photo : l'image occupe tout son cadre) ;
   2. L'ENCRE      ce qui n'est pas le fond, et le cadre qui la contient ;
   3. LES COULEURS les teintes à plat du dessin, et la part de l'encre
                   qu'elles couvrent — un logo à plat tient dans six teintes,
                   une illustration ou une photo non ;
   4. LE FONDU     les zones à demi transparentes plus larges qu'un contour
                   (ombre, lueur, voile) ;
   5. LE FLOU      la largeur d'un bord, en pixels : un bord net tient en un
                   à deux pixels, une image agrandie les étale.

   Du calcul pur : ni page, ni fil. Il tourne dans lib/travail.js. */

const A_VIDE = 10       /* sous cette opacité, un pixel est transparent */
const A_PLEIN = 245     /* au-dessus, il est opaque */
const A_ENCRE = 128     /* la limite de l'encre sur un fond transparent */
const TOL_FOND = 30     /* écart à la couleur du fond, par canal */
const TOL_BORD = 32     /* deux voisins plus éloignés : un bord entre deux teintes */

const ecart = (d, i, r, g, b) => Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b))

/* ------------------------------------------------------------------ LE FOND
   Transparent s'il y a du vide. Sinon l'anneau du bord tranche : une même
   couleur sur plus de la moitié du tour, c'est un fond uni ; autrement
   l'image est pleine.
   LE FAUX DAMIER : une IA à qui l'on demande un « fond transparent » dessine
   souvent le damier gris et blanc DANS l'image. Deux gris clairs qui se
   partagent le tour et alternent le long du bord : c'est lui (`damier`), et
   ses deux teintes sont du fond. */
const TOL_DAMIER = 24
const moyenne = (d, tour, garde) => {
  const bacs = new Map()
  for (const i of tour) {
    if (!garde(i)) continue
    const cle = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4
    bacs.set(cle, (bacs.get(cle) || 0) + 1)
  }
  let cle = -1, max = 0
  for (const [k, v] of bacs) if (v > max) { max = v; cle = k }
  if (cle < 0) return null
  const r0 = (cle >> 8 << 4) + 8, g0 = ((cle >> 4) & 15) * 16 + 8, b0 = (cle & 15) * 16 + 8
  let r = 0, g = 0, b = 0, m = 0
  for (const i of tour) if (garde(i) && ecart(d, i, r0, g0, b0) <= 24) { r += d[i]; g += d[i + 1]; b += d[i + 2]; m++ }
  return m ? [r / m, g / m, b / m] : null
}
export function lireFond(d, l, h) {
  const n = l * h
  let vide = 0
  for (let p = 3; p < n * 4; p += 4) if (d[p] < A_VIDE) vide++
  if (vide / n >= 0.005) return { sorte: 'transparent', couleur: null, blanc: false, damier: false }

  const e = Math.max(2, Math.round(Math.min(l, h) * 0.01))
  const tour = []
  for (let y = 0; y < h; y++) {
    const dedans = y >= e && y < h - e
    for (let x = 0; x < l; x += dedans && x === e - 1 && l > 2 * e ? l - 2 * e + 1 : 1) {
      const i = (y * l + x) * 4
      if (d[i + 3] >= A_ENCRE) tour.push(i)
    }
  }
  if (!tour.length) return { sorte: 'transparent', couleur: null, blanc: false, damier: false }
  const plein = { sorte: 'plein', couleur: null, blanc: false, damier: false }
  const c1 = moyenne(d, tour, () => true)
  if (!c1) return plein
  const pres = (i, c, tol) => ecart(d, i, c[0], c[1], c[2]) <= tol
  let p1 = 0
  for (const i of tour) if (pres(i, c1, TOL_FOND)) p1++
  p1 /= tour.length
  const rond = c => c.map(Math.round)

  if (p1 < 0.9) {
    const c2 = moyenne(d, tour, i => !pres(i, c1, TOL_FOND))
    if (c2) {
      let p2 = 0
      for (const i of tour) if (!pres(i, c1, TOL_FOND) && pres(i, c2, TOL_DAMIER)) p2++
      p2 /= tour.length
      const gris = c => Math.max(...c) - Math.min(...c) <= 14 && Math.min(...c) >= 150
      /* Les cases alternent le long du bord du haut et du bord de gauche. */
      let bascules = 0
      for (const [pas, fin] of [[1, l], [l, h]]) {
        let avant = 0
        for (let k = 0; k < fin; k++) {
          const i = k * pas * 4
          const ici = pres(i, c1, TOL_FOND) ? 1 : pres(i, c2, TOL_DAMIER) ? 2 : 0
          if (ici && avant && ici !== avant) bascules++
          if (ici) avant = ici
        }
      }
      if (p1 >= 0.25 && p2 >= 0.25 && p1 + p2 >= 0.9 && gris(c1) && gris(c2) && bascules >= 8) {
        const [clair, sombre] = c1[0] >= c2[0] ? [c1, c2] : [c2, c1]
        return { sorte: 'uni', couleur: rond(clair), couleur2: rond(sombre), blanc: false, damier: true }
      }
    }
  }
  if (p1 < 0.55) return plein
  const couleur = rond(c1)
  return { sorte: 'uni', couleur, blanc: Math.min(...couleur) >= 235, damier: false }
}

/* ----------------------------------------------------------------- L'ENCRE
   Le masque de ce qui s'imprime, son nombre de pixels et son cadre. Un pixel
   transparent n'en est jamais — même autour d'une image opaque (la marge
   d'un PDF rendu). */
export function lireEncre(d, l, h, fond) {
  const n = l * h
  const encre = new Uint8Array(n)
  let x0 = l, y0 = h, x1 = -1, y1 = -1, total = 0
  const c = fond.couleur, c2 = fond.damier ? fond.couleur2 : null
  for (let y = 0, p = 0; y < h; y++) {
    for (let x = 0; x < l; x++, p++) {
      const i = p * 4
      if (d[i + 3] < A_ENCRE) continue
      if (fond.sorte === 'uni' && ecart(d, i, c[0], c[1], c[2]) <= TOL_FOND) continue
      if (c2 && ecart(d, i, c2[0], c2[1], c2[2]) <= TOL_DAMIER) continue
      encre[p] = 1
      total++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  const cadre = x1 < 0 ? null : { x: x0, y: y0, l: x1 - x0 + 1, h: y1 - y0 + 1 }
  return { encre, total, cadre }
}

/* ------------------------------------------------------------- LES COULEURS
   Les teintes se comptent loin des bords : un contour lissé mélange deux
   couleurs, ce n'est pas une troisième. L'encre restante se range dans des
   bacs de 8 niveaux par canal ; chaque bac rejoint la teinte voisine la plus
   fournie, ou en fonde une. `aplat` : la part de l'encre que couvrent les six
   premières teintes. `clarte` : la luminance moyenne de l'encre (0 à 255). */
const RAYON_TEINTE = 12
const TEINTES_APLAT = 6
export function lireCouleurs(d, l, h, encre) {
  const compter = sansBords => {
    const bacs = new Uint32Array(32768)
    let total = 0, clarte = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < l; x++) {
        const p = y * l + x
        if (!encre[p]) continue
        const i = p * 4
        if (d[i + 3] < A_PLEIN) continue
        if (sansBords) {
          const r = d[i], g = d[i + 1], b = d[i + 2]
          if (x === 0 || y === 0 || x === l - 1 || y === h - 1) continue
          if (!encre[p - 1] || !encre[p + 1] || !encre[p - l] || !encre[p + l]) continue
          if (ecart(d, i - 4, r, g, b) > TOL_BORD || ecart(d, i + 4, r, g, b) > TOL_BORD
            || ecart(d, i - l * 4, r, g, b) > TOL_BORD || ecart(d, i + l * 4, r, g, b) > TOL_BORD) continue
        }
        bacs[(d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3]++
        clarte += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        total++
      }
    }
    return { bacs, total, clarte: total ? clarte / total : 0 }
  }
  let { bacs, total, clarte } = compter(true)
  /* Un dessin tout en traits fins n'a que des bords : on les compte alors. */
  if (total < 200) ({ bacs, total, clarte } = compter(false))
  if (!total) return { couleurs: [], aplat: 0, clarte: 0 }

  const pleins = []
  for (let k = 0; k < 32768; k++) if (bacs[k]) pleins.push(k)
  pleins.sort((a, b) => bacs[b] - bacs[a])
  const teintes = []
  for (const k of pleins) {
    const r = (k >> 10 << 3) + 4, g = ((k >> 5) & 31) * 8 + 4, b = (k & 31) * 8 + 4
    const t = teintes.find(t => Math.max(Math.abs(t.r - r), Math.abs(t.g - g), Math.abs(t.b - b)) <= RAYON_TEINTE)
    if (t) t.n += bacs[k]
    else if (teintes.length < 64) teintes.push({ r, g, b, n: bacs[k] })
  }
  teintes.sort((a, b) => b.n - a.n)
  const aplat = teintes.slice(0, TEINTES_APLAT).reduce((s, t) => s + t.n, 0) / (total || 1)
  const couleurs = teintes.filter(t => t.n / total >= 0.02).slice(0, 8)
    .map(t => ({ rgb: [t.r, t.g, t.b], part: t.n / total }))
  return { couleurs, aplat, clarte }
}

/* ---------------------------------------------------------------- LE FONDU
   Un contour lissé laisse une bande à demi transparente de un à trois pixels.
   Une ombre, une lueur, un voile en laissent de larges : on ne compte que les
   pixels à demi transparents dont tout le voisinage (5 × 5) l'est aussi — la
   bande d'un contour n'y survit pas. Rend leur part du dessin. */
export function lireFondu(d, l, h) {
  const n = l * h
  const semi = new Uint8Array(n)
  let dessin = 0
  for (let p = 0; p < n; p++) {
    const a = d[p * 4 + 3]
    if (a >= A_VIDE) { dessin++; if (a < A_PLEIN) semi[p] = 1 }
  }
  /* Deux passes : cinq d'affilée sur la ligne, puis cinq sur la colonne. */
  const ligne = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 2, p = y * l + 2; x < l - 2; x++, p++) ligne[p] = semi[p - 2] & semi[p - 1] & semi[p] & semi[p + 1] & semi[p + 2]
  }
  let coeur = 0
  for (let y = 2; y < h - 2; y++) {
    for (let x = 0, p = y * l; x < l; x++, p++) {
      if (ligne[p - 2 * l] & ligne[p - l] & ligne[p] & ligne[p + l] & ligne[p + 2 * l]) coeur++
    }
  }
  return dessin ? coeur / dessin : 0
}

/* ------------------------------------------------------------------ LE FLOU
   La largeur d'un bord (Marziliano et al., 2002) : le long des lignes et des
   colonnes, chaque montée ou descente franche — au moins `CONTRASTE` niveaux
   d'un seul élan — donne la distance entre 10 % et 90 % de sa course. Un bord
   net tient en un à deux pixels. On rend le quart le plus net (p25) : sur une
   photo, seuls les bords au point disent la résolution. null s'il y a trop
   peu de bords pour juger. */
const CONTRASTE = 70
export function lireFlou(d, l, h, surClair) {
  const fondL = surClair ? 255 : 0
  const largeurs = []
  const s = new Float32Array(Math.max(l, h))
  const mesurer = n => {
    let i = 0
    while (i < n - 1) {
      const pas = s[i + 1] - s[i]
      if (Math.abs(pas) < 2) { i++; continue }
      const sens = pas > 0 ? 1 : -1
      let j = i + 1
      while (j < n - 1 && (s[j + 1] - s[j]) * sens >= 2) j++
      const a = s[i], b = s[j]
      if (Math.abs(b - a) >= CONTRASTE) {
        const bas = a + (b - a) * 0.1, haut = a + (b - a) * 0.9
        let x10 = i, x90 = j
        for (let k = i; k < j; k++) {
          if ((s[k] - bas) * sens <= 0 && (s[k + 1] - bas) * sens > 0) x10 = k + (bas - s[k]) / (s[k + 1] - s[k])
          if ((s[k] - haut) * sens < 0 && (s[k + 1] - haut) * sens >= 0) { x90 = k + (haut - s[k]) / (s[k + 1] - s[k]); break }
        }
        largeurs.push(x90 - x10)
      }
      i = j
    }
  }
  const pasY = Math.max(1, Math.floor(h / 400)), pasX = Math.max(1, Math.floor(l / 400))
  for (let canal = 0; canal < 3; canal++) {
    for (let y = 0; y < h; y += pasY) {
      for (let x = 0; x < l; x++) { const i = (y * l + x) * 4, a = d[i + 3] / 255; s[x] = d[i + canal] * a + fondL * (1 - a) }
      mesurer(l)
    }
    for (let x = 0; x < l; x += pasX) {
      for (let y = 0; y < h; y++) { const i = (y * l + x) * 4, a = d[i + 3] / 255; s[y] = d[i + canal] * a + fondL * (1 - a) }
      mesurer(h)
    }
  }
  if (largeurs.length < 30) return null
  largeurs.sort((a, b) => a - b)
  return largeurs[Math.floor(largeurs.length * 0.25)]
}

/* ---------------------------------------------------------------- L'ANALYSE
   Tout d'un coup. */
export function analyser(d, l, h) {
  const fond = lireFond(d, l, h)
  const { encre, total, cadre } = lireEncre(d, l, h, fond)
  if (!cadre || total < 16) return { l, h, vide: true, fond }
  const { couleurs, aplat, clarte } = lireCouleurs(d, l, h, encre)
  const transparent = fond.sorte === 'transparent'
  return {
    l, h, vide: false,
    fond, cadre, encre: total,
    couleurs, aplat,
    fondu: transparent ? lireFondu(d, l, h) : 0,
    flou: lireFlou(d, l, h, transparent ? clarte < 140 : true),
  }
}
