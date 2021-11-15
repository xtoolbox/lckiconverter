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

import axios from 'axios'
import {ElNotification} from 'element-plus'
import { JLCComp_t, JLCDocType, JLCDevice_t} from "@/jlc/component";
import { getPrefix } from './convert';

let g_toggleV:(()=>void)|undefined = undefined;
function log(...data:any[]){
    console.log("[LCKi]", ...data);
}

function showMsg(msg:string)
{
    ElNotification({
        type:"info",
        title:msg,
        message:"",
        duration:2000,
        position: 'top-left'
    })
}

export function toggleVisible(toggleV:(()=>void)|undefined)
{
    if(toggleV){
        g_toggleV = toggleV;
    }else if(g_toggleV){
        g_toggleV();
    }
}


export interface DialogGeo_t
{
    x:number
    y:number
    width:number
    height:number
    visible:boolean
    prefix:string
    tryStep:boolean
}

export const defSetting : DialogGeo_t = {
    x:400, y:0, width:400, height:400, visible:false, prefix:"kicad_lceda", tryStep:false
};

export function loadDlgSetting(): Promise<DialogGeo_t>
{
    return new Promise<DialogGeo_t>((resolve, reject)=>{
        if(chrome && chrome.storage){
            chrome.storage.sync.get(defSetting, (res)=>{
                resolve(res as DialogGeo_t);
            });
        }else{
            let res = localStorage.getItem("KicadHelperSetting") || JSON.stringify(defSetting);
            resolve(JSON.parse(res) as DialogGeo_t);
        }
    });
}

export function saveDlgSetting(set:DialogGeo_t)
{
    if(chrome && chrome.storage){
        chrome.storage.sync.set(set);
    }else{
        localStorage.setItem("KicadHelperSetting", JSON.stringify(set));
    }
}

// monitor component list and add a onclick handler
export function initStd(onComponent:(uuid:string|null)=>void){
    let div = document.getElementById('dlgLibs-liblist') as HTMLDivElement;
    if(div){
        let tb = div.children[1] as HTMLTableElement;
        let body = tb.children[1];
        for(let i =0; i<body.children.length;i++){
            let r = body.children[i] as HTMLTableRowElement;
            //console.log(r);
            r.onclick = (ev)=>{
                if(ev.ctrlKey){
                    onComponent(r.getAttribute('data-uuid'));
                }
            }
        }
        let ob = new MutationObserver((mutations, observer)=>{
            mutations.forEach(e=>{
                e.addedNodes.forEach(n=>{
                    let r = n as HTMLTableRowElement;
                    r.onclick = (ev)=>{
                        if(ev.ctrlKey){
                            onComponent(r.getAttribute('data-uuid'));
                        }
                    }
                })
            })
        })
        var config = { attributes: false, childList: true, characterData: false }
        ob.observe(body, config);
        log("got component table");
    }else{
        log("component table not found");
    }
}

export interface Info_t
{
  symbol?:string
  footprint?:string
  model3d?:string
  title?:Info_t
  id?:Info_t
}

let stdCompPrefix = "https://lceda.cn/api/components/";
let proCompPrefix = "https://pro.lceda.cn/api/components/";
let std3DPrefix = "https://lceda.cn/analyzer/api/3dmodel/";
let pro3DPrefix = "https://modules.lceda.cn/3dmodel/";

let g_check_host:boolean = false;
function check_host(){
    if(!g_check_host){
        g_check_host = true;
        if(document.URL.includes("easyeda.com")){
            stdCompPrefix = stdCompPrefix.replace("lceda.cn", "easyeda.com");
            std3DPrefix = std3DPrefix.replace("lceda.cn", "easyeda.com");
        }
    }
}

let g_compMap = new Map<string, any>();

interface CompRes
{
    result:JLCComp_t
    success:boolean
    code:number
}

export interface CompRow_t
{
    symbol?:JLCComp_t
    footprint?:JLCComp_t
    model3d?:JLCComp_t
    data3d?:string
}

function getStdComp(uuid:string, device?:JLCDevice_t):Promise<JLCComp_t>
{
    return new Promise<JLCComp_t>((resolve, reject)=>{
        let comp = g_compMap.get(uuid);
        if(comp){
            resolve(comp);
            return;
        }
        axios.get<CompRes>((device?proCompPrefix:stdCompPrefix) + uuid)
        .then(({data})=>{
            if(data.success){
                g_compMap.set(uuid, data.result);
                resolve(data.result);
            }else{
                reject(data.code);
            }
        },(e)=>{
            reject(e);
        })
    });
}

export function get_footprint_name(uuid:string):string
{
    let t = g_compMap.get(uuid) as JLCComp_t;
    if(!t){
        return "";
    }
    return getPrefix()+":" + (t.display_title || t.title);
}

export function getStdComponent(uuid:string, compRow:CompRow_t|CompRow_t[], device?:JLCDevice_t):Promise<boolean>
{
    //console.log("getStdComponent", uuid, device?"pro":"std");
    check_host();
    return new Promise<boolean>((resolve, reject)=>{
        if(compRow instanceof Array){
            let t = g_compMap.get(uuid) as JLCComp_t;
            if(t){
                showMsg(t.title + " Already exist");
            }
        }
        getStdComp(uuid, device).
        then((comp)=>{
            if(comp.docType == JLCDocType.Model3D){
                if(compRow instanceof Array){
                    compRow.push({});
                    compRow = compRow[compRow.length-1];
                }
                compRow.model3d = comp;
                compRow.model3d.device = device;
                let rowShadow = compRow;
                if(comp.dataStr instanceof Object && comp.dataStr.head?.uuid){
                    let dataStr = comp.dataStr;
                    axios.get<string>(std3DPrefix + dataStr.head?.uuid)
                    .then(({data})=>{
                        rowShadow.data3d = data;
                    })
                }else if(device && comp['3d_model_uuid']){
                    let uuid_3d = comp['3d_model_uuid'];
                    axios.get<string>(pro3DPrefix + uuid_3d)
                    .then(({data})=>{
                        rowShadow.data3d = data;
                    })
                }
            }else if(comp.docType == JLCDocType.Footprint){
                if(compRow instanceof Array){
                    compRow.push({});
                    compRow = compRow[compRow.length-1];
                }
                compRow.footprint = comp;
                compRow.footprint.device = device;
                let shadowRow = compRow;
                if(comp.dataStr instanceof Object && comp.dataStr.head?.uuid_3d){
                    getStdComponent(comp.dataStr.head?.uuid_3d, compRow, device);
                }else if(comp.device?.attributes['3D Model'] || comp.model_3d?.uri){
                    let uuid_3d = comp.device?.attributes['3D Model'] || comp.model_3d?.uri;
                    getStdComponent(uuid_3d, compRow, device).catch(e=>{
                        // maybe direct 3D content
                        axios.get<string>(pro3DPrefix + uuid_3d)
                        .then(({data})=>{
                            shadowRow.model3d = {docType:JLCDocType.Model3D, 
                                uuid:uuid_3d, 
                                title:comp.device?.attributes['3D Model Title'] || comp.model_3d?.title || "Unknown", 
                            dataStr:""};
                            shadowRow.data3d = data;
                        })
                    });
                }
            }else if(comp.docType == JLCDocType.Symbol){
                if(compRow instanceof Array){
                    compRow.push({});
                    compRow = compRow[compRow.length-1];
                }
                compRow.symbol = comp;
                compRow.symbol.device = device;
                if(comp.dataStr instanceof Object && comp.dataStr.head?.puuid){
                    getStdComponent(comp.dataStr.head?.puuid, compRow, device);
                }else if(compRow.symbol.device && compRow.symbol.device.footprint?.uuid){
                    getStdComponent(compRow.symbol.device.footprint?.uuid, compRow, device);
                }
            }
            if(!compRow){
                log("unsupport comp type", comp.docType, comp.title);
            }
            resolve(true);
        })
        .catch((e)=>{
            reject(e);
        })
    });
}
