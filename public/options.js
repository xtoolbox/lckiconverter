const defSetting = {
  x:400, y:0, width:400, height:400, visible:false, prefix:"kicad_lceda"
};

function saveSetting(){
    let set = {
      x:Number(document.getElementById('posX').value),
      y:Number(document.getElementById('posY').value),
      width:Number(document.getElementById('posW').value),
      height:Number(document.getElementById('posH').value),
      visible:document.getElementById('Visible').checked,
      prefix:document.getElementById("prefix").value
    }
    chrome.storage.sync.set(set);
    console.log("save set", set);
}

function loadSetting(){
    chrome.storage.sync.get(defSetting, (data) => {
        document.getElementById('posX').value = data.x;
        document.getElementById('posY').value = data.y;
        document.getElementById('posW').value = data.width;
        document.getElementById('posH').value = data.height;
        document.getElementById('Visible').checked = data.visible;
        document.getElementById('prefix').value = data.prefix;
    });
}

document.getElementById("btnSave").onclick = ()=>{
  saveSetting();
}
loadSetting();
