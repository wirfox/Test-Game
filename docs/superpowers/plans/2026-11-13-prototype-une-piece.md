# Prototype « une pièce » — Plan d'implémentation

> **Pour les agents exécutants :** SOUS-SKILL REQUIS : superpowers:subagent-driven-development ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases `- [ ]`. Avant chaque tâche, appliquer la règle de `CLAUDE.md` (annoncer ce qu'elle fait, sa difficulté, le modèle conseillé, puis attendre le feu vert).

**But :** un prototype jouable dans le navigateur où le joueur marche en vue FPS dans une pièce sombre avec une lampe torche, rétablit le courant, et subit une séquence de hantise qui crée de la tension en moins de 5 minutes.

**Architecture :** simulation à pas fixe (60 Hz) séparée du rendu. La logique de jeu (mouvement, hantise, synthèse audio) vit dans des modules purs sans WebGL, testés avec Vitest. Three.js, Rapier et Web Audio sont des « présentateurs » qui réagissent à un bus d'événements typé. La pièce est décrite par des données ; ses collisions restent des primitives même quand les visuels viendront de Blender.

**Tech stack :** TypeScript 6, Vite 8, three 0.187.0 (WebGLRenderer), @dimforge/rapier3d-compat 0.21.0, lil-gui, Vitest 5, @playwright/test 1.63.0 (version exacte, celle du Chromium préinstallé).

**Spec :** `docs/superpowers/specs/2026-11-13-chasseur-de-fantome-design.md`

## Contraintes globales

- Navigateur uniquement, cible RTX 5070, 60 FPS minimum. Budget du prototype : moins de 300 draw calls, GLB total sous 5 Mo.
- Tout aléatoire de gameplay passe par le RNG à graine du squelette (`createSeededRandom`), jamais `Math.random`.
- Touches lues par position physique (`KeyboardEvent.code`) : l'utilisateur a un clavier AZERTY, `KeyW` correspond donc à sa touche Z.
- Collisions sur primitives Rapier uniquement, jamais sur les maillages visuels.
- Textes à l'écran en français. Identifiants de code en anglais.
- Aucun secret, aucune clé d'API dans le dépôt. Aucune dépense de crédits Higgsfield sans accord explicite de l'utilisateur.
- Hors périmètre de ce plan (étapes 2 à 5 du design) : arme, tir, IA de chasse, santé, sanité mentale, maison complète. Ne pas les amorcer.
- Skills à charger selon la tâche : `threejs-gameplay-systems`, `threejs-fundamentals`, `threejs-lighting`, `physics-tuning`, `audio-design`, `game-feel`, `threejs-qa-release`, `threejs-loaders`, `threejs-asset-pipeline`.

## Mes choix (au-delà du design approuvé)

1. **Objectif minimal : rétablir le courant.** Un tableau électrique au fond de la pièce donne une raison d'avancer et déclenche le final. Sans objectif, pas de tension mesurable.
2. **Trois événements de hantise au lieu d'un :** coups dans les murs, clignotement de la lampe, puis apparition. Le design dit « un événement » ; deux précurseurs peu coûteux sont nécessaires pour que l'apparition fasse peur.
3. **Tous les sons sont synthétisés par code.** Aucun fichier audio, aucune dépendance.
4. **La pièce du prototype est en primitives.** Le pipeline Blender est validé en dernière tâche, sur un seul objet, après vérification du coût.
5. **WebGL plutôt que WebGPU** : plus stable, lightmaps pré-calculées bien prises en charge.

## Points de vigilance (Review Focus)

Conditions que le design n'évoque pas et qui toucheront un joueur réel. Chacune a son test dans la tâche indiquée.

1. **Onglet en arrière-plan ou image très longue** : au retour, le joueur ne traverse aucun mur et les minuteries de hantise ne sautent pas (T2 `FixedStep` plafonne à 6 pas).
2. **Verrouillage du pointeur refusé ou quitté avec Échap** : le jeu passe en pause avec un écran « Cliquer pour reprendre », sans erreur (T4).
3. **Clavier AZERTY** : ZQSD déplace le joueur ; l'aide à l'écran affiche les bonnes lettres (T4).
4. **Audio bloqué avant le premier clic** : aucun son ni erreur avant le clic sur l'écran titre, contexte audio actif après (T6).
5. **Redimensionnement et écrans ultra-larges** : le rendu garde ses proportions, le HUD reste lisible (T1, test de redimensionnement).

## Structure des fichiers

```
package.json, vite.config.ts, tsconfig.json, playwright.config.ts, vitest.config.ts, index.html
src/main.ts
src/core/        Loop.ts (squelette), FixedStep.ts, EventBus.ts, events.ts, InputController.ts, Renderer.ts
src/game/        Game.ts (composition + états), diagnostics.ts, testHooks.ts
src/world/       roomDefinition.ts (données), RoomBuilder.ts (maillages + colliders), lighting.ts
src/physics/     PhysicsWorld.ts
src/player/      PlayerMotor.ts (pur), PlayerController.ts, Flashlight.ts, Interaction.ts
src/haunt/       HauntDirector.ts (pur), HauntPresenter.ts, Apparition.ts
src/audio/       synth.ts (pur), AudioEngine.ts, audioBindings.ts
src/ui/          Hud.ts, screens.ts, keyLabels.ts
src/utils/       random.ts, dispose.ts (squelette)
tests/unit/*.test.ts        Vitest
tests/e2e/*.spec.ts         Playwright
docs/pipeline-blender-findings.md   (T9)
```

---

### Tâche 1 : Squelette, outillage et états du jeu

**Modèle conseillé : Sonnet.** Difficulté moyenne (câblage).

**Fichiers :** créer tout le socle ; supprimer du squelette `entities/Player.ts`, `entities/Pickup.ts`, `systems/CollisionSystem.ts`, `systems/CameraRig.ts`, l'interface tactile de `index.html`, le projet `mobile-chrome` ; déplacer `tests/*` vers `tests/e2e/`.

**Interfaces produites :**
```ts
type GameState = 'title' | 'playing' | 'paused' | 'ended';
// window.__THREE_GAME_DIAGNOSTICS__
interface GameDiagnostics {
  frame: number; elapsed: number;            // elapsed = secondes simulées en 'playing'
  state: GameState;
  player: { position: {x:number;y:number;z:number}; yaw: number; pitch: number; speed: number; grounded: boolean };
  flashlight: { on: boolean; flickering: boolean };
  objective: { powerOn: boolean };
  haunt: { phase: 'calm'|'unease'|'finale'|'done'; counts: Record<string, number>; apparitionVisible: boolean };
  audio: { contextState: string; played: Record<string, number> };
  renderer: { calls: number; triangles: number; geometries: number; textures: number };
  canvas: { clientWidth: number; clientHeight: number; width: number; height: number; dpr: number };
}
// window.__THREE_GAME_TEST_HOOKS__ : contrat du squelette (seed, setState, setPausedForScreenshot,
// setReducedMotion, hideDebugUi) + :
//   setState(name: 'title' | 'playing' | 'finale')
//   advance(seconds: number): void      // exécute des pas fixes de façon synchrone
//   look(dxPx: number, dyPx: number): void
//   teleport(x: number, z: number, yaw: number): void
```
Les champs non encore alimentés prennent des valeurs neutres ; les tâches suivantes les branchent.

- [ ] **1.** Générer : `python3 .claude/skills/threejs-gameplay-systems/scripts/create_threejs_game.py . --force` depuis la racine. Fixer les versions : `three@0.187.0`, `@types/three@0.187.x`, `@playwright/test@1.63.0` (exacte), ajouter `@dimforge/rapier3d-compat@0.21.0`, `vitest@^5`. Scripts npm : `dev`, `build`, `test:unit` (`vitest run`), `test:e2e` (`playwright test --trace off`), `test` (les deux). `.gitignore` : `node_modules`, `dist`, `artifacts`, `test-results`, `playwright-report`.
- [ ] **2.** Playwright : garder `channel: 'chromium'`. Si le lancement échoue, utiliser `launchOptions.executablePath: '/opt/pw-browsers/chromium'` uniquement quand ce chemin existe. Un seul projet `desktop-chrome` 1280×720.
- [ ] **3.** Écrire `tests/e2e/smoke.spec.ts` (doit échouer d'abord) :
  - `boots to title without console errors` : `state === 'title'`, aucun `console.error` ni `pageerror`, texte « Cliquer pour commencer » visible.
  - `click starts the game` : après clic sur le canvas, `state === 'playing'` et `frame` augmente.
  - `advance() steps simulated time` : `advance(2)` fait croître `elapsed` de 2 ± 0,02.
  - `resize keeps aspect` : viewport 2560×1080 puis 800×600 ; `canvas.width / canvas.height` égale le ratio du viewport à 1 % près.
- [ ] **4.** Implémenter `Game` : scène noire, caméra perspective FOV vertical 65°, near 0,05, far 60 ; `createRenderer` avec ACES, sRGB, DPR plafonné à 2, ombres `PCFSoftShadowMap`. États : `title → playing` au clic, `playing ⇄ paused`, `→ ended`. La simulation n'avance qu'en `playing`. `screens.ts` affiche titre, pause (« Cliquer pour reprendre ») et fin (« Fin du prototype », bouton « Rejouer » qui recharge la page).
- [ ] **5.** Vérifier : `npm run build` sans erreur ; `npm run test:e2e` → 4 tests passent.
- [ ] **6.** Commit : `feat: project scaffold, game states and smoke tests`.

---

### Tâche 2 : Pas fixe et bus d'événements

**Modèle conseillé : Sonnet.** Difficulté faible.

**Fichiers :** `src/core/FixedStep.ts`, `src/core/EventBus.ts`, `src/core/events.ts`, `tests/unit/fixedStep.test.ts`, `tests/unit/eventBus.test.ts`.

**Interfaces produites :**
```ts
export const FIXED_DT = 1 / 60;
export class FixedStep {
  constructor(step: (dt: number) => void, maxStepsPerFrame?: number /* 6 */);
  advance(frameDeltaSeconds: number): number;  // renvoie alpha dans [0,1) pour l'interpolation
  runExactly(seconds: number): void;           // pour le hook advance()
}
export interface GameEvents {
  'game:stateChanged': { from: GameState; to: GameState };
  'player:footstep': { position: Vec3; sprinting: boolean };
  'player:flashlightToggled': { on: boolean };
  'interact:fuseBox': {};
  'haunt:knock': { position: Vec3 };
  'haunt:flicker': { duration: number };
  'haunt:powerSurge': {};
  'haunt:apparitionShown': { position: Vec3 };
  'haunt:apparitionVanished': {};
}
export type Vec3 = { x: number; y: number; z: number };
export class EventBus<E> { on<K extends keyof E>(k: K, fn: (p: E[K]) => void): () => void; emit<K extends keyof E>(k: K, p: E[K]): void; }
```

- [ ] **1.** Tests `FixedStep` : `advance(1/60)` → 1 pas ; `advance(0.5)` → exactement 6 pas (plafond, le reste est jeté : **Review Focus 1**) ; cumul de 3 × `1/180` → 1 pas ; alpha ∈ [0,1) ; `runExactly(2)` → 120 pas.
- [ ] **2.** Tests `EventBus` : livraison dans l'ordre d'abonnement ; la fonction renvoyée désabonne ; un abonné qui lève une exception n'empêche pas les suivants (erreur journalisée via `console.error`).
- [ ] **3.** Implémenter, puis brancher `FixedStep` dans `Game` (remplace l'appel direct à `update`) et `advance()` sur `runExactly`.
- [ ] **4.** `npm run test:unit` et `npm run test:e2e` passent. Commit : `feat: fixed timestep and typed event bus`.

---

### Tâche 3 : La pièce (données, visuels, collisions, lumière)

**Modèle conseillé : Sonnet.** Difficulté moyenne.

**Fichiers :** `src/world/roomDefinition.ts`, `src/world/RoomBuilder.ts`, `src/world/lighting.ts`, `src/physics/PhysicsWorld.ts`, `tests/unit/roomDefinition.test.ts`, `tests/e2e/room.spec.ts`.

**Repère :** mètres, Y vers le haut, sol à y = 0, hauteur sous plafond 2,6. Convention : yaw = 0 regarde vers +x, yaw = π vers −x.

**Plan de la pièce (`ROOM`) :**
| Élément | Valeurs |
|---|---|
| Couloir d'entrée | x ∈ [−8, −4], z ∈ [−0,7, 0,7] |
| Pièce principale | x ∈ [−4, 4], z ∈ [−3, 3] |
| Ouverture couloir → pièce | mur x = −4, z ∈ [−0,5, 0,5], hauteur 2,1 |
| Cloison intérieure (crée un recoin) | x = 1,5, z ∈ [−3, 0,5], épaisseur 0,15 |
| Départ du joueur | (−7,3, 0, 0), regard vers +x |
| Tableau électrique | (3,95, 1,4, −2,0), sur le mur est, dans le recoin |
| Canapé | boîte 2,0 × 0,8 × 0,9 centrée en (−1,5, 0,4, 1,8) |
| Table | boîte 1,2 × 0,75 × 0,8 centrée en (−0,5, 0,375, −1,2) |
| Armoire | boîte 0,9 × 1,9 × 0,45 centrée en (−3,3, 0,95, −2,7) |
| Étagère | boîte 0,4 × 1,8 × 1,2 centrée en (3,7, 0,9, 1,6) |
| Ancres de coups | (−3,8, 1,2, 2,8), (3,8, 1,2, 2,8), (−7,9, 1,2, 0), (0, 2,5, −2,9), (1,7, 1,2, −2,8) |
| Ancre d'apparition | (−3,2, 0, 0), tournée vers +x |

**Interfaces produites :**
```ts
export interface BoxDef { id: string; center: Vec3; size: Vec3; kind: 'wall'|'floor'|'ceiling'|'prop' }
export interface RoomDef { boxes: BoxDef[]; spawn: { position: Vec3; yaw: number };
  fuseBox: Vec3; knockAnchors: Vec3[]; apparitionAnchor: { position: Vec3; yaw: number };
  walkable: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> }
export const ROOM: RoomDef;
export function isInsideWalkable(room: RoomDef, x: number, z: number): boolean;
export class PhysicsWorld { static create(): Promise<PhysicsWorld>; addFixedBox(b: BoxDef): void;
  step(dt: number): void; castRay(from: Vec3, dir: Vec3, maxDist: number): { distance: number } | null;
  readonly world: RAPIER.World }
export function buildRoom(room: RoomDef, scene: THREE.Scene, physics: PhysicsWorld): { dispose(): void };
```

- [ ] **1.** Tests unitaires sur `ROOM` : départ, tableau, ancre d'apparition dans `walkable` ; aucune boîte `prop` ne contient le départ ni l'ancre d'apparition (marge 0,4) ; l'ouverture du couloir n'est obstruée par aucune boîte ; identifiants uniques ; chaque ancre de coups est à moins de 0,3 m d'un mur.
- [ ] **2.** Implémenter données, `PhysicsWorld` (`RAPIER.init()`, gravité −9,81, `step` appelé depuis le pas fixe), `buildRoom` (une boîte = un maillage `MeshStandardMaterial` mat + un collider cuboïde fixe ; murs gris-beige rugosité 0,9, sol brun foncé rugosité 0,8, meubles teintes sombres distinctes ; `castShadow`/`receiveShadow` actifs).
- [ ] **3.** `lighting.ts` : `HemisphereLight` intensité 0,015 ; `FogExp2` noir densité 0,06 ; fond noir. La pièce doit être presque illisible sans lampe.
- [ ] **4.** `tests/e2e/room.spec.ts` : après démarrage, `renderer.triangles > 100`, `renderer.calls < 300`, aucune erreur console.
- [ ] **5.** Tests passent. Commit : `feat: data-driven room with physics colliders`.

---

### Tâche 4 : Joueur FPS

**Modèle conseillé : Opus** (ou Sonnet si le budget compte). Difficulté moyenne à élevée : le ressenti du déplacement décide de la qualité perçue.

**Fichiers :** `src/core/InputController.ts` (réécrit), `src/player/PlayerMotor.ts`, `src/player/PlayerController.ts`, `src/ui/keyLabels.ts`, `tests/unit/playerMotor.test.ts`, `tests/unit/keyLabels.test.ts`, `tests/e2e/player.spec.ts`.

**Interfaces :**
- Consomme : `PhysicsWorld`, `ROOM.spawn`, `FixedStep`, `EventBus`.
- Produit :
```ts
export interface InputIntent { moveX: number; moveZ: number; sprint: boolean;
  lookDX: number; lookDY: number; interactPressed: boolean; flashlightPressed: boolean }
export class InputController { constructor(canvas: HTMLCanvasElement);
  consume(): InputIntent;            // remet à zéro deltas de regard et fronts d'appui
  injectLook(dxPx: number, dyPx: number): void;
  requestLock(): Promise<boolean>;   // false si refusé, ne lève jamais
  onLockLost(fn: () => void): void; dispose(): void }
export const PLAYER = { walkSpeed: 1.7, sprintSpeed: 2.9, accel: 12, eyeHeight: 1.62,
  radius: 0.3, halfHeight: 0.55, lookSensitivity: 0.002, pitchLimit: 1.48, strideLength: 0.7 };
export function stepVelocity(current: {x:number;z:number}, intent: Pick<InputIntent,'moveX'|'moveZ'|'sprint'>,
  yaw: number, dt: number): { x: number; z: number };           // pur
export class PlayerController { constructor(physics: PhysicsWorld, camera: THREE.PerspectiveCamera, bus: EventBus<GameEvents>);
  applyLook(dx: number, dy: number): void;     // chaque image
  fixedUpdate(intent: InputIntent, dt: number): void;
  interpolate(alpha: number): void;            // place la caméra entre l'état précédent et l'actuel
  teleport(x: number, z: number, yaw: number): void;
  readonly position: Vec3; readonly yaw: number; readonly pitch: number; readonly speed: number; readonly grounded: boolean }
export function movementKeyLabels(layout?: { get(code: string): string | undefined }): string; // « ZQSD » ou « WASD »
```

- [ ] **1.** Tests `stepVelocity` : à l'arrêt + avance pendant 1 s → vitesse = 1,7 ± 0,01 ; sprint → 2,9 ; diagonale normalisée (norme ≤ vitesse max) ; sans entrée, la vitesse tombe sous 0,05 en moins de 0,3 s ; yaw = π/2 fait tourner le vecteur d'un quart de tour ; le résultat ne dépend pas du découpage (60 × 1/60 ≈ 120 × 1/120 à 2 % près).
- [ ] **2.** Tests `movementKeyLabels` : carte renvoyant `z` pour `KeyW` → « ZQSD » ; `w` → « WASD » ; carte absente → « ZQSD / WASD » (**Review Focus 3**).
- [ ] **3.** Implémenter `InputController` : `code` `KeyW/KeyA/KeyS/KeyD`, `ShiftLeft` sprint, `KeyE` interaction, `KeyF` lampe ; deltas souris seulement quand le pointeur est verrouillé ; perte de focus de la fenêtre → toutes les touches relâchées.
- [ ] **4.** Implémenter `PlayerController` avec le `KinematicCharacterController` de Rapier : capsule, offset 0,02, auto-step 0,25, snap au sol 0,2, gravité appliquée. Regard appliqué à chaque image, position interpolée par `alpha`. Émet `player:footstep` chaque fois que la distance parcourue au sol dépasse `strideLength`.
- [ ] **5.** `Game` : au clic du titre, `requestLock()` ; l'état `playing` ne dépend pas du succès du verrouillage. Verrouillage perdu alors qu'il était acquis → `paused` ; clic → reprise (**Review Focus 2**). Le HUD affiche l'aide « {ZQSD} se déplacer · Maj courir · F lampe · E interagir » pendant 8 s.
- [ ] **6.** `tests/e2e/player.spec.ts` :
  - `walks forward` : maintenir `KeyW` + `advance(2)` → `position.x` augmente de 3,0 ± 0,5 depuis le départ.
  - `walls stop the player` : `teleport(3.0, 2.0, 0)` (face au mur est), `KeyW` + `advance(3)` → `position.x ≤ 4 − 0,3 + 0,05`.
  - `survives a long frame` : `teleport` face à un mur, `KeyW`, simuler une image de 5 s via `advance` par le chemin `FixedStep.advance(5)` exposé en test → le joueur reste dans `walkable` (**Review Focus 1**).
  - `look hook rotates camera` : `look(500, 0)` → yaw change de 1,0 ± 0,01 rad ; `look(0, 5000)` → `|pitch| ≤ 1,48`.
  - `escape pauses` : émettre la perte de verrouillage → `state === 'paused'`, texte « Cliquer pour reprendre » visible, aucune erreur.
- [ ] **7.** Tests passent. Commit : `feat: first-person player with Rapier character controller`.

---

### Tâche 5 : Lampe torche, interaction et objectif

**Modèle conseillé : Sonnet.** Difficulté moyenne.

**Fichiers :** `src/player/Flashlight.ts`, `src/player/Interaction.ts`, `src/ui/Hud.ts`, `tests/unit/interaction.test.ts`, `tests/e2e/flashlight.spec.ts`.

**Interfaces produites :**
```ts
export const FLASHLIGHT = { color: 0xfff1d6, intensity: 40, angle: 0.45, penumbra: 0.5,
  distance: 18, decay: 2, shadowMapSize: 1024, followRate: 14 };
export class Flashlight { constructor(camera: THREE.Camera, scene: THREE.Scene, bus: EventBus<GameEvents>);
  toggle(): void; flicker(duration: number): void; kill(duration: number): void;  // kill = éteinte de force
  update(dt: number, elapsed: number): void; readonly on: boolean; readonly flickering: boolean }
export const INTERACT_RANGE = 1.8;
export function canInteract(player: Vec3, yaw: number, pitch: number, target: Vec3, range: number): boolean; // cône de 20°
export class Hud { showPrompt(text: string | null): void; showHelp(text: string, seconds: number): void }
```

- [ ] **1.** Tests `canInteract` : cible à 1,5 m en face → vrai ; à 2,0 m → faux ; à 1,5 m mais 45° de côté → faux ; derrière → faux.
- [ ] **2.** Implémenter `Flashlight` : `SpotLight` avec ombres, allumée au départ, orientation qui rattrape la caméra (`followRate`, slerp) pour donner du poids ; `flicker` module l'intensité de façon déterministe à partir de `elapsed`. `KeyF` → `toggle` + événement.
- [ ] **3.** Tableau électrique : boîte 0,4 × 0,6 × 0,1 gris métal avec un petit voyant émissif rouge (seule lumière de la pièce). À portée : invite « E — Rétablir le courant ». `KeyE` → `objective.powerOn = true`, voyant vert, émet `interact:fuseBox` une seule fois. Une obstruction par un mur (rayon `PhysicsWorld.castRay`) empêche l'interaction.
- [ ] **4.** `tests/e2e/flashlight.spec.ts` : `flashlight.on === true` au départ ; `KeyF` l'éteint, à nouveau l'allume ; `teleport(3.2, -2.0, 0)` + `KeyE` → `objective.powerOn === true` ; `teleport(1.0, -2.0, 0)` (derrière la cloison) + `KeyE` → reste `false`.
- [ ] **5.** Tests passent. Commit : `feat: flashlight, interaction and power objective`.

---

### Tâche 6 : Moteur audio et sons synthétisés

**Modèle conseillé : Opus.** Difficulté élevée : la peur passe d'abord par le son.

**Fichiers :** `src/audio/synth.ts`, `src/audio/AudioEngine.ts`, `src/audio/audioBindings.ts`, `tests/unit/synth.test.ts`, `tests/e2e/audio.spec.ts`. Charger le skill `audio-design`.

**Interfaces produites :**
```ts
export type SoundId = 'ambience' | 'footstep' | 'knock' | 'flickerBuzz' | 'powerSurge' | 'sting';
export function renderSound(id: SoundId, sampleRate: number, rng: () => number): Float32Array;   // pur
export class AudioEngine { resume(): Promise<void>; suspend(): void;
  setListener(position: Vec3, yaw: number): void;
  play(id: SoundId, opts?: { position?: Vec3; gainDb?: number; rate?: number }): void;
  startAmbience(): void; duckAmbience(toDb: number, seconds: number): void;
  setMasterVolume(slider01: number): void;
  readonly contextState: string; readonly played: Record<string, number> }
export function bindAudio(bus: EventBus<GameEvents>, audio: AudioEngine): () => void;
```

**Matrice des sons :**
| Son | Synthèse | Routage |
|---|---|---|
| `ambience` | bruit brun, passe-bas 180 Hz, modulation lente 0,07 Hz, boucle 8 s sans clic | bus ambiance, −24 dB |
| `footstep` | salve de bruit 60 ms, passe-bande 300–900 Hz, hauteur ±10 % | bus SFX, −14 dB, sprint +3 dB |
| `knock` | 3 coups sinus 90 → 50 Hz, déclin 120 ms, espacés de 180 ms | bus SFX, spatial HRTF, −6 dB |
| `flickerBuzz` | carré 50 Hz haché, 0,6 s | bus SFX, −18 dB |
| `powerSurge` | bourdonnement montant 1,5 s puis claquement | bus SFX, −8 dB |
| `sting` | grappe dissonante + montée de bruit, 1,2 s | bus SFX, non spatial, −4 dB |

Chaîne : source → bus (ambiance, SFX) → master → limiteur (`DynamicsCompressorNode`) → sortie. Volumes en décibels ; curseur master élevé au carré.

- [ ] **1.** Tests `renderSound` pour chaque `SoundId` à 48 000 Hz : durée attendue ± 5 %, toutes les valeurs finies, pic ≤ 1,0, RMS > 0,005 ; même graine → même tampon ; pour `ambience`, premier et dernier échantillons diffèrent de moins de 0,02 (boucle propre).
- [ ] **2.** Implémenter `synth.ts`, `AudioEngine` (contexte créé suspendu ; `resume()` appelé seulement au clic du titre ; `suspend()` en pause ; `PannerNode` HRTF, `refDistance` 1, `rolloffFactor` 1,5 ; écouteur synchronisé à la caméra chaque image).
- [ ] **3.** `bindAudio` : `player:footstep` → `footstep` ; `haunt:knock` → `knock` à la position ; `haunt:flicker` → `flickerBuzz` ; `haunt:powerSurge` → `powerSurge` ; `haunt:apparitionShown` → `duckAmbience(-60, 0.2)` (le silence précède le choc) ; `haunt:apparitionVanished` → `sting`.
- [ ] **4.** `tests/e2e/audio.spec.ts` : sur l'écran titre, `audio.contextState !== 'running'` et `played` vide (**Review Focus 4**) ; après clic, `contextState === 'running'` ; marcher 3 s → `played.footstep ≥ 4` ; pause → `contextState === 'suspended'`.
- [ ] **5.** Tests passent. Commit : `feat: synthesized spatial audio engine`.

---

### Tâche 7 : Directeur de hantise et apparition

**Modèle conseillé : Fable (ou Opus après le 16 novembre).** Difficulté très élevée : c'est la tâche qui décide si le prototype fait peur, et la base de la future IA.

**Fichiers :** `src/haunt/HauntDirector.ts`, `src/haunt/HauntPresenter.ts`, `src/haunt/Apparition.ts`, `tests/unit/hauntDirector.test.ts`, `tests/e2e/haunt.spec.ts`. Charger `game-ai` et `game-feel`.

**Interfaces :**
- Consomme : `EventBus`, `ROOM`, `PhysicsWorld.castRay`, `Flashlight`, RNG à graine.
- Produit :
```ts
export const HAUNT = { calmDuration: 40, knockInterval: [15, 25], flickerInterval: [30, 45],
  flickerDuration: 0.6, knockMinDistance: 3, surgeBlackout: 2.0,
  apparitionTriggerAngle: 0.21 /* 12° */, apparitionGazeTime: 0.4, apparitionTriggerDistance: 2.5,
  lungeDistance: 1.0, lungeDuration: 0.18, endDelay: 3.0 } as const;
export interface HauntInput { dt: number; player: Vec3; yaw: number; pitch: number; flashlightOn: boolean;
  hasLineOfSight: (from: Vec3, to: Vec3) => boolean }
export type HauntPhase = 'calm' | 'unease' | 'finale' | 'done';
export class HauntDirector { constructor(room: RoomDef, bus: EventBus<GameEvents>, rng: () => number);
  update(input: HauntInput): void; triggerFinale(): void;
  readonly phase: HauntPhase; readonly apparitionVisible: boolean; readonly counts: Record<string, number> }
```

**Comportement (machine à états, tout au pas fixe) :**
1. `calm` (0 à 40 s) : rien. L'ambiance seule installe l'attente.
2. `unease` : un `haunt:knock` toutes les 15 à 25 s (tirage RNG), sur l'ancre la plus éloignée du joueur parmi celles situées à plus de 3 m **et** hors de son champ de vision (demi-angle 50°) ; si aucune ne convient, repousser de 2 s. Un `haunt:flicker` toutes les 30 à 45 s.
3. `finale`, déclenchée par `interact:fuseBox` (depuis `calm` ou `unease`) : t+0 `haunt:powerSurge` et lampe éteinte de force 2 s ; t+2 l'apparition est placée sur son ancre, `haunt:apparitionShown`. Elle se déclenche quand le joueur la regarde (angle < 12°, ligne de vue dégagée, lampe allumée) pendant 0,4 s cumulées, ou s'approche à moins de 2,5 m : elle fonce de 1 m vers le joueur en 0,18 s, disparaît, `haunt:apparitionVanished`.
4. `done` : 3 s plus tard, `Game` passe à `ended`.

Garde-fous (skill `game-ai`) : la perception est calculée dans le directeur à partir de `HauntInput`, jamais dans le présentateur ; aucun événement n'est émis en double ; `triggerFinale()` est idempotent.

- [ ] **1.** Tests unitaires (RNG à graine, `hasLineOfSight` simulé) :
  - `no events during calm` : 39 s simulées → `counts` vide.
  - `first knock lands in the 55–65 s window` et les intervalles suivants restent dans [15, 25].
  - `knock anchor is never within 3 m nor in view` : 200 positions/yaws tirés → propriété toujours vraie.
  - `knock is postponed when no anchor qualifies`.
  - `same seed gives same event timeline` ; graine différente → chronologie différente.
  - `finale sequence timing` : `powerSurge` à t+0, `apparitionShown` à t+2,0 ± 1 pas.
  - `gaze triggers vanish after 0.4 s` ; regard interrompu → le cumul ne repart pas de zéro ; lampe éteinte → pas de cumul.
  - `proximity triggers vanish` à 2,4 m ; pas à 2,6 m.
  - `no line of sight, no gaze trigger`.
  - `triggerFinale twice emits one powerSurge` ; `done` atteint 3 s après la disparition ; plus aucun coup ni clignotement une fois en `finale`.
- [ ] **2.** Implémenter `HauntDirector` (pur, aucun import de three ni de Rapier).
- [ ] **3.** `Apparition.ts` : silhouette provisoire en primitives, 1,95 m, corps étroit, bras trop longs, matériau noir rugosité 1, invisible par défaut ; `show(position, yaw)`, `lungeToward(target, distance, duration)`, `hide()`. `HauntPresenter` relie les événements à `Flashlight.flicker/kill`, à `Apparition` et à un tremblement de caméra de 0,25 s lors de la charge (désactivé si `setReducedMotion`).
- [ ] **4.** `Game` : `interact:fuseBox` → `triggerFinale()` ; `hasLineOfSight` via `PhysicsWorld.castRay` ; hook `setState('finale')` = téléporte près du tableau, courant rétabli, final lancé ; diagnostics `haunt.*` alimentés.
- [ ] **5.** `tests/e2e/haunt.spec.ts` : `seed(7)`, démarrer, `teleport(0, 0, 0)` (depuis le départ, toutes les ancres sont dans le champ de vision et les coups seraient repoussés), `advance(70)` → `haunt.phase === 'unease'` et `counts.knock ≥ 1` ; `setState('finale')`, `advance(2.5)` → `apparitionVisible === true` et `flashlight.on` rétablie ; `teleport(1.0, 0, Math.PI)` (face à l'apparition à 4,2 m, à l'ouest de la cloison pour garder la ligne de vue), `advance(1)` → `apparitionVisible === false`, `counts.apparitionVanished === 1` ; `advance(3.5)` → `state === 'ended'`, texte « Fin du prototype » visible ; `audio.played.sting === 1`.
- [ ] **6.** Tests passent. Commit : `feat: haunt director, apparition and finale`.

---

### Tâche 8 : Partie complète automatisée, réglages et essai humain

**Modèle conseillé : Sonnet pour l'automatisation, Opus pour les réglages de ressenti.** Difficulté moyenne.

**Fichiers :** `tests/e2e/playthrough.spec.ts`, `src/systems/DebugTools.ts` (adapté), `README.md`. Charger `threejs-qa-release`.

- [ ] **1.** `playthrough.spec.ts` : un bot joue la partie entière avec les seules entrées clavier et le hook `look` (aucun `teleport`) : couloir → pièce → contourner la cloison → tableau → `KeyE` → se retourner → fin. Assertions : `state === 'ended'` en moins de 180 s simulées, joueur toujours dans `walkable`, `renderer.calls < 300` à chaque point de contrôle, zéro erreur console.
- [ ] **2.** `DebugTools` (lil-gui, visible seulement en mode dev ou avec `?debug`) : vitesse, sensibilité, intensité et angle de la lampe, densité du brouillard, volumes, durées `HAUNT`. Aucun panneau en build de production (test : `npm run build` puis `preview`, le panneau est absent).
- [ ] **3.** Capture : exécuter `npm run inspect:canvas` sur les états `playing` et `finale` ; vérifier à l'œil que l'image est sombre mais lisible dans le faisceau, et que l'apparition se détache.
- [ ] **4.** `README.md` en français : prérequis (Node 22), `npm install`, `npm run dev`, adresse locale, touches, comment lancer les tests.
- [ ] **5.** **Essai humain (critère du design).** Demander à l'utilisateur de jouer une partie au casque sur sa machine et de répondre : a-t-il ressenti de la tension dans les 5 premières minutes ? À quel moment ? Qu'est-ce qui a cassé l'immersion ? Ajuster les valeurs `HAUNT`, `FLASHLIGHT` et les volumes d'après ses réponses, une itération au minimum.
- [ ] **6.** `npm test` passe en entier. Commit : `feat: full playthrough test, tuning panel and README`.

---

### Tâche 9 : Validation du pipeline Blender → GLB (sous réserve d'accord)

**Modèle conseillé : Opus.** Difficulté élevée, résultat incertain : c'est une expérience dont le livrable est une réponse, pas du contenu.

**Fichiers :** `public/assets/armchair.glb`, `src/world/assets.ts`, `docs/pipeline-blender-findings.md`, `tests/e2e/assets.spec.ts`. Charger `threejs-loaders` et `threejs-asset-pipeline`.

**Interface produite :** `export async function loadProp(url: string): Promise<THREE.Object3D>` ; le canapé en primitives est remplacé par le GLB quand l'URL contient `?assets=glb`, son collider reste la boîte de `ROOM`.

- [ ] **1.** **Porte d'entrée.** Lire les instructions du module (`get_preset_instructions` avec `/3d-jutsu`) et le solde de crédits. Présenter à l'utilisateur le coût estimé d'un objet et d'un bake. **S'arrêter ici sans son accord explicite.**
- [ ] **2.** Créer un fauteuil réaliste usé (cuir sombre, matériaux PBR), moins de 20 000 triangles, échelle en mètres, origine au sol. Exporter en GLB.
- [ ] **3.** Tenter un pré-calcul d'éclairage sur la coque de la pièce (bake vers une texture sur un second jeu d'UV) et l'appliquer dans three via `material.lightMap`.
- [ ] **4.** `tests/e2e/assets.spec.ts` : avec `?assets=glb`, aucun échec de chargement, `renderer.triangles` augmente, `renderer.calls < 300`, taille du fichier sous 5 Mo.
- [ ] **5.** Rédiger `docs/pipeline-blender-findings.md` : coût réel en crédits, temps par objet, ce qui survit à l'export (matériaux, textures, échelle, axes), résultat du bake, et une recommandation tranchée : continuer avec ce pipeline, ou basculer vers des packs CC0 (Poly Haven) pour la maison complète.
- [ ] **6.** Commit : `feat: validate Blender to GLB asset pipeline`.

---

## Ordre et dépendances

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8, strictement dans cet ordre (chaque tâche consomme les interfaces des précédentes). T9 est indépendante de T6 à T8 et peut être faite à tout moment après T3.

Priorité pendant l'accès à Fable 5.2 (jusqu'au lundi 16 novembre) : amener le projet jusqu'à T7 et la faire avec Fable.

## Critère de réussite du prototype

1. `npm test` passe en entier (unitaires et navigateur).
2. Le bot termine la partie complète (T8).
3. L'utilisateur confirme avoir ressenti de la tension dans les 5 premières minutes (T8, étape 5).
