let obj = require('./test_obj');
let vrml = require('./test_vrml');
let pro_symbol = require('./test_pro_symbol');
let pro_footprint = require('./test_pro_footprint');
let std_symbol = require('./test_std_symbol');
let std_footprint = require('./test_std_footprint');
// test case for small negative value
let std_footprint_sn = require('./test_std_footprint_small_neg');
// test case for oval drill
let std_fp_oval_drill = require('./test_std_footprint_oval_drill');

function getTestData(){
    return {
        obj: obj.data,
        vrml:vrml.data,
        test_case:[
            pro_symbol,
            pro_footprint,
            std_symbol,
            std_footprint,
            std_footprint_sn,
            std_fp_oval_drill,
        ]
    }
}
window.getTestData = getTestData
module.exports.getTestData
