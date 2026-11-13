/** What the player wants this frame, independent of the physical device. */
export interface InputIntent {
  /** Strafe: +1 right, -1 left. */
  moveX: number;
  /** +1 forward, -1 backward. */
  moveZ: number;
  sprint: boolean;
  /** Mouse movement in pixels since the last consume(). */
  lookDX: number;
  lookDY: number;
  /** True only on the frame the key went down. */
  interactPressed: boolean;
  flashlightPressed: boolean;
}

/**
 * Keyboard and mouse input. Keys are read by physical position (KeyboardEvent.code),
 * so the WASD cluster works as ZQSD on an AZERTY keyboard without any setting.
 */
export class InputController {
  private readonly keys = new Set<string>();
  private lookDX = 0;
  private lookDY = 0;
  private interactPressed = false;
  private flashlightPressed = false;
  private lockLostListeners: Array<() => void> = [];
  private lockedNow = false;
  private lockedOnce = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!event.repeat) {
      if (event.code === 'KeyE') this.interactPressed = true;
      if (event.code === 'KeyF') this.flashlightPressed = true;
    }
    this.keys.add(event.code);
  };
  private readonly onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private readonly onBlur = () => this.releaseAll();
  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.lockedNow) return;
    this.lookDX += event.movementX;
    this.lookDY += event.movementY;
  };
  private readonly onLockChange = () => {
    const wasLocked = this.lockedNow;
    this.lockedNow = document.pointerLockElement === this.canvas;
    if (this.lockedNow) this.lockedOnce = true;
    if (wasLocked && !this.lockedNow) {
      this.releaseAll();
      for (const listener of this.lockLostListeners) listener();
    }
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  /** True while the mouse is captured by the game. */
  get locked(): boolean {
    return this.lockedNow;
  }

  /** True once the browser has granted the lock at least once (so it is supported here). */
  get everLocked(): boolean {
    return this.lockedOnce;
  }

  /** Returns the current intent and clears look deltas and key-press edges. */
  consume(): InputIntent {
    const down = (...codes: string[]) => codes.some((code) => this.keys.has(code));
    const intent: InputIntent = {
      moveX: (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0),
      moveZ: (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0),
      sprint: down('ShiftLeft', 'ShiftRight'),
      lookDX: this.lookDX,
      lookDY: this.lookDY,
      interactPressed: this.interactPressed,
      flashlightPressed: this.flashlightPressed,
    };
    this.lookDX = 0;
    this.lookDY = 0;
    this.interactPressed = false;
    this.flashlightPressed = false;
    return intent;
  }

  injectLook(dxPx: number, dyPx: number): void {
    this.lookDX += dxPx;
    this.lookDY += dyPx;
  }

  /** Asks the browser to capture the mouse. Resolves false when refused; never throws. */
  async requestLock(): Promise<boolean> {
    if (this.lockedNow) return true;
    try {
      await this.canvas.requestPointerLock();
      return document.pointerLockElement === this.canvas;
    } catch {
      return false;
    }
  }

  /** Gives the mouse back to the page, so menus can be clicked. */
  releaseLock(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  onLockLost(listener: () => void): void {
    this.lockLostListeners.push(listener);
  }

  releaseAll(): void {
    this.keys.clear();
    this.lookDX = 0;
    this.lookDY = 0;
    this.interactPressed = false;
    this.flashlightPressed = false;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.lockLostListeners = [];
  }
}
