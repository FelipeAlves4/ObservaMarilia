// Consulta acionada explicitamente pelo usuário; o Nominatim público proíbe autocomplete.
// Uso compartilhado exige proxy com limitação GLOBAL 1 req/s e cache.
export type GeocodeResult={latitude:number;longitude:number;label:string};
let lastCall=0,working=false;
const memory=new Map<string,GeocodeResult|null>();
export async function geocodeMarilia(address:string,neighborhood:string):Promise<GeocodeResult|null>{
 if(address.trim().length<5)throw new Error('Digite uma rua ou referência mais completa.');
 const q=[address.trim(),neighborhood.trim(),'Marília','São Paulo','Brasil'].filter(Boolean).join(', ');
 if(memory.has(q))return memory.get(q)??null;
 if(working)throw new Error('Aguarde a consulta anterior.');
 working=true;
 try{
   const wait=1100-(Date.now()-lastCall);
   if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
   lastCall=Date.now();
   const url=new URL(import.meta.env.VITE_NOMINATIM_URL||'https://nominatim.openstreetmap.org/search');
   url.searchParams.set('q',q);url.searchParams.set('format','jsonv2');
   url.searchParams.set('limit','5');url.searchParams.set('addressdetails','1');url.searchParams.set('countrycodes','br');
   const res=await fetch(url,{headers:{Accept:'application/json'}});
   if(!res.ok)throw new Error(res.status===429?'Muitas consultas. Tente novamente depois.':'Serviço de busca temporariamente indisponível.');
   const places=await res.json() as Array<{lat:string;lon:string;display_name:string;address?:Record<string,string>}>;
   const chosen=places.find(p=>[p.address?.city,p.address?.town,p.address?.municipality,p.address?.county,p.display_name]
      .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes('marília'));
   const latitude=Number(chosen?.lat),longitude=Number(chosen?.lon);
   const value=chosen&&Number.isFinite(latitude)&&Number.isFinite(longitude)?{latitude,longitude,label:chosen.display_name}:null;
   memory.set(q,value);return value;
 }finally{working=false;}
}
