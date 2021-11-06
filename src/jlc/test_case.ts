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

// test case runner
import { convertData } from "@/convert"

type getTestData_t = ()=>{obj:string, vrml:string, test_case:{jlc:string, kicad:string}[]};

export function getTestObj():string|undefined{
  try{
    return ((window as any).getTestData as getTestData_t)().obj;
  }catch(e){
    console.log("test data not ready");
  }
  return undefined;
}

export function getTestVrml():string|undefined{
  try{
    return ((window as any).getTestData as getTestData_t)().vrml;
  }catch(e){
    console.log("test data not ready");
  }
  return undefined;
}

export function run_test():boolean{
    let allPass = true;
    try{
      let test_data = ((window as any).getTestData as getTestData_t)().test_case;
      test_data.forEach((e, id)=>{
          console.log('run test', id);
          let cr = convertData(e.jlc);
          cr.content = cr.content.replace(/\(tedit [A-F0-9]+\)/, '(tedit 00000000)')
          let result = cr.content == e.kicad;
          allPass = allPass && result;
          if(!result){
              let tt = ""
              for(let i=0;i<cr.content.length && i<e.kicad.length;i++){
                if(cr.content[i] === e.kicad[i]){
                  tt+=cr.content[i];
                }else{
                  tt += '@@@' + cr.content[i] + '@@@' + e.kicad[i];
                }
              }
              console.log(tt);
              console.log("Test case "+id, result);
          }
      })
    }catch(e){
      console.log(e);
      return false;
    }
    return allPass;
}
//require('../../test_data/test_init')
//run_test();