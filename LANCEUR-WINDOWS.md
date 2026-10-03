# Lanceur Windows Michel

Double-cliquez sur le raccourci **Michel** du Bureau ou du menu Démarrer : Michel démarre s'il est arrêté, puis son
interface (<http://localhost:8480>) s'ouvre dans le navigateur dès qu'elle est prête et reliée aux agents. S'il
tourne déjà, l'interface s'ouvre tout de suite.

- Aucune fenêtre de lanceur : seul un message d'erreur peut s'afficher, si Michel ne démarre pas.
- Un second double-clic pendant le démarrage n'ouvre pas de second onglet.
- Pour arrêter Michel : l'icône d'alimentation de l'interface.
- **MICHEL.cmd** fait la même chose depuis l'explorateur (une console s'ouvre et se ferme aussitôt).

Pour recréer les raccourcis : clic droit sur `windows/Installer-raccourcis.ps1`, puis « Exécuter avec PowerShell ».
Le raccourci lance `windows/Michel.ps1` depuis ce dossier : il suit les mises à jour du dépôt sans être recréé.

Le lanceur utilise Windows PowerShell et WSL, déjà présents sur ce PC, sans installation supplémentaire.

Pour vérifier l'état sans rien ouvrir :

```powershell
powershell.exe -NoProfile -File .\windows\Michel.ps1 -Action Status
```

Pour démarrer sans ouvrir le navigateur, ajouter `-NoBrowser`.
