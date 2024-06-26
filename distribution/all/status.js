/**
 * Gets status for some node attribute (ie. memory usage, sid, nid, etc).
 *
 * @param {Object} context - metadata such as gid
 * @param {string} attribute - attribute name
 * @param {Function} callback - optional callback that accepts error, value
 */
const get = (context, attribute, callback) => {
  callback = callback || function (e, v) {};
  const message = [attribute];
  const remote = { service: "status", method: "get" };
  global.distribution[context.gid].comm.send(message, remote, (e, v) => {
    if (Object.keys(e).length === 0 && attribute === "heapTotal") {
      const heapTotal = Object.values(v).reduce((sum, value) => sum + value, 0);
      callback(e, heapTotal);
    } else {
      callback(e, v);
    }
  });
};

/**
 * Gracefully stops all nodes.
 *
 * @param {Object} context - metadata such as gid
 * @param {Function} callback - optional callback that accepts error, value
 */
const stop = (context, callback) => {
  const remote = { service: "status", method: "stop" };
  global.distribution[context.gid].comm.send([], remote, (e, v) => {
    global.distribution.local.status.stop(callback);
  });
};

/**
 * Spawns a new node and adds it to the group.
 *
 * @param {Object} context - metadata such as gid
 * @param {Object} nodeConfig - configuration for the node (ie. ip, port, etc)
 * @param {Function} callback - optional callback that accepts error, value
 */
const spawn = (context, nodeConfig, callback) => {
  global.distribution.local.status.spawn(nodeConfig, (e1, v1) => {
    global.distribution[context.gid].groups.add(
      context.gid,
      nodeConfig,
      (e2, v2) => {
        if (Object.keys(e2).length === 0) {
          callback(null, nodeConfig);
        } else {
          callback(
            new Error(
              `could not spawn node ${nodeConfig.ip}:${nodeConfig.port}`
            )
          );
        }
      }
    );
  });
};

let status = (config) => {
  let context = {};

  context.gid = config.gid || "all";

  return {
    get: get.bind(null, context),
    stop: stop.bind(null, context),
    spawn: spawn.bind(null, context),
  };
};

module.exports = status;
