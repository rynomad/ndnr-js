var ndnGetFile = function (name, source, callback) {
  var contentArray = []
  var onData = function (interest, co) {
    var returns = normalizeUri(interest.name)
    var segmentNumber = returns[1]
    console.log(interest, co)
    if (endsWithSegmentNumber(co.name)) {
      segmentNumber = DataUtils.bigEndianToUnsignedInt
        (co.name.components[co.name.components.length - 1].value);
      
      contentArray.push(co.content.toString())
      console.log("added segment Number ", segmentNumber);
      if (isLastSegment(co.name, co)) {  
        console.log('got last segment', contentArray.length)
        var fullcontent = [];
        var dataurl = contentArray.join('')
       
        var b64data = dataurl.split(',')[1];
        var mime = dataurl.split(',')[0].split(':')[1].split(';')[0]
        
        var blob = b64toBlob(b64data, mime);
        var blobUrl = URL.createObjectURL(blob);
        
        var a = document.createElement('a');
        a.setAttribute('download', name.toUri());
        console.log(name.toUri())
        a.href = blobUrl;
        a.innerHTML = 'testing';
        document.body.appendChild(a);
      } else {
        //console.log(name, co)
        newName = name.getPrefix(name.components.length).appendSegment(segmentNumber + 1);
        //console.log(newName)
        source.expressInterest(newName, onData, onTimeout);
      };
     
      
    }
  };


  var onTimeout = function (interest) {
    console.log("timeout");
  };

  if (source instanceof Face) {
    source.expressInterest(name, onData, onTimeout)
  } else {
    console.log(source)
    source.get(name, callback)
  }
    
  

};



