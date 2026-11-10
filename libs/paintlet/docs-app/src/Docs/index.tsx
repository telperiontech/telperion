import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { OswRemote } from '@osw/core';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/paintlet/Docs`): mounts the docs into the shell's `<osw-paintlet>` */
export const bootstrap: OswRemote['bootstrap'] = (element) => {
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
};
