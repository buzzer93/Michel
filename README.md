# Michel — interface vocale locale pour vos agents OpenClaw

Parlez à vos agents [OpenClaw](https://github.com/openclaw/openclaw) depuis un navigateur. Michel répond à voix
haute, avec sa propre voix, affiche le détail à l'écran, et confie au besoin la demande à l'un des six autres Michel
de son équipe (mail et agenda, GitHub et Docker, recherche web, plans, vérification, code).

![Michel répond à voix haute : l'orbe suit sa voix, les sous-titres s'éclairent mot à mot, le détail de la réponse s'ouvre dans une fenêtre flottante et le rail montre l'état de chaque agent.](docs/screenshot.jpg)

La reconnaissance et la synthèse vocales tournent **sur votre machine**. Les réponses viennent des modèles
d'OpenAI, puis d'Anthropic (Claude) en secours, puis d'un modèle local (Qwen) en dernier recours.

> **Langue :** tout est en **français** aujourd'hui : Whisper tourne avec `-l fr`, les voix sont françaises, les
> nombres sont écrits en toutes lettres à la française et l'interface est en français. Voir [Limites](#limites).

- [Fonctionnalités](#fonctionnalités)
- [Démarrer (Windows)](#démarrer-windows)
- [Utilisation](#utilisation)
- [L'équipe et les modèles](#léquipe-et-les-modèles)
- [Autorisations, mémoire et rappels](#autorisations-mémoire-et-rappels)
- [Traces, alertes, évaluations et amélioration](#traces-alertes-évaluations-et-amélioration)
- [Fonctionnement](#fonctionnement)
- [Installation de référence (Windows + WSL2)](#installation-de-référence-windows--wsl2)
- [Installation générique (Linux, services utilisateur)](#installation-générique-linux-services-utilisateur)
- [Configuration](#configuration)
- [Exploitation et diagnostic](#exploitation-et-diagnostic)
- [Dépannage](#dépannage)
- [Limites](#limites)
- [Sécurité et confidentialité](#sécurité-et-confidentialité)
- [Licences et composants tiers](#licences-et-composants-tiers)

Le journal de construction du projet (choix, preuves de chaque étape, suite prévue) est dans [plan.md](plan.md).

---

## Fonctionnalités

**Voix**

- **Push-to-talk** sur le bouton latéral « suivant » de la souris : maintenir pendant qu'on parle, relâcher pour
  envoyer. Sans prénom, la phrase va à Michel, qui répartit. Le micro mains libres (touche `M`) est coupé par défaut.
- **Appel par prénom** en mains libres : chaque agent répond à son nom, en début ou en fin de phrase ; pendant
  2 minutes après une réponse, on continue sans répéter le nom. Une phrase sans prénom s'affiche en gris et n'est
  envoyée à personne.
- **Plusieurs agents à la fois** : chacun travaille dans sa propre session OpenClaw (`agent:<id>:michel`).
- **« Stop »** coupe la voix (la tâche continue) ; **« Michel Explore, annule »** interrompt la tâche.
- **Une voix par agent** (Supertonic 3, Piper en secours) ; nombres, heures, dates et montants lus correctement
  (« 14h30 » → « quatorze heures trente »), chiffres conservés dans les sous-titres.
- **Réponses courtes à l'oral, détail à l'écran** : tableaux, listes et code dans une fenêtre flottante par agent.
- **Fenêtres navigateur sur demande** (« montre-moi la doc dans une fenêtre ») : la page est rendue par un Chrome
  sans écran sur la machine et retransmise dans l'interface.
- **Historique** de chaque agent, jour par jour, lu dans sa session OpenClaw.

**Gouvernance de l'équipe** (équipe fournie dans `agents/`, déployée par `deployment/configure-services.py`)

- **Autorisations** : lire et préparer est libre ; tout ce qui agit à l'extérieur (envoyer un mail, modifier
  l'agenda, écrire sur GitHub, démarrer un conteneur) affiche la commande exacte sur une carte : autoriser une fois
  ou refuser. Sans réponse, c'est non.
- **Mémoire gouvernée** : Michel *propose* ce qu'il faut retenir, une règle de travail ou une modification de ses
  consignes ; rien ne change sans votre clic.
- **Notes, listes, rappels et minuteurs**.
- **Traces et alertes** : une trace par demande (modèle réellement utilisé, durée, outils, délégations,
  autorisations), alertes de quota, de modèle de secours, de demande bloquée ou d'action refusée d'office.
- **Évaluations et boucle d'amélioration hebdomadaire** : 40 cas rejoués à travers le vrai gateway ; s'il reste un
  échec, une correction est proposée, mesurée sur une copie cachée de Michel, puis soumise à votre décision.

**Interface** : orbe WebGL qui réagit à votre voix et à celle de l'agent, avatars, rail d'activité, sous-titres mot
à mot, panneaux Modèle, Mémoire et Amélioration. Fonctionne sur ordinateur, tablette et téléphone.

## Démarrer (Windows)

Double-cliquer sur le raccourci **Michel** (Bureau ou menu Démarrer) : Michel démarre s'il est arrêté, sans fenêtre
de lanceur, puis son interface (<http://localhost:8480>) s'ouvre dans le navigateur dès qu'elle est prête et reliée
aux agents. S'il tourne déjà, elle s'ouvre tout de suite.

- Seul un message d'erreur peut s'afficher, si Michel ne démarre pas. Un second double-clic pendant le démarrage
  n'ouvre pas de second onglet.
- **Arrêter** : l'icône d'alimentation de l'interface (arrête tous les services et libère la mémoire GPU).
- **MICHEL.cmd**, à la racine, fait la même chose depuis l'explorateur (une console apparaît brièvement).
- Recréer les raccourcis : clic droit sur `windows/Installer-raccourcis.ps1` → « Exécuter avec PowerShell ». Le
  raccourci lance `windows/Michel.ps1` depuis le dépôt WSL : il suit les mises à jour sans être recréé.
- État sans rien ouvrir : `powershell.exe -NoProfile -File .\windows\Michel.ps1 -Action Status` ; démarrer sans
  navigateur : `-NoBrowser`.

Ensuite : cliquer sur **ACTIVER** et autoriser le micro. Une séquence de démarrage d'environ 4 s se joue ; ce que le
micro entend pendant ce temps est ignoré (sons coupés : `localStorage.setItem("michel.sfx", "off")` dans la console
du navigateur).

## Utilisation

### Parler

| Vous | Il se passe |
|---|---|
| Bouton « suivant » de la souris maintenu : « quel temps fait-il à Lyon ? » | Michel répond ou confie la demande au bon Michel. |
| « **Michel Explore**, cherche la dernière version de Node.js » | Appel direct d'un Michel par son nom. |
| (mains libres) « **Michel**, lance les tests » | Réveil et demande en une phrase ; « Tu peux vérifier la CI, **Michel Compile** ? » marche aussi. |
| « Et sur la branche principale ? » (dans les 2 min) | Suite de la conversation, sans répéter le nom. |
| « **Michel Écrit**, lis mes mails » pendant qu'un autre travaille | Les deux avancent en parallèle. |
| « **Stop** » (ou « arrête », « silence », « chut ») | La voix se coupe ; la tâche **continue**. |
| « **Michel Compile, annule** » | La tâche est interrompue. |

Bon à savoir :

- Un prénom **au milieu** d'une phrase ne réveille personne (« j'ai vu le rapport de Michel hier »).
- Pendant qu'un agent parle, seuls « stop » et un appel par nom comptent, pour qu'il ne se réponde pas à lui-même.
- Comptez quelques secondes pour une question simple, davantage quand l'agent utilise des outils ou délègue
  (visible sur l'orbe et dans le rail).
- Un micro proche (casque) change tout ; avec des enceintes, gardez un volume modéré pour que « stop » soit entendu.

### Sans la voix

| Geste | Effet |
|---|---|
| Bouton « suivant » de la souris (maintenu) | push-to-talk |
| Bouton micro ou `M` | micro mains libres on / off (le choix est retenu) |
| Bouton clavier ou `/` | écrire au lieu de parler |
| Carré rouge (pendant que l'agent parle) ou `Échap` | couper la voix |
| Bouton horloge ou `H` | historique de l'agent actif, jour par jour, onglets pour les autres agents |
| `N` | nouvelle conversation avec l'agent actif (la mémoire validée est gardée) |
| Toucher un agent dans le rail | le sélectionner sans parler |
| Bouton silhouette | changer les avatars (toucher ou déposer une image ; « ↺ défaut » rétablit l'original) |

### Lire l'écran

- **Orbe** : couleur de l'agent actif. Calme = à l'écoute ; ondes qui convergent = il vous entend ; anneaux et
  étincelles = il réfléchit ou utilise un outil ; ondes qui rayonnent = il parle. Sous l'orbe : son nom et son état.
- **Sous-titres** : vous en blanc, les agents dans leur couleur, éclairés mot à mot ; les phrases ignorées en gris,
  avec la raison.
- **Rail des agents** : plein = actif, tournant = au travail, pointillés = occupé ailleurs ; ligne de pouls des
  45 dernières secondes (plate = repos, ondulée = réflexion, pics = outils, barres = parole).
- **Fenêtres** : une par agent, déplaçable et redimensionnable. Les fenêtres navigateur (sur demande explicite
  seulement) se pilotent à la souris et au clavier ; elles n'ont pas vos cookies.
- **Panneau Modèle** (en bas à gauche) : le modèle qui a **réellement** répondu (en ambre avec « secours » quand ce
  n'est pas le modèle prévu) et la consommation de l'abonnement ChatGPT (fenêtres de 5 h et de la semaine).
- **Panneau Mémoire** : propositions à valider, règles de travail, notes et listes.
- **Panneau Amélioration** : une modification des consignes de Michel en attente de votre décision.

## L'équipe et les modèles

Michel est le chef d'équipe : il répond lui-même ou délègue, de sa propre initiative, à six Michel placés au même
niveau. Chacun répond aussi à l'appel vocal direct, avec sa voix.

| Agent | Rôle |
|---|---|
| **Michel** | assistant, chef d'équipe ; lit le projet en lecture seule, n'exécute aucune commande |
| Michel Écrit | mail et agenda (Gmail, Google Calendar, via `gog`) |
| Michel Compile | GitHub (`gh`) et Docker |
| Michel Explore | recherche web et sources (DuckDuckGo) |
| Michel Organise | plans d'action |
| Michel Vérifie | vérification et tests, dans un bac à sable Docker |
| Michel Construit | modifie le code dans son propre clone du projet, dans un bac à sable Docker |

**Modèles** : tous répondent avec OpenAI `gpt-6-astra` (clé API, puis abonnement ChatGPT) et passent sur Claude
`claude-sonnet-5-5` (abonnement Pro, via Claude Code) quand OpenAI est épuisé ou injoignable ; Michel a en dernier
recours `qwen3.5:4b` en local (Ollama), qui répond même sans Internet (en une quinzaine de secondes).

**Mode secours Claude** : passer par Claude Code a un coût, mesuré :

- OpenClaw ne transmet pas l'historique de la conversation à Claude (connexion non vérifiable) : chaque demande
  arrive sans le début de la conversation ;
- les outils d'OpenClaw (lecture, écriture, commandes) n'y sont pas disponibles. Répondre et déléguer fonctionnent ;
  les commandes de Michel Vérifie et Michel Construit, qui tourneraient hors de leur bac à sable Docker, sont refusées.

Une clé API Anthropic (facturée à l'usage) lèverait ces limites ; elle n'est pas utilisée aujourd'hui.

## Autorisations, mémoire et rappels

**Autorisations.** Lire, chercher et préparer se fait sans demander. Envoyer ou répondre à un mail, mettre à la
corbeille, créer ou modifier un événement, écrire sur GitHub, démarrer ou arrêter un conteneur affiche une carte avec
la commande exacte : **Autoriser** (une fois) ou **Refuser** ; sans réponse, c'est refusé. Une commande contenant des
caractères de chaînage (`|`, `&`, `;`, `>`…) est refusée d'office, même entre guillemets.

**Mémoire.** Rien de ce que dit Michel ne modifie sa mémoire ou ses consignes sans votre clic :

- un **fait** ou une **préférence** (« retiens que… ») : proposition à valider (✓) dans le panneau Mémoire ;
- une **règle de travail** (« à partir de maintenant, quand je dis X, fais Y ») : proposition de type « règle » ;
  validée, elle rejoint les « Règles de travail » (fichier `USER.md`), appliquées dans toutes les conversations et
  retirables d'un ✕ ;
- une **modification de ses consignes** (rôle, délégation, sécurité), seulement sur demande explicite : elle attend
  dans le panneau Amélioration, avec la différence, « demandée par toi, non évaluée ».

Seules vos propres paroles mènent à une proposition : une page web, un mail ou le résultat d'un autre agent jamais.
Les nouvelles consignes s'appliquent à partir d'une nouvelle conversation (`N`).

**Notes et listes** : « Michel, ajoute du lait à la liste de courses » (fichiers `notes/*.md`, affichés dans le
panneau Mémoire ; écriture possible sur OpenAI seulement).

**Rappels et minuteurs** : « Michel, rappelle-moi dans 10 minutes de sortir le linge ». Le rappel est dit à voix
haute à l'heure, une seule fois, si une page de l'interface est ouverte (sinon il reste écrit dans l'historique).

## Traces, alertes, évaluations et amélioration

- **Traces** : une ligne par demande dans `/var/lib/michel/traces/` (agent, modèle réellement utilisé, durée, outils,
  délégations, autorisations, version des consignes), gardée 30 jours.
- **Alertes** (notifications à l'écran) : quota au-delà de 85 %, agent sur un modèle de secours, demande bloquée plus
  de 5 minutes, action refusée d'office, plafond de délégations.
- **Jeu d'évaluation** : 40 cas (routage, délégation, mail et agenda, sécurité…) rejoués à travers le vrai gateway,
  toutes les autorisations refusées ; rapport dans `docs/evals/` (contenus privés masqués). Une évaluation complète
  vide à elle seule la fenêtre de 5 h de l'abonnement ChatGPT Plus et environ 16 % de la semaine :

  ```powershell
  wsl -d Ubuntu -u root -- runuser -u michel -- env HOME=/var/lib/michel /opt/michel-node/bin/node /opt/michel/server/evals/run.mjs
  ```

  Options : `--only R01,M03`, `--label <nom>`, `--agent-map main=main_candidate`.
- **Boucle d'amélioration**, chaque samedi vers 6 h (`michel-improve.timer`, juste après la remise à zéro
  hebdomadaire du quota ; sautée si le PC est éteint) : évaluation complète, puis, s'il reste un échec, Michel
  Organise propose une correction des consignes de Michel, Michel Construit la commite sur une branche, et une copie
  cachée de Michel (le *candidat*) est évaluée avec elle. La fiche (raison, différence, scores avant/après,
  régressions) attend dans le panneau Amélioration : **Appliquer**, **Refuser**, puis **Annuler** pendant 30 s. La
  boucle ne se lance pas si une proposition attend déjà, si le quota dépasse 50 %, ou si Michel est arrêté.
- Après **Appliquer**, reporter la correction dans le dépôt (sinon le prochain déploiement l'écraserait), puis la
  relire et la commiter :

  ```powershell
  wsl -d Ubuntu -u root -- env HOME=/var/lib/michel /opt/michel-node/bin/node /opt/michel/server/evals/improve.mjs --apply-repo <id>
  ```

Limite connue : les propositions ne viennent que des cas de test, pas encore des ratés vus en usage réel (phase 2 du
plan).

## Fonctionnement

```
Navigateur (PC / tablette / mobile)            Machine hôte (Ubuntu, WSL2)
┌──────────────────────────────┐   HTTP(S)   ┌──────────────────────────────────────────────────────┐
│ micro → détection de voix    │ ──────────▶ │ michel-web        Node, :8480 (local), :8443 (réseau) │
│ orbe, sous-titres, lecture   │ ◀────────── │  ├─▶ michel-stt          whisper.cpp small, GPU      │
└──────────────────────────────┘  WebSocket  │  ├─▶ michel-stt-precise  whisper.cpp large-v3-turbo   │
                                             │  ├─▶ michel-tts          routeur de voix + nombres   │
                                             │  │    └─▶ michel-tts-st  Supertonic 3                │
                                             │  └─▶ openclaw-gateway    agents, :18789 (boucle)     │
                                             │       └─▶ michel-ollama  Qwen local (secours)        │
                                             └──────────────────────────────────────────────────────┘
```

La page détecte quand vous parlez (Silero VAD, dans le navigateur) et envoie l'audio à `michel-web`, qui le
transcrit avec Whisper, trouve l'agent appelé et lui envoie la phrase (`chat.send` sur le gateway). La réponse,
reçue en flux, est découpée en phrases synthétisées au fur et à mesure.

| Service | Rôle | Écoute |
|---|---|---|
| `michel-web` | page web, WebSocket, routage, pont vers le gateway, autorisations, mémoire, traces, alertes | `127.0.0.1:8480` (HTTP) ; `0.0.0.0:8443` (HTTPS) si l'accès réseau est activé |
| `openclaw-gateway` | agents OpenClaw, outils, délégation, tâches planifiées | `127.0.0.1:18789` |
| `michel-stt` | Whisper `small` : énoncés courts (noms, « stop ») | `127.0.0.1:8178` |
| `michel-stt-precise` | Whisper `large-v3-turbo` (q5) : phrases complètes | `127.0.0.1:8188` |
| `michel-tts` | entrée de la synthèse : lexique, nombres en lettres, choix de la voix, Piper en secours | `127.0.0.1:8179` |
| `michel-tts-st` | moteur Supertonic 3 (ONNX, CPU) | `127.0.0.1:8182` |
| `michel-ollama` | modèle local de secours | `127.0.0.1:11434` |
| `michel-improve.timer` | boucle d'amélioration hebdomadaire | — |

Reconnaissance et synthèse vocales en option chez OpenAI (`sttEngine` / `ttsEngine` : `"openai"`, clé dans
`/var/lib/michel/secrets/openai-voice.env`, moteurs locaux en repli) : en cours d'évaluation (étape V du plan).

## Installation de référence (Windows + WSL2)

L'installation de référence tourne sous Windows 11, Ubuntu 24.04 dans WSL2, avec une NVIDIA RTX 4070 (CUDA 12.8).
Elle est durcie : services système sous un compte dédié `michel`, sans sudo, privés d'accès aux disques Windows et
aux dossiers personnels.

| Emplacement | Contenu |
|---|---|
| `~/code/…/openclaw-vocal-assistants` | le dépôt, côté WSL |
| `/opt/michel` | montage du dépôt (`opt-michel.mount`), lu par les services ; aucune seconde copie du code |
| `/opt/michel-node`, `/opt/michel-ollama` | Node.js 24 et Ollama |
| `/var/lib/michel` | compte `michel` : état et conversations OpenClaw (`.openclaw`), connexions, traces, fiches d'amélioration |

Étapes, dans l'ordre (scripts écrits pour cette machine ; à relire avant de les adapter) :

1. Créer le compte de service `michel` (système, dossier `/var/lib/michel`), puis lancer en root
   `deployment/bootstrap-runtimes.py` (Node.js, Ollama, téléchargements vérifiés dans `/opt/michel-downloads`).
2. En tant que `michel` : `deployment/install-app.sh` (whisper.cpp, environnement Python, serveur web, OpenClaw),
   `deployment/build-whisper.sh` (compilation CUDA), `deployment/download-voices.py`,
   `deployment/prefetch-supertonic.py`.
3. En root : `deployment/install-agent-tools.py` (`gog`, `gh`, Docker, Claude Code).
4. Connexions, en tant que `michel` : abonnement ChatGPT (`openclaw models auth login --provider openai`), Claude
   Code, Gmail et Google Calendar (`gog`), GitHub (`gh`).
5. En root : `python3 /opt/michel/deployment/configure-services.py`. Le script écrit la configuration d'OpenClaw (la
   valide avant de l'écrire), la liste des commandes autorisées, les unités systemd durcies, l'image du bac à sable
   `michel-sandbox:node24` et le minuteur hebdomadaire. À relancer après chaque mise à jour du dépôt, puis
   redémarrer `openclaw-gateway` et `michel-web`.
6. Vérifier : `deployment/verify-installation.py`, puis le jeu d'évaluation.
7. Côté Windows : `windows/Installer-raccourcis.ps1`.

Ne pas lancer `bin/michel install` sur cette installation : il installe les services utilisateur de l'installation
générique.

## Installation générique (Linux, services utilisateur)

L'installation du projet d'origine, plus simple, sans l'équipe fournie ni le durcissement : vos propres agents
OpenClaw, des services `systemd --user`.

**Prérequis** : Linux x86-64 avec `systemd --user` ; OpenClaw sur la même machine, gateway en service ; Node.js
≥ 22.19, Python 3.12 et [`uv`](https://docs.astral.sh/uv/), `git`, `curl`, `gcc`/`g++` ; une carte graphique avec
pilote Vulkan conseillée (CPU seul possible, plus lent ; CUDA aussi) ; environ 6 Go de disque et 1,3 Go de mémoire ;
Google Chrome pour les fenêtres navigateur ; aucun droit root, sauf pour ouvrir le port HTTPS d'un pare-feu.

```bash
git clone https://github.com/proxydis/openclaw-vocal-assistants.git app && cd app

# 1. Reconnaissance vocale (détails, pièges et mesures : vendor/WHISPER.md)
uv tool install cmake && uv tool install ninja && export PATH="$HOME/.local/bin:$PATH"
git clone --depth 1 --branch v1.9.4 https://github.com/ggml-org/whisper.cpp.git vendor/whisper.cpp
cmake -S vendor/whisper.cpp -B vendor/whisper.cpp/build -G Ninja -DCMAKE_BUILD_TYPE=Release -DGGML_VULKAN=1 -DWHISPER_SDL2=OFF
#   SDK Vulkan sans root : https://sdk.lunarg.com/sdk/download/latest/linux/vulkan-sdk.tar.xz puis source <sdk>/setup-env.sh
#   CPU seul : retirer -DGGML_VULKAN=1 ; NVIDIA : -DGGML_CUDA=1
cmake --build vendor/whisper.cpp/build --config Release -j 8
mkdir -p vendor/models
for m in large-v3-turbo-q5_0 small; do
  curl -L -o vendor/models/ggml-$m.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$m.bin
done

# 2. Synthèse vocale (Supertonic 3, Piper en secours ; détails : vendor/voices/TTS.md)
uv venv -p 3.12 .venv
uv pip install --python .venv/bin/python piper-tts onnxruntime numpy scipy soundfile supertonic==1.3.1 num2words
mkdir -p vendor/voices/models
for v in siwis tom upmc; do for ext in onnx onnx.json; do
  curl -L -o "vendor/voices/models/fr_FR-$v-medium.$ext" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/$v/medium/fr_FR-$v-medium.$ext"
done; done

# 3. Serveur web
(cd server && npm ci)

# 4. Services, certificat HTTPS, démarrage automatique
bin/michel install                  # unités systemd --user, certificat local (mkcert)
loginctl enable-linger "$USER"      # services actifs sans session ouverte (une fois)
bin/michel status                   # chaque service « active », puis {"ok":true,"gateway":true}
bin/michel test                     # tests, vérification de bout en bout, scénario à deux agents
```

Les poids de Supertonic 3 (environ 390 Mo) se téléchargent au premier démarrage de `michel-tts-st`. Vérifier que la
carte graphique sert vraiment : `vulkaninfo --summary`, puis une ligne `ggml_vulkan:` qui la nomme dans le journal de
`michel-stt-precise`.

**Accès depuis un autre appareil du réseau.** Les navigateurs ne donnent le micro qu'aux pages HTTPS (ou
`localhost`) : chaque appareil doit faire confiance **une fois** à l'autorité de certification locale.

1. Ouvrir `https://<ip-de-la-machine>:8443/ca.crt` (accepter l'avertissement cette seule fois) ; `bin/michel url`
   donne l'adresse exacte.
2. L'installer comme autorité de confiance : **Windows** double-clic → Installer → Ordinateur local → « Autorités de
   certification racines de confiance » ; **macOS** Trousseau → « Toujours approuver » ; **Android** Paramètres →
   Sécurité → Chiffrement et identifiants → Installer un certificat → Certificat CA ; **iPhone/iPad** Réglages →
   Profil téléchargé → Installer, puis Général → Informations → Réglages de confiance des certificats ; **Linux**
   Paramètres → Certificats → Autorités → Importer.
3. Ouvrir `https://<ip-de-la-machine>:8443` et saisir le code d'accès (`bin/michel code`).

Avec un pare-feu : `sudo ufw allow from 192.168.1.0/24 to any port 8443 proto tcp`. Si l'adresse IP change :
`bin/michel certs` (l'autorité ne change pas). Variante sans certificat à importer : Tailscale
(`tailscale serve --bg https+insecure://localhost:8443`).

**Vos agents.** Ils sont découverts automatiquement dans `agents.entries` de `~/.openclaw/openclaw.json` (id, nom,
emoji) ; l'agent `main` passe en premier et répond à « Michel » s'il n'a pas de nom. Chacun reçoit des alias, une
couleur et une voix, stables d'un démarrage à l'autre. Après avoir ajouté ou renommé un agent : `bin/michel restart`.

## Configuration

Fichiers locaux, ignorés par git ; les `*.example.json` montrent le format.

| Fichier | Contenu |
|---|---|
| `config/settings.json` | `userName` (utilisé dans les consignes et les salutations) ; ports (`httpsPort` 8443, `httpPort` 8480) et `bind` ; URLs des services ; `sessionSuffix` (`michel`) ; fenêtre de suivi `followUpMs` (2 min) ; `wakePhrases` ; amorce Whisper `sttPrompt` (générée sinon) ; `sttEngine` / `ttsEngine` ; seuils d'alerte `alerts` ; `debug` |
| `config/agents.json` | liste d'agents (remplace la découverte automatique) : `id` OpenClaw, `name`, `aliases` (graphies produites par Whisper : regarder le sous-titre gris d'un appel manqué), `color`, `glyph`, `voice` |
| `config/pronunciation.json` | prononciations forcées (noms, sigles) ; un nom dont la consonne finale doit s'entendre prend un « e » écrit : `"Jordan": "Jordanne"` |
| `vendor/voices/voices.json` | catalogue des voix (moteur, style Supertonic `F1`-`F5` / `M1`-`M5`, vitesse, hauteur) ; vérifier avec `.venv/bin/python tts/voice_qa.py` |
| `web/avatars/<prénom sans accents>.jpg` | avatar d'un agent (vous : `user.jpg`) ; sans image, un sigle est dessiné |
| `config/access-code.txt` | code d'accès réseau, généré ; le supprimer et redémarrer pour en obtenir un nouveau |
| `certs/` | autorité de certification locale et certificat du serveur |
| `agents/<id>/` | équipe fournie : `agent.json` (modèle, secours, voix, outils, commandes autorisées), `AGENTS.md`, `SOUL.md` ; `agents/CONTRACT.md` : contrat commun |

Variables d'environnement : `MICHEL_CHROME` (chemin de Chrome), `MICHEL_TTS_THREADS` (fils de Supertonic, 4 par
défaut), `MICHEL_SUPERTONIC_STEPS` (qualité, 1-32), `MICHEL_AGENTS_FILE` (autre fichier d'agents),
`MICHEL_HTTP_PORT`, `MICHEL_HTTPS_PORT`, `MICHEL_DEBUG`.

## Exploitation et diagnostic

Installation de référence, depuis PowerShell :

```powershell
wsl -d Ubuntu -u root -- systemctl is-active michel-ollama openclaw-gateway michel-stt michel-stt-precise michel-tts-st michel-tts michel-web
Invoke-RestMethod http://localhost:8480/healthz
wsl -d Ubuntu -u root -- journalctl -u michel-web -u openclaw-gateway -n 50 --no-pager
wsl -d Ubuntu -u root -- systemctl list-timers michel-improve.timer
wsl -d Ubuntu -- nvidia-smi
```

Le journal de `michel-web` contient une ligne `temps <agent>: transcription … · 1re phrase … · 1er son … · total …`
par échange (où part le temps), les alertes, les décisions d'autorisation et les demandes d'arrêt.

Installation générique : `bin/michel status | start | stop | restart | logs | url | code | certs | test | uninstall`.

Tests : `node --test test/*.test.mjs` dans `server/` (logique de routage, découpage des réponses, autorisations,
mémoire, traces, améliorations…) ; `node test/e2e.mjs "<Prénom>, quelle heure est-il ?"` (une phrase synthétisée
passe par Whisper et le gateway) ; `node test/scenario.mjs` (deux agents, « stop », « annule ») ;
`node test/ui.mjs --viewport 390x844` (vraie page dans Chrome sans écran, faux micro, captures dans `/tmp/michel`) ;
`.venv/bin/python -m unittest tts/test_fr_normalize.py` (lecture des nombres) ; `windows/Test-Launcher.ps1`.

## Dépannage

| Symptôme | Piste |
|---|---|
| Rien ne s'ouvre au double-clic | `Michel.ps1 -Action Status` ; un message d'erreur dit quel service n'a pas démarré |
| « Micro indisponible » | page ouverte en HTTP depuis un autre appareil, autorité non importée, ou micro refusé dans le navigateur |
| Personne ne répond, aucun sous-titre | journal de `michel-web` : sans ligne `entendu:`, la page n'envoie rien ; chercher une ligne `page:` (micro refusé, erreur de script) |
| « liaison perdue » | gateway arrêté : redémarrer `openclaw-gateway` (générique : `openclaw status`, puis `bin/michel restart`) |
| « Reconnaissance vocale indisponible » | journal de `michel-stt-precise` ; vérifier la ligne `ggml_cuda` / `ggml_vulkan` |
| Panneau Modèle en ambre « secours » | quota ChatGPT épuisé ou OpenAI injoignable : Claude (ou Qwen) répond, avec les limites du mode secours |
| Un agent ne se réveille pas à son nom | lire le sous-titre gris (ce que Whisper a entendu) et l'ajouter à ses `aliases` |
| Un mot ou un nom mal prononcé | `config/pronunciation.json` |
| Un nombre, une heure ou un montant mal lu | ajouter le cas dans `tts/fr_normalize.py`, avec son test dans `tts/test_fr_normalize.py` |
| L'agent s'entend lui-même | baisser le volume, éloigner le micro, ou un casque |
| Inaccessible depuis un autre appareil | état des services, puis pare-feu (port 8443) et isolation Wi-Fi de la box |

## Limites

- **Français seulement** : une autre langue demande de changer `-l fr` de Whisper (`systemd/michel-stt*.service`),
  des voix, le normaliseur de nombres (`tts/fr_normalize.py`) et les textes de l'interface.
- **Même machine que le gateway** : `michel-web` le joint en boucle locale et lit sa configuration localement.
- **Mode secours Claude dégradé** (voir [L'équipe et les modèles](#léquipe-et-les-modèles)).
- **Rappels** : dits seulement si une page de l'interface est ouverte.
- Pas d'émotion dans les voix ; un seul locuteur à la fois, sans identification ; texte très technique (chemins,
  identifiants) lu imparfaitement.
- Les modèles peuvent se tromper, y compris sur un calcul : faites vérifier les réponses importantes (« Michel, fais
  vérifier »).

## Sécurité et confidentialité

- Installation de référence : tous les services écoutent sur la boucle locale ; aucun port n'est ouvert vers le
  réseau. Un code d'accès de 64 caractères protège l'accès réseau quand il est activé ; les noms d'hôte et les
  origines WebSocket étrangers sont rejetés.
- Les services sont privés d'accès aux disques Windows et aux dossiers personnels ; les consignes de Michel sont en
  lecture seule pour le gateway. Ce durcissement n'est pas une machine virtuelle : Windows et les administrateurs
  WSL gardent le contrôle.
- Michel Vérifie et Michel Construit exécutent leurs commandes dans un bac à sable Docker (pas de réseau, racine en
  lecture seule, aucun privilège) ; un agent ne peut pas modifier sa propre configuration.
- Transcription et synthèse vocales restent locales (sauf option OpenAI). Ce que vous dites, et la mémoire utile à la
  réponse, est envoyé à OpenAI ou à Anthropic. Les rapports d'évaluation versionnés masquent le contenu privé.

## Licences et composants tiers

| Composant | Usage | Licence |
|---|---|---|
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) et modèles Whisper d'OpenAI | reconnaissance vocale | MIT |
| [Supertonic 3](https://huggingface.co/Supertone/supertonic-3) (Supertone) | synthèse vocale | modèle OpenRAIL-M (restrictions d'usage), code MIT |
| [Piper](https://github.com/OHF-Voice/piper1-gpl) (`piper-tts`) et ses voix françaises (siwis, tom, upmc) | voix de secours | GPL-3.0-or-later ; voir la fiche de chaque voix |
| [Silero VAD](https://github.com/snakers4/silero-vad) via [`@ricky0123/vad-web`](https://github.com/ricky0123/vad), ONNX Runtime Web | détection de voix dans le navigateur | MIT (Silero, ONNX Runtime), ISC (vad-web) |
| [Puppeteer](https://github.com/puppeteer/puppeteer) (`puppeteer-core`) | fenêtres navigateur | Apache-2.0 |
| [num2words](https://github.com/savoirfairelinux/num2words) | nombres en lettres | LGPL-2.1 |
| Mascotte OpenClaw (`openclaw/openclaw`, `ui/public/favicon.svg`) | emblème, redessiné | MIT |
| [mkcert](https://github.com/FiloSottile/mkcert) | certificats locaux | BSD-3-Clause |

Michel est un logiciel libre, sous **GNU General Public License v3.0 ou ultérieure** ([LICENSE](LICENSE)). La GPL a
été choisie parce que le service de synthèse vocale utilise le paquet `piper-tts` (GPL-3.0) ; les composants
ci-dessus gardent leurs propres licences. Projet d'origine :
[proxydis/openclaw-vocal-assistants](https://github.com/proxydis/openclaw-vocal-assistants).
