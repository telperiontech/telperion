import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './router-element';
import './route-element';
import './router-link-element';
import './router-outlet-element';
import './router-config-element';
import '../../.storybook/url-output-element';
import { HistoryType } from './history';

interface RouterStoryArgs {
  globalHistory: HistoryType;
}

const meta: Meta<RouterStoryArgs> = {
  title: 'Router/Basic Navigation',
  component: 'tp-router',
  tags: ['autodocs'],
  decorators: [
    (story, ctx) => {
      let routerConfig = document.head.querySelector('tp-router-config');
      if (!routerConfig) {
        routerConfig = document.createElement('tp-router-config');
        document.head.appendChild(routerConfig);
      }

      document.head.querySelector('base')?.remove();

      routerConfig.setAttribute('history', ctx.args.globalHistory);

      return html`${story()}`;
    },
    (story) => html`
      <style>
        .router-demo {
          font-family: system-ui, -apple-system, sans-serif;
        }

        nav {
          padding: 1rem;
          background: #f5f5f5;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        tp-router-link {
          margin-right: 0.5rem;
          padding: 0.5rem 1rem;
          text-decoration: none;
          color: #333;
          background: white;
          border-radius: 4px;
          display: inline-block;
          border: 2px solid transparent;
          transition: all 0.2s;
        }

        tp-router-link[active] {
          font-weight: bold;
          color: #0066cc;
          border-color: #0066cc;
          background: #e6f2ff;
        }

        tp-router-link:hover {
          background: #e9ecef;
        }

        tp-url-output {
          margin-top: 1rem;
          padding: 1rem;
          background: #fff3cd;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.875rem;
          display: block;
        }

        tp-url-output > div {
          margin: 0.25rem 0;
        }

        /* Story-specific styles */
        .user-card {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          margin-top: 1rem;
        }

        .navigation-box {
          background: #e7f5ff;
          padding: 1rem;
          border-radius: 4px;
          margin-top: 1rem;
          border-left: 4px solid #0066cc;
        }

        .history-controls {
          padding: 1rem;
          background: #f5f5f5;
          border-radius: 8px;
          margin-bottom: 1rem;
          display: flex;
          gap: 0.5rem;
        }

        .history-info {
          background: #d1ecf1;
          padding: 1rem;
          border-radius: 4px;
          margin-top: 1rem;
          border-left: 4px solid #0c5460;
        }

        .demo-section {
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 2rem;
        }

        .config-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: #28a745;
          color: white;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: bold;
          margin-left: 0.5rem;
        }

        .layout {
          display: grid;
          grid-template-columns: 250px 1fr;
          gap: 1rem;
          height: 500px;
        }

        .sidebar {
          background: #343a40;
          color: white;
          padding: 1rem;
          border-radius: 8px;
        }

        .sidebar h3 {
          margin-top: 0;
          color: #fff;
        }

        .sidebar nav {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .sidebar tp-router-link {
          padding: 0.75rem;
          text-decoration: none;
          color: #dee2e6;
          background: #495057;
          border-radius: 4px;
          display: block;
          border-left: 4px solid transparent;
          transition: all 0.2s;
        }

        .sidebar tp-router-link:hover {
          background: #5a6268;
        }

        .sidebar tp-router-link[active] {
          color: white;
          background: #007bff;
          border-left-color: #fff;
          font-weight: bold;
        }

        .main-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          border: 1px solid #dee2e6;
          overflow: auto;
        }

        .app {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 1200px;
        }

        header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1.5rem;
          border-radius: 8px 8px 0 0;
        }

        header h1 {
          margin: 0;
          font-size: 1.5rem;
        }

        .top-nav {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .top-nav tp-router-link {
          padding: 0.5rem 1.5rem;
          text-decoration: none;
          color: white;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          border: 2px solid transparent;
          transition: all 0.2s;
        }

        .top-nav tp-router-link:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .top-nav tp-router-link[active] {
          background: white;
          color: #667eea;
          border-color: white;
          font-weight: bold;
        }

        .content-wrapper {
          display: flex;
          min-height: 400px;
        }

        aside {
          width: 250px;
          background: #f8f9fa;
          padding: 1.5rem;
          border-right: 1px solid #dee2e6;
        }

        aside h3 {
          margin-top: 0;
          font-size: 1rem;
          color: #495057;
        }

        .side-nav {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .side-nav tp-router-link {
          padding: 0.75rem;
          text-decoration: none;
          color: #495057;
          background: white;
          border-radius: 4px;
          border-left: 3px solid transparent;
          transition: all 0.2s;
        }

        .side-nav tp-router-link:hover {
          background: #e9ecef;
        }

        .side-nav tp-router-link[active] {
          background: #e7f5ff;
          color: #0066cc;
          border-left-color: #0066cc;
          font-weight: 600;
        }

        main {
          flex: 1;
          padding: 2rem;
          background: white;
        }

        .breadcrumb {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .breadcrumb tp-router-link {
          color: #0066cc;
          text-decoration: none;
        }

        .breadcrumb tp-router-link:hover {
          text-decoration: underline;
        }

        .card {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          margin: 1rem 0;
        }

        footer {
          padding: 1rem;
          background: #343a40;
          color: #dee2e6;
          text-align: center;
          border-radius: 0 0 8px 8px;
          font-size: 0.875rem;
        }
      </style>
      ${story()}
    `,
  ],
  argTypes: {
    globalHistory: {
      control: 'select',
      options: ['browser', 'hash', 'memory'],
      description: 'History management strategy'
    },
  },
};

export default meta;

type Story = StoryObj<RouterStoryArgs>;

/**
 * Basic router setup with three simple routes and navigation links.
 * The tp-url-output component displays both the router's history URL and the browser's actual URL.
 */
export const BasicRouting: Story = {
  args: {
    globalHistory: 'memory',
  },
  render: (args) => html`
    <div class="router-demo">
      <h3>Router Demo</h3>

      <nav>
        <tp-router-link to="/">Home</tp-router-link>
        <tp-router-link to="/about">About</tp-router-link>
        <tp-router-link to="/contact">Contact</tp-router-link>
      </nav>

      <tp-router>
        <tp-route path="/">
          <template>
            <h1>🏠 Home Page</h1>
            <p>Welcome to the home page!</p>
            <p>Click the navigation links above to explore different routes.</p>
          </template>
        </tp-route>

        <tp-route path="/about">
          <template>
            <h1>ℹ️ About Page</h1>
            <p>This is the about page with information about the application.</p>
          </template>
        </tp-route>

        <tp-route path="/contact">
          <template>
            <h1>📧 Contact Page</h1>
            <p>Get in touch with us through this page.</p>
          </template>
        </tp-route>

        <tp-router-outlet></tp-router-outlet>
      </tp-router>

      <tp-url-output></tp-url-output>
    </div>
  `,
};

/**
 * Demonstrates dynamic route parameters using URLPattern syntax.
 * Navigate to different users to see the URL pattern matching in action.
 */
export const DynamicRoutes: Story = {
  args: {
    globalHistory: 'memory',
  },
  render: (args) => html`
    <div class="router-demo">
      <h3>Dynamic Routes Demo</h3>

      <nav>
        <tp-router-link to="/">Users List</tp-router-link>
        <tp-router-link to="/users/1">User 1</tp-router-link>
        <tp-router-link to="/users/2">User 2</tp-router-link>
        <tp-router-link to="/users/3">User 3</tp-router-link>
        <tp-router-link to="/users/42">User 42</tp-router-link>
      </nav>

      <tp-router history="${args.globalHistory}">
        <tp-route path="/">
          <template>
            <h1>👥 Users List</h1>
            <p>Select a user from the navigation to view their profile.</p>
            <ul>
              <li>User 1 - Alice Johnson</li>
              <li>User 2 - Bob Smith</li>
              <li>User 3 - Carol Williams</li>
              <li>User 42 - Douglas Adams</li>
            </ul>
          </template>
        </tp-route>

        <tp-route path="/users/:id">
          <template>
            <h1>👤 User Profile <tp-router-param name="id"></tp-router-param></h1>
            <div class="user-card">
              <p><strong>User ID from URL pattern:</strong> Check the URL above! 🎯</p>
              <p>The <code>:id</code> parameter in the route pattern matches any value in that segment.</p>
              <p>Try navigating to different users to see how the URL changes.</p>
            </div>
          </template>
        </tp-route>

        <tp-router-outlet></tp-router-outlet>
      </tp-router>

      <tp-url-output history="${args.globalHistory}"></tp-url-output>
    </div>
  `,
};

/**
 * Shows relative navigation using ./ and ../ paths.
 * Demonstrates how to navigate relative to the current location.
 */
export const RelativeNavigation: Story = {
  args: {
    globalHistory: 'memory',
  },
  render: (args) => html`
    <div class="router-demo">
      <h3>Relative Navigation Demo</h3>

      <nav>
        <tp-router-link to="/">Home</tp-router-link>
        <tp-router-link to="/products">Products</tp-router-link>
        <tp-router-link to="/products/electronics">Electronics</tp-router-link>
        <tp-router-link to="/products/electronics/phones">Phones</tp-router-link>
      </nav>

      <tp-router history="${args.globalHistory}">
        <tp-route path="/">
          <template>
            <h1>🏠 Home</h1>
            <p>Start your navigation journey here.</p>
            <div class="navigation-box">
              <strong>Navigate from here:</strong><br>
              <tp-router-link to="./products">→ Go to Products (relative)</tp-router-link>
            </div>
          </template>
        </tp-route>

        <tp-route path="/products">
          <template>
            <h1>🛍️ Products</h1>
            <p>Browse our product categories.</p>
            <div class="navigation-box">
              <strong>Navigate from here:</strong><br>
              <tp-router-link to="./electronics">→ View Electronics (relative)</tp-router-link><br>
              <tp-router-link to="..">← Back to Home (up one level)</tp-router-link>
            </div>
          </template>
        </tp-route>

        <tp-route path="/products/electronics">
          <template>
            <h1>💻 Electronics</h1>
            <p>Electronic devices and gadgets.</p>
            <div class="navigation-box">
              <strong>Navigate from here:</strong><br>
              <tp-router-link to="./phones">→ View Phones (relative)</tp-router-link><br>
              <tp-router-link to="..">← Back to Products (up one level)</tp-router-link><br>
              <tp-router-link to="../..">← Back to Home (up two levels)</tp-router-link>
            </div>
          </template>
        </tp-route>

        <tp-route path="/products/electronics/phones">
          <template>
            <h1>📱 Phones</h1>
            <p>Latest smartphones and accessories.</p>
            <div class="navigation-box">
              <strong>Navigate from here:</strong><br>
              <tp-router-link to="..">← Back to Electronics</tp-router-link><br>
              <tp-router-link to="../..">← Back to Products</tp-router-link><br>
              <tp-router-link to="../../..">← Back to Home</tp-router-link>
            </div>
          </template>
        </tp-route>

        <tp-router-outlet></tp-router-outlet>
      </tp-router>

      <tp-url-output history="${args.globalHistory}"></tp-url-output>
    </div>
  `,
};

/**
 * Demonstrates browser history navigation with back and forward links.
 * Shows how to use 'back' and 'forward' special values.
 */
export const HistoryNavigation: Story = {
  args: {
    globalHistory: 'memory',
  },
  render: (args) => html`
    <div class="router-demo">
      <h3>History Navigation Demo</h3>

      <div class="history-controls">
        <tp-router-link to="back">⬅️ Back</tp-router-link>
        <tp-router-link to="forward">➡️ Forward</tp-router-link>
      </div>

      <nav>
        <tp-router-link to="/">Page 1</tp-router-link>
        <tp-router-link to="/page2">Page 2</tp-router-link>
        <tp-router-link to="/page3">Page 3</tp-router-link>
        <tp-router-link to="/page4">Page 4</tp-router-link>
      </nav>

      <tp-router history="${args.globalHistory}">
        <tp-route path="/">
          <template>
            <h1>📄 Page 1</h1>
            <p>Navigate through the pages using the links above.</p>
            <div class="history-info">
              <strong>💡 Tip:</strong> After navigating to multiple pages,
              use the Back and Forward buttons to move through your history!
            </div>
          </template>
        </tp-route>

        <tp-route path="/page2">
          <template>
            <h1>📄 Page 2</h1>
            <p>This is the second page.</p>
            <div class="history-info">
              Click the <strong>Back</strong> button to return to Page 1.
            </div>
          </template>
        </tp-route>

        <tp-route path="/page3">
          <template>
            <h1>📄 Page 3</h1>
            <p>This is the third page.</p>
            <div class="history-info">
              Use <strong>Back</strong> to go to previous pages, then <strong>Forward</strong> to return here.
            </div>
          </template>
        </tp-route>

        <tp-route path="/page4">
          <template>
            <h1>📄 Page 4</h1>
            <p>This is the fourth page.</p>
            <div class="history-info">
              You've visited multiple pages now. The Back button will take you through your navigation history!
            </div>
          </template>
        </tp-route>

        <tp-router-outlet></tp-router-outlet>
      </tp-router>

      <tp-url-output history="${args.globalHistory}"></tp-url-output>
    </div>
  `,
};

/**
 * Demonstrates using tp-router-config to configure history strategy.
 * Shows both hash and memory history configurations.
 */
export const WithRouterConfig: Story = {
  render: () => html`
    <div class="router-demo">
      <h3>Router Configuration Demo</h3>

      <div class="demo-section">
        <h4>Section 1: Hash History <span class="config-badge">hash</span></h4>
        <p>This router uses hash-based routing (notice the # in the URL)</p>

        <tp-router-config history="hash">
          <nav>
            <tp-router-link to="/">Home</tp-router-link>
            <tp-router-link to="/about">About</tp-router-link>
            <tp-router-link to="/services">Services</tp-router-link>
          </nav>

          <tp-router>
            <tp-route path="/">
              <template>
                <h2>🏠 Hash Router - Home</h2>
                <p>This section uses hash-based routing.</p>
              </template>
            </tp-route>

            <tp-route path="/about">
              <template>
                <h2>ℹ️ Hash Router - About</h2>
                <p>URLs use the hash fragment (#) for routing.</p>
              </template>
            </tp-route>

            <tp-route path="/services">
              <template>
                <h2>⚙️ Hash Router - Services</h2>
                <p>This works without server-side configuration!</p>
              </template>
            </tp-route>

            <tp-router-outlet></tp-router-outlet>
          </tp-router>

          <tp-url-output history="hash"></tp-url-output>
        </tp-router-config>
      </div>

      <div class="demo-section">
        <h4>Section 2: Memory History <span class="config-badge">memory</span></h4>
        <p>This router uses in-memory routing (browser URL doesn't change)</p>

        <tp-router-config history="memory:section2">
          <nav>
            <tp-router-link to="/">Dashboard</tp-router-link>
            <tp-router-link to="/settings">Settings</tp-router-link>
            <tp-router-link to="/profile">Profile</tp-router-link>
          </nav>

          <tp-router>
            <tp-route path="/">
              <template>
                <h2>📊 Memory Router - Dashboard</h2>
                <p>This section uses memory-based routing.</p>
              </template>
            </tp-route>

            <tp-route path="/settings">
              <template>
                <h2>⚙️ Memory Router - Settings</h2>
                <p>The browser URL stays the same!</p>
              </template>
            </tp-route>

            <tp-route path="/profile">
              <template>
                <h2>👤 Memory Router - Profile</h2>
                <p>Perfect for embedded widgets or testing.</p>
              </template>
            </tp-route>

            <tp-router-outlet></tp-router-outlet>
          </tp-router>

          <tp-url-output history="memory:section2"></tp-url-output>
        </tp-router-config>
      </div>
    </div>
  `,
};

/**
 * Demonstrates a router outlet placed outside its router element using the 'for' attribute.
 */
export const OutletWithForAttribute: Story = {
  args: {
    globalHistory: 'memory',
  },
  render: (args) => html`
    <div class="router-demo">
      <h3>Outlet 'for' Attribute Demo</h3>
      <p>The router and outlet are in different parts of the layout, connected via ID.</p>

      <div class="layout">
        <div class="sidebar">
          <h3>Navigation</h3>
          <nav>
            <tp-router-link to="/">🏠 Dashboard</tp-router-link>
            <tp-router-link to="/analytics">📊 Analytics</tp-router-link>
            <tp-router-link to="/reports">📄 Reports</tp-router-link>
            <tp-router-link to="/settings">⚙️ Settings</tp-router-link>
          </nav>

          <!-- Router defined in sidebar with an ID -->
          <tp-router id="app-router" history="${args.globalHistory}">
            <tp-route path="/">
              <template>
                <h1>📊 Dashboard</h1>
                <p>Welcome to your dashboard! This is the main overview page.</p>
                <p>The router element is in the sidebar, but the content renders in the main area using <code>for="app-router"</code>.</p>
              </template>
            </tp-route>

            <tp-route path="/analytics">
              <template>
                <h1>📈 Analytics</h1>
                <p>View detailed analytics and insights here.</p>
                <ul>
                  <li>User engagement metrics</li>
                  <li>Performance statistics</li>
                  <li>Conversion rates</li>
                </ul>
              </template>
            </tp-route>

            <tp-route path="/reports">
              <template>
                <h1>📄 Reports</h1>
                <p>Generate and view reports.</p>
                <p>Export data in various formats for analysis.</p>
              </template>
            </tp-route>

            <tp-route path="/settings">
              <template>
                <h1>⚙️ Settings</h1>
                <p>Configure your application settings.</p>
                <ul>
                  <li>Account preferences</li>
                  <li>Notification settings</li>
                  <li>Privacy options</li>
                </ul>
              </template>
            </tp-route>
          </tp-router>
        </div>

        <div class="main-content">
          <!-- Outlet binds to router via 'for' attribute -->
          <tp-router-outlet for="app-router"></tp-router-outlet>

          <tp-url-output history="${args.globalHistory}"></tp-url-output>
        </div>
      </div>
    </div>
  `,
};

/**
 * Comprehensive example showing all router features together in a realistic application layout.
 */
export const CompleteExample: Story = {
  args: {
    globalHistory: 'memory',
  },
  render: (args) => html`
    <tp-url-output {
        margin-top: 1rem;
        padding: 1rem;
        background: #fff3cd;
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.875rem;
        display: block;
      }

      tp-url-output > div {
        margin: 0.25rem 0;
      }
    </style>

    <div class="app">
      <header>
        <h1>🚀 Complete Router Demo Application</h1>
        <nav class="top-nav">
          <tp-router-link to="/">Home</tp-router-link>
          <tp-router-link to="/products">Products</tp-router-link>
          <tp-router-link to="/about">About</tp-router-link>
          <tp-router-link to="/contact">Contact</tp-router-link>
        </nav>
      </header>

      <tp-router history="${args.globalHistory}">
        <div class="content-wrapper">
          <aside>
            <div class="history-controls">
              <tp-router-link to="back">⬅️ Back</tp-router-link>
              <tp-router-link to="forward">➡️</tp-router-link>
            </div>

            <h3>Quick Links</h3>
            <nav class="side-nav">
              <tp-router-link to="/">🏠 Home</tp-router-link>
              <tp-router-link to="/products">📦 All Products</tp-router-link>
              <tp-router-link to="/products/laptop">💻 Laptops</tp-router-link>
              <tp-router-link to="/products/phone">📱 Phones</tp-router-link>
              <tp-router-link to="/products/tablet">📱 Tablets</tp-router-link>
              <tp-router-link to="/about">ℹ️ About Us</tp-router-link>
              <tp-router-link to="/contact">📧 Contact</tp-router-link>
            </nav>
          </aside>

          <main>
            <tp-route path="/">
              <template>
                <h2>Welcome to Our Store! 🎉</h2>
                <p>This comprehensive demo showcases all router features:</p>

                <div class="card">
                  <h3>✨ Features Demonstrated:</h3>
                  <ul>
                    <li><strong>Basic routing</strong> - Navigate between pages</li>
                    <li><strong>Dynamic routes</strong> - Product pages with IDs</li>
                    <li><strong>Relative navigation</strong> - Use ./ and ../ paths</li>
                    <li><strong>History controls</strong> - Back and forward buttons</li>
                    <li><strong>Active link styling</strong> - Automatic highlighting</li>
                    <li><strong>URL monitoring</strong> - See history and browser URLs</li>
                  </ul>
                </div>

                <p>Use the navigation above or the sidebar to explore different routes!</p>
              </template>
            </tp-route>

            <tp-route path="/products">
              <template>
                <div class="breadcrumb">
                  <tp-router-link to="/">Home</tp-router-link>
                  <span>›</span>
                  <span>Products</span>
                </div>

                <h2>📦 Our Products</h2>
                <p>Browse our selection of premium electronics.</p>

                <div class="card">
                  <h3>Navigate to specific products:</h3>
                  <p>
                    <tp-router-link to="./laptop">→ Laptops (relative path)</tp-router-link><br>
                    <tp-router-link to="./phone">→ Phones (relative path)</tp-router-link><br>
                    <tp-router-link to="./tablet">→ Tablets (relative path)</tp-router-link>
                  </p>
                </div>
              </template>
            </tp-route>

            <tp-route path="/products/:category">
              <template>
                <div class="breadcrumb">
                  <tp-router-link to="/">Home</tp-router-link>
                  <span>›</span>
                  <tp-router-link to="/products">Products</tp-router-link>
                  <span>›</span>
                  <span>Category Details</span>
                </div>

                <h2>📱 Product Category</h2>

                <div class="card">
                  <h3>Dynamic Route Information:</h3>
                  <p>This page uses a dynamic route pattern: <code>/products/:category</code></p>
                  <p>Check the URL display below to see the matched category!</p>
                  <p>
                    <tp-router-link to="..">⬅️ Back to Products (relative up)</tp-router-link>
                  </p>
                </div>
              </template>
            </tp-route>

            <tp-route path="/about">
              <template>
                <div class="breadcrumb">
                  <tp-router-link to="/">Home</tp-router-link>
                  <span>›</span>
                  <span>About</span>
                </div>

                <h2>ℹ️ About This Demo</h2>
                <p>This is a complete demonstration of the THA Router components.</p>

                <div class="card">
                  <h3>Components Used:</h3>
                  <ul>
                    <li><code>&lt;tp-router&gt;</code> - Main router container</li>
                    <li><code>&lt;tp-route&gt;</code> - Route definitions with templates</li>
                    <li><code>&lt;tp-router-link&gt;</code> - Navigation links</li>
                    <li><code>&lt;tp-router-outlet&gt;</code> - Content rendering target</li>
                    <li><code>&lt;tp-url-output&gt;</code> - URL debugging display</li>
                  </ul>
                </div>
              </template>
            </tp-route>

            <tp-route path="/contact">
              <template>
                <div class="breadcrumb">
                  <tp-router-link to="/">Home</tp-router-link>
                  <span>›</span>
                  <span>Contact</span>
                </div>

                <h2>📧 Contact Us</h2>
                <p>Get in touch with our team!</p>

                <div class="card">
                  <h3>Navigation Examples:</h3>
                  <p>From this page, you can:</p>
                  <ul>
                    <li>Use the <strong>Back button</strong> in the sidebar</li>
                    <li>Click <tp-router-link to="/">Home</tp-router-link> to go to the start</li>
                    <li>Browse <tp-router-link to="/products">Products</tp-router-link></li>
                    <li>Read the <tp-router-link to="/about">About</tp-router-link> page</li>
                  </ul>
                </div>
              </template>
            </tp-route>

            <tp-router-outlet></tp-router-outlet>

            <tp-url-output history="${args.globalHistory}"></tp-url-output>
          </main>
        </div>
      </tp-router>

      <footer>
        <p>THA Router Demo - Built with Lit and @lit-labs/signals</p>
      </footer>
    </div>
  `,
};
