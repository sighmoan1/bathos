import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const current=pkg.dependencies?.['@bathos/design-system'];
if(!current) throw new Error('Consumer has no pinned design-system dependency');
const match=current.match(/releases\/download\/v(\d+\.\d+\.\d+)\/bathos-design-system-\1\.tgz$/);
if(!match) throw new Error('Expected an exact official release archive URL');
const res=await fetch('https://api.github.com/repos/sighmoan1/bathos-design-system/releases/latest',{headers:{Accept:'application/vnd.github+json',...(process.env.GH_TOKEN?{Authorization:`Bearer ${process.env.GH_TOKEN}`}:{})}});
if(!res.ok)throw new Error(`Release lookup failed: ${res.status}`);
const release=await res.json();
if(release.draft||release.prerelease||!/^v\d+\.\d+\.\d+$/.test(release.tag_name))throw new Error('Expected a stable semantic release');
const version=release.tag_name.slice(1), from=match[1].split('.').map(Number), to=version.split('.').map(Number);
if(to[0]!==from[0]){console.log('Major upgrade requires owner migration review');process.exit(0);}
if(to.every((v,i)=>v===from[i])||to[1]<from[1]||(to[1]===from[1]&&to[2]<from[2])){console.log('Consumer is current');process.exit(0);}
const url=`https://github.com/sighmoan1/bathos-design-system/releases/download/v${version}/bathos-design-system-${version}.tgz`;
if(!release.assets.some(a=>a.browser_download_url===url))throw new Error('Release package is missing');
if(process.env.PACKAGE_MANAGER==='pnpm') execFileSync('pnpm',['add',`@bathos/design-system@${url}`],{stdio:'inherit'});
else execFileSync('npm',['install',`@bathos/design-system@${url}`],{stdio:'inherit'});
if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,`changed=true\nversion=${version}\n`,{flag:'a'});
