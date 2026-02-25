/**
 * Angular Event Manager Plugin that enables event modifier syntax in templates.
 *
 * @example
 * ```html
 * <form (submit.pd)="onSubmit()">...</form>
 * <div (click.sp)="handleClick()">...</div>
 * <button (click.pd.sp)="handleButtonClick()">Click me</button>
 * ```
 */

import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, Provider } from '@angular/core';
import { EVENT_MANAGER_PLUGINS, EventManagerPlugin } from '@angular/platform-browser';

/**
 * Event Manager Plugin that adds support for event modifiers.
 * @internal
 */
@Injectable()
export class EventModifiersPlugin extends EventManagerPlugin {
  /**
   * Supported modifiers: `pd` (preventDefault), `sp` (stopPropagation)
   */
  private static modifierMap: { [key: string]: (e: Event) => void } = {
    'pd': (e: Event) => e.preventDefault(),
    'sp': (e: Event) => e.stopPropagation(),
  };

  constructor(@Inject(DOCUMENT) doc: Document) {
    super(doc);
  }

  supports(eventName: string): boolean {
    return eventName.includes('.') &&
      eventName.split('.').some(part => part in EventModifiersPlugin.modifierMap);
  }

  addEventListener(element: HTMLElement, eventName: string, handler: (event: Event) => void): () => void {
    const parts = eventName.split('.');
    const domEventName = parts[0];
    const modifiers = parts.slice(1).filter(m => m in EventModifiersPlugin.modifierMap);

    const wrappedHandler = (event: Event) => {
      modifiers.forEach(mod => EventModifiersPlugin.modifierMap[mod](event));

      return handler(event);
    };

    element.addEventListener(domEventName, wrappedHandler);

    return () => element.removeEventListener(domEventName, wrappedHandler);
  }
}

/**
 * Provides the Event Modifiers Plugin.
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [provideEventModifiersPlugin()]
 * });
 * ```
 */
export function provideEventModifiersPlugin(): Provider {
  return {
    provide: EVENT_MANAGER_PLUGINS,
    useClass: EventModifiersPlugin,
    multi: true
  };
}
