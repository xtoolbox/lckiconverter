<template>
  <div :style="[{visibility:resizing?'':'hidden'}]" id="kicadhelperDialogMask">
  </div>
  <div :style="[{visibility:dialogGeo.visible?'':'hidden'}, {left:''+dialogGeo.x+'px', top:''+dialogGeo.y+'px', width:''+dialogGeo.width+'px', height:''+dialogGeo.height+'px'}]" id="kicadhelperDialog">
  <div id="kicadhelperTitle" @mousedown.prevent="titleDown" ></div>
  <div id="kicadhelperLeft"  @mousedown.prevent="leftDown" :style="{height:''+(dialogGeo.height - 25)+'px'}"></div>
  <div id="kicadhelperRight" @mousedown.prevent="rightDown" :style="{height:''+(dialogGeo.height - 25)+'px', left:''+(dialogGeo.width-5)+'px'}"></div>
  <div id="kicadhelperBottom" @mousedown.prevent="bottomDown" :style="{top:''+(dialogGeo.height-10)+'px'}"></div>

  <el-tag style="float:left;" size='small' effect="dark"> LC-KiCad{{tr[' Converter']}} {{tr[mode]}}{{tr[' Mode']}}</el-tag>
  <el-button style="float:left; " size='mini' type="success" title="Download selected component" @click="download">{{tr['Download']}}</el-button>
  <el-button style="float:right; " size='mini' icon="el-icon-close" @click="()=>$toggleVisible()"/>
  <a :href="tr['http://lckicad-en.xtoolbox.org']" style="float:right;" target="_blank">{{tr['Help']}}</a>

  <el-progress :text-inside="true" style="margin-top:2px;" :stroke-width="20" v-if="progress>0 && progress<100" :percentage="progress" status="success"></el-progress>
  <el-table
    ref='theRef'
    :data="tableData"
    :height="dialogGeo.height - 40"
    border
    class="kh-event-table"
    :empty-text="tr['Open component list']+'. ' + tr['Use [Ctrl]+[Left Click] to select item'] + '. ' + tr['If [Ctrl]+[Click] not works, retry after refresh page']"
    :style="{width:''+(dialogGeo.width-5)+'px'}">
    <el-table-column
      prop="symbol"
      :label="tr['Symbol']"
      :width="(dialogGeo.width-10)/3.5">
        <template #default="scope">
          <el-tag size="mini" effect="dark">
            {{scope.row.symbol?(scope.row.symbol.display_title||scope.row.symbol.title):"<none>"}}
          </el-tag>
        </template>
    </el-table-column>
    <el-table-column
      prop="footprint"
      :label="tr['Footprint']"
      :width="(dialogGeo.width-10)/3.5">
        <template #default="scope">
          <el-tag size="mini" effect="dark">
            {{scope.row.footprint?(scope.row.footprint.display_title||scope.row.footprint.title):"<none>"}}
          </el-tag>
        </template>
    </el-table-column>
    <el-table-column
      prop="model3d"
      :label="tr['3D Model']"
      :width="(dialogGeo.width-10)/3.5">
        <template #default="scope">
          <el-button v-if="scope.row.data3d" size='mini' type="success" @click="()=>preview3D(scope.row)">
            {{scope.row.model3d?(scope.row.model3d.display_title||scope.row.model3d.title):"<none>"}}
          </el-button>
          <el-tag v-else size="mini" effect="dark">
            {{scope.row.model3d?(scope.row.model3d.display_title||scope.row.model3d.title):"<none>"}}
          </el-tag>
        </template>
    </el-table-column>
    <el-table-column
    :width="(dialogGeo.width-10)/8">
      <template #default="scope">
        <el-button size="mini" type="danger" icon="el-icon-delete" circle @click.prevent="removeRow(scope.$index, scope.row)">

        </el-button>
      </template>
    </el-table-column>
  </el-table>
  </div>
  <el-dialog
    title="3D Preview"
    v-model='show3D'
    width="40%" :destroy-on-close="false">
    <chip-view :rowData="rowData" :isVRML='false'/>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, getCurrentInstance, onMounted, ref } from 'vue';
import {toggleVisible, initStd, loadDlgSetting, saveDlgSetting, DialogGeo_t, defSetting,
  CompRow_t,
  getStdComponent
} from './inst'
import ChipView from './components/ChipView.vue'
import { getProComponent, initPro } from './jlcpro';
import {downloadData} from './convert'
import { transTable, setup_language } from './language/lang';

interface JLCComp_t
{
  docType:number
  title:string
  dataStr:{
    head?:{
      uuid_3d?:string
      puuid?:string
    }
    BBox?:{
      x:number
      y:number
      width:number
      height:number
    }
    shape?:string[]
  }
  subparts?:JLCComp_t[]
  szlcsc?:{
    number:string
    url:string
  }
  packageDetail?:JLCComp_t
}

export default defineComponent({
  name: 'App',
  components: {
    ChipView,
  },
  setup(props, context){
    let chTable = JSON.parse(JSON.stringify(transTable));
    let tr = ref(transTable);
    let count = ref(0);
    let show3D = ref(false);
    let mode = ref<'Std'|'Pro'>("Std");
    let dialogGeo = ref<DialogGeo_t>(defSetting);
    let resizing = ref(false);
    let rowData = ref<CompRow_t>();
    let theRef = ref(null);
    loadDlgSetting().then((res)=>{
      dialogGeo.value = res;
    });

    let tableData = ref<CompRow_t[]>([]);
    if(document.URL.includes('pro.lceda.cn')){
      mode.value = "Pro";
    }

    toggleVisible(()=>{
      dialogGeo.value.visible = !dialogGeo.value.visible;
      saveDlgSetting(dialogGeo.value);
    })

    onMounted(()=>{
      if(mode.value == 'Std'){
        initStd((uuid)=>{
          if(uuid && dialogGeo.value.visible){
            getStdComponent(uuid, tableData.value);
          }
        });
      }else{
        initPro((uuid, isDevice)=>{
          if(uuid && dialogGeo.value.visible){
            getProComponent(uuid, tableData.value, isDevice?true:false);
          }
        })
      }

/*
      let xx = (theRef.value as any).$el as HTMLElement;
      let col = xx.getElementsByClassName('el-table__empty-text');
      if(col.length > 0){
        col[0].innerHTML = 
        "<b>"+ tr.value['Open component list']+"</b><br>"
        +"<b>" + tr.value['Use [Ctrl]+[Left Click] to select item']+"</b>";
      }
*/
      setup_language((loc:string)=>{
        for(let key in transTable){
          let v = loc=='ch'?chTable[key]:key;
          tr.value[key] = v;
        }
      })
    })

    function removeRow(index:number,info:CompRow_t){
      tableData.value.splice(index, 1);
    }

    let lastX = 0;
    let lastY = 0;
    let curGeo = {
      x:0,y:0,width:0,height:0
    }

    function moveDialog(e:MouseEvent){
      let dx = e.screenX - lastX;
      let dy = e.screenY - lastY;
      dialogGeo.value.x = curGeo.x + dx;
      dialogGeo.value.y = curGeo.y + dy;
    }

    function resizeDialogL(e:MouseEvent){
      let dx = e.screenX - lastX;
      let dy = e.screenY - lastY;
      dialogGeo.value.x = curGeo.x + dx;
      dialogGeo.value.width = curGeo.width - dx;
    }
    
    function resizeDialogR(e:MouseEvent){
      let dx = e.screenX - lastX;
      let dy = e.screenY - lastY;
      dialogGeo.value.width = curGeo.width + dx;
    }

    function resizeDialogH(e:MouseEvent){
      let dx = e.screenX - lastX;
      let dy = e.screenY - lastY;
      dialogGeo.value.height = curGeo.height + dy;
    }

    function initGeoChange(e:MouseEvent){
      lastX = e.screenX; lastY = e.screenY;
      curGeo.x = dialogGeo.value.x;
      curGeo.y = dialogGeo.value.y;
      curGeo.width = dialogGeo.value.width;
      curGeo.height = dialogGeo.value.height;
      resizing.value = true;
    }

    function titleDown(e:MouseEvent){
      document.onmousemove = moveDialog;
      initGeoChange(e);
      document.onmouseup = ()=>{
        document.onmousemove = null;
        document.onmouseup = null;
        resizing.value = false;
        saveDlgSetting(dialogGeo.value);
      }
    }
    function leftDown(e:MouseEvent){
      document.onmousemove = resizeDialogL;
      initGeoChange(e);
      document.onmouseup = ()=>{
        document.onmousemove = null;
        document.onmouseup = null;
        resizing.value = false;
        saveDlgSetting(dialogGeo.value);
      }
    }
    function rightDown(e:MouseEvent){
      document.onmousemove = resizeDialogR;
      initGeoChange(e);
      document.onmouseup = ()=>{
        document.onmousemove = null;
        document.onmouseup = null;
        resizing.value = false;
        saveDlgSetting(dialogGeo.value);
      }
    }
    function bottomDown(e:MouseEvent){
      document.onmousemove = resizeDialogH;
      initGeoChange(e);
      document.onmouseup = ()=>{
        document.onmousemove = null;
        document.onmouseup = null;
        resizing.value = false;
        saveDlgSetting(dialogGeo.value);
      }
    }

    function preview3D(data:CompRow_t){
        rowData.value = data;
        show3D.value = true;
    }

    let progress = ref(0);
    function download(){
      downloadData(dialogGeo.value.prefix, tableData.value, (percent)=>{
        progress.value = percent;
      });
    }

    function showHelp(){
      setTimeout(()=>{
        let w = window.open("http://lckicad.xtoolbox.org");
      },100);
    }

    return {count, mode, tableData, removeRow, dialogGeo, progress,theRef,
    titleDown, leftDown, rightDown, bottomDown, show3D, preview3D,
    rowData, resizing, download, showHelp, tr}
  },
});
</script>

<style>
#kicadhelperButton{
  float:right
}
#kicadhelperDialogMask{
  background-color:  #00000000;
  position: fixed;
  z-index:99;
  top:0px;
  left: 0px;
  width: 100vw;
  height:100vh;
}
#kicadhelperDialog{
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;

  margin-top: 5px;
  padding-left: 5px;
  background-color:  #b4cfeb;
  position: fixed;
  top:0px;
  left: 70vw;
  width: 30vw;
  height:100vh;
  z-index:100;
}
#kicadhelperTitle{
  margin-top: 5px;
  top:0px;
  left: 0px;
  width: 100%;
  height:20px;
  background-color:  #ffffff00;
  position: absolute;
  z-index: -1;
  cursor: move;
}
#kicadhelperLeft{
  margin-top: 5px;
  padding-left: 5px;
  top:20px;
  left: 0px;
  width: 5px;
  background-color:  #ffffff00;
  position: absolute;
  z-index: -1;
  cursor: e-resize;
}
#kicadhelperRight{
  margin-top: 5px;
  padding-left: 5px;
  top:20px;
  left: 0px;
  width: 5px;
  background-color:  #ffffff00;
  position: absolute;
  z-index: -1;
  cursor: e-resize;
}

#kicadhelperBottom{
  left: 0px;
  width: 100%;
  height: 10px;
  background-color: #ffffff00;
  position: absolute;
  z-index: -1;
  cursor: n-resize;
}

#kicadhelperContent{
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>

<style scoped>
button{
  min-width: 0px;
}
::v-deep .el-input__inner{
    padding: 0 1px;
}
</style>

<style>
@font-face{
  font-family:element-icons;
  src:url('chrome-extension://__MSG_@@extension_id__/fonts/element-icons.woff') format("woff"),url('chrome-extension://__MSG_@@extension_id__/fonts/element-icons.ttf') format("truetype");
  font-weight:400;
  font-display:auto;
  font-style:normal}
</style>

<style>
.kh-event-table .el-table__body td {
  padding-top: 1px;
    padding-right: 0px;
    padding-bottom: 1px;
    padding-left: 0px;
}
</style>

