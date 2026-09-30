import { passwordReset } from './password-reset';
import type { TemplateRegistry } from './types';

export const templates: TemplateRegistry = {
  'password-reset': passwordReset,
};

export type { RenderedEmail, TemplateDefinition } from './types';
