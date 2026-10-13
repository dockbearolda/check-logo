/* Un lecteur PNG de poche, pour le banc (outils/banc.mjs) : Node n'a pas de
   canevas. 8 ou 16 bits, gris, couleur, palette, avec ou sans opacité ; pas
   d'entrelacement. Rend { d (RGBA), l, h }. */
import { inflateSync } from 'node:zlib'

export function lirePng(octets) {
  const o = octets instanceof Uint8Array ? octets : new Uint8Array(octets)
  const vue = new DataView(o.buffer, o.byteOffset, o.byteLength)
  if (vue.getUint32(0) !== 0x89504e47) throw new Error('Pas un PNG')
  let l = 0, h = 0, bits = 8, genre = 6, entrelace = 0, palette = null, opacites = null
  const morceaux = []
  for (let p = 8; p < o.length;) {
    const taille = vue.getUint32(p), nom = String.fromCharCode(o[p + 4], o[p + 5], o[p + 6], o[p + 7]), debut = p + 8
    if (nom === 'IHDR') { l = vue.getUint32(debut); h = vue.getUint32(debut + 4); bits = o[debut + 8]; genre = o[debut + 9]; entrelace = o[debut + 12] }
    else if (nom === 'PLTE') palette = o.subarray(debut, debut + taille)
    else if (nom === 'tRNS') opacites = o.subarray(debut, debut + taille)
    else if (nom === 'IDAT') morceaux.push(o.subarray(debut, debut + taille))
    else if (nom === 'IEND') break
    p = debut + taille + 4
  }
  if (entrelace) throw new Error('PNG entrelacé : non lu par le banc')
  if (bits < 8) throw new Error('PNG de moins de 8 bits : non lu par le banc')
  const canaux = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[genre]
  const pas = canaux * bits / 8, ligne = l * pas
  const brut = inflateSync(Buffer.concat(morceaux))
  const px = new Uint8Array(h * ligne)
  for (let y = 0; y < h; y++) {
    const filtre = brut[y * (ligne + 1)], de = y * (ligne + 1) + 1, vers = y * ligne
    for (let x = 0; x < ligne; x++) {
      const a = x >= pas ? px[vers + x - pas] : 0, b = y ? px[vers + x - ligne] : 0, c = x >= pas && y ? px[vers + x - ligne - pas] : 0
      let v = brut[de + x]
      if (filtre === 1) v += a
      else if (filtre === 2) v += b
      else if (filtre === 3) v += (a + b) >> 1
      else if (filtre === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      px[vers + x] = v
    }
  }
  const d = new Uint8ClampedArray(l * h * 4)
  const o8 = bits / 8   /* 16 bits : on ne garde que l'octet fort */
  for (let i = 0, n = l * h; i < n; i++) {
    const s = i * pas, j = i * 4
    if (genre === 6) { d[j] = px[s]; d[j + 1] = px[s + o8]; d[j + 2] = px[s + 2 * o8]; d[j + 3] = px[s + 3 * o8] }
    else if (genre === 2) { d[j] = px[s]; d[j + 1] = px[s + o8]; d[j + 2] = px[s + 2 * o8]; d[j + 3] = 255 }
    else if (genre === 0) { d[j] = d[j + 1] = d[j + 2] = px[s]; d[j + 3] = 255 }
    else if (genre === 4) { d[j] = d[j + 1] = d[j + 2] = px[s]; d[j + 3] = px[s + o8] }
    else { const k = px[s]; d[j] = palette[k * 3]; d[j + 1] = palette[k * 3 + 1]; d[j + 2] = palette[k * 3 + 2]; d[j + 3] = opacites && k < opacites.length ? opacites[k] : 255 }
  }
  return { d, l, h }
}
