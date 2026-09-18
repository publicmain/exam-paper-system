import { useEffect, useRef, useState } from 'react';
import { Button } from '../design/Button';
import { medalByAssetId, medalImage, medalName } from '../lib/medal-catalog';
export function MedalImage({ assetId, locked=false, thumbnail=false, className='', alt }: { assetId:string; locked?:boolean; thumbnail?:boolean; className?:string; alt?:string }) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[assetId]);
  const label=alt??medalName(assetId);
  if(failed||!medalByAssetId(assetId)) return <div className={'grid place-items-center '+className} role="img" aria-label={label}>✧</div>;
  return <img src={medalImage(assetId,thumbnail)} alt={label} width={thumbnail?320:880} height={thumbnail?320:880} loading={thumbnail?'lazy':'eager'} decoding="async" onError={()=>setFailed(true)} className={className+(locked?' grayscale opacity-50':'')} />;
}
/** One lazy renderer. The collection remains interactive; ceremonies are presentation-only. */
export function MedalViewer({assetId,locked=false,reveal=false,ceremony=false,onReady,onRevealComplete,onError,title,height}:{assetId:string;locked?:boolean;reveal?:boolean;ceremony?:boolean;onReady?:()=>void;onRevealComplete?:()=>void;onError?:()=>void;title?:string;height?:number}) {
 const frame=useRef<HTMLIFrameElement>(null);
 const [systemReduced,setSystemReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
 const [manualReduced,setManualReduced]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const [phase,setPhase]=useState<'loading'|'ready'|'error'>('loading');
 const [staticOnly,setStaticOnly]=useState(false);
 const reduced=systemReduced||manualReduced;
 const reducedRef=useRef(reduced); reducedRef.current=reduced;
 const callbacks=useRef({onReady,onRevealComplete,onError});callbacks.current={onReady,onRevealComplete,onError};
 const completed=useRef(false);
 const initialReduced=useRef(reduced);
 const playing=reveal&&!locked;
 const src='/medals/v5/viewer.html?'+new URLSearchParams({id:assetId,locked:locked?'1':'0',reveal:playing?'1':'0',reduced:initialReduced.current?'1':'0',...(ceremony?{ceremony:'1'}:{})});
 const send=(action:string,value:unknown=true)=>frame.current?.contentWindow?.postMessage({type:'equistar-medal-control',action,value},window.location.origin);
 const complete=()=>{if(playing&&!completed.current){completed.current=true;callbacks.current.onRevealComplete?.();}};
 useEffect(()=>{
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const change=()=>setSystemReduced(media?.matches??false);
  media?.addEventListener?.('change',change);return()=>media?.removeEventListener?.('change',change);
 },[]);
 useEffect(()=>{send('reduce',reduced);},[reduced]);
 useEffect(()=>{
  completed.current=false;setPhase('loading');
  let ready=false,failed=false,startTimer:number|undefined;
  const fail=()=>{if(failed)return;failed=true;window.clearTimeout(startTimer);setPhase('error');callbacks.current.onError?.();};
  const timeout=window.setTimeout(fail,ceremony?4000:15000);
  const receive=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||event.data?.type!=='equistar-medal-viewer')return;
   if(event.data.status==='ready'&&!ready&&!failed){
    ready=true;window.clearTimeout(timeout);setPhase('ready');send('reduce',reducedRef.current);callbacks.current.onReady?.();
    if(ceremony&&playing)startTimer=window.setTimeout(()=>send('start'),reducedRef.current?0:300);
   }
   else if(event.data.status==='error'){window.clearTimeout(timeout);fail();}
   else if(event.data.status==='complete'&&(!ceremony||ready)&&!failed)complete();
   else if(event.data.status==='escape')frame.current?.closest('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  };
  window.addEventListener('message',receive);
  return()=>{window.clearTimeout(timeout);window.clearTimeout(startTimer);window.removeEventListener('message',receive);};
 },[src,attempt]);
 useEffect(()=>{
  if(!playing||!(phase==='error'||staticOnly))return;
  const timer=window.setTimeout(complete,1200);return()=>window.clearTimeout(timer);
 },[phase,staticOnly,playing,assetId]);
 return <div data-testid="medal-viewer" className={ceremony?'award-medal-viewer':'rounded-group bg-award-surface pb-1 text-award-ink'}>
  <div className={ceremony?'award-medal-stage':'relative min-h-48 w-full overflow-hidden rounded-group'} style={ceremony?undefined:{height:height??'min(46dvh, 480px)',background:'rgb(var(--c-award-surface))'}} data-testid="medal-stage">
   {/* 颁奖时加载中不铺静态大图：它和模型的尺寸对不上，换过去就是一次突变（2026-09-18）。
       只有降级（模型失败 / 只看图片）才显示图片。 */}
   {(ceremony?(phase==='error'||staticOnly):(phase!=='ready'||staticOnly))&&<MedalImage assetId={assetId} locked={locked} className="mx-auto h-full w-full object-contain"/>}
   {/* Match the embedded root: a dark/light mismatch forces an opaque UA canvas. */}
   {!staticOnly&&phase!=='error'&&<iframe key={src+':'+attempt} ref={frame} src={src} style={ceremony?{colorScheme:'light',background:'transparent'}:undefined} tabIndex={ceremony?-1:undefined} aria-hidden={ceremony||undefined} title={(title??medalName(assetId))+' · '+(locked?'未解锁灰色三维':playing?'颁奖动画':'三维藏品')} className={'absolute inset-0 h-full w-full border-0 '+(ceremony?'pointer-events-none ':'')+(phase==='ready'?'':'invisible')} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={()=>send('reduce',reducedRef.current)} data-testid="medal-3d-frame"/>}
   {phase==='loading'&&<span className={ceremony?'sr-only':'absolute inset-x-2 bottom-2 text-center text-xs text-award-muted'} role="status">正在呈现三维细节</span>}
  </div>
  {phase==='error'&&!staticOnly&&!ceremony&&<div className="mt-2 px-3 text-footnote" role="status">已改为静态展示，收藏不会受影响。<Button className="!text-award-ink hover:!bg-award-muted/15 active:!bg-award-muted/20" size="sm" variant="plain" onClick={()=>{setPhase('loading');setAttempt(n=>n+1);}}>重试三维</Button><Button className="!text-award-ink hover:!bg-award-muted/15 active:!bg-award-muted/20" size="sm" variant="plain" onClick={()=>setStaticOnly(true)}>只看图片</Button></div>}
  {!ceremony&&<div className="mt-2 flex flex-wrap items-center justify-center gap-2">
   <Button variant="plain" size="sm" className="!text-award-ink hover:!bg-award-muted/15 active:!bg-award-muted/20" disabled={phase!=='ready'} onClick={()=>send('view','front')}>正面</Button>
   <Button variant="plain" size="sm" className="!text-award-ink hover:!bg-award-muted/15 active:!bg-award-muted/20" disabled={phase!=='ready'} onClick={()=>send('view','back')}>背面</Button>
   <label className="inline-flex min-h-[44px] items-center gap-2 text-footnote"><input type="checkbox" checked={reduced} disabled={systemReduced} onChange={event=>setManualReduced(event.target.checked)} className="h-5 w-5 accent-accent"/>{systemReduced?'已减少动态':'减少动态'}</label>
  </div>}
 </div>;
}
