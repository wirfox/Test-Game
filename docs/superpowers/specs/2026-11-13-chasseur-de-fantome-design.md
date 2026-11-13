# Chasseur de fantôme — Design (titre de travail)

Date : 2026-11-13 · Statut : en attente d'approbation

## Intention et pourquoi
Projet perso, plaisir. Un FPS solo réaliste dans une maison hantée. Il démarre exactement comme Phasmophobia (enquête, peur, joueur faible) puis bascule : le joueur trouve une arme lourde et devient le chasseur. Le fantôme se cache, fuit et tend des embuscades. L'originalité du jeu repose sur ce renversement proie → prédateur.

## Buts
- Une partie unique de 20 à 30 minutes, complète (début, pivot, chasse, fin).
- Rendu réaliste crédible sur une RTX 5070, navigateur.
- Un fantôme dont le comportement de cache-cache reste tendu et amusant.
- Rejouable : maison/arme/fantôme variables à terme.

## Non-buts (première version)
- Multijoueur et chat vocal (architecture préparée, rien d'implémenté).
- Campagne multi-maisons, roguelike, progression entre parties.
- Identification d'un type de fantôme par preuves multiples (le cœur d'enquête de Phasmophobia) au-delà de ce qu'exige l'acte 1.

## Anti-buts (échec même si ça fonctionne techniquement)
- Le pivot arrive sans tension, ou le fantôme cesse de faire peur dès que le joueur est armé.
- Un fantôme qui se cache de façon ennuyeuse (introuvable) ou frustrante (fuite perpétuelle).
- Un rendu « réaliste » qui rame ou paraît générique.

## Contraintes
- Plateforme : Three.js dans le navigateur, testable par moi avec Chromium. Node 22 disponible ; ni Blender ni moteur natif en local.
- Assets 3D : Blender 5.2 distant via le module Higgsfield « 3D Jutsu » (Python/bpy, export GLB). Coût en crédits inconnu. Les shaders procéduraux Blender peuvent se dégrader à l'export GLB.
- Machine cible : RTX 5070.
- L'utilisateur délègue le code et veut des explications courtes sur les choix importants.

## Approches considérées
1. **Three.js + Rapier + TypeScript/Vite** — contrôle total, léger, plus de code à assembler. **Retenue.**
2. Babylon.js — plus d'outils intégrés, moins de ressources pour le réalisme poussé. Écartée.
3. Prototype d'une pièce avant la maison entière — retenue en complément de 1.

## Décisions de l'utilisateur
- Solo d'abord. Réaliste. Partie unique 20-30 min.
- Pivot : arme lourde trouvée au hasard (tiroir, sol, n'importe où) ; ensuite le joueur chasse.
- Fantôme après le pivot : cache-cache + embuscades.
- Combat : le fantôme doit d'abord être révélé (lumière, objet ou son) avant de pouvoir le toucher.
- Défaite : barre de santé et sanité mentale (la sanité basse déclenche des hallucinations).
- Assets via le connecteur Blender.

## Mes calls (à valider)
- Architecture : Three.js + Rapier (physique) + TypeScript + Vite. Audio spatial via Web Audio.
- Éclairage : lumière de la maison pré-calculée (baked) dans Blender, dynamique limitée à la lampe torche et quelques sources.
- Le placement de l'arme est aléatoire en apparence mais contrôlé par le jeu (zone et timing), pour garantir un pivot réussi.
- Après le pivot, le fantôme reste dangereux (il peut blesser et frapper en embuscade) pour préserver la peur.
- IA du fantôme : machine à états (patrouille, cache, embuscade, fuite, blessé) avec une carte de points de cache ; réglage par paramètres.
- Format d'assets : maison modulaire (murs, sols, portes, meubles) exportée en GLB, plutôt qu'un seul gros fichier.

## Plan de livraison (haut niveau, détaillé dans le plan d'implémentation)
1. Prototype : une pièce, FPS (déplacement, souris, lampe torche, collisions), un événement fantôme, un son.
2. Pivot : trouvaille de l'arme, tir, révélation du fantôme.
3. IA de chasse : cache-cache, embuscades, santé et sanité.
4. Maison complète et variété.
5. Finition : audio, UI, performance.

Critère de réussite du prototype : marcher dans la pièce et ressentir de la tension dans les 5 premières minutes.

## Laissé au constructeur
- Choix des bibliothèques annexes (chargement GLB, post-traitement, UI).
- Détails de réglage de l'IA et des courbes de sanité.
- Structure exacte des fichiers et des tests.

## Points ouverts
- Coût en crédits du Blender distant : à vérifier avant la production d'assets.
- Fiabilité de l'export GLB (matériaux, bake d'éclairage) : à valider dès le prototype.
