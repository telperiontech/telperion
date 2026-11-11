import { docsRemote } from '@osw/docs';
import '../styles/docs.css';
import Docs from './Docs';

/** Module Federation entry (`osw/paintlet/Docs`): mounts the docs into the shell's `<osw-paintlet>` */
export const bootstrap = docsRemote(Docs);
