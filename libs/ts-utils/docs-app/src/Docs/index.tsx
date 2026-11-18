import { docsRemote } from '@osw/docs';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/ts-utils/Docs`): mounts the docs into the shell's `<osw-ts-utils>` */
export const bootstrap = docsRemote(Docs);
