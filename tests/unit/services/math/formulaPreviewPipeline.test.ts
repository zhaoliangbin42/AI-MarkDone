import {describe,it,expect,vi} from 'vitest';
import {FormulaPreviewPipeline} from '@/services/math/formulaPreviewPipeline';
const asset=(source:string)=>({source,displayMode:false,fontSizePx:36,width:30,height:20,viewBox:'0 0 30 20',svg:'<svg xmlns="http://www.w3.org/2000/svg"/>'});
it('keeps one active render plus only the latest pending request',async()=>{
    const pending:Array<(value:ReturnType<typeof asset>)=>void>=[];const render=vi.fn(()=>new Promise<ReturnType<typeof asset>>(resolve=>pending.push(resolve)));const pipeline=new FormulaPreviewPipeline(render);
    const first=pipeline.request({source:'x',displayMode:false}).catch(()=>null);const second=pipeline.request({source:'y',displayMode:false}).catch(()=>null);const third=pipeline.request({source:'z',displayMode:false});expect(render).toHaveBeenCalledTimes(1);pending[0](asset('x'));await first;await second;await vi.waitFor(()=>expect(render).toHaveBeenCalledTimes(2));pending[1](asset('z'));expect((await third).source).toBe('z');
});
it('reuses identical assets and bounds the cache by entry count',async()=>{const render=vi.fn(async(options:any)=>asset(options.source));const pipeline=new FormulaPreviewPipeline(render,{maxEntries:2,maxBytes:1024});await pipeline.request({source:'x',displayMode:false});await pipeline.request({source:'x',displayMode:false});expect(render).toHaveBeenCalledOnce();for(const source of ['y','z'])await pipeline.request({source,displayMode:false});expect(pipeline.getStats().cacheEntries).toBe(2);pipeline.clear();expect(pipeline.getStats().cacheEntries).toBe(0);});
