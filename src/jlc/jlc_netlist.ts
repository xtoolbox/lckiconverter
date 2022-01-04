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

import { clear_comp_map, CompRow_t } from "@/inst";
import { getProComponent } from "@/jlcpro";
import { JLCComp_t } from "./component";
import { kifp_to_string, kifp_element, fp_timestamp} from "./std_footprint";

// parse netlist of pro.lceda.cn

interface NetComp
{
    pins:{[key:string]:string}
    props:{
        Device:string
        Footprint:string
        ["3D Model"]:string
        Symbol:string
        Designator:string
        ["Manufacturer Part"]:string
        Datasheet:string
    }
}

export type NetListMap = {[key:string]:NetComp};

export function open_net_list():Promise<NetListMap>
{
    return new Promise<NetListMap>((resolve, rejcet)=>{
        let inputObj=document.createElement('input')
        inputObj.setAttribute('id','template_open_file');
        inputObj.setAttribute('type','file');
        inputObj.setAttribute('accept', '.enet')
        inputObj.setAttribute("style",'visibility:hidden');
        document.body.appendChild(inputObj);
        inputObj.click();
        inputObj.onchange = ()=>{
            if(inputObj.files){
                let file = inputObj.files[0];
                file.text().then(t=>{
                    resolve(JSON.parse(t));
                })
                .catch(e=>rejcet(e));
            }else{
                rejcet("No file select");
            }
        }
        document.body.removeChild(inputObj);
    });
}

export function parse_net_list(netList:NetListMap, compRow:CompRow_t[])
{
    return new Promise<boolean>((resolve, reject)=>{
        let compMap = clear_comp_map();
        let devRes:Promise<boolean>[] = [];
        let devMap = new Map<string, boolean>();
        for(let k in netList){
            let {props} = netList[k];
            if(!devMap.has(props.Device)){
                devMap.set(props.Device, true);
                devRes.push( getProComponent(props.Device, compRow, true));
            }
        }
        Promise.all(devRes)
        .then(e=>{
            let compRes:Promise<boolean>[] = [];
            for(let k in netList){
                let {props} = netList[k];
                if(!compMap.has(props.Symbol))compRes.push( getProComponent(props.Symbol, compRow, false));
                if(!compMap.has(props.Footprint))compRes.push( getProComponent(props.Footprint, compRow, false));
                if(!compMap.has(props["3D Model"]))compRes.push( getProComponent(props["3D Model"], compRow, false));
            }
            Promise.all(compRes)
            .then(r=>resolve(true))
            .catch(e=>reject(e));
        })
        .catch(e=>reject(e));
    });
}

function get_name(compMap:Map<string, JLCComp_t>, uuid:string)
{
    let t = compMap.get(uuid);
    if(t && t.parsedData){
        return t.parsedData.name;
    }
    return "fp_uuid"
}

function get_fields(compMap:Map<string, JLCComp_t>, uuid:string):kifp_element[]
{
    let res:kifp_element[] = [];
    let t = compMap.get(uuid);
    if(t && t.parsedData && t.parsedData.fields.length>0){
        let pd = t.parsedData;
        let fields:kifp_element[] = ['fields', true];
        t.parsedData.fields.forEach((e,i)=>{
            fields.push(['field', ['name', `"${e.key}"`], `"${e.value}"`])
            res.push(['property', ['name', `"${e.key}"`], ['value', `"${e.value}"`]]);
            if(i != (pd.fields.length-1)){
                fields.push(true);
                res.push(true);
            }
        })
        res.unshift(fields, true);
    }
    return res;
}

interface NetInfo
{
    name:string
    orgName:string
    code:number
    pins:{ref:string, pin:string}[]
}
function collect_net(ref:string, pins:{[key:string]:string}, netMap:Map<string,number>, netInfoList:NetInfo[])
{
    for(let pin in pins){
        let netName = pins[pin];
        let netInfo:NetInfo = {
            orgName:netName,
            name:netName,
            code:netInfoList.length,
            pins:[],
        }
        if(netName.startsWith("$")){
            netInfo.name = `Net-(${ref}-Pad${pin})`
        }
        if(!netMap.has(netName)){
            netMap.set(netName, netInfo.code);
            netInfoList.push(netInfo);
        }else{
            let id = netMap.get(netName) || 0
            netInfo = netInfoList[id];
        }
        netInfo.pins.push({ref:ref, pin:pin});
    }
}

function convert_net_list(netList:NetListMap, prefix:string, compMap:Map<string, JLCComp_t>):kifp_element
{
    let res : kifp_element = [
        'export', ['version', '"E"'], true,
        ['design', true,
            ['source', `${prefix}.sch`],true,
            ['date', ],true,
            ['tool', 'pro.lceda.cn'],true,
            ['sheet',['number','"1"'], ['name','"/"'], ['tstamps', '"/"'], true,
                ['title_block', true,
                    ['title', `${prefix}`], true,
                    ['company'], true,
                    ['rev'], true,
                    ['date'], true,
                    ['source', `"${prefix}.sch"`], true,
                    ['comment', ['number', '"1"'], ['value', '""']],
                ]
            ]
        ],true,
    ];
    let comps:kifp_element = ['components', true];
    let netMap = new Map<string, number>();
    let netInfoList:NetInfo[] = [];
    for(let k in netList){
        let {pins, props} = netList[k];
        comps.push([
            'comp', ['ref', `"${props.Designator}"`], true,
            ['value', `"${props['Manufacturer Part']}"`], true,
            ['footprint', `"${prefix}:${get_name(compMap, props.Footprint)}"`], true,
            ['datasheet', `"${props.Datasheet}"`], true,
            ['libsource', ['lib', `"${prefix}"`], ['part', `"${get_name(compMap, props.Symbol)}"`], ['description', '""']], true,
            ...get_fields(compMap, props.Symbol),
            ['property', ['name', '"Sheetname"'], ['value', `"${prefix}"`]], true,
            ['property', ['name', '"Sheetfile"'], ['value', `"${prefix}.sch"`]], true,
            ['sheetpath', ['names', '"/"'], ['tstamps', `"/00000000-0000-0000-0000-0000${fp_timestamp()}"`]], true,
            ['tstamps', `"/00000000-0000-0000-0000-0000${fp_timestamp()}"`],
        ], true)
        collect_net(props.Designator, pins, netMap, netInfoList);
    }
    res.push(comps);
    res.push(['libraries', true,
        ['library', ['logical', `"${prefix}"`], true,
            ['uri', `\${KIPRJMOD}/${prefix}.lib`]
        ]
    ], true)
    let nets:kifp_element[] = ['nets', true];
    netInfoList.forEach((e, i)=>{
        let tNet:kifp_element[] = ['net', ['code', `"${i+1}"`], ['name', `"${e.name}"`], true]
        e.pins.map((p, i)=>{
            tNet.push(['node', ['ref', `"${p.ref}"`], ['pin', `"${p.pin}"`], ['pinfunction', `"${p.pin}"`], ['pintype', '"passive"']]);
            if(i != e.pins.length-1){
                tNet.push(true);
            }
        })
        nets.push(tNet, true)
    })
    res.push(nets);
    return res;
}

export function gen_net_list(netList:NetListMap, prefix:string, compMap:Map<string, JLCComp_t>):string
{
    let res = convert_net_list(netList, prefix, compMap);
    return kifp_to_string(res);
}