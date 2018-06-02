

(function($){
function ImageJob (options) {
    $.extend(true, this, {
        timeout: $.DEFAULT_SETTINGS.timeout,
        makeAjaxRequest: $.makeAjaxRequest,
        jobId: null
    }, options);
    this.image = null;
}
ImageJob.prototype = {
    errorMsg: null,
    start: function(){
        var self = this;
        var selfAbort = this.abort;

        this.image = new Image();

        this.image.onload = function(){
            self.finish(true);
        };
        this.image.onabort = this.image.onerror = function() {
            self.errorMsg = "Image load aborted";
            self.finish(false);
        };
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
                var blb;
                // Make the raw data into a blob.
                // BlobBuilder fallback adapted from
                // http://stackoverflow.com/questions/15293694/blob-constructor-browser-compatibility
                try {
                    // Store the original response
                    self.image._array = request.response;
                    blb = new window.Blob([request.response]);
                } catch (e) {
                    var BlobBuilder = (
                        window.BlobBuilder ||
                        window.WebKitBlobBuilder ||
                        window.MozBlobBuilder ||
                        window.MSBlobBuilder
                    );
                    if (e.name === 'TypeError' && BlobBuilder) {
                        var bb = new BlobBuilder();
                        bb.append(request.response);
                        blb = bb.getBlob();
                    }
                }
                // If the blob is empty for some reason consider the image load a failure.
                if (blb.size === 0) {
                    self.errorMsg = "Empty image response.";
                    self.finish(false);
                }
                // Create a URL for the blob data and make it the source of the image object.
                // This will still trigger Image.onload to indicate a successful tile load.
                var url = (window.URL || window.webkitURL).createObjectURL(blb);
                self.image.src = url;
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
        this.image.onload = this.image.onerror = this.image.onabort = null;
        if (!successful) {
            this.image = null;
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
    callback(job.image, job.errorMsg, job.request);
}
}(OpenSeadragon));
