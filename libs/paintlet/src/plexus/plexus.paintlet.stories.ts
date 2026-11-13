import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './plexus.paintlet';

/**
 * Story arguments interface for type safety
 */
interface PlexusStoryArgs {
  duration: number;
  dotColor: string;
  lineColor: string;
  backgroundColor: string;
  density: number;
  dotSize: number;
  lineWidth: number;
  proximity: number;
  maxLaps: number;
  seed: number;
  width: number;
  height: number;
}

const range = (min: number, max: number, step: number) => ({ control: { type: 'range' as const, min, max, step } });
const meta: Meta<PlexusStoryArgs> = {
  title: 'Paintlets/Plexus',
  tags: ['autodocs'],
  argTypes: {
    duration: { ...range(10, 240, 5), description: 'Animation cycle in seconds; longer is slower' },
    dotColor: { control: 'color', description: 'Dot color' },
    lineColor: { control: 'color', description: 'Line color' },
    backgroundColor: { control: 'color', description: 'Container background (not part of the paintlet)' },
    density: { ...range(2000, 30000, 500), description: 'Area in px² per dot; lower means more dots' },
    dotSize: { ...range(0, 12, 0.5), description: 'Dot diameter in px' },
    lineWidth: { ...range(0, 4, 0.25), description: 'Line width in px' },
    proximity: { ...range(0, 250, 5), description: 'Max distance in px for two dots to be joined' },
    maxLaps: { ...range(1, 5, 1), description: 'Max edge-to-edge round trips per axis per cycle' },
    seed: { ...range(1, 100, 1), description: 'Seed for the dot layout' },
    width: { ...range(200, 900, 50), description: 'Container width' },
    height: { ...range(200, 600, 50), description: 'Container height' },
  },
  parameters: {
    docs: {
      description: {
        component: `
# Plexus Paintlet

Drifting dots that bounce off the element edges, joined by lines that fade in as two dots get closer.

## CSS Custom Properties

- \`--tp-plexus-dot-color\`: Dot color
- \`--tp-plexus-line-color\`: Line color
- \`--tp-plexus-density\`: Area in px² per dot (lower means more dots)
- \`--tp-plexus-dot-size\`: Dot diameter in px
- \`--tp-plexus-line-width\`: Line width in px
- \`--tp-plexus-proximity\`: Max distance in px for two dots to be joined
- \`--tp-plexus-max-laps\`: Max edge-to-edge round trips per axis per animation cycle
- \`--tp-plexus-seed\`: Seed for the dot layout
- \`--tp-plexus-frame\`: Animation frame from 0 to 100 (driven by the animation)

## Animation

\`\`\`css
.hero {
  background-image: --tp-plexus();
  animation: --tp-plexus-animation(60s);
}
\`\`\`

Every dot makes a whole number of round trips per cycle, so the loop is seamless.
Distance travelled scales with the element size, so larger elements need longer durations to keep a calm pace.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<PlexusStoryArgs>;

const renderPlexus = (args: PlexusStoryArgs) => html`
  <style>
    .plexus-container {
      width: ${args.width}px;
      height: ${args.height}px;
      background-color: ${args.backgroundColor};
      background-image: --tp-plexus();
      animation: --tp-plexus-animation(${args.duration}s);
      --tp-plexus-dot-color: ${args.dotColor};
      --tp-plexus-line-color: ${args.lineColor};
      --tp-plexus-density: ${args.density};
      --tp-plexus-dot-size: ${args.dotSize};
      --tp-plexus-line-width: ${args.lineWidth};
      --tp-plexus-proximity: ${args.proximity};
      --tp-plexus-max-laps: ${args.maxLaps};
      --tp-plexus-seed: ${args.seed};
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  </style>
  <div class="plexus-container"></div>
`;
const defaults: PlexusStoryArgs = {
  duration: 60,
  dotColor: '#666666',
  lineColor: '#666666',
  backgroundColor: '#f5f7fa',
  density: 10000,
  dotSize: 3.5,
  lineWidth: 1,
  proximity: 100,
  maxLaps: 2,
  seed: 1,
  width: 600,
  height: 400,
};

export const Default: Story = {
  args: defaults,
  render: renderPlexus,
  parameters: { docs: { description: { story: 'Default settings, matching the classic particleground look.' } } },
};

export const NightSky: Story = {
  args: {
    ...defaults,
    dotColor: '#eeeeee',
    lineColor: '#eeeeee',
    backgroundColor: '#0b1a2e',
    dotSize: 3,
    lineWidth: 0.75,
    proximity: 110,
  },
  render: renderPlexus,
  parameters: { docs: { description: { story: 'Light dots and lines on a dark background.' } } },
};

export const Dense: Story = {
  args: {
    ...defaults,
    density: 4000,
    dotSize: 2,
    lineWidth: 0.5,
    proximity: 70,
    lineColor: '#4a90e2',
    dotColor: '#2c5aa0',
    duration: 90,
  },
  render: renderPlexus,
  parameters: { docs: { description: { story: 'Many small dots with short connections.' } } },
};

export const Sparse: Story = {
  args: {
    ...defaults,
    density: 25000,
    dotSize: 6,
    lineWidth: 1.5,
    proximity: 200,
    dotColor: '#8338ec',
    lineColor: '#ff006e',
    maxLaps: 1,
  },
  render: renderPlexus,
  parameters: { docs: { description: { story: 'Few large dots with long-reaching connections.' } } },
};
