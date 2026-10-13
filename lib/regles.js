/* ================================================================ LES RÈGLES
   Tous les seuils du contrôle, à un seul endroit. Changer une règle, c'est
   changer une ligne ici — rien d'autre ne porte de chiffre.
   Pur : ni page, ni fil. */

/* Le grand côté, en pixels, auquel un fichier s'analyse. */
export const COTE_ANALYSE = 2048

/* LA NETTETÉ. La largeur d'un bord, en pixels. Un logo net mesure 1,3 à 1,6
   (mesuré sur les logos du catalogue OLDA et sur des images de ChatGPT) :
   `FLOU_REF`. Agrandi deux fois, son bord s'étale deux fois plus, et ses
   pixels utiles baissent d'autant. Au-delà de `FLOU_NET`, l'image est floue. */
export const FLOU_REF = 1.5
export const FLOU_NET = 2

/* LES PIXELS UTILES, sur le grand côté du dessin — ses pixels, moins ce que
   le flou en retire. En dessous de `PIXELS_POURRI`, le fichier ne sert à
   rien, même comme modèle. Une illustration détaillée en demande davantage
   qu'un logo à plat : `PIXELS_ILLUSTRATION`. */
export const PIXELS_POURRI = 500
export const PIXELS_ILLUSTRATION = 1000

/* LES APLATS. Un logo « à plat » tient dans six teintes : elles couvrent au
   moins cette part de son encre. En dessous, c'est une illustration (des
   dégradés, des détails) ou une photo. */
export const PART_APLAT = 0.85

/* LES OMBRES ET TRANSPARENCES. La part du dessin faite de pixels à demi
   transparents plus larges qu'un contour : à partir de là, ce n'est plus un
   lissage, c'est un effet. */
export const FONDU_PART = 0.02
