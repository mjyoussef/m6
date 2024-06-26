const mr = function (config) {
  const gid = config.gid || "all";
  const hash = config.hash || "naiveHash";

  return {
    /**
     * MapReduce, using the current node as the coordinator.
     *
     * @param {Object} args - contains mrid, map/reduce functions, and optional inputs
     * @param {Function} cb - an optional callback that accepts an error and value
     */
    exec: (args, cb) => {
      /*
      args = {
        mrid: string,
        mapFn: function,
        reduceFn: function,
        inputs: (optional); a list of key-val pairs to use
      }
      */
      cb = cb || function (e, v) {};

      global.distribution.local.groups.get(gid, async (e, nodes) => {
        if (e) {
          cb(new Error("Error: failed to get nodes in group"), undefined);
          return;
        }

        const inputs = args.inputs || [];
        const storePromises = [];

        for (let i = 0; i < inputs.length; i++) {
          // each input is a single key-value pair
          const input = inputs[i];
          const key = Object.keys(input)[0];
          const value = input[key];

          // add promise
          storePromises.push(
            new Promise((resolve, reject) => {
              global.distribution[gid].store.put(
                value,
                key,
                (e, v) => {
                  if (e) {
                    console.log("Error here", e);
                    reject(e, v);
                  } else {
                    resolve(v);
                  }
                },
                (root = [args.mrid, "map"])
              );
            })
          );
        }

        // make sure all the promises resolved
        const storeResults = await Promise.allSettled(storePromises);
        // console.log(storeResults);
        for (let i = 0; i < storeResults.length; i++) {
          const storeResult = storeResults[i];
          if (storeResult.status !== "fulfilled") {
            console.log(storeResult);
            cb(
              new Error("Failed to store input keys in all.mr.exec"),
              undefined
            );
            return;
          }
        }

        // map phase
        const mapPromises = [];
        for (const nid in nodes) {
          const remote = {
            node: nodes[nid],
            service: "mr",
            method: "map",
          };
          const mapArgs = {
            gid: gid,
            mrid: args.mrid,
            mapFn: args.mapFn,
            hash: hash,
          };
          mapPromises.push(
            new Promise((resolve, reject) => {
              global.distribution.local.comm.send([mapArgs], remote, (e, v) => {
                if (e) {
                  // console.log(e);
                  reject(e);
                } else {
                  resolve(v);
                }
              });
            })
          );
        }

        // wait for map phase to complete
        Promise.all(mapPromises)
          .then((notifications) => {
            // reduce phase
            const reducePromises = [];
            for (const nid in nodes) {
              const remote = {
                node: nodes[nid],
                service: "mr",
                method: "reduce",
              };
              const reduceArgs = {
                gid: gid,
                mrid: args.mrid,
                reduceFn: args.reduceFn,
              };
              reducePromises.push(
                new Promise((resolve, reject) => {
                  global.distribution.local.comm.send(
                    [reduceArgs],
                    remote,
                    (e, v) => {
                      if (e) {
                        reject(e);
                      } else {
                        resolve(v);
                      }
                    }
                  );
                })
              );
            }

            Promise.all(reducePromises)
              .then((results) => {
                results = results.flat().filter((entry) => entry !== undefined);
                cb(undefined, results);
              })
              .catch((reduceError) => {
                cb(new Error("Error: failed reduce phase"), undefined);
              });
          })
          .catch((mapError) => {
            console.log(mapError);
            cb(new Error("Error: failed map phase"), undefined);
          });
      });
    },
  };
};

module.exports = mr;