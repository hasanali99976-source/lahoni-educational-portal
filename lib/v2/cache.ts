type Entry<T>={value:T;expires:number};
const memory=new Map<string,Entry<unknown>>();const inflight=new Map<string,Promise<unknown>>();
export async function readThrough<T>(key:string,ttlMs:number,loader:()=>Promise<T>):Promise<T>{const now=Date.now();const hit=memory.get(key) as Entry<T>|undefined;if(hit&&hit.expires>now)return hit.value;const pending=inflight.get(key) as Promise<T>|undefined;if(pending)return pending;const task=loader().then(value=>{memory.set(key,{value,expires:Date.now()+ttlMs});return value}).finally(()=>inflight.delete(key));inflight.set(key,task);return task}
export function invalidateV2Cache(prefix:string){for(const key of memory.keys())if(key.startsWith(prefix))memory.delete(key)}
export const V2_CACHE_TTL={directory:10*60_000,classOptions:5*60_000,gradePlan:10*60_000,mutable:30_000} as const;
