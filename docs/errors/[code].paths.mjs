// One page per error code, at /errors/<code>: the URL in every error's `type`.
import { readFileSync } from 'node:fs';

const errors = JSON.parse(readFileSync(new URL('./errors.json', import.meta.url), 'utf8'));

export default {
  paths() {
    return errors.map((e) => ({
      params: { code: e.code, status: e.status, title: e.title, portal: Boolean(e.portal) },
      content: `## What it means\n\n${e.meaning}\n\n## What to do\n\n${e.fix}\n`,
    }));
  },
};
