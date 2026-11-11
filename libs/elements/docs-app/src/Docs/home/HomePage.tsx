import { Features } from './Features';
import { Gallery } from './Gallery';
import { Hero } from './Hero';
import { Install } from './Install';

export function HomePage() {
	return (
		<main>
			<Hero />
			<Features />
			<Install />
			<Gallery />
		</main>
	);
}
