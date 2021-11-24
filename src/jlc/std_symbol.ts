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

import { JLCComp_t, BBox_t } from "@/jlc/component";
import {get_footprint_name} from '@/inst'
import {svg_calc_arc, svg_path, svg_solve_arc, SvgPoint, svg_arc_to_path, arc_result} from './svg'

function kisym_log(...args:any[]){
    console.log("[LCKi] StdSym:", ...args)
}

// j2k_xxxxx, convert lceda unit/direction/color to kicad unit/direction/color

// kicad use ~ as bar, no space, covert ~ to ~~, and space to _
export function j2k_string(str:string):string
{
    let temp = document.createElement("div") as HTMLDivElement;
    temp.innerHTML = str;
    str = temp.innerText || temp.textContent || '';
    str = str.replace(/~/g, '~~').replace(/\s/g, '_');
    if(str === "")return "~";
    return str;
}

const ratio = 10;
function j2k_coord(box:BBox_t, x:number|string, y:number|string):string
{
    x = Number(x) - box.x;
    y = box.y - Number(y);
    return String(Math.floor(x*ratio)) + " " + Math.floor(y*ratio)
}

function j2k_size(v:number|string):number
{
    return Math.floor(Number(v)*ratio);
}

function j2k_font_size(pt:number|string):number
{
    if(typeof pt === 'string'){
        pt = pt.replace('pt', '');
        pt = Number(pt);
        if(pt < 1) pt = 7;
    }
    return Math.floor(Number(pt)*(50.0/7.0) + 0.5);
}

function j2k_line_width(w:string|number):number
{
    return Math.floor(Number(w) * 6);
}

export function j2k_fill_color(color:string):string
{
    if(color === 'none')return 'N';
    if(color.length < 7)return 'N';
    let r = parseInt(color.substr(1,2), 16);
    let g = parseInt(color.substr(3,2), 16);
    let b = parseInt(color.substr(5,2), 16);
    return 0.3 * r + 0.6 * g + 0.1 * b > 128 ? 'f' : 'F';
}

function j2k_angle(angle:number|string):number
{
    return Math.floor(Number(angle)*10);
}

function j2k_path(path:string|SvgPoint[], box:BBox_t, part:number, strokeWidth:number|string, fillColor:string):string
{
    if(typeof path === 'string'){
        path = svg_path(path);
    }
    let pts = path.map(e=>j2k_coord(box, e.x, e.y));
    return "P " + pts.length + " " + part + " 1 " + j2k_line_width(strokeWidth) + " " + pts.join(' ') + " " + j2k_fill_color(fillColor);
}

let def_pin_name_offset = 40;  // 40mil
interface PinDisplayInfo{
    showName:number
    hideName:number
    showNum:number
    hideNum:number
}

export function convert_std_symbol(comp:JLCComp_t):string
{
    if(typeof comp.dataStr === 'string') return "# Pro data " + comp.dataStr;
    
    let box = {x:comp.dataStr.head?.x||0,y:comp.dataStr.head?.y||0, width:100, height:100};
    let headLine = comp.dataStr.BBox?.y || 0;
    headLine -= box.y;
    let res = "";
    let title = comp.display_title||comp.title;
    title = j2k_string(title);
    let pre = ((comp.dataStr as any).head?.c_para?.pre as string)||'';
    pre = pre.replace('?', "");
    res += "#\n# " + title + "\n#\n";
    let partCount = 1;
    if(comp.subparts){
        partCount = comp.subparts.length;
    }
    let showPinName = "Y"
    let showPinNumber = "Y"
    let pinCount:PinDisplayInfo = {showName:0, hideName:0, showNum:0, hideNum:0};
    let drawRes = ""
    if(comp.subparts){
        comp.subparts.forEach((subComp, index)=>{
            if(typeof subComp.dataStr === 'object'){
                let box = {x:subComp.dataStr.head?.x||0,y:subComp.dataStr.head?.y||0, width:100, height:100};
                subComp.dataStr.shape?.forEach((s)=>{
                    drawRes += parse_symbol_shape(box, s, pinCount, index+1) + "\n";
                })
            }
        });
    }else{
        comp.dataStr.shape?.forEach(s=>{
            drawRes += parse_symbol_shape(box, s, pinCount) + "\n";
        })
    }
    if(pinCount.hideName > pinCount.showName && pinCount.showName == 0) showPinName = "N";
    if(pinCount.hideNum > pinCount.showNum && pinCount.showNum == 0) showPinNumber = "N";

    res += "DEF " + j2k_string(title) + " " + j2k_string(pre) + " 0 " + def_pin_name_offset + " "+showPinNumber+" "+ showPinName + " " + partCount + " F N\n";
    function text_field(id:number, text:string, offset_y:number, visible:boolean = true, fieldName?:string):string{
        text = j2k_string(text);
        if(text === "") text = "~";
        return 'F' + id + ' "' + text + '" ' + j2k_coord(box, box.x, box.y+offset_y) + " 50 H " +(visible?"V":"I") + " C CNN" + (fieldName?(' "'+fieldName+'"'):"") + "\n"
    }
    res += text_field(0, pre, headLine-10);
    res += text_field(1, title, headLine-30);
    res += text_field(2, get_footprint_name(comp.dataStr.head?.puuid||""), headLine+10, false);
    res += text_field(3, (comp as any).szlcsc?.url || (comp as any).lcsc?.url || "", headLine+30, false);
    res += text_field(4, (comp as any).szlcsc?.number || (comp as any).lcsc?.number || "", headLine+50, false, 'SuppliersPartNumber');
    res += text_field(5, "std:"+(comp.uuid|| ""), headLine+50, false, 'uuid');
    res += "DRAW\n"
    res += drawRes;
    res += "ENDDRAW\n"
    res += "ENDDEF\n"
    return res;
}

const StdSymbolShape =
{
    P:parse_pin,
    PL:parse_polyline,
    R:parse_rectangle,
    PT:parse_bline,
    A:parse_arc,
    AR:parse_arrow,
    PG:parse_polygon,
    E:parse_ellipse,
    T:parse_text,
}

function parse_symbol_shape(box:BBox_t, shape:string, pin:PinDisplayInfo, part:number = 1):string
{
    let [seg, ...segs] = shape.split('^^');
    let [cmd, ...args] = seg.split('~');
    
    if(cmd == "P"){
        return StdSymbolShape.P(box, part, args, segs, pin);
    }
    let t = (StdSymbolShape as any)[cmd];
    return t?t(box, part, args, segs):"# <Unknown shape>: " + shape;
}

function parse_pin(box:BBox_t, part:number, args:string[], segs:string[], pin:PinDisplayInfo):string
{
    let [show, elecType, pinNum, pinX, pinY, pinR, id, locked] = args;
    let [pinPath, pinColor] = segs[1].split('~');
    let [nameShow, nameX, nameY, nameR, nameText, nameAchor, nameFont, nameSize, nameColor] = segs[2].split('~');
    let [numShow,  numX,  numY,  numR,  numText,  numAchor,  numFont,  numSize, numColor] = segs[3].split('~');
    let [dotShow, dotX, dotY] = segs[4].split('~');
    let [clkShow, clkPath] = segs[5].split('~');
    let shapePrefix = show === 'show' ? '' : 'N';
    let ppLen =  20;
    let pts = svg_path(pinPath);// pinPath.split(' ');
    if(pts.length>1){
        let dx = pts[0].x - pts[1].x;
        let dy = pts[0].y - pts[1].y;
        ppLen = Math.sqrt(dx*dx+dy*dy);
    }
    let rotate = ({['']:'L', ['0']:'L', ['90']:'D', ['180']:'R', ['270']:'U'}as any) [pinR] || 'L';
    let pinlength = j2k_size(Math.abs(Number(ppLen)));
    if(Number(nameShow)){pin.showName++; }else{ pin.hideName++; }
    if(Number(numShow)){pin.showNum++; }else{ pin.hideNum++; }
    let sizename = j2k_font_size(nameSize);
    let sizenum =  j2k_font_size(numSize);
    let shape = "";
    if(Number(dotShow)){
        shape += 'I';
        pinlength += j2k_size(3);
    }
    if(Number(clkShow)){
        shape += 'C';
        pinlength += j2k_size(3);
    }
    let pinType = ['I','I','O','B','W'][Number(elecType)] || 'I';
    return "X " + j2k_string(nameText) + " " + j2k_string(numText) + " " + j2k_coord(box, pinX, pinY) + " " + pinlength + " " + 
    rotate + " " + sizenum + " " + sizename + " " + part + " 1 " + pinType + " " + shapePrefix + shape;
}

function parse_polyline(box:BBox_t, part:number, args:string[], segs:string[]):string
{
    let [points, color, penWidth, style, fill, id, lock] = args;
    let count = 0;
    let res = points.replace(/([-\d.]+)\s+([-\d.]+)/g, (s, ...match)=>{
        count++;
        return j2k_coord(box, match[0], match[1]);
    });
    return "P " + count + ' '
    + part + " 1 " + j2k_line_width(penWidth) + " " + res + " " + j2k_fill_color(fill);
}

function parse_rectangle(box:BBox_t, part:number, args:string[], segs:string[]):string
{
    let [x, y, rx, ry, width, height, color, penWidth, style, fill, id, lock] = args;
    return "S " + j2k_coord(box, x, y) + " " + j2k_coord(box, Number(x) + Number(width), Number(y) + Number(height))
    + " " + part + " 1 " + j2k_line_width(penWidth) + " " + j2k_fill_color(fill);
}

// TODO: bline not editalbe in kicad, need convert curve to polyline
function parse_bline(box:BBox_t, part:number, args:string[], segs:string[]):string
{
    let [path, color, penWidth, style, fill, id, lock] = args;
    let resPrefix = "B " + 4 + " " + part + " 1 " + j2k_line_width(penWidth);
    let resPostfix = j2k_fill_color(fill);
    let pathPt = svg_path(path);
    let curveCount = 0;
    path.replace(/[cC]/g, (e)=>{
        curveCount++;
        return e;
    })
    if(curveCount > 0 && curveCount*3+1 === pathPt.length){
        // split curve to B line
        let rrr = "";
        let sep = "";
        while(curveCount>0){
            curveCount--;
            let usedPt = pathPt.splice(0, 4);
            rrr = rrr + sep + resPrefix + " " + usedPt.map(e=>j2k_coord(box, e.x, e.y)).join(' ') + " " + resPostfix;
            sep = "\n"
            pathPt.unshift(usedPt.pop()||{x:0,y:0});
        }
        kisym_log("Warning: Bezier curve is not editable in KiCad");
        return rrr;
    }else{
        return j2k_path(path, box, part, penWidth, fill);
    }
}

function parse_arc(box:BBox_t, part:number, args:string[], segs:string[]):string
{
    let [path, helper, color, penWidth, style, fill, id, lock] = args;
    let arc = svg_solve_arc(path);
    let res = ""
    let sep = ""
    if(arc.rx == arc.ry && arc.rx > 0){
        // split arc large than 180 into two arc
        let {startAngle, deltaAngle} = arc;
        let step = 180;
        if(deltaAngle < 0){
            startAngle = startAngle + deltaAngle;
            deltaAngle = -deltaAngle;
        }
        while(deltaAngle > 0.1){
            if(deltaAngle < step){
                step = deltaAngle;
            }
            arc.startAngle = startAngle;
            arc.deltaAngle = step;
            let pt = svg_calc_arc(arc);
            let kiEndAngle = arc.startAngle;
            if(step == 180) kiEndAngle += 0.1;
            res  = res + sep + "A " + j2k_coord(box, arc.cx, arc.cy) + " " + j2k_size(arc.rx)  + " " + j2k_angle(-(arc.startAngle+step)) + " " + j2k_angle(-kiEndAngle)
            + " " + part + " 1 " + j2k_line_width(penWidth) + " " + j2k_fill_color(fill) + " " + j2k_coord(box, pt.x2, pt.y2) + " " + j2k_coord(box, pt.x1, pt.y1)
            sep = "\n"
            deltaAngle -= step;
            startAngle += step;
        }
        return res;
    }else{
        // treat it as svg path
        return j2k_path(path, box, part, penWidth, fill);
    }
}

function parse_arrow(box:BBox_t, part:number, args:string[], segs:string[]):string
{
    let [part_type, x, y, id, rotate, path, fill, penWidth, style] = args;
    return j2k_path(path, box, part, penWidth, fill);
}

function parse_polygon(box:BBox_t, part:number, args:string[], segs:string[]):string
{
    let [path, color, penWidth, style, fill, id, lock] = args;
    let pts = path.split(/[\s]+/g);
    pts.splice(2, 0, "L");
    pts.unshift("M");
    return j2k_path(pts.join(' ')+' Z', box, part, penWidth, fill);
}

function parse_ellipse(box:BBox_t, part:number, args:string[], segs:string[]):string
{
    let [cx, cy, rx, ry, color, penWidth, style, fill, id, lock] = args;
    if(rx == ry){
        return "C " + j2k_coord(box, cx, cy) + " " + j2k_size(rx) + " " + part + " 1 " + j2k_line_width(penWidth) + " " + j2k_fill_color(fill);
    }
    let arc:arc_result = {
        cx:Number(cx),
        cy:Number(cy),
        rx:Number(rx),
        ry:Number(ry),
        startAngle:0,
        deltaAngle:359,
        xRotate:0,
        startPt:SvgPoint(0,0),
        endPt:SvgPoint(0,0),
    }
    return j2k_path(svg_arc_to_path(arc, true), box, part, penWidth, fill);
}

function parse_text(box:BBox_t, part:number, args:string[], segs:string[]):string
{
    let [mark, x, y, rotate, color, font, textSize, bold, italic, baseline, type, text, visible, anchor, id, lock] = args;
    let hidden = visible === '0'?'1':'0'
    bold = bold === "" ? "0" : '1'
    if(italic.trim() === ""){
        italic = "Normal"
    }
    if(Number(rotate) != 0){
        rotate = String(360 - Number(rotate));
    }
    return "T " + j2k_angle(rotate) + " " + j2k_coord(box, x, y) + " " + j2k_font_size(textSize) + " " + hidden + " " + part + " 1 "
    + j2k_string(text) + " " + italic + " " + bold + " L C"
}
