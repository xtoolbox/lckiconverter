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

import { createApp } from 'vue'
import App from './App.vue'
import Btn from './Btn.vue'
import Test from './Test.vue'
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import {toggleVisible} from './inst'
import {setup_language} from './language/lang';

function monitor_language(helpMenu:HTMLSpanElement)
{
    let textContent = helpMenu.children[0].children[0].children[0] as HTMLSpanElement;
    setup_language(String(textContent.textContent));
    let ob = new MutationObserver((mutations, observer)=>{
        mutations.forEach(e=>{
            setup_language(String(textContent.textContent));
        })
    })
    var config = { attributes: true, characterData: true, subtree: true }
    ob.observe(textContent, config);
}

function injectContent () {
    const menuBar = document.getElementById('toolbar-common') as HTMLDivElement;
    if(menuBar){
        let div = document.createElement('div')
        div.id = 'kicadhelperButton'
        let lastMenu:string|null = null
        let helpMenu:HTMLSpanElement|undefined = undefined;
        for(let e of menuBar.children){
            if(lastMenu && lastMenu.includes("common-help")){
                menuBar.insertBefore(div, e);
                lastMenu = null;
                helpMenu&&monitor_language(helpMenu);
                break;
            }
            lastMenu = e.getAttribute('menu');
            helpMenu = e as HTMLSpanElement;
        }
        if(lastMenu){
            menuBar.appendChild(div);
            helpMenu&&monitor_language(helpMenu);
        }
        let app = createApp(Btn);
        app.config.globalProperties.$toggleVisible = toggleVisible;
        app.use(ElementPlus).mount('#kicadhelperButton')
    }

    const div = document.createElement('div')
	div.id = 'kicadhelperContent'
	document.body.appendChild(div)
    let app = createApp(App);
    app.config.globalProperties.$toggleVisible = toggleVisible;
    app.use(ElementPlus).mount('#kicadhelperContent')
    
    console.log("content inject");
}

if(document.URL.includes("lceda.cn") || document.URL.includes("easyeda.com")){
    injectContent();
}else{
    let app1 = createApp(Btn);
    app1.config.globalProperties.$toggleVisible = toggleVisible;
    app1.use(ElementPlus).mount('#kicadhelperButton');
    let app2 = createApp(App);
    app2.config.globalProperties.$toggleVisible = toggleVisible;
    app2.use(ElementPlus).mount('#kicadhelperContent');

    createApp(Test).use(ElementPlus).mount("#testframe");
}


