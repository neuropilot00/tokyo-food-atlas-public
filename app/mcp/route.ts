import {env} from 'cloudflare:workers';
import {handleMcp} from '../../lib/atlas-server.mjs';
export const dynamic='force-dynamic';
export const POST=(request:Request)=>handleMcp(request,env);
