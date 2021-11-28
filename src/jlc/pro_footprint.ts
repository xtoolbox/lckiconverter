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
import { BBox_t, JLCComp_t, JLCDevice_t} from "./component";
import { kifp_to_string, kifp_element, fp_name, fp_timestamp, fp_string, rotatePoint, isASCII, ki3d_info } from "./std_footprint";
import { SvgPoint, svg_arc_to_path, svg_path } from "./svg";

function kifp_log(...args:any[]){
    console.log("[LCKi] ProFP:", ...args)
}

interface CollectBBox
{
    box:BBox_t
    x1:number
    y1:number
    x2:number
    y2:number
    hasCourtYard?:boolean
    isThru?:boolean
}

const unkonwnLayer = "Eco2.User";
const j2k_layer_name = {
    "1":"F.Cu",
    "2":"B.Cu",
    "3":"F.SilkS",
    "4":"B.SilkS",
    "5":"F.Mask",
    "6":"B.Mask",
    "7":"F.Paste",
    "8":"B.Paste",
    "9":"F.Fab",
    "10":"B.Fab",
    "11":"Edge.Cuts",
    "12":"*.Cu",
    "13":"Dwgs.User",
    "14":unkonwnLayer,//"JLC.Mechanical",
    "15":"In1.Cu",
    "46":"In32.Cu",
    "47":unkonwnLayer,//"JLC.Hole",
    "48":unkonwnLayer,//"JLC.CompShape",
    "49":unkonwnLayer,//"JLC.CompMark",
    "56":unkonwnLayer,//"JLC.DRILL_DRAWING",
}

function updateBBox(pt:SvgPoint, layer:string, box:CollectBBox)
{
    if(layer.includes('Fab'))return;
    if(layer.includes('.Cu') || layer.startsWith('F.') || layer.startsWith('B.')){
        if(box.x1 > pt.x) box.x1 = pt.x;
        if(box.y1 > pt.y) box.y1 = pt.y;
        if(box.x2 < pt.x) box.x2 = pt.x;
        if(box.y2 < pt.y) box.y2 = pt.y;
    }
}

function isCourtYard(id:string):string|undefined
{
    if(String(id) === "48"){
        return "F.CrtYd";
    }
    return undefined;
}

function getLayers(id:string):string[]
{
    switch(String(id)){
        case '1':return ["F.Cu", "F.Paste", "F.Mask"];
        case '2':return ["B.Cu", "B.Paste", "B.Mask"];
        case '12':return ["*.Cu", "*.Mask"];
    }
    let n = Number(id);
    if(n>=15 && n <= 46){
        return ["In."+(n-14)+".Cu"];
    }
    return [ (j2k_layer_name as any)[id] || unkonwnLayer]
}

function getLayer(id:string):string{
    let n = Number(id);
    if(n>=15 && n <= 46){
        return "In."+(n-14)+".Cu";
    }
    return (j2k_layer_name as any)[String(id)] || unkonwnLayer;
}

export function convert_pro_footprint(comp:JLCComp_t):string
{
    if(typeof comp.dataStr !== 'string') return "# Std data " + comp.dataStr;
    let box = {x:0,y:0, width:100, height:100};
    let cbox:CollectBBox = {box:box, x1:1000, y1:1000, x2:-1000, y2:-1000}
    let fontMap = new Map<string,any[]>();

    let res:kifp_element[] = [
        "module",
        fp_name(comp.display_title||comp.title),
        ["layer", "F.Cu"], ["tedit",
        fp_timestamp()], true,
        kifp_text("reference", box, "REF**", "F.SilkS", SvgPoint(box.x+0, box.y-10)), true,
        kifp_text("value", box, "pro:"+comp.uuid  , "F.Fab", SvgPoint(box.x+0, box.y-0)), true,
    ];

    comp.dataStr.split('\n').forEach(line=>{
        let lineData = JSON.parse(line) as any[];
        switch(lineData[0]){
            case 'STRING':{
                res.push(...parse_TEXT(cbox, lineData, fontMap));
                break;
            }
            case 'POLY':{
                res.push(...parse_POLY(cbox, lineData));
                break;
            }
            case 'FILL':{
                res.push(...parse_FILL(cbox, lineData));
                break;
            }
            case 'VIA':{
                res.push(...parse_VIA(cbox, lineData));
                break;
            }
            case 'PAD':{
                res.push(...parse_PAD(cbox, lineData));
                break;
            }
            case 'FONT':{
                let [FONT, id, w, h, path] = lineData;
                fontMap.set(id, path);
                break;
            }
            case 'ATTR':
            case 'DOCTYPE':
            case 'CANVAS':
            case 'LAYER':
            case 'ACTIVE_LAYER':
            case 'PRIMITIVE':
            case 'RULE':
                break;
            default:
                kifp_log('Unknown data type ', lineData[0]);
                break;
        }
    })
    if(!cbox.hasCourtYard){
        let pts:SvgPoint[] = [
            SvgPoint(cbox.x1,cbox.y1),
            SvgPoint(cbox.x2,cbox.y1),
            SvgPoint(cbox.x2,cbox.y2),
            SvgPoint(cbox.x1,cbox.y2),
            SvgPoint(cbox.x1,cbox.y1)
        ];
        res.push(...jp2fp_line(cbox, 'F.CrtYd', pts, true, 6));
        kifp_log("Warning: no shape layer found, use boundbox as shape");
    }
    if(comp.device){
        res.push(...parse_3DModel(comp.device, cbox.isThru?true:false));
    }
    res.push(true);
    return kifp_to_string(res);
}

function jp2kifp_MM(x1mil:number|string):number{
    return Math.floor(Number(x1mil)*254 + 0.5)/10000;
}

function jp2kifp_size(w:string|number, h:string|number):kifp_element
{
    return [
        'size', jp2kifp_MM(w), jp2kifp_MM(h)
    ]
}

function kifp_witdh(width?:number|string):kifp_element[]{
    return [
        'width', jp2kifp_MM(width || (0.12/0.0254))
    ]
}

function kifp_text(type:"reference"|"value"|"user", box:BBox_t, text:string, 
        layer:string, pos:SvgPoint, rotate:string|number=0, fontSize:string|number=39.37, penWidth:string|number=5.90,
        hide?:boolean, mirror?:boolean, align:number=1, alignV:number = 1):kifp_element
{
    let hideText = [];
    if(hide)hideText.push('hide');
    let justify = [];
    let justifies = [];
    if(align == 0){
        justify.push('left');
    }else if(align == 2){
        justify.push("right");
    }
    if(alignV == 0){
        justify.push('top');
    }else if(alignV == 2){
        justify.push('bottom');
    }
    if(mirror){
        justify.push('mirror');
    }
    if(justify.length > 0){
        justify.unshift('justify');
        justifies.push(justify);
    }
    let text_pos = SvgPoint(pos.x, pos.y - Number(fontSize)/2);
    return ['fp_text',type, fp_string(text), jp2fp_coord(box, text_pos, 'at', rotate), ['layer', layer], ...hideText, true,
        ['effects', ['font', jp2kifp_size(fontSize, fontSize), ['thickness', jp2kifp_MM(penWidth)]], ...justifies]
    ];
}

function jp2fp_coord(box:BBox_t, pt:SvgPoint, type:'center'|'start'|'end'|'at'|'xy', rotate:string|number=0):kifp_element[]{
    rotate = Number(rotate)
    let np = SvgPoint(pt.x - box.x, box.y - pt.y);
    if(type === "xy" && rotate){
        np = rotatePoint(np, rotate);
    }
    let res = [
        type, jp2kifp_MM(np.x), jp2kifp_MM(np.y)
    ]
    if(rotate && type === "at"){
        res.push(rotate)
    }
    return res;
}

function updateCircleBBox(c:SvgPoint, d:number|string, box:CollectBBox, layer:string = "F.Cu")
{
    d = Number(d);
    updateBBox({x:c.x-d/2, y:c.y-d/2}, layer, box);
    updateBBox({x:c.x+d/2, y:c.y+d/2}, layer, box);
}

// ["VIA","e2",0,"","",5,0,12.0078,24.0158,0,null,null,1]
function parse_VIA(box:CollectBBox, data:any[]):kifp_element[]
{
    let [VIA, id, u1,u2,u3,x,y,hole,d,u4,topPasteClearance,bottomPasteClearance,locked] = data;
    updateCircleBBox(SvgPoint(x,y),d,box);
    let padData = [
        "pad", 
        fp_string(""), 
        "thru_hole",
        "circle",
        jp2fp_coord(box.box, {x:Number(x),y:Number(y)},'at', 0),
        jp2kifp_size(d,d),
        ['drill', jp2kifp_MM(hole)],
        ["layers", '*.Cu'],
    ]
    let pasteClearance = 0;
    if(bottomPasteClearance){
        pasteClearance = jp2kifp_MM(bottomPasteClearance);
    }
    if(topPasteClearance){
        pasteClearance = jp2kifp_MM(topPasteClearance);
    }
    if(pasteClearance){
        padData.push(true, ['solder_paste_margin', pasteClearance])
    }
    return [padData, true];
}

function parse_PAD(box:CollectBBox, data:any[]):kifp_element[]
{
    let [PAD, id, u1, u2, layerId, number, x, y, rotate, 
        holeShape, padShape, padShapes, holeOffX, holeOffY, holeRotate,
        plated, u3, solder, paste, u5, u6, locked] = data;
    let layers = getLayers(layerId);
    let padType = "smd";
    if(layerId == 12){
        box.isThru = true;
        padType = "thru_hole"
        if(!plated){
            padType = "np_thru_hole"
        }
    }

    if((padShapes as []).length > 0){
        kifp_log("Warning: Different pad shape on layers is not support, ignore it");
    }

    let drills:kifp_element[] = [];
    let drillPadParam:number[] = [];
    if(padType != "smd" && holeShape){
        let drill:kifp_element[] = ['drill'];
        if(holeShape[0] == 'SLOT'){
            if(holeRotate == 0 || holeRotate == 180){
                drill.push('oval', jp2kifp_MM(holeShape[1]), jp2kifp_MM(holeShape[2]));
            }else if(false){//holeRotate == 90 || holeRotate == 270){
                drill.push('oval', jp2kifp_MM(holeShape[2]), jp2kifp_MM(holeShape[1]));
            }else{
                kifp_log("Warning: Convert free rotate hole to a new pad", holeRotate);
                let d = holeShape[1];
                if(d > holeShape[2]) d = holeShape[2];
                drill.push(jp2kifp_MM(d));
                drillPadParam = [
                    Number(holeShape[1]), Number(holeShape[2]), Number(holeRotate)
                ];
            }
        }else{
            drill.push(jp2kifp_MM(holeShape[1]));
        }
        if(holeOffX || holeOffY){
            drill.push(['offset', jp2kifp_MM(holeOffX), jp2kifp_MM(holeOffY)]);
            x -= holeOffX;
            y += holeOffY;
        }
        drills.push(drill);
    }

    let polyParam:kifp_element[] = [];
    let [shape,w,h] = padShape;
    if(shape == "ELLIPSE"){
        shape = "circle"
    }else if(shape == "RECT"){
        shape = "rect";
    }else if(shape == "OVAL"){
        shape = "oval";
    }else if(shape == "POLYGON"){
        shape = "custom";
        let padBox:BBox_t = {x:Number(x), y:Number(y), width:0, height:0}
        let pts = svg_path('M ' + (w as []).join(' ')).map(pt=>{
            updateBBox(pt, "F.Cu", box);
            return jp2fp_coord(padBox, pt, 'xy', -Number(rotate));
        })
        polyParam = [true,
            ["zone_connect", 0],
            ["options", ["clearance","outline"], ["anchor", "circle"]],true,
            ["primitives", true,
                ["gr_poly", true,
                    ['pts', true,
                        ...pts
                    ],
                    kifp_witdh(),
                ],true,
            ]
        ]
        w = "4";
        h = "4";
    }else{
        kifp_log("Warning: Unknown pin shape " + shape);
    }
    if(shape != 'custom'){
        updateCircleBBox({x:x,y:y}, w>h?w:h, box);
    }

    let drillPad:kifp_element[] = [];
    if(drillPadParam.length > 0){
        drillPad = [true,[
            "pad", 
            fp_string(number), 
            padType,
            "oval",
            jp2fp_coord(box.box,  {x:Number(x),y:Number(y)},'at', drillPadParam[2] + rotate),
            jp2kifp_size(drillPadParam[0]+4,drillPadParam[1]+4),
            ['drill', 'oval', jp2kifp_MM(drillPadParam[0]), jp2kifp_MM(drillPadParam[1])],
            ["layers", ...layers]
        ]];
    }
    
    let padData = [
        "pad", 
        fp_string(number), 
        padType,
        shape,
        jp2fp_coord(box.box, {x:Number(x),y:Number(y)},'at', rotate),
        jp2kifp_size(w,h),
        ...drills,
        ["layers", ...layers],
        ... polyParam
    ]

    if(solder || paste){
        padData.push(true);
    }
    if(solder){
        padData.push(['solder_mask_margin', jp2kifp_MM(solder)])
    }
    if(paste){
        padData.push(['solder_paste_margin', jp2kifp_MM(paste)])
    }
    return [padData, ...drillPad, true];
}

function jp2fp_line(cbox:CollectBBox, layer:string, pts:SvgPoint[], split?:boolean, width?:number|string):kifp_element[]
{
    let box = cbox.box;
    let res:kifp_element[] = [];
    if(split){
        updateBBox(pts[0], layer, cbox);
        for(let i=1;i<pts.length;i++){
            updateBBox(pts[i], layer, cbox);
            res.push([
                'fp_line',
                jp2fp_coord(box, pts[i-1], 'start'),
                jp2fp_coord(box, pts[i], 'end'),
                ['layer', layer],
                kifp_witdh(width),
            ], true);
        }
    }else{
        pts.pop();
        res.push(
            ['fp_poly',
                ['pts', ...pts.map((pt)=>{
                    updateBBox(pt, layer, cbox);
                    return jp2fp_coord(box, pt, 'xy')
                })],
                ['layer', layer],
                kifp_witdh(width),
            ], true
        )
    }
    return res;
}

interface ArcRes{
    x:number,y:number,r:number,startAngle:number, endAngle:number
}

function solve_arc_2p_1a(sp:SvgPoint,ep:SvgPoint,angle:number):ArcRes
{
    let a2 = angle*Math.PI/180/2;
    let dx = sp.x - ep.x;
    let dy = sp.y - ep.y;
    let r = Math.sqrt(dx*dx+dy*dy)/Math.sin(a2)/2;
    let cx = r * Math.cos(a2);
    let theta = Math.atan2(-dx,dy);
    let cy = cx * Math.sin(theta);
        cx = cx * Math.cos(theta);
    cx += (sp.x + ep.x)/2;
    cy += (sp.y + ep.y)/2;
    let sa = Math.atan2(sp.y-cy, sp.x-cx)*180/Math.PI;
    let ea = Math.atan2(ep.y-cy, ep.x-cx)*180/Math.PI;
    return {
        x:cx,y:cy,r:Math.abs(r),
        startAngle:sa, endAngle:ea,
    }
}

function parse_linePath(box:CollectBBox, path:any[], penWidth:number, layer:string, asPolygon?:boolean):kifp_element[]
{
    if(path[0] == 'CIRCLE'){
        let [t,x,y,r] = path;
        let pt = SvgPoint(x,y);
        updateCircleBBox({x:x,y:y},r*2, box, layer);
        if(asPolygon){
            let polyPts = svg_arc_to_path({
                cx:x,
                cy:y,
                rx:r,
                ry:r,
                startAngle:0,
                deltaAngle:360,
                xRotate:0,
                startPt:{x:0,y:0},
                endPt:{x:0,y:0}
            }, true);
            return jp2fp_line(box, layer, polyPts, false, penWidth);
        }
        return [
            ['fp_circle',
                jp2fp_coord(box.box, pt, 'center'),
                jp2fp_coord(box.box, SvgPoint(pt.x+Number(r), pt.y), 'end'),
                ['layer', layer], kifp_witdh(penWidth)
            ],
            true,
        ];
    }else if(path[0] == 'R'){
        let [t, x,y,w,h, rotate] = path;
        let a = rotate*Math.PI/180;
        let cosA = Math.cos(a);
        let sinA = Math.sin(a);
        let pts:SvgPoint[] = [
            SvgPoint(x,y),
            SvgPoint(x+cosA*w,       y+sinA*w       ),
            SvgPoint(x+cosA*w+sinA*h,y+sinA*w-cosA*h),
            SvgPoint(x       +sinA*h,y       -cosA*h),
            SvgPoint(x,y)
        ];
        pts.forEach(pt=>updateBBox(pt, layer, box));
        if(asPolygon){
            return jp2fp_line(box, layer, pts, false, penWidth);
        }
        return jp2fp_line(box, layer, pts, true, penWidth);
    }else{
        let res:kifp_element[] = [];
        let polyPts:SvgPoint[] = [];
        let data = path as (string|number)[];
        let pt= SvgPoint(data.shift(), data.shift());
        if(asPolygon)polyPts.push(pt);
        while(data.length>0){
            let cmd = String(data.shift());
            switch(cmd){
                case 'ARC':{
                    let angle = Number(data.shift());
                    let ep = SvgPoint(data.shift(), data.shift());
                    let circle = solve_arc_2p_1a(pt, ep, angle);
                    updateCircleBBox({x:circle.x,y:circle.y}, circle.r*2, box, layer);
                    if(asPolygon){
                        let sa = circle.startAngle;
                        let da = angle;
                        polyPts.push(...svg_arc_to_path({
                            cx:circle.x,
                            cy:circle.y,
                            rx:circle.r,
                            ry:circle.r,
                            startAngle:sa,
                            deltaAngle:da,
                            xRotate:0,
                            startPt:{x:0,y:0},
                            endPt:{x:0,y:0}
                        }, false));
                    }else{
                        res.push(
                            ['fp_arc',
                                jp2fp_coord(box.box, SvgPoint(circle.x, circle.y), 'start'),
                                jp2fp_coord(box.box, ep, 'end'),
                                ['angle', angle],
                                ['layer', layer], kifp_witdh(penWidth)
                            ],
                            true,
                        );
                    }
                    pt.x = ep.x;
                    pt.y = ep.y;
                    break;
                }
                case 'L':
                    while(data.length > 1 && typeof data[0] == 'number'){
                        let ep = SvgPoint(data.shift(), data.shift());
                        updateBBox(ep, layer, box);
                        if(asPolygon){
                            polyPts.push(ep);
                        }else{
                            res.push([
                                'fp_line',
                                jp2fp_coord(box.box, pt, 'start'),
                                jp2fp_coord(box.box, ep, 'end'),
                                ['layer', layer],
                                kifp_witdh(penWidth),
                            ], true);
                        }
                        pt.x = ep.x;
                        pt.y = ep.y;
                    }
                    break;
                default:
                    kifp_log("Error: unknown path command", cmd);
                    break;
            }
        }
        if(asPolygon){
            return jp2fp_line(box, layer, polyPts, false, penWidth);
        }
        return res;
    }
}

function parse_POLY(box:CollectBBox, data:any[]):kifp_element[]
{
    let [POLY, id, u1, u2, layerId, penWidth, path, locked] = data;
    let layer = getLayer(layerId);
    let cyd = isCourtYard(layerId);
    if(cyd){
        box.hasCourtYard = true;
        layer = cyd;
    }
    return parse_linePath(box, path, penWidth, layer) as kifp_element[];
}

function parse_FILL(box:CollectBBox, data:any[]):kifp_element[]
{
    let [FILL, id, u1, u2, layerId, penWidth, u3, path, locked] = data;
    let layer = getLayer(layerId);
    let cyd = isCourtYard(layerId);
    let lineMode = false;
    if(path[0] instanceof Array){
        path = path[0];
    }
    if(Number(layerId) == 12){
        layer = "Edge.Cuts";
        let [t,x,y,r] = path;
        if(t == 'CIRCLE'){
            let d = r*2;
            let padData = [
                "pad", 
                fp_string(""), 
                "np_thru_hole",
                "circle",
                jp2fp_coord(box.box, {x:Number(x),y:Number(y)},'at', 0),
                jp2kifp_size(d,d),
                ['drill', jp2kifp_MM(d)],
                ["layers", ... getLayers('12')],
            ]
            return [padData, true];
        }
        penWidth = 6;
        lineMode = true;
    }
    if(cyd){
        box.hasCourtYard = true;
        layer = cyd;
        penWidth = 6;
        lineMode = true;
    }
    return parse_linePath(box, path, penWidth, layer, !lineMode);
}

function parse_TEXT(box:CollectBBox, data:any[], fontMap:Map<string, any[]>):kifp_element[]
{
    let [TEXT, id, u1, layerId, x, y, text, family, height, penWidth, u2, u3, align, rotate, u5, u6, mirror, locked] = data;
    // align, 1,2,3,4,5,6,7,8,9   LT,LC,LB,CT,CC,CB,RT,RC,RB
    let layer = getLayer(layerId);
    let needMirror = layer.startsWith("B.") != (mirror != 0);
    let cosA = Math.cos(rotate*Math.PI/180);
    let sinA = Math.sin(rotate*Math.PI/180);
    if(isASCII(text)){
        return [kifp_text('user', box.box,text, layer, SvgPoint(x,y),
            rotate, height/1.4, penWidth, false, needMirror, Math.floor((align-1)/3), (align-1)%3), true];
    }
    let font = fontMap.get(id);
    if(font){
        let res:kifp_element[] = [];
        font.forEach(shapes=>{
            let useX = true;
            let lastX = 0;
            res.push(...parse_linePath(box, 
                (shapes as any[]).map((e, idx)=>{
                    if(typeof e == 'number'){
                        e = e * height/10;
                        if(useX){
                            let ty = (shapes[idx+1] as number) * height/10;
                            lastX = e;
                            e = cosA*e - sinA*ty;
                        }else{
                            let tx = lastX;
                            e = sinA*tx + cosA*e;
                        }
                        if(useX){
                            if(needMirror){
                                e = x - e;
                            }else{
                                e = x + e;
                            }
                        }else{
                            e += y;
                        }
                        //e = e + (useX?x:y);
                        useX = !useX;
                    }
                    return e;
                })
                , penWidth/2, layer, false));
        })
        return res;
    }
    return [];
}

function parse_3DModel(device:JLCDevice_t, isThru:boolean):kifp_element[]
{
    let title = device.attributes['3D Model Title'] as string|undefined;
    let trans = device.attributes['3D Model Transform'] as string|undefined;
    if(title && trans){
        let [sx,sy,sz, rz,rx,ry,dx,dy,dz] = trans.split(',').map(e=>Number(e)||0);
        sx = jp2kifp_MM(sx);
        sy = jp2kifp_MM(sy);
        sz = jp2kifp_MM(sz);
        dx = jp2kifp_MM(dx);
        dy = jp2kifp_MM(dy);
        dz = jp2kifp_MM(dz);
        if(isThru)dz = 0;
        return [
            ...ki3d_info(title, [dx,dy,dz], [1,1,1], [-rx,-ry,-rz]),
            true
        ]
    }
    return [];
}
