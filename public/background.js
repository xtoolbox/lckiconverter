
chrome.runtime.onInstalled.addListener(() => {
  console.log("Kicad helper installed");
  /*
  let id = chrome.contextMenus.create({
    contexts:['page','frame'],
    documentUrlPatterns:['https://lceda.cn/*'],
    id:'view3d',
    title:'View 3D model',
  })
  */
  //console.log("view 3d menu id ", id);

});

/*
chrome.browserAction.onClicked.addListener(function(tab) {
  console.log("browserAction.onClicked", tab);
  chrome.tabs.sendMessage(tab.id, JSON.stringify({
      command: 'beginUI'
  }), function(msg) {
      chrome.tabs.executeScript(tab.id, {
          file: 'js/app.js',
          allFrames: false
      })
  });
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  var msg = JSON.parse(message);
  console.log(msg);
});
*/
//console.log("xxxx", XMLHttpRequest);

function loadSynchronously(url){
  content = JSON.stringify(chrome) + url;
  return content;
  /*
  let xr = new chrome.browserAction.XMLHttpRequest();
  xr.open('GET', url, false);
  xr.send();
  let resp = xr.response;
  return resp;
  */
}

if(false){
chrome.webRequest.onBeforeRequest.addListener((details)=>{
  var javascriptCode = loadSynchronously(details.url);
  // [TODO] hook something you like
  return {redirectUrl: chrome.extension.getURL('inject.js')};
  //return { redirectUrl: "data:text/javascript," 
  //                     + encodeURIComponent(javascriptCode) };
},
{ urls: ["https://*.lceda.cn/*/ui.js"],
types:['script'] },
['blocking']
)
}