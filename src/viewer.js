

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

        //private state properties
        previousBody: [],

        //These are originally not part options but declared as members
        //in initialize. It's still considered idiomatic to put them here
        source: null,

        drawer: null,
        world: null,

        viewport: null,


        //A collection viewport is a separate viewport used to provide
        //simultaneous rendering of sets of tiles
        collectionViewport: null,
        collectionDrawer: null,

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

    //TODO: these can be closure private and shared across Viewer
    // instances.
    this.bodyWidth = document.body.style.width;
    this.bodyHeight = document.body.style.height;
    this.bodyOverflow = document.body.style.overflow;
    this.docOverflow = document.documentElement.style.overflow;

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
    this.world.addHandler('item-index-change', function(event) {
        // For backwards compatibility, we maintain the source property
        _this.source = _this.world.getItemAt(0).source;
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
        viewer: this,
        margins: this.viewportMargins
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
$.extend( $.Viewer.prototype, $.EventSource.prototype, {

    isOpen: function () {
        return !!this.world.getItemCount();
    },
    open: function (tileSources) {
        var _this = this;

        this.close();

        if (!tileSources) {
            return;
        }
        if (this.sequenceMode && $.isArray(tileSources)) {
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
                    // TODO: what if there are multiple sources?
                    _this.raiseEvent( 'open', { source: source } );
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
            if (options.collectionImmediately === undefined) {
                options.collectionImmediately = true;
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
        this.raiseEvent( 'close' );

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
    isVisible: function () {
        return this.container.style.visibility != "hidden";
    },
    setVisible: function( visible ){
        this.container.style.visibility = visible ? "" : "hidden";

        this.raiseEvent( 'visible', { visible: visible } );
        return this;
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
            _this.raiseEvent( 'add-item-failed', event );

            if (options.error) {
                options.error(event);
            }
        }
        function refreshWorld(theItem) {
            if (_this.collectionMode) {
                _this.world.arrange({
                    immediately: theItem.options.collectionImmediately,
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
                    iOSDevice: _this.iOSDevice,
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
        getTileSourceImplementation( this, options.tileSource, options, function( tileSource ) {
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
    addSimpleImage: function(options) {

        var opts = $.extend({}, options, {
            tileSource: {
                type: 'image',
                url: options.url
            }
        });
        delete opts.url;
        this.addTiledImage(opts);
    },
    forceRedraw: function() {
        THIS[ this.hash ].forceRedraw = true;
        return this;
    },
    currentPage: function() {
        return this._sequenceIndex;
    },
    goToPage: function( page ){
        if( this.tileSources && page >= 0 && page < this.tileSources.length ){
            this._sequenceIndex = page;

            this.open( this.tileSources[ page ] );

            this.raiseEvent( 'page', { page: page } );
        }
        return this;
    },
    _cancelPendingImages: function() {
        this._loadQueue = [];
    },
});
function _getSafeElemSize (oElement) {
    oElement = $.getElement( oElement );

    return new $.Point(
        (oElement.clientWidth === 0 ? 1 : oElement.clientWidth),
        (oElement.clientHeight === 0 ? 1 : oElement.clientHeight)
    );
}
function getTileSourceImplementation( viewer, tileSource, imgOptions, successCallback,
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

    if (viewportChange) {
        viewer.raiseEvent('viewport-change');
    }
    if ( !THIS[ viewer.hash ].animating && animated ) {
        viewer.raiseEvent( "animation-start" );
    }
    if ( animated || THIS[ viewer.hash ].forceRedraw || viewer.world.needsDraw() ) {
        drawWorld( viewer );
        THIS[ viewer.hash ].forceRedraw = false;

        if (animated) {
            viewer.raiseEvent( "animation" );
        }
    }
    if ( THIS[ viewer.hash ].animating && !animated ) {
        viewer.raiseEvent( "animation-finish" );
    }
    THIS[ viewer.hash ].animating = animated;

    //viewer.profiler.endUpdate();
}
function drawWorld( viewer ) {
    viewer.imageLoader.clear();
    viewer.drawer.clear();
    viewer.world.draw();
    viewer.raiseEvent( 'update-viewport', {} );
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
