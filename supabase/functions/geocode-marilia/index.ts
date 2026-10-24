import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const response = (status: number, body: unknown, origin: string) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', Vary:'Origin' } });
Deno.serve(async request => {
  const origin=request.headers.get('Origin') ?? '';
  const allowed=(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(value=>value.trim());
  if(request.method==='OPTIONS') return response(204,{},allowed.includes(origin)?origin:'');
  if(!allowed.includes(origin)) return response(403,{error:'Origem não autorizada.'},'');
  const authorization=request.headers.get('Authorization'), url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_ANON_KEY'), serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!authorization||!url||!key||!serviceKey) return response(401,{error:'Sessão inválida.'},origin);
  const client=createClient(url,key,{global:{headers:{Authorization:authorization}}});
  const { data:{user} }=await client.auth.getUser(); if(!user) return response(401,{error:'Sessão inválida.'},origin);
  const body=await request.json().catch(()=>null) as {address?:string;neighborhood?:string}|null;
  const address=body?.address?.trim() ?? '', neighborhood=body?.neighborhood?.trim() ?? '';
  if(address.length<5) return response(400,{error:'Digite uma rua ou referência mais completa.'},origin);
  const query=[address,neighborhood,'Marília','São Paulo','Brasil'].filter(Boolean).join(', ');
  const queryKey=query.toLocaleLowerCase('pt-BR');
  const {data: claim,error:claimError}=await client.rpc('claim_geocode',{p_query_key:queryKey});
  if(claimError) return response(429,{error:claimError.message},origin);
  if(claim.cached) return response(200,claim,origin);
  const endpoint=Deno.env.get('NOMINATIM_URL') ?? 'https://nominatim.openstreetmap.org/search';
  const params=new URLSearchParams({q:query,format:'jsonv2',limit:'5',addressdetails:'1',countrycodes:'br'});
  const result=await fetch(`${endpoint}?${params}`,{headers:{Accept:'application/json','User-Agent':'ObservaMarilia/1.0 (+https://observa-marilia.vercel.app)'}});
  if(!result.ok) return response(result.status===429?429:503,{error:'Serviço de busca temporariamente indisponível.'},origin);
  const places=await result.json() as Array<{lat:string;lon:string;display_name:string;address?:Record<string,string>}>;
  const chosen=places.find(place=>[place.address?.city,place.address?.town,place.address?.municipality,place.address?.county,place.display_name].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes('marília'));
  const latitude=Number(chosen?.lat),longitude=Number(chosen?.lon);
  const value=chosen&&Number.isFinite(latitude)&&Number.isFinite(longitude)?{latitude,longitude,label:chosen.display_name}:null;
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  await admin.from('geocode_cache').upsert({query_key:queryKey,latitude:value?.latitude ?? null,longitude:value?.longitude ?? null,label:value?.label ?? null,expires_at:new Date(Date.now()+30*24*60*60*1000).toISOString()});
  return response(200,{cached:false,...value},origin);
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/geocode-marilia' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --header 'Authorization: Bearer <UserToken>'
*/
