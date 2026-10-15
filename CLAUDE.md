TABLETTE: non

# Check logo

L'outil du comptoir pour la vendeuse, qui n'a pas de notion de graphisme : le
fichier du client se dépose, et UNE réponse sort tout de suite — c'est bon, à
refaire, ou inutilisable — avec ce qu'il faut dire au client et, s'il doit
refaire son logo, LE PROMPT à lui envoyer pour ChatGPT. Pages statiques, sans
build ni paquet, en ligne sur GitHub Pages depuis `main`. On modifie les
fichiers, on vérifie dans l'aperçu `check-logo`, `node --test`, on pousse.

## Ce qui est tranché (ne pas défaire)

- **Aucune marque, nulle part** (Charlie, 15 octobre 2026 : il vend l'app
  seul). Aucun nom d'entreprise, ni dans l'app, ni dans le code, ni dans la
  doc ; celui qui fabrique se dit « nous ». `tests/marque.test.mjs` refuse
  les mots interdits — ils y sont encodés, pour ne pas les écrire en clair.

- **LA RÈGLE, mot pour mot** (Charlie, 13 octobre 2026) : « ce qui est bon,
  c'est une photo en haute résolution ou un fichier vectoriel ; pour le reste
  on renvoie un prompt si ça vient de ChatGPT » — « un logo non vectoriel,
  avec un fond noir par exemple, c'est une reprise facturée ou un prompt à
  envoyer ».
- **Un logo en image n'est JAMAIS bon**, même net, même détouré, même en très
  grand. Une première version faisait passer au vert les « images propres » :
  Charlie l'a refusée (« tout ce que j'ouvre, le logiciel me dit c'est bon »).
  Ne pas y revenir, quelle que soit la qualité de l'image.
- **Trois réponses** : C'est bon (vectoriel, ou photo en haute résolution) ·
  À reprendre (tout le reste : le prompt, ou la reprise facturée) ·
  Inutilisable (trop petit, trop flou, pas une image).
- **À reprendre = deux sorties, toujours dites ensemble** : le client refait
  son fichier avec ChatGPT grâce au prompt, ou nous le reprenons, et
  « cette reprise est facturée ». Si le fichier est signé ChatGPT, le prompt
  passe en premier.
- **Le message au client a un style fixe** (Charlie, 15 octobre 2026) :
  « Bonjour ! », « Merci pour votre envoi. » et le constat ; puis « Pour que
  le résultat soit parfait, voici comment faire : » et une solution par puce
  (« à qui : quoi faire ») ; enfin « N’hésitez pas si vous avez la moindre
  question, on est là pour vous accompagner ! ». Le cas « trop petit »
  reprend son texte mot pour mot. Tout passe par `message` (`lib/verdict.js`),
  et un test garde le style.
- **Le prompt s'écrit tout seul** d'après ce que le contrôle trouve
  (`ecrirePrompt`, `lib/verdict.js`) : il ne demande que ce qu'il y a à
  corriger. Pour un logo, il réclame un VRAI fichier vectoriel SVG — c'est ce
  qui le fera passer au vert au prochain dépôt.
- **Une seule réponse, instantanée.** Pas de verdict par technique, pas de
  tailles d'impression, pas de réglage.
- **On ne mesure pas l'épaisseur des traits** (« je ne veux pas que tu
  t'occupes de l'épaisseur »). Ne pas la remettre.
- **À l'écran on écrit « Inutilisable », jamais « pourri »** : le client peut
  voir l'écran.
- **Le faux damier** : une IA à qui l'on demande un fond transparent dessine
  souvent le damier gris et blanc dans l'image. C'est un fond, pas un dessin
  (`lireFond`, `lib/mesures.js`), et le prompt le nomme.
- **« Créé avec ChatGPT » se lit dans le fichier** (sa signature C2PA, ou son
  nom) — jamais deviné à la taille : elle varie. Une image passée par
  WhatsApp a perdu sa signature : on dit alors « s'il a été créé avec… ».
- **Téléphone d'abord, puis PC.** Une colonne jusqu'à 900 px, deux au-delà.
- **Un seul geste pour répondre au client** : le bouton noir (« Envoyer au
  client » sur un téléphone, « Copier le message et le prompt » sur un
  ordinateur) envoie `envoi` — ce qu'on lui dit, puis le prompt. Il tient
  dans le premier écran d'un iPhone, sans défiler.
- **Plusieurs fichiers : le meilleur gagne** (`meilleur`, `lib/verdict.js`) :
  c'est bon › à vérifier › à reprendre › inutilisable ; à égalité,
  le premier déposé. Les autres restent dans une liste, à un clic.
- **Une capture d'écran n'est jamais bonne** (reconnue à son nom,
  `estCapture`) : ce n'est jamais le fichier d'origine — une capture d'un
  téléphone fait 2 800 pixels et passerait pour une photo en haute
  résolution. La lecture la plus stricte de la règle.
- **L'app s'installe** (`manifest.webmanifest`, `sw.js`) : elle s'ouvre hors
  ligne (réseau d'abord, la copie gardée sinon) et, sur Android, reçoit le
  fichier qu'on lui partage depuis WhatsApp. Le fichier partagé passe par le
  cache `check-logo-partage`, sur l'appareil, et en est effacé dès qu'il est
  lu. Les caches sont communs à tout le domaine qui l'héberge : tous les nôtres
  portent le préfixe `check-logo-`, et `sw.js` ne supprime que ceux-là.
- **Un nom de fichier que les bloqueurs de pub laissent passer.** Le
  15 octobre 2026, chaque image répondait « Le fichier ne s'ouvre pas » chez
  Charlie : la liste EasyPrivacy (uBlock Origin, AdGuard, Brave) bloque tout
  fichier nommé `analyse.js`. Le fichier des mesures s'appelle donc
  `lib/mesures.js`, et `tests/bloqueurs.test.mjs` refuse tout nom publié qui
  contient un mot visé (analyse, stats, track, pixel, pub…). Et quand une
  partie de l'outil ne se charge pas, la réponse dit « À réessayer » : le
  fichier du client n'y est pour rien.
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
| `lib/app.js` | l'écran : déposer, choisir, coller, recevoir un partage ; le scan ; la réponse, l'envoi au client, la liste quand il y a plusieurs fichiers |
| `sw.js`, `manifest.webmanifest`, `icone-*.png` | l'app installée : hors ligne, et la cible de partage Android (changer `VERSION` dans `sw.js` quand la liste de la coquille change) |
| `lib/lecture.js`, `lib/format.js` | le fichier lu : son format dans ses octets, PNG/JPG/WebP/HEIC, SVG, PDF et `.ai` (vectoriel, ou une image emballée), la signature de ChatGPT, et ce qui ne s'ouvre pas ici (EPS, PSD, Word…) |
| `lib/mesures.js`, `lib/travail.js` | les mesures, dans un fil : le fond (et le faux damier), les couleurs, le flou, les ombres |
| `lib/verdict.js` | le jugement, ses phrases et le prompt |
| `lib/regles.js` | tous les seuils |
| `outils/banc.mjs`, `outils/png.mjs` | le banc : le contrôle passé sur un dossier de vrais fichiers, hors du navigateur (`--prompt` montre les prompts) |
| `tests/` | `node --test` : les mesures sur des images dessinées, les réponses, le prompt, les formats, et aucune marque nulle part |
| `vendor/` | pdf.js et libheif, copiés des paquets npm ; versions et licences dans `vendor/LISEZMOI.md` |
| `serveur.mjs` | le serveur du poste (`npm start`, port 8140) — en ligne, GitHub Pages sert le dossier |

## À faire valider par Charlie

- `PIXELS_PHOTO` (2 000 pixels) : à partir de quand une photo est « en haute
  résolution ». Posé d'office ; une image de ChatGPT n'y arrive pas.
- `PIXELS_POURRI` (500 pixels utiles) : en dessous, « Inutilisable ».
- La capture d'écran jamais bonne, même grande (posé d'office, 15 octobre
  2026) : à confirmer.
- Le texte envoyé d'un geste : le message, « Notre message pour
  ChatGPT : » et le prompt, puis la formule de fin.
- Le texte du prompt et celui des messages : à relire sur de vrais cas.
