import { firstValueFrom, merge, Observable, ReplaySubject } from 'rxjs';
import { filter, map, takeWhile } from 'rxjs/operators';

import { MessageClient } from './message-client';
import { GET_NEW_ID, RESPONSES$, SEND } from './selectors';
import { ErrorMessageResponse, MessageResponse, SuccessfulMessageResponse, UncompletedMessageResponse } from './message-response.type';

/**
 * Options of the {@link Request} decorator
 */
export interface RequestOptions {
  /**
   * Return a `Promise` of the first response instead of an `Observable` of all responses
   *
   * The promise resolves with the first response, rejects with the error the host or the transport reports,
   * and rejects with rxjs' `EmptyError` when the host completes without responding.
   * Type the stub's return value as a `Promise`.
   *
   * @default false
   */
  single?: boolean;
}

/**
 * Decorator of a {@link Request} stub that returns a `Promise` (`{ single: true }`)
 */
export type SingleRequestDecorator = <T extends (...args: never[]) => Promise<unknown>>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<T>,
) => TypedPropertyDescriptor<T> | void;

/**
 * Turns a method stub of a {@link MessageClient} into a request to the hosts listening on `path`
 *
 * The request is sent **eagerly**, when the method is called, not when the returned `Observable` is subscribed:
 * calling the method without subscribing still sends the message (and subscribing twice does not send it twice).
 * Subscribe right away, because responses that arrive before the subscription are not replayed.
 *
 * By default the stub returns an `Observable` that emits every response and completes when the host completes.
 * With `{ single: true }` it returns a `Promise` of the first response instead; see {@link RequestOptions.single}.
 *
 * ```typescript
 * class Client extends IframeMessageClient {
 *   @Request('progress')
 *   progress(jobId: string): Observable<number> {
 *     return null!;
 *   }
 *
 *   @Request('done', { single: true })
 *   done(result: Result): Promise<boolean> {
 *     return null!;
 *   }
 * }
 *
 * const accepted = await client.done(result);
 * ```
 *
 * @param path Acts like an api endpoint path of an XHR for extensions messaging
 * @param options Whether to return a `Promise` of the first response
 */
export function Request(path: string, options: RequestOptions & { single: true }): SingleRequestDecorator;
export function Request(path: string, options?: RequestOptions): MethodDecorator;
export function Request(path: string, { single = false }: RequestOptions = {}): MethodDecorator {
  return function(target, key, descriptor: TypedPropertyDescriptor<any>): TypedPropertyDescriptor<any> {
    descriptor.value = function(this: MessageClient, message: any) {
      const messageId = this[GET_NEW_ID]();
      // Replays a send failure so it reaches the caller even if they subscribe late.
      const sendFailure$ = new ReplaySubject<MessageResponse>(1);
      const response$ = responsesOf(merge(this[RESPONSES$], sendFailure$), messageId);
      // A promise subscribes before sending, so a response that arrives synchronously is not missed
      const result = single ? firstValueFrom(response$) : response$;
      const send = () => this[SEND]({ body: message, id: messageId, path });
      // A promise-returning stub must not throw synchronously: a throwing send becomes a rejection
      const sent = single ? new Promise<void>(resolve => resolve(send())) : Promise.resolve(send());

      sent.catch(error => sendFailure$.next({ id: messageId, completed: true, error }));

      return result;
    };

    return descriptor;
  };
}

/**
 * Bodies of the responses to one message, until the host completes or reports an error
 */
function responsesOf(responses$: Observable<MessageResponse>, messageId: string): Observable<unknown> {
  return responses$.pipe(
    filter(({id}) => id === messageId),
    map((data) => {
      const { error } = data as ErrorMessageResponse;

      if (error) throw error;

      return data as SuccessfulMessageResponse;
    }),
    takeWhile((res) => !res.completed),
    map(({ body }: UncompletedMessageResponse) => body),
  );
}
