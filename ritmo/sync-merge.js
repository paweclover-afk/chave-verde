'use strict';
(function(root){
 function equal(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
 }
 function merge(base,local,remote,path=''){
  if(equal(local,remote)||equal(remote,base))return structuredClone(local);
  if(equal(local,base))return structuredClone(remote);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  if(object(local)&&object(remote)&&(base===undefined||object(base))){
   const result={};
   for(const key of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){
    const value=merge(base?.[key],local[key],remote[key],path+'/'+key);
    if(value!==undefined)result[key]=value;
   }
   return result;
  }
  if(Array.isArray(local)&&Array.isArray(remote)&&(base===undefined||Array.isArray(base))){
   if(path.endsWith('/alerts')||path.endsWith('/events'))return [...new Set([...remote,...local])];
   const arrays=[base||[],local,remote];
   if(arrays.every(a=>a.every(v=>v&&typeof v.id==='string')&&new Set(a.map(v=>v.id)).size===a.length)){
    const maps=arrays.map(a=>new Map(a.map(v=>[v.id,v]))),out=[];
    for(const id of new Set([...maps[2].keys(),...maps[1].keys(),...maps[0].keys()])){
     const value=merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),path+'/'+id);
     if(value!==undefined)out.push(value);
    }
    return out;
   }
   if(base&&local.length===base.length&&remote.length===base.length)return local.map((v,i)=>merge(base[i],v,remote[i],path+'/'+i));
  }
  throw Error('O mesmo campo foi alterado nos dois aparelhos: '+path);
 }
 const api={merge};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.RitmoMerge=api;
})(typeof window==='object'?window:globalThis);
