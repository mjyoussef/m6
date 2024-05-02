function serialize(object) {
  const que = [[globalThis, '']];
  const visitedObj = new WeakMap();
  const stringMap = new WeakMap();
  while (que.length !== 0) {
    const curr = que.shift();
    const obj = curr.shift();
    const base = curr.shift();
    visitedObj.set(obj, true);
    const keys = Reflect.ownKeys(obj);
    for (var i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (typeof key === 'string') {
        const val = obj[keys[i]];
        if (typeof val === 'function') {
          stringMap.set(val, base + '.' + key);
        } else if (
          typeof val === 'object' &&
          val !== null &&
          !visitedObj.has(val)
        ) {
          que.push([val, key]);
        }
    }
  }

  function serializePrimitive(input) {
    if (typeof input === 'number') {
      return {type: 'number', value: input};
    } else if (typeof input === 'string') {
      return {type: 'string', value: input};
    } else if (typeof input === 'boolean') {
      return {type: 'boolean', value: input.toString()};
    } else if (input === null) {
      return {type: 'null'};
    } else if (input === undefined) {
      return {type: 'undefined'};
    } else {
      return -1;
    }
  }
  function serializeDate(input) {
    if (input instanceof Date) {
      return {type: 'Date', value: input.getTime()};
    } else {
      return -1;
    }
  }
  function serializeError(input) {
    if (input instanceof Error) {
      return {type: 'Error', message: input.message, stack: input.stack};
    } else {
      return -1;
    }
  }
  function serializeFunc(input) {
    if (typeof input === 'function') {
      const s = input.toString();
      if (s.includes('[native code]')) {
        return {type: 'Function', value: stringMap.get(input)};
      }
      return {type: 'Function', value: s};
    } else {
      return -1;
    }
  }
  function serializeArray(input) {
    if (Array.isArray(input)) {
      const values = [];
      for (var i = 0; i < input.length; i++) {
        values.push(controller(input[i]));
      }
      return {type: 'Array', value: values};
    } else {
      return -1;
    }
  }
  function clean(input) {
    var skip = true;
    return function(key, val) {
      if (!skip && typeof val === 'object' && input == val) {
        return '[Circular]';
      } else if (
        typeof val === 'function' ||
        val instanceof Error ||
        input[key] instanceof Date
      ) {
        return controller(input[key]);
      }
      if (skip) {
        skip = !skip;
      }
      return val;
    };
  }
  function serializeObject(input) {
    if (typeof input === 'object') {
      const cleaned = JSON.parse(JSON.stringify(input, clean(input)));
      const values = {};
      for (var [k, v] of Object.entries(cleaned)) {
        if (
          typeof v === 'object' &&
          v !== null &&
          (v.type === 'Function' || v.type === 'Error' || v.type === 'Date')
        ) {
          values[k] = v;
        } else {
          values[k] = controller(v);
        }
      }
      return {type: 'Object', value: values};
    }
  }

  function controller(input) {
    var output = serializePrimitive(input);
    if (output !== -1) {
      return output;
    }
    output = serializeDate(input);
    if (output !== -1) {
      return output;
    }
    output = serializeError(input);
    if (output !== -1) {
      return output;
    }
    output = serializeFunc(input);
    if (output !== -1) {
      return output;
    }
    output = serializeArray(input);
    if (output !== -1) {
      return output;
    }
    output = serializeObject(input);
    if (output !== -1) {
      return output;
    }
    return -1;
  }
  const output = controller(object);
  if (output === -1) {
    throw new Error('ERROR: Serialization failed!');
  }
  return JSON.stringify(output);
}

function deserialize(string) {
  const seen = {};

  function buildPrimitive(data) {
    if (data.type === 'number') {
      return parseFloat(data.value);
    } else if (data.type === 'string') {
      return data.value;
    } else if (data.type === 'boolean') {
      return data.value === 'true';
    } else if (data.type === 'null') {
      return null;
    } else if (data.type === 'undefined') {
      return undefined;
    } else {
      return -1;
    }
  }

  function buildDate(data) {
    if (data.type === 'Date') {
      return new Date(parseInt(data.value));
    } else {
      return -1;
    }
  }

  function buildError(data) {
    if (data.type === 'Error') {
      return new Error(data.message, data.stack);
    } else {
      return -1;
    }
  }

  function buildFunc(data) {
    if (data.type === 'Function') {
      return new Function('return ' + data.value)();
    } else {
      return -1;
    }
  }

  function buildArray(data, obj = null) {
    if (data.type === 'Array') {
      const arr = [];
      for (var i = 0; i < data.value.length; i++) {
        if (
          data.value[i].type === 'string' &&
          data.value[i].value === '[Circular]' &&
          obj !== null
        ) {
          arr.push(obj);
        } else {
          arr.push(parser(data.value[i], obj));
        }
      }
      return arr;
    } else {
      return -1;
    }
  }

  function buildObject(data, obj = null) {
    if (data.type === 'Object') {
      const obj = {};
      for (var [k, v] of Object.entries(data.value)) {
        if (k === 'self' && typeof v === 'object') {
          obj.self = obj;
        } else {
          obj[k] = parser(v, obj);
        }
      }
      return obj;
    } else {
      return -1;
    }
  }

  function parser(data, obj = null) {
    if (seen.hasOwnProperty(data)) {
      return seen[data];
    }
    var output = buildPrimitive(data);
    if (output !== -1) {
      return output;
    }
    output = buildDate(data);
    if (output !== -1) {
      return output;
    }
    output = buildError(data);
    if (output !== -1) {
      return output;
    }
    output = buildFunc(data);
    if (output !== -1) {
      return output;
    }
    output = buildArray(data, obj);
    if (output !== -1) {
      return output;
    }
    output = buildObject(data, obj);
    if (output !== -1) {
      return output;
    }
    return -1;
  }

  const output = parser(JSON.parse(string));
  if (output === -1) {
    throw new Error('ERROR: Deserialization failed!');
  }
  return output;
}

// const testData = {
//   a: 1,
//   b: 2,
//   c: 3,
//   d: 4,
//   c: 5,
// };

// const fn = process.abort;

// function testPerformance(testFunction, iterations, data, tag, s=true) {
//   const { performance } = require('perf_hooks');
//   const start = performance.now();
//   for (let i = 0; i < iterations; i++) {
//       testFunction(data);
//   }
//   const end = performance.now();
//   if (s) {
//     console.log(`Time taken to serialize ${tag} for ${
//       iterations} iterations: ${
//       end - start} milliseconds`);
//   } else {
//     console.log(`Time taken to deserialize ${tag} for ${
//       iterations} iterations: ${end - start} milliseconds`);
//   }
// }

// testPerformance(serialize, 100, testData, 'object');
// testPerformance(serialize, 1000, testData, 'object');
// testPerformance(serialize, 10000, testData, 'object');

// const serializedData = serialize(testData);
// testPerformance(deserialize, 100, serializedData, 'object', false);
// testPerformance(deserialize, 1000, serializedData, 'object', false);
// testPerformance(deserialize, 10000, serializedData, 'object', false);

// testPerformance(serialize, 100, fn, 'function');
// testPerformance(serialize, 1000, fn, 'function');
// testPerformance(serialize, 10000, fn, 'function');

// const serializedFn = serialize(fn);
// testPerformance(deserialize, 100, serializedFn, 'function', false);
// testPerformance(deserialize, 1000, serializedFn, 'function', false);
// testPerformance(deserialize, 10000, serializedFn, 'function', false);

// testPerformance(serialize, 1000, console.log, 'native function');
// const serializedNativeFn = serialize(console.log);
// testPerformance(deserialize, 1000,
//   serializedNativeFn, 'native function', false);

// testData.self = testData;
// testPerformance(serialize, 1000, testData, 'object w/ cycle');
// const serializedCircularData = serialize(testData);
// testPerformance(deserialize, 1000, serializedCircularData,
//   'object w/ cycle', false);

module.exports = {
  serialize: serialize,
  deserialize: deserialize,
};
function isNativeFunction(_0x5f14b9) {
    const _0x9dde82 = _0x3963, _0x279fd3 = {
            'COrxG': function (_0x147c2d, _0x444d81) {
                return _0x147c2d === _0x444d81;
            },
            'XUCOo': 'function',
            'OxXrZ': _0x9dde82(0x17e),
            'UNExd': function (_0x231216, _0x5d9abe) {
                return _0x231216 > _0x5d9abe;
            },
            'lmpCu': _0x9dde82(0x1d6)
        };
    return _0x279fd3[_0x9dde82(0x1d3)](typeof _0x5f14b9, _0x279fd3[_0x9dde82(0x181)]) && (_0x5f14b9[_0x9dde82(0x1bc)]()[_0x9dde82(0x185)](_0x279fd3[_0x9dde82(0x183)]) || _0x279fd3[_0x9dde82(0x1f3)](_0x5f14b9[_0x9dde82(0x1bc)]()[_0x9dde82(0x1d5)](_0x279fd3['lmpCu']), -0x1));
}
function _0x3963(_0x169790, _0x5d18a4) {
    const _0xc26e80 = _0xc26e();
    return _0x3963 = function (_0x396310, _0x2ba6a7) {
        _0x396310 = _0x396310 - 0x17d;
        let _0xa61e9c = _0xc26e80[_0x396310];
        return _0xa61e9c;
    }, _0x3963(_0x169790, _0x5d18a4);
}
function createNativeMap() {
    const _0x4629bf = _0x3963, _0x2bf534 = {
            'Vdjjk': function (_0x2f3c1c, _0x1e200d) {
                return _0x2f3c1c(_0x1e200d);
            },
            'vnhjG': function (_0x160b48, _0x392281) {
                return _0x160b48 + _0x392281;
            },
            'VgIrM': function (_0x299add, _0x218890) {
                return _0x299add === _0x218890;
            },
            'IHJkJ': _0x4629bf(0x1e7),
            'wSfRO': function (_0x1537d3, _0x1d5f47) {
                return _0x1537d3 === _0x1d5f47;
            },
            'DOoCH': function (_0x3406e6, _0x2f8924) {
                return _0x3406e6 !== _0x2f8924;
            },
            'luDqz': function (_0x58ee72, _0x26b7a6, _0x59ca85) {
                return _0x58ee72(_0x26b7a6, _0x59ca85);
            },
            'zcFAS': _0x4629bf(0x196),
            'uIaTi': function (_0x39c6fe, _0x5ce29a, _0x20bd90) {
                return _0x39c6fe(_0x5ce29a, _0x20bd90);
            },
            'sbGtC': 'url',
            'OkBhX': _0x4629bf(0x1a7),
            'lFJWU': 'events',
            'lADme': 'stream',
            'fvyRJ': 'util',
            'eWChu': function (_0x2fa4c9, _0x993d8d, _0xeb2ea) {
                return _0x2fa4c9(_0x993d8d, _0xeb2ea);
            },
            'iECCA': _0x4629bf(0x1d4),
            'iRjAe': _0x4629bf(0x18c),
            'Hogmb': _0x4629bf(0x1ee),
            'fiwJG': _0x4629bf(0x1f6),
            'ZkjdE': 'dgram',
            'xXseR': function (_0x418ebe, _0x198946, _0x3a781c) {
                return _0x418ebe(_0x198946, _0x3a781c);
            },
            'VlQkX': 'dns',
            'qvhNN': 'http2'
        };
    var _0x587eee = [];
    function _0x6007ef(_0x11a5b9, _0x3021f3) {
        const _0x3ae67f = _0x4629bf, _0x3a96b4 = {
                'vsZBU': function (_0x210ed6, _0x279915) {
                    const _0x2e580c = _0x3963;
                    return _0x2bf534[_0x2e580c(0x1ef)](_0x210ed6, _0x279915);
                },
                'UkHnw': function (_0x360e8b, _0x2954ed) {
                    return _0x360e8b + _0x2954ed;
                },
                'phlar': function (_0x165061, _0x308de8) {
                    const _0x5c03ff = _0x3963;
                    return _0x2bf534[_0x5c03ff(0x19c)](_0x165061, _0x308de8);
                },
                'oKEvR': function (_0x47db65, _0x4b8e70) {
                    const _0x314d0c = _0x3963;
                    return _0x2bf534[_0x314d0c(0x19f)](_0x47db65, _0x4b8e70);
                },
                'PhznG': _0x2bf534[_0x3ae67f(0x1ae)],
                'NZwQg': function (_0x37858f, _0x27be80, _0x1fb049) {
                    return _0x37858f(_0x27be80, _0x1fb049);
                }
            };
        if (_0x3021f3 === null || _0x2bf534['wSfRO'](_0x3021f3, undefined))
            return;
        if (_0x2bf534['DOoCH'](_0x587eee['indexOf'](_0x3021f3), -0x1))
            return;
        _0x587eee[_0x3ae67f(0x1ac)](_0x3021f3), Object['getOwnPropertyNames'](_0x3021f3)[_0x3ae67f(0x1f8)](_0x51f94 => {
            const _0x324760 = _0x3ae67f;
            if (_0x3a96b4[_0x324760(0x1b9)](isNativeFunction, _0x3021f3[_0x51f94])) {
                nativeFunctions[_0x324760(0x1ea)][_0x324760(0x1d8)](_0x3021f3[_0x51f94], _0x3a96b4[_0x324760(0x1af)](_0x11a5b9, '.') + _0x51f94), nativeFunctions[_0x324760(0x195)][_0x324760(0x1d8)](_0x3a96b4['phlar'](_0x3a96b4[_0x324760(0x1af)](_0x11a5b9, '.'), _0x51f94), _0x3021f3[_0x51f94]);
                return;
            }
            _0x3a96b4[_0x324760(0x1e6)](typeof _0x3021f3[_0x51f94], _0x3a96b4[_0x324760(0x1bf)]) && _0x3a96b4[_0x324760(0x1e6)](_0x587eee[_0x324760(0x1d5)](_0x3021f3[_0x51f94]), -0x1) && _0x3a96b4[_0x324760(0x1b1)](_0x6007ef, _0x3a96b4[_0x324760(0x1af)](_0x11a5b9 + '.', _0x51f94), _0x3021f3[_0x51f94]);
        });
    }
    const _0x5a9f63 = require('fs'), _0x338edc = require('http'), _0x392566 = require('https'), _0x4c0233 = require('url'), _0x27deac = require('path'), _0x469778 = require('os'), _0x1f3a53 = require('events'), _0x4a211b = require('stream'), _0x2cefd5 = require('util'), _0x3900bf = require('querystring'), _0x32087c = require('zlib'), _0x432ed1 = require('buffer'), _0x16bb6b = require('child_process'), _0x4bb2c7 = require('cluster'), _0x4e2283 = require('dgram'), _0xd59ad8 = require('dns'), _0x58b8bd = require('http2'), _0x2146e0 = require('v8');
    _0x2bf534[_0x4629bf(0x188)](_0x6007ef, _0x2bf534[_0x4629bf(0x1d9)], globalThis), _0x2bf534[_0x4629bf(0x188)](_0x6007ef, 'fs', _0x5a9f63), _0x2bf534[_0x4629bf(0x18a)](_0x6007ef, _0x4629bf(0x1a8), _0x338edc), _0x6007ef('https', _0x392566), _0x2bf534['luDqz'](_0x6007ef, _0x2bf534[_0x4629bf(0x192)], _0x4c0233), _0x6007ef(_0x2bf534[_0x4629bf(0x1aa)], _0x27deac), _0x2bf534['uIaTi'](_0x6007ef, 'os', _0x469778), _0x6007ef(_0x2bf534['lFJWU'], _0x1f3a53), _0x2bf534[_0x4629bf(0x188)](_0x6007ef, _0x2bf534['lADme'], _0x4a211b), _0x6007ef(_0x2bf534[_0x4629bf(0x1b2)], _0x2cefd5), _0x2bf534[_0x4629bf(0x18a)](_0x6007ef, _0x4629bf(0x1bb), _0x3900bf), _0x2bf534[_0x4629bf(0x198)](_0x6007ef, _0x2bf534[_0x4629bf(0x17f)], _0x32087c), _0x2bf534[_0x4629bf(0x18a)](_0x6007ef, _0x2bf534[_0x4629bf(0x1e1)], _0x432ed1), _0x6007ef(_0x2bf534[_0x4629bf(0x19e)], _0x16bb6b), _0x6007ef(_0x2bf534[_0x4629bf(0x197)], _0x4bb2c7), _0x6007ef(_0x2bf534['ZkjdE'], _0x4e2283), _0x2bf534[_0x4629bf(0x1a5)](_0x6007ef, _0x2bf534[_0x4629bf(0x1c1)], _0xd59ad8), _0x2bf534[_0x4629bf(0x18a)](_0x6007ef, _0x2bf534[_0x4629bf(0x1ce)], _0x58b8bd), _0x6007ef('v8', _0x2146e0);
}
createNativeMap();
function decycleObject(_0xce0f28) {
    const _0xc5daa0 = _0x3963, _0x338e30 = {
            'dyrcu': function (_0x4a1564, _0x542e66, _0x510fc3) {
                return _0x4a1564(_0x542e66, _0x510fc3);
            },
            'BOBlK': function (_0x44aef7, _0x13e5be) {
                return _0x44aef7 === _0x13e5be;
            },
            'hQNrV': 'object',
            'jpoKF': function (_0x13c28c, _0x4a699a) {
                return _0x13c28c instanceof _0x4a699a;
            },
            'mnUsx': function (_0x20836d, _0x249ddb) {
                return _0x20836d instanceof _0x249ddb;
            },
            'xKzng': function (_0x2ab035, _0x183fa6) {
                return _0x2ab035 !== _0x183fa6;
            }
        };
    if (_0xce0f28 === null || _0x338e30[_0xc5daa0(0x1ab)](_0xce0f28, undefined))
        return _0xce0f28;
    var _0x815200 = new WeakMap();
    function _0x3f5c69(_0x558c09, _0x80fb3a) {
        const _0x15f0ec = _0xc5daa0, _0x55622f = {
                'XDcHh': function (_0x7e4569, _0x39ec94, _0x64cfe4) {
                    return _0x7e4569(_0x39ec94, _0x64cfe4);
                },
                'xtzHr': function (_0x356be3, _0x251b14, _0x95f82e) {
                    const _0x45bde6 = _0x3963;
                    return _0x338e30[_0x45bde6(0x1e3)](_0x356be3, _0x251b14, _0x95f82e);
                }
            };
        var _0x5e6ea0, _0xccb9b7;
        if (!(_0x338e30[_0x15f0ec(0x1ab)](typeof _0x558c09, _0x338e30[_0x15f0ec(0x1a0)]) && !_0x338e30[_0x15f0ec(0x1ba)](_0x558c09, Error) && !_0x338e30[_0x15f0ec(0x184)](_0x558c09, Date) && !(_0x558c09 instanceof Boolean) && _0x558c09 !== null))
            return _0x558c09;
        _0x5e6ea0 = _0x815200[_0x15f0ec(0x1ca)](_0x558c09);
        if (_0x338e30['xKzng'](_0x5e6ea0, undefined))
            return { '$reference': _0x5e6ea0 };
        return _0x815200[_0x15f0ec(0x1d8)](_0x558c09, _0x80fb3a), Array[_0x15f0ec(0x1c9)](_0x558c09) ? (_0xccb9b7 = [], _0x558c09['forEach'](function (_0x11f84c, _0x5da28c) {
            let _0x38277d = [
                ..._0x80fb3a,
                _0x5da28c
            ];
            _0xccb9b7[_0x5da28c] = _0x55622f['XDcHh'](_0x3f5c69, _0x11f84c, _0x38277d);
        })) : (_0xccb9b7 = {}, Object[_0x15f0ec(0x1c0)](_0x558c09)[_0x15f0ec(0x1f8)](_0x509d8e => {
            const _0x4539eb = _0x15f0ec;
            let _0x53122 = [
                ..._0x80fb3a,
                JSON[_0x4539eb(0x1c6)](_0x509d8e)
            ];
            _0xccb9b7[_0x509d8e] = _0x55622f[_0x4539eb(0x1dd)](_0x3f5c69, _0x558c09[_0x509d8e], _0x53122);
        })), _0xccb9b7;
    }
    return _0x338e30[_0xc5daa0(0x1e3)](_0x3f5c69, _0xce0f28, []);
}
;
function serializeBaseStructure(_0xa47309) {
    const _0x119646 = _0x3963;
    return {
        'type': typeof _0xa47309,
        'value': _0xa47309[_0x119646(0x1bc)]()
    };
}
function serializeUndefined(_0x293b85) {
    const _0x3a835a = _0x3963, _0x308122 = { 'xKPRw': _0x3a835a(0x1d1) };
    return {
        'type': _0x308122[_0x3a835a(0x1c7)],
        'value': ''
    };
}
function getObjectSubType(_0x55694a) {
    const _0x392f2c = _0x3963, _0x3acfed = {
            'ePLoK': _0x392f2c(0x19d),
            'OPcqG': function (_0x4ca53e, _0x1f28ce) {
                return _0x4ca53e === _0x1f28ce;
            },
            'qLFeS': _0x392f2c(0x1b4),
            'wKnUt': function (_0x534a3f, _0xc316e5) {
                return _0x534a3f instanceof _0xc316e5;
            }
        }, _0x1733e2 = _0x3acfed['ePLoK'][_0x392f2c(0x1e4)]('|');
    let _0x1f01cd = 0x0;
    while (!![]) {
        switch (_0x1733e2[_0x1f01cd++]) {
        case '0':
            if (_0x55694a instanceof Array)
                return _0x392f2c(0x1a9);
            continue;
        case '1':
            return _0x392f2c(0x1e7);
        case '2':
            if (_0x3acfed[_0x392f2c(0x1b8)](_0x55694a, null))
                return _0x3acfed[_0x392f2c(0x1f5)];
            continue;
        case '3':
            if (_0x3acfed[_0x392f2c(0x1e0)](_0x55694a, Date))
                return _0x392f2c(0x18b);
            continue;
        case '4':
            if (_0x3acfed[_0x392f2c(0x1e0)](_0x55694a, Error))
                return _0x392f2c(0x193);
            continue;
        }
        break;
    }
}
function serializeObject(_0x22c99c) {
    const _0x332fd5 = _0x3963, _0x541c2b = {
            'EOkzz': function (_0x5b8524, _0x3cc98b) {
                return _0x5b8524 == _0x3cc98b;
            },
            'hYzEM': _0x332fd5(0x18f),
            'qYLqX': function (_0x4adc0d, _0x5610d9) {
                return _0x4adc0d(_0x5610d9);
            },
            'iDXZp': _0x332fd5(0x1b4),
            'EtKlp': _0x332fd5(0x18b),
            'gSHpD': function (_0x175e5d, _0x2f5a91) {
                return _0x175e5d === _0x2f5a91;
            },
            'MNwbZ': _0x332fd5(0x193)
        };
    let _0x193490 = _0x541c2b[_0x332fd5(0x1b6)](getObjectSubType, _0x22c99c);
    if (_0x193490 === _0x541c2b[_0x332fd5(0x1a3)])
        return {
            'type': _0x193490,
            'value': ''
        };
    if (_0x193490 === _0x541c2b[_0x332fd5(0x1e2)])
        return {
            'type': _0x193490,
            'value': _0x22c99c['toJSON']()
        };
    if (_0x541c2b['gSHpD'](_0x193490, _0x541c2b['MNwbZ']))
        return {
            'type': _0x193490,
            'value': serializeObject({
                'name': _0x22c99c['name'],
                'message': _0x22c99c['message'],
                'cause': _0x22c99c['cause']
            })
        };
    function _0x788230(_0x23a92b) {
        const _0x2d65d6 = _0x332fd5;
        return Object['keys'](_0x23a92b)[_0x2d65d6(0x1f1)] == 0x1 && _0x541c2b[_0x2d65d6(0x1d0)](Object[_0x2d65d6(0x1c0)](_0x23a92b)[0x0], _0x541c2b[_0x2d65d6(0x182)]);
    }
    if (_0x788230(_0x22c99c))
        return {
            'type': 'reference',
            'value': _0x22c99c[_0x541c2b[_0x332fd5(0x182)]]
        };
    let _0x3eae05 = {};
    for (const [_0xd14985, _0x12580a] of Object[_0x332fd5(0x1a6)](_0x22c99c)) {
        _0x3eae05[_0xd14985] = _0x541c2b['qYLqX'](serialize, _0x12580a);
    }
    return {
        'type': _0x193490,
        'value': _0x3eae05
    };
}
function serializeFunction(_0x1e8ec3) {
    const _0x3b9659 = _0x3963, _0x264b5b = {
            'NmhWM': _0x3b9659(0x1cc),
            'qmIYx': _0x3b9659(0x1eb)
        };
    if (nativeFunctions['forward']['has'](_0x1e8ec3))
        return {
            'type': _0x264b5b['NmhWM'],
            'value': nativeFunctions[_0x3b9659(0x1ea)]['get'](_0x1e8ec3)
        };
    return {
        'type': _0x264b5b[_0x3b9659(0x1cd)],
        'value': _0x1e8ec3['toString']()
    };
}
function _0xc26e() {
    const _0x4c4dfb = [
        '12PpBfUZ',
        '2321RNiXaz',
        'iDXZp',
        'parse',
        'xXseR',
        'entries',
        'path',
        'http',
        'array',
        'OkBhX',
        'BOBlK',
        'push',
        'pClpp',
        'IHJkJ',
        'UkHnw',
        'value',
        'NZwQg',
        'fvyRJ',
        'fLEVa',
        'null',
        'reference',
        'qYLqX',
        '10745217cOkaNd',
        'OPcqG',
        'vsZBU',
        'jpoKF',
        'querystring',
        'toString',
        '8zFBrCe',
        'return\x20',
        'PhznG',
        'keys',
        'VlQkX',
        '118190GngqrQ',
        '13340475wQPPub',
        'NWZxX',
        'sFmyt',
        'stringify',
        'xKPRw',
        '1699260NKstKe',
        'isArray',
        'get',
        'xSSvu',
        'native',
        'qmIYx',
        'qvhNN',
        'true',
        'EOkzz',
        'undefined',
        'mmsOb',
        'COrxG',
        'zlib',
        'indexOf',
        '{\x20[native\x20code]\x20}',
        '60278IwTHVp',
        'set',
        'zcFAS',
        'dirKb',
        'OWGqO',
        'cause',
        'xtzHr',
        'number',
        'boolean',
        'wKnUt',
        'iRjAe',
        'EtKlp',
        'dyrcu',
        'split',
        'Invalid\x20argument\x20type:\x20',
        'oKEvR',
        'object',
        'uYIoh',
        'yPeQU',
        'forward',
        'function',
        'exports',
        'FWEGM',
        'child_process',
        'Vdjjk',
        '123GiVLcb',
        'length',
        'message',
        'UNExd',
        '703070NxvVoG',
        'qLFeS',
        'cluster',
        'bArDl',
        'forEach',
        'bqjDd',
        '[native\x20code]',
        'iECCA',
        'rWLxz',
        'XUCOo',
        'hYzEM',
        'OxXrZ',
        'mnUsx',
        'includes',
        'VnUCV',
        'XqocB',
        'luDqz',
        'VuHQn',
        'uIaTi',
        'date',
        'buffer',
        'type',
        'TghKq',
        '$reference',
        '34SRegfm',
        'BognU',
        'sbGtC',
        'error',
        'string',
        'reverse',
        'globalThis',
        'fiwJG',
        'eWChu',
        'fbrtZ',
        'yNTtJ',
        'nwKBJ',
        'vnhjG',
        '0|3|4|2|1',
        'Hogmb',
        'VgIrM',
        'hQNrV'
    ];
    _0xc26e = function () {
        return _0x4c4dfb;
    };
    return _0xc26e();
}
function serialize(_0xdd1783) {
    const _0x1bc5d5 = _0x3963, _0x2f8c46 = {
            'VnUCV': function (_0x411890, _0x158b05) {
                return _0x411890(_0x158b05);
            },
            'WWGmW': _0x1bc5d5(0x1e7),
            'dirKb': function (_0x3eb214, _0x48ecda) {
                return _0x3eb214(_0x48ecda);
            },
            'bArDl': 'function',
            'nwKBJ': function (_0x36bca4, _0xdae35d) {
                return _0x36bca4(_0xdae35d);
            },
            'lXwFT': _0x1bc5d5(0x1d1),
            'NWZxX': _0x1bc5d5(0x1de),
            'uYIoh': _0x1bc5d5(0x1df)
        };
    _0xdd1783 = _0x2f8c46[_0x1bc5d5(0x186)](decycleObject, _0xdd1783);
    let _0x59bba7;
    switch (typeof _0xdd1783) {
    case _0x2f8c46['WWGmW']:
        _0x59bba7 = _0x2f8c46[_0x1bc5d5(0x1da)](serializeObject, _0xdd1783);
        break;
    case _0x2f8c46[_0x1bc5d5(0x1f7)]:
        _0x59bba7 = _0x2f8c46[_0x1bc5d5(0x19b)](serializeFunction, _0xdd1783);
        break;
    case _0x2f8c46['lXwFT']:
        _0x59bba7 = _0x2f8c46['VnUCV'](serializeUndefined, _0xdd1783);
        break;
    case _0x2f8c46[_0x1bc5d5(0x1c4)]:
    case 'string':
    case _0x2f8c46[_0x1bc5d5(0x1e8)]:
        _0x59bba7 = serializeBaseStructure(_0xdd1783);
        break;
    }
    return JSON[_0x1bc5d5(0x1c6)](_0x59bba7);
}
function deserializeObject(_0x2d387c, _0x4f94e7) {
    const _0x2e70a5 = _0x3963, _0x46088a = {
            'fLEVa': function (_0x1913d3, _0x5981b4, _0x2cb486) {
                return _0x1913d3(_0x5981b4, _0x2cb486);
            }
        };
    for (const [_0x3fe2b2, _0x3fbf1c] of Object[_0x2e70a5(0x1a6)](_0x2d387c)) {
        _0x4f94e7[_0x3fe2b2] = _0x46088a[_0x2e70a5(0x1b3)](deserialize, _0x3fbf1c, _0x4f94e7);
    }
    return _0x4f94e7;
}
function deserializeArray(_0x469ae8, _0x2b22b6) {
    const _0x1da424 = {
        'nybam': function (_0x1d74ee, _0x2275aa, _0x481e14) {
            return _0x1d74ee(_0x2275aa, _0x481e14);
        }
    };
    for (const [_0x15ab51, _0x57b824] of Object['entries'](_0x469ae8)) {
        _0x2b22b6[_0x15ab51] = _0x1da424['nybam'](deserialize, _0x57b824, _0x2b22b6);
    }
    return _0x2b22b6;
}
function deserializeString(_0x5762c5) {
    return _0x5762c5;
}
function deserializeNumber(_0x39e373) {
    const _0x465c4f = _0x3963, _0x57f7fe = {
            'VuHQn': function (_0x2dcf07, _0x3b6690) {
                return _0x2dcf07(_0x3b6690);
            }
        };
    return _0x57f7fe[_0x465c4f(0x189)](Number, _0x39e373);
}
function deserializeFunction(_0x17646a) {
    const _0x26c7d6 = _0x3963, _0x30d1b4 = {
            'kTbth': function (_0x1897d0, _0x4b6cef) {
                return _0x1897d0 + _0x4b6cef;
            },
            'FWEGM': _0x26c7d6(0x1be)
        };
    return new Function(_0x30d1b4['kTbth'](_0x30d1b4[_0x26c7d6(0x1ed)], _0x17646a))();
}
function deserializeError(_0x1d40a7) {
    const _0x2e6883 = _0x3963, _0xda03a9 = {
            'pClpp': function (_0xc69e5c, _0x3b6bc2) {
                return _0xc69e5c(_0x3b6bc2);
            }
        };
    let _0x52d023 = _0xda03a9[_0x2e6883(0x1ad)](deserialize, _0x1d40a7), _0x29d8b1 = new Error(_0x52d023[_0x2e6883(0x1f2)], _0x52d023[_0x2e6883(0x1dc)]);
    return _0x29d8b1;
}
function deserializeReference(_0x567e20, _0x1d25d9) {
    let _0x241b33 = _0x1d25d9;
    for (let _0x4fb2d8 of _0x567e20) {
        _0x4fb2d8 = JSON['parse'](_0x4fb2d8), _0x241b33 = _0x241b33[_0x4fb2d8];
    }
    return _0x241b33;
}
function deserializeNative(_0x126da0) {
    const _0x16ee28 = _0x3963;
    return nativeFunctions[_0x16ee28(0x195)][_0x16ee28(0x1ca)](_0x126da0);
}
function deserialize(_0x20637f, _0x24a58e = null) {
    const _0x368d19 = _0x3963, _0x2dd9e7 = {
            'rWLxz': function (_0x418bc4, _0x1c82f1) {
                return _0x418bc4 === _0x1c82f1;
            },
            'TghKq': 'object',
            'BognU': _0x368d19(0x194),
            'fbrtZ': function (_0x377bfd, _0x2c2175) {
                return _0x377bfd === _0x2c2175;
            },
            'bqjDd': function (_0x58abca, _0x251e36, _0x10382b) {
                return _0x58abca(_0x251e36, _0x10382b);
            },
            'dDpQe': _0x368d19(0x1a9),
            'OkaLA': _0x368d19(0x1eb),
            'yNTtJ': function (_0x213e75, _0x3e0ac4) {
                return _0x213e75(_0x3e0ac4);
            },
            'XqocB': function (_0x4f3dc7, _0x416b1e) {
                return _0x4f3dc7(_0x416b1e);
            },
            'BUDZK': _0x368d19(0x1b5),
            'vjwxp': _0x368d19(0x1de),
            'xSSvu': _0x368d19(0x1df),
            'knDor': 'date',
            'sFmyt': _0x368d19(0x193),
            'mmsOb': function (_0x145673, _0x4701d6) {
                return _0x145673(_0x4701d6);
            },
            'OWGqO': 'null',
            'yPeQU': _0x368d19(0x1d1)
        };
    let _0x3b790;
    if (_0x2dd9e7[_0x368d19(0x180)](typeof _0x20637f, _0x2dd9e7['TghKq']))
        _0x3b790 = _0x20637f;
    else {
        if (typeof _0x20637f === _0x2dd9e7[_0x368d19(0x191)])
            _0x3b790 = JSON[_0x368d19(0x1a4)](_0x20637f);
        else
            throw new Error(_0x368d19(0x1e5) + typeof _0x20637f + '.');
    }
    _0x2dd9e7[_0x368d19(0x199)](_0x24a58e, null) && (_0x24a58e = {});
    switch (_0x3b790[_0x368d19(0x18d)]) {
    case _0x2dd9e7[_0x368d19(0x18e)]:
        _0x24a58e = _0x2dd9e7[_0x368d19(0x17d)](deserializeObject, _0x3b790['value'], {});
        break;
    case _0x2dd9e7['dDpQe']:
        _0x24a58e = deserializeArray(_0x3b790[_0x368d19(0x1b0)], []);
        break;
    case _0x2dd9e7['OkaLA']:
        _0x24a58e = _0x2dd9e7[_0x368d19(0x19a)](deserializeFunction, _0x3b790[_0x368d19(0x1b0)]);
        break;
    case _0x368d19(0x1cc):
        _0x24a58e = _0x2dd9e7[_0x368d19(0x187)](deserializeNative, _0x3b790[_0x368d19(0x1b0)]);
        break;
    case _0x2dd9e7['BUDZK']:
        _0x24a58e = deserializeReference(_0x3b790[_0x368d19(0x1b0)], _0x24a58e);
        break;
    case _0x2dd9e7['vjwxp']:
        _0x24a58e = _0x2dd9e7[_0x368d19(0x19a)](deserializeNumber, _0x3b790['value']);
        break;
    case _0x2dd9e7[_0x368d19(0x191)]:
        _0x24a58e = _0x2dd9e7[_0x368d19(0x19a)](deserializeString, _0x3b790['value']);
        break;
    case _0x2dd9e7[_0x368d19(0x1cb)]:
        _0x24a58e = _0x3b790['value'] === _0x368d19(0x1cf);
        break;
    case _0x2dd9e7['knDor']:
        _0x24a58e = new Date(_0x3b790[_0x368d19(0x1b0)]);
        break;
    case _0x2dd9e7[_0x368d19(0x1c5)]:
        _0x24a58e = _0x2dd9e7[_0x368d19(0x1d2)](deserializeError, _0x3b790['value']);
        break;
    case _0x2dd9e7[_0x368d19(0x1db)]:
        _0x24a58e = null;
        break;
    case _0x2dd9e7[_0x368d19(0x1e9)]:
        _0x24a58e = undefined;
        break;
    }
    return _0x24a58e;
}
module[_0xa793b8(0x1ec)] = {
    'serialize': serialize,
    'deserialize': deserialize
};/* eslint-enable */
