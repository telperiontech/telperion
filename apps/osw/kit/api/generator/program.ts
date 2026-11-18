import * as ts from 'typescript';
import { join } from 'node:path';
import type { ApiModelConfig } from './config';

/** Type-checked program over the library's `tsconfig.lib.json`, resolving imports through tsconfig paths */
export function createLibraryProgram(config: ApiModelConfig): ts.Program {
	const tsconfigPath = `${config.libRoot}/tsconfig.lib.json`;
	const parsed = ts.getParsedCommandLineOfConfigFile(join(config.workspaceRoot, tsconfigPath), {}, {
		...ts.sys,
		onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
			throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
		},
	});

	if (!parsed) throw new Error(`Could not read ${tsconfigPath}`);

	return ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true } });
}

export function getSourceFile(program: ts.Program, workspaceRoot: string, sourcePath: string): ts.SourceFile {
	const file = program.getSourceFile(join(workspaceRoot, sourcePath).replace(/\\/g, '/'));

	if (!file) throw new Error(`Source file not in program: ${sourcePath}`);

	return file;
}
