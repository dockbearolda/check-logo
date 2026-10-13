# Check logo · OLDA

Le logo du client est-il bon pour l'atelier ? La vendeuse dépose le fichier —
une image, une photo, un PDF, peu importe — et le contrôle répond pour
l'**impression DTF** et pour l'**usinage** : compatible, sous réserve ou
incompatible, pourquoi, et **quoi dire au client**, en mots de tous les jours.

En ligne : **<https://dockbearolda.github.io/check-logo/>** (tuile « Check
logo » du portail <https://dockbearolda.github.io/>).

Tout se calcule dans le navigateur, sur l'appareil : rien ne part sur un
serveur, le fichier du client ne quitte pas le poste.

## Ce qu'il regarde

| Mesure | Ce que ça change |
|---|---|
| Le format | un fichier vectoriel (PDF, AI, SVG) reste net à toutes les tailles ; un PDF qui n'emballe qu'une image n'en est pas un |
| Les pixels et la netteté | jusqu'à quelle largeur le logo s'imprime net (200 dpi), emplacement par emplacement : cœur, bébé, tote bag, dos |
| Le fond | transparent, blanc (l'atelier le retire), de couleur (à confirmer avec le client), ou une photo |
| Les couleurs | à plat, ou des dégradés et des nuances — l'usinage ne reproduit que des formes nettes, en une teinte |
| Le trait le plus fin | sous 0,3 mm il ne tient pas en DTF : montré en rouge sur le logo |
| Les ombres et transparences | elles sortent avec un voile blanc : montrées en orange |

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
node outils/banc.mjs chemin/vers/un/dossier
```

## Changer une règle, changer une phrase

- Un seuil (dpi, épaisseur de trait, tailles d'OLDA) : `lib/regles.js`.
- Ce que la vendeuse dit au client : `lib/verdict.js`.

## Mettre en ligne

Pousser sur `main` : GitHub Pages redéploie tout seul, en une minute.
