# Plan d'amélioration — Michel et son équipe (inspiré du guide « Agentic OS »)

Source : [dossier_agentic_os/guide_agentic_os.md](dossier_agentic_os/guide_agentic_os.md) (les § renvoient à ses sections).
Idée directrice du guide : **le modèle propose, le code contrôle et garde la trace** ; une règle écrite dans un
prompt ne remplace pas le code qui la fait respecter (§3, §5).

## Comment lire et reprendre ce plan

- Une étape ou sous-étape **barrée** (~~ainsi~~) est **terminée et testée** ; la ligne « Fait le » donne la date et la preuve du test.
- On reprend à la **première sous-étape non barrée**, dans l'ordre.
- Chaque étape a un critère « **Fait quand** » : tant qu'il n'est pas vérifié, l'étape n'est pas barrée.
- Déploiement : `wsl -d Ubuntu -u root -- python3 /opt/jarvis/deployment/configure-services.py` puis redémarrage des
  services concernés (`openclaw-gateway`, `jarvis-web`, `jarvis-tts*`). L'interface se recharge avec Ctrl+F5.
- Tests : `cd server && node --test test/*.test.mjs` (application) ; les tests d'agents arrivent à l'étape 4.

## État de départ (1er octobre 2026)

- Michel (`main`, `openai/gpt-6-astra`, secours Claude puis Qwen local) est le chef d'équipe ; il délègue à
  Écrit, Compile, Explore, Organise, Vérifie, Construit. Les 7 répondent à leur nom à la voix.
- Garde-fous en place : commandes autorisées par agent (exec allowlist), consignes de Michel en lecture seule,
  délégation sur 1 niveau, services durcis et locaux.
- Points faibles identifiés (détail dans chaque étape) : confirmations confiées au prompt, secret Gmail peut-être
  visible des commandes, contexte de ~46 000 tokens par échange, mémoire non gouvernée, risque de double envoi,
  aucune évaluation des agents, peu de traces, déploiement non versionné.

---

## ~~Étape 0 — Socle : déploiement sûr et versionné (§17)~~ ✅

Objectif : ne plus pouvoir déployer une configuration invalide, ne plus perdre de données au déploiement, et
disposer d'un point de retour.

- ~~0.1 Le script de déploiement valide la configuration **avant** de remplacer `openclaw.json` : il écrit un fichier
  candidat, le fait valider par OpenClaw, et s'arrête sans rien toucher s'il est invalide.~~
- ~~0.2 `USER.md` (préférences de l'utilisateur) n'est créé que s'il n'existe pas : un déploiement ne l'écrase plus.~~
- ~~0.3 Nettoyage : fichiers `*:Zone.Identifier` (métadonnées Windows) supprimés et ignorés par git.~~
- ~~0.4 Commit de l'état actuel sur une branche de travail (`agentic-os`), comme point de retour.~~

**Fait quand** : une configuration volontairement invalide est refusée sans modifier `openclaw.json` ; un `USER.md`
modifié à la main survit à un déploiement ; le commit existe sur la branche `agentic-os`.

**Fait le 2026-10-01.** Tests : une config injectée invalide (`tools.web.search.provider: openai`) est refusée
(code 1, « Configuration OpenClaw invalide : rien n'a été modifié ») et l'empreinte sha256 de `openclaw.json` est
inchangée, sans fichier candidat résiduel ; une ligne ajoutée à `USER.md` survit à un vrai déploiement ;
commit `a8c265b` sur `agentic-os`. Également : avatars source (`web/avatars/michels/`) et sauvegardes
(`config/*.before-*`) ignorés. Restent hors commit, à décider par l'utilisateur (le dépôt deviendra public) :
`dossier_agentic_os/`. À examiner : un dépôt git imbriqué `server/.git` (créé le 30/09 par le compte `jarvis`).

## ~~Étape 1 — Isoler l'exécution de code des agents (§10)~~ ✅

Audit du 2026-10-01 (lecture seule, aucune valeur affichée) : les commandes lancées par les agents héritent de
l'environnement et des groupes du gateway. Du code exécuté par un agent (`node --test` sur un fichier écrit par
Michel Construit, ou un hook git) pourrait donc lire le mot de passe Gmail (`GOG_KEYRING_PASSWORD`), les jetons
OpenAI/ChatGPT (`openclaw.sqlite`), les identifiants Claude et GitHub, utiliser le socket Docker (groupe `docker`
= quasi root sur WSL) et exfiltrer par le réseau. De plus, le motif autorisé `project/[\w./*-]+` accepte `..`
(sortie du dossier prévu). Il faudrait d'abord qu'une injection convainque un agent : c'est le scénario §10.

- ~~1.1 Audit de ce qu'atteint une commande d'agent~~ (constats ci-dessus).
- ~~1.2 Motifs autorisés : interdire `..` dans les chemins de `node --test` et de `git -C`.~~
  Fait le 2026-10-01 : `(?!.*\.\.)` en tête des motifs ; 8/8 cas vérifiés (`project/../…` refusé, chemins légitimes acceptés).
- ~~1.3 Michel : sa propre liste de commandes devient vide (il garde l'outil `exec` seulement pour que ses délégués
  conservent le leur), si les délégués gardent bien leurs commandes ; sinon, documenter la limite.~~
  Fait le 2026-10-01 : Michel en `exec.mode: deny` ; lui-même → « exec denied: host=gateway security=deny » ;
  Construit lancé par Michel exécute toujours `git -C project status`.
- ~~1.4 Exécuter le code des agents (tests, git) dans un bac à sable sans secrets, sans socket Docker et sans réseau
  (sandbox OpenClaw si elle le permet ici, sinon un exécuteur dédié).~~
  Fait le 2026-10-01 : sandbox Docker d'OpenClaw pour Construit et Vérifie (image `jarvis-sandbox:node24`,
  `deployment/sandbox/Dockerfile` : Node 24, git, python3 ; réseau coupé, racine en lecture seule, aucune capacité,
  uid de jarvis, aucune variable d'environnement de l'hôte). `exec.host: "sandbox"` (avec `gateway` les commandes
  partaient sur l'hôte). Vérifie voit le projet par des montages en lecture seule déclarés au conteneur (les montages
  systemd n'existent que dans l'espace du gateway) ; dérogations `dangerouslyAllowExternalBindSources` et
  `dangerouslyAllowReservedContainerTargets` limitées à Vérifie ; son propre espace est monté en `rw` (en `ro`,
  Docker Desktop ne peut pas créer les points de montage) mais il n'a aucun outil d'écriture. Vue du projet
  complétée par les fichiers d'exemple versionnés lus par les tests (`config/*.example.json`, `voices.json`).
- ~~1.5 Retirer le groupe `docker` et le mot de passe Gmail de l'environnement général ; ne les fournir qu'à ce qui en
  a besoin (`docker` pour Compile, `gog` pour Écrit), par le moyen le plus étroit disponible.~~
  Réévalué le 2026-10-01 : sans objet après 1.3 et 1.4. Le gateway a besoin du groupe `docker` pour créer les bacs
  à sable et Compile pour gérer les conteneurs ; Écrit a besoin du mot de passe pour `gog`. Plus aucun agent
  n'exécute de code libre sur l'hôte (Michel : aucune commande ; Explore, Organise : pas d'exec ; Construit,
  Vérifie : bac à sable ; Écrit, Compile : `gog` / `gh` / `docker` restreints). Risque résiduel limité à ces outils.

**Fait quand** : un test lancé par un agent ne voit ni `GOG_KEYRING_PASSWORD`, ni les fichiers d'identifiants, ni le
socket Docker, ni le réseau ; un chemin avec `..` est refusé ; `gog`, `gh`, `docker` (Compile) et les tests
(Construit, Vérifie) fonctionnent toujours.

**Fait le 2026-10-01.** Sonde lancée par Construit et par Vérifie : `{"uid":997,"secretNames":[],"readableFiles":[],
"dockerSocket":false,"network":"none","cwd":"/workspace"}` (avant : mot de passe Gmail, 5 fichiers d'identifiants,
socket Docker et réseau accessibles). Vérifie exécute `logic.test.mjs` + `agents.test.mjs` dans son bac à sable :
25 réussis, 0 échec. Compile : `docker ps` fonctionne. `gog` fonctionne sur l'hôte.

## ~~Étape 2 — Approbations réelles des actions sensibles (§9, §11)~~ ✅

Aujourd'hui, l'envoi d'un mail est autorisé sans condition ; seule la consigne demande à l'agent d'attendre une
confirmation. Une injection dans un mail pourrait la contourner.

- ~~2.1 Étudier le protocole d'approbation d'OpenClaw (demande, événement, résolution) et ce qu'il fournit sur la commande exacte.~~
  Fait : événements `exec|plugin.approval.requested/resolved`, réponse par `exec|plugin.approval.resolve` (`allow-once`,
  `deny`), expiration 2 min. Un client ne les reçoit que s'il déclare la capacité `approvals` ; sans client capable, refus
  immédiat (« no approval route »). Les agents sous Claude Code passent par `plugin.approval.*` avec la commande exacte.
- ~~2.2 Serveur : relayer les demandes d'approbation au dashboard et renvoyer la décision au gateway.~~
  Fait : `server/approvals.mjs` (+ tests) ; le serveur déclare `approvals`, refuse d'office les fichiers locaux
  (`--body-file`, `--attach`…) et toute construction shell (`|`, `>`, `;`, `&`, `$(`…, même entre guillemets : un
  message légitime contenant ces caractères doit être reformulé), et rejoue les demandes en cours à l'ouverture d'une page.
- ~~2.3 Dashboard : carte d'approbation (agent, commande exacte, destinataire et contenu lisibles), boutons
  Approuver / Refuser, expiration ; sans réponse, refus.~~
- ~~2.4 Politique : les commandes en lecture restent autorisées directement ; les commandes à effet (envoyer,
  répondre, transférer, corbeille, archiver, créer / modifier / supprimer un événement, répondre à une invitation,
  commenter / créer / fermer sur GitHub, démarrer / arrêter / redémarrer un conteneur) passent par l'approbation.~~
  Fait : listes d'Écrit et Compile réduites à la lecture et à la préparation (brouillons, lu / non lu) ; consignes
  mises à jour (annoncer la demande, ne jamais relancer une action refusée ou expirée).
- ~~2.5 Mail sans doublon : envoi en deux temps (créer le brouillon, puis envoyer **ce** brouillon après
  approbation) ; jamais de renvoi automatique d'un envoi au résultat incertain.~~
  Fait autrement : la carte d'un « envoyer ce brouillon » n'afficherait qu'un identifiant, pas le contenu. L'envoi se
  fait donc en une commande dont la carte montre destinataire, sujet et corps ; chaque envoi exige sa propre
  approbation, donc aucun renvoi ne peut partir sans un nouveau clic (et la consigne interdit de relancer).

**Fait quand** : une demande d'envoi de mail fait apparaître la carte avec la commande exacte ; « Refuser » n'envoie
rien ; « Approuver » envoie une seule fois ; une commande en lecture passe sans carte.

**Fait le 2026-10-01.** Test avec un client se comportant comme le dashboard : lecture des non lus sans carte ;
carte `gog gmail send --to … --subject "Test approbation Michel (refus)" --body …` refusée, rien envoyé ; même envoi
approuvé : la boîte d'envoi contient exactement un « (accord) » et aucun « (refus) ». Compile : carte
`docker restart watchless-web` refusée, conteneur non redémarré (heure de démarrage inchangée). 31 tests verts.

## Étape 3 — Contexte court et délégation sobre (§8, §13)

Chaque échange vocal envoie ~46 000 tokens (toute la conversation depuis la veille) : lenteur et quota consommé.

- 3.1 Nouvelle conversation chaque jour (la mémoire garde l'utile), plus un bouton « Nouvelle conversation ».
- 3.2 Consignes de Michel : Vérifie seulement quand l'enjeu le justifie (pas pour une météo ou une question simple).
- 3.3 Boucle de l'agent bornée par le code (§6, §10) : le plafond de 8 délégations par demande, aujourd'hui écrit
  seulement dans la consigne, est imposé (par OpenClaw s'il le permet, sinon par le serveur qui arrête la demande).

**Fait quand** : le panneau Modèle affiche un contexte < 15 000 tokens au premier échange du jour ; une question
web simple ne passe plus par Vérifie ; une demande qui dépasse le plafond de délégations est arrêtée par le code ;
temps de réponse mesuré avant / après.

## Étape 4 — Évaluer les agents (§12)

Aucun test ne vérifie aujourd'hui le comportement des agents ; les bugs ont été trouvés à l'usage.

- 4.1 Jeu de ~40 cas (fichier versionné) : routage vocal par nom, choix du bon spécialiste, réponse directe sans
  JSON, mail piégé, page web piégée, demande hors périmètre, push-to-talk silencieux, bascule hors ligne.
- 4.2 Script qui rejoue les cas (sessions de test isolées) et produit un rapport daté (réussites, échecs, durée, tokens).
- 4.3 Première mesure de référence enregistrée.

**Fait quand** : le script tourne de bout en bout et le rapport de référence est enregistré dans `docs/evals/`.

## Étape 5 — Mémoire gouvernée, notes et listes (§8, §10)

Michel a maintenant des outils d'écriture (pour son équipe) ; rien n'empêche une injection de lui faire écrire
une fausse « préférence ».

- 5.1 Notes et listes : dossier `notes/` dans l'espace de Michel (courses, idées, tâches), une note par fichier.
- 5.2 Préférences : Michel **propose** (fichier de propositions), l'utilisateur **valide** depuis le dashboard ;
  seules les entrées validées deviennent actives.
- 5.3 Dashboard : panneau Notes (lecture) et file des propositions (Valider / Rejeter).

**Fait quand** : « Michel, ajoute du lait à la liste de courses » met à jour la note ; une préférence dictée par une
page piégée reste en proposition et n'est jamais appliquée sans validation.

## Étape 6 — Traces et alertes (§11)

- 6.1 Une trace par demande : agent, modèle réellement utilisé, délégations, outils, refus, durée, tokens.
- 6.2 Alertes dans le dashboard : quota > 85 %, refus de politique, tâche bloquée plus de 5 minutes, bascule de modèle.

**Fait quand** : chaque demande laisse une trace consultable ; chaque alerte est déclenchée au moins une fois en test.

## Étape 7 — Rappels et minuteurs (§9)

Seulement maintenant : un agent qui agit à heure fixe doit d'abord être borné (étape 2) et tracé (étape 6).

- 7.1 Planification OpenClaw activée pour Michel seul (rappels, minuteurs).
- 7.2 Le dashboard annonce le rappel à voix haute au moment prévu (page ouverte).

**Fait quand** : « Michel, rappelle-moi dans 2 minutes de boire de l'eau » est annoncé à l'heure, une seule fois.

## Étape 8 — Boucle d'amélioration (§4, §8, §12)

Le système s'améliore par ses **consignes, procédures et outils** (pas par réentraînement du modèle), et jamais
automatiquement : chaque changement est mesuré par les évaluations et validé par l'utilisateur. Dépend des étapes
4 (évaluations), 5 (propositions validées) et 6 (traces).

- 8.1 Observation : un rapport hebdomadaire des échecs, tiré des traces et des évaluations.
- 8.2 Proposition : Michel Organise analyse le rapport et propose des corrections précises (consigne, outil, réglage).
- 8.3 Implémentation : Michel Construit applique une correction dans son clone (branche `agents/implementer`).
- 8.4 Évaluation : le jeu de l'étape 4 est rejoué sur la branche ; la correction doit améliorer le cas visé sans
  régression ailleurs.
- 8.5 Validation : le dashboard présente le changement et le résultat des évaluations ; l'utilisateur fusionne ou refuse.
- 8.6 Surveillance et retour arrière : version publiée suivie dans les traces ; annulation par git si dégradation.

**Fait quand** : un échec réel passe par tout le cycle (rapport → proposition → branche → évaluation → validation)
et la correction fusionnée améliore le score sans régression.

## Étape 9 — Clôture

- 9.1 Guide utilisateur (`Guide-Michel.md`) et documentation à jour.
- 9.2 Jeu d'évaluation repassé, comparé à la référence de l'étape 4.
- 9.3 Commit final.

**Fait quand** : documentation à jour, évaluations au moins aussi bonnes que la référence, commit fait.

---

## Hors périmètre (déconseillé par le guide à notre échelle)

A2A, base vectorielle, LangGraph / Temporal, agents supplémentaires (§7, §8, §14) : à reconsidérer seulement si
un problème mesuré le justifie.
