import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const webRoot=path.join(root,fs.existsSync(path.join(root,'public'))?'public':'dist');
