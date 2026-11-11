import { docsRemote } from '@osw/docs';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/js-utils/Docs`): mounts the docs into the shell's `<osw-js-utils>` */
export const bootstrap = docsRemote(Docs);
