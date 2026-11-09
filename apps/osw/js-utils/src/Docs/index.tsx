import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/js-utils/Docs`): mounts the docs into the shell's `<osw-js-utils>` */
export async function bootstrap(element: HTMLElement) {
	const root = ReactDOM.createRoot(element);
	const previousTitle = document.title;

	root.render(
		<StrictMode>
			<Docs />
		</StrictMode>
	);

	return () => {
		root.unmount();
		document.title = previousTitle;
	};
}
