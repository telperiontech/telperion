import { BrowserSupport } from './BrowserSupport';
import { Features } from './Features';
import { Gallery } from './Gallery';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';

export function HomePage() {
	return (
		<main>
			<Hero />
			<Features />
			<HowItWorks />
			<Gallery />
			<BrowserSupport />
		</main>
	);
}
