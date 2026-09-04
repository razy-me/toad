import { parseToad } from './src/parser/parser.js';
import { ImportResolver } from './src/parser/importResolver.js';

const code = 'rect { backdrop-filter: blur(20px); }';
const ast = parseToad(code, 'test.toad');
const resolver = new ImportResolver(ast, 'test.toad');
resolver.resolve().then(res => console.dir(res.elements[0], { depth: null }));
