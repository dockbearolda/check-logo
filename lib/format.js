/* ================================================================ LE FORMAT
   Un fichier client arrive comme il arrive, souvent mal nommé : un logo passé
   par WhatsApp ou un courriel perd son extension, ou en porte une fausse. Le
   format se lit donc dans les PREMIERS OCTETS ; le nom ne sert qu'en dernier
   recours. Pur : ni page, ni fil. */

const commence = (u8, octets) => octets.every((b, i) => u8[i] === b)
const ascii = (u8, de, a) => String.fromCharCode(...u8.subarray(de, Math.min(a, u8.length)))

/* Rend 'pdf', 'png', 'jpg', 'gif', 'webp', 'avif', 'heic', 'bmp', 'svg',
   'eps', 'psd', 'tif', 'zip', 'ole' — ou null quand rien ne ressemble à un
   format connu (le navigateur tentera quand même sa chance). */
export function formatDe(octets) {
  const u8 = octets instanceof Uint8Array ? octets : new Uint8Array(octets)
  if (u8.length < 4) return null
  if (commence(u8, [0x25, 0x50, 0x44, 0x46])) return 'pdf'
  if (commence(u8, [0x89, 0x50, 0x4e, 0x47])) return 'png'
  if (commence(u8, [0xff, 0xd8, 0xff])) return 'jpg'
  if (ascii(u8, 0, 4) === 'GIF8') return 'gif'
  if (commence(u8, [0x38, 0x42, 0x50, 0x53])) return 'psd'
  if (ascii(u8, 0, 4) === '%!PS' || commence(u8, [0xc5, 0xd0, 0xd3, 0xc6])) return 'eps'
  if (commence(u8, [0x49, 0x49, 0x2a, 0x00]) || commence(u8, [0x4d, 0x4d, 0x00, 0x2a])) return 'tif'
  if (commence(u8, [0x50, 0x4b, 0x03, 0x04])) return 'zip'
  if (commence(u8, [0xd0, 0xcf, 0x11, 0xe0])) return 'ole'
  if (u8.length >= 12 && ascii(u8, 0, 4) === 'RIFF' && ascii(u8, 8, 12) === 'WEBP') return 'webp'
  if (u8.length >= 12 && ascii(u8, 4, 8) === 'ftyp') {
    /* Même boîte pour AVIF et HEIC : la marque tranche. */
    const marque = ascii(u8, 8, 12)
    if (/avif|avis/.test(marque)) return 'avif'
    if (/heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1/.test(marque)) return 'heic'
  }
  if (commence(u8, [0x42, 0x4d])) return 'bmp'
  /* SVG : pas de nombre magique, on cherche la balise dans l'en-tête. */
  if (/<svg[\s>]/i.test(ascii(u8, 0, 2048))) return 'svg'
  return null
}

const PAR_EXTENSION = { svg: 'svg', heic: 'heic', heif: 'heic', tif: 'tif', tiff: 'tif', ai: 'pdf', pdf: 'pdf', eps: 'eps', psd: 'psd' }
const extension = nom => String(nom || '').split('.').pop().toLowerCase()
export const formatParNom = nom => PAR_EXTENSION[extension(nom)] || null

/* CE QUI NE S'OUVRE PAS ICI, et pourquoi (les clés de lib/verdict.js) : null
   si le format se lit. Une archive ZIP ou un fichier OLE est presque toujours
   un document de bureautique — Word, PowerPoint, Excel — avec le logo collé
   dedans. */
const BUREAU = /^(docx?|pptx?|ppsx?|xlsx?|odt|odp|ods|pages|key|numbers|pub|rtf)$/
export function impasseDe(format, nom) {
  if (format === 'eps' || format === 'psd' || format === 'tif') return format
  if (BUREAU.test(extension(nom))) return 'bureau'
  if (format === 'zip' || format === 'ole') return 'inconnu'
  return null
}
