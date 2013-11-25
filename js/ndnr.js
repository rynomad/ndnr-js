//Global Namespacing for the ndnr

function indexedDBOk() {
  return "indexedDB" in window;
};


console.log('ndnr.js loading')
/**
 * Database constructor
 * @prefix: application prefix (used as database name) STRING
 */
var ndnr = function (prefix, faceParam) {

  if(!indexedDBOk) return console.log('no indexedDb');  // No IndexedDB support
  var prefixUri = (new Name(prefix)).toUri(),           // normalize 
      initDb = {};           
  
  this.prefix = prefixUri
  
  
  if (faceParam) {
    this.interestHandler.face = new Face(faceParam)
  } else {
    this.interestHandler.face = new Face({host: location.host.split(':')[0]})
  };
  
  this.interestHandler.face.registerPrefix(new Name(prefix), this.interestHandler);
  
  initDb.onupgradeneeded = function(e) {
    console.log("Version 1 of database ", prefixUri, "created");
  };

  useIndexedDB(prefixUri, initDb);

};

ndnr.prototype.setDb = function(db) {
  this.db = db
  this.db.onversionchange = function(e) {
    this.close();
  };
  console.log(db, this);
};

ndnr.prototype.makeTree = function(name) {
  var normalized;
  
  if (endsWithSegmentNumber(name) && name.components.length >= 1) {
    normalized = name.getPrefix(name.components.length - 1);
  } else {
    normalized = name;
  };
  
  this.evaluateNameTree(normalized);

};

ndnr.prototype.evaluateNameTree = function (name) {
    
  var toCreate = [];
  var uriArray = getAllPrefixes(name);
  for (i = 0 ; i < uriArray.length; i++) {
    if (!this.db.objectStoreNames.contains(uriArray[i])) {
      toCreate.push(uriArray[i]);
    };
  };
  if (toCreate.length > 0) {
    newVersion = this.db.version + 1;
    this.makeTreeBranches(name, toCreate, newVersion);
  } else {
    this.populateBranches(name);
  };
};



ndnr.prototype.makeTreeBranches = function (name, toCreate, newVersion) {
  var hook = this;
  
  //this.db.close();
  upgradeRequest = window.indexedDB.open(this.db.name, newVersion)
  upgradeRequest.onupgradeneeded = function (event) {
    hook.setDb(event.target.result);
    for (i = toCreate.length - 1 ; i > - 1; i--) {
      if (toCreate[i].indexOf('/%00') == -1) {
        hook.db.createObjectStore(toCreate[i], {keyPath: 'escapedString'});
      } else {
        hook.db.createObjectStore(toCreate[i]);
      };
    };
  };
  
  upgradeRequest.onsuccess = function (event) {
    hook.populateBranches(name);
  };
  
  upgradeRequest.onblocked = function (event){
    hook.db.close();
    hook.evaluateNameTree(name);
  };
};

ndnr.prototype.populateBranches = function (name) {
  var uriArray = getAllPrefixes(name);
  try {
    var transaction = this.db.transaction(uriArray, "readwrite");
    for (i = 0; i < uriArray.length - 1; i++) {
      var objectStore = transaction.objectStore(uriArray[i]);
      var entry = {}
      entry.component = name.get(i);
      entry.escapedString = entry.component.toEscapedString();
      objectStore.put(entry);
    };
  } catch (ex) {
    if (ex.code == 8) {  //content store not found
      this.evaluateNameTree(name);
    } else {
      console.log(ex)
    }
  };
};

ndnr.prototype.makeLeafandBranches = function (name, callback) {
  var normalized;
  var hook = this;
  hook.callback = callback;
  ndnName = new Name(name)
  if (name.hasVersion == true) {
    alert('this is beyond insanity', name.hasVersion)
  } else {
    alert('also kinda nuts')
  };
  var newVersion = this.db.version + 1;

  if (!endsWithSegmentNumber(ndnName)) {
    normalized = ndnName.appendSegment(0)
  } else if (!isFirstSegment(ndnName)) {
    normalized = ndnName.getPrefix(ndnName.components.length - 1).appendSegment(0)
  } else {
    normalized = ndnName;
  };
  hook.evaluateNameTree(normalized);
  console.log(normalized, name, hook.db);
  var upgradeRequest = window.indexedDB.open(this.db.name, newVersion)
  upgradeRequest.onupgradeneeded = function (event) {
    console.log('UPGRADE',normalized)
    hook.setDb(event.target.result);
    if(!event.target.result.objectStoreNames.contains(normalized.toUri())) {
      event.target.result.createObjectStore(normalized.toUri())
    };
  };
  
  upgradeRequest.onsuccess = function (event) {
    console.log('added leaf node', this);
    if (callback) {
      console.log(callback.data);
      hook.callback( ndnName, callback.data);
    };
   
  };
  
  upgradeRequest.onblocked = function (event){
    hook.db.close();
  };
};


ndnr.prototype.put = function (name, data, callback) {
  //ALMOST WORKING
  var hook = this;
  hook.put.callback = callback;
  if (data instanceof File) {         // called with the Filereader API
    return ndnPutFile(name, data, this);
  } else if (data instanceof Array) { // Assume we're passing a preformatted Array
    var ndnArray = data;
  } else {                            // anything else
    //console.log(data)
    var ndnArray = chunkArbitraryData(name, data);
  };
  
  var ndnName = new Name(name)
  if (name.hasVersion == undefined ) {
    alert('not evaluating false here?')
    var uri = appendVersion(normalizeUri(ndnName)[0]).appendSegment(0).toUri();
    uri.hasVersion = true;
  } else {
    var uri = name
  };
  
  this.makeLeafandBranches(uri, hook.put);
    console.log(this, uri)
  if (this.db.objectStoreNames.contains(uri)) {
    for (i = 0; i < ndnArray.length; i++) {
      console.log('adding data', i, "of ", ndnArray.length)
      var action = this.db.transaction([uri], "readwrite").objectStore(uri).put(ndnArray[i], i);
      if (i + 1 == ndnArray.length) {
        action.onsuccess = function (e) {
          console.log(normalizeUri(ndnName)[0])
          hook.put.callback(normalizeUri(ndnName)[0])
        };
      }; 
      
    };
  };
};

// vvvv THIS IS THE GOOD STUFF vvvv Plus NDN-helpers. NEED to Refactor and streamline useIndexedDB a little but it seems to be working good

ndnr.prototype.interestHandler = function(prefix, interest, transport) {
  console.log("onInterest called for incoming interest: ", interest.toUri());
  interest.face = this.onInterest.face  
  if (nameHasCommandMarker(interest.name)) {
    var command = getCommandMarker(interest.name);
    console.log('incoming interest has command marker ', command);
    executeCommand(prefix, interest, command); 
    return;
  } else {
    console.log('attempting to fulfill interest');
    fulfillInterest(prefix, interest, transport);
  };
};

function fulfillInterest(prefix, interest, transport) {
  var localName = getSuffix(interest.name, prefix.components.length )
      objectStoreName = normalizeNameToObjectStore(localName),
      thisSegment = getSegmentInteger(localName),
      dbName = prefix.toUri(),
      getContent = {};
      
  
  getContent.onsuccess = function(e) {
    if (e.target.result.objectStoreNames.contains(objectStoreName)) {
      e.target.result.transaction(objectStoreName).objectStore(objectStoreName).get(thisSegment).onsuccess = function(e) {
          transport.send(e.target.result)
      };
    } else {
      console.log("objectStoreName not found: ", objectStoreName);
    };
  }; 
  
  useIndexedDB(dbName, getContent);
};

ndnr.prototype.getContent = function(name) {
  var hook = this;
  console.log(name);
  var objectStoreName = normalizeUri(name)[0].appendSegment(0).toUri();
  console.log(objectStoreName)
  if (this.db.objectStoreNames.contains(objectStoreName)) {
    //Start Getting and putting segments
    console.log('here')
    var onData = function (interest, co) {
      var returns = normalizeUri(interest.name)
      var segmentNumber = returns[1]
      if (endsWithSegmentNumber(co.name)) {
        segmentNumber = DataUtils.bigEndianToUnsignedInt
          (co.name.components[co.name.components.length - 1].value);
        console.log(objectStoreName)
        var objectStore = hook.db.transaction([objectStoreName], "readwrite").objectStore(objectStoreName);
        objectStore.put(co.content, segmentNumber).onsuccess = function (e) {
          console.log("added segment Number ", segmentNumber);
          if (isLastSegment(co.name, co)) {  
          console.log('got last segment')
        } else {
          //console.log(name, co)
          newName = name.getPrefix(name.components.length - 1).appendSegment(segmentNumber + 1);
          console.log(newName)
          hook.face.expressInterest(newName, onData, onTimeout);
        }
        };
        
      }
    };
    this.face.expressInterest(name, onData, onTimeout);
  
  } else {
    //Upgrade DataBase 
    this.makeLeafandBranches(name, this.getContent)  
  };
  

    var onTimeout = function (interest) {
      console.log("timeout");
    };
    
  
  
  
  console.log(name.toUri())
  
};

ndnr.prototype.get = function (name, callback) {
  var storeName = normalizeUri(name)[0].appendSegment(0).toUri()
  console.log(storeName)
  var trans = this.db.transaction(storeName);
  var store = trans.objectStore(storeName);
  var items = [];

  trans.oncomplete = function(evt) {  
    byteArraysToBlob(items, 'application/x-deb')
  };

  var cursorRequest = store.openCursor();

  cursorRequest.onerror = function(error) {
    console.log(error);
  };

  cursorRequest.onsuccess = function(evt) {                    
    var cursor = evt.target.result;
    if (cursor) {
      console.log(cursor)
      items.push(cursor.value);
      cursor.continue();
    }
  };


};

function executeCommand(prefix, interest, command) {
  if (command in commandMarkers) {
    console.log("executing recognized command ", command);
    commandMarkers[command](prefix, interest); 
  } else {
    console.log("ignoring unrecognized command ", command);
  };
};

function useIndexedDB(dbName, action, version) {
  var request;
  
  if (version) {
    request = indexedDB.open(dbName, version);
  } else {
    request = indexedDB.open(dbName);
  };
  
  if (action.onupgradeneeded) {
    request.onupgradeneeded = action.onupgradeneeded;
  } else {
    request.onupgradeneeded = function(e) {
      console.log('upgrading database to version ', e.target.result.version)
    };
  };
  if (action.onsuccess) {
    request.onsuccess = function(e) {
      request.result.onversionchange = function(e){
        console.log('version change requested, closing db');
        request.result.close();
      }
      action.onsuccess(e);
    };
  } else {
    request.onsuccess = function(e) { 
      request.result.onversionchange = function(e){
        console.log('version change requested, closing db');
        request.result.close();
      }
      console.log("database ", dbName, " is open at version ", e.target.result.version)
    };
  };
  if (action.onerror) {
    request.onerror = action.onerror;
  } else {
    request.onerror = function(e) {
      console.log('error: ', e);
    };
  };
  if (action.onclose) {
    request.onclose = action.onclose;
  } else {
    request.onclose = function(e) {
      console.log("database ", dbName, " is closed at version ", e.target.result.version)
    };
  };
  if (action.onblocked) {
    request.onblocked = action.onblocked;
  } else {
    request.onblocked = function(e) {
      console.log("request blocked: ", e);
    };
  };
};
