# Michel local — Windows / Ubuntu WSL2 / RTX 4070

## Utilisation

1. Ouvrir **JARVIS-demarrer.cmd** puis attendre l'ouverture du navigateur.
2. Cliquer sur **ACTIVER** et autoriser le microphone pour `http://localhost:8480`.
3. Dire « Michel, dis-moi bonjour » ou « Michel, explique-moi ce qu'est une étoile ».
4. Le bouton clavier permet aussi d'écrire ; « Stop » interrompt la voix.
5. Fermer la page coupe son microphone. **JARVIS-arreter.cmd** arrête les sept services et libère leur mémoire GPU.

L'interface est accessible à <http://localhost:8480>. Un casque réduit les reprises de la voix de l'assistant par le micro.

## Installation

- Ubuntu 24.04, WSL2 ; compte Linux dédié `jarvis`, sans sudo.
- Projet WSL : `/home/buzzer93/code/perso/openclaw-vocal-assistants`.
- Copie de travail Windows : `F:\PARA\01_Projets\code\perso\openclaw-vocal-assistants` (contient aussi les lanceurs).
- Chemin technique des services : `/opt/jarvis`, montage du même dossier WSL, sans seconde copie du code. Le montage `opt-jarvis.mount` est activé au démarrage.
- État et conversations OpenClaw : `/var/lib/jarvis/.openclaw`.
- OpenClaw 2026.9.7, Node.js 24.21.0, Ollama 0.35.0.
- Réponses : `qwen3.5:4b`, local, contexte de 16 384 tokens, réflexion désactivée.
- Reconnaissance vocale : whisper.cpp v1.9.4 compilé avec `GGML_CUDA=1`, architecture CUDA 89, modèles `small` et `large-v3-turbo-q5_0`.
- Voix : Supertonic 3 sur CPU ; Piper français en secours.
- Services activés au démarrage d'Ubuntu. Le lanceur démarre WSL si nécessaire ; aucune tâche Windows de lancement à l'ouverture de session n'a été créée.

## Limites et protection

Tous les services écoutent exclusivement sur la boucle locale. Aucun port Internet/LAN ni règle de transfert n'a été ajouté. Le navigateur accepte le microphone sur `localhost` sans certificat : aucun téléchargement ou ajout de confiance mkcert n'a été effectué.

Un code de 64 caractères aléatoires est conservé dans `/opt/jarvis/config/access-code.txt`, avec permissions privées. Comme prévu par l'application, les connexions locales n'ont pas à le saisir. Les requêtes utilisant un nom d'hôte étranger et les WebSockets d'origine étrangère sont rejetés.

L'agent fonctionne en mode conversation : tous ses outils sont désactivés. Il ne peut pas exécuter de commandes, naviguer sur Internet, modifier des fichiers ou envoyer de messages. Les services sont privés d'accès aux disques Windows montés et aux dossiers personnels Linux. Ce durcissement de services n'est pas une machine virtuelle distincte : Windows et les administrateurs WSL gardent le contrôle.

Après le téléchargement initial des logiciels et modèles, transcription, génération des réponses et synthèse vocale sont locales. Le modèle de 4 milliards de paramètres privilégie une bonne réactivité et la place disponible pour Whisper ; ses capacités sont plus limitées que celles des grands modèles hébergés. Les automatismes planifiés et le plugin de mémoire autonome sont désactivés ; l'historique des conversations reste conservé.

Le modèle a donné une réponse arithmétique erronée lors d'un test en conversation. Il n'est pas un calculateur fiable ; vérifier les réponses factuelles importantes. Les essais de fonctionnement distinguent cette limite du modèle du bon fonctionnement des transmissions audio et des services.

## Diagnostic dans PowerShell

```powershell
wsl -d Ubuntu -u root -- systemctl is-active jarvis-ollama openclaw-gateway jarvis-stt jarvis-stt-precise jarvis-tts-st jarvis-tts jarvis-web
Invoke-RestMethod http://localhost:8480/healthz
wsl -d Ubuntu -- nvidia-smi
wsl -d Ubuntu -u root -- journalctl -u jarvis-web -u openclaw-gateway -n 50 --no-pager
```

Ne pas exécuter `bin/jarvis install` : cette installation utilise des services système durcis, sous un compte dédié, et non les services utilisateur du script d'origine. Utiliser les deux lanceurs Windows fournis. Ne pas remplacer les fichiers modifiés par une mise à jour automatique sans réappliquer les adaptations jointes.

## Vérifications réalisées

- 24 tests JavaScript et 3 tests de normalisation française réussis.
- Les sept services sont actifs ; interface Windows et liaison OpenClaw vérifiées.
- Les deux modèles Whisper utilisent CUDA sur la RTX 4070 ; transcription vérifiée avec chacun.
- Conversation audio synthétique complète validée : Piper → Whisper → OpenClaw → Qwen → Supertonic.
- Accès aux disques Windows refusé depuis les services ; écoute réseau exclusivement locale ; code d'accès de 256 bits, permissions 0600.
- Audit OpenClaw : aucune alerte critique ; une remarque sur les mandataires inverses, sans objet pour cet accès localhost sans mandataire.
- Les délais observés dépendent du chargement et des caches : environ 1 à 15 secondes sur les courts essais après initialisation ; le tout premier chargement GPU a été beaucoup plus long. Ce ne sont pas des garanties de latence générale.

Les rapports détaillés et un exemple WAV de voix française accompagnent ce guide. Le test automatisé utilise une phrase synthétique ; il ne remplace pas l'essai de ton propre microphone et de tes haut-parleurs.

## Sources

- Dépôt : <https://github.com/proxydis/openclaw-vocal-assistants>
- CUDA pour WSL : <https://docs.nvidia.com/cuda/wsl-user-guide/index.html>
- Fournisseur Ollama d'OpenClaw : <https://docs.openclaw.ai/providers/ollama>
- Modèle : <https://ollama.com/library/qwen3.5>
