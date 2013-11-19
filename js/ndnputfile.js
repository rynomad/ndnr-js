// Store an NDN content object segment


var ndnPutFile = function (file, name) {
  console.log(file);
  var chunkSize = 7000;
  var fileSize = (file.size - 1);
  var ndnArray = []
  var loaded = function(e){
      ndnArray.push( new Buffer(e.target.result));
  };

  for(var i =0; i < fileSize; i += chunkSize) {
      (function( fil, start ) {
          var reader = new FileReader();
          var blob = fil.slice(start, chunkSize + start);
          reader.onload = loaded;
          reader.readAsDataURL(blob);
      })( file, i );
  };
  function onInterest(prefix, interest, transport)
    {
      console.log("onInterest called.", interest.name.components.length, ndnArray[ndnArray.length - 1]);
      if (!endsWithSegmentNumber(interest.name)) {
        interest.name.appendSegment(0);
      };
      var segment = DataUtils.bigEndianToUnsignedInt(interest.name.components[interest.name.components.length - 1].value)
      var data = new Data(interest.name, new SignedInfo(), ndnArray[segment]);
      console.log(ndnArray[segment])
      data.signedInfo.setFields();
      data.signedInfo.finalBlockID = initSegment(ndnArray.length - 1);
      data.sign();
      console.log('getting here')
      var encodedData = data.encode();
      
      try {
        console.log("Send content " + ndnArray[segment]);
        transport.send(encodedData);
      } catch (e) {
        console.log(e.toString());
      }
    }
  var face = new Face({host: location.host.split(':')[0]})
  face.registerPrefix(name, onInterest)
 
};
