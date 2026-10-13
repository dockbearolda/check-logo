/* ================================================================ LE VERDICT
   Les mesures entrent (lib/analyse.js), le verdict sort : pour l'impression
   DTF et pour l'usinage, un état, un titre, et CE QUE LA VENDEUSE DIT AU
   CLIENT — en mots de tous les jours, sans un mot de graphiste.

   Quatre états, et la couleur ne dit que ça :
     ok       compatible ;
     limite   compatible avec des réserves (une taille maximale, une retouche) ;
     non      non compatible tel quel ;
     inconnu  le fichier ne s'ouvre pas ici, l'atelier tranchera.
   Un fichier qui ne s'ouvre pas n'a qu'une réponse pour les deux techniques
   (`unique`).

   Les phrases sont ici et nulle part ailleurs : en changer une, c'est changer
   ce fichier. Pur : ni page, ni fil. */
import {
  DPI_MIN, TRAIT_MIN_DTF, TRAIT_MIN_USINAGE, EMPLACEMENTS, PLUS_PETIT, PLUS_GRAND,
  PIXELS_RETRACABLE, USINAGE_PETIT, FLOU_REF, FLOU_NET, PART_APLAT, FONDU_PART,
} from './regles.js'

/* « 21 cm », « 5,5 cm » : vers le bas pour un maximum, vers le haut pour un
   minimum — on ne promet jamais un millimètre de trop. L'espace est
   insécable : le nombre ne quitte pas son unité en fin de ligne. */
const nombre = v => v.toLocaleString('fr-FR', { maximumFractionDigits: 1, useGrouping: false })
export const cm = (mm, vers = Math.floor) => {
  const v = mm / 10
  return nombre(v < 10 ? vers(v * 2) / 2 : vers(v)) + '\u00a0cm'
}
const pixels = n => Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')

/* Le nom d'une couleur, pour demander « le fond noir fait-il partie du
   logo ? ». */
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

const ORIGINE = 'le fichier d’origine de votre logo (PDF, AI, SVG ou EPS), celui que le graphiste ou l’imprimeur a créé'

/* -------------------------------------------- CE QUI NE S'OUVRE PAS ICI
   Plutôt que « format non reconnu », on dit quoi demander au client. */
const IMPASSES = {
  eps: {
    etat: 'inconnu', titre: 'À ouvrir à l’atelier',
    constat: 'Fichier EPS : un format de graphiste, en général vectoriel. C’est bon signe, mais il ne s’ouvre pas ici.',
    dire: 'Merci, c’est un fichier professionnel. Je le transmets à l’atelier, qui vous confirmera qu’il convient.',
  },
  psd: {
    etat: 'inconnu', titre: 'À ouvrir à l’atelier',
    constat: 'Fichier Photoshop : il ne s’ouvre pas ici.',
    dire: 'C’est un fichier Photoshop, que je ne peux pas contrôler ici. Pouvez-vous nous l’envoyer aussi en PNG avec un fond transparent, ou en PDF ?',
  },
  tif: {
    etat: 'inconnu', titre: 'À ouvrir à l’atelier',
    constat: 'Fichier TIFF : il ne s’ouvre pas ici.',
    dire: 'C’est un format que je ne peux pas contrôler ici. Pouvez-vous nous l’envoyer aussi en PNG ou en PDF ?',
  },
  bureau: {
    etat: 'non', titre: 'Ce n’est pas un fichier de logo',
    constat: 'Document de bureautique (Word, PowerPoint, Excel…) : un logo collé dedans perd sa qualité.',
    dire: `Votre logo est collé dans un document : il y perd sa qualité, nous ne pouvons pas l’utiliser ainsi. Pouvez-vous nous envoyer le fichier du logo lui-même ? L’idéal est ${ORIGINE}.`,
  },
  inconnu: {
    etat: 'non', titre: 'Fichier illisible',
    constat: 'Ce fichier n’est pas une image, ou il est abîmé.',
    dire: `Je n’arrive pas à ouvrir ce fichier. Pouvez-vous nous renvoyer votre logo en PDF, en PNG ou en JPG ? L’idéal est ${ORIGINE}.`,
  },
  vide: {
    etat: 'non', titre: 'Fichier vide',
    constat: 'Le fichier s’ouvre, mais il n’y a rien à voir dedans.',
    dire: 'Le fichier que vous nous avez envoyé est vide : on n’y voit aucun dessin. Pouvez-vous nous le renvoyer ?',
  },
}

/* --------------------------------------------------------------- LE VERDICT
   `fichier` : { format, sorte, natif, impasse } (lib/lecture.js) —
     sorte  'image'    des pixels (PNG, JPG, photo, PDF qui n'est qu'une image) ;
            'vecteur'  des tracés (SVG, PDF, AI) ;
            'mixte'    des tracés ET des images dans le même fichier ;
            'impasse'  rien à mesurer, `impasse` dit pourquoi ;
     natif  { l, h } : la taille de l'image en pixels, quand c'en est une.
   `m` : les mesures de lib/analyse.js. */
export function juger(fichier, m) {
  const impasse = fichier.sorte === 'impasse' ? fichier.impasse || 'inconnu' : m && m.vide ? 'vide' : null
  if (impasse) {
    const i = IMPASSES[impasse] || IMPASSES.inconnu
    const v = { etat: i.etat, titre: i.titre, dire: i.dire }
    return { unique: true, dtf: { ...v, emplacements: null }, usinage: v, constats: [{ etat: i.etat === 'non' ? 'non' : 'info', texte: i.constat }], apercu: null }
  }

  const vecteur = fichier.sorte === 'vecteur' || fichier.sorte === 'mixte'
  const pleine = m.fond.sorte === 'plein'
  const aplat = m.aplat >= PART_APLAT
  const cote = Math.max(m.cadre.l, m.cadre.h)
  const sens = m.cadre.l >= m.cadre.h ? 'de large' : 'de haut'

  /* LES PIXELS UTILES sur le grand côté du dessin. Une image nette vaut ses
     pixels ; une image dont les bords s'étalent en vaut d'autant moins. Un
     grand fichier s'analyse réduit : net à cette échelle, on lui accorde ses
     pixels d'origine. Une photo se juge à ses pixels seuls : son flou est
     celui de la prise de vue, pas celui du fichier. */
  const echelle = fichier.natif ? Math.max(fichier.natif.l, fichier.natif.h) / Math.max(m.l, m.h) : 1
  const flou = pleine || vecteur ? null : m.flou
  const net = flou == null || flou <= FLOU_NET
  const utiles = vecteur ? Infinity : flou == null || flou <= FLOU_REF ? cote * echelle : cote * FLOU_REF / flou
  const maxMm = utiles / DPI_MIN * 25.4
  const minDtf = m.fin ? TRAIT_MIN_DTF * cote / m.fin : 0
  const minUsinage = m.fin ? TRAIT_MIN_USINAGE * cote / m.fin : 0
  const trop = !vecteur && maxMm < PLUS_PETIT
  const jamaisFin = minDtf > Math.min(maxMm, PLUS_GRAND)
  /* Une image floue a les bords fondus : c'est son flou qu'on annonce. */
  const fondu = net && m.fondu >= FONDU_PART

  /* ---------------------------------------------------------------- DTF
     D'abord ce qu'est le fichier et jusqu'où il s'imprime, puis les réserves. */
  const emplacements = trop ? null : EMPLACEMENTS.map(e => {
    if (maxMm < e.de) return { nom: e.nom, etat: 'non', texte: 'Image trop petite' }
    if (minDtf > e.a) return { nom: e.nom, etat: 'non', texte: 'Traits trop fins' }
    if (maxMm < e.a) return { nom: e.nom, etat: 'limite', texte: 'Jusqu’à ' + cm(maxMm) }
    if (minDtf > e.de) return { nom: e.nom, etat: 'limite', texte: 'À partir de ' + cm(minDtf, Math.ceil) }
    return { nom: e.nom, etat: 'ok', texte: 'Oui' }
  })
  const dos = EMPLACEMENTS[EMPLACEMENTS.length - 1]

  const dtf = { etat: 'ok', titre: 'Net à toutes les tailles', dire: '', emplacements }
  const d = []
  if (vecteur) {
    d.push('C’est un fichier vectoriel, le meilleur format : il reste net à toutes les tailles.')
  } else if (trop) {
    dtf.etat = 'non'
    dtf.titre = net ? 'Image trop petite' : 'Image trop floue'
    d.push(`L’image que vous nous avez envoyée est trop ${net ? 'petite' : 'floue'} pour être imprimée proprement : elle sortirait pixellisée, même en petit. Auriez-vous ${ORIGINE} ? Sinon, une image plus grande et plus nette.`)
  } else if (pleine) {
    dtf.etat = 'limite'
    dtf.titre = 'Photo : imprimable en rectangle'
    d.push(`C’est une photo : elle s’imprime telle quelle, en rectangle, avec tout ce qu’il y a autour${maxMm >= PLUS_GRAND ? '' : `, jusqu’à ${cm(maxMm)} ${sens}`}. Si vous voulez seulement le logo, sans le décor, il nous faut le fichier du logo lui-même.`)
  } else if (maxMm >= PLUS_GRAND) {
    d.push('Votre image est de bonne qualité : elle s’imprime nette à toutes nos tailles.')
  } else {
    dtf.etat = 'limite'
    dtf.titre = `Net jusqu’à ${cm(maxMm)} ${sens}`
    d.push(`Votre image s’imprime nette jusqu’à ${cm(maxMm)} ${sens}. Pour l’imprimer plus grand${maxMm < dos.de ? ', dans le dos par exemple' : ''}, il nous faut ${ORIGINE}, ou une image plus grande.`)
  }
  if (!trop) {
    if (jamaisFin) {
      dtf.etat = 'limite'
      dtf.titre = 'Traits trop fins'
      d.push('Mais certains traits sont trop fins pour tenir sur le textile : il faudrait une version du logo aux traits plus épais.')
    } else if (minDtf > PLUS_PETIT) {
      d.push(`Ses traits les plus fins tiennent à partir de ${cm(minDtf, Math.ceil)} ${sens} : en dessous, ils risquent de disparaître.`)
    }
    if (fondu) {
      dtf.etat = 'limite'
      dtf.titre = 'Ombres ou transparences à retirer'
      d.push('Votre logo a des ombres ou des transparences : à l’impression, elles sortent avec un voile blanc. Il nous faut une version sans ces effets, aux contours nets.')
    }
    if (m.fond.sorte === 'uni') {
      d.push(m.fond.blanc
        ? 'Nous retirerons le fond blanc à l’atelier.'
        : `Une question : le fond ${nomCouleur(m.fond.couleur)} fait-il partie de votre logo, ou faut-il l’enlever ?`)
    }
  }
  dtf.dire = d.join(' ')

  /* ------------------------------------------------------------ USINAGE
     La machine suit des tracés : il lui faut un fichier vectoriel, ou une
     image assez nette et simple pour que l'atelier la retrace. */
  const usinage = { etat: 'ok', titre: '', dire: '' }
  const u = []
  const retracable = !vecteur && !pleine && aplat && !fondu && utiles >= PIXELS_RETRACABLE
  if (fichier.sorte === 'vecteur' && aplat && !fondu) {
    usinage.titre = 'Fichier vectoriel : prêt à usiner'
    u.push('C’est un fichier vectoriel, exactement ce qu’il faut pour l’usinage : la machine peut suivre ses tracés.')
  } else if (vecteur) {
    usinage.etat = 'limite'
    usinage.titre = 'Vectoriel, à simplifier'
    u.push('Votre fichier est vectoriel, c’est ce qu’il faut pour l’usinage. Mais il contient des dégradés, des effets ou des images : la machine ne reproduit que des formes nettes, en une seule teinte. Il faudra une version simplifiée du logo.')
  } else if (retracable) {
    usinage.etat = 'limite'
    usinage.titre = 'À retracer à l’atelier'
    u.push(`Pour l’usinage, la machine suit des tracés : l’idéal est ${ORIGINE}. Si vous ne l’avez pas, votre image est assez nette et simple pour que l’atelier la retrace.`)
  } else {
    usinage.etat = 'non'
    usinage.titre = 'Il faut un fichier vectoriel'
    const raison = pleine ? 'une photo ne peut pas être usinée telle quelle'
      : !aplat ? 'une image avec des dégradés ou beaucoup de nuances ne peut pas être usinée telle quelle'
        : utiles < PIXELS_RETRACABLE ? `cette image est trop ${net ? 'petite' : 'floue'} pour être retracée proprement`
          : 'une image avec des ombres ou des transparences ne peut pas être usinée telle quelle'
    u.push(`Pour l’usinage, la machine suit des tracés nets : ${raison}. Il nous faut ${ORIGINE}. Sans lui, le logo devra être redessiné.`)
  }
  if (usinage.etat !== 'non' && (fichier.sorte === 'vecteur' ? aplat && !fondu : retracable)) {
    if (m.couleurs.length > 1) u.push('À savoir : l’usinage se fait en une seule teinte, les couleurs ne seront pas reproduites.')
    if (minUsinage > PLUS_GRAND) {
      usinage.etat = 'limite'
      usinage.titre = 'Traits trop fins'
      u.push('Mais certains traits sont trop fins pour être usinés : il faudrait une version du logo aux traits plus épais.')
    } else if (minUsinage > USINAGE_PETIT) {
      u.push(`Ses traits les plus fins demandent une pièce d’au moins ${cm(minUsinage, Math.ceil)} ${sens}.`)
    }
  }
  usinage.dire = u.join(' ')

  /* --------------------------------------------------------- LES CONSTATS
     Ce que le contrôle a vu, dans l'ordre où on le regarde. */
  const constats = []
  const nom = String(fichier.format || '').toUpperCase()
  if (fichier.sorte === 'vecteur') constats.push({ etat: 'ok', texte: `Fichier vectoriel${nom ? ' (' + nom + ')' : ''} : il s’agrandit sans perdre en qualité.` })
  else if (fichier.sorte === 'mixte') constats.push({ etat: 'limite', texte: `Fichier vectoriel${nom ? ' (' + nom + ')' : ''} qui contient aussi des images.` })
  else {
    const taille = fichier.natif ? ` de ${pixels(fichier.natif.l)} × ${pixels(fichier.natif.h)} pixels` : ''
    constats.push({ etat: 'info', texte: fichier.format === 'pdf' ? `PDF qui ne contient qu’une image${taille} : ce n’est pas un fichier vectoriel.` : `Image${nom ? ' ' + nom : ''}${taille}.` })
    if (!pleine) constats.push(net
      ? { etat: 'ok', texte: 'Image nette.' }
      : { etat: trop ? 'non' : 'limite', texte: 'Image floue : elle a été agrandie ou trop compressée.' })
  }
  if (m.fond.sorte === 'transparent') constats.push({ etat: 'ok', texte: 'Fond transparent : rien à retirer.' })
  else if (pleine) constats.push({ etat: 'info', texte: 'Photo ou image pleine : elle occupe tout son cadre.' })
  else if (m.fond.blanc) constats.push({ etat: 'info', texte: 'Fond blanc : l’atelier le retire.' })
  else constats.push({ etat: 'limite', texte: `Fond ${nomCouleur(m.fond.couleur)} : à confirmer avec le client.` })
  if (!pleine) {
    constats.push(aplat
      ? { etat: 'ok', texte: m.couleurs.length > 1 ? `${m.couleurs.length} couleurs à plat.` : 'Une seule couleur, à plat.' }
      : { etat: 'info', texte: 'Dégradés ou nombreuses nuances.' })
    constats.push(jamaisFin ? { etat: 'limite', texte: 'Traits trop fins pour le textile.' }
      : minDtf > PLUS_PETIT ? { etat: 'limite', texte: `Traits fins : ils tiennent à partir de ${cm(minDtf, Math.ceil)} ${sens}.` }
        : { etat: 'ok', texte: 'Pas de trait trop fin.' })
  }
  if (fondu) constats.push({ etat: 'limite', texte: 'Ombres ou transparences.' })

  /* L'APERÇU : sous quelle épaisseur — en pixels d'analyse — un trait se
     montre en rouge sur le logo : trop fin à la plus grande taille imprimable
     s'il ne tient jamais, à la plus petite taille d'OLDA sinon. Et s'il y a
     des ombres à montrer. */
  const apercu = {
    finPx: pleine || trop ? 0
      : jamaisFin ? TRAIT_MIN_DTF * cote / Math.min(maxMm, PLUS_GRAND)
        : minDtf > PLUS_PETIT ? TRAIT_MIN_DTF * cote / PLUS_PETIT : 0,
    fondu,
  }

  return { unique: false, dtf, usinage, constats, apercu }
}
