import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { AMBIENCE_DB, type AudioEngine } from './AudioEngine';

/** Level the ambience drops to just before the apparition: silence makes the scare land. */
export const SILENCE_DB = -60;

const FOOTSTEP_DB = -14;
const SPRINT_BOOST_DB = 3;

export type AudioPlayer = Pick<AudioEngine, 'play' | 'duckAmbience'>;

/**
 * Turns game events into sounds. `rng` only varies how sounds are played (pitch),
 * never gameplay, so it is separate from the gameplay random generator.
 */
export function bindAudio(bus: EventBus<GameEvents>, audio: AudioPlayer, rng: () => number): () => void {
  const offs = [
    bus.on('player:footstep', ({ sprinting }) =>
      audio.play('footstep', {
        gainDb: FOOTSTEP_DB + (sprinting ? SPRINT_BOOST_DB : 0),
        rate: 0.9 + 0.2 * rng(), // never the exact same step twice
      }),
    ),
    bus.on('haunt:knock', ({ position }) => audio.play('knock', { position })),
    bus.on('haunt:flicker', () => audio.play('flickerBuzz')),
    bus.on('haunt:powerSurge', () => audio.play('powerSurge')),
    bus.on('haunt:apparitionShown', () => audio.duckAmbience(SILENCE_DB, 0.2)),
    bus.on('haunt:apparitionVanished', () => {
      audio.play('sting');
      audio.duckAmbience(AMBIENCE_DB, 2);
    }),
  ];
  return () => offs.forEach((off) => off());
}
