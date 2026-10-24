import {spawnSync} from 'node:child_process';
const files=['opening-plan.cjs','finance.cjs','recommend.cjs','cloud-sync.test.mjs','provider.test.mjs','server.test.mjs','market-data.test.mjs','frontend-validation.cjs','source-refresh.cjs'];
for(const file of files){const result=spawnSync(process.execPath,['tests/'+file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log('All verification suites passed.');
