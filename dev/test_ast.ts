import { parseToad } from './src/parser/parser.js'; console.dir(parseToad('rect { filter: blur(20px); }', 'test').elements[0].properties, { depth: null });  
