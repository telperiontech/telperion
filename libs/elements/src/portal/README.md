# `<tp-portal>` / `<tp-portal-outlet>`

Render content somewhere else in the document. Children of a `<tp-portal>` are **moved** (not cloned) into the `<tp-portal-outlet>` with the same `name`, so event listeners, element state and framework bindings keep working.

```html
<tp-portal name="foo">
  Foo Text
  <section>Foo inner content</section>
</tp-portal>

<!-- anywhere else in the document -->
<tp-portal-outlet name="foo"></tp-portal-outlet>
```

## Highlights

- Same nodes, moved: listeners, input values and component state go with the content.
- Framework-safe: React, Angular, Vue, Lit and others can keep rendering into the portal (see below).
- Uses the state-preserving [`moveBefore()`](https://developer.mozilla.org/docs/Web/API/Element/moveBefore) where supported, so focus, iframes and CSS animations survive the move. Elsewhere it falls back to a plain insertion.
- Order doesn't matter: the portal can connect before or after its outlet.
- Content returns to the portal when the outlet leaves, and leaves the outlet when the portal is removed.
- No Shadow DOM: projected content is styled by the CSS around the outlet.

## Attributes

### `<tp-portal>`

| Attribute   | Type      | Description                                                         |
| ----------- | --------- | ------------------------------------------------------------------- |
| `name`      | `string`  | Outlet name to project into. Changing it re-projects.               |
| `projected` | `boolean` | Read-only. Set while the content is inside an outlet.               |

Properties: `name`, `outlet` (the hosting outlet or `null`), `projectedNodes` (the content nodes, wherever they are).

### `<tp-portal-outlet>`

| Attribute | Type      | Description                                                    |
| --------- | --------- | -------------------------------------------------------------- |
| `name`    | `string`  | Name that portals target. Changing it re-registers the outlet. |
| `active`  | `boolean` | Read-only. Set while at least one portal projects here.        |

Properties: `name`, `portals` (portals projecting here, in order).

### `<tp-portal-outlet-fallback>`

Default content of an outlet. Place it as a **direct child** of a `<tp-portal-outlet>`: it is shown while no portal projects into the outlet, and hidden while one does (that is, while the outlet is `active`).

```html
<tp-portal-outlet name="toolbar">
  <tp-portal-outlet-fallback>
    <a href="/">Home</a>
  </tp-portal-outlet-fallback>
</tp-portal-outlet>
```

- It is `display: contents` by default, like the outlet.
- Hiding is driven by CSS (`tp-portal-outlet[active] > tp-portal-outlet-fallback { display: none !important }`), so its nodes stay in place and frameworks can keep rendering into it. The rule is `!important` on purpose: your own `display` styling can't reveal a fallback that should be hidden.
- Any attached portal hides it, even one with no content. To show the fallback, don't render the portal.

Properties: `shown` (whether the fallback is currently visible).

## Rules

- **No outlet**: the content stays inside the portal, which is `display: none` by default.
- **Several outlets with one name**: the most recently connected outlet is used. When it disconnects, the previous one takes over.
- **Several portals with one name**: all of them project into the outlet, in connection order, after the outlet's own children.
- **Outlet inside its own portal**: ignored, to avoid a cycle.
- The outlet is `display: contents` by default, so projected content lays out as a child of the outlet's parent. Both defaults use `:where()` (zero specificity) and are easy to override.

## Framework usage

Frameworks keep a reference to the portal as the *parent* of the nodes they render, and keep calling `appendChild`, `insertBefore`, `removeChild`, `replaceChild`, `textContent` or `innerHTML` on it after those nodes moved. Natively, this would throw `NotFoundError: The node to be removed is not a child of this node`. While projected, `<tp-portal>` forwards those calls to its range inside the outlet, so updates, reorders and removals land in the outlet.

Each portal's range in the outlet is delimited by two comment markers (`<!--tp-portal-->` … `<!--/tp-portal-->`). Frameworks that insert relative to a sibling (Angular, Vue) therefore insert inside the right range.

### React

```tsx
<tp-portal name="toolbar">
  <button onClick={save}>Save</button>
</tp-portal>

// elsewhere in the same React root
<tp-portal-outlet name="toolbar" />
```

React 17+ listens for events on the **root container**. `onClick` and other React handlers on portaled content only fire if the outlet is inside the same React root as the portal. Native listeners (`addEventListener`, refs) work anywhere. If the outlet lives outside the React tree, use `ReactDOM.createPortal` instead.

### Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to the component (as with any custom element). `(click)` and other bindings are attached directly to the elements, so they work wherever the outlet is.

```html
<tp-portal name="toolbar">
  <button (click)="save()">Save</button>
</tp-portal>
```

### Caveats

- While projected, the portal itself has no children, so `portal.querySelector()` / `portal.children` find nothing. Use `portal.projectedNodes` or query the outlet.
- Moving nodes without `moveBefore()` support resets iframes and media playback, and fires `disconnectedCallback` / `connectedCallback` on moved custom elements.
- CSS that relies on the portal's ancestors (e.g. `.sidebar button`) won't match after projection; style for the outlet's location instead.
