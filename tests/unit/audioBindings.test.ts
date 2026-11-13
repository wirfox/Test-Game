import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { SILENCE_DB, bindAudio, type AudioPlayer } from '../../src/audio/audioBindings';
import { AMBIENCE_DB } from '../../src/audio/AudioEngine';

type Call = { fn: 'play' | 'duck'; args: unknown[] };

function setup() {
  const calls: Call[] = [];
  const audio: AudioPlayer = {
    play: (...args) => calls.push({ fn: 'play', args }),
    duckAmbience: (...args) => calls.push({ fn: 'duck', args }),
  };
  const bus = new EventBus<GameEvents>();
  const off = bindAudio(bus, audio, () => 0.5);
  return { calls, bus, off };
}

describe('bindAudio', () => {
  it('plays a footstep at walking level with a pitch inside ±10 %', () => {
    const { calls, bus } = setup();
    bus.emit('player:footstep', { position: { x: 0, y: 0, z: 0 }, sprinting: false });
    expect(calls).toHaveLength(1);
    const [id, opts] = calls[0].args as [string, { gainDb: number; rate: number; position?: unknown }];
    expect(id).toBe('footstep');
    expect(opts.gainDb).toBe(-14);
    expect(opts.rate).toBeGreaterThanOrEqual(0.9);
    expect(opts.rate).toBeLessThanOrEqual(1.1);
    expect(opts.position).toBeUndefined();
  });

  it('plays sprinting footsteps 3 dB louder', () => {
    const { calls, bus } = setup();
    bus.emit('player:footstep', { position: { x: 0, y: 0, z: 0 }, sprinting: true });
    expect((calls[0].args[1] as { gainDb: number }).gainDb).toBe(-11);
  });

  it('places knocks at their position in the room', () => {
    const { calls, bus } = setup();
    const position = { x: 1, y: 1.2, z: 2 };
    bus.emit('haunt:knock', { position });
    expect(calls).toEqual([{ fn: 'play', args: ['knock', { position }] }]);
  });

  it('maps flicker and power surge to their sounds', () => {
    const { calls, bus } = setup();
    bus.emit('haunt:flicker', { duration: 0.6 });
    bus.emit('haunt:powerSurge', {});
    expect(calls.map((c) => c.args[0])).toEqual(['flickerBuzz', 'powerSurge']);
  });

  it('drops the ambience to near silence before the apparition shows', () => {
    const { calls, bus } = setup();
    bus.emit('haunt:apparitionShown', { position: { x: 0, y: 0, z: 0 } });
    expect(calls).toEqual([{ fn: 'duck', args: [SILENCE_DB, 0.2] }]);
  });

  it('starts the sting on the lunge, then brings the ambience back once it has vanished', () => {
    const { calls, bus } = setup();
    bus.emit('haunt:apparitionLunge', { toward: { x: 0, y: 0, z: 0 } });
    bus.emit('haunt:apparitionVanished', {});
    expect(calls).toEqual([
      { fn: 'play', args: ['sting'] },
      { fn: 'duck', args: [AMBIENCE_DB, 2] },
    ]);
  });

  it('stops reacting after unbinding', () => {
    const { calls, bus, off } = setup();
    off();
    bus.emit('haunt:flicker', { duration: 1 });
    expect(calls).toEqual([]);
  });
});
