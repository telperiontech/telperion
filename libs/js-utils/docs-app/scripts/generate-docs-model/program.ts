import * as ts from 'typescript';
import { join } from 'node:path';
import { TSCONFIG_PATH, WORKSPACE_ROOT } from './config';

/** Type-checked program over the library, resolving `@telperion/js-utils/*` through tsconfig paths */
export function createLibraryProgram(): ts.Program {
	const configPath = join(WORKSPACE_ROOT, TSCONFIG_PATH);
	const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
		...ts.sys,
		onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
			throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
		},
	});

	if (!parsed) throw new Error(`Could not read ${TSCONFIG_PATH}`);

	return ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true } });
}

export function getSourceFile(program: ts.Program, sourcePath: string): ts.SourceFile {
	const file = program.getSourceFile(join(WORKSPACE_ROOT, sourcePath).replace(/\\/g, '/'));
	if (!file) throw new Error(`Source file not in program: ${sourcePath}`);
	return file;
}
