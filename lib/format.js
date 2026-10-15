/* ================================================================ LE FORMAT
   Un fichier client arrive comme il arrive, souvent mal nommé : un logo passé
   par WhatsApp ou un courriel perd son extension, ou en porte une fausse. Le
   format se lit donc dans les PREMIERS OCTETS ; le nom ne sert qu'en dernier
   recours. Pur : ni page, ni fil. */

const commence = (u8, octets) => octets.every((b, i) => u8[i] === b)
const ascii = (u8, de, a) => String.fromCharCode(...u8.subarray(de, Math.min(a, u8.length)))

/* Rend 'pdf', 'png', 'jpg', 'gif', 'webp', 'avif', 'heic', 'bmp', 'svg',
   'eps', 'psd', 'tif', 'cdr', 'video', 'zip', 'ole' — ou null quand rien ne
   ressemble à un format connu (le navigateur tentera quand même sa chance). */
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
  if (commence(u8, [0x1a, 0x45, 0xdf, 0xa3])) return 'video'          /* MKV, WebM */
  if (u8.length >= 12 && ascii(u8, 0, 4) === 'RIFF') {
    const marque = ascii(u8, 8, 12)
    if (marque === 'WEBP') return 'webp'
    if (marque === 'AVI ') return 'video'
    if (marque.startsWith('CDR')) return 'cdr'                        /* CorelDRAW */
  }
  if (u8.length >= 12 && ascii(u8, 4, 8) === 'ftyp') {
    /* Même boîte pour AVIF, HEIC et les vidéos (MP4, MOV) : la marque tranche. */
    const marque = ascii(u8, 8, 12)
    if (/avif|avis/.test(marque)) return 'avif'
    if (/heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1/.test(marque)) return 'heic'
    if (/isom|iso2|mp4|avc1|M4V|M4A|qt  |3gp/.test(marque)) return 'video'
  }
  if (commence(u8, [0x42, 0x4d])) return 'bmp'
  /* SVG : pas de nombre magique, on cherche la balise dans l'en-tête. */
  if (/<svg[\s>]/i.test(ascii(u8, 0, 2048))) return 'svg'
  return null
}

const PAR_EXTENSION = { svg: 'svg', heic: 'heic', heif: 'heic', tif: 'tif', tiff: 'tif', ai: 'pdf', pdf: 'pdf', eps: 'eps', psd: 'psd', cdr: 'cdr' }
const extension = nom => String(nom || '').split('.').pop().toLowerCase()
export const formatParNom = nom => PAR_EXTENSION[extension(nom)] || null

/* CE QUI NE S'OUVRE PAS ICI, et pourquoi (les clés de lib/verdict.js) : null
   si le format se lit.
     graphiste  un fichier de dessin professionnel (CorelDRAW, Affinity,
                InDesign, Figma, DXF… ou un vieil Illustrator qui n'est pas
                un PDF) : presque toujours vectoriel, l'atelier tranchera ;
     video      une vidéo — il n'y a pas d'image dedans ;
     bureau     une archive ZIP ou un fichier OLE est presque toujours un
                document de bureautique — Word, PowerPoint, Excel — avec le
                logo collé dedans. */
const GRAPHISTE = /^(cdr|afdesign|afpub|dxf|dwg|emf|wmf|indd|idml|sketch|fig|xd|svgz)$/
const VIDEO = /^(mp4|m4v|mov|avi|mkv|webm|3gp|wmv|mpe?g)$/
const BUREAU = /^(docx?|pptx?|ppsx?|xlsx?|odt|odp|ods|pages|key|numbers|pub|rtf)$/
export function impasseDe(format, nom) {
  const ext = extension(nom)
  if (format === 'eps' && ext === 'ai') return 'graphiste'
  if (format === 'eps' || format === 'psd' || format === 'tif') return format
  if (format === 'cdr' || GRAPHISTE.test(ext)) return 'graphiste'
  if (format === 'video' || VIDEO.test(ext)) return 'video'
  if (BUREAU.test(ext)) return 'bureau'
  if (format === 'zip' || format === 'ole') return 'inconnu'
  return null
}

/* UNE CAPTURE D'ÉCRAN se reconnaît à son nom — le téléphone et l'ordinateur
   la nomment ainsi, en français comme en anglais. Elle n'est jamais le
   fichier d'origine du logo.
   macOS donne ses noms les accents décomposés (« e » puis l'accent) : on les
   recompose avant de lire. */
export const estCapture = nom => /capture\s?(d.{1,2})?[ée]cran|screen\s?shot|bildschirmfoto/i.test(String(nom || '').normalize('NFC'))

/* CRÉÉ PAR UNE IA ? Une image sortie de ChatGPT porte sa signature (un
   certificat C2PA signé par OpenAI, dans le fichier) et souvent son nom
   (« ChatGPT Image 27 août 2026… »). `octets` : le début et la fin du
   fichier suffisent. Rend 'ChatGPT', 'une IA' (une autre, qui se déclare),
   ou null — une image passée par WhatsApp a perdu sa signature : null ne
   veut pas dire « pas une IA ». */
export function origineIA(octets, nom = '') {
  if (/chat\s?gpt|dall[\s·._-]?e\b/i.test(nom)) return 'ChatGPT'
  const u8 = octets instanceof Uint8Array ? octets : new Uint8Array(octets)
  const texte = new TextDecoder('latin1').decode(u8)
  if (/OpenAI|ChatGPT|gpt-image|DALL.{1,2}E/.test(texte)) return 'ChatGPT'
  if (/trainedAlgorithmicMedia|Midjourney|Adobe Firefly|Stable Diffusion/i.test(texte)) return 'une IA'
  return null
}
