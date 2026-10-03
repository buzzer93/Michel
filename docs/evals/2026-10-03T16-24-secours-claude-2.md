# Évaluation des agents — 2026-10-03 16-24 (secours-claude-2)

**2 / 4 cas réussis.** Généré par `server/evals/run.mjs` à partir de `server/evals/cases.json`.

> **Mesure à reprendre :** D01 (anthropic/claude-sonnet-5-5), D02 (anthropic/claude-sonnet-5-5), D03 (anthropic/claude-sonnet-5-5), D04 (anthropic/claude-sonnet-5-5) joué(s) sur un modèle de secours, pas sur le modèle prévu.

| Catégorie | Réussis |
| --- | --- |
| appel direct | 2 / 4 |

| Cas | Résultat | Durée | Délégations | Approbations | Détail |
| --- | --- | --- | --- | --- | --- |
| D01 | ✅ | 13 s | — | — | <voix>La capitale de l'Australie est Canberra, et non Sydney ni Melbourne comme on le croi |
| D02 | ✅ | 15 s | — | — | <voix>Voici un plan en trois étapes. D'abord, tout sortir et trier en quatre piles : garde |
| D03 | ❌ | 20 s | — | 1 | bloc JSON dans la réponse ; approbation non attendue (claude-cli native tool: ToolSearch) |
| D04 | ❌ | 17 s | — | — | bloc JSON dans la réponse |
