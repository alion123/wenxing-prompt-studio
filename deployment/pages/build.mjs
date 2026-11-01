import {fileURLToPath} from 'node:url';
import {resolve,relative,sep} from 'node:path';
import {mkdir,writeFile,readdir,readFile,stat} from 'node:fs/promises';
import {build as viteBuild} from 'vite';
import react from '@vitejs/plugin-react';
import {build as bundle} from 'esbuild';

const project=fileURLToPath(new URL('../../',import.meta.url));
const out=resolve(project,'dist-pages');
if(relative(project,out).split(sep).includes('..')||relative(project,out)!=='dist-pages')throw Error('Invalid output directory');
await viteBuild({configFile:false,root:resolve(project,'deployment/pages/client'),publicDir:resolve(project,'public'),plugins:[react()],resolve:{alias:{'@':project}},css:{postcss:project},build:{outDir:out,emptyOutDir:true,sourcemap:false}});
await bundle({entryPoints:[resolve(project,'deployment/pages/worker.ts')],outfile:resolve(out,'_worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,sourcemap:false,legalComments:'inline'});
await writeFile(resolve(out,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:[]},null,2));
const files=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory())await walk(path);else files.push(path);}}
await walk(out);
if(files.length>1000)throw Error('Pages dashboard file limit exceeded');
for(const path of files){if((await stat(path)).size>25*1024*1024)throw Error(`Oversized asset: ${relative(out,path)}`);if(/(^|[/\\])\.(?:env|dev\.vars|git)/.test(relative(out,path)))throw Error('Private file in export');}
let privateVars='';try{privateVars=await readFile(resolve(project,'.dev.vars'),'utf8');}catch{}
const key=privateVars.match(/^DEEPSEEK_API_KEY\s*=\s*["']?([^"'\r\n]+)/m)?.[1]?.trim();
if(key)for(const path of files)if((await readFile(path)).includes(Buffer.from(key)))throw Error('Provider secret found in export; do not upload');
console.log(JSON.stringify({directory:out,files:files.length,largestBytes:Math.max(...await Promise.all(files.map(async p=>(await stat(p)).size))),secretScan:key?'passed':'no local key available'}));
