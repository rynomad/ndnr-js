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
  console.log(name)
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
    segmentNames[i] = new Name(name).appendSegment(i)
    co = new Data(segmentNames[i], new SignedInfo(), new Buffer(stringArray[i]));
    co.signedInfo.setFields()
    co.signedInfo.finalBlockID = initSegment(stringArray.length - 1)
    co.sign()
    ndnArray[i] = co.encode()
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
        
    if (component[0] == 0xC1 && component[2] != 0x4E) {
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
      
  
  console.log("Building objectStore Tree for ", objectStoreName, this);
  
  buildObjectStoreTree(prefix, objectStoreName, recursiveSegmentRequest, interest.face);
};
commandMarkers["%C1.R.sw"].component = new Name.Component([0xc1, 0x2e, 0x52, 0x2e, 0x73, 0x77]);


