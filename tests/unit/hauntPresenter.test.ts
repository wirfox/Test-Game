import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { HAUNT } from '../../src/haunt/HauntDirector';
import { HauntPresenter, type HauntStage } from '../../src/haunt/HauntPresenter';

function setup() {
  const calls: string[] = [];
  const stage: HauntStage = {
    flashlight: {
      flicker: (d) => calls.push(`flicker:${d}`),
      kill: (d) => calls.push(`kill:${d}`),
    },
    apparition: {
      show: (p) => calls.push(`show:${p.x},${p.z}`),
      lungeToward: (t, dist, dur) => calls.push(`lunge:${t.x},${t.z}:${dist}:${dur}`),
      hide: () => calls.push('hide'),
      update: () => undefined,
    },
    lamp: {
      surge: (d) => calls.push(`surge:${d}`),
      burst: () => calls.push('burst'),
      update: () => undefined,
    },
  };
  const bus = new EventBus<GameEvents>();
  const presenter = new HauntPresenter(bus, stage);
  return { calls, bus, presenter };
}

describe('HauntPresenter', () => {
  it('turns haunt events into stage actions', () => {
    const { calls, bus } = setup();
    bus.emit('haunt:flicker', { duration: 0.6 });
    bus.emit('haunt:powerSurge', {});
    bus.emit('haunt:blackout', { duration: 2 });
    bus.emit('haunt:apparitionShown', { position: { x: -3.2, y: 0, z: 0 } });
    bus.emit('haunt:apparitionLunge', { toward: { x: 1, y: 1.6, z: 0 } });
    bus.emit('haunt:apparitionVanished', {});
    expect(calls).toEqual([
      'flicker:0.6',
      `surge:${HAUNT.surgeDuration}`,
      'burst',
      'kill:2',
      'show:-3.2,0',
      `lunge:1,0:${HAUNT.lungeDistance}:${HAUNT.lungeDuration}`,
      'hide',
    ]);
  });

  it('shakes the camera after a lunge, and not when reduced motion is on', () => {
    const a = setup();
    expect(a.presenter.cameraShake()).toEqual({ pitch: 0, roll: 0 });
    a.bus.emit('haunt:apparitionLunge', { toward: { x: 0, y: 0, z: 0 } });
    a.presenter.update(0.05, { x: 0, y: 0, z: 0 });
    const shake = a.presenter.cameraShake();
    expect(Math.abs(shake.pitch) + Math.abs(shake.roll)).toBeGreaterThan(0);
    a.presenter.update(1, { x: 0, y: 0, z: 0 });
    expect(a.presenter.cameraShake()).toEqual({ pitch: 0, roll: 0 });

    const b = setup();
    b.presenter.setReducedMotion(true);
    b.bus.emit('haunt:apparitionLunge', { toward: { x: 0, y: 0, z: 0 } });
    b.presenter.update(0.05, { x: 0, y: 0, z: 0 });
    expect(b.presenter.cameraShake()).toEqual({ pitch: 0, roll: 0 });
  });

  it('stops reacting once disposed', () => {
    const { calls, bus, presenter } = setup();
    presenter.dispose();
    bus.emit('haunt:flicker', { duration: 1 });
    expect(calls).toEqual([]);
  });
});
