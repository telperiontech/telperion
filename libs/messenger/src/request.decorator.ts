import { merge, ReplaySubject } from 'rxjs';
import { filter, map, takeWhile } from 'rxjs/operators';

import { MessageClient } from './message-client';
import { GET_NEW_ID, RESPONSES$, SEND } from './selectors';
import { ErrorMessageResponse, MessageResponse, SuccessfulMessageResponse, UncompletedMessageResponse } from './message-response.type';

export function Request(path: string): MethodDecorator {
  return function(target, key, descriptor: TypedPropertyDescriptor<any>): TypedPropertyDescriptor<any> {
    descriptor.value = function(this: MessageClient, message: any) {
      const messageId = this[GET_NEW_ID]();
      // Replays a send failure so it reaches the caller even if they subscribe late.
      const sendFailure$ = new ReplaySubject<MessageResponse>(1);

      Promise.resolve(this[SEND]({ body: message, id: messageId, path }))
        .catch(error => sendFailure$.next({ id: messageId, completed: true, error }));

      return merge(this[RESPONSES$], sendFailure$).pipe(
        filter(({id}) => id === messageId),
        map((data) => {
          const { error } = data as ErrorMessageResponse;

          if (error) throw error;

          return data as SuccessfulMessageResponse;
        }),
        takeWhile((res) => !res.completed),
        map(({ body }: UncompletedMessageResponse) => body),
      );
    };

    return descriptor;
  };
}
