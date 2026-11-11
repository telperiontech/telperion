# Router Components

A set of web components for client-side routing in single-page applications, built with Lit and signals for reactive state management.

## Overview

The router system provides declarative, template-based routing without requiring JavaScript configuration. Routes are defined using custom elements directly in your HTML, and the router automatically handles navigation, URL matching, and content rendering.

### Key Features

- **Declarative routing**: Define routes using HTML elements
- **Template-based content**: Route content is defined in `<template>` elements
- **Remote content**: Load a route's HTML from a URL with `src`, fetched lazily and cached
- **Multiple history strategies**: Browser History API, hash-based, or memory-based
- **Active link detection**: Automatically highlights active navigation links
- **Relative navigation**: Support for relative paths (`./`, `../`)
- **URLPattern matching**: Powerful pattern matching with dynamic segments
- **Reactive updates**: Built on signals for efficient rendering

## Components

### `<tp-router>`

The main router component that manages routing for a section of your application.

**Attributes:**
- `history` (optional): History management strategy - `"browser"` (default), `"hash"`, `"memory"`, or `"memory:name"`

**Example:**
```html
<tp-router history="browser">
  <tp-route path="/"><template><h1>Home</h1></template></tp-route>
  <tp-route path="/about"><template><h1>About</h1></template></tp-route>
  <tp-router-outlet></tp-router-outlet>
</tp-router>
```

### `<tp-route>`

Defines a route with a URL pattern and its content: an inline template, or a URL to load it from.

**Attributes:**
- `path` (required): URL pattern using URLPattern syntax (e.g., `/users/:id`)
- `src` (optional): URL of an HTML file to use as the content, loaded the first time the route matches (see [Remote Content](#remote-content))
- `loading` / `loaded` / `error` (readonly): Reflect the status of the `src` content

**Properties:**
- `loader`: Function `(url, signal) => Promise<string>` that fetches the `src` content (defaults to `fetch`)

**Events:**
- `tp-route-load`: The `src` content loaded. `detail: { src }`
- `tp-route-error`: The `src` content failed to load. `detail: { src, error }`

**Content:**
- A `<template>` element with the content to render (unless `src` is set)
- Optional `<template data-loading>` and `<template data-error>` elements, used with `src`

**Example:**
```html
<tp-route path="/users/:id">
  <template>
    <h1>User Profile</h1>
  </template>
</tp-route>
```

### `<tp-router-outlet>`

Renders the content of the active route.

**Attributes:**
- `for` (optional): ID of a specific router to bind to (otherwise binds to nearest parent)
- `routepath` (readonly): Reflects the current route's path
- `routeid` (readonly): Reflects the current route's ID
- `param-*` (readonly): Dynamic attributes for each route parameter (e.g., `param-id`, `param-year`)
- `route-loading` (readonly): Present while the active route's `src` content is loading
- `route-error` (readonly): Present when the active route's `src` content failed to load

**Properties:**
- `params`: Object containing all current route parameters

**Example 1: Inside tp-router element**
```html
<tp-router>
  <tp-route path="/"><template><h1>Home</h1></template></tp-route>
  <tp-route path="/about"><template><h1>About</h1></template></tp-route>
  <!-- Outlet automatically binds to parent router -->
  <tp-router-outlet></tp-router-outlet>
</tp-router>
```

**Example 2: Outside tp-router element**
```html
<!-- Router with ID -->
<tp-router id="main-router">
  <tp-route path="/"><template><h1>Home</h1></template></tp-route>
  <tp-route path="/about"><template><h1>About</h1></template></tp-route>
</tp-router>

<!-- Outlet outside router, binds using 'for' attribute -->
<tp-router-outlet for="main-router"></tp-router-outlet>
```

**Example 3: Accessing route parameters**
```html
<tp-router>
  <tp-route path="/products/:category/:id">
    <template>
      <h1>Product Details</h1>
      <!-- Use tp-router-param for declarative access -->
      <p>Category: <tp-router-param name="category"></tp-router-param></p>
      <p>Product ID: <tp-router-param name="id"></tp-router-param></p>
    </template>
  </tp-route>
  <tp-router-outlet id="product-outlet"></tp-router-outlet>
</tp-router>

<script>
  // Or access params programmatically via the outlet
  const outlet = document.getElementById('product-outlet');
  console.log(outlet.params); // { category: 'electronics', id: '123' }
  console.log(outlet.getAttribute('param-category')); // 'electronics'
  console.log(outlet.getAttribute('param-id')); // '123'
</script>
```

**Example 4: Nested outlets with parameter inheritance**
```html
<tp-router>
  <tp-route path="/projects/:projectId">
    <template>
      <h1>Project <tp-router-param name="projectId"></tp-router-param></h1>
      
      <!-- Nested outlet inherits projectId parameter -->
      <tp-router-outlet>
        <tp-route path="/tasks/:taskId">
          <template>
            <!-- Both parameters available -->
            <p>Project: <tp-router-param name="projectId"></tp-router-param></p>
            <p>Task: <tp-router-param name="taskId"></tp-router-param></p>
          </template>
        </tp-route>
      </tp-router-outlet>
    </template>
  </tp-route>
  <tp-router-outlet></tp-router-outlet>
</tp-router>
```

### `<tp-router-link>`

Navigation link that performs client-side routing without page reloads.

**Attributes:**
- `to` (required): Navigation target - absolute path (`/about`), relative path (`./details`, `../users`), or history symbol (`back`, `forward`)
- `history` (optional): Specific history instance to use
- `active` (readonly): Reflects whether the link matches the current route

**Example:**
```html
<!-- Absolute paths -->
<tp-router-link to="/">Home</tp-router-link>
<tp-router-link to="/about">About</tp-router-link>

<!-- Relative paths -->
<tp-router-link to="./details">Details</tp-router-link>
<tp-router-link to="..">Back to Users</tp-router-link>

<!-- History navigation -->
<tp-router-link to="back">← Back</tp-router-link>
<tp-router-link to="forward">Forward →</tp-router-link>

<!-- Style active links with CSS -->
<style>
  tp-router-link[active] {
    font-weight: bold;
    color: blue;
  }
</style>
```

### `<tp-router-param>`

Displays the value of a dynamic route parameter.

**Attributes:**
- `name` (required): The parameter name to display (must match a parameter in the route path)

**Requirements:**
- Must be used inside a `<tp-router-outlet>` element
- Parameter name must exist in the current route's path pattern

**Example:**
```html
<tp-router>
  <tp-route path="/users/:id">
    <template>
      <h1>User Profile</h1>
      <p>User ID: <tp-router-param name="id"></tp-router-param></p>
    </template>
  </tp-route>
  <tp-router-outlet></tp-router-outlet>
</tp-router>

<!-- Navigating to /users/123 displays: User ID: 123 -->
```

**Multiple Parameters:**
```html
<tp-route path="/blog/:year/:month/:slug">
  <template>
    <article>
      <time>
        <tp-router-param name="year"></tp-router-param>-
        <tp-router-param name="month"></tp-router-param>
      </time>
      <h1><tp-router-param name="slug"></tp-router-param></h1>
    </article>
  </template>
</tp-route>

<!-- /blog/2024/12/hello-world displays: 2024-12 and hello-world -->
```

**Styling Parameters:**
```html
<style>
  tp-router-param {
    font-weight: bold;
    color: var(--primary-color);
  }
  
  tp-router-param[name="id"] {
    font-family: monospace;
  }
</style>
```

### `<tp-router-config>`

Configuration element for managing router history settings. Behavior depends on placement:

**In `<head>` (Global Configuration):**
- Sets the default history strategy for all routers
- Affects routers that don't specify their own history
- Only one should be placed in `<head>`

**In `<body>` (Local Configuration):**
- Provides history to descendant routers only
- Allows different sections to use different strategies
- Can have multiple instances for different sections

**Attributes:**
- `history`: History strategy - `"browser"` (default), `"hash"`, `"memory"`, or `"memory:name"`

**Example (Global):**
```html
<head>
  <!-- All routers use hash by default -->
  <tp-router-config history="hash"></tp-router-config>
</head>
```

**Example (Local):**
```html
<body>
  <!-- Section 1: Hash routing -->
  <tp-router-config history="hash">
    <tp-router>...</tp-router>
  </tp-router-config>
  
  <!-- Section 2: Memory routing (isolated) -->
  <tp-router-config history="memory">
    <tp-router>...</tp-router>
  </tp-router-config>
</body>
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Global router configuration -->
  <tp-router-config history="browser"></tp-router-config>
  
  <style>
    nav {
      padding: 1rem;
      background: #f0f0f0;
    }
    
    tp-router-link {
      margin-right: 1rem;
      text-decoration: none;
      color: #333;
    }
    
    tp-router-link[active] {
      font-weight: bold;
      color: #0066cc;
      border-bottom: 2px solid #0066cc;
    }
  </style>
</head>
<body>
  <nav>
    <tp-router-link to="/">Home</tp-router-link>
    <tp-router-link to="/about">About</tp-router-link>
    <tp-router-link to="/users">Users</tp-router-link>
  </nav>

  <!-- Main router inherits browser history from head config -->
  <tp-router>
    <tp-route path="/">
      <template>
        <h1>Home Page</h1>
        <p>Welcome to our application!</p>
        <tp-router-link to="/about">Learn more about us</tp-router-link>
      </template>
    </tp-route>

    <tp-route path="/about">
      <template>
        <h1>About Us</h1>
        <p>This is the about page.</p>
        <tp-router-link to="back">Go back</tp-router-link>
      </template>
    </tp-route>

    <tp-route path="/users">
      <template>
        <h1>Users</h1>
        <ul>
          <li><tp-router-link to="/users/1">User 1</tp-router-link></li>
          <li><tp-router-link to="/users/2">User 2</tp-router-link></li>
        </ul>
      </template>
    </tp-route>

    <tp-route path="/users/:id">
      <template>
        <h1>User Profile</h1>
        <p>Viewing user profile</p>
        <tp-router-link to="..">Back to users list</tp-router-link>
      </template>
    </tp-route>

    <tp-router-outlet></tp-router-outlet>
  </tp-router>
</body>
</html>
```

## Route Parameters

Route parameters allow you to create dynamic routes that match variable segments in URLs. Parameters are extracted from the URL and made available within route templates.

### Defining Parameters

Parameters are defined in route paths using the `:paramName` syntax:

```html
<tp-route path="/users/:id">
  <template>
    <!-- Parameter 'id' is available here -->
  </template>
</tp-route>
```

### Accessing Parameters

#### Option 1: Using `<tp-router-param>` (Declarative)

The recommended approach for templates:

```html
<tp-route path="/users/:id">
  <template>
    <h1>User <tp-router-param name="id"></tp-router-param></h1>
  </template>
</tp-route>
```

#### Option 2: Via Outlet Attributes

Parameters are exposed as `param-*` attributes on the outlet:

```html
<tp-router-outlet id="outlet">
  <!-- When route /users/123 is active -->
  <!-- outlet will have param-id="123" attribute -->
</tp-router-outlet>

<script>
  const outlet = document.getElementById('outlet');
  const userId = outlet.getAttribute('param-id'); // '123'
</script>
```

#### Option 3: Via Outlet Properties

Access all parameters as an object:

```javascript
const outlet = document.querySelector('tp-router-outlet');
console.log(outlet.params); // { id: '123' }
```

### Multiple Parameters

Routes can have multiple parameters:

```html
<tp-route path="/blog/:year/:month/:slug">
  <template>
    <article>
      <header>
        <time>
          <tp-router-param name="year"></tp-router-param>-
          <tp-router-param name="month"></tp-router-param>
        </time>
        <h1><tp-router-param name="slug"></tp-router-param></h1>
      </header>
    </article>
  </template>
</tp-route>

<!-- Matches: /blog/2024/12/hello-world -->
<!-- Params: { year: '2024', month: '12', slug: 'hello-world' } -->
```

### Parameter Inheritance

Nested outlets inherit parameters from parent routes:

```html
<tp-router>
  <tp-route path="/projects/:projectId">
    <template>
      <h1>Project <tp-router-param name="projectId"></tp-router-param></h1>
      
      <tp-router-outlet>
        <tp-route path="/tasks/:taskId">
          <template>
            <!-- Both parameters available -->
            <p>Project: <tp-router-param name="projectId"></tp-router-param></p>
            <p>Task: <tp-router-param name="taskId"></tp-router-param></p>
          </template>
        </tp-route>
      </tp-router-outlet>
    </template>
  </tp-route>
  <tp-router-outlet></tp-router-outlet>
</tp-router>

<!-- URL: /projects/proj-1/tasks/task-42 -->
<!-- Child outlet has: { projectId: 'proj-1', taskId: 'task-42' } -->
```

Child parameters override parent parameters with the same name.

### Styling Parameters

You can style parameter display using CSS:

```css
/* Style all parameters */
tp-router-param {
  font-weight: bold;
  color: var(--primary-color);
}

/* Style specific parameters by name */
tp-router-param[name="id"] {
  font-family: monospace;
  background: #f0f0f0;
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

tp-router-param[name="year"],
tp-router-param[name="month"] {
  color: #666;
}
```

## Remote Content

A route can load its HTML from a URL instead of an inline template:

```html
<tp-router>
  <tp-route path="/"><template><h1>Home</h1></template></tp-route>

  <tp-route path="/docs" src="/partials/docs.html">
    <template data-loading><p>Loading…</p></template>
    <template data-error><p>Could not load the docs.</p></template>
  </tp-route>

  <tp-router-outlet></tp-router-outlet>
</tp-router>
```

**Behavior:**
- `src` is resolved against `document.baseURI`.
- The content is fetched the first time the route matches, not on page load.
- It is cached per route until `src` changes. Navigating away and back does not fetch again, and a request that is already running is reused.
- `src` takes precedence over an inline content template. While loading, the outlet renders `<template data-loading>` (or nothing). On failure, it renders `<template data-error>` (or nothing).
- A failure is not cached: the next time the route matches, it retries.
- Changing `src` or removing the route from the DOM aborts a running request. A late response for an old `src` is ignored.

**Styling the state:**

```css
tp-router-outlet[route-loading] { opacity: 0.5; }
tp-router-outlet[route-error] { border-color: crimson; }
```

**Custom loader:** Override `loader` to add headers or credentials, or to stub requests in tests. It must reject on failure:

```ts
const route = document.querySelector('tp-route[path="/docs"]')!;

route.loader = async (url, signal) => {
  const response = await fetch(url, { signal, credentials: 'include' });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.text();
};

route.addEventListener('tp-route-error', (event) => console.error(event.detail.src, event.detail.error));
```

> **Security:** The fetched HTML is inserted as-is, like `innerHTML`, so only point `src` at content you trust. `<script>` elements in it do not run, and `<html>`, `<head>` and `<body>` wrappers are dropped.

## URL Pattern Syntax

Routes use the [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) for matching:

### Static Paths
```html
<tp-route path="/"><template>Home</template></tp-route>
<tp-route path="/about"><template>About</template></tp-route>
<tp-route path="/contact"><template>Contact</template></tp-route>
```

### Dynamic Segments
```html
<!-- Match /users/123 -->
<tp-route path="/users/:id"><template>User Profile</template></tp-route>

<!-- Match /blog/2024/hello-world -->
<tp-route path="/blog/:year/:slug"><template>Blog Post</template></tp-route>
```

### Wildcards
```html
<!-- Match /blog, /blog/post, /blog/post/123 -->
<tp-route path="/blog/*"><template>Blog Section</template></tp-route>

<!-- Match any path under /docs -->
<tp-route path="/docs/**"><template>Documentation</template></tp-route>
```

## History Strategies

### Browser History (default)
Uses the HTML5 History API (`pushState`, `replaceState`). URLs are clean without hash fragments.

```html
<tp-router history="browser">
  <!-- URLs: /, /about, /users/123 -->
</tp-router>
```

**Requires:** Server-side configuration to serve `index.html` for all routes.

### Hash History
Uses hash fragments in the URL. Works without server configuration.

```html
<tp-router history="hash">
  <!-- URLs: /#/, /#/about, /#/users/123 -->
</tp-router>
```

### Memory History
In-memory history for testing or non-browser environments.

```html
<tp-router history="memory">
  <!-- No URL changes -->
</tp-router>

<!-- Named instances for isolation -->
<tp-router history="memory:test1">...</tp-router>
<tp-router history="memory:test2">...</tp-router>
```

## Navigation

Use `<tp-router-link>` elements for navigation:

```html
<!-- Absolute paths -->
<tp-router-link to="/about">About</tp-router-link>

<!-- Relative paths -->
<tp-router-link to="./details">Details</tp-router-link>
<tp-router-link to="../">Parent</tp-router-link>

<!-- History navigation -->
<tp-router-link to="back">Back</tp-router-link>
<tp-router-link to="forward">Forward</tp-router-link>
```

## Multiple Routers

You can have multiple routers in your application, each with different history strategies:

```html
<head>
  <!-- Set global default to browser history -->
  <tp-router-config history="browser"></tp-router-config>
</head>
<body>
  <!-- Main router uses browser history from global config -->
  <tp-router>
    <tp-route path="/"><template>Home</template></tp-route>
    <tp-route path="/dashboard"><template>Dashboard</template></tp-route>
    <tp-router-outlet></tp-router-outlet>
  </tp-router>

  <!-- Admin section with hash history (overrides global) -->
  <tp-router history="hash">
    <tp-route path="/users"><template>Users</template></tp-route>
    <tp-route path="/settings"><template>Settings</template></tp-route>
    <tp-router-outlet></tp-router-outlet>
  </tp-router>
  
  <!-- Widget with isolated memory history -->
  <tp-router-config history="memory:widget">
    <tp-router>
      <tp-route path="/step1"><template>Step 1</template></tp-route>
      <tp-route path="/step2"><template>Step 2</template></tp-route>
      <tp-router-outlet></tp-router-outlet>
    </tp-router>
  </tp-router-config>
</body>
```

## Styling

### Active Links

The `active` attribute is automatically added to `<tp-router-link>` elements when their path matches:

```css
tp-router-link[active] {
  font-weight: bold;
  color: var(--active-link-color);
  border-bottom: 2px solid currentColor;
}
```

### Route Outlet

The outlet renders content in light DOM, so you can style it directly:

```css
tp-router-outlet {
  display: block;
  padding: 2rem;
  min-height: 400px;
}
```

## TypeScript Support

All components are fully typed with TypeScript. Types are automatically inferred through `HTMLElementTagNameMap`:

```typescript
// Types are inferred automatically - no need for type assertions
const router = document.querySelector('tp-router');
const outlet = document.querySelector('tp-router-outlet');
const link = document.querySelector('tp-router-link');

// TypeScript knows the correct types:
router?.assignOutlet(outlet);
link?.addEventListener('click', (e) => { /* ... */ });
```

## Browser Support

- Modern browsers with Web Components support
- URLPattern API (or polyfill required for older browsers)
- ES2024+ features

## License

MIT © [Thalesrc](https://github.com/thalesrc)
