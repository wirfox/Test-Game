import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus';

interface TestEvents {
  ping: { n: number };
  pong: Record<string, never>;
}

afterEach(() => vi.restoreAllMocks());

describe('EventBus', () => {
  it('delivers to listeners in subscription order', () => {
    const bus = new EventBus<TestEvents>();
    const seen: string[] = [];
    bus.on('ping', () => seen.push('a'));
    bus.on('ping', () => seen.push('b'));
    bus.emit('ping', { n: 1 });
    expect(seen).toEqual(['a', 'b']);
  });

  it('passes the payload through', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    bus.on('ping', fn);
    bus.emit('ping', { n: 7 });
    expect(fn).toHaveBeenCalledWith({ n: 7 });
  });

  it('returns a function that unsubscribes', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    const off = bus.on('ping', fn);
    off();
    bus.emit('ping', { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('only notifies listeners of the emitted event', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    bus.on('pong', fn);
    bus.emit('ping', { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('keeps notifying after a listener throws and logs the error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new EventBus<TestEvents>();
    const after = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', after);
    expect(() => bus.emit('ping', { n: 1 })).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('tolerates a listener unsubscribing itself during emit', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const off = bus.on('ping', () => off());
    bus.on('ping', second);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(second).toHaveBeenCalledTimes(2);
  });
});
