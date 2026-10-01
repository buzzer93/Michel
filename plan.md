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

## Étape 0 — Socle : déploiement sûr et versionné (§17)

Objectif : ne plus pouvoir déployer une configuration invalide, ne plus perdre de données au déploiement, et
disposer d'un point de retour.

- 0.1 Le script de déploiement valide la configuration **avant** de remplacer `openclaw.json` : il écrit un fichier
  candidat, le fait valider par OpenClaw, et s'arrête sans rien toucher s'il est invalide.
- 0.2 `USER.md` (préférences de l'utilisateur) n'est créé que s'il n'existe pas : un déploiement ne l'écrase plus.
- 0.3 Nettoyage : fichiers `*:Zone.Identifier` (métadonnées Windows) supprimés et ignorés par git.
- 0.4 Commit de l'état actuel sur une branche de travail (`agentic-os`), comme point de retour.

**Fait quand** : une configuration volontairement invalide est refusée sans modifier `openclaw.json` ; un `USER.md`
modifié à la main survit à un déploiement ; le commit existe sur la branche `agentic-os`.

## Étape 1 — Secrets hors de portée des commandes d'agents (§10)

Le mot de passe du trousseau Gmail (`GOG_KEYRING_PASSWORD`) est chargé dans l'environnement du gateway. S'il est
hérité par les commandes que lancent les agents, un test écrit par Michel Construit pourrait l'afficher, et il
partirait chez OpenAI.

- 1.1 Vérifier ce qu'hérite une commande lancée par un agent (présence de la variable, sans jamais afficher sa valeur).
- 1.2 Si elle est héritée : ne fournir le secret qu'à `gog` (et le jeton GitHub qu'à `gh`), plus à l'environnement général.

**Fait quand** : une commande d'agent (`node --test`) ne voit aucune variable secrète, et `gog` / `gh` fonctionnent toujours.

## Étape 2 — Approbations réelles des actions sensibles (§9, §11)

Aujourd'hui, l'envoi d'un mail est autorisé sans condition ; seule la consigne demande à l'agent d'attendre une
confirmation. Une injection dans un mail pourrait la contourner.

- 2.1 Étudier le protocole d'approbation d'OpenClaw (demande, événement, résolution) et ce qu'il fournit sur la commande exacte.
- 2.2 Serveur : relayer les demandes d'approbation au dashboard et renvoyer la décision au gateway.
- 2.3 Dashboard : carte d'approbation (agent, commande exacte, destinataire et contenu lisibles), boutons
  Approuver / Refuser, expiration ; sans réponse, refus.
- 2.4 Politique : les commandes en lecture restent autorisées directement ; les commandes à effet (envoyer,
  répondre, transférer, corbeille, archiver, créer / modifier / supprimer un événement, répondre à une invitation,
  commenter / créer / fermer sur GitHub, démarrer / arrêter / redémarrer un conteneur) passent par l'approbation.
- 2.5 Mail sans doublon : envoi en deux temps (créer le brouillon, puis envoyer **ce** brouillon après
  approbation) ; jamais de renvoi automatique d'un envoi au résultat incertain.

**Fait quand** : une demande d'envoi de mail fait apparaître la carte avec la commande exacte ; « Refuser » n'envoie
rien ; « Approuver » envoie une seule fois ; une commande en lecture passe sans carte.

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
