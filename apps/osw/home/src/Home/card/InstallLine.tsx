import { installCommand, type Library } from '../data';
import { CodeLine } from '../ui';

export function InstallLine({ library }: { library: Library }) {
	return <CodeLine code={installCommand(library)} language="sh" prompt="$" className="relative z-10 bg-neutral-30" />;
}
