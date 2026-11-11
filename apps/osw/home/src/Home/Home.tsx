import { Catalog } from './catalog';
import { Hero } from './hero';

/** The shell provides the header and footer; home uses their fallback content and projects nothing */
export default function Home() {
	return (
		<main>
			<Hero />
			<Catalog />
		</main>
	);
}
