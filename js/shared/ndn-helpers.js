function b64toBlob(b64Data, contentType, sliceSize) {
    contentType = contentType || '';
    sliceSize = sliceSize || 512;
    console.log(contentType)
    var byteCharacters = atob(b64Data);
    var byteArrays = [];

    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        var slice = byteCharacters.slice(offset, offset + sliceSize);
        console.log(offset)
        var byteNumbers = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        var byteArray = new Uint8Array(byteNumbers);

        byteArrays.push(byteArray);
    }

    var blob = new Blob(byteArrays, {type: contentType});
    return blob;
}


function chunkArbitraryData(name, data) {
  var ndnArray = [];
  console.log(data)
  if (typeof data == 'object') {
    var string = JSON.stringify(data);
  } else if (typeof data == 'string') {
    var string = data;
  } else if (typeof data == 'file') {
    //console.log('no handlers yet for datatype: ', typeof data);
    return;
  };

  var stringArray = string.match(/.{1,4000}/g);
  var segmentNames = [];
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
    return name.components != null && name.components.length >= 1 &&
        name.components[name.components.length - 1].value.length == 1 &&
        name.components[name.components.length - 1].value[0] == 0;
};

function isLastSegment(name, co) {
   
    return DataUtils.arraysEqual(name.components[name.components.length - 1].value, co.signedInfo.finalBlockID);
}

function normalizeUri(name) {
  //console.log(name)
  if (!endsWithSegmentNumber(name)) {
    normalizedName = name;
    requestedSegment = 0
  } else if (!isFirstSegment(name)) {
    normalizedName = name.getPrefix(name.components.length - 1);
    requestedSegment = DataUtils.bigEndianToUnsignedInt(name.components[name.components.length - 1].value);
  } else {
    normalizedName = name.getPrefix(name.components.length - 1) ;
    requestedSegment = 0;
  };
  var returns = [normalizedName, requestedSegment];
  return returns;
};

function getSegmentInteger(name) {
  if (name.components != null && name.components.length >= 1 &&
  name.components[name.components.length - 1].value.length >= 1 &&
  name.components[name.components.length - 1].value[0] == 0) {
    return DataUtils.bigEndianToUnsignedInt(name.components[name.components.length - 1].value)
  } else {
    return 0;
  }
};

function normalizeNameToObjectStore(name) {
  var throwaway = getNameWithoutCommandMarker(name); 
  
  if (!endsWithSegmentNumber(throwaway)) {
    return throwaway.appendSegment(0).toUri();
  } else if (!isFirstSegment(throwaway)) {
    return throwaway.getPrefix(name.components.length - 1).appendSegment(0).toUri();
  } else {
    return throwaway.toUri();
  };
};

function endsWithSegmentNumber(name) {
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
  console.log(name)
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
  
  for (var i = 0 ; i < name.size(); i++) {
    var component = name.components[i].getValue();
    if (component.length <= 0)
      continue;
        
    if (component[0] != 0xC1) {
      strippedName.append(name.components[i]);
    };
  };
  return strippedName;
};

function getSuffix(name, p) {
    return new Name(name.components.slice(p));
};

function appendVersion(name, date) {
    if (date) {
      var d = date
    } else {
      var d = new Date();
    };
    var time = d.getTime().toString(16);

    if (time.length % 2 == 1) {
	    time = '0' + time;
    };
    time = 'fd' + time;
    var binTime = new Buffer(time, 'hex');
    return name.append(binTime);
};

var commandMarkers = {}

commandMarkers["%C1.R.sw"] = function startWrite( prefix, interest) {
  var localName = getNameWithoutCommandMarker(getSuffix(interest.name, prefix.components.length)),
      objectStoreName = normalizeNameToObjectStore(localName);
  this["%C1.R.sw"].component = new Name.Component("%C1.R.sw");
  console.log("Building objectStore Tree for ", objectStoreName);
  buildObjectStoreTree(prefix, objectStoreName, recursiveSegmentRequest, this.onInterest.face)
};

function recursiveSegmentRequest(face, prefix, objectStoreName) {
  var dbName = prefix.toUri();
      firstSegmentName = (new Name(prefix)).append(new Name(objectStoreName));
      insertSegment = {};
      
      insertSegment.onsuccess = function(e) {
        e.target.result.onversionchange = function(e){
          console.log('version change requested, closing db');
          e.target.close();
        };
        var currentSegment = getSegmentInteger(contentObject.name),
            finalSegment = DataUtils.bigEndianToUnsignedInt(contentObject.signedInfo.finalBlockID);
            
        e.target.result.transaction(objectStoreName).objectStore(objectStoreName, "readwrite").put(contentObject.encode(), currentSegment).onsuccess = function(e) {
          console.log("retrieved and stored segment ", currentSegment, " of ", finalSegment  ," into objectStore ", objectStoreName);
          var newName = firstSegmentName.getPrefix(firstSegmentName.components.length - 1).appendSegment(currentSegment + 1);
          face.expressInterest(newName, onData, onTimeout)
        };
      };
  
  function onData(interest, contentObject) {
    console.log("onData called in recursiveSegmentRequest: ", contentObject)
    useIndexedDB(dbName, insertSegment)
  };
  
  function onTimeout(interest) {
    console.log("Interest Timed out in recursiveSegmentRequest: ", interest);
  };
  
  face.expressInterest(firstSegmentName, onData, onTimeout);
};

function buildObjectStoreTree(prefix, objectStoreName, onFinished, arg) {
  var dbName = prefix.toUri(),
      properName = new Name(objectStoreName),
      uriArray = getAllPrefixes(properName),
      toCreate = [],
      evaluate = {},
      growTree = {},
      newVersion;
 
      evaluate.onsuccess = function(e) {
        e.target.result.onversionchange = function(e){
          console.log('version change requested, closing db');
          e.target.close();
        };
        for (i = 0 ; i < uriArray.length; i++) {
          if (!e.target.result.objectStoreNames.contains(uriArray[i])) {
            toCreate.push(uriArray[i]);
          };
        };
        console.log(toCreate.length, " objectStores need to be created. Attempting to upgrade database");
        newVersion = e.target.result.version + 1;
        useIndexedDB(dbName, growTree, newVersion);
      };
      
      
      growTree.onupgradeneeded = function(e) {
        console.log("growTree.onupgradeneeded fired: creating ", toCreate.length, " new objectStores");
        for(i = 0; i < toCreate.length; i++) {
        console.log(toCreate[i], objectStoreName)
          if (toCreate[i] == objectStoreName) {
            e.target.result.createObjectStore(toCreate[i])
            
          } else {
            
            e.target.result.createObjectStore(toCreate[i], {keyPath: "escapedString"});          
          };
        };
      };
      
      growTree.onsuccess = function(e) {
        e.target.result.onversionchange = function(e){
          console.log('version change requested, closing db');
          e.target.close();
        };
        console.log("database successfully upgraded to version ", e.target.result.version);
        var transaction = e.target.result.transaction(uriArray, "readwrite")
        transaction.oncomplete = function(e) {
          console.log("New Tree successfully populated, now calling onFinished(arg) if applicable")
          if (onFinished) {
            if (arg) {
              onFinished(arg)
            } else {
              onFinished()
            };
          };
        };
        
        uriArray.pop();
        
        (function populate(i) {
          var entry = {};
          entry.component = properName.components[i];
          console.log(entry)
          entry.escapedString = entry.component.toEscapedString();
          transaction.objectStore(uriArray[i]).put(entry);
          i++;
          if (i < uriArray.length) {
            populate(i);
          };
        })(0)
      };
      
  useIndexedDB(dbName, evaluate);
};
