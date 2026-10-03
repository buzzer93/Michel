# Lanceur Windows Michel

Double-cliquez sur **MICHEL.cmd**, ou sur le raccourci **Michel** du Bureau ou du menu Démarrer.

- **Démarrer** lance les sept services dans Ubuntu et ouvre http://localhost:8480 quand le serveur et sa connexion aux agents sont prêts.
- **Ouvrir** affiche l'interface déjà démarrée.
- **Arrêter** coupe les sept services de l'assistant, sans arrêter Ubuntu ni les autres applications WSL.
- Fermer la fenêtre du lanceur laisse l'assistant fonctionner.

Les commandes directes sont **MICHEL-demarrer.cmd** et **MICHEL-arreter.cmd**.
Pour recréer les raccourcis : clic droit sur `windows/Installer-raccourcis.ps1`, puis « Exécuter avec PowerShell ».

Le lanceur utilise Windows PowerShell et WSL, déjà présents sur ce PC, sans installation supplémentaire.

Pour vérifier l'état sans ouvrir de fenêtre :
```powershell
powershell.exe -NoProfile -File .\windows\Michel.ps1 -Action Status
```

Pour démarrer sans ouvrir le navigateur, ajouter `-Action Start -NoBrowser`.
