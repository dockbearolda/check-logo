TABLETTE: non

# Check logo · OLDA

L'outil du comptoir pour la vendeuse, qui n'a pas de notion de graphisme : le
fichier du client se dépose, et UNE réponse sort tout de suite — c'est bon, à
refaire, ou inutilisable — avec ce qu'il faut dire au client et, s'il doit
refaire son logo, LE PROMPT à lui envoyer pour ChatGPT. Pages statiques, sans
build ni paquet, en ligne sur GitHub Pages depuis `main`
(<https://dockbearolda.github.io/check-logo/>, la tuile « Check logo » du
portail <https://dockbearolda.github.io/>). On modifie les fichiers, on
vérifie dans l'aperçu `check-logo`, `node --test`, on pousse.

## Ce qui est tranché (ne pas défaire)

- **Une seule réponse, instantanée** (13 octobre 2026, Charlie : « l'idée est
  que la vendeuse sache instantanément si c'est un logo vectorisé »). Pas de
  verdict par technique, pas de tailles d'impression, pas de réglage.
- **On ne mesure pas l'épaisseur des traits** (même jour : « je ne veux pas
  que tu t'occupes de l'épaisseur »). Ne pas la remettre.
- **Ce qui passe au vert** : un vrai fichier vectoriel, OU une image propre —
  nette, à plat, détourée ou sur un fond uni qui part à l'atelier — que
  l'atelier vectorise.
- **Une illustration riche et nette passe aussi, TELLE QUELLE** — et la
  vendeuse annonce que « toute reprise ou modification pour l'améliorer sera
  facturée ». Cette phrase est de Charlie ; elle revient dès que l'atelier
  pourrait reprendre le fichier.
- **À refaire = le client refait lui-même, avec le prompt.** La plupart des
  logos sortent de ChatGPT. Le prompt s'écrit tout seul d'après ce que le
  contrôle trouve (`ecrirePrompt`, `lib/verdict.js`) : il ne demande que ce
  qu'il y a à corriger, et de ne rien changer d'autre.
- **Inutilisable** : trop petit, trop flou, ou pas une image. À l'écran on
  écrit « Inutilisable », jamais « pourri » : le client peut voir l'écran.
- **Le faux damier** : une IA à qui l'on demande un fond transparent dessine
  souvent le damier gris et blanc dans l'image. C'est un fond, pas un dessin
  (`lireFond`, `lib/analyse.js`), et le prompt le nomme.
- **« Créé avec ChatGPT » se lit dans le fichier** (sa signature C2PA, ou son
  nom) — jamais deviné à la taille : elle varie. Une image passée par
  WhatsApp a perdu sa signature : on dit alors « s'il a été créé avec… ».
- **Téléphone d'abord, puis PC.** Une colonne jusqu'à 900 px, deux au-delà.
- **Tout se calcule sur l'appareil.** Aucun serveur, aucune clé, aucun envoi :
  le fichier du client ne quitte pas le poste. Pas d'IA en ligne.
- **Jamais un mot de graphiste dans ce qu'elle dit au client.** Les phrases
  sont dans `lib/verdict.js` et nulle part ailleurs.
- **Les seuils sont dans `lib/regles.js` et nulle part ailleurs.** Avant d'en
  changer un : `node outils/banc.mjs <dossier de vrais fichiers>`, avant et
  après.
- **PHAREDESIGN, en entier.** La seule couleur de l'écran est celle de la
  réponse. Aucune valeur en dur dans `app.css` ; un jeton qui manque se pose
  dans `phare.css` avec son rôle. Avant de pousser :
  `node ~/.claude/skills/pharedesign/verifier.mjs . --exclure essais`.
- **Aucun fichier de client dans le dépôt** (il est public). Les fichiers
  d'essai vivent dans `essais/`, ignoré par git.

## Les fichiers

| Où | Quoi |
|---|---|
| `index.html`, `app.css` | la page ; `phare.css` et `phare-composants.css` sont la charte, copiée telle quelle (plus trois jetons : `--dur-scan`, `--support-clair`, `--support-sombre`) |
| `lib/app.js` | l'écran : déposer, choisir, coller ; le scan ; la réponse, le message et le prompt à copier |
| `lib/lecture.js`, `lib/format.js` | le fichier lu : son format dans ses octets, PNG/JPG/WebP/HEIC, SVG, PDF et `.ai` (vectoriel, ou une image emballée), la signature de ChatGPT, et ce qui ne s'ouvre pas ici (EPS, PSD, Word…) |
| `lib/analyse.js`, `lib/travail.js` | les mesures, dans un fil : le fond (et le faux damier), les couleurs, le flou, les ombres |
| `lib/verdict.js` | le jugement, ses phrases et le prompt |
| `lib/regles.js` | tous les seuils |
| `outils/banc.mjs`, `outils/png.mjs` | le banc : le contrôle passé sur un dossier de vrais fichiers, hors du navigateur (`--prompt` montre les prompts) |
| `tests/` | `node --test` : les mesures sur des images dessinées, les réponses, le prompt, les formats |
| `vendor/` | pdf.js et libheif, copiés du Logo maker ; versions et licences dans `vendor/LISEZMOI.md` |
| `serveur.mjs` | le serveur du poste (`npm start`, port 8140) — en ligne, GitHub Pages sert le dossier |

## À faire valider par Charlie

- Le texte du prompt et celui des messages : écrits d'office, à relire sur de
  vrais cas au comptoir.
- Une image avec un fond ou un décor part en « à refaire » (avec la porte de
  sortie « l'imprimer telle quelle, en rectangle ») : à confirmer.
