import { Catalog } from './catalog';
import { Footer } from './footer';
import { Hero } from './hero';
import { Nav } from './nav';

export default function Home() {
	return (
		<div className="flex min-h-screen flex-col bg-white font-sans text-neutral-990">
			<Nav />
			<main className="flex-1">
				<Hero />
				<Catalog />
			</main>
			<Footer />
		</div>
	);
}
