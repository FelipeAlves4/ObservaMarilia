import { useEffect, useRef } from 'react';
import type { Occurrence, Region } from '../types';

export const MARILIA_CENTER: [number,number] = [-22.22,-49.95];
const TILE_URL=import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
type Coordinates={latitude:number;longitude:number};
type Variant='dashboard'|'public'|'full'|'picker';
declare global { interface Window { L?: { map:(...args:any[])=>any; tileLayer:(...args:any[])=>any; layerGroup:(...args:any[])=>any; circleMarker:(...args:any[])=>any } } }

export const hasLocation=(r:{latitude?:number|null;longitude?:number|null})=>
  typeof r.latitude==='number' && Number.isFinite(r.latitude) && r.latitude>=-90 && r.latitude<=90
  && typeof r.longitude==='number' && Number.isFinite(r.longitude) && r.longitude>=-180 && r.longitude<=180;

export function CityMap({records=[],variant='dashboard',selected,onSelect,heat=false,point,onPick}:{
  records?:Occurrence[];variant?:Variant;selected?:Region;onSelect?:(region:Region)=>void;
  heat?:boolean;point?:Coordinates|null;onPick?:(point:Coordinates)=>void;
}){
  const root=useRef<HTMLDivElement>(null),mapRef=useRef<any>(null),layerRef=useRef<any>(null);
  const pickRef=useRef(onPick),selectRef=useRef(onSelect);
  pickRef.current=onPick;selectRef.current=onSelect;
  useEffect(()=>{
    const L=window.L;
    if(!L||!root.current)return;
    const map=L.map(root.current,{scrollWheelZoom:false}).setView(MARILIA_CENTER,variant==='full'?13:12);
    L.tileLayer(TILE_URL,{maxZoom:19,attribution:ATTRIBUTION,detectRetina:false}).addTo(map);
    mapRef.current=map;layerRef.current=L.layerGroup().addTo(map);
    const handler=(event:{latlng:{lat:number;lng:number}})=>pickRef.current?.({latitude:Number(event.latlng.lat.toFixed(6)),longitude:Number(event.latlng.lng.toFixed(6))});
    map.on('click',handler);
    const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(root.current);
    return ()=>{observer.disconnect();map.off('click',handler);map.remove();mapRef.current=null;layerRef.current=null;};
  },[variant]);
  const located=records.filter(hasLocation);
  useEffect(()=>{
    const L=window.L,map=mapRef.current,layer=layerRef.current;
    if(!L||!map||!layer)return;
    layer.clearLayers();
    for(const r of located){
      const chosen=selected===r.region;
      const marker=L.circleMarker([r.latitude!,r.longitude!],{radius:heat?17:chosen?12:9,
        color:chosen?'#0c3c6d':'#ffffff',weight:chosen?4:2,
        fillColor:r.status==='Resolvida'?'#10b981':r.priority==='Alta'?'#e8553d':'#2563eb',fillOpacity:heat?.45:.9
      }).addTo(layer);
      const popup=document.createElement('div'),title=document.createElement('strong'),summary=document.createElement('p'),link=document.createElement('a');
      title.textContent=r.title;summary.textContent=r.protocol+' · '+r.status;link.textContent='Abrir ocorrência';link.href='#/ocorrencias/'+encodeURIComponent(r.id);
      popup.append(title,summary,link);marker.bindPopup(popup);marker.on('click',()=>selectRef.current?.(r.region));
    }
    if(point){
      L.circleMarker([point.latitude,point.longitude],{radius:11,color:'#fff',weight:3,fillColor:'#f97316',fillOpacity:1}).addTo(layer)
        .bindTooltip('Ponto escolhido',{direction:'top'});
      map.setView([point.latitude,point.longitude],16);
    }
  },[records,selected,heat,point?.latitude,point?.longitude]);
  const missing=records.length-located.length;
  return <div className={'osm-map-wrapper map-variant-'+variant}>
    <div className={'osm-map'+(onPick?' osm-map-picker':'')} ref={root}
      style={{height:variant==='full'?480:variant==='picker'?280:variant==='public'?275:325}}
      role="region" aria-label={onPick?'Clique no mapa para escolher a localização do problema':'Mapa real de Marília com marcadores de ocorrências'} />
    {variant==='picker'?<p className="osm-note">Clique no mapa para definir ou ajustar o ponto exato.</p>:
      <p className="osm-note"><strong>{located.length}</strong> ocorrência(s) com coordenadas{missing>0?' · '+missing+' sem localização confirmada':''}.
      {missing>0?' Não exibimos marcadores em posições inventadas.':''}</p>}
  </div>;
}
