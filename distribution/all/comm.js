/* Sends a message to every node in its group

PARAMETERS:
context: contains the group ID
message: the message to send to each node
rem: service and method to invoke
callback: an optional callback
*/
const send = (context, message, rem, callback) => {
  callback = callback || function(e, v) {};
  const local = global.distribution.local;

  local.groups.get(context.gid, (e, v) => {
    if (e) {
      callback(new Error('all.comm.send: failed to get nodes in group'), undefined);
      return;
    }
    
    const allNodes = v;
    const nodesToErrors = {};
    const nodesToValues = {};
    const counter = {count: 0};
    const remote = {...rem};

    for (const [sid, node] of Object.entries(allNodes)) {
      remote.node = node;
      local.comm.send(message, remote, (e2, v2) => {
        if (e2) {
          nodesToErrors[sid] = e2;
        } else {
          nodesToValues[sid] = v2;
        }

        counter.count++;

        if (counter.count === Object.keys(allNodes).length) {
          callback(nodesToErrors, nodesToValues);
        }
      });
    }
  });
};

let comm = (config) => {
  let context = {};

  context.gid = config.gid || 'all';

  return {send: send.bind(null, context)};
};

module.exports = comm;
