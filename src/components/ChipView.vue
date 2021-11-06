<template>
    <div id="container">
    </div>
    <!--el-button @click="exportStl">export</el-button-->
</template>
<script lang="ts">
import { defineComponent, onMounted, PropType, toRefs, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {VRMLLoader} from 'three/examples/jsm/loaders/VRMLLoader'
import { CompRow_t } from '@/inst'
import ObjMtlParse from '@/ObjMtlLoader'
import {STLExporter} from 'three/examples/jsm/exporters/STLExporter'
import { Camera } from 'three'

export default defineComponent({
    props:{
        rowData:{
            type: Object as PropType<CompRow_t>, required:false
        },
        isVRML:Boolean,
    },
    setup(props) {
        let {rowData, isVRML} = toRefs(props);
        let doExportStl = ()=>{};
        let scene = new THREE.Scene();
        let model:any;
        let camera:Camera;
        let controls:OrbitControls;

        function reloadModel(){
            if(model){
                scene.remove(model);
                model = undefined;
            }
            if(rowData.value && rowData.value.data3d){
                controls?.reset();
                model = isVRML.value ? (new VRMLLoader()).parse(rowData.value.data3d,"") : ObjMtlParse(rowData.value.data3d);
                scene.add(model);

                if(camera instanceof THREE.PerspectiveCamera){
                    let bbox = new THREE.Box3().setFromObject(model);
                    let tcamera = camera as THREE.PerspectiveCamera;
                    let h = bbox.max.y - bbox.min.y;
                    let dist = h / (2 * Math.tan(tcamera.fov * Math.PI / 360));
                    //console.log(scene.position);
                    let pos = scene.position;
                    tcamera.position.set(pos.x, pos.y-dist*2, dist * 2);
                    tcamera.lookAt(pos);
                }
            }
        }

        watch(rowData,()=>{
            //console.log("row change");
            reloadModel();
        });

        onMounted(()=>{
            //console.log("mounted");
            //let model:any;

            if(rowData.value && rowData.value.data3d){
                //model = ObjMtlParse(rowData.value.data3d);
                model = isVRML.value ? (new VRMLLoader()).parse(rowData.value.data3d,"") : ObjMtlParse(rowData.value.data3d);
                scene.add(model);
            }else{
                const geometry = new THREE.BoxGeometry(120, 120, 2);
                const material = new THREE.MeshLambertMaterial({
                    color: 0xe1e1e1
                });
                let mesh = new THREE.Mesh(geometry, material);
                model = mesh;
                scene.add(mesh);
            }

            const point = new THREE.PointLight(0xffffff)
            point.position.set(400, 200, 300);
            scene.add(point);

            const ambient = new THREE.AmbientLight(0x7f7f7f)
            scene.add(ambient)

            let element = document.getElementById('container') || {} as any;
            let width = element.clientWidth;
            let height = element.clientHeight;
            if(width < 300) width = 300;
            if(height<300) height = 300;

            const k = width / height;
            const s = 200;
            // OrthographicCamera(left, right, top, bottom, near, far)

            if(model){
                let bbox = new THREE.Box3().setFromObject(model);
                let tcamera = new THREE.PerspectiveCamera(10, width / height, 0.1, 1000);
                let h = bbox.max.y - bbox.min.y;
                let dist = h / (2 * Math.tan(tcamera.fov * Math.PI / 360));
                let pos = scene.position;
                tcamera.position.set(pos.x, pos.y-dist*2, dist * 2);
                tcamera.lookAt(pos);
                camera = tcamera;

            }else{
                camera = new THREE.OrthographicCamera(-s * k, s * k, s, -s, 1, 1000);
                camera.position.set(200, 300, 200);
                camera.lookAt(scene.position);
            }

            let renderer = new THREE.WebGLRenderer();
            renderer.setSize(width, height);
            renderer.setClearColor(0x3f3f3f, 1);
            element.appendChild(renderer.domElement);

            controls = new OrbitControls(camera, renderer.domElement);

            function render(){
                renderer.render(scene, camera);
                requestAnimationFrame(render);
            }

            doExportStl = ()=>{
                let exp = new STLExporter();
                let str = exp.parse(scene);
                var blob = new Blob( [str], { type : 'text/plain' } );
                let link = document.createElement('a');
                link.style.display = 'none';
                document.body.appendChild(link);
                link.href = URL.createObjectURL(blob);
                link.download = 'Scene.stl';
                link.click();
            }

            render();
        });

        function exportStl(){
            doExportStl();
        }

        return {exportStl}
    },
})
</script>

<style>
#container {
  min-height: 300px;
  min-width: 300px;
  width: 100%;
  height: 100%;
}
</style>