/// <reference types="vite/client" />

import type { GameDiagnostics, GameTestHooks } from './game/diagnostics';

declare global {
  interface Window {
    __THREE_GAME_DIAGNOSTICS__?: GameDiagnostics;
    __THREE_GAME_TEST_HOOKS__?: GameTestHooks;
  }
}
