import { docsRemote } from '@osw/docs';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/dom-utils/Docs`): mounts the docs into the shell's `<osw-dom-utils>` */
export const bootstrap = docsRemote(Docs);
