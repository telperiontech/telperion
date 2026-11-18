import { docsRemote } from '@osw/docs';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/rx-utils/Docs`): mounts the docs into the shell's `<osw-rx-utils>` */
export const bootstrap = docsRemote(Docs);
