import './styles.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Missing #game-canvas element.');

const game = await Game.create(canvas);
game.start();

// Dev-only handle for poking at the scene from the browser console.
if (import.meta.env.DEV) (window as unknown as { __GAME__?: Game }).__GAME__ = game;

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
