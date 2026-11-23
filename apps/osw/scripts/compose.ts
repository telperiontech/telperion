import { join } from 'node:path';

export const OSW_ROOT = join(__dirname, '..');

/** `docker compose` arguments for the osw mediator (frpc). Never run plain `config`: it prints the token. */
export const COMPOSE = ['compose', '--project-name=osw', '-f', join(OSW_ROOT, 'docker-compose.mediator.yml')];
