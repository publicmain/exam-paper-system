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
export function MedalViewer({assetId,locked=false,reveal=false,ceremony=false,hold=false,onReady,onRevealComplete,onError,onTrace,title,height}:{assetId:string;locked?:boolean;reveal?:boolean;ceremony?:boolean;hold?:boolean;onReady?:()=>void;onRevealComplete?:()=>void;onError?:()=>void;onTrace?:(step:string)=>void;title?:string;height?:number}) {
 const frame=useRef<HTMLIFrameElement>(null);
 const [systemReduced,setSystemReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
 const [manualReduced,setManualReduced]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const [phase,setPhase]=useState<'loading'|'ready'|'error'>('loading');
 const [staticOnly,setStaticOnly]=useState(false);
 const reduced=systemReduced||manualReduced;
 const reducedRef=useRef(reduced); reducedRef.current=reduced;
 const callbacks=useRef({onReady,onRevealComplete,onError,onTrace});callbacks.current={onReady,onRevealComplete,onError,onTrace};
 const trace=(step:string)=>callbacks.current.onTrace?.(step);
 const completed=useRef(false);
 // 转完之后把这块交还给手指：学生可以自己拖着转（2026-09-18）。
 const [spun,setSpun]=useState(false);
 // 开场白还没念完就不要开转（2026-09-21）：颁奖先铺一句话盖住模型下载，
 // 念完了这里才放行。pending 记着「该用多少延迟开转」。
 const holdRef=useRef(hold);holdRef.current=hold;
 const startTimer=useRef<number|undefined>(undefined);
 const pending=useRef<number|null>(null);
 const spinAfter=(delay:number)=>{
  window.clearTimeout(startTimer.current);
  if(holdRef.current){pending.current=delay;return;}
  pending.current=null;
  startTimer.current=window.setTimeout(()=>{callbacks.current.onTrace?.('发开转');send('start');},delay);
 };
 useEffect(()=>{if(!hold&&pending.current!=null)spinAfter(pending.current);},[hold]);
 const initialReduced=useRef(reduced);
 const playing=reveal&&!locked;
 const src='/medals/v5/viewer.html?'+new URLSearchParams({id:assetId,locked:locked?'1':'0',reveal:playing?'1':'0',reduced:initialReduced.current?'1':'0',...(ceremony?{ceremony:'1'}:{})});
 const send=(action:string,value:unknown=true)=>frame.current?.contentWindow?.postMessage({type:'equistar-medal-control',action,value},window.location.origin);
 const complete=()=>{if(playing&&!completed.current){completed.current=true;setSpun(true);callbacks.current.onRevealComplete?.();}};
 useEffect(()=>{
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const change=()=>setSystemReduced(media?.matches??false);
  media?.addEventListener?.('change',change);return()=>media?.removeEventListener?.('change',change);
 },[]);
 useEffect(()=>{send('reduce',reduced);},[reduced]);
 useEffect(()=>{
  completed.current=false;setSpun(false);setPhase('loading');
  let ready=false,failed=false;
  const fail=()=>{if(failed)return;failed=true;window.clearTimeout(startTimer.current);pending.current=null;setPhase('error');trace('超时/失败');callbacks.current.onError?.();};
  // 等待上限：6 秒对真实网络太紧 —— 真机诊断量到模型下载 4.9 秒，稍慢就「超时/失败」
  // 降级成一张静态图（2026-09-21 用户截图）。开场白已经把这段时间填上了，宁可多等
  // 也不要给学生一张不会转的图。
  const timeout=window.setTimeout(fail,ceremony?12000:15000);
  const receive=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||event.data?.type!=='equistar-medal-viewer')return;
   // 徽章一加载好就先露面（ready），模型预热在那之后做（warm）：预热在手机上可能要
   // 几秒，压在 ready 前面会让学生只看到「正在呈现三维细节」然后直接跳到最终画面
   // （2026-09-18 真机）。转起来等 warm；等不到就 2.5 秒后照常开转。
   trace(String(event.data.status));
   if(event.data.status==='ready'&&!ready&&!failed){
    ready=true;window.clearTimeout(timeout);setPhase('ready');send('reduce',reducedRef.current);callbacks.current.onReady?.();
    if(ceremony&&playing)spinAfter(reducedRef.current?0:2500);
   }
   else if(event.data.status==='warm'&&ready&&!failed){if(ceremony&&playing)spinAfter(reducedRef.current?0:300);}
   else if(event.data.status==='error'){window.clearTimeout(timeout);fail();}
   else if(event.data.status==='complete'&&(!ceremony||ready)&&!failed)complete();
   else if(event.data.status==='escape')frame.current?.closest('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  };
  window.addEventListener('message',receive);
  return()=>{window.clearTimeout(timeout);window.clearTimeout(startTimer.current);pending.current=null;window.removeEventListener('message',receive);};
 },[src,attempt]);
 useEffect(()=>{
  if(!playing||!(phase==='error'||staticOnly))return;
  const timer=window.setTimeout(complete,1200);return()=>window.clearTimeout(timer);
 },[phase,staticOnly,playing,assetId]);
 return <div data-testid="medal-viewer" data-spun={ceremony?String(spun):undefined} className={ceremony?'award-medal-viewer':'rounded-group bg-award-surface pb-1 text-award-ink'}>
  <div className={ceremony?'award-medal-stage':'relative min-h-48 w-full overflow-hidden rounded-group'} style={ceremony?undefined:{height:height??'min(46dvh, 480px)',background:'rgb(var(--c-award-surface))'}} data-testid="medal-stage">
   {/* 颁奖时加载中不铺静态大图：它和模型的尺寸对不上，换过去就是一次突变（2026-09-18）。
       只有降级（模型失败 / 只看图片）才显示图片。 */}
   {(ceremony?(phase==='error'||staticOnly):(phase!=='ready'||staticOnly))&&<MedalImage assetId={assetId} locked={locked} className={'mx-auto h-full w-full object-contain'+(ceremony&&playing?' award-medal-flip':'')}/>}
   {/* Match the embedded root: a dark/light mismatch forces an opaque UA canvas. */}
   {!staticOnly&&phase!=='error'&&<iframe key={src+':'+attempt} ref={frame} src={src} style={ceremony?{colorScheme:'light',background:'transparent'}:undefined} tabIndex={ceremony?-1:undefined} aria-hidden={(ceremony&&!spun)||undefined} title={(title??medalName(assetId))+' · '+(locked?'未解锁灰色三维':playing&&!spun?'颁奖动画':'三维藏品，可以拖动转一转')} className={'absolute inset-0 h-full w-full border-0 '+(ceremony&&!spun?'pointer-events-none ':'')+(phase==='ready'?'':'invisible')} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={()=>send('reduce',reducedRef.current)} data-testid="medal-3d-frame"/>}
   {phase==='loading'&&<span className={ceremony?'award-loading':'absolute inset-x-2 bottom-2 text-center text-xs text-award-muted'} role="status">正在呈现三维细节</span>}
  </div>
  {phase==='error'&&!staticOnly&&!ceremony&&<div className="mt-2 px-3 text-footnote" role="status">已改为静态展示，收藏不会受影响。<Button className="!text-award-ink hover:!bg-award-muted/15 active:!bg-award-muted/20" size="sm" variant="plain" onClick={()=>{setPhase('loading');setAttempt(n=>n+1);}}>重试三维</Button><Button className="!text-award-ink hover:!bg-award-muted/15 active:!bg-award-muted/20" size="sm" variant="plain" onClick={()=>setStaticOnly(true)}>只看图片</Button></div>}
  {!ceremony&&<div className="mt-2 flex flex-wrap items-center justify-center gap-2">
   <Button variant="plain" size="sm" className="!text-award-ink hover:!bg-award-muted/15 active:!bg-award-muted/20" disabled={phase!=='ready'} onClick={()=>send('view','front')}>正面</Button>
   <Button variant="plain" size="sm" className="!text-award-ink hover:!bg-award-muted/15 active:!bg-award-muted/20" disabled={phase!=='ready'} onClick={()=>send('view','back')}>背面</Button>
   <label className="inline-flex min-h-[44px] items-center gap-2 text-footnote"><input type="checkbox" checked={reduced} disabled={systemReduced} onChange={event=>setManualReduced(event.target.checked)} className="h-5 w-5 accent-accent"/>{systemReduced?'已减少动态':'减少动态'}</label>
  </div>}
 </div>;
}
