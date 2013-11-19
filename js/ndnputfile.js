// Store an NDN content object segment
var ndnPutFile = function (name, file, destination, callback) {
  
  //start by organizing the data into an array of ndn buffer segments
  var chunkSize = 7000;
  var fileSize = (file.size - 1);
  console.log(fileSize)
  var ndnArray = []
  var loaded = function(e){
      var string = e.target.result;
      for(var i =0; i < string.length; i += chunkSize) {
        var chunk = string.slice(i, chunkSize + i);
        
        ndnArray.push(new Buffer(chunk));
      };
      console.log(string.length/chunkSize);
  };
  var reader = new FileReader();
  reader.onload = loaded;
  reader.readAsDataURL(file);

  


  if (destination instanceof Face) { //we're putting a file to an ndnr over the network
    function onInterest(prefix, interest, transport) {
      //console.log("onInterest called.", interest.name.components.length, ndnArray[ndnArray.length - 1]);
      if (!endsWithSegmentNumber(interest.name)) {
        interest.name.appendSegment(0);
      };
      var segment = DataUtils.bigEndianToUnsignedInt(interest.name.components[interest.name.components.length - 1].value)
      var data = new Data(interest.name, new SignedInfo(), ndnArray[segment]);
      //console.log(ndnArray[segment])
      data.signedInfo.setFields();
      data.signedInfo.finalBlockID = initSegment(ndnArray.length - 1);
      data.sign();
      //console.log('getting here')
      var encodedData = data.encode();
      
      try {
        //console.log("Send content " + ndnArray[segment]);
        transport.send(encodedData);
      } catch (e) {
        console.log(e.toString());
      }
    };
    function sendWriteCommand() {
      var onTimeout = function (interest) {
        //console.log("timeout", interest);
      };
      destination.expressInterest(name.append(commandMarkers.startWrite), null, onTimeout);
      //console.log("did this time correctly?")
    }; 
    console.log(name, destination)
    destination.registerPrefix(new Name(name.toUri()), onInterest)
    setTimeout(sendWriteCommand, 5000)
    
  } else if (destination instanceof ndnr) {//we're putting directly into ndnr
  
    destination.put
  };
};
