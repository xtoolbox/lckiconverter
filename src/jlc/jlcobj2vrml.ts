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

// a very simple converter for obj with mtl file to VRML file
// [vt, vn, curv, deg, parm and cstype] not support in obj file
// [Ns, Ni, illum] not support in mtl file
// the obj file uint is mm, the vrml used in KiCad unit is 100mil

function log(...args:any[]){
    console.log("[LCKi] ObjMtl2Vrml:",...args);
}

import {Shell, objmtl2step} from './jlcobj2step'

const _newmtl_pattern = /^newmtl /;
const _endmtl_pattern = /^endmtl/;

interface Mtl{
    name:string
    Ka:number[]
    Kd:number[]
    Ks:number[]
    d:number
}
function Mtl(name:string):Mtl
{
    return {name:name, Ka:[1,1,1], Kd:[1,1,1], Ks:[1,1,1], d:1}
}

function Mtl2VRML(mtl:Mtl):string
{
    return `Shape {
    appearance Appearance {material DEF MT-${mtl.name} Material {
        ambientIntensity 0.27
        diffuseColor ${mtl.Kd[0]} ${mtl.Kd[1]} ${mtl.Kd[2]}
        specularColor ${mtl.Ks[0]} ${mtl.Ks[1]} ${mtl.Ks[2]}
        emissiveColor ${mtl.Ka[0]} ${mtl.Ka[1]} ${mtl.Ka[2]}
        shininess 0.70
        transparency ${1-mtl.d}
        }
    }
}
`
}

// kicad use 100mil unit of VRML
const mm_to_100mil = 0.393700787;
function Face2VRML(faces:Face[], vertices:Vertices[], mtlName:string){
    let verMap = new Map<number,number>();
    let verList:Vertices[] = [];
    let res = `Shape { geometry IndexedFaceSet 
{ creaseAngle 0.50 coordIndex
[`;
    res += faces.map(face=>{
        return face.index.map(idx=>{
            let localIdx = 0;
            if(verMap.has(idx)){
                localIdx = verMap.get(idx) || 0;
            }else{
                verMap.set(idx, verList.length);
                localIdx = verList.length;
                verList.push(vertices[idx]);
            }
            return localIdx
        }).join(' ')+ ' -1'
    }).join(' ')
    res += ']\ncoord Coordinate { point ['
    res += verList.map(e=>{
        return [e.x*mm_to_100mil,e.y*mm_to_100mil,e.z*mm_to_100mil].join(' ');
    }).join(' ');
    res += ']\n}}\n'
    res += `appearance Appearance{material USE MT-${mtlName} }}
`
    return res;
}

const VRML_Head = `#VRML V2.0 utf8
# LC KiCad Converter VRML export
# by admin@xtoolbox.org
# visit http://lckicad.xtoolbox.org for more info
`;
export interface Vertices{x:number, y:number, z:number};
function Vertices(x:string,y:string,z:string):Vertices{
    return {
        x:parseFloat(x),y:parseFloat(y),z:parseFloat(z),
    }
}

export interface Face{
    index:number[]
}
function MakeFace(index:string[]):Face
{
    let res:number[] = [];
    for(let i=0;i<index.length;i++){
        let v = index[i].split('/');
        let idx = parseInt(v[0]);
        if(idx<0){
            log("Warning: TODO: to support negative index");
        }
        res.push(idx);
    }
    return {index:res};
}

export function objmtl2vrml(data:string, toStep:boolean = false, filename:string="part", uuid?:string):string
{
    let vrmlRes = ""
    let mtlRes = '';
    if ( data.indexOf( '\r\n' ) !== - 1 ) {
        // This is faster than String.split with regex that splits on both
        data = data.replace( /\r\n/g, '\n' );
    }

    if ( data.indexOf( '\\\n' ) !== - 1 ) {
        // join lines separated by a line continuation character (\)
        data = data.replace( /\\\n/g, '' );
    }
    const lines = data.split( '\n' );
    let mtlMode = false;
    let currenMtl = Mtl('');
    let vertices = [Vertices('0','0','0')];
    let curMtlName = '1';
    let faces:Face[] = [];
    let colorMap = new Map<string,{r:number,g:number,b:number}>();
    let shell:Shell[] = [];
    for ( let i = 0, l = lines.length; i < l; i ++ ) {
        let line = lines[ i ];
        if(_newmtl_pattern.test(line)){
            mtlMode = true;
        }
        if(mtlMode){
            let [key,v1,v2,v3] = line.split(/\s+/);
            switch(key){
                case 'newmtl':
                    currenMtl = Mtl(v1);
                    break;
                case 'Ka':
                case 'Kd':
                case 'Ks':
                    currenMtl[key] = [parseFloat(v1), parseFloat(v2), parseFloat(v3)];
                    if(key == 'Ka'){
                        colorMap.set(currenMtl.name, {r:currenMtl.Ka[0],g:currenMtl.Ka[1],b:currenMtl.Ka[2]});
                    }
                case 'd':{
                    let d = parseFloat(v1);
                    currenMtl.d = d>0.1?d:1.0;
                    break;
                }
                case 'endmtl':
                    mtlRes += Mtl2VRML(currenMtl);
                    break;
                case '#':
                    break;
                default:
                    log("unknown mtl record type " + key + ' ignore it');
                    break;
            }
        }else if(line[0] !== '#'){
            if(line.trim() !== ""){
            let [key, ...v] = line.trim().split(/\s+/);
            switch(key){
                case 'usemtl':
                    if(faces.length > 0){
                        if(toStep){
                            shell.push({faces:faces, ln:0, color:colorMap.get(curMtlName)||{r:1,g:1,b:1}})
                        }else{
                            vrmlRes += Face2VRML(faces, vertices, curMtlName);
                        }
                    }
                    faces = [];
                    curMtlName = v[0];
                    break;
                case 'v':
                    vertices.push(Vertices(v[0],v[1],v[2]));
                    break;
                case 'f':
                    faces.push(MakeFace(v));
                    break;
                default:
                    log("unknown obj record type " + key + ' ignore it');
                    break;
            }}
        }
        if(_endmtl_pattern.test(line)){
            mtlMode = false;
        }
    }
    if(faces.length > 0){
        if(toStep){
            shell.push({faces:faces, ln:0, color:colorMap.get(curMtlName)||{r:1,g:1,b:1}})
        }else{
            vrmlRes += Face2VRML(faces, vertices, curMtlName);
        }
        faces = [];
    }
    if(toStep){
        return objmtl2step(shell, vertices, filename, uuid);
    }
    return VRML_Head + `# uuid: ${uuid||""}` + "\n" + mtlRes + vrmlRes;
}

