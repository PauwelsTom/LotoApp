# Loto

Application de tirage de loto : tirage animé avec annonce vocale, vérification des numéros sortis et contrôle d'une grille par QR code.

## Développement

```bash
npm install
npm run dev
```

La caméra (scan des QR codes) ne fonctionne que sur `localhost` ou en HTTPS.

## Déploiement sur Netlify

Le fichier `netlify.toml` contient la configuration : commande `npm run build`, dossier publié `dist`.
Il suffit de relier le dépôt Git à Netlify, ou de déposer le dossier `dist` après un `npm run build`.

## Format des QR codes

Un QR code de grille contient le texte `LOTO1:` suivi des lignes séparées par `/`, les numéros étant séparés par des virgules :

```
LOTO1:4,23,41,67,85/12,30,52,70,88/9,28,45,63,79
```
