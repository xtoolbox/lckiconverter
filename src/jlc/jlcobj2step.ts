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

// a very simple converter for obj with mtl file to STEP file
// [vt, vn, curv, deg, parm and cstype] not support in obj file
// [Ns, Ni, illum] not support in mtl file
// NO SOLID in the generated STEP file, every thing is face
// NO SOLID in the generated STEP file, every thing is face
// NO SOLID in the generated STEP file, every thing is face

import { Face, Vertices} from './jlcobj2vrml';

function log(...args:any[]){
    console.log("[LCKi] ObjMtl2Step:",...args);
}

class Color_t{
    r:number
    g:number
    b:number
    constructor(r:number,g:number,b:number){
        this.r = r;
        this.g = g;
        this.b = b;
    }
    toString():string{
        return `${this.r},${this.g},${this.b}`
    }
}

function output_v(x:number, y:number, z:number):string
{
    let tx = String(x);
    let ty = String(y);
    let tz = String(z);
    if(!tx.includes('.')) tx += '.'
    if(!ty.includes('.')) ty += '.'
    if(!tz.includes('.')) tz += '.'
    return `${tx},${ty},${tz}`
}

const STEP_END = `
ENDSEC;
END-ISO-10303-21;
`

function dir(p1:Vertices, p2:Vertices):Vertices
{
    let res = {x:p2.x-p1.x, y:p2.y-p1.y, z:p2.z-p1.z};
    let t = Math.sqrt(res.x*res.x + res.y*res.y + res.z*res.z);
    res.x/=t; res.y/=t; res.z/=t;
    return res;
}

function normal(a:Vertices, b:Vertices):Vertices{
    return {
        x:a.y*b.z - a.z*b.y,
        y:a.z*b.x - a.x*b.z,
        z:a.x*b.y - a.y*b.x
    }
}

function normal3p(p1:Vertices, p2:Vertices, p3:Vertices):Vertices[]{
    let res = normal({x:p2.x-p1.x, y:p2.y-p1.y, z:p2.z-p1.z}, {x:p3.x-p2.x, y:p3.y-p2.y, z:p3.z-p2.z});
    
    let t = Math.sqrt(res.x*res.x + res.y*res.y + res.z*res.z);
    res.x/=t; res.y/=t; res.z/=t;

    let refV = {x:p2.x-p1.x, y:p2.y-p1.y, z:p2.z-p1.z};
    let r2 = normal(res, refV);
    t = Math.sqrt(r2.x*r2.x + r2.y*r2.y + r2.z*r2.z);
    r2.x/=t; r2.y/=t; r2.z/=t;
    return [res, r2];
}

// Fake Array
class STEP_RECORDS
{
    public data:string
    public length:number;
    constructor(){
        this.length = 0;
        this.data = ""
    }
    *[Symbol.iterator](){
        yield this;
    }
    push(...args:(STEP_RECORDS[])|string[]){
        args.forEach((s:STEP_RECORDS|string)=>{
            if(typeof s === 'string'){
                this.data = this.data + s + "\n";
                this.length++;
            }else{
                this.data = this.data + s.data;
                this.length+=s.length;
            }
        });
    }
    join(s:string){return this.data}
    unshift(s:string){
        this.data = s + "\n" + this.data;
        this.length++;
    }
}

function ORIENTED_EDGE(p1:number, p2:number, vertices:Vertices[], ln:number, stepMap:Map<string,number>):STEP_RECORDS{
    let res:STEP_RECORDS = new STEP_RECORDS();
    let edgeName = "ED:"+p1+"."+p2;
    let edgeNameRev = "ED:"+p2+"."+p1;
    if(stepMap.has(edgeName)){
        let x = stepMap.get(edgeName)||0;
        res.push(`#${ln} = ORIENTED_EDGE('',*,*,#${x},.T.);`); ln++;
        return res;
    }else if(stepMap.has(edgeNameRev)){
        let x = stepMap.get(edgeNameRev)||0;
        res.push(`#${ln} = ORIENTED_EDGE('',*,*,#${x},.F.);`); ln++;
        return res;
    }
    res.push(`#${ln} = ORIENTED_EDGE('',*,*,#${ln+1},.T.);`); ln++;
    let pplRes= new STEP_RECORDS;
    let vp1 = vertices[p1];
    let vp2 = vertices[p2];
    let ecLn = ln; ln++;
    let nP1 = ln;
    let vp = "VP:"+p1;
    if(stepMap.has(vp)){
        nP1 = stepMap.get(vp)||0;
    }else{
        stepMap.set("VP:"+p1, ln);
        pplRes.push(`#${ln} = VERTEX_POINT('',#${ln+1});`); ln++;
        pplRes.push(`#${ln} = CARTESIAN_POINT('',(${ output_v(vp1.x,vp1.y,vp1.z)}));`); ln++;
    }
    let nP2 = ln;
    vp = "VP:"+p2;
    if(stepMap.has(vp)){
        nP2 = stepMap.get(vp)||0;
    }else{
        stepMap.set("VP:"+p2, ln);
        pplRes.push(`#${ln} = VERTEX_POINT('',#${ln+1});`); ln++;
        pplRes.push(`#${ln} = CARTESIAN_POINT('',(${ output_v(vp2.x,vp2.y,vp2.z)}));`); ln++;
    }
    let nLine = ln;
    pplRes.push(`#${ln} = LINE('',#${ln+1},#${ln+2});`); ln++;
    pplRes.push(`#${ln} = CARTESIAN_POINT('',(${ output_v(vp1.x,vp1.y,vp1.z)}));`); ln++;
    pplRes.push(`#${ln} = VECTOR('',#${ln+1},1.);`); ln++;
    let tp = dir(vp1,vp2);
    pplRes.push(`#${ln} = DIRECTION('',(${ output_v(tp.x,tp.y,tp.z)}));`); ln++;
    stepMap.set(edgeName, ecLn);
    res.push(`#${ecLn} = EDGE_CURVE('',#${nP1},#${nP2},#${nLine},.T.);`);
    res.push(...pplRes);
    return res;
}
// convert obj face to STEP face
function ADVANCED_FACE(face:Face, vertices:Vertices[], ln:number, stepMap:Map<string,number>):STEP_RECORDS{
    let res= new STEP_RECORDS;
    let advFaceLn = ln; ln++;
    let edgeLoop:string[] = [];
    let loopContent= new STEP_RECORDS;
    let faceBoundLn = ln;
    res.push(`#${ln} = FACE_BOUND('',#${ln+1},.T.);`); ln++;
    let edgeLoopLn = ln; ln++;
    for(let i=0;i<face.index.length;i++){
        edgeLoop.push("#"+ln);
        if(i == face.index.length-1){
            let t = ORIENTED_EDGE(face.index[i], face.index[0], vertices, ln, stepMap);
            loopContent.push(...t);
            ln += t.length;
        }else{
            let t = ORIENTED_EDGE(face.index[i], face.index[i+1], vertices, ln, stepMap);
            loopContent.push(...t);
            ln += t.length;
        }
    }
    res.push(`#${edgeLoopLn} = EDGE_LOOP('',(${edgeLoop.join(",")}));`);
    res.push(...loopContent);
    let planLn = ln;
    res.push(`#${ln} = PLANE('',#${ln+1});`); ln++;
    res.push(`#${ln} = AXIS2_PLACEMENT_3D('',#${ln+1},#${ln+2},#${ln+3});`); ln++;
    let tp1 = vertices[face.index[0]];
    let tp2 = vertices[face.index[1]];
    let tp3 = vertices[face.index[2]];
    res.push(`#${ln} = CARTESIAN_POINT('',(${output_v(tp1.x,tp1.y,tp1.z)}));`); ln++;
    let v = normal3p(tp1,tp2,tp3);
    tp1 = v[0];
    res.push(`#${ln} = DIRECTION('',(${output_v(tp1.x,tp1.y,tp1.z)}));`); ln++;
    tp1 = v[1];
    res.push(`#${ln} = DIRECTION('',(${output_v(tp1.x,tp1.y,tp1.z)}));`); ln++;
    res.unshift(`#${advFaceLn} = ADVANCED_FACE('',(#${faceBoundLn}),#${planLn},.T.);`)
    return res;
}

// Convert face to STEP data
function ClosedShell(faces:Face[], vertices:Vertices[], ln:number, stepMap:Map<string,number>, faceColor:FaceColor_t[], color:Color_t, shellType:string = "CLOSED", shell?:Shell[]):STEP_RECORDS
{
    let res= new STEP_RECORDS;
    let faceRes:string[] = [];
    let SHELL_BASED_SURFACE_MODEL_LN = ln; ln++;
    let closeShellLn = ln; ln++;
    if(shell){
        // merge shell to one
        shell.forEach(s=>{
            s.faces.forEach(f=>{
                faceRes.push("#"+ln);
                faceColor.push({ln:ln, color:s.color});
                let t = ADVANCED_FACE(f, vertices, ln, stepMap);
                res.push(...t);
                ln+=t.length;
            })
        })
    }else{
        faces.forEach(f=>{
            faceRes.push("#"+ln);
            faceColor.push({ln:ln, color:color});
            let t = ADVANCED_FACE(f, vertices, ln, stepMap);
            res.push(...t);
            ln+=t.length;
        })
    }
    res.unshift(`#${closeShellLn} = ${shellType}_SHELL('',(${faceRes.join(",")}));`);
    res.unshift(`#${SHELL_BASED_SURFACE_MODEL_LN} = SHELL_BASED_SURFACE_MODEL('',(#${closeShellLn}));`);
    return res;
}
export interface Shell{
    faces:Face[]
    color:Color_t
    ln:number
}

type FaceColor_t = {ln:number, color:Color_t};

function SHAPE_REPRESENTATION(shell:Shell[], vertices:Vertices[], oneShell?:boolean):STEP_RECORDS{
    let res= new STEP_RECORDS;
    let stepMap = new Map<string,number>();
    let shellRes:string[] = [];
    let faceColor:FaceColor_t[] = [];
    res.push(`#11 = AXIS2_PLACEMENT_3D('',#12,#13,#14);`);
    res.push(`#12 = CARTESIAN_POINT('',(0.,0.,0.));`);
    res.push(`#13 = DIRECTION('',(0.,0.,1.));`);
    res.push(`#14 = DIRECTION('',(1.,0.,-0.));`);
    let ln = 15;
    if(oneShell){
        shellRes.push("#"+ln);
        let t = ClosedShell([], vertices, ln, stepMap, faceColor, shell[0].color, "CLOSED" ,shell);
        res.push(...t);
        ln+=t.length;
    }else{
        shell.forEach(s=>{
            shellRes.push("#"+ln);
            let t = ClosedShell(s.faces, vertices, ln, stepMap, faceColor, s.color);
            res.push(...t);
            s.ln = ln;
            ln+=t.length;
        });
    }
    res.unshift(`#10 = SHAPE_REPRESENTATION('', (#11,${shellRes.join(",")}), #${ln})`);
    res.push(...GEOMETRIC_REPRESENTATION_CONTEXT(shell, ln, stepMap, faceColor, oneShell));
    return res;
}

function collectColor(shell:Shell|FaceColor_t, ln:number, stepMap:Map<string,number>, curve?:boolean):STEP_RECORDS
{
    let res= new STEP_RECORDS;
    res.push(`#${ln} = STYLED_ITEM('color',(#${ln+1}),#${shell.ln});`); ln++;
    res.push(`#${ln} = PRESENTATION_STYLE_ASSIGNMENT((#${ln+1}));`); ln++;
    res.push(`#${ln} = SURFACE_STYLE_USAGE(.BOTH.,#${ln+1});`); ln++;
    res.push(`#${ln} = SURFACE_SIDE_STYLE('',(#${ln+1}));`); ln++;
    res.push(`#${ln} = SURFACE_STYLE_FILL_AREA(#${ln+1});`); ln++;
    res.push(`#${ln} = FILL_AREA_STYLE('',(#${ln+1}));`); ln++;
    let cn = `CR:${shell.color.r},${shell.color.g}, ${shell.color.b}`;
    if(stepMap.has(cn)){
        res.push(`#${ln} = FILL_AREA_STYLE_COLOUR('',#${stepMap.get(cn)});`); ln++;
    }else{
        res.push(`#${ln} = FILL_AREA_STYLE_COLOUR('',#${ln+1});`); ln++;
        stepMap.set(cn, ln);
        res.push(`#${ln} = COLOUR_RGB('',${output_v(shell.color.r,shell.color.g,shell.color.b)});`); ln++;
    }

    //res.push(`#${ln} = FILL_AREA_STYLE_COLOUR('',#${ln+1});`); ln++;
    //res.push(`#${ln} = COLOUR_RGB('',${shell.color.r},${shell.color.g}, ${shell.color.b});`); ln++;
    //res.push(`#${ln} = CURVE_STYLE('',#${ln+1},POSITIVE_LENGTH_MEASURE(0.1),#${ln+2});`); ln++;
    //res.push(`#${ln} = DRAUGHTING_PRE_DEFINED_CURVE_FONT('continuous');`); ln++;
    //res.push(`#${ln} = COLOUR_RGB('',${shell.color.toString()});`); ln++;
    return res;
}

function GEOMETRIC_REPRESENTATION_CONTEXT(shell:Shell[], ln:number, stepMap:Map<string,number>, faceColor:FaceColor_t[], oneShell?:boolean):STEP_RECORDS{
    let res= new STEP_RECORDS;
    let gpLn = ln;
    res.push(`#${ln} = ( GEOMETRIC_REPRESENTATION_CONTEXT(3) 
    GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${ln+4})) GLOBAL_UNIT_ASSIGNED_CONTEXT
    ((#${ln+1},#${ln+2},#${ln+3})) REPRESENTATION_CONTEXT('Context #1',
      '3D Context with UNIT and UNCERTAINTY') );`); ln++;
    res.push(`#${ln} = ( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );`); ln++;
    res.push(`#${ln} = ( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );`); ln++;
    res.push(`#${ln} = ( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() );`); ln++;
    res.push(`#${ln} = UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#${ln-3},
    'distance_accuracy_value','confusion accuracy');`); ln++;
    res.push(`#${ln} = PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(#7));`); ln++;
    let lnTemp = ln; ln++;
    let colorRes= new STEP_RECORDS;
    let colorId:string[] = [];

    if(!oneShell){
        shell.forEach(s=>{
            let t = collectColor(s, ln, stepMap, true);
            colorId.push("#"+ln);
            ln += t.length;
            colorRes.push(...t);
        });
    }

    faceColor.forEach(fc=>{
        let t = collectColor(fc, ln, stepMap);
        colorId.push("#"+ln);
        ln += t.length;
        colorRes.push(...t);
    })
    res.push(`#${lnTemp} = MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('', (${colorId.join(',')}),
  #${gpLn} )`);
    res.push(...colorRes);
    return res;
}

export function objmtl2step(shell:Shell[], vertices:Vertices[], filename:string):string
{
    let res = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('LCKiConverter Model lckicad.xtoolbox.org'),'2;1');
FILE_NAME('${filename}.step','${(new Date()).toISOString()}',('LCEDA'),(
    ''),'LCKiConverter','LCKiConverter','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
#1 = APPLICATION_PROTOCOL_DEFINITION('international standard',
  'automotive_design',2000,#2);
#2 = APPLICATION_CONTEXT(
  'core data for automotive mechanical design processes');
#3 = SHAPE_DEFINITION_REPRESENTATION(#4,#10);
#4 = PRODUCT_DEFINITION_SHAPE('','',#5);
#5 = PRODUCT_DEFINITION('design','',#6,#9);
#6 = PRODUCT_DEFINITION_FORMATION('','',#7);
#7 = PRODUCT('${filename}','${filename}','',(#8));
#8 = PRODUCT_CONTEXT('',#2,'mechanical');
#9 = PRODUCT_DEFINITION_CONTEXT('part definition',#2,'design');
`;
    let t = SHAPE_REPRESENTATION(shell, vertices, true);
    res += t.join("\n");
    res += STEP_END;
    return res;
}

