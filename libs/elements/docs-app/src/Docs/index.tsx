import { docsRemote } from '@osw/docs';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/elements/Docs`): mounts the docs into the shell's `<osw-elements>` */
export const bootstrap = docsRemote(Docs);
