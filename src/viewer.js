(function( $ ){
// dictionary from hash to private properties
var THIS = {};
var nextHash = 1;

$.Viewer = function( options ) {
    var _this = this;

    //Public properties
    //Allow the options object to override global defaults
    $.extend( true, this, {
        //internal state and dom identifiers
        id: options.id,
        hash: options.hash || nextHash++,


        //dom nodes

        element: null,

        container: null,

        canvas: null,

        //These are originally not part options but declared as members
        //in initialize. It's still considered idiomatic to put them here
        source: null,

        drawer: null,
        world: null,

        viewport: null,

    }, $.DEFAULT_SETTINGS, options );
    if ( typeof ( this.hash) === "undefined" ) {
        throw new Error("A hash must be defined, either by specifying options.id or options.hash.");
    }
    if ( typeof ( THIS[ this.hash ] ) !== "undefined" ) {
        // We don't want to throw an error here, as the user might have discarded
        // the previous viewer with the same hash and now want to recreate it.
    }
    //Private state properties
    THIS[ this.hash ] = {
        "prevContainerSize": null,
        "animating": false,
        "forceRedraw": false,
        "zooming": false,
        "lastZoomTime": null
    };
    this._sequenceIndex = 0;
    this._updateRequestId = null;
    this._loadQueue = [];

    //Inherit some behaviors and properties
    $.EventSource.call( this );

    // TEMP from controldock.js
    this.container = $.makeNeutralElement( 'div' );

    this.element = this.element || document.getElementById( this.id );
    this.canvas = $.makeNeutralElement( "div" );

    this.canvas.className = "openseadragon-canvas";
    (function( style ){
        style.width = "100%";
        style.height = "100%";
        style.overflow = "hidden";
        style.position = "absolute";
        style.top = "0px";
        style.left = "0px";
    }(this.canvas.style));
    if (options.tabIndex !== "") {
        this.canvas.tabIndex = (options.tabIndex === undefined ? 0 : options.tabIndex);
    }
    this.container.className = "openseadragon-container";
    (function( style ){
        style.width = "100%";
        style.height = "100%";
        style.position = "relative";
        style.overflow = "hidden";
        style.left = "0px";
        style.top = "0px";
        style.textAlign = "left"; // needed to protect against
    }( this.container.style ));
    this.container.insertBefore( this.canvas, this.container.firstChild );
    this.element.appendChild( this.container );

    THIS[ this.hash ].prevContainerSize = _getSafeElemSize( this.container );

    // Create the world
    this.world = new $.World({
        viewer: this
    });
    this.world.addHandler('add-item', function(event) {
        // For backwards compatibility, we maintain the source property
        _this.source = _this.world.getItemAt(0).source;

        THIS[ _this.hash ].forceRedraw = true;

        if (!_this._updateRequestId) {
            _this._updateRequestId = scheduleUpdate( _this, updateMulti );
        }
    });
    this.world.addHandler('remove-item', function(event) {
        // For backwards compatibility, we maintain the source property
        if (_this.world.getItemCount()) {
            _this.source = _this.world.getItemAt(0).source;
        } else {
            _this.source = null;
        }
        THIS[ _this.hash ].forceRedraw = true;
    });
    this.world.addHandler('metrics-change', function(event) {
        if (_this.viewport) {
            _this.viewport._setContentBounds(_this.world.getHomeBounds(), _this.world.getContentFactor());
        }
    });
    // Create the viewport
    this.viewport = new $.Viewport({
        containerSize: THIS[ this.hash ].prevContainerSize,
        springStiffness: this.springStiffness,
        animationTime: this.animationTime,
        minZoomImageRatio: this.minZoomImageRatio,
        maxZoomPixelRatio: this.maxZoomPixelRatio,
        visibilityRatio: this.visibilityRatio,
        defaultZoomLevel: this.defaultZoomLevel,
        minZoomLevel: this.minZoomLevel,
        maxZoomLevel: this.maxZoomLevel,
        viewer: this
    });
    this.viewport._setContentBounds(this.world.getHomeBounds(), this.world.getContentFactor());

    // Create the image loader
    this.imageLoader = new $.ImageLoader({
        jobLimit: this.imageLoaderLimit,
        timeout: options.timeout
    });
    // Create the tile cache
    this.tileCache = new $.TileCache({
        maxImageCacheCount: this.maxImageCacheCount
    });
    // Create the drawer
    this.drawer = new $.Drawer({
        viewer: this,
        viewport: this.viewport,
        element: this.canvas
    });

    // Open initial tilesources
    if (this.tileSources) {
        this.open( this.tileSources );
    }
};
$.Viewer.prototype = {
    isOpen: function () {
        return !!this.world.getItemCount();
    },
    open: function (tileSources) {
        var _this = this;

        this.close();

        if (!tileSources) {
            return;
        }
        if ($.isArray(tileSources)) {
            this.tileSources = tileSources;
            this._sequenceIndex = 0;
            if (this.tileSources.length) {
                this.open(this.tileSources[this._sequenceIndex]);
            }
            return;
        }
        if (!$.isArray(tileSources)) {
            tileSources = [tileSources];
        }
        if (!tileSources.length) {
            return;
        }
        this._opening = true;

        var expected = tileSources.length;
        var successes = 0;
        var failures = 0;
        var failEvent;

        var checkCompletion = function() {
            if (successes + failures === expected) {
                if (successes) {
                    _this.viewport.goHome( true );
                    _this.viewport.update();

                    var source = tileSources[0];
                    if (source.tileSource) {
                        source = source.tileSource;
                    }
                    _this._opening = false;
                } else {
                    _this._opening = false;
                    _this.raiseEvent( 'open-failed', failEvent );
                }
            }
        };
        var doOne = function(options) {
            if (!$.isPlainObject(options) || !options.tileSource) {
                options = {
                    tileSource: options
                };
            }
            if (options.index !== undefined) {
                delete options.index;
            }
            var originalSuccess = options.success;
            options.success = function(event) {
                successes++;

                if (originalSuccess) {
                    originalSuccess(event);
                }
                checkCompletion();
            };
            var originalError = options.error;
            options.error = function(event) {
                failures++;

                if (!failEvent) {
                    failEvent = event;
                }
                if (originalError) {
                    originalError(event);
                }
                checkCompletion();
            };
            _this.addTiledImage(options);
        };
        // TileSources
        for (var i = 0; i < tileSources.length; i++) {
            doOne(tileSources[i]);
        }
        return this;
    },
    close: function ( ) {
        if ( !THIS[ this.hash ] ) {
            //this viewer has already been destroyed: returning immediately
            return this;
        }
        this._opening = false;

        THIS[ this.hash ].animating = false;
        this.world.removeAll();
        this.imageLoader.clear();

        return this;
    },
    destroy: function( ) {
        if ( !THIS[ this.hash ] ) {
            //this viewer has already been destroyed: returning immediately
            return;
        }
        this.close();

        if ( this._updateRequestId !== null ) {
            $.cancelAnimationFrame( this._updateRequestId );
            this._updateRequestId = null;
        }
        if ( this.drawer ) {
            this.drawer.destroy();
        }
        this.removeAllHandlers();

        // Go through top element (passed to us) and remove all children
        // Use removeChild to make sure it handles SVG or any non-html
        // also it performs better - http://jsperf.com/innerhtml-vs-removechild/15
        if (this.element){
            while (this.element.firstChild) {
                this.element.removeChild(this.element.firstChild);
            }
        }
        THIS[ this.hash ] = null;
        delete THIS[ this.hash ];

        // clear all our references to dom objects
        this.canvas = null;
        this.container = null;

        // clear our reference to the main element - they will need to pass it in again, creating a new viewer
        this.element = null;
    },
    addTiledImage: function( options ) {

        var _this = this;

        if (options.replace) {
            options.replaceItem = _this.world.getItemAt(options.index);
        }

        if (options.ajaxWithCredentials === undefined) {
            options.ajaxWithCredentials = this.ajaxWithCredentials;
        }
        if (options.makeAjaxRequest === undefined) {
            options.makeAjaxRequest = options.tileSource.makeAjaxRequest;
        }
        if (options.ajaxHeaders === undefined || options.ajaxHeaders === null) {
            options.ajaxHeaders = this.ajaxHeaders;
        } else if ($.isPlainObject(options.ajaxHeaders) && $.isPlainObject(this.ajaxHeaders)) {
            options.ajaxHeaders = $.extend({}, this.ajaxHeaders, options.ajaxHeaders);
        }
        var myQueueItem = {
            options: options
        };
        function raiseAddItemFailed( event ) {
            for (var i = 0; i < _this._loadQueue.length; i++) {
                if (_this._loadQueue[i] === myQueueItem) {
                    _this._loadQueue.splice(i, 1);
                    break;
                }
            }
            if (_this._loadQueue.length === 0) {
                refreshWorld(myQueueItem);
            }

            if (options.error) {
                options.error(event);
            }
        }
        function refreshWorld(theItem) {
            if (_this.collectionMode) {
                _this.world.arrange({
                    rows: _this.collectionRows,
                    columns: _this.collectionColumns,
                    tileSize: _this.collectionTileSize,
                    tileMargin: _this.collectionTileMargin
                });
                _this.world.setAutoRefigureSizes(true);
            }
        }
        if ($.isArray(options.tileSource)) {
            setTimeout(function() {
                raiseAddItemFailed({
                    message: "[Viewer.addTiledImage] Sequences can not be added; add them one at a time instead.",
                    source: options.tileSource,
                    options: options
                });
            });
            return;
        }
        this._loadQueue.push(myQueueItem);

        function processReadyItems() {
            var queueItem, tiledImage;
            while (_this._loadQueue.length) {
                queueItem = _this._loadQueue[0];
                if (!queueItem.tileSource) {
                    break;
                }
                _this._loadQueue.splice(0, 1);

                if (queueItem.options.replace) {
                    var newIndex = _this.world.getIndexOfItem(queueItem.options.replaceItem);
                    if (newIndex != -1) {
                        queueItem.options.index = newIndex;
                    }
                    _this.world.removeItem(queueItem.options.replaceItem);
                }
                tiledImage = new $.TiledImage({
                    viewer: _this,
                    source: queueItem.tileSource,
                    viewport: _this.viewport,
                    drawer: _this.drawer,
                    tileCache: _this.tileCache,
                    imageLoader: _this.imageLoader,
                    x: queueItem.options.x,
                    y: queueItem.options.y,
                    width: queueItem.options.width,
                    height: queueItem.options.height,
                    fitBounds: queueItem.options.fitBounds,
                    clip: queueItem.options.clip,
                    springStiffness: _this.springStiffness,
                    animationTime: _this.animationTime,
                    minZoomImageRatio: _this.minZoomImageRatio,
                    minPixelRatio: _this.minPixelRatio,
                    smoothTileEdgesMinZoom: _this.smoothTileEdgesMinZoom,
                    ajaxWithCredentials: queueItem.options.ajaxWithCredentials,
                    makeAjaxRequest: queueItem.options.makeAjaxRequest,
                    ajaxHeaders: queueItem.options.ajaxHeaders
                });
                if (_this.collectionMode) {
                    _this.world.setAutoRefigureSizes(false);
                }
                _this.world.addItem( tiledImage, {
                    index: queueItem.options.index
                });
                if (_this._loadQueue.length === 0) {
                    //this restores the autoRefigureSizes flag to true.
                    refreshWorld(queueItem);
                }
                _this.viewport.goHome(true);
                if (queueItem.options.success) {
                    queueItem.options.success({
                        item: tiledImage
                    });
                }
            }
        }
        getTileSourceImplementation( this, options.tileSource, function( tileSource ) {
            myQueueItem.tileSource = tileSource;

            // add everybody at the front of the queue that's ready to go
            processReadyItems();
        }, function( event ) {
            event.options = options;
            raiseAddItemFailed(event);

            // add everybody at the front of the queue that's ready to go
            processReadyItems();
        } );
    },
    _cancelPendingImages: function() {
        this._loadQueue = [];
    },
};
$.extend($.Viewer.prototype, $.EventSource.prototype);

function _getSafeElemSize (oElement) {
    oElement = $.getElement( oElement );

    return new $.Point(
        (oElement.clientWidth === 0 ? 1 : oElement.clientWidth),
        (oElement.clientHeight === 0 ? 1 : oElement.clientHeight)
    );
}
function getTileSourceImplementation( viewer, tileSource, successCallback,
    failCallback ) {
    var _this = viewer;

    //allow plain xml strings or json strings to be parsed here
    if ( $.type( tileSource ) == 'string' ) {
        //xml should start with "<" and end with ">"
        if ( tileSource.match( /^\s*<.*>\s*$/ ) ) {
            tileSource = $.parseXml( tileSource );
        //json should start with "{" or "[" and end with "}" or "]"
        } else if ( tileSource.match(/^\s*[\{\[].*[\}\]]\s*$/ ) ) {
            try {
              var tileSourceJ = $.parseJSON(tileSource);
              tileSource = tileSourceJ;
            } catch (e) {
              //tileSource = tileSource;
            }
        }
    }
    function waitUntilReady(tileSource, originalTileSource) {
        if (tileSource.ready) {
            successCallback(tileSource);
        } else {
            tileSource.addHandler('ready', function () {
                successCallback(tileSource);
            });
            tileSource.addHandler('open-failed', function (event) {
                failCallback({
                    message: event.message,
                    source: originalTileSource
                });
            });
        }
    }
    setTimeout( function() {
        if ( $.type( tileSource ) == 'string' ) {
            //If its still a string it means it must be a url at this point
            tileSource = new $.TileSource({
                url: tileSource,
                ajaxWithCredentials: viewer.ajaxWithCredentials,
                ajaxHeaders: viewer.ajaxHeaders,
                success: function( event ) {
                    successCallback( event.tileSource );
                }
            });
            tileSource.addHandler( 'open-failed', function( event ) {
                failCallback( event );
            } );
        } else if ($.isPlainObject(tileSource) || tileSource.nodeType) {
            if (tileSource.ajaxWithCredentials === undefined) {
                tileSource.ajaxWithCredentials = viewer.ajaxWithCredentials;
            }
            if ( $.isFunction( tileSource.getTileUrl ) ) {
                //Custom tile source
                var customTileSource = new $.TileSource( tileSource );
                customTileSource.getTileUrl = tileSource.getTileUrl;
                successCallback( customTileSource );
            } else {
                //inline configuration
                var $TileSource = $.TileSource.determineType( _this, tileSource );
                if ( !$TileSource ) {
                    failCallback( {
                        message: "Unable to load TileSource",
                        source: tileSource
                    });
                    return;
                }
                var options = $TileSource.prototype.configure.apply( _this, [ tileSource ] );
                waitUntilReady(new $TileSource(options), tileSource);
            }
        } else {
            //can assume it's already a tile source implementation
            waitUntilReady(tileSource, tileSource);
        }
    });
}
///////////////////////////////////////////////////////////////////////////////
// Schedulers provide the general engine for animation
///////////////////////////////////////////////////////////////////////////////
function scheduleUpdate( viewer, updateFunc ){
    return $.requestAnimationFrame( function(){
        updateFunc( viewer );
    } );
}

///////////////////////////////////////////////////////////////////////////////
// Page update routines ( aka Views - for future reference )
///////////////////////////////////////////////////////////////////////////////

function updateMulti( viewer ) {
    updateOnce( viewer );

    // Request the next frame, unless we've been closed
    if ( viewer.isOpen() ) {
        viewer._updateRequestId = scheduleUpdate( viewer, updateMulti );
    } else {
        viewer._updateRequestId = false;
    }
}
function updateOnce( viewer ) {
    //viewer.profiler.beginUpdate();

    if (viewer._opening) {
        return;
    }
    var viewportChange = viewer.viewport.update();
    var animated = viewer.world.update() || viewportChange;

    if ( animated || THIS[ viewer.hash ].forceRedraw || viewer.world.needsDraw() ) {
        drawWorld( viewer );
        THIS[ viewer.hash ].forceRedraw = false;

    }
    THIS[ viewer.hash ].animating = animated;

    //viewer.profiler.endUpdate();
}
function drawWorld( viewer ) {
    viewer.imageLoader.clear();
    viewer.drawer.clear();
    viewer.world.draw();
}
///////////////////////////////////////////////////////////////////////////////
// Navigation
///////////////////////////////////////////////////////////////////////////////
function scheduleZoom( viewer ) {
    $.requestAnimationFrame( $.delegate( viewer, doZoom ) );
}
function doZoom() {
    var currentTime,
        deltaTime;

    if ( THIS[ this.hash ].zooming && this.viewport) {
        currentTime = $.now();
        deltaTime = currentTime - THIS[ this.hash ].lastZoomTime;
        var adjustedFactor = Math.pow( 0, deltaTime / 1000 );

        this.viewport.zoomBy( adjustedFactor );
        this.viewport.applyConstraints();
        THIS[ this.hash ].lastZoomTime = currentTime;
        scheduleZoom( this );
    }
}
}( OpenSeadragon ));
