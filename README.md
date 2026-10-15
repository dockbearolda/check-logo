# Check logo

Le logo du client est-il bon ? La vendeuse dépose le fichier,
et **une réponse sort tout de suite**. La règle tient en une phrase : ce qui
est bon, c'est un fichier vectoriel ou une photo en haute résolution ; pour
le reste, une reprise facturée ou un prompt à envoyer.

| Réponse | Quand | Ce qu'elle a en main |
|---|---|---|
| **C'est bon** | un fichier vectoriel, ou une photo en haute résolution | ce qu'elle dit au client |
| **À reprendre** | tout le reste : un logo en image (même net, même détouré), une photo trop petite | ce qu'elle dit au client — le refaire avec ChatGPT, ou la reprise, facturée — et **le prompt à lui envoyer** |
| **Inutilisable** | trop petit, trop flou, ou pas une image | ce qu'elle dit au client, et le prompt quand il peut servir |

Le prompt s'écrit tout seul d'après ce que le contrôle a trouvé (un fond noir
à retirer, un faux damier, des ombres…). Pour un logo, il demande un vrai
fichier vectoriel.

**Un seul geste pour répondre au client** : le bouton noir envoie le message
et le prompt ensemble — par la feuille de partage du téléphone (WhatsApp,
SMS, courriel), ou copiés d'un coup sur un ordinateur.

**Plusieurs fichiers d'un coup** : le client envoie souvent trois versions de
son logo. On les dépose toutes, chacune est contrôlée, la meilleure s'affiche,
les autres restent à un clic.

En ligne sur GitHub Pages, depuis `main`.

Tout se calcule dans le navigateur, sur l'appareil : rien ne part sur un
serveur, le fichier du client ne quitte pas le poste.

## Ce qu'il regarde

| Mesure | Ce que ça change |
|---|---|
| Le format | un fichier vectoriel (PDF, AI, SVG) est bon d'office ; un PDF qui n'emballe qu'une image n'en est pas un |
| Logo ou photo | un dessin à plat est un logo : il doit être vectoriel ; des dégradés, des détails, une image pleine : une photo |
| La taille et la netteté | une photo est bonne à partir de 2 000 pixels utiles ; sous 500, le fichier est inutilisable |
| L'origine | une image sortie de ChatGPT porte sa signature : le prompt passe alors en premier |
| La capture d'écran | reconnue à son nom : ce n'est jamais le fichier d'origine, elle n'est jamais bonne |
| Le fond, les ombres | un fond noir ou blanc, un décor, un faux damier, des ombres : le prompt demande de les retirer |

Ce qui ne s'ouvre pas ici (EPS, CorelDRAW, Affinity, Photoshop, un logo
collé dans un Word, une vidéo…) a aussi sa réponse : quoi demander au client
à la place.

## Installer l'app

Sur le téléphone ou l'ordinateur de la boutique, ouvrir la page puis
« Ajouter à l'écran d'accueil » (iPhone : Partager, puis Sur l'écran
d'accueil ; Android et Chrome : Installer l'application). Installée :

- elle s'ouvre **sans réseau** ;
- sur **Android**, elle apparaît dans le menu Partager : depuis WhatsApp ou
  la galerie, on lui partage le fichier du client et la réponse sort
  aussitôt. Le fichier reste sur l'appareil.

## En local

Aucun paquet à installer. Depuis ce dossier :

```bash
npm start
```

puis <http://localhost:8140/>. Dans Claude Code, l'aperçu `check-logo`
(`.claude/launch.json`) fait la même chose. Les tests :

```bash
node --test
```

Le banc, pour voir ce qu'un réglage change sur de vrais fichiers :

```bash
node outils/banc.mjs --prompt chemin/vers/un/dossier
```

## Changer une règle, une phrase, le prompt

- Un seuil (haute résolution, taille minimale, netteté) : `lib/regles.js`.
- Ce que la vendeuse dit au client, et le prompt : `lib/verdict.js`.
- La liste des fichiers gardés hors ligne : `sw.js` (changer `VERSION` quand
  elle change).

## Mettre en ligne

Pousser sur `main` : GitHub Pages redéploie tout seul, en une minute.
