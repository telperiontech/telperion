import { createContext, useContext } from 'react';
import type { ApiDocs } from './api-docs';

export const ApiDocsContext = createContext<ApiDocs | null>(null);

/** The remote's `createApiDocs` result; only valid below `<ApiDocs>` */
export function useApiDocs(): ApiDocs {
	const docs = useContext(ApiDocsContext);

	if (!docs) throw new Error('useApiDocs must be used inside <ApiDocs>');

	return docs;
}
