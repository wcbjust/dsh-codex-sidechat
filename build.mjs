import {readFile,mkdir,writeFile} from 'node:fs/promises';
const compat=(await readFile(new URL('./src/compat.mjs',import.meta.url),'utf8')).replace(/^export /gm,'');
const core=(await readFile(new URL('./src/core.mjs',import.meta.url),'utf8')).replace(/^export /gm,'');
const client=await readFile(new URL('./src/client-body.js',import.meta.url),'utf8');
const css=await readFile(new URL('./src/style.css',import.meta.url),'utf8');
await mkdir(new URL('./lib/',import.meta.url),{recursive:true});
await writeFile(new URL('./lib/client.js',import.meta.url),`window.__ModuleLoader__.load({id:'dsh-codex-sidechat',factory:(require)=>{\nconst React=require('react');const h=React.createElement;\n${compat}\n${core}\nconst CSS=${JSON.stringify(css)};\n${client}\nreturn {name:'codex-sidechat',inject:['slots','sessions','connection','sidebarRight','sidebarRightTabs','uiSession','conversation'],apply};\n}});\n`);
console.log('Built native sidechat client (no bundled React or DSH internals)');
