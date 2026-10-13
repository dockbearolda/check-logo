/* ================================================================ LE VERDICT
   Les mesures entrent (lib/analyse.js), UNE réponse sort — la vendeuse doit
   savoir tout de suite quoi faire du fichier :

     ok       C'EST BON : un vrai fichier vectoriel, ou une image propre
              (nette, à plat, sur un fond qui part tout seul) que l'atelier
              vectorise. Une illustration détaillée et nette passe aussi,
              TELLE QUELLE : toute reprise ou modification est facturée.
     limite   À REFAIRE : l'image a un défaut (un fond, un faux damier, des
              ombres, du flou). Le client la refait lui-même — la plupart
              des logos sortent de ChatGPT — avec LE PROMPT qu'on lui envoie.
     non      INUTILISABLE : trop petite, trop floue, ou pas une image.
     inconnu  le fichier ne s'ouvre pas ici, l'atelier tranchera.

   Avec chaque réponse : ce que la vendeuse dit au client, en mots de tous
   les jours, et — quand il y a quelque chose à refaire — le prompt, écrit
   d'après ce que le contrôle a trouvé.

   Les phrases et le prompt sont ici et nulle part ailleurs. Pur : ni page,
   ni fil. */
import { PIXELS_POURRI, PIXELS_ILLUSTRATION, FLOU_REF, FLOU_NET, PART_APLAT, FONDU_PART } from './regles.js'

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

const FACTURE = 'toute reprise ou modification pour l’améliorer sera facturée'
const GRAPHISTE = 'Si c’est un graphiste qui l’a créé, demandez-lui le fichier vectoriel (PDF, AI, SVG ou EPS).'

/* -------------------------------------------------------------- LE PROMPT
   Ce que le client envoie à ChatGPT avec son logo. Il ne demande que ce que
   le contrôle a trouvé à corriger — et de ne rien changer d'autre.
     aplat   un logo à plat (sinon, une illustration : on garde son style) ;
     fond    un fond ou un décor à retirer ;
     damier  un faux fond transparent ;
     ombres  des ombres, des lueurs, des transparences ;
     grand   une image trop petite ou floue. */
export function ecrirePrompt({ aplat, fond, damier, ombres, grand }) {
  const lignes = [`Refais ${aplat ? 'ce logo' : 'ce visuel'} à l’identique : mêmes formes, mêmes textes, mêmes couleurs, même mise en page. Ne change rien d’autre que ce qui suit.`]
  if (damier) lignes.push('- Le fond doit être réellement transparent : supprime le damier gris et blanc, il ne doit plus apparaître dans l’image.')
  else if (fond) lignes.push('- Retire complètement le fond et le décor : garde uniquement le dessin, sur un fond réellement transparent.')
  if (ombres) lignes.push('- Supprime les ombres portées, les lueurs et les zones à moitié transparentes : des contours nets et francs.')
  if (grand) lignes.push('- Génère-le en très haute résolution, le plus grand possible, avec des contours parfaitement nets.')
  lignes.push(aplat
    ? '- Style vectoriel : couleurs unies en aplat, sans dégradé ni texture.'
    : '- Garde le même style et le même niveau de détail.')
  lignes.push(`- Donne-moi le résultat en PNG haute résolution sur fond transparent${aplat ? ', et en SVG si tu peux' : ''}.`)
  return lignes.join('\n')
}

/* -------------------------------------------- CE QUI NE S'OUVRE PAS ICI
   Plutôt que « format non reconnu », on dit quoi demander au client. */
const IMPASSES = {
  eps: {
    etat: 'inconnu', mot: 'À voir à l’atelier', titre: 'Fichier EPS : il ne s’ouvre pas ici.',
    constat: 'Fichier EPS : un format de graphiste, en général vectoriel. C’est bon signe.',
    dire: 'Merci, c’est un fichier professionnel. Je le transmets à l’atelier, qui vous confirmera qu’il convient.',
  },
  psd: {
    etat: 'inconnu', mot: 'À voir à l’atelier', titre: 'Fichier Photoshop : il ne s’ouvre pas ici.',
    constat: 'Fichier Photoshop : ce n’est pas un format vectoriel.',
    dire: 'C’est un fichier Photoshop, que je ne peux pas contrôler ici. Pouvez-vous nous l’envoyer aussi en PNG avec un fond transparent, ou en PDF ?',
  },
  tif: {
    etat: 'inconnu', mot: 'À voir à l’atelier', titre: 'Fichier TIFF : il ne s’ouvre pas ici.',
    constat: 'Fichier TIFF : ce n’est pas un format vectoriel.',
    dire: 'C’est un format que je ne peux pas contrôler ici. Pouvez-vous nous l’envoyer aussi en PNG ou en PDF ?',
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
    dire: 'Je n’arrive pas à ouvrir ce fichier. Pouvez-vous nous renvoyer votre logo en PDF, en PNG ou en JPG ?',
  },
  vide: {
    etat: 'non', mot: 'Inutilisable', titre: 'Le fichier est vide.',
    constat: 'Le fichier s’ouvre, mais il n’y a rien à voir dedans.',
    dire: 'Le fichier que vous nous avez envoyé est vide : on n’y voit aucun dessin. Pouvez-vous nous le renvoyer ?',
  },
}

/* --------------------------------------------------------------- LE VERDICT
   `fichier` : { format, sorte, natif, impasse, ia } (lib/lecture.js) —
     sorte  'image'    des pixels (PNG, JPG, photo, PDF qui n'est qu'une image) ;
            'vecteur'  des tracés (SVG, PDF, AI) ;
            'mixte'    des tracés ET des images dans le même fichier ;
            'impasse'  rien à mesurer, `impasse` dit pourquoi ;
     natif  { l, h } : la taille de l'image en pixels, quand c'en est une ;
     ia     'ChatGPT' | 'une IA' | null.
   `m` : les mesures de lib/analyse.js.
   Rend { etat, mot, titre, dire, prompt, constats }. */
export function juger(fichier, m) {
  const impasse = fichier.sorte === 'impasse' ? fichier.impasse || 'inconnu'
    : m && m.vide ? 'vide'
      : fichier.sorte === 'mixte' ? 'mixte' : null
  if (impasse) {
    const i = IMPASSES[impasse] || IMPASSES.inconnu
    return { etat: i.etat, mot: i.mot, titre: i.titre, dire: i.dire, prompt: '', constats: [{ etat: i.etat === 'non' ? 'non' : 'info', texte: i.constat }] }
  }

  const format = String(fichier.format || '').toUpperCase()
  const fond = m.fond
  const pleine = fond.sorte === 'plein'
  const aplat = !pleine && m.aplat >= PART_APLAT
  const constats = []

  /* Le fond qui part tout seul à l'atelier, ou la question à poser. */
  const fondDit = fond.sorte !== 'uni' || fond.damier ? ''
    : fond.blanc ? ' Nous retirerons le fond blanc à l’atelier.'
      : ` Une question : le fond ${nomCouleur(fond.couleur)} fait-il partie de votre logo, ou faut-il l’enlever ?`
  const fondVu = fond.sorte === 'transparent' ? { etat: 'ok', texte: 'Fond transparent.' }
    : fond.damier ? { etat: 'limite', texte: 'Faux fond transparent : le damier gris et blanc est dessiné dans l’image.' }
      : pleine ? { etat: 'limite', texte: 'Un fond ou un décor dans l’image.' }
        : fond.blanc ? { etat: 'info', texte: 'Fond blanc : il part à l’atelier.' }
          : { etat: 'info', texte: `Fond ${nomCouleur(fond.couleur)} : à confirmer avec le client.` }

  /* ---------------------------------------------------------- VECTORIEL */
  if (fichier.sorte === 'vecteur') {
    constats.push({ etat: 'ok', texte: `Fichier vectoriel${format ? ' (' + format + ')' : ''} : il s’agrandit sans perdre en qualité.` })
    if (fond.sorte !== 'transparent') constats.push(fondVu)
    return {
      etat: 'ok', mot: 'C’est bon', titre: 'Logo vectorisé.', prompt: '', constats,
      dire: 'Parfait : votre logo est un fichier vectoriel, c’est exactement ce qu’il nous faut.' + fondDit,
    }
  }

  /* -------------------------------------------------------------- IMAGE
     LES PIXELS UTILES sur le grand côté du dessin. Une image nette vaut ses
     pixels ; une image dont les bords s'étalent en vaut d'autant moins. Un
     grand fichier s'analyse réduit : net à cette échelle, on lui accorde ses
     pixels d'origine. Une image pleine se juge à ses pixels seuls : son flou
     peut être celui d'une photo, pas celui du fichier. */
  const cote = Math.max(m.cadre.l, m.cadre.h)
  const echelle = fichier.natif ? Math.max(fichier.natif.l, fichier.natif.h) / Math.max(m.l, m.h) : 1
  const flou = pleine ? null : m.flou
  const net = flou == null || flou <= FLOU_NET
  const utiles = flou == null || flou <= FLOU_REF ? cote * echelle : cote * FLOU_REF / flou
  /* Une image floue a les bords fondus : c'est son flou qu'on annonce. */
  const ombres = net && m.fondu >= FONDU_PART
  const petite = !aplat && !pleine && utiles < PIXELS_ILLUSTRATION

  const taille = fichier.natif ? ` de ${pixels(fichier.natif.l)} × ${pixels(fichier.natif.h)} pixels` : ''
  constats.push({
    etat: 'info',
    texte: fichier.format === 'pdf' || fichier.format === 'svg'
      ? `${format} qui ne contient qu’une image${taille} : ce n’est pas un vrai fichier vectoriel.`
      : `Image${format ? ' ' + format : ''}${taille} : pas un fichier vectoriel.`,
  })
  if (fichier.ia) constats.push({ etat: 'info', texte: `Créé avec ${fichier.ia}.` })

  /* Si le logo sort d'une IA, le client lui redemande ; sinon, au graphiste. */
  const redemander = fichier.ia
    ? `Il a été créé avec ${fichier.ia} : le plus simple est de lui redemander.`
    : 'S’il a été créé avec ChatGPT ou une autre IA, le plus simple est de lui redemander.'

  /* INUTILISABLE : trop petite ou trop floue, même comme modèle. */
  if (utiles < PIXELS_POURRI) {
    constats.push({ etat: 'non', texte: net ? 'Image trop petite.' : 'Image trop floue : elle a été agrandie ou trop compressée.' })
    constats.push(fondVu)
    return {
      etat: 'non', mot: 'Inutilisable', titre: net ? 'Image trop petite.' : 'Image trop floue.', constats,
      dire: `Le fichier que vous nous avez envoyé est de trop mauvaise qualité : l’image est trop ${net ? 'petite' : 'floue'}, nous ne pouvons rien en faire. ${redemander} Retournez dans la conversation où il a été créé et envoyez-lui le message que je vous transmets, puis renvoyez-nous le fichier qu’il vous donne. ${GRAPHISTE}`,
      prompt: ecrirePrompt({ aplat, fond: pleine, damier: fond.damier, ombres: false, grand: true }),
    }
  }

  if (!pleine) constats.push(net ? { etat: 'ok', texte: 'Image nette.' } : { etat: 'limite', texte: 'Image floue : elle a été agrandie ou trop compressée.' })
  constats.push(fondVu)
  if (!pleine) {
    constats.push(aplat
      ? { etat: 'ok', texte: m.couleurs.length > 1 ? `${m.couleurs.length} couleurs à plat.` : 'Une seule couleur, à plat.' }
      : { etat: 'info', texte: 'Dégradés et détails : une illustration.' })
  }
  if (ombres) constats.push({ etat: 'limite', texte: 'Ombres ou transparences.' })
  if (petite && net) constats.push({ etat: 'limite', texte: 'Image un peu petite pour un visuel aussi détaillé.' })

  /* À REFAIRE : les défauts, dits en clair, et le prompt qui les corrige. */
  const defauts = []
  if (fond.damier) defauts.push('son fond n’est pas vraiment transparent, le damier gris et blanc fait partie de l’image et s’imprimerait avec')
  else if (pleine) defauts.push('il a un fond ou un décor, qui s’imprimerait avec lui')
  if (ombres) defauts.push('il a des ombres ou des transparences, qui sortent mal à l’impression')
  if (!net) defauts.push('l’image est floue, elle a été agrandie ou trop compressée')
  else if (petite) defauts.push('l’image est trop petite pour un visuel aussi détaillé')
  if (defauts.length) {
    const titre = fond.damier ? 'Faux fond transparent.'
      : pleine ? 'Un fond à retirer.'
        : ombres ? 'Des ombres à retirer.'
          : !net ? 'Image floue.' : 'Image trop petite.'
    return {
      etat: 'limite', mot: 'À refaire', titre, constats,
      dire: `Votre logo ne convient pas tel quel : ${defauts.join(' ; ')}. ${redemander} Envoyez-lui votre logo avec le message que je vous transmets, puis renvoyez-nous le fichier qu’il vous donne.${pleine ? ' Si vous préférez l’imprimer tel quel, en rectangle avec son fond, c’est possible aussi.' : ''} Si vous préférez que l’atelier s’en charge, la reprise sera facturée.`,
      prompt: ecrirePrompt({ aplat, fond: pleine, damier: fond.damier, ombres, grand: !net || petite }),
    }
  }

  /* C'EST BON : une image propre que l'atelier vectorise… */
  if (aplat) {
    return {
      etat: 'ok', mot: 'C’est bon', titre: 'Image propre : l’atelier la vectorise.', prompt: '', constats,
      dire: 'C’est bon : votre logo est net et propre, nous pouvons travailler avec.' + fondDit,
    }
  }
  /* … ou une illustration nette, prise telle quelle. */
  return {
    etat: 'ok', mot: 'C’est bon, tel quel', titre: 'Toute reprise ou modification sera facturée.', prompt: '', constats,
    dire: `C’est bon : nous pouvons utiliser votre visuel tel quel. À savoir : ${FACTURE}.` + fondDit,
  }
}
