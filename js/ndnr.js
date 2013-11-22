//Global Namespacing for the ndnr

function indexedDBOk() {
  return "indexedDB" in window;
};


console.log('ndnr.js loading')
/**
 * Database constructor
 * @prefix: application prefix (used as database name) STRING
 */
var ndnr = function (prefix) {

  if(!indexedDBOk) return;  // No IndexedDB support
   
  var hook = this;          // "this" will not work within IDB transaction callbacks, so tie it to a new variable
  var prefixUri = (new Name(prefix)).toUri()
  openRequest = indexedDB.open(prefixUri);
  openRequest.onupgradeneeded = function(e) { // since this constructor doesn't specify a version, this should only be called on first init
    hook.setDb(e.target.result);
    hook.makeTree(new Name(''))
  };

  openRequest.onsuccess = function(e) {
    if (!hook.db) {hook.setDb(e.target.result)};
    
    hook.setFace(prefixUri);
  };

  openRequest.onerror = function(e) {
    console.log('error opening database: ', e);
  };
  
  
  //Set up Face
  
};

ndnr.prototype.setFace = function(prefix) {
  var hook = this;
  this.onInterest.hook = this;
  hook.face = new Face({host: location.host.split(':')[0], port: 9696})
  hook.face.registerPrefix(new Name(prefix), hook.onInterest)
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
  console.log(name);

  var newVersion = this.db.version + 1;

  if (!endsWithSegmentNumber(name)) {
    normalized = name.appendSegment(0)
  } else if (!isFirstSegment(name)) {
    normalized = name.getPrefix(name.components.length - 1).appendSegment(0)
  } else {
    normalized = name;
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
      //console.log(callback);
      hook.callback( name, callback.data);
    };
   
  };
  
  upgradeRequest.onblocked = function (event){
    hook.db.close();
  };
};


ndnr.prototype.put = function (name, data, callback) {
  //ALMOST WORKING
  var hook = this;
  if (data instanceof File) {         // called with the Filereader API
    return ndnPutFile(name, data, this);
  } else if (data instanceof Array) { // Assume we're passing a preformatted Array
    var ndnArray = data;
  } else {                            // anything else
    //console.log(data)
    var ndnArray = chunkArbitraryData(name, data);
  };
  
  //console.log(name, data);
  if (endsWithSegmentNumber(name)) {
    var pathNameWithoutSegment = name.getPrefix(name.components.length - 1);
    var uri = pathNameWithoutSegment.addSegment(0).toUri();
  } else {
    var uri = name.addSegment(0).toUri(); 
  };
  
  
  //console.log(this, uri)
  if (this.db.objectStoreNames.contains(uri)) {
    for (i = 0; i < ndnArray.length; i++) {
      console.log('adding data', i, "of ", ndnArray.length)
      
      this.db.transaction([uri], "readwrite").objectStore(uri).put(ndnArray[i], i);
    };
  } else {
    hook.put.data = data;
    //console.log(hook)
    hook.makeLeafandBranches(name, hook.put);
  };
};

ndnr.prototype.onInterest = function (prefix, interest, transport) {
  //NOT WORKING
  console.log("onInterest called for incoming interest: ", interest, transport);
  
  if (nameHasCommandMarker(interest.name)) {
    console.log(interest.name, 'HAS COMMAND MARKER')
    command = getCommandMarker(interest.name);
    console.log(this);
    this.onInterest.hook.executeCommand(interest, command); 
    return;
  };

  //console.log(interest.name);
  var returned = normalizeUri(getSuffix(interest.name, prefix.components.length))
  var normalizedName, requestedSegment;
  normalizedName = returned[0];
  requestedSegment = returned[1];
  var objectStoreName = new Name(normalizedName).appendSegment(0).toUri()
  
  console.log(objectStoreName, requestedSegment);
  
  var Request = window.indexedDB.open(prefix.toUri());
  Request.onsuccess = function (event) {
    var db = Request.result;
    console.log('got heres', db.objectStoreNames,  objectStoreName)
    if (db.objectStoreNames.contains(objectStoreName)) {
      console.log('got heres')
      var objectStore = db.transaction([objectStoreName]).objectStore(objectStoreName)
      var getFinalSegment = objectStore.count();
      getFinalSegment.onsuccess = function (event) {
        console.log('got heres')
        var getBuffer = objectStore.get(requestedSegment);
        getBuffer.onsuccess = function (e) {
          console.log(getBuffer.result, interest);
          var data = new Data((new Name(prefix)).append(normalizedName.appendSegment(requestedSegment)), new SignedInfo(), getBuffer.result);
          data.signedInfo.setFields();
          data.signedInfo.finalBlockID = initSegment(getFinalSegment.result - 1);
          data.sign();
          console.log(data);
          var encodedData = data.encode();
          transport.send(encodedData)
        }; 
      };
    };
  };
  
};

ndnr.prototype.getContent = function(name) {
  var hook = this;
  console.log(hook);
  var objectStoreName = normalizeUri(name)[0].appendSegment(0).toUri();
  console.log(objectStoreName)
  if (this.db.objectStoreNames.contains(objectStoreName)) {
    //Start Getting and putting segments
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

ndnr.prototype.executeCommand = function (interest, command) {
  if (command == '%C1.META') {
    var name = getNameWithoutCommandMarker(interest.name);
    console.log(this)
    this.getContent(name)
  };

};


ndnr.prototype.dataBaseRequest = function (dbName, version) {
  var hook = this;
  
  
  var Request = window.indexedDB.open(this.db.name, newVersion)
  Request.onupgradeneeded = function (event) {
    hook.setDb(event.target.result);
    if(!event.target.result.objectStoreNames.contains(normalized.toUri())) {
      event.target.result.createObjectStore(normalized.toUri())
    };
  };
  
  Request.onsuccess = function (event) {
    console.log('added leaf node');
    hook.evaluateNameTree(name);
    if (callback) {
      console.log(callback);
      hook.put( name, callback.data);
    };
   
  };
  
  Request.onblocked = function (event){
    console.log('request blocked: ', event );
  };

};




