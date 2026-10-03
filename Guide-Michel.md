# Michel local — Windows / Ubuntu WSL2 / RTX 4070

## Utilisation

1. Ouvrir le lanceur Windows **MICHEL-demarrer.cmd** (par exemple depuis PowerShell : `& 'F:\PARA\01_Projets\code\perso\openclaw-vocal-assistants\MICHEL-demarrer.cmd'`) puis attendre l'ouverture du navigateur.
2. Cliquer sur **ACTIVER** et autoriser le microphone pour `http://localhost:8480`.
3. **Push-to-talk** : maintenir le bouton latéral « suivant » de la souris pendant que tu parles, relâcher pour envoyer. Le micro mains libres est coupé par défaut ; touche `M` ou bouton micro pour l'activer (le choix est retenu).
4. Parler à Michel : « Michel, dis-moi bonjour ». Il répond lui-même ou confie la demande au bon Michel ; tu peux aussi appeler directement un Michel par son nom (« Michel Explore, … »).
5. Fermer la page coupe son microphone. **MICHEL-arreter.cmd** arrête les services et libère leur mémoire GPU.

L'interface est accessible à <http://localhost:8480>. Un casque réduit les reprises de la voix de l'assistant par le micro.

### Raccourcis

| Geste | Effet |
|---|---|
| Bouton latéral « suivant » de la souris (maintenu) | push-to-talk |
| `M` | micro mains libres on / off |
| `/` | écrire au lieu de parler |
| `Échap` | couper la voix (la tâche continue) |
| `H` | historique de l'agent actif |
| `N` | nouvelle conversation avec l'agent actif (la mémoire validée est gardée) |

## L'équipe

Michel est le chef d'équipe : il répond lui-même ou délègue, de sa propre initiative, à six Michel placés au même niveau.

| Agent | Rôle | Modèle |
|---|---|---|
| **Michel** | assistant, chef d'équipe | OpenAI `gpt-6-astra` (clé API, puis abonnement ChatGPT), puis Claude (abonnement), puis `qwen3.5:4b` local |
| Michel Écrit | mail et agenda | Claude (abonnement Pro, via Claude Code) |
| Michel Compile | GitHub et Docker | Claude (abonnement Pro, via Claude Code) |
| Michel Explore | recherche web et sources (DuckDuckGo) | OpenAI |
| Michel Organise | plans d'action | OpenAI |
| Michel Vérifie | vérification et tests (bac à sable Docker) | OpenAI |
| Michel Construit | modifie le code dans son propre clone (bac à sable Docker) | OpenAI |

Michel lui-même n'exécute aucune commande, ne modifie aucun fichier du projet et n'envoie aucun message : il lit le projet en lecture seule, sa mémoire et des pages web, et n'écrit que dans ses notes. Les sept Michel répondent à l'appel vocal, chacun avec sa voix.

Le panneau **Modèle** (en bas à gauche) montre le modèle réellement utilisé et la consommation de l'abonnement (fenêtres de 5 h et de la semaine).

## Autorisations

Lire, chercher et préparer se fait sans demander. **Tout ce qui agit à l'extérieur** — envoyer ou répondre à un mail, mettre à la corbeille, créer ou modifier un événement, écrire sur GitHub, démarrer ou arrêter un conteneur — affiche une carte d'autorisation avec la commande exacte : **Autoriser** (une fois) ou **Refuser**. Sans réponse, c'est refusé. Une commande contenant des caractères de chaînage (`|`, `&`, `;`, `>`…) est refusée d'office, même entre guillemets.

## Mémoire, notes et rappels

- **Mémoire gouvernée** : Michel *propose* de retenir une préférence ou un fait ; rien n'est retenu sans ton ✓ dans le panneau **Mémoire**.
- **Notes et listes** : « Michel, ajoute du lait à la liste de courses » ; elles s'affichent dans le panneau Mémoire.
- **Rappels et minuteurs** : « Michel, rappelle-moi dans 10 minutes de sortir le linge ». Le rappel est dit à voix haute à l'heure, une seule fois, **si une page du dashboard est ouverte** (sinon il reste écrit dans l'historique).

## Traces et alertes

Chaque demande laisse une trace (agent, modèle, durée, outils, délégations, autorisations, version des consignes) dans `/var/lib/michel/traces/`, gardée 30 jours. Le dashboard alerte quand le quota dépasse 85 %, quand Michel passe sur un modèle de secours, quand une demande est bloquée plus de 5 minutes, ou quand une action est refusée d'office.

## Évaluations et amélioration

- **Jeu d'évaluation** : 40 cas (routage, délégation, mail et agenda, sécurité…) rejoués à travers le vrai gateway, toutes les autorisations refusées :
  `wsl -d Ubuntu -u root -- runuser -u michel -- env HOME=/var/lib/michel /opt/michel-node/bin/node /opt/michel/server/evals/run.mjs`
  Rapport dans `docs/evals/` (contenus privés masqués). Coût : environ 15 à 20 % du quota hebdomadaire ChatGPT Plus (estimation).
- **Boucle d'amélioration**, chaque **samedi vers 6 h** (`michel-improve.timer`, sautée si le PC est éteint à cette heure) : évaluation complète, puis, s'il reste un échec, Michel Organise propose une correction des consignes de Michel, Michel Construit la commite sur une branche, et une copie cachée de Michel (le *candidat*) est évaluée avec elle. La proposition apparaît dans le panneau **Amélioration** avec la raison, la différence et les scores avant/après : **Appliquer**, **Refuser**, puis **Annuler** si besoin. Rien ne change sans ton clic. La boucle ne se lance pas si une proposition attend déjà, si le quota dépasse 50 %, ou si Michel est arrêté.
- Après **Appliquer**, reporter la correction dans le dépôt (sinon le prochain déploiement l'écraserait), puis la relire et la commiter :
  `wsl -d Ubuntu -u root -- env HOME=/var/lib/michel /opt/michel-node/bin/node /opt/michel/server/evals/improve.mjs --apply-repo <id>`

## Installation

- Ubuntu 24.04, WSL2 ; compte Linux dédié `michel`, sans sudo.
- Projet WSL : `/home/buzzer93/code/perso/openclaw-vocal-assistants`.
- Copie de travail Windows : `F:\PARA\01_Projets\code\perso\openclaw-vocal-assistants` (contient aussi les lanceurs).
- Chemin technique des services : `/opt/michel`, montage du même dossier WSL, sans seconde copie du code. Le montage `opt-michel.mount` est activé au démarrage.
- État et conversations OpenClaw : `/var/lib/michel/.openclaw`.
- OpenClaw 2026.9.7, Node.js 24.21.0, Ollama 0.35.0, Docker Desktop (bac à sable `michel-sandbox:node24`).
- Reconnaissance vocale : whisper.cpp v1.9.4 compilé avec `GGML_CUDA=1`, architecture CUDA 89, modèles `small` et `large-v3-turbo-q5_0`.
- Voix : Supertonic 3 sur CPU, une voix par Michel ; Piper français en secours.
- Configuration appliquée par `deployment/configure-services.py` (root), validée par OpenClaw avant d'être écrite.
- Services activés au démarrage d'Ubuntu. Le lanceur démarre WSL si nécessaire ; aucune tâche Windows de lancement à l'ouverture de session n'a été créée.

## Limites et protection

Tous les services écoutent exclusivement sur la boucle locale. Aucun port Internet/LAN ni règle de transfert n'a été ajouté. Le navigateur accepte le microphone sur `localhost` sans certificat.

Un code de 64 caractères aléatoires est conservé dans `/opt/michel/config/access-code.txt`, avec permissions privées. Les connexions locales n'ont pas à le saisir. Les requêtes utilisant un nom d'hôte étranger et les WebSockets d'origine étrangère sont rejetés.

Les services sont privés d'accès aux disques Windows montés et aux dossiers personnels Linux ; les consignes de Michel sont en lecture seule pour le gateway. Ce durcissement n'est pas une machine virtuelle distincte : Windows et les administrateurs WSL gardent le contrôle.

Transcription et synthèse vocale restent locales. Les réponses passent par OpenAI ou Anthropic : ce que tu dis, et la mémoire utile à la réponse, y est envoyé. Le modèle local de 4 milliards de paramètres ne sert qu'en dernier secours ; ses capacités sont plus limitées et il ne peut pas déléguer.

Les modèles peuvent se tromper, y compris sur un calcul : vérifier les réponses factuelles importantes (« Michel, fais vérifier »).

## Diagnostic dans PowerShell

```powershell
wsl -d Ubuntu -u root -- systemctl is-active michel-ollama openclaw-gateway michel-stt michel-stt-precise michel-tts-st michel-tts michel-web
Invoke-RestMethod http://localhost:8480/healthz
wsl -d Ubuntu -- nvidia-smi
wsl -d Ubuntu -u root -- journalctl -u michel-web -u openclaw-gateway -n 50 --no-pager
wsl -d Ubuntu -u root -- systemctl list-timers michel-improve.timer
```

Ne pas exécuter `bin/michel install` : cette installation utilise des services système durcis, sous un compte dédié, et non les services utilisateur du script d'origine. Utiliser les deux lanceurs Windows fournis.

## Vérifications réalisées

- Tests unitaires du serveur réussis (37 sur l'état commité de l'étape 8).
- Jeu d'évaluation de référence : 39 / 40 (`docs/evals/2026-10-01T17-50.md`) ; seul échec, M06, corrigé par la première boucle d'amélioration.
- Autorisations, mémoire, rappels, traces, alertes et boucle d'amélioration vérifiés de bout en bout ; le détail et les preuves de chaque étape sont dans `plan.md`.
- Les deux modèles Whisper utilisent CUDA sur la RTX 4070.
- Accès aux disques Windows refusé depuis les services ; écoute réseau exclusivement locale.

## Sources

- Dépôt : <https://github.com/proxydis/openclaw-vocal-assistants>
- CUDA pour WSL : <https://docs.nvidia.com/cuda/wsl-user-guide/index.html>
- Fournisseur Ollama d'OpenClaw : <https://docs.openclaw.ai/providers/ollama>
- Modèle local : <https://ollama.com/library/qwen3.5>
