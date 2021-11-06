let obj = require('./test_obj');
let vrml = require('./test_vrml');
let pro_symbol = require('./test_pro_symbol');
let pro_footprint = require('./test_pro_footprint');
let std_symbol = require('./test_std_symbol');
let std_footprint = require('./test_std_footprint');

function getTestData(){
    return {
        obj: obj.data,
        vrml:vrml.data,
        test_case:[
            pro_symbol,
            pro_footprint,
            std_symbol,
            std_footprint,
        ]
    }
}
window.getTestData = getTestData
module.exports.getTestData
