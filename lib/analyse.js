/* ================================================================= L'ANALYSE
   Des pixels entrent (RGBA, ligne par ligne), des mesures sortent. Aucune
   décision ici : ce fichier MESURE, lib/verdict.js juge.

   Six mesures, dans l'ordre :
   1. LE FOND      transparent, uni (une couleur à retirer) ou plein (une
                   photo : l'image occupe tout son cadre) ;
   2. L'ENCRE      ce qui n'est pas le fond, et le cadre qui la contient ;
   3. LES COULEURS les teintes à plat du dessin, et la part de l'encre
                   qu'elles couvrent — un logo à plat tient dans six teintes,
                   un dégradé ou une photo non ;
   4. LE FONDU     les zones à demi transparentes plus larges qu'un contour
                   (ombre, lueur, bord flouté) ;
   5. LE TRAIT     le trait le plus fin du dessin, en pixels ;
   6. LE FLOU      la largeur d'un bord, en pixels : un bord net tient en un
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
   l'image est pleine. */
export function lireFond(d, l, h) {
  const n = l * h
  let vide = 0
  for (let p = 3; p < n * 4; p += 4) if (d[p] < A_VIDE) vide++
  if (vide / n >= 0.005) return { sorte: 'transparent', couleur: null, blanc: false }

  const e = Math.max(2, Math.round(Math.min(l, h) * 0.01))
  const bacs = new Map()
  const tour = []
  for (let y = 0; y < h; y++) {
    const dedans = y >= e && y < h - e
    for (let x = 0; x < l; x += dedans && x === e - 1 && l > 2 * e ? l - 2 * e + 1 : 1) {
      const i = (y * l + x) * 4
      if (d[i + 3] < A_ENCRE) continue
      tour.push(i)
      const cle = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4
      bacs.set(cle, (bacs.get(cle) || 0) + 1)
    }
  }
  if (!tour.length) return { sorte: 'transparent', couleur: null, blanc: false }
  let cle = 0, max = 0
  for (const [k, v] of bacs) if (v > max) { max = v; cle = k }
  const r0 = (cle >> 8 << 4) + 8, g0 = ((cle >> 4) & 15) * 16 + 8, b0 = (cle & 15) * 16 + 8
  let r = 0, g = 0, b = 0, m = 0
  for (const i of tour) if (ecart(d, i, r0, g0, b0) <= 24) { r += d[i]; g += d[i + 1]; b += d[i + 2]; m++ }
  if (!m) return { sorte: 'plein', couleur: null, blanc: false }
  r /= m; g /= m; b /= m
  let proches = 0
  for (const i of tour) if (ecart(d, i, r, g, b) <= TOL_FOND) proches++
  if (proches / tour.length < 0.55) return { sorte: 'plein', couleur: null, blanc: false }
  const couleur = [Math.round(r), Math.round(g), Math.round(b)]
  return { sorte: 'uni', couleur, blanc: Math.min(...couleur) >= 235 }
}

/* ----------------------------------------------------------------- L'ENCRE
   Le masque de ce qui s'imprime, son nombre de pixels et son cadre. Un pixel
   transparent n'en est jamais — même autour d'une image opaque (la marge
   d'un PDF rendu). */
export function lireEncre(d, l, h, fond) {
  const n = l * h
  const encre = new Uint8Array(n)
  let x0 = l, y0 = h, x1 = -1, y1 = -1, total = 0
  const c = fond.couleur
  for (let y = 0, p = 0; y < h; y++) {
    for (let x = 0; x < l; x++, p++) {
      const i = p * 4
      if (d[i + 3] < A_ENCRE) continue
      if (fond.sorte === 'uni' && ecart(d, i, c[0], c[1], c[2]) <= TOL_FOND) continue
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
   Une ombre, une lueur, un voile en laissent de larges : on ne garde que les
   pixels à demi transparents dont tout le voisinage (5 × 5) l'est aussi — la
   bande d'un contour n'y survit pas. `part` : leur part du dessin ; `carte` :
   où ils sont. */
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
  const carte = new Uint8Array(n)
  let coeur = 0
  for (let y = 2; y < h - 2; y++) {
    for (let x = 0, p = y * l; x < l; x++, p++) {
      if (ligne[p - 2 * l] & ligne[p - l] & ligne[p] & ligne[p + l] & ligne[p + 2 * l]) { carte[p] = 1; coeur++ }
    }
  }
  return { part: dessin ? coeur / dessin : 0, carte }
}

/* ------------------------------------------------------ LA DISTANCE AU FOND
   Felzenszwalb et Huttenlocher (2012), exacte, en deux passes de paraboles :
   pour chaque pixel d'encre, le CARRÉ de la distance au centre du pixel de
   fond le plus proche ; 0 ailleurs. Hors de l'image, c'est du fond. */
const INF = 1e20
function paraboles(f, n, sortie, v, z) {
  let k = 0
  v[0] = 0; z[0] = -INF; z[1] = INF
  for (let q = 1; q < n; q++) {
    let s
    do {
      const p = v[k]
      s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p)
    } while (s <= z[k] && --k >= 0)
    k++
    v[k] = q; z[k] = s; z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    sortie[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}
export function distances(dedans, l, h) {
  const L = l + 2, H = h + 2, m = Math.max(L, H)
  const g = new Float32Array(L * H)
  const f = new Float32Array(m), s = new Float32Array(m), v = new Int32Array(m), z = new Float32Array(m + 1)
  for (let x = 0; x < L; x++) {
    for (let y = 0; y < H; y++) f[y] = x > 0 && x < L - 1 && y > 0 && y < H - 1 && dedans[(y - 1) * l + x - 1] ? INF : 0
    paraboles(f, H, s, v, z)
    for (let y = 0; y < H; y++) g[y * L + x] = s[y]
  }
  const sortie = new Float32Array(l * h)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 0; x < L; x++) f[x] = g[y * L + x]
    paraboles(f, L, s, v, z)
    for (let x = 1; x < L - 1; x++) sortie[(y - 1) * l + x - 1] = s[x]
  }
  return sortie
}

/* -------------------------------------------------------------- L'ÉPAISSEUR
   L'épaisseur locale de chaque pixel d'encre : le diamètre du plus grand
   disque inscrit qui le couvre (Hildebrand et Rüegsegger, 1997). Les centres
   des disques sont les crêtes de la distance au fond ; de la plus grande à la
   plus petite, chacune peint son disque là où rien n'est encore peint. Une
   crête à plus de `max` pixels du fond n'est pas peinte : là, l'encre est
   épaisse, et vaut 0 comme le fond. */
export const EP_MAX = 12
export function epaisseurs(dedans, l, h, max = EP_MAX) {
  const n = l * h
  const d2 = distances(dedans, l, h)
  const d = new Float32Array(n)
  for (let p = 0; p < n; p++) if (d2[p] > 0) d[p] = Math.sqrt(d2[p])
  const cretes = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const p = y * l + x, r = d[p]
      if (!(r > 0) || r > max) continue
      let haut = true
      for (let j = -1; j <= 1 && haut; j++) {
        const Y = y + j
        if (Y < 0 || Y >= h) continue
        for (let i = -1; i <= 1; i++) {
          const X = x + i
          if (X < 0 || X >= l) continue
          if (d[Y * l + X] > r) { haut = false; break }
        }
      }
      if (haut) cretes.push(p)
    }
  }
  cretes.sort((a, b) => d[b] - d[a])
  const ep = new Float32Array(n)
  for (const p of cretes) {
    const r = d[p], x0 = p % l, y0 = (p - x0) / l, R = Math.ceil(r), t = 2 * r - 0.5
    for (let j = -R; j <= R; j++) {
      const Y = y0 + j
      if (Y < 0 || Y >= h) continue
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - j * j)))
      for (let i = -w; i <= w; i++) {
        const X = x0 + i
        if (X < 0 || X >= l) continue
        const q = Y * l + X
        if (d[q] > 0 && !ep[q]) ep[q] = t
      }
    }
  }
  return ep
}

/* ------------------------------------------------------- LE TRAIT LE PLUS FIN
   Une pointe, un empattement, l'angle d'une lettre sont fins sans être des
   traits. Un TRAIT est fin ET long : au moins `ALLONGE` fois plus long que
   large. Les pixels entrent du plus fin au plus épais et se regroupent en
   îles (union-find) ; la première épaisseur dont une île dépasse `ALLONGE`
   fois son carré est celle du trait le plus fin. Rend son épaisseur en
   pixels, ou 0 si rien n'est fin. */
const ALLONGE = 8
export function traitFin(ep, l, h, max = EP_MAX) {
  const n = l * h
  const T = 2 * max + 1
  const tetes = new Int32Array(T + 1).fill(-1)
  const suivant = new Int32Array(n)
  for (let p = 0; p < n; p++) {
    if (!(ep[p] > 0)) continue
    const b = Math.min(T, Math.max(1, Math.ceil(ep[p])))
    suivant[p] = tetes[b]
    tetes[b] = p
  }
  const parent = new Int32Array(n).fill(-1)
  const aire = new Int32Array(n)
  const racine = p => {
    while (parent[p] !== p) { parent[p] = parent[parent[p]]; p = parent[p] }
    return p
  }
  let plus = 0
  for (let b = 1; b <= T; b++) {
    for (let p = tetes[b]; p >= 0; p = suivant[p]) {
      parent[p] = p
      aire[p] = 1
      const x = p % l
      const voisins = [x > 0 ? p - 1 : -1, x < l - 1 ? p + 1 : -1, p - l, p + l]
      for (const q of voisins) {
        if (q < 0 || q >= n || parent[q] < 0) continue
        const a = racine(p), c = racine(q)
        if (a === c) continue
        if (aire[a] < aire[c]) { parent[a] = c; aire[c] += aire[a] } else { parent[c] = a; aire[a] += aire[c] }
      }
      const a = aire[racine(p)]
      if (a > plus) plus = a
    }
    if (plus >= ALLONGE * b * b) return b - 0.5
  }
  return 0
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
   Tout d'un coup. `cartes` (où sont les traits fins, où est le fondu) ne sert
   qu'à l'aperçu : `ep` porte l'épaisseur en quarts de pixel (0 : épais ou
   hors encre), `fondu` vaut 1 dans une zone fondue. */
export function analyser(d, l, h) {
  const fond = lireFond(d, l, h)
  const { encre, total, cadre } = lireEncre(d, l, h, fond)
  if (!cadre || total < 16) return { l, h, vide: true, fond }

  const { couleurs, aplat, clarte } = lireCouleurs(d, l, h, encre)
  const transparent = fond.sorte === 'transparent'
  const fondu = transparent ? lireFondu(d, l, h) : { part: 0, carte: null }
  const flou = lireFlou(d, l, h, transparent ? clarte < 140 : true)

  /* L'épaisseur ne se mesure que sur un dessin posé sur son fond : une image
     pleine n'a pas de trait. Elle se calcule dans le cadre de l'encre. */
  let fin = 0, ep = null
  if (fond.sorte !== 'plein') {
    const sous = new Uint8Array(cadre.l * cadre.h)
    for (let y = 0; y < cadre.h; y++) sous.set(encre.subarray((cadre.y + y) * l + cadre.x, (cadre.y + y) * l + cadre.x + cadre.l), y * cadre.l)
    const e = epaisseurs(sous, cadre.l, cadre.h)
    fin = traitFin(e, cadre.l, cadre.h)
    ep = new Uint8Array(l * h)
    for (let y = 0; y < cadre.h; y++) {
      for (let x = 0; x < cadre.l; x++) {
        const v = e[y * cadre.l + x]
        if (v > 0) ep[(cadre.y + y) * l + cadre.x + x] = Math.min(255, Math.round(v * 4))
      }
    }
  }

  return {
    l, h, vide: false,
    fond, cadre, encre: total, couvert: total / (l * h),
    couleurs, aplat, clarte,
    fondu: fondu.part, fin, flou,
    cartes: { ep, fondu: fondu.carte },
  }
}
