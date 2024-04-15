const comm = require('./comm');
const status = require('./status');
const groups = require('./groups');
const gossip = require('./gossip');

const routesStore = new Map();
const routes = {};

routes.put = (service, name, cb) => {
  routesStore[name] = service;
  if (cb) {
    cb(null, name);
  } else {
    return;
  }
};

routes.get = (name, cb) => {
  if (!cb) {
    return;
  }

  if (name in routesStore) {
    let service = routesStore[name];
    cb(null, service);
  } else {
    // cb(new Error("Service not found in routes"), null);
    const globalLookup = global.toLocal.get(name);
    if (globalLookup) {
      cb(null, globalLookup);
    } else {
      cb(new Error('Service not found in routes'));
    }
  }
};

routesStore.routes = routes;
routesStore.comm = comm;
routesStore.status = status;
routesStore.groups = groups;
routesStore.gossip = gossip;
module.exports = routes;
