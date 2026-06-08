import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, '../src/index.js');
const distDir = path.join(__dirname, '..', 'dist');
const dist = path.join(distDir, 'index.js');

if(!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
const code = fs.readFileSync(src, 'utf8');
fs.writeFileSync(dist, code, 'utf8');
console.log('Built @subkit/game-engine to dist/index.js');
