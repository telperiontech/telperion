import { docsRemote } from '@osw/docs';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/extra-ts-types/Docs`): mounts the docs into the shell's `<osw-extra-ts-types>` */
export const bootstrap = docsRemote(Docs);
