import {readFile,mkdir,writeFile} from 'node:fs/promises';
// Normalize before JSON serialization so Windows and Linux builds match.
async function source(name) {
  return (await readFile(new URL(name,import.meta.url),'utf8')).replace(/\r\n?/g,'\n');
}
const compat=(await source('./src/compat.mjs')).replace(/^export /gm,'');
const core=(await source('./src/core.mjs')).replace(/^export /gm,'');
const client=await source('./src/client-body.js');
const css=await source('./src/style.css');
await mkdir(new URL('./lib/',import.meta.url),{recursive:true});
await writeFile(new URL('./lib/client.js',import.meta.url),`window.__ModuleLoader__.load({id:'dsh-codex-sidechat',factory:(require)=>{\nconst React=require('react');const h=React.createElement;\n${compat}\n${core}\nconst CSS=${JSON.stringify(css)};\n${client}\nreturn {name:'codex-sidechat',inject:['slots','sessions','connection','sidebarRight','sidebarRightTabs','uiSession','conversation'],apply};\n}});\n`);
console.log('Built native sidechat client (no bundled React or DSH internals)');
