/*       
 *      _      _____ _  ___  _____                          _            
 *     | |    / ____| |/ (_)/ ____|                        | |           
 *     | |   | |    | ' / _| |     ___  _ ____   _____ _ __| |_ ___ _ __ 
 *     | |   | |    |  < | | |    / _ \| '_ \ \ / / _ \ '__| __/ _ \ '__|
 *     | |___| |____| . \| | |___| (_) | | | \ V /  __/ |  | ||  __/ |   
 *     |______\_____|_|\_\_|\_____\___/|_| |_|\_/ \___|_|   \__\___|_|   
 *                                                                 
 *
 * LCKiConverter - a browser extension to convert LCEDA (aka EasyEDA) component to KiCad
 * 
 * Copyright (c) 2021 XToolBox  - admin@xtoolbox.org
 *                         http://lckicad.xtoolbox.org
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import axios from "axios";
import { CompRow_t, getStdComponent } from "./inst";
import { JLCDevice_t } from "./jlc/component";

function log(...data:any[]){
    console.log("[LCKi] ", ...data);
}

const devicePrefix = "https://pro.lceda.cn/api/devices/"
const compPrefix = "https://pro.lceda.cn/api/components/"
const model3DPrefix = "https://modules.lceda.cn/3dmodel/";

function getCellId(div:HTMLDivElement):string|null
{
    let idx = Number(div.getAttribute('data-cell-index'));
    while(idx>0 && div){
        div = div.previousSibling as HTMLDivElement;
        idx--;
    }
    if(div){
        return div.getAttribute('data-id');
    }
    return null;
}

function monitorTable(id:string, onComponent:(uuid:string|null, isDevice?:boolean)=>void):boolean
{
    // table -> grid -> [header, scroll -> body->[data...] ]
    let div = document.getElementById(id) as HTMLDivElement;
    //log(id, div);
    if(!div)return false;
    let body = div.children[0]?.children[1]?.children[0] as HTMLDivElement;
    log(id, body);
    if(!body)return false;
    for(let i =0; i<body.children.length;i++){
        let r = body.children[i] as HTMLDivElement;
        //log("ele:", r);
        r.onclick = (ev)=>{
            if(ev.ctrlKey){
                //log(getCellId(r), r);
                onComponent(getCellId(r));
            }
        }
    }
    if(id == "deviceTable"){
        let ob = new MutationObserver((mutations, observer)=>{
            //log(id, mutations);
            mutations.forEach(e=>{
                e.addedNodes.forEach(n=>{
                    let r = n as HTMLDivElement;
                    //log(r);
                    if(r.className == "q-grid-scroll"){
                        let bd = r.children[0] as HTMLDivElement;
                        for(let i =0; i<bd.children.length;i++){
                            let r = bd.children[i] as HTMLDivElement;
                            r.onclick = (ev)=>{
                                if(ev.ctrlKey){
                                    //log(getCellId(r), r);
                                    onComponent(getCellId(r), true);
                                }
                            }
                        }
                    }
                })
            })
        })
        let config = { attributes: false, childList: true, characterData: false, subtree:true }
        ob.observe(div, config);
        return true;
    }
    let ob = new MutationObserver((mutations, observer)=>{
        //log(mutations);
        mutations.forEach(e=>{
            e.addedNodes.forEach(n=>{
                let r = n as HTMLDivElement;
                r.onclick = (ev)=>{
                    if(ev.ctrlKey){
                        //log(getCellId(r), r);
                        onComponent(getCellId(r));
                    }
                }
            })
        })
    })
    let config = { attributes: false, childList: true, characterData: false }
    ob.observe(body, config);
    return true;
}

// deviceTable, symbolTable, footprintTable, model3DTable
export function initPro(onComponent:(uuid:string|null, isDevice?:boolean)=>void){

    ["deviceTable", "symbolTable", "footprintTable", "model3DTable"]
    .forEach(id=>{
        let res = monitorTable(id, onComponent);
        if(!res){
            setTimeout(()=>{
                res = monitorTable(id, onComponent);
                if(!res){
                    setTimeout(()=>{
                        res = monitorTable(id, onComponent);
                        if(!res){
                            setTimeout(()=>{
                                res = monitorTable(id, onComponent);
                
                                
                            }, 1000);
                        }
                    }, 1000);
                }
            }, 1000);
        }
    })
}

function RegMessageFromHook()
{
    window.addEventListener("message", (ev)=>{
        if(ev.data.topic === "kicadhelper"){
            console.log("Hook: got message", ev.data.message);
        }
    });
}

interface ProCompRes
{
    result:{
        std_uuid?:string
    }
    success?:boolean
    code:number
}

interface ProDevice
{
    result:JLCDevice_t
    success?:boolean
    code:number
}

function pro2std(uuid:string):Promise<string>
{
    return new Promise<string>((resolve, reject)=>{
        axios.get<ProCompRes>(compPrefix + uuid)
        .then((res)=>{
            if(res.data.success && res.data.result.std_uuid){
                resolve(res.data.result.std_uuid);
            }
            reject("no std_uuid found");
        })
        .catch(e=>reject(e))
    });
}

function device2Symbol(uuid:string):Promise<JLCDevice_t>
{
    return new Promise<JLCDevice_t>((resolve, reject)=>{
        axios.get<ProDevice>(devicePrefix + uuid)
        .then((res)=>{
            if(res.data.success && res.data.result){
                resolve(res.data.result);
            }else{
                reject("no pro device with uuid found");
            }
        })
        .catch(e=>reject(e))
    });
}

export function getProComponent(uuid:string, compRow:CompRow_t|CompRow_t[], isDevice:boolean):Promise<boolean>
{
    return new Promise<boolean>((resolve, reject)=>{
        if(isDevice){
            device2Symbol(uuid)
            .then(device=>getStdComponent(device.symbol?.uuid || "", compRow, device))
            .then(r=>resolve(r))
            .catch((e)=>reject(e))
        }else{
            getStdComponent(uuid, compRow, {attributes:{}, symbol:{uuid:"0"}})
            .then(r=>resolve(r))
            .catch((e)=>reject(e))
        }
    })
}

