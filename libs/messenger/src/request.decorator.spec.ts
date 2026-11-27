import { TestScheduler } from 'rxjs/testing';
import { EMPTY, EmptyError, from, lastValueFrom, NEVER, Observable, Subject } from 'rxjs';
import { vi } from 'vitest';

import { Message } from './message.interface';
import { MessageResponse } from './message-response.type';
import { Request } from './request.decorator';
import { GET_NEW_ID, RESPONSES$, SEND } from './selectors';

function getTestScheduler() {
  return new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });
}

describe('Request Decorator', () => {
  class Foo {
    @Request('bar')
    public baz(message: string) {
      return null;
    }
  }

  it('should initialize properly', () => {
    expect(Foo.prototype.baz).toBeTruthy();
  });

  it('should use send method of the client to send messages', () => {
    const instance = new Foo();

    (instance as any)[GET_NEW_ID] = vi.fn().mockReturnValue('1');
    (instance as any)[SEND] = vi.fn();
    (instance as any)[RESPONSES$] = EMPTY;

    const res = instance.baz('test message');

    expect((instance as any)[GET_NEW_ID]).toBeCalledTimes(1);
    expect((instance as any)[SEND]).toBeCalledTimes(1);
    expect((instance as any)[SEND]).toBeCalledWith({ body: 'test message', id: '1', path: 'bar' } as Message);
    expect(res).toBeInstanceOf(Observable);
  });

  it('should return only body of the message', () => {
    const testScheduler = getTestScheduler();

    testScheduler.run(({ cold, expectObservable }) => {
      const instance = new Foo();

      (instance as any)[GET_NEW_ID] = vi.fn().mockReturnValue('1');
      (instance as any)[SEND] = vi.fn();
      (instance as any)[RESPONSES$] = cold('a-b|', {
        a: { body: 'heyy', id: '1', completed: false },
        b: { id: '1', completed: true },
      });

      const res = instance.baz('test message');

      expectObservable(res!).toBe('a-|', { a: 'heyy' });
    });
  });

  it('should listen until complete message received', () => {
    const testScheduler = getTestScheduler();

    testScheduler.run(({ cold, expectObservable }) => {
      const instance = new Foo();

      (instance as any)[GET_NEW_ID] = vi.fn().mockReturnValue('1');
      (instance as any)[SEND] = vi.fn();
      (instance as any)[RESPONSES$] = cold('-a-b-c-d|', {
        a: { body: 'heyy', id: '1', completed: false },
        b: { body: 'telperion', id: '1', completed: false },
        c: { body: 'rocks', id: '1', completed: false },
        d: { id: '1', completed: true },
      });

      const res = instance.baz('test message');

      expectObservable(res!).toBe('-a-b-c-|', {
        a: 'heyy',
        b: 'telperion',
        c: 'rocks',
      });
    });
  });

  describe('when send fails', () => {
    function createFailingInstance() {
      const instance = new Foo();
      const error = new Error('send failed');

      (instance as any)[GET_NEW_ID] = vi.fn().mockReturnValue('1');
      (instance as any)[SEND] = vi.fn().mockRejectedValue(error);
      (instance as any)[RESPONSES$] = NEVER;

      return { instance, error };
    }

    it('should error the returned stream', async () => {
      const { instance, error } = createFailingInstance();

      await expect(lastValueFrom(instance.baz('test message')!)).rejects.toBe(error);
    });

    it('should deliver the error to a late subscriber', async () => {
      const { instance, error } = createFailingInstance();
      const res = instance.baz('test message')!;

      await new Promise(resolve => setTimeout(resolve));

      await expect(lastValueFrom(res)).rejects.toBe(error);
    });
  });

  /** Gives a decorated instance the client members `@Request` uses */
  function mockClient<T extends object>(instance: T, responses$: Observable<MessageResponse>, send: (message: Message) => unknown = vi.fn()): T {
    return Object.assign(instance, {
      [GET_NEW_ID]: vi.fn().mockReturnValue('1'),
      [SEND]: send,
      [RESPONSES$]: responses$,
    });
  }

  it('should send eagerly, when the method is called, and only once', () => {
    const send = vi.fn();
    const instance = mockClient(new Foo(), NEVER, send);
    const res = instance.baz('test message') as unknown as Observable<unknown>;

    expect(send).toBeCalledTimes(1);

    res.subscribe().unsubscribe();
    res.subscribe().unsubscribe();

    expect(send).toBeCalledTimes(1);
  });

  describe('with { single: true }', () => {
    class Single {
      @Request('bar', { single: true })
      public baz(_message: string): Promise<string> {
        return null!;
      }

      @Request('bar', { single: true })
      public nothing(): Promise<void> {
        return null!;
      }
    }

    function createInstance(responses$: Observable<MessageResponse>, send?: (message: Message) => unknown) {
      return mockClient(new Single(), responses$, send);
    }

    it('should return a promise of the first response', async () => {
      const responses$ = new Subject<MessageResponse>();
      const instance = createInstance(responses$);
      const res = instance.baz('test message');

      expect(res).toBeInstanceOf(Promise);

      responses$.next({ id: '2', body: 'not mine', completed: false });
      responses$.next({ id: '1', body: 'first', completed: false });
      responses$.next({ id: '1', body: 'second', completed: false });

      await expect(res).resolves.toBe('first');
    });

    it('should send eagerly with the message', () => {
      const send = vi.fn();
      const instance = createInstance(NEVER, send);

      void instance.baz('test message');

      expect(send).toBeCalledTimes(1);
      expect(send).toBeCalledWith({ body: 'test message', id: '1', path: 'bar' } as Message);
    });

    it('should stop listening after the first response', async () => {
      const responses$ = new Subject<MessageResponse>();
      const instance = createInstance(responses$);
      const res = instance.baz('test message');

      responses$.next({ id: '1', body: 'first', completed: false });
      await res;

      expect(responses$.observed).toBe(false);
    });

    it('should not miss a response that arrives while sending', async () => {
      const responses$ = new Subject<MessageResponse>();
      const send = vi.fn(({ id }: Message) => responses$.next({ id, body: 'sync', completed: false }));
      const instance = createInstance(responses$, send);

      await expect(instance.baz('test message')).resolves.toBe('sync');
    });

    it('should resolve with undefined when the host responds with undefined', async () => {
      // A `@Listen` handler returning `void` or `Promise<void>` responds with `undefined`, then completes
      const instance = createInstance(from<MessageResponse[]>([{ id: '1', body: undefined, completed: false }, { id: '1', completed: true }]));

      await expect(instance.nothing()).resolves.toBeUndefined();
    });

    it('should reject with the error the host reports', async () => {
      const error = new Error('host failed');
      const instance = createInstance(from<MessageResponse[]>([{ id: '1', completed: true, error }]));

      await expect(instance.baz('test message')).rejects.toBe(error);
    });

    it('should reject with EmptyError when the host completes without a response', async () => {
      const instance = createInstance(from<MessageResponse[]>([{ id: '1', completed: true }]));

      await expect(instance.baz('test message')).rejects.toBeInstanceOf(EmptyError);
    });

    it('should reject when sending fails', async () => {
      const error = new Error('send failed');
      const instance = createInstance(NEVER, vi.fn().mockRejectedValue(error));

      await expect(instance.baz('test message')).rejects.toBe(error);
    });

    it('should reject instead of throwing when sending throws synchronously', async () => {
      const error = new Error('send threw');
      const instance = createInstance(NEVER, vi.fn(() => {
        throw error;
      }));
      let res: Promise<string> | undefined;

      expect(() => {
        res = instance.baz('test message');
      }).not.toThrow();
      await expect(res).rejects.toBe(error);
    });
  });

  describe('typing', () => {
    it('should only accept promise-returning stubs with { single: true }', () => {
      class Typed {
        @Request('ok', { single: true })
        promise(): Promise<boolean> {
          return null!;
        }

        // @ts-expect-error a single request stub must return a Promise
        @Request('wrong', { single: true })
        observable(): Observable<boolean> {
          return null!;
        }

        @Request('default')
        stream(): Observable<boolean> {
          return null!;
        }
      }

      expect(Typed).toBeTruthy();
    });
  });
});
