import { docsRemote } from '@osw/docs';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/frp-gate/Docs`): mounts the docs into the shell's `<osw-frp-gate>` */
export const bootstrap = docsRemote(Docs);
