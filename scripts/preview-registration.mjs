import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../dist-pages/',import.meta.url)));
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5199');
 res.setHeader('Cache-Control','no-store');
 if(url.pathname==='/api/auth-config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:'https://auth-fixture.example.test',publishableKey:'sb_publishable_browser_fixture'}));return;}
 if(url.pathname==='/api/status'){res.setHeader('Content-Type','application/json');res.end('{"configured":true}');return;}
 if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"UI test does not call live services"}');return;}
 try{const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!file.startsWith(root+path.sep))throw Error();const body=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end('Not found');}
}).listen(5199,'127.0.0.1',()=>console.log('Registration UI preview http://127.0.0.1:5199'));
