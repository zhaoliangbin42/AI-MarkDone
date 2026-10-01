import type { FormulaRenderOptions, FormulaSvgAsset } from './formulaAssetRenderer';
type Request = { options: FormulaRenderOptions; resolve: (asset: FormulaSvgAsset) => void; reject: (error: Error) => void; controller: AbortController; release: () => void };
function cancelled(): Error { return new DOMException('Formula render cancelled.', 'AbortError'); }
/** Bounded, latest-only work for one composer. No source is persisted or logged. */
export class FormulaPreviewPipeline {
    private active: Request | null = null;
    private pending: Request | null = null;
    private readonly cache = new Map<string, {asset: FormulaSvgAsset; bytes: number}>();
    private bytes = 0;
    private renders = 0;
    private hits = 0;
    constructor(private readonly render: (options: FormulaRenderOptions) => Promise<FormulaSvgAsset>, private readonly limits = {maxEntries:16,maxBytes:2*1024*1024}) {}
    private key(options: FormulaRenderOptions): string { return JSON.stringify([options.source.trim(), options.displayMode, options.fontSizePx ?? 36, options.foregroundColor ?? '#000000']); }
    getStats() { return {renderCount:this.renders,cacheHits:this.hits,cacheEntries:this.cache.size,cacheBytes:this.bytes,active:Number(Boolean(this.active)),pending:Number(Boolean(this.pending))}; }
    request(options: FormulaRenderOptions): Promise<FormulaSvgAsset> {
        if(options.signal?.aborted)return Promise.reject(cancelled());
        const key=this.key(options);const hit=this.cache.get(key);
        if(hit){this.cancel();this.cache.delete(key);this.cache.set(key,hit);this.hits++;return Promise.resolve(hit.asset);}
        return new Promise((resolve,reject)=>{
            const controller=new AbortController();const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
            const request:Request={options,resolve,reject,controller,release:()=>options.signal?.removeEventListener('abort',abort)};
            if(this.active){this.active.controller.abort();if(this.pending){this.pending.release();this.pending.reject(cancelled());}this.pending=request;}
            else this.start(request);
        });
    }
    private start(request:Request): void {
        this.active=request;this.renders++;
        void this.render({...request.options,signal:request.controller.signal}).then(asset=>{
            if(request.controller.signal.aborted){request.reject(cancelled());return;}
            const key=this.key(request.options);const size=new TextEncoder().encode(key+asset.svg).length;
            if(size<=this.limits.maxBytes){const old=this.cache.get(key);if(old)this.bytes-=old.bytes;this.cache.delete(key);this.cache.set(key,{asset,bytes:size});this.bytes+=size;while(this.cache.size>this.limits.maxEntries||this.bytes>this.limits.maxBytes){const oldest=this.cache.keys().next().value as string;this.bytes-=this.cache.get(oldest)!.bytes;this.cache.delete(oldest);}}
            request.resolve(asset);
        },error=>request.reject(error)).finally(()=>{request.release();this.active=null;const next=this.pending;this.pending=null;if(next){if(next.controller.signal.aborted){next.release();next.reject(cancelled());}else this.start(next);}});
    }
    cancel():void {this.active?.controller.abort();if(this.pending){this.pending.release();this.pending.reject(cancelled());this.pending=null;}}
    clear():void {this.cancel();this.cache.clear();this.bytes=0;}
}
