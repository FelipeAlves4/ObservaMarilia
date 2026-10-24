import { supabase } from '../supabase';

// Consulta acionada explicitamente pelo usuário. O controle global de cache e
// frequência é feito pela Edge Function, nunca pelo navegador.
export type GeocodeResult={latitude:number;longitude:number;label:string};
const memory=new Map<string,GeocodeResult|null>();
export async function geocodeMarilia(address:string,neighborhood:string):Promise<GeocodeResult|null>{
 if(address.trim().length<5)throw new Error('Digite uma rua ou referência mais completa.');
 const q=[address.trim(),neighborhood.trim(),'Marília','São Paulo','Brasil'].filter(Boolean).join(', ');
 if(memory.has(q))return memory.get(q)??null;
 const { data, error }=await supabase.functions.invoke('geocode-marilia',{body:{address,neighborhood}});
 if(error)throw new Error(error.message || 'Serviço de busca temporariamente indisponível.');
 if(data?.error)throw new Error(data.error);
 const latitude=Number(data?.latitude),longitude=Number(data?.longitude);
 const value=Number.isFinite(latitude)&&Number.isFinite(longitude)&&data?.label
   ?{latitude,longitude,label:String(data.label)}:null;
 memory.set(q,value);return value;
}
