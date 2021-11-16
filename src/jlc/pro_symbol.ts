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

import { get_footprint_name } from "@/inst";
import {BBox_t, JLCComp_t, JLCDocType } from "./component";
import { j2k_fill_color, j2k_string } from "./std_symbol";
import { get_angle, SvgPoint } from "./svg";

function kisym_log(...args:any[]){
   console.log("[LCKi] ProSym:", ...args)
}


interface FontStyle
{
   name:string
   color:string
   xx1:any
   family:string
   size:number
   italic:number
   bold:number
   underscore:number
   xx2:any
   vAlign:string
   hAlign:string
}

function FontStyle(param:any[]):FontStyle{
   return {
      name:param[1] as string,
      color:param[2]||'#008000',
      xx1:param[3],
      family:param[4]||'',
      size:param[5]||10,
      italic:param[6]||0,
      bold:param[7]||0,
      underscore:param[8]||0,
      xx2:param[9],
      vAlign: ['T','C','B'][param[10] || 2] || 'C',
      hAlign: ['L','C','R'][param[11] || 0] || 'C'
   }
}

interface LineStyle
{
   name:string
   color:string
   style:number
   fill:string
   penWidth:number
}

function LineStyle(param:any[]):LineStyle
{
   return {
      name:param[1] as string,
      color:param[2]||'#008000',
      style:param[3]||0,
      fill:param[4]||'none',
      penWidth:param[5]||0,
   }
}

interface PinData
{
   id:string,
   x1:any,
   inputType:string,
   x:number
   y:number
   len:number
   rotate:number
   color:string
   acitveLow:number
   x2:any
   name:string
   number:string
   nameSize:number
   numberSize:number
   nameVisible:Boolean
   numberVisible:Boolean
   part:number
}

function PinData(param:any[], part:number):PinData
{
   return {
      id:param[1],
      x1:param[2],
      inputType:['I','I','O','B'][param[3]||0] || 'I',
      x:param[4],
      y:param[5],
      len:param[6],
      rotate:param[7]||0,
      color:param[8]||'#008080',
      acitveLow:param[9]||0,
      x2:param[10],
      name:'',
      number:'',
      nameVisible:true,
      numberVisible:true,
      nameSize:0,
      numberSize:0,
      part:part,
   }
}

// ["ATTR", id, parentId, propertyName, value, 0, visible, x, y, rotate, sName, mayLocked]
interface AttrData
{
   id:string
   parentId:string
   propertyName:string
   value:string
   x1:any
   visible:number
   x:number
   y:number
   rotate:number
   styleName:string
   mayLocked:any
}

function AttrData(param:any[]):AttrData
{
   return {
      id:param[1],
      parentId:param[2],
      propertyName:param[3],
      value:param[4],
      x1:param[5],
      visible:param[6],
      x:param[7],
      y:param[8],
      rotate:param[9],
      styleName:param[10],
      mayLocked:param[11],
   }
}

let def_pin_name_offset = 40;
export function convert_pro_symbol(comp:JLCComp_t):string
{
   if(typeof comp.dataStr !== 'string') return "# Std data " + JSON.stringify(comp.dataStr);
   let style:Map<string, FontStyle|LineStyle> = new Map();
   let pins:Map<string, PinData> = new Map();
   let pinList:PinData[] = [];
   let part = 1;
   let partCount = 1;
   let box = {x:0,y:0, width:100, height:100};
   let pre = {v:'U',x:0,y:0, valid:false};
   let symbol = {v:"",x:0,y:0, valid:false};
   let showPinNumber = "N"
   let showPinName = "N"
   let drawRes = "";
   let headLine = 0;
   comp.dataStr.split('\n').forEach(line=>{
      let lineData = JSON.parse(line) as any[];
      switch(lineData[0]){
         case 'HEAD':{
            box.x = lineData[1].originX || 0;
            box.y = lineData[1].originY || 0;
            break;
         }
         case '':{
            break;
         }
         case 'PART':{
            let partName = (lineData[1] as string);
            let n = Number( (lineData[2] as any)['BBOX'][1]||0);
            if(n<headLine)headLine = n;
            part = parseInt(partName.substring(partName.lastIndexOf('.')+1));
            if(partCount < part) partCount = part;
            break;
         }
         case 'FONTSTYLE': style.set(lineData[1], FontStyle(lineData)); break;
         case 'LINESTYLE': style.set(lineData[1], LineStyle(lineData)); break;
         case 'PIN':{
            let pin = PinData(lineData, part);
            pins.set(lineData[1], pin);
            pinList.push(pin);
            break;
         }
         case 'ATTR':{
            let attr = AttrData(lineData);
            let pinData:PinData|undefined;
            if(attr.parentId && (pinData = pins.get(attr.parentId) )){
               if(attr.propertyName == "NAME"){
                  pinData.name = attr.value;
                  pinData.nameVisible = attr.visible?true:false;
                  if(pinData.nameVisible){
                     showPinName = 'Y'
                  }
                  pinData.nameSize = (style.get(attr.styleName) as FontStyle).size || 10
               }else if(attr.propertyName == "NUMBER"){
                  pinData.number = attr.value;
                  pinData.numberVisible = attr.visible?true:false;
                  if(pinData.numberVisible){
                     showPinNumber = 'Y'
                  }
                  pinData.numberSize = (style.get(attr.styleName) as FontStyle).size || 10
               }
            }else{
               if(attr.propertyName == 'Designator' && pre.valid == false){
                  pre.v = attr.value || "U";
                  pre.v = pre.v.replace('?', "");
                  pre.x = attr.x
                  pre.y = attr.y
                  pre.valid = true;
               }else if(attr.propertyName == 'Symbol' && symbol.valid == false){
                  symbol.v = attr.value;
                  symbol.x = attr.x
                  symbol.y = attr.y
                  symbol.valid = true;
               }
            }
            break;
         }
         case 'DOCTYPE':
            if(lineData[1] !== 'SYMBOL'){
               kisym_log("Error: Unknown document type " + lineData[1]);
            }
            break;
         case 'CIRCLE':
         case 'RECT':
         case "ARC":
         case "POLY":
         case "TEXT":
            drawRes += parse_graph(box, part, lineData[0], lineData, style) + "\n";
            break;
      }
   });



   let title = comp.display_title||comp.title;
   title = j2k_string(title);
   symbol.v = j2k_string(symbol.v);

   function text_field(id:number, data:{x:number,y:number,v:string}, visible:boolean = true, fieldName?:string):string{
      let text = j2k_string(data.v);
      if(text === "") text = "~";
      return 'F' + id + ' "' + text + '" ' + jp2k_coord(box, data.x, data.y) + " 50 H " +(visible?"V":"I") 
      + " C CNN" + (fieldName?(' "'+fieldName+'"'):"") + "\n"
   }

   //pre.y = headLine - 5;
   //symbol.y = headLine - 12;

   let res = "#\n# " + title + "\n#\n";
   res += "DEF " + j2k_string(title) + " " + j2k_string(pre.v) + " 0 " 
   + def_pin_name_offset + " "+showPinNumber+" "+ showPinName + " " + partCount + " F N\n";
   res += text_field(0, pre);
   res += text_field(1, symbol);
   res += text_field(2, {x:0, y:headLine+10, v:get_footprint_name(comp.device?.footprint?.uuid||"")}, false);
   res += text_field(3, {x:0, y:headLine+30, v:comp.device?.attributes['Datasheet'] || ""}, false);
   res += text_field(4, {x:0, y:headLine+50, v:comp.device?.attributes['Supplier Part'] || ""}, false, 'SuppliersPartNumber');
   res += text_field(5, {x:0, y:headLine+70, v:"pro:"+(comp.uuid || "")}, false, 'uuid');
   res += "DRAW\n"
   res += drawRes;
   pinList.forEach(p=>{
      res += parse_pin(box, p) + "\n";
   })
   res += "ENDDRAW\n"
   res += "ENDDEF\n"
   return res;
}

let ratio = 10;
function jp2k_coord(box:BBox_t, x:number, y:number):string{
   x = x - box.x;
   y = y - box.y;
   return String(Math.floor(x*ratio)) + " " + Math.floor(y*ratio)
}

function jp2k_size(v:number):number
{
   return Math.floor(v*ratio);
}

function jp2k_font_size(v:number):number
{
   return Math.floor(v*ratio*0.5);
}

// refer: http://www.ambrsoft.com/trigocalc/circle3d.htm
function get_center(x1:number,y1:number,x2:number,y2:number,x3:number,y3:number):{x:number, y:number, r:number}
{
   let sxy1 = x1*x1+y1*y1;
   let sxy2 = x2*x2+y2*y2;
   let sxy3 = x3*x3+y3*y3;
   let A = x1*(y2-y3)-y1*(x2-x3)+x2*y3-x3*y2;
   let B = sxy1*(y3-y2)+sxy2*(y1-y3)+sxy3*(y2-y1);
   let C = sxy1*(x2-x3)+sxy2*(x3-x1)+sxy3*(x1-x2);
   let D = sxy1*(x3*y2-x2*y3)+sxy2*(x1*y3-x3*y1)+sxy3*(x2*y1-x1*y2);
   return {x:-B/A/2, y:-C/A/2, r:Math.sqrt((B*B+C*C-4*A*D)/(4*A*A))};
}
// [TEXT, id, x, y, rotate, text, styleName, mayLocked]
function parse_graph(box:BBox_t, part:number, type:'POLY'|'ARC'|'CIRCLE'|'RECT'|'TEXT', data:any[], style:Map<string, FontStyle|LineStyle>):string
{
   switch(type){
      case 'POLY':{
         let pts = data[2] as number[];
         if(data[3] === false){
            pts.pop(); pts.pop();
         }
         let ls = style.get(data[4]) as LineStyle;
         let res = "";
         for(let i=0;i<pts.length;i+=2){
            res = res + jp2k_coord(box, pts[i], pts[i+1]) + ' ';
         }
         return "P " + pts.length/2 + ' '
         + part + " 1 " + jp2k_size(ls.penWidth) + " " + res + "" + j2k_fill_color(ls.fill);
      }
      case 'RECT':{
         let [RECT, id, x1,y1,x2,y2,u1,u2,u3,sName] = data;
         let ls = style.get(sName) as LineStyle;
         return "S " + jp2k_coord(box, x1, y1) + " " + jp2k_coord(box, x2, y2)
         + " " + part + " 1 " + jp2k_size(ls.penWidth) + " " + j2k_fill_color(ls.fill);
      }
      case 'CIRCLE':{
         let [CIRCLE, id, cx,cy,r,sName] = data;
         let ls = style.get(sName) as LineStyle;
         return "C " + jp2k_coord(box, cx, cy) + " " + jp2k_size(r) + " " + part + " 1 " + jp2k_size(ls.penWidth) + " " + j2k_fill_color(ls.fill);
      }
      case 'ARC':{
         // convert 3 pt arc to kicad arc
         let [ARC, id, sx, sy, cx, cy, ex, ey, sName, mayLocked] = data;
         let ls = style.get(sName) as LineStyle;
         let c = get_center(sx,sy,cx,cy,ex,ey);
         let sAngle = Math.floor(Math.atan2(sy-c.y,sx-c.x)*1800/Math.PI);
         let cAngle = Math.floor(Math.atan2(cy-c.y,cx-c.x)*1800/Math.PI);
         let eAngle = Math.floor(Math.atan2(ey-c.y,ex-c.x)*1800/Math.PI);
         return "A " + jp2k_coord(box, c.x, c.y) + " " + jp2k_size(c.r)  + " " + sAngle + " " + cAngle
            + " " + part + " 1 " + jp2k_size(ls.penWidth) + " " + j2k_fill_color(ls.fill) + " " + 
            jp2k_coord(box, sx, sy) + " " + jp2k_coord(box, cx, cy) + "\n" +

         "A " + jp2k_coord(box, c.x, c.y) + " " + jp2k_size(c.r)  + " " + cAngle + " " + eAngle
            + " " + part + " 1 " + jp2k_size(ls.penWidth) + " " + j2k_fill_color(ls.fill) + " " + 
            jp2k_coord(box, cx, cy) + " " + jp2k_coord(box, ex, ey);
         //return "# TODO: parse " + data.join(',') + " ("+ c.x + ',' + c.y +"," +c.r+") " + sAngle + ":"+ cAngle  + ":" + eAngle;
      }
      case "TEXT":{
         let [TEXT, id, x, y, rotate, text, sName, mayLocked] = data;
         let ls = style.get(sName) as FontStyle;
         let hidden = '0'
         let bold = ls.bold?"1" : '0'
         let italic = ls.italic?"Italic":"Normal";
         if(Number(rotate) != 0){
             rotate = String(360 - Number(rotate));
         }
         return "T " + Math.floor(rotate*10) + " " + jp2k_coord(box, x, y) + " " + jp2k_font_size(ls.size) + " " + hidden + " " + part + " 1 "
         + j2k_string(text) + " " + italic + " " + bold + " L C"
      }
   }
}

function parse_pin(box:BBox_t, pin:PinData):string
{
   let rotate = ({['']:'L', ['0']:'R', ['90']:'U', ['180']:'L', ['270']:'D'}as any) [String(pin.rotate)] || 'L';
   let shapePrefix = "" // always visible
   let shape = pin.acitveLow?"I":""
   return "X " + j2k_string(pin.name) + " " + j2k_string(pin.number) + " " + jp2k_coord(box, pin.x, pin.y) + " " + jp2k_size(pin.len) + " " + 
   rotate + " " + jp2k_font_size(pin.numberSize) + " " + jp2k_font_size(pin.nameSize)
    + " " + pin.part + " 1 " + pin.inputType + " " + shapePrefix + shape;
}



