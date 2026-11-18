import { ApiDocsRoot, createApiDocs, type DocsModel } from '@osw/api';
import generated from '../generated/docs-model.json';
import { BASE_PATH } from './base-path';
import { OverviewPage } from './OverviewPage';

const docs = createApiDocs({
	model: generated as DocsModel,
	name: 'extra-ts-types',
	basePath: BASE_PATH,
	libRoot: 'libs/extra-ts-types',
	overview: OverviewPage,
});

export default function Docs() {
	return <ApiDocsRoot docs={docs} />;
}
