import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { OswRemote } from '@osw/core';
import Home from './Home';

/** Module Federation entry (`osw/home/Home`): mounts the home page into the shell's `<osw-home>` */
export const bootstrap: OswRemote['bootstrap'] = (element) => {
	const root = ReactDOM.createRoot(element);

	root.render(
		<StrictMode>
			<Home />
		</StrictMode>
	);

	return () => root.unmount();
};
