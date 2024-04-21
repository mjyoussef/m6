global.nodeConfig = {ip: '127.0.0.1', port: 8080};
const { expect } = require('@jest/globals');
const distribution = require('../distribution.js');
const id = distribution.util.id;

const groupsTemplate = require('../distribution/all/groups');

afterEach(() => {
  jest.useRealTimers();
});

// This group is used for testing most of the functionality
const mygroupGroup = {};


/*
   This hack is necessary since we can not
   gracefully stop the local listening node.
   This is because the process that node is
   running in is the actual jest process
*/
let localServer = null;

const n1 = {ip: '127.0.0.1', port: 8000};
const n2 = {ip: '127.0.0.1', port: 8001};
const n3 = {ip: '127.0.0.1', port: 8002};

jest.setTimeout(1000*60*10)

beforeAll((done) => {
  // First, stop the nodes if they are running
  let remote = {service: 'status', method: 'stop'};

  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
      });
    });
  });

  mygroupGroup[id.getSID(n1)] = n1;
  mygroupGroup[id.getSID(n2)] = n2;
  mygroupGroup[id.getSID(n3)] = n3;

  // Now, start the base listening node
  distribution.node.start((server) => {
    localServer = server;

    const groupInstantiation = (e, v) => {
      const mygroupConfig = {gid: 'mygroup'};

      // Create some groups
      groupsTemplate(mygroupConfig).put('mygroup', mygroupGroup, (e, v) => {
        done();
      });
    };

    // Start the nodes
    distribution.local.status.spawn(n1, (e, v) => {
      distribution.local.status.spawn(n2, (e, v) => {
        distribution.local.status.spawn(n3, groupInstantiation);
      });
    });
  });
}, 1000*60*2);

afterAll((done) => {
  distribution.mygroup.status.stop((e, v) => {
    let remote = {service: 'status', method: 'stop'};
    remote.node = n1;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n2;
      distribution.local.comm.send([], remote, (e, v) => {
        remote.node = n3;
        distribution.local.comm.send([], remote, (e, v) => {
          done()
        });
      });
    });
  });
});

test('all.comm.send(index.embed(text))', (done) => {
  const remote = {service: 'index', method: 'embed'};
  const text = 'The quick brown fox jumps over the lazy dog';

  function cosineSim(vector1, vector2) {
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
  
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += Math.pow(vector1[i], 2);
      magnitude2 += Math.pow(vector2[i], 2);
    }
  
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
  
    return dotProduct / (magnitude1 * magnitude2);
  };

  distribution.mygroup.comm.send([text], remote, (e, v) => {
    try {
      expect(e).toEqual({});
      results = [];
      keys = Object.keys(v);
      for (let i = 0; i < keys.length; i++) {
        results.push(v[keys[i]]);
      }
      expect(results[0].sort()).toEqual(results[1].sort());
      expect(results[0].sort()).toEqual(results[2].sort());
      expect(Math.round(cosineSim(results[0], results[1]))).toEqual(1.0);
      done();
    } catch (error) {
      done(error);
    }
  });
});

// test('vecStore', (done) => {
//   const remote = {service: 'index', method: 'embed'};
//   d1 = {url: 'https://1', vec: [0, 0, 0, 1]};
//   d2 = {url: 'https://2', vec: [0, 0, 0, 0.8]};
//   d3 = {url: 'https://3', vec: [0, 0, 0.2, 1]};
//   d4 = {url: 'https://4', vec: [1, 1, 0.1, 1]};
//   d5 = {url: 'https://5', vec: [0.7, 0.25, 1, 1]};
//   d6 = {url: 'https://6', vec: [0, 0.1, 0.8, 1]};
//   d7 = {url: 'https://7', vec: [1, 0, 1, 1]};

//   query = [0, 0, 0, 0];
//   count = 3;

//   distribution.mygroup.vecStore.put(d1, (e, v) => {
//     distribution.mygroup.vecStore.put(d2, (e, v) => {
//       distribution.mygroup.vecStore.put(d3, (e, v) => {
//         distribution.mygroup.vecStore.put(d4, (e, v) => {
//           distribution.mygroup.vecStore.put(d5, (e, v) => {
//             distribution.mygroup.vecStore.put(d6, (e, v) => {
//               distribution.mygroup.vecStore.put(d7, (e, v) => {
//                 distribution.mygroup.vecStore.query(query, (e, v) => {
//                   try {
//                     expect(e).toBeFalsy();
//                     expect(v.length).toEqual(count);
//                     console.log(v);
//                     done();
//                   } catch (error) {
//                     done(error);
//                   }
//                 }, k=count);
//               });
//             });
//           });
//         });
//       });
//     });
//   });
// });
