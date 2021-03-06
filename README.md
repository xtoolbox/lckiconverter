# LCKiConverter

<p align="center">
  <a href="https://github.com/vuejs/vue">
    <img src="https://img.shields.io/badge/Vue-3.x-brightgreen.svg" alt="vue">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-4.x-brightgreen.svg" alt="TypeScript">
  </a>
  <a href="https://github.com/element-plus/element-plus">
    <img src="https://img.shields.io/badge/Element--Plus-1.x-brightgreen" alt="element-plus">
  </a>
   <a href="https://github.com/npm/npm">
    <img src="https://img.shields.io/badge/npm-6.x-brightgreen" alt="npm">
   </a>
   <a href="https://github.com/xtoolbox/lckiconverter/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT">
  </a>
</p>


一个将lceda.cn的器件转换为KiCad格式的浏览器扩展. 可以转换原理图库，封装库以及3D模型。

A browser extension to convert component in lceda.cn (aka easyeda.com) to KiCad format. Support symbol library, footprint module and 3d model.

## 如何使用 How to use
[从Chrome应用商店添加.](https://chrome.google.com/webstore/detail/lckiconverter/lbgkkidccknjbofkefinfempaamjcmhb)

[Add from Chrome app store.](https://chrome.google.com/webstore/detail/lckiconverter/lbgkkidccknjbofkefinfempaamjcmhb)

[从Edge应用商店添加.](https://microsoftedge.microsoft.com/addons/detail/lckiconverter/fmebjbgbgkgpogefaogfpdmfemlpnpaa)

[Add from Edge app store.](https://microsoftedge.microsoft.com/addons/detail/lckiconverter/fmebjbgbgkgpogefaogfpdmfemlpnpaa)
## 运行环境 Run Environmnet

Chrome, Edge

## 如何编译 How To Build
确保Node.js已经安装，然后运行下面的命令。npm可以使用cnpm代替。

Ensure Node.js installed.
```bat
git clone https://github.com/xtoolbox/lckiconverter.git
cd lckiconverter
npm install
npm run build
```
使用浏览器的开发者模式安装dist目录中的内容。

Install the dist folder in Chrome/Edge in developer mode



