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

 // a simple loader for obj embedded with mtl
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader'
import {MTLLoader} from 'three/examples/jsm/loaders/MTLLoader'
import {Group} from 'three'

const _newmtl_pattern = /^newmtl /;
const _endmtl_pattern = /^endmtl/;

// split the mixed mtl and obj file
export default function ObjMtlParse(data:string):Group{

    if ( data.indexOf( '\r\n' ) !== - 1 ) {
        // This is faster than String.split with regex that splits on both
        data = data.replace( /\r\n/g, '\n' );
    }

    if ( data.indexOf( '\\\n' ) !== - 1 ) {
        // join lines separated by a line continuation character (\)
        data = data.replace( /\\\n/g, '' );
    }
    const lines = data.split( '\n' );
    let mtlData = "";
    let objData = "";
    let line = '';
    let mtlMode = false;
    for ( let i = 0, l = lines.length; i < l; i ++ ) {
        line = lines[ i ];
        if(_newmtl_pattern.test(line)){
            mtlMode = true;
        }
        if(mtlMode){
            if(line.charAt( 0 ) == 'd'){
                line = "d 1.0"
            }
            mtlData = mtlData + line + "\n";
        }else{
            objData = objData + line + "\n";
        }
        if(_endmtl_pattern.test(line)){
            mtlMode = false;
        }
    }
    let ml = new MTLLoader();
    ml.setPath("./");
    let mat = ml.parse(mtlData, "");
    mat.preload();
    let ol = new OBJLoader();
    ol.setPath("./");
    ol.setMaterials(mat);
    let res = ol.parse(objData);
    return res;
}

