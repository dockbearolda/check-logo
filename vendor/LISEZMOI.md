# vendor — les lecteurs de fichiers

Check logo n'installe rien : ces fichiers sont copiés tels quels depuis le
Logo maker (`logo-maker/vendor/`), qui les tient des paquets npm. Ils ne se
chargent qu'au premier fichier qui en a besoin (`lib/lecture.js`) : un PNG
déposé n'en tire pas un octet.

| Fichier | Paquet | Version | Licence | Sert à |
|---|---|---|---|---|
| `pdf.min.mjs`, `pdf.worker.min.mjs` | pdfjs-dist | 6.2.108 | Apache-2.0 | lire un PDF ou un `.ai`, et savoir s'il dessine des tracés ou s'il n'emballe qu'une image |
| `libheif-bundle.mjs` | libheif-js | 1.19.8 | LGPL-3.0 | la photo d'un iPhone (HEIC), hors de Safari |

Les textes des licences sont dans `licences/`. libheif-js est sous LGPL : il
est livré tel quel, non modifié, et chargé comme un module séparé — on peut le
remplacer par une autre version en changeant ce seul fichier.

La police de l'interface, à la racine (`manrope-latin.woff2`,
`manrope-latin-ext.woff2`) : Manrope, © The Manrope Project Authors
(<https://github.com/sharanda/manrope>), SIL Open Font License 1.1
(<https://openfontlicense.org>).

Pour changer de version : reprendre le fichier du paquet (`build/` pour
pdfjs-dist, `libheif-wasm/` pour libheif-js), mettre ce tableau à jour, puis
déposer un PDF vectoriel, un PDF qui n'est qu'une image et un HEIC pour
vérifier.
