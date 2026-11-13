# Chasseur de fantôme (titre de travail)

FPS solo réaliste dans une maison hantée, navigateur (Three.js + Rapier + TypeScript + Vite). Design approuvé : `docs/superpowers/specs/2026-11-13-chasseur-de-fantome-design.md`. Skills du projet : `.claude/skills/` (provenance dans `SOURCES.md`).

## Règle permanente : annoncer chaque tâche avant de la lancer

Avant de commencer toute nouvelle tâche, donne toujours ces trois informations, puis attends que l'utilisateur confirme (il change de modèle si besoin) :

1. **Ce qu'elle fait** : une à deux phrases.
2. **Difficulté** : Faible, Moyenne, Élevée ou Très élevée, avec la raison en une ligne.
3. **Modèle conseillé** : parmi ceux dont dispose l'utilisateur.

Ne lance rien (code, installation, écriture de plan) avant son feu vert. Une réponse de l'utilisateur comme « go » ou « fais-le » vaut feu vert ; un simple « ok » à une proposition de plusieurs tâches demande de préciser laquelle.

Quand une tâche est découpée en sous-tâches, annonce chaque sous-tâche de la même façon si elle change de difficulté.

## Modèles disponibles

- Haiku : tâches simples et mécaniques (renommer, formater, copier).
- Sonnet : exécution d'un plan clair, câblage, tests.
- Opus : tâches qui demandent du jugement (IA, ressenti, assets).
- **Fable 5.2 : disponible jusqu'au lundi 16 novembre 2026 seulement.** À réserver aux tâches qui décident le plus (plan d'implémentation, IA du fantôme, architecture). Après cette date, l'équivalent est Opus.

Règle de choix : le modèle le plus fort pour les tâches qui décident, un modèle moyen pour celles qui exécutent un plan.

## Préférences de l'utilisateur

- Langue : français.
- Niveau de programmation : débutant. Il délègue le code mais veut que j'explique chaque choix important en quelques lignes.
- Réponses directes, sans flatterie. Signaler les erreurs de raisonnement et donner un niveau de confiance sur les affirmations incertaines.
- Pour les questions de décision, utiliser l'outil de questions à choix plutôt que demander de répondre dans le texte.
- Chaque tâche concrète se termine par des actions précises : quoi faire, dans quel ordre, comment vérifier que ça marche.

## Contraintes techniques

- Pas de moteur natif ni de Blender en local. Blender est piloté à distance via le module Higgsfield « 3D Jutsu » (Python, export GLB). Coût en crédits à vérifier avant toute production d'assets.
- Le site skills.sh est bloqué par le réseau de l'environnement cloud : `npx skills find` ne renvoie rien.
- Machine cible : RTX 5070. Éclairage de la maison pré-calculé dans Blender, dynamique limité à la lampe torche.
- Un commit se termine par les lignes d'attribution demandées par l'environnement. Ne jamais créer de pull request sans demande explicite.
