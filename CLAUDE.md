TABLETTE: non

# Check logo · OLDA

L'outil du comptoir pour la vendeuse, qui n'a pas de notion de graphisme : le
fichier du client se dépose, le contrôle dit s'il convient pour l'impression
DTF et pour l'usinage, et CE QU'IL FAUT DIRE AU CLIENT. Pages statiques, sans
build ni paquet, en ligne sur GitHub Pages depuis `main`
(<https://dockbearolda.github.io/check-logo/>, la tuile « Check logo » du
portail <https://dockbearolda.github.io/>). On modifie les fichiers, on
vérifie dans l'aperçu `check-logo`, `node --test`, on pousse.

## Ce qui est tranché (ne pas défaire)

- **Téléphone d'abord, puis PC.** Une colonne jusqu'à 900 px, deux au-delà.
  iPhone (390–430 px) et bureau à vérifier à chaque changement d'écran.
- **Tout se calcule sur l'appareil.** Aucun serveur, aucune clé, aucun envoi :
  le fichier du client ne quitte pas le poste. Pas d'IA en ligne.
- **Zéro réglage pour la vendeuse.** Elle dépose, elle lit. Pas de champ, pas
  d'option, pas de taille à taper : le contrôle donne lui-même jusqu'où le
  logo s'imprime, emplacement par emplacement.
- **Jamais un mot de graphiste dans ce qu'elle dit au client.** Les phrases
  sont dans `lib/verdict.js` et nulle part ailleurs. « Vectoriel » ne passe
  qu'accompagné de « le fichier d'origine, celui que le graphiste a créé ».
- **Les seuils sont dans `lib/regles.js` et nulle part ailleurs.** Ceux du DTF
  sont ceux du Logo maker (0,3 mm, 200 dpi, les tailles d'OLDA). Avant d'en
  changer un : `node outils/banc.mjs <dossier de vrais logos>`, avant et après.
- **On ne promet jamais trop.** Une taille maximale s'arrondit vers le bas,
  une taille minimale vers le haut. Dans le doute, le verdict est « Sous
  réserve », pas « Compatible ».
- **Un trait fin est fin ET long** (`traitFin`, `lib/analyse.js`) : une
  pointe, un empattement, l'angle d'une lettre ne déclenchent rien.
- **PHAREDESIGN, en entier.** La seule couleur de l'écran est celle d'un
  verdict. Aucune valeur en dur dans `app.css` ; un jeton qui manque se pose
  dans `phare.css` avec son rôle. Avant de pousser :
  `node ~/.claude/skills/pharedesign/verifier.mjs . --exclure essais`.
- **Aucun fichier de client dans le dépôt** (il est public). Les fichiers
  d'essai vivent dans `essais/`, ignoré par git.

## Les fichiers

| Où | Quoi |
|---|---|
| `index.html`, `app.css` | la page ; `phare.css` et `phare-composants.css` sont la charte, copiée telle quelle (plus trois jetons : `--dur-scan`, `--support-clair`, `--support-sombre`) |
| `lib/app.js` | l'écran : déposer, choisir, coller ; le scan ; les verdicts ; le calque rouge et orange sur l'aperçu |
| `lib/lecture.js`, `lib/format.js` | le fichier lu : son format dans ses octets, PNG/JPG/WebP/HEIC, SVG, PDF et `.ai` (vectoriel, ou une image emballée), et ce qui ne s'ouvre pas ici (EPS, PSD, Word…) |
| `lib/analyse.js`, `lib/travail.js` | les mesures, dans un fil : le fond, les couleurs, le flou, le trait le plus fin, les ombres |
| `lib/verdict.js` | le jugement et ses phrases : DTF, usinage, « à dire au client » |
| `lib/regles.js` | tous les seuils |
| `outils/banc.mjs`, `outils/png.mjs` | le banc : le contrôle passé sur un dossier de vrais fichiers, hors du navigateur |
| `tests/` | `node --test` : les mesures sur des images dessinées, les verdicts, les formats |
| `vendor/` | pdf.js et libheif, copiés du Logo maker ; versions et licences dans `vendor/LISEZMOI.md` |
| `serveur.mjs` | le serveur du poste (`npm start`, port 8140) — en ligne, GitHub Pages sert le dossier |

## À confirmer par l'atelier

- `TRAIT_MIN_USINAGE` (0,5 mm) : posé par défaut, il dépend de la machine et
  de la matière.
- Les phrases « l'atelier la retrace », « le logo devra être redessiné » ne
  parlent ni de prix ni de délai : à compléter si la maison veut l'annoncer.
