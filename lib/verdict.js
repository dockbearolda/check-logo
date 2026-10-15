/* ================================================================ LE VERDICT
   Les mesures entrent (lib/analyse.js), UNE réponse sort. La règle est celle
   de Charlie, telle quelle (13 octobre 2026) : « ce qui est bon, c'est une
   photo en haute résolution ou un fichier vectoriel ; pour le reste on
   renvoie un prompt si ça vient de ChatGPT » — « un logo non vectoriel, avec
   un fond noir par exemple, c'est une reprise facturée ou un prompt à
   envoyer ».

     ok       C'EST BON : un fichier vectoriel, ou une photo en haute
              résolution. RIEN D'AUTRE — un logo en image, même net, même
              détouré, n'est pas bon.
     limite   À REPRENDRE : tout le reste. Deux sorties pour le client :
              il le refait avec ChatGPT, avec LE PROMPT qu'on lui envoie ;
              ou l'atelier le reprend, et CETTE REPRISE EST FACTURÉE.
     non      INUTILISABLE : trop petit, trop flou, ou pas une image.
     inconnu  le fichier ne s'ouvre pas ici, l'atelier tranchera.

   Avec chaque réponse : ce que la vendeuse dit au client, en mots de tous
   les jours, le prompt, écrit d'après ce que le contrôle a trouvé, et
   `envoi` — le tout en un seul texte, à envoyer au client d'un geste.

   Les phrases et le prompt sont ici et nulle part ailleurs. Pur : ni page,
   ni fil. */
import { PIXELS_PHOTO, PIXELS_POURRI, FLOU_REF, FLOU_NET, PART_APLAT, FONDU_PART } from './regles.js'

const pixels = n => Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')

/* Le nom d'une couleur : « le fond noir ». */
export function nomCouleur([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max - min < 28) return max < 70 ? 'noir' : max > 215 ? 'blanc' : 'gris'
  let t = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4
  t = (t * 60 + 360) % 360
  if (t < 18 || t >= 340) return max - min < 110 && max > 200 ? 'rose' : 'rouge'
  if (t < 45) return max < 150 ? 'marron' : 'orange'
  if (t < 70) return 'jaune'
  if (t < 165) return 'vert'
  if (t < 255) return 'bleu'
  if (t < 300) return 'violet'
  return 'rose'
}

const GRAPHISTE = 'Si un graphiste a créé votre logo, demandez-lui le fichier vectoriel (PDF, AI, SVG ou EPS).'
const CAPTURE = 'C’est une capture d’écran : si vous avez le fichier d’origine du logo, envoyez-nous plutôt celui-là.'

/* CE QU'ON ENVOIE AU CLIENT, d'un geste : ce qu'on lui dit, puis le prompt
   quand il y en a un. */
const envoi = (dire, prompt) => (prompt ? `${dire}\n\nLe message pour ChatGPT :\n${prompt}` : dire)

/* PLUSIEURS FICHIERS D'UN COUP : l'indice du meilleur, dans l'ordre des
   réponses — un fichier à voir à l'atelier (EPS, CorelDRAW…) vaut mieux
   qu'une image à reprendre. À égalité, le premier déposé. -1 si la liste est
   vide. */
const RANG = { ok: 0, inconnu: 1, limite: 2, non: 3 }
export function meilleur(etats) {
  let m = -1
  etats.forEach((e, i) => { if (m < 0 || (RANG[e] ?? 9) < (RANG[etats[m]] ?? 9)) m = i })
  return m
}

/* -------------------------------------------------------------- LE PROMPT
   Ce que le client envoie à ChatGPT avec son fichier. Il ne demande que ce
   que le contrôle a trouvé à corriger — et de ne rien changer d'autre.
     logo    un dessin à plat : on lui demande un VRAI fichier vectoriel —
             c'est ce qui le fera passer au vert. Sinon (une photo, une
             illustration) : la plus haute résolution possible ;
     fond    '' | 'damier' | 'blanc' | 'décor' | une couleur (« noir ») ;
     ombres  des ombres, des lueurs, des transparences. */
export function ecrirePrompt({ logo, fond, ombres }) {
  const lignes = [`Refais ${logo ? 'ce logo à l’identique, en version vectorielle' : 'ce visuel à l’identique'} : mêmes formes, mêmes textes, mêmes couleurs, même mise en page. Ne change rien d’autre que ce qui suit.`]
  const seul = 'garde uniquement le dessin, sur un fond réellement transparent'
  if (fond === 'damier') lignes.push('- Le fond doit être réellement transparent : supprime le damier gris et blanc, il ne doit plus apparaître dans l’image.')
  else if (fond === 'blanc') lignes.push(`- Retire le fond blanc : ${seul}.`)
  else if (fond === 'décor') lignes.push(`- Si l’image a un fond ou un décor qui ne fait pas partie du dessin, retire-le : ${seul}.`)
  else if (fond) lignes.push(`- Retire le fond ${fond} s’il ne fait pas partie du logo : ${seul}.`)
  if (ombres) lignes.push('- Supprime les ombres portées, les lueurs et les zones à moitié transparentes : des contours nets et francs.')
  if (logo) {
    lignes.push('- Couleurs unies en aplat, contours nets, sans dégradé ni texture.')
    lignes.push('- Donne-moi un vrai fichier vectoriel SVG, fait de tracés — pas une image collée dans un SVG.')
  } else {
    lignes.push(`- Génère-le dans la plus haute résolution possible : au moins ${pixels(PIXELS_PHOTO)} pixels de large, avec des contours parfaitement nets.`)
    lignes.push('- Garde le même style et le même niveau de détail.')
    lignes.push('- Donne-moi le résultat en PNG.')
  }
  return lignes.join('\n')
}

/* -------------------------------------------- CE QUI NE S'OUVRE PAS ICI
   Plutôt que « format non reconnu », on dit quoi demander au client. Un
   titre ou un constat peut être une fonction du fichier : le nom du
   logiciel se lit dans son extension. */
const LOGICIELS = { cdr: 'CorelDRAW', ai: 'Illustrator', afdesign: 'Affinity Designer', afpub: 'Affinity Publisher', indd: 'InDesign', idml: 'InDesign', sketch: 'Sketch', fig: 'Figma', xd: 'Adobe XD', svgz: 'SVG compressé' }
const extension = nom => String(nom || '').split('.').pop().toLowerCase()
const logiciel = ({ nom }) => {
  const ext = extension(nom)
  return LOGICIELS[ext] || (ext && ext !== String(nom || '').toLowerCase() ? ext.toUpperCase() : 'de graphiste')
}
const DIRE_PRO = 'Merci, c’est un fichier professionnel. Je le transmets à l’atelier, qui vous confirmera qu’il convient.'
const IMPASSES = {
  graphiste: {
    etat: 'inconnu', mot: 'À voir à l’atelier', titre: f => `Fichier ${logiciel(f)} : il ne s’ouvre pas ici.`,
    constat: f => `Fichier ${logiciel(f)} : un format de dessin professionnel, en général vectoriel. C’est bon signe.`,
    dire: DIRE_PRO,
  },
  lecteur: {
    etat: 'inconnu', mot: 'À réessayer', titre: 'Ce fichier s’ouvre avec une connexion : réessayez une fois connecté.',
    constat: 'Le lecteur de ce format n’a pas pu se charger sur cet appareil. Le fichier n’y est pour rien.',
    dire: 'Merci, je vérifie votre fichier et je reviens vers vous.',
  },
  video: {
    etat: 'non', mot: 'Inutilisable', titre: 'C’est une vidéo, pas une image.',
    constat: 'Vidéo : il n’y a pas d’image à imprimer dedans.',
    dire: `Vous nous avez envoyé une vidéo : il nous faut le fichier du logo lui-même. ${GRAPHISTE}`,
  },
  eps: {
    etat: 'inconnu', mot: 'À voir à l’atelier', titre: 'Fichier EPS : il ne s’ouvre pas ici.',
    constat: 'Fichier EPS : un format de graphiste, en général vectoriel. C’est bon signe.',
    dire: DIRE_PRO,
  },
  psd: {
    etat: 'inconnu', mot: 'À voir à l’atelier', titre: 'Fichier Photoshop : il ne s’ouvre pas ici.',
    constat: 'Fichier Photoshop : ce n’est pas un format vectoriel.',
    dire: 'C’est un fichier Photoshop, que je ne peux pas contrôler ici. Je le transmets à l’atelier. Si vous avez aussi le fichier vectoriel de votre logo (PDF, AI, SVG ou EPS), envoyez-le-nous.',
  },
  tif: {
    etat: 'inconnu', mot: 'À voir à l’atelier', titre: 'Fichier TIFF : il ne s’ouvre pas ici.',
    constat: 'Fichier TIFF : ce n’est pas un format vectoriel.',
    dire: 'C’est un format que je ne peux pas contrôler ici. Je le transmets à l’atelier. Si vous avez aussi le fichier vectoriel de votre logo (PDF, AI, SVG ou EPS), envoyez-le-nous.',
  },
  mixte: {
    etat: 'inconnu', mot: 'À voir à l’atelier', titre: 'Des tracés et des images dans le même fichier.',
    constat: 'Fichier vectoriel qui contient aussi des images : seul l’atelier peut dire si le logo lui-même est vectorisé.',
    dire: 'Merci. Votre fichier mélange du vectoriel et des images : je le transmets à l’atelier, qui vous confirmera qu’il convient.',
  },
  bureau: {
    etat: 'non', mot: 'Inutilisable', titre: 'Ce n’est pas un fichier de logo.',
    constat: 'Document de bureautique (Word, PowerPoint, Excel…) : un logo collé dedans perd sa qualité.',
    dire: `Votre logo est collé dans un document : il y perd sa qualité, nous ne pouvons pas l’utiliser ainsi. Pouvez-vous nous envoyer le fichier du logo lui-même ? ${GRAPHISTE}`,
  },
  inconnu: {
    etat: 'non', mot: 'Inutilisable', titre: 'Le fichier ne s’ouvre pas.',
    constat: 'Ce fichier n’est pas une image, ou il est abîmé.',
    dire: 'Je n’arrive pas à ouvrir ce fichier. Pouvez-vous nous renvoyer votre logo ? L’idéal est le fichier vectoriel (PDF, AI, SVG ou EPS).',
  },
  vide: {
    etat: 'non', mot: 'Inutilisable', titre: 'Le fichier est vide.',
    constat: 'Le fichier s’ouvre, mais il n’y a rien à voir dedans.',
    dire: 'Le fichier que vous nous avez envoyé est vide : on n’y voit aucun dessin. Pouvez-vous nous le renvoyer ?',
  },
}

/* --------------------------------------------------------------- LE VERDICT
   `fichier` : { nom, format, sorte, natif, impasse, ia, capture } (lib/lecture.js) —
     sorte  'image'    des pixels (PNG, JPG, photo, PDF qui n'est qu'une image) ;
            'vecteur'  des tracés (SVG, PDF, AI) ;
            'mixte'    des tracés ET des images dans le même fichier ;
            'impasse'  rien à mesurer, `impasse` dit pourquoi ;
     natif  { l, h } : la taille de l'image en pixels, quand c'en est une ;
     ia     'ChatGPT' | 'une IA' | null ;
     capture vrai si c'est une capture d'écran — jamais le fichier d'origine,
            donc jamais bonne, même grande comme l'écran d'un téléphone.
   `m` : les mesures de lib/analyse.js.
   Rend { etat, mot, titre, dire, prompt, promptPour, envoi, constats }. */
export function juger(fichier, m) {
  const impasse = fichier.sorte === 'impasse' ? fichier.impasse || 'inconnu'
    : m && m.vide ? 'vide'
      : fichier.sorte === 'mixte' ? 'mixte' : null
  if (impasse) {
    const i = IMPASSES[impasse] || IMPASSES.inconnu
    const texte = x => (typeof x === 'function' ? x(fichier) : x)
    return { etat: i.etat, mot: i.mot, titre: texte(i.titre), dire: i.dire, prompt: '', promptPour: '', envoi: i.dire, constats: [{ etat: i.etat === 'non' ? 'non' : 'info', texte: texte(i.constat) }] }
  }

  const format = String(fichier.format || '').toUpperCase()
  const constats = []

  /* ---------------------------------------------------------- VECTORIEL */
  if (fichier.sorte === 'vecteur') {
    constats.push({ etat: 'ok', texte: `Fichier vectoriel${format ? ' (' + format + ')' : ''} : il s’agrandit sans perdre en qualité.` })
    const dire = 'Parfait : votre logo est un fichier vectoriel, c’est exactement ce qu’il nous faut.'
    return { etat: 'ok', mot: 'C’est bon', titre: 'Fichier vectoriel.', dire, prompt: '', promptPour: '', envoi: dire, constats }
  }

  /* -------------------------------------------------------------- IMAGE
     UN LOGO (un dessin à plat, posé sur son fond) ou UNE PHOTO (une image
     pleine, ou des dégradés et des détails) ?
     LES PIXELS UTILES sur le grand côté du dessin : une image nette vaut ses
     pixels ; une image dont les bords s'étalent en vaut d'autant moins. Un
     grand fichier s'analyse réduit : net à cette échelle, on lui accorde ses
     pixels d'origine. Une image pleine se juge à ses pixels seuls : son flou
     peut être celui de la prise de vue, pas celui du fichier. */
  const fond = m.fond
  const pleine = fond.sorte === 'plein'
  const logo = !pleine && m.aplat >= PART_APLAT
  const cote = Math.max(m.cadre.l, m.cadre.h)
  const echelle = fichier.natif ? Math.max(fichier.natif.l, fichier.natif.h) / Math.max(m.l, m.h) : 1
  const flou = pleine ? null : m.flou
  const net = flou == null || flou <= FLOU_NET
  const utiles = flou == null || flou <= FLOU_REF ? cote * echelle : cote * FLOU_REF / flou
  /* Une image floue a les bords fondus : c'est son flou qu'on annonce. */
  const ombres = net && m.fondu >= FONDU_PART

  const taille = fichier.natif ? ` de ${pixels(fichier.natif.l)} × ${pixels(fichier.natif.h)} pixels` : ''
  const emballe = fichier.format === 'pdf' || fichier.format === 'svg'
  const nature = emballe ? `${format} qui ne contient qu’une image${taille}` : `Image${format ? ' ' + format : ''}${taille}`
  const fondVu = fond.sorte === 'transparent' ? { etat: 'ok', texte: 'Fond transparent.' }
    : fond.damier ? { etat: 'limite', texte: 'Faux fond transparent : le damier gris et blanc est dessiné dans l’image.' }
      : pleine ? null
        : { etat: 'limite', texte: `Fond ${fond.blanc ? 'blanc' : nomCouleur(fond.couleur)} à retirer.` }

  /* C'EST BON : une photo en haute résolution — une capture d'écran n'en est
     pas une, si grande soit-elle. */
  if (!logo && !fond.damier && !fichier.capture && utiles >= PIXELS_PHOTO) {
    constats.push({ etat: 'ok', texte: `${nature} : une photo en haute résolution.` })
    if (fichier.ia) constats.push({ etat: 'info', texte: `Créé avec ${fichier.ia}.` })
    const dire = 'C’est bon : votre image est en haute résolution, nous pouvons l’imprimer telle quelle.'
    return { etat: 'ok', mot: 'C’est bon', titre: 'Photo en haute résolution.', dire, prompt: '', promptPour: '', envoi: dire, constats }
  }

  /* Tout le reste n'est pas bon. Ce que le contrôle a vu, dans l'ordre. */
  constats.push(logo
    ? { etat: 'limite', texte: `${nature} : ce n’est pas un fichier vectoriel.` }
    : { etat: 'info', texte: `${nature}.` })
  if (fichier.capture) constats.push({ etat: 'limite', texte: 'Capture d’écran : ce n’est pas le fichier d’origine.' })
  if (fichier.ia) constats.push({ etat: 'info', texte: `Créé avec ${fichier.ia}.` })
  const prompt = ecrirePrompt({
    logo, ombres,
    fond: fond.damier ? 'damier' : pleine ? 'décor' : fond.sorte !== 'uni' ? '' : fond.blanc ? 'blanc' : nomCouleur(fond.couleur),
  })
  const promptPour = fichier.ia ? 'Le prompt à lui envoyer, pour ChatGPT' : 'S’il vient de ChatGPT : le prompt à lui envoyer'
  const quoi = logo ? 'votre logo' : 'votre image'

  /* INUTILISABLE : trop petit ou trop flou, même comme modèle. */
  if (utiles < PIXELS_POURRI) {
    constats.push({ etat: 'non', texte: net ? 'Image trop petite.' : 'Image trop floue : elle a été agrandie ou trop compressée.' })
    if (fondVu) constats.push(fondVu)
    const dire = `Le fichier que vous nous avez envoyé est de trop mauvaise qualité : l’image est trop ${net ? 'petite' : 'floue'}, nous ne pouvons rien en faire. ${fichier.ia ? `Il a été créé avec ${fichier.ia} : retournez` : 'S’il a été créé avec ChatGPT, retournez'} dans la conversation où il a été créé, envoyez-lui le message que je vous transmets, puis renvoyez-nous le fichier qu’il vous donne.${fichier.capture ? ' ' + CAPTURE : ''} ${GRAPHISTE}`
    return { etat: 'non', mot: 'Inutilisable', titre: net ? 'Image trop petite.' : 'Image trop floue.', dire, prompt, promptPour, envoi: envoi(dire, prompt), constats }
  }

  /* À REPRENDRE : le prompt, ou la reprise facturée. Une image qui n'est pas
     un logo arrive ici trop petite — ou assez grande, mais c'est une capture
     d'écran, ou son fond transparent est un faux damier : c'est alors ça
     qu'on annonce, pas sa taille. */
  const petite = utiles < PIXELS_PHOTO
  if (!logo && petite) constats.push({ etat: 'limite', texte: `${pixels(utiles)} pixels utiles : il en faut ${pixels(PIXELS_PHOTO)} pour une photo en haute résolution.` })
  if (!pleine && !net) constats.push({ etat: 'limite', texte: 'Image floue : elle a été agrandie ou trop compressée.' })
  if (fondVu) constats.push(fondVu)
  if (ombres) constats.push({ etat: 'limite', texte: 'Ombres ou transparences.' })

  const raison = logo ? 'ce n’est pas un fichier vectoriel'
    : petite ? 'elle n’est pas en haute résolution'
      : fichier.capture ? 'c’est une capture d’écran, pas le fichier d’origine'
        : 'son fond transparent est un faux, dessiné dans l’image'
  const sorties = fichier.ia
    ? `${logo ? 'Il' : 'Elle'} a été créé${logo ? '' : 'e'} avec ${fichier.ia} : renvoyez-lui ${quoi} avec le message que je vous transmets, puis envoyez-nous le fichier qu’il vous donne. Sinon, l’atelier peut ${logo ? 'le' : 'la'} reprendre : cette reprise est facturée.`
    : `Deux solutions. ${logo ? 'S’il a été créé' : 'Si elle a été créée'} avec ChatGPT, renvoyez-lui ${quoi} avec le message que je vous transmets, puis envoyez-nous le fichier qu’il vous donne. Sinon, l’atelier peut ${logo ? 'le' : 'la'} reprendre : cette reprise est facturée.`
  const original = fichier.capture ? (logo || petite ? ' ' + CAPTURE : ' Si vous avez le fichier d’origine, envoyez-nous plutôt celui-là.') + (logo ? ' ' + GRAPHISTE : '')
    : logo ? ' ' + GRAPHISTE
      : pleine && !fichier.ia ? ' S’il s’agit d’une photo, envoyez-nous plutôt l’originale, en pleine qualité.' : ''
  const dire = `${quoi[0].toUpperCase() + quoi.slice(1)} ne convient pas tel${logo ? '' : 'le'} quel${logo ? '' : 'le'} : ${raison}. ${sorties}${original}`
  return {
    etat: 'limite', mot: 'À reprendre', dire, prompt, promptPour, envoi: envoi(dire, prompt), constats,
    titre: `${logo ? 'Logo non vectoriel' : petite ? 'Image trop petite' : fichier.capture ? 'Capture d’écran' : 'Faux fond transparent'} : ${fichier.ia ? 'prompt à envoyer, ou reprise facturée' : 'reprise facturée, ou prompt à envoyer'}.`,
  }
}
