var crypto = require("crypto")
  , sha1sum = crypto.createHash('sha1');
var moment = require("moment");
var osc = require('node-osc');
var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database("test.db");
var d3 = require("d3");
var async = require('async');


var oscServer = new osc.Server(3000, '0.0.0.0'); 
var oscClient = new osc.Client('127.0.0.1', 3002);
var oscClient2 = new osc.Client('127.0.0.1', 3003);
var fps = 30;

function namedIs() {
  if(process.argv[3] == undefined) {
    console.log("data name not set.");
    process.exit();
  }
  return process.argv[3];
}

function getRandomInt(min, max) {
  return Math.floor( Math.random() * (max - min + 1) ) + min;
}

function dummyArray() {
  var ret = [];
  for (var i = 0; i < 35; i ++) {
    ret.push(getRandomInt(200, 1000));
  }
  return ret;
}


function degreeA(x1, y1, x2, y2, x3, y3, x4, y4) {
 return ( ( ( (x1 * y2) + (x2 * y3) + (x3 * y4) + (x4 * y1) ) - ( (x2 * y1) + (x3 * y2) + (x4 * y3) + (x1 * y4) ) ) / 2.0 )
}

function degreeI(leftX, rightY) {
  return rightY - leftX
}

function degreeO(upY, downY) {
  return upY - downY
}

function absStats(xs, ys) {
  var ret = [];
  for(var i = 0; i < 36; i ++) {
    ret[i] = Math.sqrt( (xs[i] * xs[i]) + (ys[i] * ys[i]) );
  }
  return ret;
}

function absStatsAndAmp(xs, ys) {
  var ret = [];
  for(var i = 0; i < 36; i ++) {
    ret.push(i * 400 );
    ret.push( scale(Math.sqrt( (xs[i] * xs[i]) + (ys[i] * ys[i]))) );
  }
  return ret;
}

function multipleArray(arr, coef) {
  var ret = [];
  for(var i = 0; i < 36; i ++) {
    ret[i] = arr[i] * i * 0.2;
  }
  return ret;
}



function setScale(scales, domains, rangeStart, rangeEnd) {

  for(var i = 0; i < 36; i ++) {
    scales[i] = d3.scale.linear().domain([domains[i][0], domains[i][1]]).range([rangeStart, rangeEnd]);
  }
}

function scaleDatas(scales, datas) {
  var ret = [];
  for(var i = 0; i < 36; i ++) {
    ret.push(scales[i](datas[i]));

  }
  return ret;
}

function getMinAndMax(datases, count) {
  datases.sort(function(a, b) {
      var x = a[count];
      var y = b[count];
      if (x > y) return 1;
      if (x < y) return -1;
      return 0;
  });

  return [datases[0][count], datases[datases.length - 1][count]];
}

function parseDatas(datas, target) {
  var ret = [];
  for(var i = 0; i < datas.length; i ++) {
    ret.push(datas[i][target]);
  }
  return ret;
}


/*:: :::::::::::::::::::::::::::: */
// process 
/*:: :::::::::::::::::::::::::::: */

if(process.argv[2] == "capture") {
  var name = namedIs();

  oscServer.on("message", function (msg, rinfo) { 
    var stmt = db.prepare('INSERT INTO facedata (name, x, y) VALUES (?, ?, ?)');
    stmt.run(
      name,
      JSON.stringify(msg[2]),
      JSON.stringify(msg[3])
    );
    stmt.finalize();
  });
}

/* TODO: refactering */
if(process.argv[2] == "fire") {
  var name = namedIs();
  var datas = [];
  var rangesY = [];
  var rangesX = [];
  var scalesY = [];
  var scalesX = [];
  var count = 0;


  async.series([
    function (callback) {
      db.each("SELECT * FROM facedata where name = '"+ name + "'", function (err, row) {
        if (err) {
      
        } else {
            var data = {};
            data.x = JSON.parse(row.x);
            data.y = JSON.parse(row.y);
            data.x.shift();
            data.y.shift();
            datas.push(data);
        }
      }, function (err, count) {  
        if (err) {
        } else {
            if (count == 0) {
                
            } else {
              callback(null, "first");       
            }
        }
      });
    },
    function (callback) {
      var ys = parseDatas(datas, "y");
      var xs = parseDatas(datas, "x");
      for (var i = 0; i < ys[0].length; i ++) {
        rangesY.push(getMinAndMax(ys, i));
      }
      for (var i = 0; i < xs[0].length; i ++) {
        rangesX.push(getMinAndMax(xs, i));
      }
  
      setScale(scalesY, rangesY, 0.0, 0.03);
      setScale(scalesX, rangesX, 300, 5000);
  
      callback(null, "second");
    },
    function (callback) {
      setInterval( function () {
        if(datas.length > count) {
          oscClient.send('/x', datas[count].x);
          oscClient.send('/y', datas[count].y);

          oscClient2.send('/x', scaleDatas(scalesX, datas[count].x));
          oscClient2.send('/y', scaleDatas(scalesY, datas[count].y));

          // oscClient2.send('/abs', absStatsAndAmp(datas[count].x, datas[count].y));

          // oscClient2.send('/properties', 
          //   degreeA(
          //     datas[count].x[15], datas[count].y[15], 
          //     datas[count].x[18], datas[count].y[18], 
          //     datas[count].x[16], datas[count].y[16], 
          //     datas[count].x[19], datas[count].y[19]
          //   ), 
          //   degreeI(datas[count].x[15], datas[count].x[16]),
          //   degreeO(datas[count].y[18], datas[count].y[19]) 
          // )

          count += 1;
        } else {
          process.exit();
        }
      }, 1000 / fps);

      callback(null, "third");
    }
  ], function (err, results) {
    if (err) {
        throw err;
    }
    console.log('series all done. ' + results);
  });  
}



// if(process.argv[2] == "testcapture") {
//   var name = namedIs();

//   setInterval( function() {
//     var stmt = db.prepare('INSERT INTO facedata (name, x, y) VALUES (?, ?, ?)');
//     stmt.run(
//       name,
//       JSON.stringify(dummyArray()),
//       JSON.stringify(dummyArray())
//     );
//     stmt.finalize();

//   }, 1000 / fps);
// }

if(process.argv[2] == "create") {
  db.serialize(function () {
    db.run("CREATE TABLE facedata (id integer primary key autoincrement, name STRING, x TEXT, y TEXT)");
    db.close();
  });
}



