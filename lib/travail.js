/* Le fil de calcul : l'analyse tourne ici, la page reste fluide pendant le
   scan. Les pixels arrivent par transfert. */
import { analyser } from './analyse.js'

self.onmessage = ({ data: { id, tampon, l, h } }) => {
  try {
    self.postMessage({ id, m: analyser(new Uint8ClampedArray(tampon), l, h) })
  } catch (e) {
    self.postMessage({ id, erreur: String((e && e.message) || e) })
  }
}
