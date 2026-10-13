/* De quoi dessiner des images d'essai sans navigateur : une toile RGBA, des
   rectangles, des disques lissés, un flou, un agrandissement. */

export function toile(l, h, [r, g, b, a] = [0, 0, 0, 0]) {
  const d = new Uint8ClampedArray(l * h * 4)
  for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a }
  return { d, l, h }
}

export function rect(t, x, y, l, h, [r, g, b, a = 255]) {
  for (let Y = Math.max(0, y); Y < Math.min(t.h, y + h); Y++) {
    for (let X = Math.max(0, x); X < Math.min(t.l, x + l); X++) {
      const i = (Y * t.l + X) * 4
      t.d[i] = r; t.d[i + 1] = g; t.d[i + 2] = b; t.d[i + 3] = a
    }
  }
  return t
}

/* Un disque au bord lissé (4 × 4 échantillons par pixel), posé PAR-DESSUS. */
export function disque(t, cx, cy, rayon, [r, g, b]) {
  for (let Y = Math.floor(cy - rayon - 1); Y <= cy + rayon + 1; Y++) {
    for (let X = Math.floor(cx - rayon - 1); X <= cx + rayon + 1; X++) {
      if (X < 0 || Y < 0 || X >= t.l || Y >= t.h) continue
      let dedans = 0
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const dx = X + (i + 0.5) / 4 - cx, dy = Y + (j + 0.5) / 4 - cy
        if (dx * dx + dy * dy <= rayon * rayon) dedans++
      }
      if (!dedans) continue
      const k = dedans / 16, i = (Y * t.l + X) * 4, a0 = t.d[i + 3] / 255
      const a = k + a0 * (1 - k)
      t.d[i] = (r * k + t.d[i] * a0 * (1 - k)) / a
      t.d[i + 1] = (g * k + t.d[i + 1] * a0 * (1 - k)) / a
      t.d[i + 2] = (b * k + t.d[i + 2] * a0 * (1 - k)) / a
      t.d[i + 3] = a * 255
    }
  }
  return t
}

/* Un flou en boîte de `rayon` pixels, deux passes, sur les quatre canaux
   (les couleurs prémultipliées par l'opacité). */
export function flouter(t, rayon) {
  const { l, h } = t
  const src = new Float32Array(l * h * 4)
  for (let i = 0; i < l * h * 4; i += 4) {
    const a = t.d[i + 3] / 255
    src[i] = t.d[i] * a; src[i + 1] = t.d[i + 1] * a; src[i + 2] = t.d[i + 2] * a; src[i + 3] = t.d[i + 3]
  }
  const passe = (de, dx, dy) => {
    const vers = new Float32Array(de.length)
    for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) for (let c = 0; c < 4; c++) {
      let s = 0
      for (let k = -rayon; k <= rayon; k++) {
        const X = Math.min(l - 1, Math.max(0, x + k * dx)), Y = Math.min(h - 1, Math.max(0, y + k * dy))
        s += de[(Y * l + X) * 4 + c]
      }
      vers[(y * l + x) * 4 + c] = s / (2 * rayon + 1)
    }
    return vers
  }
  const f = passe(passe(src, 1, 0), 0, 1)
  const d = new Uint8ClampedArray(l * h * 4)
  for (let i = 0; i < l * h * 4; i += 4) {
    const a = f[i + 3] / 255
    d[i] = a > 0 ? f[i] / a : 0; d[i + 1] = a > 0 ? f[i + 1] / a : 0; d[i + 2] = a > 0 ? f[i + 2] / a : 0; d[i + 3] = f[i + 3]
  }
  return { d, l, h }
}

/* Un agrandissement bilinéaire × k : ce que fait un logiciel quand on
   « agrandit » une petite image. */
export function agrandir(t, k) {
  const L = t.l * k, H = t.h * k
  const d = new Uint8ClampedArray(L * H * 4)
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < L; X++) {
    const x = Math.min(t.l - 1, Math.max(0, (X + 0.5) / k - 0.5)), y = Math.min(t.h - 1, Math.max(0, (Y + 0.5) / k - 0.5))
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(t.l - 1, x0 + 1), y1 = Math.min(t.h - 1, y0 + 1)
    const fx = x - x0, fy = y - y0
    for (let c = 0; c < 4; c++) {
      const v = (t.d[(y0 * t.l + x0) * 4 + c] * (1 - fx) + t.d[(y0 * t.l + x1) * 4 + c] * fx) * (1 - fy)
        + (t.d[(y1 * t.l + x0) * 4 + c] * (1 - fx) + t.d[(y1 * t.l + x1) * 4 + c] * fx) * fy
      d[(Y * L + X) * 4 + c] = v
    }
  }
  return { d, l: L, h: H }
}

/* Un générateur pseudo-aléatoire à graine : les essais donnent toujours le
   même résultat. */
export function hasard(graine = 1) {
  let s = graine >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/* Une « photo » : un paysage de taches douces, sans fond uni. */
export function photo(l, h) {
  const t = toile(l, h, [0, 0, 0, 255])
  const alea = hasard(7)
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const i = (y * l + x) * 4
    t.d[i] = 128 + 100 * Math.sin(x / 37 + y / 91) + 20 * (alea() - 0.5)
    t.d[i + 1] = 128 + 100 * Math.sin(x / 53 - y / 29) + 20 * (alea() - 0.5)
    t.d[i + 2] = 128 + 100 * Math.cos(x / 71 + y / 43) + 20 * (alea() - 0.5)
  }
  return t
}
