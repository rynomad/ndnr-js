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

  openRequest = indexedDB.open(prefix);
  openRequest.onupgradeneeded = function(e) { // since this constructor doesn't specify a version, this should only be called on first init
    hook.setDb(e.target.result);
    hook.makeTree(new Name(''))
  };

  openRequest.onsuccess = function(e) {
    if (!hook.db) {hook.setDb(e.target.result)};
    
    hook.setFace(prefix);
  };

  openRequest.onerror = function(e) {
    console.log('error opening database: ', e);
  };
  
  
  //Set up Face
  
};

ndnr.prototype.setFace = function(prefix) {
  var hook = this;
  this.face = new Face({host: location.host.split(':')[0], port: 9696});
  this.face.registerPrefix(new Name(prefix), this.onInterest)
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
    console.log('added leaf node');
    if (callback) {
      console.log(callback);
      hook.putArbitraryData(callback.data, name);
    };
   
  };
  
  upgradeRequest.onblocked = function (event){
    hook.db.close();
  };
};


ndnr.prototype.putArbitraryData = function (data, name) {
  //ALMOST WORKING
  var hook = this;
  var ndnArray = chunkArbitraryData(data, name);
  console.log(name);
  if (endsWithSegmentNumber(name)) {
    var pathNameWithoutSegment = name.getPrefix(name.components.length - 1);
    var uri = pathNameWithoutSegment.addSegment(0).toUri();
  } else {
    var uri = name.addSegment(0).toUri(); 
  };
  
  
  console.log(this.db.objectStoreNames, uri)
  if (this.db.objectStoreNames.contains(uri)) {
    for (i = 0; i < ndnArray.length; i++) {
      console.log('adding data', uri, ndnArray[i])
      
      this.db.transaction([uri], "readwrite").objectStore(uri).put(ndnArray[i], i);
    };
  } else {
    hook.putArbitraryData.data = data;
    console.log(hook)
    hook.makeLeafandBranches(name, hook.putArbitraryData);
  };
};

ndnr.prototype.onInterest = function (prefix, interest, transport) {
  //NOT WORKING
  console.log("onInterest called for incoming interest: ", interest);
  
  if (nameHasCommandMarker(interest.name)) {
    console.log(interest.name, 'HAS COMMAND MARKER')
    command = getCommandMarker(interest.name);
    console.log(command);
    ndnr.prototype.executeCommand(interest, command);
    return;
  };

  console.log(interest.name);
  var returned = normalizeUri(interest.name)
  var normalizedName, requestedSegment;
  normalizedName = returned[0];
  requestedSegment = returned[1];
  var objectStoreName = normalizedName.toUri()
  
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
          var data = new Data(interest.name, new SignedInfo(), getBuffer.result);
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
  var objectStoreName = normalizeUri(name)[0].toUri();
  console.log(objectStoreName)
  //if (this.db.objectStoreNames.contains(objectStoreName)) {
    //Start Getting and putting segments
    var onData = function (interest, co) {
      var returns = normalizeUri(interest.name)
      var segmentNumber = returns[1]
      if (endsWithSegmentNumber(co.name)) {
        segmentNumber = DataUtils.bigEndianToUnsignedInt
          (co.name.components[co.name.components.length - 1].value);
        var objectStore = hook.db.transaction([objectStoreName], "readwrite").objectStore(objectStoreName);
        objectStore.put(co.content, segmentNumber).onsuccess = function (e) {
          console.log("added segment Number ", segmentNumber);
          if (isLastSegment(co.name, co)) {  
          console.log('got last segment')
        } else {
          console.log(name, co)
          newName = name.getPrefix(name.components.length - 1).appendSegment(segmentNumber + 1);
          console.log(newName)
          hook.face.expressInterest(newName, onData, onTimeout);
        }
        };
        
      }
    };
    
  //} else {
    //Upgrade DataBase 
  
  //};
  

    var onTimeout = function (interest) {
      console.log("timeout");
    };
    
  
  
  
  
  this.face.expressInterest(name, onData, onTimeout);
};

ndnr.prototype.executeCommand = function (interest, command) {
  if (command == '%C1.META') {
    console.log(getNameWithoutCommandMarker(interest.name))
    this.getContent()
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
      hook.putArbitraryData(callback.data, name);
    };
   
  };
  
  Request.onblocked = function (event){
    console.log('request blocked: ', event );
  };

};


function chunkArbitraryData(data, name) {
  var ndnArray = [];

  if (typeof data == 'object') {
    var string = JSON.stringify(data);
  } else if (typeof data == 'string') {
    var string = data;
  } else if (typeof data == 'file') {
    console.log('no handlers yet for datatype: ', typeof data);
    return;
  };

  var stringArray = string.match(/.{1,4000}/g);
  var segmentNames = [];
  console.log(stringArray.length)
  for (i = 0; i < stringArray.length; i++) {
    ndnArray[i] = stringArray[i]
    ndnArray[i] = new Buffer(stringArray[i]);
  };
  
  return ndnArray;

};

initSegment = function (seg) {
    if (seg == null || seg == 0)
	  return (new Buffer('00', 'hex'));

    var segStr = seg.toString(16);

    if (segStr.length % 2 == 1)
	segStr = '0' + segStr;

    segStr = '00' + segStr;
    return (new Buffer(segStr, 'hex'));
};

function getAllPrefixes(name) {
  var uriArray = [];
  for (i = 0 ; i < name.components.length + 1 ; i++) {
    var uri = name.getPrefix(i).toUri()
    uriArray.push(uri);
  };
  return uriArray;
};

function isFirstSegment(name) {
    console.log('first?', name.components[name.components.length - 1].value[0]);
    return name.components != null && name.components.length >= 1 &&
        name.components[name.components.length - 1].value.length == 1 &&
        name.components[name.components.length - 1].value[0] == 0;
};

function isLastSegment(name, co) {
    console.log(name.components[name.components.length - 1],co.signedInfo.finalBlockID)
    return DataUtils.arraysEqual(name.components[name.components.length - 1].value, co.signedInfo.finalBlockID);
}


function normalizeUri(name) {
  if (!endsWithSegmentNumber(name)) {
    normalizedName = name.appendSegment(0);
    requestedSegment = 0
  } else if (!isFirstSegment(name)) {
    normalizedName = name.getPrefix(name.components.length - 1).appendSegment(0);
    requestedSegment = DataUtils.bigEndianToUnsignedInt(name.components[name.components.length - 1].value);
    console.log('ends with segment number but not first', DataUtils.bigEndianToUnsignedInt(name.components[name.components.length - 1].value))
  } else {
    normalizedName = name;
    requestedSegment = 0;
    console.log(isFirstSegment(name))
  };
  console.log('requestedSegment', requestedSegment)
  var returns = [normalizedName, requestedSegment];
  return returns
};



function endsWithSegmentNumber(name) {
  console.log(name)
    return name.components != null && name.components.length >= 1 &&
        name.components[name.components.length - 1].value.length >= 1 &&
        name.components[name.components.length - 1].value[0] == 0;
}

function nameHasCommandMarker(name) {
  for (var i = name.size() - 1; i >= 0; --i) {
    var component = name.components[i].getValue();
    if (component.length <= 0)
      continue;
        
    if (component[0] == 0xC1) {
      return true
    };
  }
    
  return false;
};

function getCommandMarker(name) {
  for (var i = name.size() - 1; i >= 0; --i) {
    var component = name.components[i].getValue();
    if (component.length <= 0)
      continue;
        
    if (component[0] == 0xC1) {
      return name.components[i].toEscapedString()
    };
  }
};

function getNameWithoutCommandMarker(name) {
  var strippedName = new Name('');
  for (var i = name.size() - 1; i >= 0; --i) {
    var component = name.components[i].getValue();
    if (component.length <= 0)
      continue;
        
    if (component[0] != 0xC1) {
      strippedName.append(name.components[i]);
    };
  }
  return strippedName;
};


var commandMarkers = {}

commandMarkers.startWrite = new Uint8Array([0xc1, 0x2e, 0x4d, 0x45, 0x54, 0x41]);
