import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve('docs');let count=0;
for(const filename of readdirSync(root)){
 const file=join(root,filename),text=readFileSync(file,'utf8');
 if(filename.endsWith('.js')){execFileSync(process.execPath,['--check',file]);for(const m of text.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)){if(!existsSync(resolve(dirname(file),m[1])))throw Error('Missing import: '+m[1]);}count++;}
 if(filename.endsWith('.html'))for(const m of text.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g)){if(!existsSync(resolve(root,m[1])))throw Error('Missing asset: '+m[1]);}
}
console.log(`PASS: ${count} JavaScript modules; local HTML asset references and imports exist.`);
