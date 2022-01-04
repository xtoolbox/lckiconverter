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

// it seems i18n not works in extension

// import {createI18n} from 'vue-i18n'

let setLocale:(locale:string)=>void = ()=>{};
let currentLocale:'ch'|'en' = 'ch';
export function setup_language(text:string|((locale:string)=>void)){
    if(typeof text === 'string'){
      if(text === '帮助'){
        currentLocale = 'ch';
        setLocale('ch');
      }else{
        currentLocale = 'en'
        setLocale('en');
      }
    }else{
      setLocale = text;
      setLocale(currentLocale);
    }
}

export const transTable : any = {
  'Symbol':'原理图库',
  'Footprint':'封装库',
  '3D Model':'3D模型',
  'Open component list':'打开器件列表',
  'Use [Ctrl/⌘]+[Left Click] to select item':'使用[Ctrl/⌘]加[鼠标左键]选择要下载的原理图库/封装/3D模型',
  'If [Ctrl/⌘]+[Click] not works, retry after refresh page':'如果选择没有生效，刷新页面后重试',
  'Download':'下载',
  ' Mode':'模式',
  'Std':'标准',
  'Pro':'专业',
  ' Converter':'转换器',
  'Help':'帮助',
  'http://lckicad-en.xtoolbox.org':'http://lckicad.xtoolbox.org',
  'Load Netlist':'转换网表'
};
