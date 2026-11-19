import { docsRemote } from '@osw/docs';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/reactive-storage/Docs`): mounts the docs into the shell's `<osw-reactive-storage>` */
export const bootstrap = docsRemote(Docs);
