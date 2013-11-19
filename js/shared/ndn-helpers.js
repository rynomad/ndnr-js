function fileToSegmentArray(file) {
  var chunkSize = 7000;
  var fileSize = (file.size - 1);
  var ndnArray = []
  var loaded = function(e){
      ndnArray.push( new Buffer(e.target.result));
      console.log(i, file)
  };

  for(var i =0; i < fileSize; i += chunkSize) {
      (function( fil, start ) {
          var reader = new FileReader();
          var blob = fil.slice(start, chunkSize + start);
          reader.onload = loaded;
          reader.readAsDataURL(blob);
      })( file, i );
     
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
