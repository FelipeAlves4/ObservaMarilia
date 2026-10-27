import { useRef, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useData } from '../data';
import { categories, regions, type Occurrence, type Category, type Region } from '../types';
import { ErrorBox } from '../components/ui';
import { CityMap } from '../components/CityMap';
import { geocodeMarilia } from '../map/geocode';
export function Report() {
  const { refresh }=useData(); const [photo,setPhoto]=useState<File|null>(null); const [preview,setPreview]=useState<string|null>(null);
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [reading,setReading]=useState(false);
  const [success,setSuccess]=useState<Occurrence|null>(null); const fileInput=useRef<HTMLInputElement>(null);
  const addressInput=useRef<HTMLInputElement>(null), neighborhoodInput=useRef<HTMLInputElement>(null);
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
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || reading) return;
    const data=new FormData(e.currentTarget); setBusy(true); setError('');
    try {
      const record=await api.create({ title:String(data.get('title')), category:String(data.get('category')) as Category, region:String(data.get('region')) as Region,
        address:String(data.get('address')), neighborhood:String(data.get('neighborhood')), description:String(data.get('description')), photo,latitude:location?.latitude??null,longitude:location?.longitude??null });
      setSuccess(record); await refresh();
    } catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar.'); }
    finally { setBusy(false); }
  }
  return <div className="report-shell"><header className="report-header"><a href="#/">ObservaMarilia<small>Minha cidade</small></a><span className="avatar">FA</span></header><main className="report-content">
    {success ? <div className="report-success" role="status"><span className="success-mark">✓</span><h1>Relato enviado!</h1><p>Seu registro foi salvo e está em análise.</p><div className="protocol-box"><small>SEU PROTOCOLO</small><strong>{success.protocol}</strong></div><p>Prioridade sugerida: <strong>{success.priority}</strong>. A equipe municipal deve validar a triagem.</p><a className="btn btn-teal full-width" href={'#/ocorrencias/'+success.id}>Acompanhar ocorrência</a><a className="btn btn-light full-width" href="#/meus-relatos">Ver meus relatos</a></div>
    : <><h1>Reportar um problema</h1><p>Ajude a melhorar a cidade informando o que aconteceu.</p><form noValidate onSubmit={submit}>
      <label className={'photo-upload ' + (photo ? 'has-photo' : '')} htmlFor="photo">{photo && preview ? <img src={preview} alt="Prévia da foto selecionada" /> : <><span className="photo-plus">+</span><strong>{reading ? 'Carregando foto…' : 'Adicionar foto do local'}</strong><small>JPG ou PNG · até 2 MB · opcional</small></>}</label>
      <input ref={fileInput} id="photo" className="visually-hidden" type="file" accept="image/jpeg,image/png" onChange={e => choosePhoto(e.target.files?.[0])} aria-label="Adicionar foto do local" />
      {photo ? <button type="button" className="text-button" onClick={() => { setPhoto(null); setPreview(null); if(fileInput.current) fileInput.current.value=''; }}>Remover foto</button> : null}
      <label htmlFor="title">Título do problema<input id="title" name="title" placeholder="Ex.: buraco na Av. das Esmeraldas" required minLength={5} maxLength={100} /></label>
      <label htmlFor="category">Categoria<select id="category" name="category" aria-label="Categoria">{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label htmlFor="address">Localização<input ref={addressInput} id="address" name="address" placeholder="Rua, avenida e número ou referência" required minLength={5} maxLength={160} /></label>
      <div className="form-two"><label htmlFor="neighborhood">Bairro<input ref={neighborhoodInput} id="neighborhood" name="neighborhood" placeholder="Seu bairro" required minLength={2} maxLength={80} /></label><label htmlFor="region">Região<select id="region" name="region" aria-label="Região">{regions.map(r => <option key={r}>{r}</option>)}</select></label></div>
      <section className="report-location-picker">
        <div className="report-location-actions"><strong>Localização no mapa</strong><button className="btn btn-outline" type="button" disabled={geocoding} onClick={()=>void searchLocation()}>{geocoding?'Buscando…':'Buscar endereço no mapa'}</button></div>
        <CityMap variant="picker" point={location} onPick={p=>{setLocation(p);setLocationMessage('Localização selecionada manualmente.');setError('');}} />
        {location?<div className="location-confirmed"><strong>✓ Ponto selecionado</strong><span>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span><button className="text-button" type="button" onClick={()=>{setLocation(null);setLocationMessage('');}}>Limpar</button></div>:<small>Sem ponto definido. Você ainda pode enviar o relato sem coordenadas.</small>}
        {locationMessage?<p className="osm-note" role="status">{locationMessage}</p>:null}
        <small>A busca é feita sob demanda por um serviço controlado, com cache e limite global de frequência.</small>
      </section>
      <label htmlFor="description">Descrição<textarea className="resize-none" id="description" name="description" placeholder="Ex.: buraco grande próximo à faixa de pedestres..." required minLength={10} maxLength={1200} rows={4} /></label>
      <div className="form-info">A prioridade é sugerida por regras explícitas; a análise e o encaminhamento são feitos por um gestor.</div><ErrorBox error={error} /><button type="submit" className="btn btn-submit full-width" disabled={busy || reading}>{busy ? 'Enviando…' : 'Enviar ocorrência'}</button>
    </form></>}
    <a className="report-back" href="#/">Voltar para a cidade</a>
  </main></div>;
}
