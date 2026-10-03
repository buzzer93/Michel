# Journal de recoupement — Agentic OS

Recherche effectuée le 30 septembre 2026. Les identifiants correspondent au guide et au fichier sources_agentic_os.csv.

## Parcours réellement suivis

| Départ | Lien suivi | Prolongement ou vérification |
| --- | --- | --- |
| S01 MindStudio | Documentation Anthropic redirigée vers Claude Code, S23 | Documentation skills S11, puis standard Agent Skills S12 et son index |
| S03 Acumentica | Decision Control OS, S22 | Comparaison avec un mécanisme exécutable de politique, OPA S32 |
| S04 StackGen | Documentation S34 | Aucun texte exploitable ; seules les annonces de S04 sont rapportées |
| S05 SDLC Corp | Article pédagogique ReAct S35 | Recherche et lecture de la publication originale S31 |
| S06 EM360Tech | garak S26, PyRIT S27, NeMo Guardrails S28, ressources OWASP | Page OWASP S18, puis PDF de 57 pages et présentation ACS S19 |
| S08 AI Profit Boardroom | Article mémoire Obsidian S20 | Conditions officielles Obsidian S21 |
| S10 Anthropic | Article Managed Agents S13 | Séparation session, harness et environnement d’exécution |

Les autres références techniques ont été recherchées directement pour confirmer un mécanisme ou résoudre une ambiguïté. Les branches commerciales, menus et inscriptions ne sont pas explorés systématiquement. Les vidéos ne sont pas transcrites. Les neuf liens initiaux ont été ouverts, sans prétendre avoir suivi tous leurs liens sortants.

## Matrice des affirmations

| Question examinée | Origine | Recoupement | Verdict et incidence |
| --- | --- | --- | --- |
| Existe-t-il une définition unique d’Agentic OS dans ce corpus ? | S01–S09 | Comparaison des périmètres présentés | Non : interface personnelle, fonctionnement métier, infrastructure et gouvernance sont mélangés. Définition de travail explicitée dans le guide. |
| Une skill est-elle intrinsèquement une fonction typée ? | S01 | S11, S12 | Non : distinguer instructions procédurales et contrats des outils. |
| Persister de la mémoire démontre-t-il une amélioration automatique ? | S02 | S17, S25 | Non démontré. L’amélioration doit être évaluée et les changements contrôlés. |
| Un workflow peut-il contenir des décisions agentiques ? | Opposition générale de S02 | S10, S30 | Oui : la documentation n8n décrit un agent utilisant des outils. |
| L’usage gratuit d’Obsidian signifie-t-il que son application est open source ? | S08, S20 | S21 | Non. La gratuité d’usage, la portabilité des données et la licence du code sont distinctes. |
| Le fonctionnement local garantit-il la sécurité ? | S08 | S15, S18 | Non : les permissions, documents et composants restent des surfaces de risque. |
| La gouvernance assure-t-elle l’absence de dérive ? | S03, S07, S22 | S18, S32 | Aucune garantie universelle établie. Exiger des contrôles et des tests précis. |
| Les reprises évitent-elles les doublons ? | Question d’architecture | S29, S33 | Non à elles seules. Clés d’opérations et réconciliation des effets externes nécessaires. |
| Le classement sécurité compare-t-il des produits équivalents ? | S06 | S26, S27, S28, S18 | Non : scanners, contrôles à l’exécution et référentiels répondent à des besoins différents. |
| Le ROI de 60–90 jours est-il généralisable ? | S02 | Recherche dans les éléments consultés | Non établi par des preuves indépendantes suffisantes. Aucun chiffrage commercial repris. |
| Les capacités d’Aiden sont-elles validées ici par un essai ? | S04 | S34 non exploitable | Non : annonces de l’éditeur uniquement, pas un benchmark. |
| Un RAG est-il une base transactionnelle ? | Question d’architecture | Distinction de stockage dans S17, contexte S24 | Non. Les décisions et reçus restent dans un stockage faisant autorité. |

## Limites d’accès et de preuve

- S34 : documentation StackGen ouverte mais extraction sans texte. L’absence de texte dans cet outil ne signifie pas que la documentation n’existe pas.
- Ancienne entrée https://docs.n8n.io/advanced-ai/ : page introuvable. La page précise Tools AI Agent S30 a ensuite été ouverte.
- Ancienne adresse de licence dans l’aide Obsidian : erreur d’accès. La page officielle S21 a été utilisée à la place.
- S19 : page de présentation ouverte ; le contenu complet du standard ACS n’a pas été analysé.
- S18 : lecture ciblée du référentiel et de passages de son PDF, sans validation indépendante de tous les incidents qu’il mentionne.
- Aucun logiciel installé, aucun compte membre utilisé, aucune promesse de performance reproduite expérimentalement.
- Les dates de crawl renvoyées par la recherche ne sont pas utilisées comme dates de publication.
- Le registre contient plusieurs documents d’un même éditeur et des étapes de navigation. Il ne représente pas 35 sources indépendantes confirmant chaque conclusion.

## Réutiliser cette recherche

Le CSV contient les métadonnées et les URLs ; le guide fournit une synthèse originale avec des renvois aux sources. Ce dossier ne contient pas de copie intégrale des articles. Pour construire un corpus interne reproductible, ajouter à une future collecte autorisée la date exacte d’extraction, la version ou empreinte du contenu, les conditions d’accès et les passages nécessaires à chaque affirmation.

Les recommandations et schémas du guide sont des propositions de conception. Les critères numériques illustratifs, le modèle de données et les endpoints ne proviennent pas d’une spécification d’Agentic OS universelle.
