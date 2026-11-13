import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents, Vec3 } from '../../src/core/events';
import { FIXED_DT } from '../../src/core/FixedStep';
import { HAUNT, HauntDirector, type HauntInput } from '../../src/haunt/HauntDirector';
import { createSeededRandom } from '../../src/utils/random';
import { ROOM, isInsideWalkable } from '../../src/world/roomDefinition';

type Logged = { t: number; name: string; payload: unknown };
type View = Partial<Omit<HauntInput, 'dt'>>;

const EYE = 1.62;
const NOOK: View = { player: { x: 3.2, y: EYE, z: -2 }, yaw: 0 };
/** 4.2 m from the apparition, looking straight at it. */
const FACING: View = { player: { x: 1, y: EYE, z: 0 }, yaw: Math.PI };
const SHOWN_AT = HAUNT.surgeDuration + HAUNT.surgeBlackout;

function setup(seed = 1) {
  const bus = new EventBus<GameEvents>();
  const log: Logged[] = [];
  let t = 0;
  const names = [
    'haunt:knock',
    'haunt:flicker',
    'haunt:powerSurge',
    'haunt:blackout',
    'haunt:apparitionShown',
    'haunt:apparitionLunge',
    'haunt:apparitionVanished',
  ] as const;
  for (const name of names) bus.on(name, (payload) => log.push({ t, name: name.slice(6), payload }));
  const director = new HauntDirector(ROOM, bus, createSeededRandom(seed));
  const run = (seconds: number, view: View = {}) => {
    const steps = Math.round(seconds / FIXED_DT);
    for (let i = 0; i < steps; i += 1) {
      t += FIXED_DT;
      director.update({
        dt: FIXED_DT,
        player: { x: 0, y: EYE, z: 0 },
        yaw: 0,
        pitch: 0,
        flashlightOn: true,
        hasLineOfSight: () => true,
        ...view,
      });
    }
  };
  const times = (name: string) => log.filter((e) => e.name === name).map((e) => e.t);
  return { director, log, run, times, now: () => t };
}

const angleTo = (from: Vec3, yaw: number, to: Vec3) => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return Math.acos((dx * Math.cos(yaw) + dz * Math.sin(yaw)) / Math.hypot(dx, dz));
};

describe('HauntDirector: calm and unease', () => {
  it('emits nothing during the calm phase', () => {
    const h = setup();
    h.run(HAUNT.calmDuration - 1);
    expect(h.log).toEqual([]);
    expect(h.director.phase).toBe('calm');
  });

  it('enters unease after the calm duration', () => {
    const h = setup();
    h.run(HAUNT.calmDuration + 0.1);
    expect(h.director.phase).toBe('unease');
  });

  it('lands the first knock 15 to 25 s into unease, and keeps that spacing', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const h = setup(seed);
      h.run(200);
      const knocks = h.times('knock');
      expect(knocks.length).toBeGreaterThanOrEqual(5);
      expect(knocks[0]).toBeGreaterThanOrEqual(HAUNT.calmDuration + 15 - 0.02);
      expect(knocks[0]).toBeLessThanOrEqual(HAUNT.calmDuration + 25 + 0.02);
      for (let i = 1; i < knocks.length; i += 1) {
        expect(knocks[i] - knocks[i - 1]).toBeGreaterThanOrEqual(15 - 0.02);
        expect(knocks[i] - knocks[i - 1]).toBeLessThanOrEqual(25 + 0.02);
      }
    }
  });

  it('flickers the flashlight every 30 to 45 s', () => {
    const h = setup(3);
    h.run(250);
    const flickers = h.times('flicker');
    expect(flickers.length).toBeGreaterThanOrEqual(4);
    expect(flickers[0]).toBeGreaterThanOrEqual(HAUNT.calmDuration + 30 - 0.02);
    for (let i = 1; i < flickers.length; i += 1) {
      expect(flickers[i] - flickers[i - 1]).toBeGreaterThanOrEqual(30 - 0.02);
      expect(flickers[i] - flickers[i - 1]).toBeLessThanOrEqual(45 + 0.02);
    }
    expect(h.log.find((e) => e.name === 'flicker')!.payload).toEqual({ duration: HAUNT.flickerDuration });
  });

  it('does not flicker a flashlight that is switched off', () => {
    const h = setup(3);
    h.run(250, { flashlightOn: false });
    expect(h.times('flicker')).toEqual([]);
  });

  it('never knocks within 3 m of the player nor inside their field of view', () => {
    const rng = createSeededRandom(123);
    let checked = 0;
    for (let trial = 0; trial < 200; trial += 1) {
      let x = 0;
      let z = 0;
      do {
        x = -8 + rng() * 12;
        z = -3 + rng() * 6;
      } while (!isInsideWalkable(ROOM, x, z));
      const player = { x, y: EYE, z };
      const yaw = rng() * Math.PI * 2;
      const h = setup(trial + 1);
      h.run(HAUNT.calmDuration + 26, { player, yaw });
      for (const event of h.log.filter((e) => e.name === 'knock')) {
        const position = (event.payload as { position: Vec3 }).position;
        expect(ROOM.knockAnchors).toContainEqual(position);
        expect(Math.hypot(position.x - x, position.z - z)).toBeGreaterThanOrEqual(HAUNT.knockMinDistance);
        expect(angleTo(player, yaw, position)).toBeGreaterThan(HAUNT.viewHalfAngle);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('picks the farthest eligible anchor', () => {
    const h = setup();
    // In the corridor looking west: only the far-east anchors are behind and far.
    h.run(HAUNT.calmDuration + 26, { player: { x: -6, y: EYE, z: 0 }, yaw: Math.PI });
    const first = h.log.find((e) => e.name === 'knock')!.payload as { position: Vec3 };
    expect(first.position).toEqual({ x: 3.8, y: 1.2, z: 2.8 });
  });

  it('postpones the knock while every anchor is in view or too close, then fires once one qualifies', () => {
    const h = setup();
    // From the spawn looking into the room, every far anchor is in view and the near one is too close.
    const atSpawn: View = { player: { x: -7.3, y: EYE, z: 0 }, yaw: 0 };
    h.run(HAUNT.calmDuration + 60, atSpawn);
    expect(h.times('knock')).toEqual([]);
    const turnedAt = h.now();
    h.run(3, { player: { x: 0, y: EYE, z: 0 }, yaw: 0 });
    expect(h.times('knock')).toHaveLength(1);
    expect(h.times('knock')[0] - turnedAt).toBeLessThanOrEqual(HAUNT.retryDelay + 0.02);
  });

  it('replays the same timeline for the same seed and a different one for another seed', () => {
    const timeline = (seed: number) => {
      const h = setup(seed);
      h.run(200);
      return h.log.map((e) => `${e.name}@${e.t.toFixed(3)}`);
    };
    expect(timeline(7)).toEqual(timeline(7));
    expect(timeline(7)).not.toEqual(timeline(8));
  });
});

describe('HauntDirector: finale', () => {
  function inFinale(seed = 1) {
    const h = setup(seed);
    h.run(5, NOOK);
    h.director.triggerFinale();
    const start = h.now();
    return { ...h, start };
  }

  it('runs surge, blackout and apparition on schedule', () => {
    const h = inFinale();
    expect(h.director.phase).toBe('finale');
    expect(h.times('powerSurge')).toEqual([h.start]);
    h.run(SHOWN_AT + 0.5, NOOK);
    expect(h.times('blackout')[0] - h.start).toBeCloseTo(HAUNT.surgeDuration, 1);
    expect(h.log.find((e) => e.name === 'blackout')!.payload).toEqual({ duration: HAUNT.surgeBlackout });
    expect(h.times('apparitionShown')[0] - h.start).toBeCloseTo(SHOWN_AT, 1);
    expect(h.log.find((e) => e.name === 'apparitionShown')!.payload).toEqual({
      position: ROOM.apparitionAnchor.position,
    });
    expect(h.director.apparitionVisible).toBe(true);
  });

  it('can start straight from the calm phase and from unease', () => {
    const calm = inFinale();
    expect(calm.times('powerSurge')).toHaveLength(1);
    const h = setup();
    h.run(HAUNT.calmDuration + 5, NOOK);
    h.director.triggerFinale();
    expect(h.director.phase).toBe('finale');
  });

  it('ignores a second trigger', () => {
    const h = inFinale();
    h.director.triggerFinale();
    h.run(1, NOOK);
    h.director.triggerFinale();
    expect(h.times('powerSurge')).toHaveLength(1);
  });

  it('stops knocks and flickers for good', () => {
    const h = setup(2);
    h.run(HAUNT.calmDuration + 5, NOOK);
    h.director.triggerFinale();
    h.run(SHOWN_AT + 15, NOOK);
    expect(h.times('knock')).toEqual([]);
    expect(h.times('flicker')).toEqual([]);
  });

  it('lunges after 0.4 s of being looked at, then vanishes', () => {
    const h = inFinale();
    h.run(SHOWN_AT + 0.1, NOOK);
    h.run(HAUNT.apparitionGazeTime - 0.1, FACING);
    expect(h.times('apparitionLunge')).toEqual([]);
    h.run(0.2, FACING);
    expect(h.times('apparitionLunge')).toHaveLength(1);
    expect(h.director.apparitionVisible).toBe(true);
    h.run(HAUNT.lungeDuration + 0.05, FACING);
    expect(h.times('apparitionVanished')).toHaveLength(1);
    expect(h.times('apparitionVanished')[0] - h.times('apparitionLunge')[0]).toBeCloseTo(HAUNT.lungeDuration, 1);
    expect(h.director.apparitionVisible).toBe(false);
  });

  it('reports where the player stood when it lunged', () => {
    const h = inFinale();
    h.run(SHOWN_AT + 0.1, NOOK);
    h.run(1, FACING);
    expect(h.log.find((e) => e.name === 'apparitionLunge')!.payload).toEqual({ toward: FACING.player });
  });

  it('accumulates gaze across interruptions', () => {
    const h = inFinale();
    h.run(SHOWN_AT + 0.1, NOOK);
    h.run(0.25, FACING);
    h.run(1, { ...FACING, yaw: 0 });
    expect(h.times('apparitionLunge')).toEqual([]);
    h.run(0.25, FACING);
    expect(h.times('apparitionLunge')).toHaveLength(1);
  });

  it('does not count gaze with the flashlight off, without line of sight, or outside 12 degrees', () => {
    for (const view of [
      { ...FACING, flashlightOn: false },
      { ...FACING, hasLineOfSight: () => false },
      { ...FACING, yaw: Math.PI + 0.3 },
    ]) {
      const h = inFinale();
      h.run(SHOWN_AT + 0.1, NOOK);
      h.run(3, view);
      expect(h.times('apparitionLunge')).toEqual([]);
    }
  });

  it('lunges when the player comes within 2.5 m, even in the dark and looking away', () => {
    const anchor = ROOM.apparitionAnchor.position;
    const at = (distance: number): View => ({
      player: { x: anchor.x + distance, y: EYE, z: anchor.z },
      yaw: 0,
      flashlightOn: false,
    });
    const far = inFinale();
    far.run(SHOWN_AT + 0.1, NOOK);
    far.run(2, at(2.6));
    expect(far.times('apparitionLunge')).toEqual([]);
    const near = inFinale();
    near.run(SHOWN_AT + 0.1, NOOK);
    near.run(0.1, at(2.4));
    expect(near.times('apparitionLunge')).toHaveLength(1);
  });

  it('loses patience and lunges if the player hides for too long', () => {
    const h = inFinale();
    h.run(SHOWN_AT + HAUNT.apparitionPatience - 1, NOOK);
    expect(h.times('apparitionLunge')).toEqual([]);
    h.run(1.5, NOOK);
    expect(h.times('apparitionLunge')).toHaveLength(1);
  });

  it('is done 3 s after vanishing and emits nothing more', () => {
    const h = inFinale();
    h.run(SHOWN_AT + 0.1, NOOK);
    h.run(1, FACING);
    const vanished = h.times('apparitionVanished')[0];
    h.run(HAUNT.endDelay - 0.5, FACING);
    expect(h.director.phase).toBe('finale');
    h.run(1, FACING);
    expect(h.director.phase).toBe('done');
    expect(h.now() - vanished).toBeGreaterThanOrEqual(HAUNT.endDelay);
    const count = h.log.length;
    h.run(60, FACING);
    expect(h.log.length).toBe(count);
  });

  it('counts every event it emits', () => {
    const h = inFinale();
    h.run(SHOWN_AT + 0.1, NOOK);
    h.run(1, FACING);
    expect(h.director.counts).toEqual({
      powerSurge: 1,
      blackout: 1,
      apparitionShown: 1,
      apparitionLunge: 1,
      apparitionVanished: 1,
    });
  });
});
