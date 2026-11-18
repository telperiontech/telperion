import { ApiDocsRoot, createApiDocs, type DocsModel } from '@osw/api';
import generated from '../generated/docs-model.json';
import { BASE_PATH } from './base-path';
import { resolveLegacyPath } from './legacy-path';
import { OverviewPage } from './OverviewPage';

const docs = createApiDocs({
	model: generated as DocsModel,
	name: 'js-utils',
	basePath: BASE_PATH,
	libRoot: 'libs/js-utils',
	overview: OverviewPage,
	categoryBarrels: true,
	resolveLegacyPath,
});

export default function Docs() {
	return <ApiDocsRoot docs={docs} />;
}
