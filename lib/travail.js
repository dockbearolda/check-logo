/* Le fil de calcul : l'analyse tourne ici, la page reste fluide pendant le
   scan. Les pixels arrivent par transfert, les cartes repartent de même. */
import { analyser } from './analyse.js'

self.onmessage = ({ data: { id, tampon, l, h } }) => {
  try {
    const m = analyser(new Uint8ClampedArray(tampon), l, h)
    const cartes = m.cartes ? [m.cartes.ep, m.cartes.fondu].filter(Boolean).map(c => c.buffer) : []
    self.postMessage({ id, m }, cartes)
  } catch (e) {
    self.postMessage({ id, erreur: String((e && e.message) || e) })
  }
}
