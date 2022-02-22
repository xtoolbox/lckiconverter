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

// lceda symbol/footprint format: https://docs.easyeda.com/en/DocumentFormat/2-EasyEDA-Schematic-File-Format/
// kicad symbol/footprint format: https://www.compuphase.com/electronics/LibraryFileFormats.pdf

export enum JLCDocType{
    Symbol = 2,
    Footprint = 4,
    SubSymbol = 6,
    Model3D = 16,
}

export interface JLCDevice_t // device in pro mode
{
    attributes:any
    symbol?:{
        uuid?:string
    }
    footprint?:{
        uuid?:string
    }
}

export interface BBox_t
{
    x:number
    y:number
    width:number
    height:number
}

export interface ParsedData
{
    name:string
    fields:{key:string,value:string}[]
    pins:{[key:string]:string}
}

export interface JLCComp_t
{
    docType:JLCDocType
    title:string
    display_title?:string
    uuid:string
    ['3d_model_uuid']?:string
    dataStr:{
        head?:{
            uuid_3d?:string
            puuid?:string
            uuid?:string
            url?:string
            x:number
            y:number
        }
        BBox?:BBox_t
        shape?:string[]
        layers?:string[]
    }|string
    subparts?:JLCComp_t[]
    szlcsc?: {
        id:number
        number:string
        url:string
    }
    model_3d?:{
        uri:string
        title:string
        transform:string
    }
    packageDetail?:JLCComp_t
    device?:JLCDevice_t      // pro component link to it's device
    parsedData?:ParsedData
    datasheetUrl?:string
    itemUrl?:string
}
