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

// a simple SVG path parser
export interface arc_result
{
    cx:number
    cy:number
    rx:number
    ry:number
    startAngle:number
    deltaAngle:number
    xRotate:number
    startPt:SvgPoint
    endPt:SvgPoint
}

function svg_split_path(path:string):string[]
{
    return path.replace(/([a-zA-Z])/g, (s1, ...s2)=>' ' + s2[0]+' ').trim().split(/[\s,]+/g);
}

export function get_angle(x1:number, y1:number, x2:number, y2:number):number
{
    // angle = arccos( (U dot V) / (|U|*|V|) )
    let factor = x1*y2 - y1*x2 > 0 ? 1.0 : -1.0;
    let temp = (x1*x2+y1*y2) / (Math.sqrt(x1*x1+y1*y1)*Math.sqrt(x2*x2+y2*y2));
    return factor*Math.acos(temp);
}

// svg get arc center from endpoint: https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter
export function svg_solve_arc(param:string, check?:boolean):arc_result
{
    let res:arc_result = {
        cx:0,cy:0, startAngle:0, deltaAngle:0,rx:0,ry:0,xRotate:0, startPt:{x:0,y:0}, endPt:{x:0,y:0}
    }
    let args = svg_split_path(param);
    let mustM =     args[0] ;
    let x1 = Number(args[1]);
    let y1 = Number(args[2]);
    let mustA =     args[3] ;
    let rx = Number(args[4]);
    let ry = Number(args[5]);
    let phiAngle =  args[6];
    let Fa       =  args[7];
    let Fs       =  args[8];
    let x2 = Number(args[9]);
    let y2 = Number(args[10]);
    if(mustM != 'M' || mustA != 'A'){
        return res;
    }
    res.rx = rx;
    res.ry = ry;
    res.startPt.x = x1;
    res.startPt.y = y1;
    res.endPt.x = x2;
    res.endPt.y = y2;
    res.xRotate = Number(phiAngle);
    if(rx==0||ry==0){
        res.cx = (x1+x2)/2;
        res.cy = (y1+y2)/2;
        res.deltaAngle = 360;
        return res;
    }
    let phi = Math.PI * Number(phiAngle) / 180;
    let cos_phi = Math.cos(phi);
    let sin_phi = Math.sin(phi);
    let x1_ =  cos_phi*(x1-x2)/2 + sin_phi*(y1-y2)/2;
    let y1_ = -sin_phi*(x1-x2)/2 + cos_phi*(y1-y2)/2;
    let tt1 = (rx*rx*ry*ry - rx*rx*y1_*y1_ - ry*ry*x1_*x1_);
    let tt2 = (rx*rx*y1_*y1_+ry*ry*x1_*x1_);
    if(tt1<0)tt1=0;
    let temp = Math.sqrt( tt1 / tt2);
    let factor = Fa == Fs ? -1.0 : 1.0;
    let cx_ = factor*temp*rx*y1_/ry;
    let cy_ = -factor*temp*ry*x1_/rx;

    res.cx = cos_phi*cx_ - sin_phi*cx_ + (x1+x2)/2;
    res.cy = sin_phi*cy_ + cos_phi*cy_ + (y1+y2)/2;
    res.startAngle = get_angle(1,0, (x1_-cx_)/rx, (y1_-cy_)/ry)*180/Math.PI;
    res.deltaAngle = get_angle((x1_-cx_)/rx, (y1_-cy_)/ry, (-x1_-cx_)/rx, (-y1_-cy_)/ry)*180/Math.PI;
    while(res.startAngle < 0){
        res.startAngle += 360;
    }
    while(res.startAngle >= 360){
        res.startAngle -= 360;
    }
    res.startAngle = Math.abs(res.startAngle);
    if(Number(Fs) != 0){
        if(res.deltaAngle < 0) res.deltaAngle += 360;
    }else{
        if(res.deltaAngle > 0) res.deltaAngle -= 360;
    }
    if(check){
        svg_compare_arc(param, res);
    }
    return res;
}

export function svg_calc_arc(arc:arc_result):{x1:number,y1:number,x2:number,y2:number}
{
    let res = {x1:0,y1:0,x2:0,y2:0}
    let phi = Math.PI * Number(arc.xRotate) / 180;
    // tranform to CCW
    let theta = -arc.startAngle*Math.PI/180;
    let dTheta = -arc.deltaAngle*Math.PI/180;
    let {rx, ry} = arc;
    res.x1 = Math.cos(phi)*Math.cos(theta)*rx - Math.sin(phi)*Math.cos(theta)*rx + arc.cx;
    res.y1 = Math.sin(phi)*Math.sin(theta)*ry - Math.cos(phi)*Math.sin(theta)*ry + arc.cy;
    theta += dTheta;
    res.x2 = Math.cos(phi)*Math.cos(theta)*rx - Math.sin(phi)*Math.cos(theta)*rx + arc.cx;
    res.y2 = Math.sin(phi)*Math.sin(theta)*ry - Math.cos(phi)*Math.sin(theta)*ry + arc.cy;
    return res;
}

function svg_compare_arc(input:string, res:arc_result)
{
    let np = svg_calc_arc(res);
    let Fa = Math.abs(res.deltaAngle) > 180 ? 1:0;
    let Fs = res.deltaAngle > 0 ? 1:0;
    let ttt = "M"+np.x1+","+np.y1+" A"+res.rx+","+res.ry+" "+res.xRotate+" " + Fa + " " + Fs + " "+np.x2+","+np.y2;
    log(input === ttt, input, "vs", ttt);
}

export interface SvgPoint
{
    x:number
    y:number
}
let g_x = 0;
let g_y = 0;
export function SvgPoint(x:number|string|undefined, y:number|string|undefined, relative?:boolean):SvgPoint{
    let nx = Number(x||0)
    let ny = Number(y||0)
    if(relative){
        nx = g_x + nx;
        ny = g_y + ny;
    }
    g_x = nx;
    g_y = ny;
    return {x:nx, y:ny}
}
const splitCount = 32;
export function svg_arc_to_path(arc:arc_result, includeStart?:boolean):SvgPoint[]
{
    let res:SvgPoint[] = [];
    let step = 360/splitCount;
    let {startAngle, deltaAngle} = arc;
    if(deltaAngle<0)step = -step;
    while(Math.abs(deltaAngle) > 0.1){
        if(Math.abs(deltaAngle) < Math.abs(step)){
            step = deltaAngle;
        }
        arc.startAngle = startAngle;
        arc.deltaAngle = step;
        let pt = svg_calc_arc(arc);
        if(res.length == 0 && includeStart){
            res.push({x:pt.x1,y:pt.y1});
        }
        res.push({x:pt.x2,y:pt.y2});
        deltaAngle -= step;
        startAngle += step;
    }
    return res;
}

function log(...arg:any[]){
    console.log("[LCKi] SVG:", ...arg);
}
const numRegex = /[\d.]+/;
// convert svg path to points
export function svg_path(path:string):SvgPoint[]
{   
    let res:SvgPoint[] = [];
    let args = svg_split_path(path);
    let cmd:string | undefined;
    let tx:string|undefined;
    let ty:string|undefined;
    //log(args);
    while(cmd = args.shift()){
        //log(cmd);
        switch(cmd[0]){
            case 'm':
            case 'M':
                tx = args.shift();
                ty = args.shift();
                if(tx && ty){
                    res.push(SvgPoint(tx, ty, cmd[0] === 'm'));
                }else{
                    return [];
                }
                while(args.length>1 && numRegex.test(args[0]) && numRegex.test(args[1])){
                    tx = args.shift();
                    ty = args.shift();
                    res.push(SvgPoint(tx, ty, false));
                }
                break;
            case 'A':
                if(res.length<1){
                    log("Arc without origin point");
                    return [];
                }
                if(args.length < 7){
                    log("Arc param length error");
                    return [];
                }
                let p = res[res.length-1];
                let arc = svg_solve_arc("M"+p.x+","+p.y+" A " + args.splice(0, 7).join(' '));
                res.push(...svg_arc_to_path(arc, false));
                break;
            case 'c':
            case 'C': // [TODO:] convert bezier curve to polyline points
            case 'l':
            case 'L':
                do{
                    tx = args.shift();
                    ty = args.shift();
                    if(tx && ty){
                        res.push(SvgPoint(tx, ty, cmd[0] === 'l' || cmd[0] === 'c'));
                    }else{
                        log("Point end unespect");
                        return [];
                    }
                }while(args.length > 0 && numRegex.test(args[0]));
                break;
            case 'v':
            case 'h':{
                do{
                    let dd = args.shift();
                    if(dd){
                        if(cmd[0] === 'h'){
                            res.push(SvgPoint(  dd, 0, true));
                        }else{
                            res.push(SvgPoint(  0, dd, true));
                        }
                    }else{
                        log("Point end unespect");
                        return [];
                    }
                }while(args.length > 0 && args[0].match(/[\d.]+/));
                break;
            }
            
            case 'z':
            case 'Z':
                res.push(res[0]);
                break;
            default:
                log("SVG: Unknown cmd:" + cmd[0]);
                break;
        }
    }
    return res;
}
