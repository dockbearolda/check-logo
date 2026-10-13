/* ================================================================ LES RÈGLES
   Tous les seuils de l'atelier, à un seul endroit. Changer une règle, c'est
   changer une ligne ici — rien d'autre ne porte de chiffre.

   Les règles DTF sont celles du Logo maker (lib/controle.js, lib/tailles-
   dtf.js) : un trait sous 0,3 mm ne tient pas, une image sous 200 dpi se
   voit, les tailles sont celles du tableau d'OLDA.
   Pur : ni page, ni fil. */

/* LA RÉSOLUTION. Sous `DPI_MIN`, l'impression se voit pixellisée (le seuil
   ambre du Logo maker). */
export const DPI_MIN = 200

/* LE TRAIT LE PLUS FIN, en millimètres. En DTF, sous 0,3 mm la colle ne
   tient pas. En usinage, 0,5 mm : À CONFIRMER PAR L'ATELIER, la valeur
   dépend de la machine et de la matière. */
export const TRAIT_MIN_DTF = 0.3
export const TRAIT_MIN_USINAGE = 0.5

/* LES TAILLES DTF d'OLDA, en millimètres de large (« tailles-logos-dtf.csv »,
   23 septembre 2026). */
export const EMPLACEMENTS = [
  { nom: 'Cœur, poitrine', de: 55, a: 80 },
  { nom: 'Bébé', de: 110, a: 140 },
  { nom: 'Tote bag', de: 205, a: 250 },
  { nom: 'Dos', de: 200, a: 340 },
]
export const PLUS_PETIT = Math.min(...EMPLACEMENTS.map(e => e.de))
export const PLUS_GRAND = Math.max(...EMPLACEMENTS.map(e => e.a))

/* En usinage, on ne connaît pas la taille de la pièce : on ne signale un trait
   fin que s'il demande une pièce plus grande que ça, en millimètres. */
export const USINAGE_PETIT = 30

/* Le grand côté, en pixels, auquel un fichier s'analyse. */
export const COTE_ANALYSE = 2048

/* En dessous de ce nombre de pixels utiles, une image même simple ne se
   retrace pas proprement pour l'usinage. */
export const PIXELS_RETRACABLE = 500

/* LA NETTETÉ. La largeur d'un bord, en pixels. Un logo net mesure 1,3 à
   1,5 (mesuré sur les logos du catalogue OLDA) : `FLOU_REF`. Agrandi deux
   fois, son bord s'étale deux fois plus, et ses pixels utiles baissent
   d'autant. Au-delà de `FLOU_NET`, on dit que l'image est floue. */
export const FLOU_REF = 1.5
export const FLOU_NET = 2

/* LES APLATS. Un logo « à plat » tient dans six teintes : elles couvrent au
   moins cette part de son encre. En dessous, il a des dégradés ou c'est une
   photo. */
export const PART_APLAT = 0.85

/* LES EFFETS FONDUS (ombre, lueur, transparence, bord flouté). La part du
   dessin faite de pixels à demi transparents plus larges qu'un contour : à
   partir de là, ce n'est plus un lissage, c'est un effet. */
export const FONDU_PART = 0.02
