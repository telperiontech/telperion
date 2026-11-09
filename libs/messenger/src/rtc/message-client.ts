import { uniqueId } from '@telperion/js-utils/unique-id';
import { noop } from '@telperion/js-utils/function/noop';
import { NEVER } from '@telperion/js-utils/promise/never';
import { Subject } from 'rxjs';

import { MessageClient } from '../message-client';
import { MessageResponse } from '../message-response.type';
import { Message } from '../message.interface';
import { GET_NEW_ID, RESPONSES$, SEND } from '../selectors';
import { RTCConnectionArg } from './rtc.type';
import { DEFAULT_CHANNEL_NAME } from './default-channel-name';
import { initialize } from './initializer';

const CHANNEL_NAME = Symbol('RTCMessageClient Channel Name');
const CHANNEL = Symbol('RTCMessageClient Channel');
const CHANNEL_OPEN = Symbol('RTCMessageClient Channel Open');
const DEINITIALIZE = Symbol('RTCMessageClient Deinitialize');
const PENDING = Symbol('RTCMessageClient Pending Requests');
const FAIL_PENDING = Symbol('RTCMessageClient Fail Pending Requests');
export const READY = Symbol('RTCMessageClient Ready');
export const CREATED = Symbol('RTCMessageClient Created');

/**
 * WebRTC DataChannel message client that sends request messages and receives
 * responses over a negotiated channel.
 *
 * Both peers must create the channel with an identical name and negotiated ID.
 * The ID is derived automatically from the channel name via an FNV-1a hash
 * unless an explicit `channelId` is supplied.
 *
 * Use `@Request` decorators to define outgoing RPC methods. The client can be
 * constructed without a connection and initialized later via {@link initialize}.
 *
 * @example
 * ```typescript
 * class GameClient extends RTCMessageClient {
 *   @Request('move')
 *   sendMove(position: [number, number]): Observable<boolean> {
 *     return null!;
 *   }
 * }
 *
 * const client = new GameClient(peerConnection, 'game-events');
 * client.sendMove([3, 4]).subscribe(ok => console.log('Accepted:', ok));
 * ```
 */
export class RTCMessageClient extends MessageClient {
  public [RESPONSES$] = new Subject<MessageResponse>();
  private [CHANNEL_NAME]: string;
  private [CHANNEL]: Promise<RTCDataChannel> = NEVER;
  private [CHANNEL_OPEN]: Promise<RTCDataChannel> = NEVER;
  private [DEINITIALIZE]: Promise<() => void> = Promise.resolve(noop);
  /** IDs of requests sent (or waiting to send) that have not completed yet. */
  private [PENDING] = new Set<string>();

  private get [CREATED]() {
    return this[CHANNEL];
  }

  /** Resolves with the `RTCDataChannel` once it has been created (may not yet be open). */
  get created(): Promise<RTCDataChannel> {
    return this[CREATED];
  }

  private get [READY](): Promise<RTCDataChannel> {
    return this[CHANNEL_OPEN];
  }

  /** Resolves with the `RTCDataChannel` once it is open and ready to transmit. */
  get ready(): Promise<RTCDataChannel> {
    return this[READY];
  }

  /**
   * @param connection  - RTCPeerConnection instance, promise, or factory function. Omit to initialize later via {@link initialize}.
   * @param channelName - Name for the negotiated data channel. Determines the channel ID via FNV-1a hash.
   * @param channelId   - Explicit negotiated channel ID. Overrides the hash-derived default.
   */
  constructor(
    connection?: RTCConnectionArg,
    channelName = DEFAULT_CHANNEL_NAME,
    channelId?: number
  ) {
    super();

    this[CHANNEL_NAME] = channelName;
    this[RESPONSES$].subscribe(({ id, completed }) => {
      if (completed) this[PENDING].delete(id);
    });
    RTCMessageClient.prototype.initialize.call(this, connection, channelId);
  }

  /**
   * (Re)initializes the data channel with a new connection.
   * Waits for the previous channel to be cleaned up (with a 5 s timeout)
   * before establishing the new one.
   *
   * @param connection - RTCPeerConnection instance, promise, or factory function.
   * @param channelId  - Optional negotiated channel ID. Defaults to the hash-derived ID.
   */
  initialize(connection?: RTCConnectionArg, channelId?: number): void {
    initialize({
      context: this,
      selectors: {
        channel: CHANNEL,
        channelOpen: CHANNEL_OPEN,
        deinit: DEINITIALIZE,
        emitter: RESPONSES$
      },
      connection,
      channelName: this[CHANNEL_NAME],
      channelId,
      messageFilterType: 'response',
      onClose: () => this[FAIL_PENDING]()
    });
  }

  public async [SEND]<T>(message: Message<T>) {
    this[PENDING].add(message.id);

    try {
      const dataChannel = await this[CHANNEL_OPEN];

      if (dataChannel.readyState !== 'open') {
        throw new Error(`RTCMessageClient: data channel is ${dataChannel.readyState}`);
      }

      dataChannel.send(JSON.stringify({...message, type: 'request' }));
    } catch (error) {
      this[PENDING].delete(message.id);
      throw error;
    }
  }

  /** Errors every in-flight request, since no response can arrive on a closed channel. */
  private [FAIL_PENDING](): void {
    const error = new Error('RTCMessageClient: data channel closed');
    const ids = [...this[PENDING]];

    this[PENDING].clear();

    for (const id of ids) {
      this[RESPONSES$].next({ id, completed: true, error });
    }
  }

  protected [GET_NEW_ID](): string {
    return uniqueId('messenger-rtc-message');
  }
}
