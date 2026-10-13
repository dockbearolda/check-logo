# Check logo · OLDA

Le logo du client est-il bon pour l'atelier ? La vendeuse dépose le fichier —
une image, une photo, un PDF, peu importe — et **une réponse sort tout de
suite** :

| Réponse | Quand | Ce qu'elle a en main |
|---|---|---|
| **C'est bon** | un vrai fichier vectoriel, ou une image propre (nette, à plat, détourée) que l'atelier vectorise | ce qu'elle dit au client |
| **C'est bon, tel quel** | une illustration riche et nette | ce qu'elle dit au client : toute reprise ou modification sera facturée |
| **À refaire** | un fond ou un décor, un faux damier « transparent », des ombres, une image floue | ce qu'elle dit au client, et **le prompt à lui envoyer** pour qu'il refasse son logo avec ChatGPT |
| **Inutilisable** | trop petit, trop flou, ou pas une image | ce qu'elle dit au client, et le prompt quand il peut servir |

Le prompt s'écrit tout seul d'après ce que le contrôle a trouvé : il ne
demande que ce qu'il y a à corriger.

En ligne : **<https://dockbearolda.github.io/check-logo/>** (tuile « Check
logo » du portail <https://dockbearolda.github.io/>).

Tout se calcule dans le navigateur, sur l'appareil : rien ne part sur un
serveur, le fichier du client ne quitte pas le poste.

## Ce qu'il regarde

| Mesure | Ce que ça change |
|---|---|
| Le format | un fichier vectoriel (PDF, AI, SVG) est bon d'office ; un PDF qui n'emballe qu'une image n'en est pas un |
| L'origine | une image sortie de ChatGPT porte sa signature : le message au client le dit |
| La netteté et la taille | une image agrandie ou compressée est floue ; trop petite ou trop floue, elle est inutilisable |
| Le fond | transparent, blanc (il part à l'atelier), de couleur (à confirmer avec le client), un décor, ou le faux damier gris et blanc qu'une IA dessine dans l'image |
| Les couleurs | à plat (un logo), ou des dégradés et des détails (une illustration) |
| Les ombres et transparences | elles sortent mal à l'impression |

Ce qui ne s'ouvre pas ici (EPS, Photoshop, un logo collé dans un Word…) a
aussi sa réponse : quoi demander au client à la place.

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

- Un seuil (netteté, taille minimale, aplats) : `lib/regles.js`.
- Ce que la vendeuse dit au client, et le prompt : `lib/verdict.js`.

## Mettre en ligne

Pousser sur `main` : GitHub Pages redéploie tout seul, en une minute.
