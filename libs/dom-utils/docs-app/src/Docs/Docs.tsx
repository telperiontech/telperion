import { ApiDocsRoot, createApiDocs, type DocsModel } from '@osw/api';
import generated from '../generated/docs-model.json';
import { BASE_PATH } from './base-path';
import { OverviewPage } from './OverviewPage';
import { EntryShowcase } from '../showcase';

const docs = createApiDocs({
	model: generated as DocsModel,
	name: 'dom-utils',
	basePath: BASE_PATH,
	libRoot: 'libs/dom-utils',
	overview: OverviewPage,
	entryShowcase: EntryShowcase,
});

export default function Docs() {
	return <ApiDocsRoot docs={docs} />;
}
