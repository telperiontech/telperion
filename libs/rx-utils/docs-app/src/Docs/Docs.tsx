import { ApiDocsRoot, createApiDocs, type DocsModel } from '@osw/api';
import generated from '../generated/docs-model.json';
import { EntryMarbles } from '../marbles';
import { BASE_PATH } from './base-path';
import { OverviewPage } from './OverviewPage';

const docs = createApiDocs({
	model: generated as DocsModel,
	name: 'rx-utils',
	basePath: BASE_PATH,
	libRoot: 'libs/rx-utils',
	overview: OverviewPage,
	entryShowcase: EntryMarbles,
});

export default function Docs() {
	return <ApiDocsRoot docs={docs} />;
}
