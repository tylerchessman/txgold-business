// dist/cjs is CommonJS while the package is "type": "module"; this marks the folder as such.
import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../dist/cjs/package.json', import.meta.url), '{ "type": "commonjs" }\n');
