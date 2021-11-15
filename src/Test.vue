<template>
    <a href="https://docs.easyeda.com/en/DocumentFormat/2-EasyEDA-Schematic-File-Format/index.html">LCEDA Format</a>
    <el-button size="mini" @click="testConvert">Convert</el-button>
    <a href="https://www.compuphase.com/electronics/LibraryFileFormats.pdf">KiCad Format</a>
    <el-button size="mini" @click="RunTest" :type="testResult">RunTest</el-button>
    <el-button size="mini" @click="View3D" >View3D</el-button>
    <el-button size="mini" @click="ToggleLang" >Toggle Lang</el-button>

<el-row>
    <el-col :span='12'>
    <el-input
        type="textarea"
        :rows="30"
        placeholder="LCEDA Json"
        v-model="lcedaJson">
    </el-input>
    </el-col>
    <el-col :span='12'>
    <el-input
        type="textarea"
        :rows="30"
        placeholder="KiCad Data"
        v-model="kicadData">
    </el-input>
    </el-col>
</el-row>

  <el-dialog
    title="3D Preview"
    v-model='show3D'
    width="40%" :destroy-on-close="false">
    <chip-view :rowData="rowData" :isVRML='false'/>
    <!--chip-view :rowData="vrData" :isVRML='true'/-->
  </el-dialog>

</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { convertData} from './convert'
import { CompRow_t } from './inst';
import { getTestObj, getTestVrml, run_test } from './jlc/test_case';
import ChipView from './components/ChipView.vue'
import {objmtl2vrml} from './jlc/jlcobj2vrml'
import { setup_language } from './language/lang';


function uri2json(uri:string):any
{
    let obj:any = {};
    uri.replace(/([^?&=]+)=([^?&=]*)/g, function(ss, a, b){
        let name = decodeURIComponent(a);
        let content:any = decodeURIComponent(b);
        if(name == "dataStr"){
            content = (content as string).replace(/\+/g, ' ');
            //console.log(content);
            content = JSON.parse(content);
            obj.docType = Number(content.head.docType);
        }
        obj[name] = content;
        return ss;
    })
    return obj;
}

export default defineComponent({
    components: {
        ChipView,
    },
    setup() {
        let lcedaJson = ref("");
        let kicadData = ref("");
        let testResult = ref("info");
        function testConvert(){
            let x:any;
            try{
                x = JSON.parse(lcedaJson.value);
            }catch(e){
                x = uri2json(lcedaJson.value);
                //console.log(x);
            }
            
            if(x.head){
                x = {
                    dataStr:x,
                    title:x.head.c_para.name,
                    docType:Number(x.head.docType),
                    uuid:x.head.uuid
                }
            }
            kicadData.value = convertData(x).content;
        }
        function RunTest(){
            testResult.value = run_test()?'success':'danger';
        }

        let show3D = ref(false);
        let rowData = ref<CompRow_t>();
        let vrData = ref<CompRow_t>();
        function View3D(){
            rowData.value = {data3d : getTestObj()||""};
            vrData.value = {data3d: getTestVrml()||""};
            show3D.value = true;
            kicadData.value = objmtl2vrml(getTestObj()||"", true, "test");
        }
        let langFlag = true;
        function ToggleLang(){
            langFlag = !langFlag;
            setup_language(langFlag?'帮助':'en');
        }
        return {lcedaJson, kicadData, testConvert, RunTest, testResult,
        show3D, rowData, View3D, vrData, ToggleLang};
    },
})
</script>
