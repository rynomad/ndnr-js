NDNR-JS
=======

NDNR-js is a javascript analog of ndnr, a persistent data store for named data networks. NDNR-js uses the browsers IndexedDB API to store ndn formatted content objects across multiple sessions and serve them via ndn-js to a named data network. Additionally, this package includes analogs of ndnputfile and ndngetfile.

API Goals
=========

NDNR-js is accessed by calling a new ndnr constructor, which takes a uri prefix and and optional face parameter argument , which serves both as the name of the database and the prefix which is registered to the server side ndnd.

var repo = new ndnr('/some/prefix', {host: 'www.example.com', port: 9696})

methods:

repo.put(name, data,  callback)

where data is any blob, file, string of significant size, and name is an instance of the ndn-js Name class. callback contains successevent containing the ndn name of the content.

repo.get(name, callback)

where name is a Name and the callback recieves the full data of appropriate type.

ndnputfile.js
=============
usage:
ndnputfile( name, data, source, callback)
same as ndnr.put, except that source may specify a Face to publish data on via ndn or an ndnr to call ndnr.put on 


ndngetfile.js
=============

ndngetfile(name, source, callback)

same difference as ndnputfile.

tests
=====

tests are simple webpages that connect to an ndnd/wsproxy running on localhost port 9696, put/getfile.html check publishing and sourcing via ndnr.html, and ndnr.html gives tests for direct access.

Architecture
============

ndn.js is the only dependency, other than a modern browser supporting indexedDB and websockets. atop ndn.js sits a range of helper functions used to help normalize and evaluate names between ndn and idb, as well as reusable code between the three top level interfaces.
