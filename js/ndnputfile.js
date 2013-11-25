
function ndnPutFile(name, file, destination, callback) {
  var chunkSize = 7000,
      fileSize = (file.size - 1),
      totalSegments = Math.ceil(file.size / chunkSize);
      
  function getSlice(file, segment, transport) {
    var fr = new FileReader,
        chunkSize = 7000,
        chunks = Math.ceil(file.size / chunkSize),
        start = segment * chunkSize,
        end = start + chunkSize >= file.size ? file.size : start + chunkSize,
        blob = file.slice(start,end);
    
    fr.onloadend = function(e) {      
      var buff = new Buffer(e.target.result),
          segmentName = (new Name(name)).appendSegment(segment),
          data = new Data(segmentName, new SignedInfo(), buff),
          encodedData;
        
        data.signedInfo.setFields();
        data.signedInfo.finalBlockID = initSegment(totalSegments - 1);
        data.sign();
        encodedData = data.encode();
        console.log(data, transport, new Date())
        transport.send(encodedData);
    };
    console.log("about to read as array buffer")
    fr.readAsArrayBuffer(blob, (end - start))
    
  
  };
  
  function onInterest(prefix, interest, transport) {
    console.log("onInterest called.", interest);
    if (!endsWithSegmentNumber(interest.name)) {
      interest.name.appendSegment(0);
    };
    var segment = DataUtils.bigEndianToUnsignedInt(interest.name.components[interest.name.components.length - 1].value);
        
    getSlice(this.onInterest.file, segment, transport)

  };
  onInterest.file = file;
  
  function sendWriteCommand() {
    var onTimeout = function (interest) {
      console.log("timeout", interest);
    };
    var onData = function(data) {
      console.log(data)
    };

    destination.expressInterest((new Name(name)).append(commandMarkers["%C1.R.sw"].component), onData, onTimeout);
    console.log("did this time correctly?")
  }; 
  console.log(name, destination)
  destination.registerPrefix(new Name(name.toUri()), onInterest)
  setTimeout(sendWriteCommand, 5000)

};

  


