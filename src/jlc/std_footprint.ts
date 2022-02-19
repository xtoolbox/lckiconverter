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

import { getPrefix, getModelPrefix } from '@/convert';
import { BBox_t, JLCComp_t, JLCDocType } from "@/jlc/component";
import { svg_path, SvgPoint, svg_solve_arc } from './svg';

function kifp_log(...args:any[]){
    console.log("[LCKi] StdFP:", ...args)
}

export function fp_timestamp():string{
    return Number( Math.floor((new Date()).getTime()/1000)).toString(16).toUpperCase();
}

export type kifp_element = string|number|kifp_element[]|boolean;
export function kifp_to_string(ele:kifp_element, ident?:string):string
{
    if(ele instanceof Array){
        return '(' + ele.map( e=> kifp_to_string(e, ident === undefined?'':(ident + '  '))).join(' ') + ')';
    }else if(typeof ele === "boolean"){
        return "\n" + ident;
    }else{
        return String(ele);
    }
}

/** unused layer
    "B.Adhes",
    "F.Adhes",
    "Cmts.User",
    "Eco1.User",
    "Eco2.User",
    "Margin",
    "B.CrtYd",
    "F.CrtYd",
    */
const unkonwnLayer = "Eco2.User";
const j2k_layer_name = {
    "1":"F.Cu",
    "2":"B.Cu",
    "3":"F.SilkS",
    "4":"B.SilkS",
    "5":"F.Paste",
    "6":"B.Paste",
    "7":"F.Mask",
    "8":"B.Mask",
    "9":unkonwnLayer,//"JLC.RateLines",
    "10":"Edge.Cuts",
    "11":"*.Cu",
    "12":"Dwgs.User",
    "13":"F.Fab",
    "14":"B.Fab",
    "15":"M",
    "16":unkonwnLayer,//"JLC.Mechanical",
    "19":unkonwnLayer,//"JLC.3DModel",
    "21":"In1.Cu",
    "52":"In32.Cu",
    "99":unkonwnLayer,//"JLC.CompShape",
    "100":unkonwnLayer,//"JLC.LeadShape",
    "101":unkonwnLayer,//"JLC.CompMark",
    "Hole":"JLC.Hole"
}

export function fp_name(v:string):string
{
    return fp_string(v);
    //return v.replace(/[\%\s\r\n\$\"\?/:]/g, "_")
}

function isCourtYard(id:string):string|undefined
{
    if(id === "99"){
        return "F.CrtYd";
    }
    return undefined;
}

function getLayers(id:string):string[]
{
    switch(id){
        case '1':return ["F.Cu", "F.Paste", "F.Mask"];
        case '2':return ["B.Cu", "B.Paste", "B.Mask"];
        case '11':return ["*.Cu", "*.Mask"];
    }
    let n = Number(id);
    if(n>=21 && n <= 52){
        return ["In."+(n-20)+".Cu"];
    }
    return [ (j2k_layer_name as any)[id] || unkonwnLayer]
}
function getLayer(id:string):string{
    let n = Number(id);
    if(n>=21 && n <= 52){
        return "In."+(n-20)+".Cu";
    }
    return (j2k_layer_name as any)[id] || unkonwnLayer;
}

export function fp_string(v:string):string
{
    if(v === "")return '""';
    if(/[" \s\n\r\(\)]/.test(v)){
        let t = '"' + v.replace(/([\\\"])/g, (s, ...cap)=>{
            return "\\" + cap[0]
        }) + '"'
        t = t.replace(/\n/g, '\\n');
        return t;
    }
    return v;
}

interface CBox_t extends BBox_t
{
    hasCourtYard?:boolean
    isThru?:boolean
}

export function convert_std_footprint(comp:JLCComp_t):string
{
    if(typeof comp.dataStr === 'string') return "# Pro data " + comp.dataStr;
    let box:CBox_t = {x:comp.dataStr.head?.x||0,y:comp.dataStr.head?.y||0, width:100, height:100};
    let res:kifp_element[] = [
        "module",
        fp_name(comp.display_title||comp.title),
        ["layer", "F.Cu"], ["tedit",
        fp_timestamp()], true,
        kifp_text("reference", box, "REF**", "F.SilkS", SvgPoint(box.x+0, box.y-10)), true,
        kifp_text("value", box, "std:"+comp.uuid  , "F.Fab", SvgPoint(box.x+0, box.y-0)), true,
    ];

    comp.dataStr.shape?.forEach(s=>{
        res.push(...kifp_parse_shape(box, s, comp));
    })
    if(!box.hasCourtYard && comp.dataStr.BBox){
        let bbox = comp.dataStr.BBox;
        let pts:SvgPoint[] = [
            SvgPoint(bbox.x,bbox.y),
            SvgPoint(bbox.x+bbox.width,bbox.y),
            SvgPoint(bbox.x+bbox.width,bbox.y + bbox.height),
            SvgPoint(bbox.x,bbox.y+bbox.height),
            SvgPoint(bbox.x,bbox.y)
        ];
        res.push(...kifp_line(box, 'F.CrtYd', pts, true, 0.6));
        kifp_log("Warning: no shape layer found, use boundbox as shape");
    }
    res.push(true);
    return kifp_to_string(res);
}
const StdFootprintShape = {
    SOLIDREGION:parse_SOLIDREGION,
    PAD:parse_PAD,
    TEXT:parse_TEXT,
    RECT:parse_RECT,
    VIA:parse_VIA,
    HOLE:parse_HOLE,
    CIRCLE:parse_CIRCLE,
    ARC:parse_ARC,
    TRACK:parse_TRACK,
    SVGNODE:parse_SVGNODE,
};

function kifp_parse_shape(box:BBox_t, shape:string, comp:JLCComp_t):kifp_element[]
{
    let [seg, ...segs] = shape.split('^^');
    let [cmd, ...args] = seg.split('~');
    let t = (StdFootprintShape as any)[cmd];
    if(cmd === 'SVGNODE'){
        return StdFootprintShape.SVGNODE(box, args, segs, comp);
    }
    return t?t(box, args, segs): ["# <Unknown shape>: " + shape + "\n"];
}

function toMM(x10mil:number|string):number{
    return Math.floor(Number(x10mil)*254 + 0.5)/1000;
}

function kifp_size(w:string|number, h:string|number):kifp_element
{
    return [
        'size', toMM(w), toMM(h)
    ]
}

function kifp_coord(box:BBox_t, pt:SvgPoint, type:'center'|'start'|'end'|'at'|'xy', rotate:string|number=0):kifp_element[]{
    rotate = Number(rotate)
    let np = SvgPoint(pt.x - box.x, pt.y - box.y);
    if(type === "xy" && rotate){
        np = rotatePoint(np, rotate);
    }
    let res = [
        type, toMM(np.x), toMM(np.y)
    ]
    if(rotate && type === "at"){
        res.push(rotate)
    }
    return res;
}

function kifp_witdh(width?:number|string):kifp_element[]{
    return [
        'width', toMM(width || (0.12/0.254))
    ]
}

function kifp_line(box:BBox_t, layer:string, pts:SvgPoint[], split?:boolean, width?:number|string):kifp_element[]
{
    let res:kifp_element[] = [];
    if(split){
        for(let i=1;i<pts.length;i++){
            res.push([
                'fp_line',
                kifp_coord(box, pts[i-1], 'start'),
                kifp_coord(box, pts[i], 'end'),
                ['layer', layer],
                kifp_witdh(width),
            ], true);
        }
    }else{
        pts.pop();
        res.push(
            ['fp_poly',
                ['pts', ...pts.map((pt)=>kifp_coord(box, pt, 'xy'))],
                ['layer', layer],
                kifp_witdh(width),
            ], true
        )
    }
    return res;
}

function parse_SOLIDREGION(box:BBox_t, args:string[], segs:string[]):kifp_element[]
{
    let [layerId, net, path, type, id, locked] = args;
    let pts = svg_path(path);
    let cyd = isCourtYard(layerId);
    let layer = cyd || (j2k_layer_name as any)[layerId] || unkonwnLayer;
    if(cyd){
        (box as CBox_t).hasCourtYard = true;
    }
    if(type === "npth"){
        kifp_log("Warning: Edge.cuts in footprint is not editable in KiCad");
        layer = "Edge.Cuts";
        type = "cutout";
    }
    return kifp_line(box, layer, pts, layer === cyd || type === "cutout");
}

export function rotatePoint(pt:SvgPoint, angle:string|number, org:SvgPoint = SvgPoint(0,0)):SvgPoint
{
    let res = SvgPoint(pt.x-org.x,pt.y-org.y);
    angle = Number(angle)*Math.PI/180;
    let sin_phi = Math.sin(angle);
    let cos_phi = Math.cos(angle);
    res.x = cos_phi*pt.x + sin_phi*pt.y + org.x;
    res.y = -sin_phi*pt.x + cos_phi*pt.y + org.y;
    return res;
}

function parse_PAD(box:BBox_t, args:string[], segs:string[]):kifp_element[]
{
    let [shape, x, y, w, h, layerId, net, number,
        holeRadius, points, rotate, id,
        holeLength, holePoints, plated, locked, u1, u2] = args;
    let layers = getLayers(layerId);
    let padType = "smd";
    if(Number(holeRadius) > 0){
        padType = "thru_hole";
        (box as CBox_t).isThru = true;
    }
    if(plated == "N"){
        padType = "np_thru_hole"
    }
    let drill:kifp_element[] = ['drill'];
    let drillX = toMM(holeRadius)*2;
    let drillY = toMM(holeLength);
    if(Number(holeLength)){
        let t = (Number(w)<Number(h)) != (drillX < drillY);
        if(t)drill.push('oval', drillY, drillX);
        else drill.push('oval', drillX, drillY);
    }else{
        drill.push(drillX);
    }
    let polyParam:kifp_element[] = [];
    if(shape == "ELLIPSE"){
        shape = "circle"
    }else if(shape == "RECT"){
        shape = "rect";
    }else if(shape == "OVAL"){
        shape = "oval";
    }else if(shape == "POLYGON"){
        shape = "custom"
        w = "0.4";
        h = "0.4";
        let pts:SvgPoint[] = [];
        points.replace(/([-\d.]+)\s+([-\d.]+)/g,(s,...cap)=>{
            pts.push( SvgPoint(cap[0], cap[1]));
            return s;
        })
        let padBox:BBox_t = {x:Number(x), y:Number(y), width:0, height:0}
        polyParam = [true,
            ["zone_connect", 0],
            ["options", ["clearance","outline"], ["anchor", "circle"]],true,
            ["primitives", true,
                ["gr_poly", true,
                    ['pts', true,
                        ...pts.map((pt)=>kifp_coord(padBox, pt, 'xy', -Number(rotate)))
                    ],
                    kifp_witdh(),
                ],true,
            ]
        ]
    }else{
        kifp_log("Warning: Unknown pin shape " + shape);
    }
    let padData = [
        "pad",
        fp_string(number),
        padType,
        shape,
        kifp_coord(box, {x:Number(x),y:Number(y)},'at', rotate),
        kifp_size(w,h),
        drill,
        ["layers", ...layers],
        ... polyParam
    ]
    return [padData, true];
}

export function isASCII(str:string):boolean {
    return /^[\x00-\x7F]*$/.test(str);
}

const fontHeightRatio = 0.75;
function kifp_text(type:"reference"|"value"|"user", box:BBox_t, text:string,
        layer:string, pos:SvgPoint, rotate:string|number=0, fontSize:string|number=3.937/fontHeightRatio, penWidth:string|number=0.590,
        hide?:boolean, ):kifp_element
{
    let hideText = [];
    if(hide)hideText.push('hide');
    let justify = ['justify', 'left'];
    if(layer.startsWith('B.')){
        justify.push('mirror');
    }
    let textHeight = Number(fontSize)*fontHeightRatio;
    let text_pos = SvgPoint(pos.x, pos.y - Number(fontSize)/2);
    return ['fp_text',type, fp_string(text), kifp_coord(box, text_pos, 'at', rotate), ['layer', layer], ...hideText, true,
        ['effects', ['font', kifp_size(textHeight, textHeight), ['thickness', toMM(penWidth)]], justify]
    ];
}

function parse_TEXT(box:BBox_t, args:string[], segs:string[]):kifp_element[]
{
    let [type, x, y, penWidth, rotate, mirror, layerId, net, fontSize, text, path, display, id, locked] = args;
    let hide = display === "none"
    let layer = getLayer(layerId);

    if(isASCII(text)){
        return [kifp_text('user', box, text, layer, SvgPoint(x,y), rotate, fontSize, penWidth, hide), true];
    }else{
        kifp_log("Warning: Convert none ASCII to polygon");
        let res:kifp_element[] = [];
        path.trim().split('M').forEach(pp=>{
            if(pp){
                let pts = svg_path('M'+pp);
                if(pts.length>1){
                    res.push(...kifp_line(box, layer, pts, true, Number(penWidth)*0.8));
                }
            }
        })
        return res;
    }
}

function parse_RECT(box:BBox_t, args:string[], segs:string[]):kifp_element[]
{
    let [_x, _y, _w, _h, layerId, id, locked, penWidth, isFill] = args;
    let split = isFill === 'none';
    let layer = getLayer(layerId);
    let [x,y,w,h] = [_x,_y,_w,_h].map(e=>Number(e));
    let pts:SvgPoint[] = [
        SvgPoint(x,y),SvgPoint(x+w,y),SvgPoint(x+w,y+h),SvgPoint(x,y+h), SvgPoint(x,y)
    ];
    return kifp_line(box, layer, pts, split, split?penWidth:0);
}

function parse_VIA(box:BBox_t, args:string[], segs:string[]):kifp_element[]
{
    let [x, y, d, net, holeRadius, id, locked] = args;
    let padData = [
        "pad",
        fp_string(""),
        "thru_hole",
        "circle",
        kifp_coord(box, {x:Number(x),y:Number(y)},'at', 0),
        kifp_size(d,d),
        ['drill', toMM(holeRadius)*2],
        ["layers", ... getLayers('11')],
    ]
    return [padData, true];
}

function parse_HOLE(box:BBox_t, args:string[], segs:string[]):kifp_element[]
{
    let [x, y, r, id, locked] = args;
    let d = Number(r)*2;
    let padData = [
        "pad",
        fp_string(""),
        "np_thru_hole",
        "circle",
        kifp_coord(box, {x:Number(x),y:Number(y)},'at', 0),
        kifp_size(d,d),
        ['drill', toMM(d)],
        ["layers", ... getLayers('11')],
    ]
    return [padData, true];
}

function parse_CIRCLE(box:BBox_t, args:string[], segs:string[]):kifp_element[]
{
    let [x, y, r, penWidth, layerId, id, locked] = args;
    let pt = SvgPoint(x,y);
    let layer = getLayer(layerId);
    return [
        ['fp_circle',
            kifp_coord(box, pt, 'center'),
            kifp_coord(box, SvgPoint(pt.x+Number(r), pt.y), 'end'),
            ['layer', layer], kifp_witdh(penWidth)
        ],
        true,
    ];
}

function parse_ARC(box:BBox_t, args:string[], segs:string[]):kifp_element[]
{
    let [penWidth, layerId, net, path, dots, id, locked] = args;
    let arc = svg_solve_arc(path);
    let layer = getLayer(layerId);
    return [
        ['fp_arc',
            kifp_coord(box, SvgPoint(arc.cx, arc.cy), 'start'),
            kifp_coord(box, arc.endPt, 'end'),
            ['angle', -arc.deltaAngle],
            ['layer', layer], kifp_witdh(penWidth)
        ],
        true,
    ];
}

function parse_TRACK(box:BBox_t, args:string[], segs:string[]):kifp_element[]
{
    let [penWidth, layerId, net, points, id, locked] = args;
    let layer = getLayer(layerId);
    let pts:SvgPoint[] = [];
    points.replace(/([-\d.]+)\s+([-\d.]+)/g,(r, ...cap)=>{
        pts.push(SvgPoint(cap[0], cap[1]));
        return r;
    })
    return kifp_line(box, layer, pts, true, penWidth);
}

interface SVGNodeInfo
{
    attrs:{
        c_witdh:number
        c_height:number
        c_rotation:string
        z:number
        c_origin:string
        title:string
        transform:string
    }
}
export function ki3d_info(name:string, pos:number[], scale:number[], rotate:number[]):kifp_element[]
{
    return [[
        'model', fp_string('$' + getModelPrefix() + '/'+getPrefix()+'.3dshapes'+'/'+name+'.step'),true,
        ['offset', ['xyz', ...pos]],
        ['scale', ['xyz', ...scale]],
        ['rotate', ['xyz', ...rotate]],true
    ],[
        'model', fp_string('$' + getModelPrefix() + '/'+getPrefix()+'.3dshapes'+'/'+name+'.wrl'),true,
        ['offset', ['xyz', ...pos]],
        ['scale', ['xyz', ...scale]],
        ['rotate', ['xyz', ...rotate]],true
    ]]
}

function parse_SVGNODE(box:BBox_t, args:string[], segs:string[], comp:JLCComp_t){

   if(typeof comp.dataStr === 'string')return [];
   let node = JSON.parse(args[0]) as SVGNodeInfo;
   let x = comp.dataStr.head?.x||0;
   let y = comp.dataStr.head?.y||0;
   let [cx, cy] = node.attrs.c_origin.split(',');
   let [rx,ry,rz] = node.attrs.c_rotation.split(',')
   x = Number(cx) - x;
   y = Number(cy) - y;
   let z = node.attrs.z;
   if((box as CBox_t).isThru){
       z = 0;
   }
   return [...ki3d_info(node.attrs.title,
    [toMM(x), -toMM(y), toMM(node.attrs.z)],
    [1,1,1],
    [-Number(rx), -Number(ry), -Number(rz)])
    , true];
}
