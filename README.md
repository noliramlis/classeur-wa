# Classeur WA

Petite appli web installable (PWA) pour Android qui apparaît dans le menu **Partager** de WhatsApp.
Tout ce que tu y envoies (texte, lien, photo, vidéo, vocal, document) est stocké **uniquement sur ton téléphone**,
et tu peux le taguer, l'annoter, l'épingler et le retrouver par recherche.

## 1. Mettre l'appli en ligne (gratuit, ~5 min)

Une PWA doit être servie en HTTPS pour pouvoir s'installer. Le plus simple : **GitHub Pages**.

1. Crée un compte sur github.com si besoin, puis un nouveau dépôt public (ex. `classeur-wa`).
2. *Add file → Upload files* : glisse tous les fichiers de ce dossier (pas le dossier lui-même), puis *Commit*.
3. *Settings → Pages* : Source = *Deploy from a branch*, Branch = `main`, dossier `/ (root)`, *Save*.
4. Après une minute, l'appli est à l'adresse `https://<ton-pseudo>.github.io/classeur-wa/`.

> Le code est public sur GitHub, mais **tes données ne le sont pas** : elles restent dans le stockage local du téléphone.

## 2. L'installer sur Android

1. Ouvre l'adresse ci-dessus dans **Chrome** sur ton téléphone.
2. Menu ⋮ → **Installer l'application** (ou *Ajouter à l'écran d'accueil*).
3. Ouvre-la une fois depuis l'icône.

L'appli « Classeur WA » apparaît maintenant dans la feuille de partage Android.
(Si elle n'y est pas tout de suite, redémarre WhatsApp ou attends quelques minutes.)

## 3. Utilisation

- **Depuis WhatsApp** : appui long sur un message → *Partager* → *Classeur WA*. L'éditeur s'ouvre pour ajouter des tags.
- **Texte sans bouton Partager** : appui long → *Copier*, puis le bouton **+** dans l'appli → *Coller depuis le presse-papiers*.
- **Retrouver** : barre de recherche (texte, `#tag`, note, nom de fichier), filtres par type et par tag.
- **Sauvegarde** : menu ⋮ → *Exporter* (fichier .json avec les médias). Fais-le de temps en temps :
  si tu désinstalles l'appli ou effaces les données de Chrome, le contenu est perdu.

## Structure

| Fichier | Rôle |
|---|---|
| `manifest.webmanifest` | Déclare l'appli et la cible de partage (`share_target`) |
| `sw.js` | Service worker : reçoit les partages, fonctionne hors-ligne |
| `db.js` | Stockage IndexedDB (partagé page / service worker) |
| `app.js` | Interface : liste, filtres, recherche, éditeur, export/import |
| `index.html`, `style.css` | Page et style (clair/sombre automatique) |

## Modifier l'appli

Modifie les fichiers et ré-uploade-les sur GitHub. Le service worker charge le réseau en priorité,
donc la nouvelle version arrive à la prochaine ouverture (parfois la suivante).

Pistes d'évolution : collections/dossiers, tri par date du message, rappel « à relire », synchronisation
entre appareils (il faudrait alors un petit backend ou Google Drive).
