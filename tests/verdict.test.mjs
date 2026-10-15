import test from 'node:test'
import assert from 'node:assert/strict'
import { juger, ecrirePrompt, nomCouleur, meilleur } from '../lib/verdict.js'
import { analyser } from '../lib/mesures.js'
import { toile, rect, disque, flouter, agrandir, photo } from './dessin.mjs'

/* LA RÈGLE (Charlie, 13 octobre 2026) : « ce qui est bon, c'est une photo en
   haute résolution ou un fichier vectoriel ; pour le reste on renvoie un
   prompt si ça vient de ChatGPT » — « un logo non vectoriel, avec un fond
   noir par exemple, c'est une reprise facturée ou un prompt à envoyer ». */

const BLANC = [255, 255, 255, 255], NOIR = [0, 0, 0, 255], ROUGE = [220, 30, 40]
const FIN = 'N’hésitez pas si vous avez la moindre question, on est là pour vous accompagner !'

/* Un logo d'essai de `l` pixels de large, à plat : un disque rouge, une
   barre grise. */
function logo(l, fond = [0, 0, 0, 0]) {
  const h = Math.round(l * 0.6), t = toile(l, h, fond)
  disque(t, l * 0.28, h * 0.5, h * 0.36, ROUGE)
  rect(t, Math.round(l * 0.56), Math.round(h * 0.25), Math.round(l * 0.38), Math.round(h * 0.5), [90, 100, 110, 255])
  return t
}
/* Une illustration détourée : un dégradé à l'intérieur d'un rectangle. */
function illustration(l) {
  const h = Math.round(l * 0.6), t = toile(l, h)
  for (let y = Math.round(h * 0.1); y < h * 0.9; y++) for (let x = Math.round(l * 0.05); x < l * 0.95; x++) {
    const i = (y * l + x) * 4, k = x / l, j = y / h
    t.d[i] = 255 * k; t.d[i + 1] = 255 * j; t.d[i + 2] = 255 * (1 - k); t.d[i + 3] = 255
  }
  return t
}
/* Le faux fond transparent d'une IA. */
function surDamier(t, case_ = 16) {
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.l; x++) {
    const i = (y * t.l + x) * 4
    if (t.d[i + 3] > 128) continue
    const v = ((x / case_) | 0) + ((y / case_) | 0) & 1 ? 204 : 255
    t.d[i] = t.d[i + 1] = t.d[i + 2] = v; t.d[i + 3] = 255
  }
  return t
}
/* Une image jugée comme un fichier de `natif` pixels de large (une grande
   photo s'analyse réduite : on ne dessine pas 4 000 pixels pour un essai). */
const image = (t, plus = {}, natif = t.l) => juger({ format: 'png', sorte: 'image', natif: { l: natif, h: Math.round(natif * t.h / t.l) }, ia: null, ...plus }, analyser(t.d, t.l, t.h))

test('le nom d’une couleur', () => {
  assert.equal(nomCouleur([0, 0, 0]), 'noir')
  assert.equal(nomCouleur([250, 250, 250]), 'blanc')
  assert.equal(nomCouleur([251, 11, 12]), 'rouge')
  assert.equal(nomCouleur([20, 60, 200]), 'bleu')
})

test('un fichier vectoriel : c’est bon, sans prompt', () => {
  const t = logo(1600)
  const v = juger({ format: 'pdf', sorte: 'vecteur', natif: null, ia: null }, analyser(t.d, t.l, t.h))
  assert.equal(v.etat, 'ok')
  assert.equal(v.mot, 'C’est bon')
  assert.equal(v.titre, 'Fichier vectoriel.')
  assert.equal(v.prompt, '')
})

test('une photo en haute résolution : c’est bon, sans prompt', () => {
  const v = image(photo(1600, 1200), { format: 'jpg' }, 4032)
  assert.equal(v.etat, 'ok')
  assert.equal(v.mot, 'C’est bon')
  assert.equal(v.titre, 'Photo en haute résolution.')
  assert.equal(v.prompt, '')
})

test('un logo en image, même net et détouré, N’EST PAS bon', () => {
  for (const t of [logo(1400), logo(1400, BLANC), logo(1400, NOIR)]) {
    const v = image(t)
    assert.equal(v.etat, 'limite')
    assert.equal(v.mot, 'À reprendre')
    assert.match(v.titre, /^Logo non vectoriel : reprise facturée, ou prompt à envoyer\.$/)
    assert.match(v.dire, /votre logo n’est pas un fichier vectoriel/)
    assert.match(v.dire, /• Si vous l’avez généré avec ChatGPT : Retournez simplement dans votre discussion avec lui/)
    assert.match(v.dire, /• Si votre logo a été créé par un graphiste : /)
    assert.match(v.dire, /cette reprise est facturée/)
    assert.match(v.prompt, /en version vectorielle/)
    assert.match(v.prompt, /vrai fichier vectoriel SVG/)
  }
  /* même en très grand : un logo doit être vectoriel */
  assert.equal(image(logo(1400), {}, 5000).etat, 'limite')
})

test('un logo sur fond noir : le prompt retire le fond noir', () => {
  const v = image(logo(1400, NOIR))
  assert.match(v.prompt, /Retire le fond noir s’il ne fait pas partie du logo/)
  assert.ok(v.constats.some(c => c.texte === 'Fond noir à retirer.'))
  assert.match(image(logo(1400, BLANC)).prompt, /Retire le fond blanc :/)
  assert.ok(!/Retire le fond/.test(image(logo(1400)).prompt))   /* déjà détouré */
})

test('un fichier signé par ChatGPT : le prompt d’abord', () => {
  const v = image(logo(1400, NOIR), { ia: 'ChatGPT' })
  assert.match(v.titre, /prompt à envoyer, ou reprise facturée/)
  assert.match(v.dire, /• Vous l’avez généré avec ChatGPT : Retournez simplement dans votre discussion avec lui/)
  assert.match(v.dire, /cette reprise est facturée/)
  assert.ok(!/graphiste/.test(v.dire))   /* il sait d’où vient son fichier */
  assert.equal(v.promptPour, 'Le prompt à lui envoyer, pour ChatGPT')
  assert.ok(v.constats.some(c => c.texte === 'Créé avec ChatGPT.'))
  assert.equal(image(logo(1400)).promptPour, 'S’il vient de ChatGPT : le prompt à lui envoyer')
})

test('une photo ou une illustration trop petite : à reprendre', () => {
  const p = image(photo(1536, 1024), { format: 'jpg' })
  assert.equal(p.etat, 'limite')
  assert.match(p.titre, /^Image trop petite/)
  assert.match(p.dire, /un peu trop petit ou de résolution insuffisante/)
  assert.match(p.dire, /Envoyez-nous plutôt l’originale/)
  assert.match(p.prompt, /plus haute résolution possible : au moins 2\s000 pixels/)
  assert.ok(!/SVG/.test(p.prompt))
  const i = image(illustration(1300), { ia: 'ChatGPT' })
  assert.equal(i.etat, 'limite')
  assert.match(i.dire, /Vous l’avez généré avec ChatGPT/)
  assert.match(i.prompt, /Garde le même style/)
})

test('un faux damier : à reprendre, et le prompt le nomme', () => {
  const v = image(surDamier(logo(1200)))
  assert.equal(v.etat, 'limite')
  assert.match(v.prompt, /supprime le damier gris et blanc/)
  assert.ok(v.constats.some(c => /Faux fond transparent/.test(c.texte)))
})

test('des ombres : le prompt les retire', () => {
  const t = toile(1200, 700)
  rect(t, 300, 200, 600, 360, [0, 0, 0, 120])
  const o = flouter(t, 12)
  rect(o, 280, 180, 600, 340, NOIR)
  const v = image(o)
  assert.equal(v.etat, 'limite')
  assert.match(v.prompt, /Supprime les ombres portées/)
})

test('trop petit ou trop flou : inutilisable', () => {
  const petit = image(logo(300, BLANC), { format: 'jpg' })
  assert.equal(petit.etat, 'non')
  assert.equal(petit.mot, 'Inutilisable')
  assert.equal(petit.titre, 'Image trop petite.')
  assert.match(petit.dire, /Retournez simplement dans votre discussion avec lui, transmettez-lui notre message/)
  assert.ok(!/reprise/.test(petit.dire))             /* rien à reprendre */
  assert.ok(petit.prompt.length > 0)
  const flou = image(agrandir(logo(250), 4))
  assert.equal(flou.etat, 'non')
  assert.equal(flou.titre, 'Image trop floue.')
})

test('un PDF qui n’est qu’une image n’est pas un vectoriel', () => {
  const v = image(logo(1400), { format: 'pdf' })
  assert.equal(v.etat, 'limite')
  assert.ok(v.constats.some(c => /PDF qui ne contient qu’une image.*ce n’est pas un fichier vectoriel/.test(c.texte)))
})

test('le prompt ne demande que ce qu’il y a à corriger', () => {
  const p = ecrirePrompt({ logo: true, fond: '', ombres: true })
  assert.match(p, /^Refais ce logo à l’identique, en version vectorielle/)
  assert.match(p, /ombres portées/)
  assert.ok(!/damier|Retire le fond|haute résolution/.test(p))
  const q = ecrirePrompt({ logo: false, fond: 'décor', ombres: false })
  assert.match(q, /^Refais ce visuel à l’identique/)
  assert.match(q, /un fond ou un décor qui ne fait pas partie du dessin/)
  assert.ok(!/SVG/.test(q))
})

test('ce qui ne s’ouvre pas : une impasse, jamais une erreur', () => {
  for (const impasse of ['eps', 'psd', 'tif', 'bureau', 'inconnu', 'autre-chose']) {
    const v = juger({ format: null, sorte: 'impasse', impasse, natif: null }, null)
    assert.ok(v.dire.length > 20)
    assert.equal(v.prompt, '')
    assert.equal(v.constats.length, 1)
  }
  assert.equal(juger({ sorte: 'impasse', impasse: 'eps' }, null).etat, 'inconnu')
  assert.equal(juger({ sorte: 'impasse', impasse: 'bureau' }, null).etat, 'non')
  const vide = toile(200, 200, BLANC)
  assert.equal(image(vide).titre, 'Le fichier est vide.')
  const mixte = logo(1200)
  assert.equal(juger({ format: 'pdf', sorte: 'mixte', natif: null }, analyser(mixte.d, mixte.l, mixte.h)).etat, 'inconnu')
})

test('ce qu’on envoie au client : le message, notre prompt, la main tendue', () => {
  const v = image(logo(1400, NOIR), { ia: 'ChatGPT' })
  const [haut] = v.dire.split('\n\n' + FIN)
  assert.ok(v.envoi.startsWith(haut))
  assert.ok(v.envoi.includes(`\n\nNotre message pour ChatGPT :\n${v.prompt}\n\n`))
  assert.ok(v.envoi.endsWith(FIN))
  const t = logo(1600)
  const ok = juger({ format: 'pdf', sorte: 'vecteur', natif: null, ia: null }, analyser(t.d, t.l, t.h))
  assert.equal(ok.envoi, ok.dire)
  const eps = juger({ format: null, sorte: 'impasse', impasse: 'eps', natif: null }, null)
  assert.equal(eps.envoi, eps.dire)
})

test('plusieurs fichiers : le meilleur gagne', () => {
  assert.equal(meilleur(['limite', 'ok', 'non']), 1)
  assert.equal(meilleur(['non', 'inconnu', 'limite']), 1)   /* un EPS vaut mieux qu’un JPG */
  assert.equal(meilleur(['limite', 'limite']), 0)           /* à égalité, le premier déposé */
  assert.equal(meilleur(['non', 'n’importe quoi']), 0)
  assert.equal(meilleur([]), -1)
})

test('un fichier de graphiste, une vidéo : leur réponse', () => {
  const g = juger({ nom: 'Logo client.cdr', format: 'cdr', sorte: 'impasse', impasse: 'graphiste', natif: null }, null)
  assert.equal(g.etat, 'inconnu')
  assert.equal(g.mot, 'À vérifier')
  assert.equal(g.titre, 'Fichier CorelDRAW : il ne s’ouvre pas ici.')
  assert.match(g.constats[0].texte, /CorelDRAW.*vectoriel/)
  assert.match(g.dire, /fichier professionnel/)
  assert.match(juger({ nom: 'logo.ai', format: 'eps', sorte: 'impasse', impasse: 'graphiste' }, null).titre, /Fichier Illustrator/)
  assert.match(juger({ nom: 'logo.dxf', format: null, sorte: 'impasse', impasse: 'graphiste' }, null).titre, /Fichier DXF/)
  const v = juger({ nom: 'logo.mp4', format: 'video', sorte: 'impasse', impasse: 'video', natif: null }, null)
  assert.equal(v.etat, 'non')
  assert.equal(v.mot, 'Inutilisable')
  assert.match(v.titre, /vidéo/)
  assert.match(v.dire, /une vidéo/)
  assert.equal(v.prompt, '')
})

test('une capture d’écran n’est jamais bonne : le fichier d’origine vaut mieux', () => {
  const v = image(logo(1400, BLANC), { capture: true })
  assert.equal(v.etat, 'limite')
  assert.match(v.dire, /capture d’écran/)
  assert.match(v.dire, /fichier d’origine/)
  assert.ok(v.constats.some(c => /Capture d’écran/.test(c.texte)))
  /* grande comme l’écran d’un téléphone, une capture n’est pas une photo en
     haute résolution */
  const grande = image(photo(1600, 1200), { format: 'png', capture: true }, 2796)
  assert.equal(grande.etat, 'limite')
  assert.match(grande.dire, /capture d’écran/)
  /* elle a ses pixels : on ne lui dit pas qu’elle est trop petite */
  assert.match(grande.titre, /^Capture d’écran : /)
  assert.match(grande.dire, /une capture d’écran : ce n’est pas le fichier d’origine/)
  assert.ok(!/haute résolution|trop petite/.test(grande.dire + grande.titre))
  assert.ok(!grande.constats.some(c => /pixels utiles/.test(c.texte)))
  assert.equal(image(photo(1600, 1200), { format: 'png' }, 2796).etat, 'ok')
  const petite = image(logo(300, BLANC), { capture: true })
  assert.equal(petite.etat, 'non')
  assert.match(petite.dire, /capture d’écran/)
})

test('une grande image au faux damier : c’est le damier qu’on annonce, pas sa taille', () => {
  const v = image(surDamier(illustration(1600)), {}, 3200)
  assert.equal(v.etat, 'limite')
  assert.match(v.titre, /^Faux fond transparent : /)
  assert.ok(!/haute résolution|trop petite/.test(v.dire + v.titre))
  assert.ok(!v.constats.some(c => /pixels utiles/.test(c.texte)))
  assert.match(v.prompt, /supprime le damier/)
})

test('un lecteur qui ne se charge pas n’est pas un fichier abîmé', () => {
  const v = juger({ nom: 'logo.pdf', format: 'pdf', sorte: 'impasse', impasse: 'lecteur', natif: null }, null)
  assert.equal(v.etat, 'inconnu')
  assert.equal(v.mot, 'À réessayer')
  assert.match(v.titre, /connexion/)
  assert.match(v.constats[0].texte, /bloqueur de publicité/)
  assert.match(v.constats[0].texte, /Le fichier n’y est pour rien/)
  assert.ok(!/abîmé|renvoyer/.test(v.dire))
  assert.equal(v.prompt, '')
})

test('le message au client : toujours le même style', () => {
  const t = logo(1600)
  const cas = [
    juger({ format: 'pdf', sorte: 'vecteur', natif: null, ia: null }, analyser(t.d, t.l, t.h)),
    image(photo(1600, 1200), { format: 'jpg' }, 4032),
    image(logo(1400, NOIR)), image(logo(1400, NOIR), { ia: 'ChatGPT' }), image(logo(300, BLANC)),
    image(photo(1536, 1024), { format: 'jpg' }), image(logo(1400), { capture: true }),
    ...['eps', 'psd', 'tif', 'mixte', 'bureau', 'inconnu', 'vide', 'graphiste', 'video', 'lecteur']
      .map(impasse => juger({ nom: 'logo.x', sorte: 'impasse', impasse, natif: null }, null)),
  ]
  for (const v of cas) {
    assert.ok(v.dire.startsWith('Bonjour !\nMerci pour votre envoi. '), v.dire)
    assert.ok(v.dire.endsWith('\n\n' + FIN), v.dire)
    /* des solutions : annoncées, puis une par puce */
    if (v.dire.includes('•')) assert.match(v.dire, /\nPour que le résultat soit parfait, voici comment faire :\n\n• /)
    if (!v.prompt) assert.equal(v.envoi, v.dire)
  }
  /* trop petit : le texte de Charlie, mot pour mot */
  assert.match(image(logo(300, BLANC)).dire, /^Bonjour !\nMerci pour votre envoi\. Malheureusement, le fichier reçu est un peu trop petit ou de résolution insuffisante pour qu’on puisse l’exploiter proprement en production\.\nPour que le résultat soit parfait, voici comment faire :\n\n• Si vous l’avez généré avec ChatGPT : Retournez simplement dans votre discussion avec lui, transmettez-lui notre message, et renvoyez-nous le nouveau fichier qu’il vous fournira\.\n• Si votre logo a été créé par un graphiste : Le plus simple est de lui demander directement le fichier vectoriel d’origine \(au format PDF, AI, SVG ou EPS\)\.\n\nN’hésitez pas/)
})
