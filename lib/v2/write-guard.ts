function stable(value:unknown):string{if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;if(value&&typeof value==="object"){return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(",")}}`}return JSON.stringify(value)}
export function hasMeaningfulChange(current:unknown,next:unknown){return stable(current)!==stable(next)}
export function guardedMutation<T>(current:T,next:T){return hasMeaningfulChange(current,next)?{shouldWrite:true,value:next}:{shouldWrite:false,value:current}}
