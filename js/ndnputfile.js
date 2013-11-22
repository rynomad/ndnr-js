// Store an NDN content object segment
var ndnPutFile = function (name, file, destination, callback) {
  
  //start by organizing the data into an array of ndn buffer segments
  var chunkSize = 7000;
  var fileSize = (file.size - 1);
  var objectStoreName = (new Name(normalizeUri(name)[0].toUri())).appendSegment(0).toUri()
  console.log(objectStoreName)
  var ndnArray = []
  
  function sliceMe(file) {
    var fr = new FileReader,
        chunkSize = 7000,
        chunks = Math.ceil(file.size / chunkSize),
        
        chunk = 0;
        
        console.log(chunks)
    
    
    function loadNext() {
       var start, end,
           blobSlice = File.prototype.mozSlice || File.prototype.webkitSlice;

       start = chunk * chunkSize;
       end = start + chunkSize >= file.size ? file.size : start + chunkSize;

       fr.onloadend = function(e) {      
        var buff = new Buffer(e.target.result),
            store = destination.db.transaction(objectStoreName, 'readwrite').objectStore(objectStoreName);
          if (++chunk < chunks) {
            
            if (destination instanceof ndnr) {
              
              store.put( buff, chunk - 1).onsuccess = function (e) {
                console.log(chunk)
                loadNext();
              };
            };
          } else {
            if (destination instanceof ndnr) {
              store.put( buff, chunk - 1).onsuccess = function (e) {
                console.log('last chunk, ', chunk)
              };
            };
          
          
          };
       };
       var blob = file.slice(start,end);
       //console.log(blob)
       fr.readAsArrayBuffer(blob, (end - start));
    }
    
      loadNext();

    
}

sliceMe(file)
  


/*  if (destination instanceof Face) { //we're putting a file to an ndnr over the network
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
    console.log(destination)
    destination.put( name, ndnArray)
  }; */
};
