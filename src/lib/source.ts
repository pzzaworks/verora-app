import { createSource } from 'pzzadocs';
import config from '@/docs.config';

// Content source for everything under content/docs. The MDX pages only use the
// framework defaults (Cards, Callout, Steps, ...), so no extra components are registered.
export const source = createSource(config);
