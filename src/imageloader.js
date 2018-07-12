(function($){

  var readResponseArray = function(response) {

      var constructors = {
          1: Uint8Array, 
          2: Uint16Array, 
          4: Uint32Array, 
      };

      // Decode as png
      var img  = window.UPNG.decode(response);
      var height = img.height;
      var width = img.width;

      // Output response Array
      var depth = img.depth / 8;
      var typedSize = width * height;
      var max = Math.pow(2, img.depth) - 1;
      var TypedArray = constructors[depth];
      var responseArray = new TypedArray(typedSize);

      // Extract all pixel data
      var size = depth * width * height;
      for (var i = 0; i < size; i++) {
          var order = 1 - (i % depth);
          var target = Math.floor( i / depth );
          var value = Math.pow(255, order) * img.data[i];
          responseArray[target] += value; 
      }

      // typedImageData
      return {
          width: width,
          height: height,
          data: responseArray,
          max: max,
          min: 0,
      };
  };

function ImageJob (options) {
    $.extend(true, this, {
        timeout: $.DEFAULT_SETTINGS.timeout,
        makeAjaxRequest: $.makeAjaxRequest,
        jobId: null
    }, options);

    this.typedImageData = null;
}
ImageJob.prototype = {
    errorMsg: null,
    start: function(){
        var self = this;
        var selfAbort = this.abort;

        this.jobId = window.setTimeout(function(){
            self.errorMsg = "Image load exceeded timeout";
            self.finish(false);
        }, this.timeout);

        this.request = self.makeAjaxRequest({
            url: this.src,
            withCredentials: this.ajaxWithCredentials,
            headers: this.ajaxHeaders,
            responseType: "arraybuffer",
            success: function(request) {

                self.typedImageData.data = readResponseArray(request.response);

                // If empty consider the image load a failure.
                if (self.typedImageData.data.length === 0) {
                    self.errorMsg = "Empty image response.";
                    self.finish(false);
                    return;
                }
                self.finish(true);
            },
            error: function(request) {
                self.errorMsg = "Image load aborted - XHR error";
                self.finish(false);
            }
        });
        // Provide a function to properly abort the request.
        this.abort = function() {
            self.request.abort();

            // Call the existing abort function if available
            if (typeof selfAbort === "function") {
                selfAbort();
            }
        };
    },
    finish: function(successful) {
        if (!successful) {
            this.typedImageData = null;
        }
        if (this.jobId) {
            window.clearTimeout(this.jobId);
        }
        this.callback(this);
    }
};
$.ImageLoader = function(options) {
    $.extend(true, this, {
        jobLimit: $.DEFAULT_SETTINGS.imageLoaderLimit,
        timeout: $.DEFAULT_SETTINGS.timeout,
        jobQueue: [],
        jobsInProgress: 0
    }, options);
};
$.ImageLoader.prototype = {

    addJob: function(options) {
        var _this = this,
            complete = function(job) {
                completeJob(_this, job, options.callback);
            },
            jobOptions = {
                src: options.src,
                ajaxHeaders: options.ajaxHeaders,
                ajaxWithCredentials: options.ajaxWithCredentials,
                makeAjaxRequest: options.makeAjaxRequest,
                callback: complete,
                abort: options.abort,
                timeout: this.timeout
            },
            newJob = new ImageJob(jobOptions);

        if ( !this.jobLimit || this.jobsInProgress < this.jobLimit ) {
            newJob.start();
            this.jobsInProgress++;
        }
        else {
            this.jobQueue.push( newJob );
        }
    },
    clear: function() {
        for( var i = 0; i < this.jobQueue.length; i++ ) {
            var job = this.jobQueue[i];
            if ( typeof job.abort === "function" ) {
                job.abort();
            }
        }
        this.jobQueue = [];
    }
};
function completeJob(loader, job, callback) {
    var nextJob;

    loader.jobsInProgress--;

    if ((!loader.jobLimit || loader.jobsInProgress < loader.jobLimit) && loader.jobQueue.length > 0) {
        nextJob = loader.jobQueue.shift();
        nextJob.start();
        loader.jobsInProgress++;
    }
    callback(job.typedImageData, job.errorMsg, job.request);
}
}(OpenSeadragon));
