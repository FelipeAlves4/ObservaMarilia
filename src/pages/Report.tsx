import { useRef, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useData } from '../data';
import { categories, regions, type Occurrence, type Category, type Region } from '../types';
import { ErrorBox } from '../components/ui';
import { CityMap } from '../components/CityMap';
import { geocodeMarilia } from '../map/geocode';
import { useCitizenMode } from '../citizenMode';
import { useAuth } from '../auth';
export function Report() {
  const { refresh }=useData(); const [photo,setPhoto]=useState<File|null>(null); const [preview,setPreview]=useState<string|null>(null);
  const { enabled: adminCitizenMode, href } = useCitizenMode();
  const { profile } = useAuth();
  const initials = (profile?.name ?? 'Cidadão').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [reading,setReading]=useState(false);
  const [success,setSuccess]=useState<Occurrence|null>(null); const fileInput=useRef<HTMLInputElement>(null);
  const addressInput=useRef<HTMLInputElement>(null), neighborhoodInput=useRef<HTMLInputElement>(null), titleInput=useRef<HTMLInputElement>(null), descriptionInput=useRef<HTMLTextAreaElement>(null), locationBox=useRef<HTMLElement>(null);
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const [location,setLocation]=useState<{latitude:number;longitude:number}|null>(null);
  const [geocoding,setGeocoding]=useState(false),[locationMessage,setLocationMessage]=useState('');
  function choosePhoto(file?: File) {
    setError(''); if (!file) return;
    if (!['image/jpeg','image/png'].includes(file.type) || file.size > 2*1024*1024) { setError('Escolha uma foto JPG ou PNG de até 2 MB.'); if(fileInput.current) fileInput.current.value=''; return; }
    setReading(true); const reader=new FileReader();
    reader.onload=() => { setPhoto(file); setPreview(String(reader.result)); setReading(false); };
    reader.onerror=() => { setError('Não foi possível ler a foto. Tente outro arquivo.'); setReading(false); };
    reader.readAsDataURL(file);
  }
  async function searchLocation(){
    setGeocoding(true);setError('');setLocationMessage('');
    try {
      const result=await geocodeMarilia(addressInput.current?.value||'',neighborhoodInput.current?.value||'');
      if(!result)throw new Error('Não encontrei esse endereço em Marília. Selecione manualmente no mapa.');
      setLocation({latitude:result.latitude,longitude:result.longitude});
      setLocationMessage('Resultado aproximado: '+result.label+'. Confirme o ponto no mapa.');
    }catch(e){setError(e instanceof Error?e.message:'Erro na busca do endereço.');}
    finally{setGeocoding(false);}
  }
  function useCurrentLocation(){
    if(!navigator.geolocation){setLocationMessage('Localização indisponível. Marque o ponto no mapa.');return;}
    navigator.geolocation.getCurrentPosition(position=>{
      setLocation({latitude:position.coords.latitude,longitude:position.coords.longitude});
      setLocationMessage('Posição atual marcada. Ajuste o ponto se o problema estiver em outro local.');
      setFieldErrors(errors=>({...errors,location:''}));
    },()=>setLocationMessage('Não foi possível acessar sua localização. Marque o ponto no mapa.'),{enableHighAccuracy:true,timeout:12000});
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || reading) return;
    const data=new FormData(e.currentTarget); setError('');
    const title=String(data.get('title')||'').trim(), description=String(data.get('description')||'').trim();
    const address=String(data.get('address')||'').trim(), neighborhood=String(data.get('neighborhood')||'').trim();
    const errors:Record<string,string>={};
    if(title.length<5)errors.title='Informe um título com pelo menos 5 caracteres.';
    if(description.length<10)errors.description='Descreva o problema com pelo menos 10 caracteres.';
    if(!location && address.length<5)errors.location='Marque o local no mapa ou informe um endereço ou ponto de referência.';
    if(address && address.length<5)errors.address='Informe uma referência com pelo menos 5 caracteres ou deixe este campo vazio.';
    if(neighborhood && neighborhood.length<2)errors.neighborhood='Informe o bairro com pelo menos 2 caracteres ou deixe este campo vazio.';
    setFieldErrors(errors);
    if(Object.keys(errors).length){(errors.title?titleInput.current:errors.description?descriptionInput.current:errors.address?addressInput.current:errors.neighborhood?neighborhoodInput.current:locationBox.current)?.focus();return;}
    setBusy(true);
    try {
      const record=await api.create({ title, category:String(data.get('category')) as Category, region:String(data.get('region')) as Region,
        address, neighborhood, description, photo,latitude:location?.latitude??null,longitude:location?.longitude??null });
      setSuccess(record); await refresh();
    } catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar.'); }
    finally { setBusy(false); }
  }
  return <div className="report-shell"><header className="report-header"><a href={href('/')}>ObservaMarilia<small>Minha cidade</small></a><span className="avatar">{initials}</span></header>{adminCitizenMode && profile?.role === 'admin' ? <div className="citizen-view-indicator"><span>Visualizando como Cidadão · {profile.name}</span><a href="#/admin/secretarias">Voltar à Administração</a></div> : null}<main className="report-content">
    {success ? <div className="report-success" role="status"><span className="success-mark">✓</span><h1>Relato enviado!</h1><p>Seu registro foi salvo e está em análise.</p><div className="protocol-box"><small>SEU PROTOCOLO</small><strong>{success.protocol}</strong></div><p>Prioridade sugerida: <strong>{success.priority}</strong>. A equipe municipal deve validar a triagem.</p><a className="btn btn-teal full-width" href={href('/ocorrencias/'+success.id)}>Acompanhar ocorrência</a><a className="btn btn-light full-width" href={href('/meus-relatos')}>Ver meus relatos</a></div>
    : <><h1>Reportar um problema</h1><p>Ajude a melhorar a cidade informando o que aconteceu.</p><form noValidate onSubmit={submit}>
      <div className="report-form-grid"><section className="report-form-primary" aria-labelledby="report-problem-heading">
        <h2 id="report-problem-heading">Sobre o problema</h2>
        <label htmlFor="title">Título do problema<input ref={titleInput} id="title" name="title" placeholder="Ex.: buraco na Av. das Esmeraldas" required minLength={5} maxLength={100} aria-invalid={!!fieldErrors.title} />{fieldErrors.title?<small role="alert">{fieldErrors.title}</small>:null}</label>
        <label htmlFor="category">Categoria<select id="category" name="category" aria-label="Categoria">{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label htmlFor="description">Descrição<textarea ref={descriptionInput} className="resize-none" id="description" name="description" placeholder="Ex.: buraco grande próximo à faixa de pedestres..." required minLength={10} maxLength={1200} rows={7} aria-invalid={!!fieldErrors.description} />{fieldErrors.description?<small role="alert">{fieldErrors.description}</small>:null}</label>
      </section><section className="report-form-secondary" aria-labelledby="report-location-heading">
        <h2 id="report-location-heading">Onde está o problema?</h2><p>Não sabe o endereço? Marque no mapa o local aproximado do problema.</p>
        <label className={'photo-upload ' + (photo ? 'has-photo' : '')} htmlFor="photo">{photo && preview ? <img src={preview} alt="Prévia da foto selecionada" /> : <><span className="photo-plus">+</span><strong>{reading ? 'Carregando foto…' : 'Adicionar foto do local'}</strong><small>JPG ou PNG · até 2 MB · opcional</small></>}</label>
        <input ref={fileInput} id="photo" className="visually-hidden" type="file" accept="image/jpeg,image/png" onChange={e => choosePhoto(e.target.files?.[0])} aria-label="Adicionar foto do local" />
        {photo ? <button type="button" className="text-button" onClick={() => { setPhoto(null); setPreview(null); if(fileInput.current) fileInput.current.value=''; }}>Remover foto</button> : null}
      <section ref={locationBox} tabIndex={-1} className="report-location-picker" aria-label="Localização no mapa">
        <div className="report-location-actions"><strong>Marque o local no mapa</strong><button className="btn btn-outline" type="button" onClick={useCurrentLocation}>Usar minha localização</button></div>
        <CityMap variant="picker" point={location} onPick={p=>{setLocation(p);setLocationMessage('Localização selecionada manualmente.');setFieldErrors(errors=>({...errors,location:''}));}} />
        {location?<div className="location-confirmed"><strong>✓ Ponto selecionado</strong><span>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span><button className="text-button" type="button" onClick={()=>{setLocation(null);setLocationMessage('');}}>Limpar</button></div>:<small>Selecione um ponto ou informe uma referência abaixo.</small>}
        {locationMessage?<p className="osm-note" role="status">{locationMessage}</p>:null}
        {fieldErrors.location?<small role="alert">{fieldErrors.location}</small>:null}
      </section>
        <label htmlFor="address">Endereço ou ponto de referência (opcional com ponto no mapa)<input ref={addressInput} id="address" name="address" placeholder="Rua, avenida ou referência próxima" maxLength={160} aria-invalid={!!fieldErrors.address} />{fieldErrors.address?<small role="alert">{fieldErrors.address}</small>:null}</label>
        <div className="form-two"><label htmlFor="neighborhood">Bairro (opcional)<input ref={neighborhoodInput} id="neighborhood" name="neighborhood" placeholder="Se souber" maxLength={80} aria-invalid={!!fieldErrors.neighborhood} />{fieldErrors.neighborhood?<small role="alert">{fieldErrors.neighborhood}</small>:null}</label><label htmlFor="region">Região (opcional)<select id="region" name="region" aria-label="Região"><option>Não informada</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label></div>
        <button className="btn btn-outline" type="button" disabled={geocoding} onClick={()=>void searchLocation()}>{geocoding?'Buscando…':'Buscar endereço no mapa'}</button>
      </section></div>
      <div className="report-form-footer"><div className="form-info">A equipe responsável vai analisar seu relato e encaminhar o atendimento.</div><ErrorBox error={error} /><button type="submit" className="btn btn-submit full-width" disabled={busy || reading}>{busy ? 'Enviando…' : 'Enviar ocorrência'}</button></div>
    </form></>}
    <a className="report-back" href={href('/')}>Voltar para a cidade</a>
  </main></div>;
}
