import { ApiDocsRoot, createApiDocs, type DocsModel } from '@osw/api';
import generated from '../generated/docs-model.json';
import { EntryPlayground } from '../playground';
import { BASE_PATH } from './base-path';
import { OverviewPage } from './OverviewPage';

const docs = createApiDocs({
	model: generated as DocsModel,
	name: 'reactive-storage',
	basePath: BASE_PATH,
	libRoot: 'libs/reactive-storage',
	overview: OverviewPage,
	entryShowcase: EntryPlayground,
});

export default function Docs() {
	return <ApiDocsRoot docs={docs} />;
}
