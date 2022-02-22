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

import {CompRow_t} from "./inst";
import { JLCComp_t, JLCDocType} from "@/jlc/component";
import JSZip from 'jszip'
import saveAs from 'jszip/vendor/FileSaver.js'
import { convert_std_symbol } from "@/jlc/std_symbol";
import { convert_std_footprint } from "@/jlc/std_footprint";
import { convert_pro_symbol } from "./jlc/pro_symbol";
import { convert_pro_footprint } from "./jlc/pro_footprint";
import { objmtl2vrml } from './jlc/jlcobj2vrml';
import { gen_net_list, NetListMap } from "./jlc/jlc_netlist";
import { temp_kicad_pcb } from "./jlc/ki_template";


let g_prefix = "";
let g_modelPrefix = "";
export function getPrefix()
{
    return g_prefix;
}
export function getModelPrefix() {
    return g_modelPrefix;
}

function log(...args:any)
{
    console.log('[LCKi] Cvt:', ...args);
}

export function downloadData(namePrefix:string, modelPrefix:string, tryStep:boolean, items:CompRow_t[], setProgress:(percent:number)=>void, mode:string, netList?:NetListMap)
{
    let zip = new JSZip();
    let footprint = zip.folder(namePrefix+'.pretty');
    let shape3d = zip.folder(namePrefix+'.3dshapes');
    g_prefix = namePrefix;
    g_modelPrefix = modelPrefix;
    if(!footprint || !shape3d){
        return;
    }
    let fpFolder = footprint;
    let folder3d = shape3d;
    // collect lib
    let t = new Map<string, JLCComp_t>();
    let symbolLib = library_head;
    items.forEach((comp)=>{
        let cvtName = ""
        try{
            if(comp.symbol && (!t.has(comp.symbol.uuid))){
                cvtName = "symbol:" + comp.symbol.display_title || comp.symbol.title;
                let r = convertData(comp.symbol);
                t.set(comp.symbol.uuid,comp.symbol);
                symbolLib += r.content + "\n";
            }
        }catch(e){
            log("Fail to convert " + cvtName, e);
        }
        try{
            if(comp.footprint && (!t.has(comp.footprint.uuid))){
                cvtName = "footprint:" + comp.footprint.display_title || comp.footprint.title;
                let r = convertData(comp.footprint);
                t.set(comp.footprint.uuid,comp.footprint);
                fpFolder.file(r.filename, r.content);
            }
        }catch(e){
            log("Fail to convert " + cvtName, e);
        }
        try{
            if(comp.model3d && (!t.has(comp.model3d.uuid)) && comp.data3d){
                cvtName = "3D model:" + comp.model3d.display_title || comp.model3d.title;
                let r = convertData(comp.data3d, comp.model3d.display_title || comp.model3d.title, tryStep,
                    mode + ":" + (comp.model3d.uuid||""));
                t.set(comp.model3d.uuid,{docType:JLCDocType.Model3D, title:comp.model3d.display_title || comp.model3d.title,
                                        uuid:comp.model3d.uuid, dataStr:comp.data3d});
                folder3d.file(r.filename, r.content);
            }
        }catch(e){
            log("Fail to convert " + cvtName, e);
        }
    })
    symbolLib += library_end;
    zip.file(namePrefix+".lib", symbolLib);
    zip.file('sym-lib-table', `(sym_lib_table
  (lib (name ${namePrefix})(type Legacy)(uri \${KIPRJMOD}/${namePrefix}.lib)(options "")(descr ""))
)`)
    zip.file('fp-lib-table', `(fp_lib_table
  (lib (name ${namePrefix})(type KiCad)(uri \${KIPRJMOD}/${namePrefix}.pretty)(options "")(descr ""))
)`)
    if(netList){
        zip.file(namePrefix+".net", gen_net_list(netList, namePrefix, t));
        zip.file(namePrefix+".kicad_pcb", temp_kicad_pcb);
    }
    zip.generateAsync({type:"blob"}, (meta)=>{
        setProgress(meta.percent);
    }).then((blob)=>{
        saveAs(blob, namePrefix+".zip");
    })
}

interface KiCadData{
    filename:string
    content:string
}
export function convertData(data:JLCComp_t|string, name?:string, tryStep?:boolean, uuid3d?:string):KiCadData
{
    if(typeof data === "string"){
        let fullName = name||"unknown";
        if(tryStep){
            try{
                let stepData = objmtl2vrml(data, true, fullName, uuid3d);
                return {filename:fullName+".step", content:stepData}
            }catch(e){
                log(e);
                log("Fail to convert to step, try to convert wrl")
            }
        }
        return{
            filename: fullName +".wrl",
            content:objmtl2vrml(data, false, fullName, uuid3d),
        }
    }else{
        //console.log(data)
        if((data as any).result){
            data = (data as any).result as JLCComp_t;
        }
        let postfix = "";
        let res = "";
        if(typeof data.dataStr === 'string'){
            // pro component
            if(data.docType === JLCDocType.Footprint){
                postfix = ".kicad_mod";
                res = convert_pro_footprint(data);
            }else if(data.docType === JLCDocType.Symbol){
                res = convert_pro_symbol(data);
            }else{
                res = JSON.stringify(data, null, 2);
            }
        }else{
            if(data.docType === JLCDocType.Footprint){
                postfix = ".kicad_mod";
                res = convert_std_footprint(data);
            }else if(data.docType === JLCDocType.Symbol){
                res = convert_std_symbol(data);
            }else{
                res = JSON.stringify(data, null, 2);
            }
        }
        return {
            filename: (data.display_title || data.title) + postfix,
            content:res,
        };
    }
}

const library_head =
`EESchema-LIBRARY Version 2.4
#encoding utf-8
`
const library_end = `#
#End Library
`
