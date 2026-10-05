import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { regions, type Occurrence, type Region } from '../types';
import { asset } from './ui';

type Variant = 'dashboard' | 'public' | 'full';
const positions = {
  dashboard: [[130,90,46,'imgEllipse3'],[350,205,56,'imgEllipse4'],[540,112,38,'imgEllipse5'],[465,270,32,'imgEllipse6'],[220,250,36,'imgEllipse7']],
  public: [[144,74,44,'imgCluster'],[352,142,52,'imgCluster1'],[654,92,38,'imgCluster2'],[486,226,34,'imgCluster3'],[236,208,36,'imgCluster4']],
  full: [[125,145,50,'imgCluster18'],[292,230,42,'imgCluster7'],[576,160,38,'imgCluster5'],[474,380,56,'imgCluster12'],[205,470,40,'imgCluster6']],
} as const;
export function CityMap({ records, variant = 'dashboard', selected, onSelect, heat = true }: { records: Occurrence[]; variant?: Variant; selected?: string; onSelect?: (r: Region) => void; heat?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(690);
  const [zoom, setZoom] = useState(1);
  const dimensions = variant === 'full' ? [746,650] : variant === 'public' ? [814,288] : [690,334];
  const [nativeWidth, nativeHeight] = dimensions;
  const screen = variant === 'full' ? '5-2' : variant === 'public' ? '23-2' : 'dashboard';
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(container.current); return () => observer.disconnect();
  }, []);
  const rect = (x: number, y: number, w: number, h: number, className: string, key: string) => <div key={key} className={className} style={{ left:x, top:y, width:w, height:h }} />;
  const horizontal = variant === 'full' ? [[26,70,694],[54,154,640],[28,245,688],[82,338,620],[36,430,670],[64,530,630]] : variant === 'public' ? [[28,45,744],[62,106,686],[30,170,752],[86,234,640]] : [[30,55,640],[80,130,560],[35,210,615],[90,285,520]];
  const vertical = variant === 'full' ? [[110,24,596],[220,40,570],[350,16,610],[485,30,590],[620,44,560]] : variant === 'public' ? [[130,18,248],[286,12,262],[456,20,246],[644,24,238]] : [[130,22,290],[285,18,300],[445,25,280],[585,30,270]];
  const park = variant === 'full' ? [[420,82,104,74],[82,386,92,70]] : variant === 'public' ? [[500,32,108,56],[80,196,92,56]] : [[420,50,100,52],[95,235,86,60]];
  return <div className="city-map-wrapper">
    <div className="city-map" ref={container} style={{ height:width * nativeHeight / nativeWidth }} aria-label="Mapa esquemático das ocorrências por região">
      <div className="map-drawing" style={{ width:nativeWidth, height:nativeHeight, transform:`scale(${width / nativeWidth})`, transformOrigin:'top left' }}>
        <div className="map-zoom-layer" style={{ width:nativeWidth, height:nativeHeight, transform:`scale(${zoom})` }}>
          {variant === 'dashboard' ? <>{rect(28,30,210,92,'map-zone zone-blue','z1')}{rect(244,22,186,110,'map-zone zone-purple','z2')}{rect(438,112,222,110,'map-zone zone-green','z3')}{rect(188,204,250,108,'map-zone zone-amber','z4')}</> : null}
          {horizontal.map(([x,y,w],i) => rect(x,y,w,variant === 'public' ? 7 : 8,'map-street','h'+i))}
          {vertical.map(([x,y,h],i) => rect(x,y,variant === 'public' ? 7 : 8,h,'map-street','v'+i))}
          {park.map(([x,y,w,h],i) => rect(x,y,w,h,'map-park','p'+i))}
          {variant !== 'public' ? <><div className="map-arterial diagonal" style={{ left:variant === 'full' ? 28 : 48, top:variant === 'full' ? 290 : 176, width:variant === 'full' ? 690 : 610 }} /><div className="map-arterial vertical" style={{ left:variant === 'full' ? 328 : 185, top:30, height:variant === 'full' ? 620 : 280 }} /></> : null}
          {variant === 'full' && heat ? <>{[[62,82,'imgHotspotPavimentacao'],[99,119,'imgHotspotPavimentacaoCore'],[420,330,'imgHotspotIluminacao'],[530,92,'imgHotspotLimpeza']].map(([x,y,name]) => <img key={name} className="map-halo" src={asset(screen,String(name))} alt="" style={{ left:x, top:y } as CSSProperties} />)}</> : null}
          {variant !== 'public' ? <><span className="map-label" style={{ left:48, top:38 }}>ZONA NORTE</span><span className="map-label" style={{ left:variant === 'full' ? 306 : 320, top:variant === 'full' ? 284 : 146 }}>CENTRO</span><span className="map-label" style={{ left:538, top:variant === 'full' ? 286 : 64 }}>ZONA LESTE</span><span className="map-label" style={{ left:variant === 'full' ? 342 : 438, top:variant === 'full' ? 550 : 286 }}>ZONA SUL</span></> : null}
          {positions[variant].map(([x,y,size,name],i) => {
            const region = regions[i]; const count = records.filter(r => r.region === region).length;
            return count ? <button key={region} className={'map-cluster ' + (selected === region ? 'selected' : '')} style={{ left:x, top:y, width:size, height:size }} onClick={() => onSelect?.(region)} aria-label={`${region}: ${count} ocorrências`} aria-pressed={selected === region}>
              <img src={asset(screen,name)} alt="" /><span>{count}</span>
            </button> : null;
          })}
        </div>
        <div className="map-legend"><img src={asset('dashboard','imgEllipse8')} alt="" /> Ocorrências por região</div>
        {variant !== 'public' ? <div className="map-chip">{records.length} relatos no período</div> : null}
      </div>
      {variant === 'full' ? <div className="map-zoom"><button aria-label="Aproximar mapa" disabled={zoom >= 1.6} onClick={() => setZoom(z => Math.min(1.6,z+0.2))}>+</button><button aria-label="Afastar mapa" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1,z-0.2))}>−</button></div> : null}
    </div>
    <p className="map-caption">Mapa esquemático do protótipo · posições ilustrativas, sem geolocalização</p>
  </div>;
}
