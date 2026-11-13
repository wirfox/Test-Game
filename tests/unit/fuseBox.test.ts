import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { FuseBox } from '../../src/world/FuseBox';

describe('FuseBox', () => {
  it('restores power once and emits a single event', () => {
    const bus = new EventBus<GameEvents>();
    const listener = vi.fn();
    bus.on('interact:fuseBox', listener);
    const box = new FuseBox(new THREE.Scene(), { x: 3.95, y: 1.4, z: -2 }, bus);
    expect(box.powerOn).toBe(false);
    expect(box.interactable.enabled()).toBe(true);
    box.interactable.activate();
    box.interactable.activate();
    expect(box.powerOn).toBe(true);
    expect(box.interactable.enabled()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('asks the player to restore power in French', () => {
    const box = new FuseBox(new THREE.Scene(), { x: 0, y: 0, z: 0 }, new EventBus<GameEvents>());
    expect(box.interactable.prompt).toBe('E — Rétablir le courant');
  });
});
