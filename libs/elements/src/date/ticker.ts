type Listener = () => void;

interface Channel {
  listeners: Set<Listener>;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * One shared clock for every `<tp-date>`. Elements subscribe with the period
 * they need; each period gets a single timer aligned to its boundaries (e.g.
 * the start of every minute), so a page full of dates updates in sync with a
 * handful of timers. `setTimeout` is re-armed from the real clock on every
 * tick, so it never drifts the way `setInterval` does.
 *
 * Timers stop while the document is hidden and every subscriber is notified
 * right away when it becomes visible again.
 */
const channels = new Map<number, Channel>();
let visibilityBound = false;

/** Subscribes `listener` to ticks every `period` ms. Returns the unsubscribe function. */
export function subscribe(period: number, listener: Listener): () => void {
  let channel = channels.get(period);

  if (!channel) {
    channel = { listeners: new Set() };
    channels.set(period, channel);
  }

  channel.listeners.add(listener);
  bindVisibility();
  arm(period, channel);

  return () => {
    channel.listeners.delete(listener);

    if (channel.listeners.size === 0) {
      clearTimeout(channel.timer);
      channels.delete(period);
    }
  };
}

function arm(period: number, channel: Channel): void {
  if (channel.timer !== undefined || isHidden()) return;

  channel.timer = setTimeout(() => {
    channel.timer = undefined;
    notify(channel);

    if (channels.get(period) === channel) arm(period, channel);
  }, period - (Date.now() % period));
}

function notify(channel: Channel): void {
  for (const listener of [...channel.listeners]) listener();
}

function isHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function bindVisibility(): void {
  if (visibilityBound || typeof document === "undefined") return;

  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    // Snapshot: listeners may move to another period while being notified.
    for (const [period, channel] of [...channels]) {
      if (isHidden()) {
        clearTimeout(channel.timer);
        channel.timer = undefined;
      } else {
        notify(channel);

        if (channels.get(period) === channel) arm(period, channel);
      }
    }
  });
}
