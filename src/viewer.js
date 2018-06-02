

(function( $ ){
// dictionary from hash to private properties
var THIS = {};
var nextHash = 1;

$.Viewer = function( options ) {
    var args = arguments,
        _this = this;

    //backward compatibility for positional args while prefering more
    //idiomatic javascript options object as the only argument
    if( !$.isPlainObject( options ) ){
        options = {
            id: args[ 0 ],
            xmlPath: args.length > 1 ? args[ 1 ] : undefined,
            prefixUrl: args.length > 2 ? args[ 2 ] : undefined
        };
    }
    //options.config and the general config argument are deprecated
    //in favor of the more direct specification of optional settings
    //being pass directly on the options object
    if ( options.config ){
        $.extend( true, options, options.config );
        delete options.config;
    }
    //Public properties
    //Allow the options object to override global defaults
    $.extend( true, this, {
        //internal state and dom identifiers
        id: options.id,
        hash: options.hash || nextHash++,

        initialPage: 0,

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

        navigator: null,

        //A collection viewport is a separate viewport used to provide
        //simultaneous rendering of sets of tiles
        collectionViewport: null,
        collectionDrawer: null,

        //UI image resources
        //TODO: rename navImages to uiImages
        navImages: null,

        //TODO: this is defunct so safely remove it
        profiler: null

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
        "fsBoundsDelta": new $.Point( 1, 1 ),
        "prevContainerSize": null,
        "animating": false,
        "forceRedraw": false,
        "mouseInside": false,
        "group": null,
        // whether we should be continuously zooming
        "zooming": false,
        // how much we should be continuously zooming by
        "zoomFactor": null,
        "lastZoomTime": null,
        "fullPage": false,
        "onfullscreenchange": null
    };
    this._sequenceIndex = 0;
    this._firstOpen = true;
    this._updateRequestId = null;
    this._loadQueue = [];

    this._lastScrollTime = $.now(); // variable used to help normalize the scroll event speed of different devices

    //Inherit some behaviors and properties
    $.EventSource.call( this );

    this.addHandler( 'open-failed', function ( event ) {
        var msg = $.getString( "Errors.OpenFailed", event.eventSource, event.message);
        _this._showMessage( msg );
    });

    //Deal with tile sources
    if (this.xmlPath) {
        //Deprecated option. Now it is preferred to use the tileSources option
        this.tileSources = [ this.xmlPath ];
    }
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
    $.setElementTouchActionNone( this.canvas );
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

    //Used for toggling between fullscreen and default container size
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
        wrapHorizontal: this.wrapHorizontal,
        wrapVertical: this.wrapVertical,
        defaultZoomLevel: this.defaultZoomLevel,
        minZoomLevel: this.minZoomLevel,
        maxZoomLevel: this.maxZoomLevel,
        viewer: this,
        degrees: this.degrees,
        navigatorRotate: this.navigatorRotate,
        homeFillsViewer: this.homeFillsViewer,
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
        element: this.canvas,
        debugGridColor: this.debugGridColor
    });

    //Instantiate a navigator if configured
    if ( this.showNavigator){
        this.navigator = new $.Navigator({
            id: this.navigatorId,
            position: this.navigatorPosition,
            sizeRatio: this.navigatorSizeRatio,
            maintainSizeRatio: this.navigatorMaintainSizeRatio,
            top: this.navigatorTop,
            left: this.navigatorLeft,
            width: this.navigatorWidth,
            height: this.navigatorHeight,
            autoResize: this.navigatorAutoResize,
            autoFade: this.navigatorAutoFade,
            prefixUrl: this.prefixUrl,
            viewer: this,
            navigatorRotate: this.navigatorRotate,
            crossOriginPolicy: this.crossOriginPolicy
        });
    }
    // Open initial tilesources
    if (this.tileSources) {
        this.open( this.tileSources );
    }
};
$.extend( $.Viewer.prototype, $.EventSource.prototype, {

    isOpen: function () {
        return !!this.world.getItemCount();
    },
    // deprecated
    openDzi: function ( dzi ) {
        return this.open( dzi );
    },
    // deprecated
    openTileSource: function ( tileSource ) {
        return this.open( tileSource );
    },
    open: function (tileSources, initialPage) {
        var _this = this;

        this.close();

        if (!tileSources) {
            return;
        }
        if (this.sequenceMode && $.isArray(tileSources)) {
            if (typeof initialPage != 'undefined' && !isNaN(initialPage)) {
              this.initialPage = initialPage;
            }
            this.tileSources = tileSources;
            this._sequenceIndex = Math.max(0, Math.min(this.tileSources.length - 1, this.initialPage));
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
                    if (_this._firstOpen || !_this.preserveViewport) {
                        _this.viewport.goHome( true );
                        _this.viewport.update();
                    }
                    _this._firstOpen = false;

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

        if ( this.navigator ) {
            this.navigator.close();
        }
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
    isMouseNavEnabled: function () {
        return false;
    },
    setMouseNavEnabled: function( enabled ){
        return this;
    },
    setDebugMode: function(debugMode){
        for (var i = 0; i < this.world.getItemCount(); i++) {
            this.world.getItemAt(i).debugMode = debugMode;
        }
        this.debugMode = debugMode;
        this.forceRedraw();
    },
    isFullPage: function () {
        return THIS[ this.hash ].fullPage;
    },
    setFullPage: function( fullPage ) {
        var body = document.body,
            bodyStyle = body.style,
            docStyle = document.documentElement.style,
            _this = this,
            nodes,
            i;

        //dont bother modifying the DOM if we are already in full page mode.
        if ( fullPage == this.isFullPage() ) {
            return this;
        }
        var fullPageEventArgs = {
            fullPage: fullPage,
            preventDefaultAction: false
        };
        this.raiseEvent( 'pre-full-page', fullPageEventArgs );
        if ( fullPageEventArgs.preventDefaultAction ) {
            return this;
        }
        if ( fullPage ) {
            this.elementSize = $.getElementSize( this.element );
            this.pageScroll = $.getPageScroll();

            this.elementMargin = this.element.style.margin;
            this.element.style.margin = "0";
            this.elementPadding = this.element.style.padding;
            this.element.style.padding = "0";

            this.bodyMargin = bodyStyle.margin;
            this.docMargin = docStyle.margin;
            bodyStyle.margin = "0";
            docStyle.margin = "0";

            this.bodyPadding = bodyStyle.padding;
            this.docPadding = docStyle.padding;
            bodyStyle.padding = "0";
            docStyle.padding = "0";

            this.bodyWidth = bodyStyle.width;
            this.docWidth = docStyle.width;
            bodyStyle.width = "100%";
            docStyle.width = "100%";

            this.bodyHeight = bodyStyle.height;
            this.docHeight = docStyle.height;
            bodyStyle.height = "100%";
            docStyle.height = "100%";

            //when entering full screen on the ipad it wasnt sufficient to leave
            //the body intact as only only the top half of the screen would
            //respond to touch events on the canvas, while the bottom half treated
            //them as touch events on the document body. Thus we remove and store
            //the bodies elements and replace them when we leave full screen.
            this.previousBody = [];
            THIS[ this.hash ].prevElementParent = this.element.parentNode;
            THIS[ this.hash ].prevNextSibling = this.element.nextSibling;
            THIS[ this.hash ].prevElementWidth = this.element.style.width;
            THIS[ this.hash ].prevElementHeight = this.element.style.height;
            nodes = body.childNodes.length;
            for ( i = 0; i < nodes; i++ ) {
                this.previousBody.push( body.childNodes[ 0 ] );
                body.removeChild( body.childNodes[ 0 ] );
            }
            //If we've got a toolbar, we need to enable the user to use css to
            //preserve it in fullpage mode
            if ( this.toolbar && this.toolbar.element ) {
                //save a reference to the parent so we can put it back
                //in the long run we need a better strategy
                this.toolbar.parentNode = this.toolbar.element.parentNode;
                this.toolbar.nextSibling = this.toolbar.element.nextSibling;
                body.appendChild( this.toolbar.element );

                //Make sure the user has some ability to style the toolbar based
                //on the mode
                $.addClass( this.toolbar.element, 'fullpage' );
            }
            $.addClass( this.element, 'fullpage' );
            body.appendChild( this.element );

            this.element.style.height = $.getWindowSize().y + 'px';
            this.element.style.width = $.getWindowSize().x + 'px';

            if ( this.toolbar && this.toolbar.element ) {
                this.element.style.height = (
                    $.getElementSize( this.element ).y - $.getElementSize( this.toolbar.element ).y
                ) + 'px';
            }
            THIS[ this.hash ].fullPage = true;

            // mouse will be inside container now
            $.delegate( this, onContainerEnter )( {} );
        } else {
            this.element.style.margin = this.elementMargin;
            this.element.style.padding = this.elementPadding;

            bodyStyle.margin = this.bodyMargin;
            docStyle.margin = this.docMargin;

            bodyStyle.padding = this.bodyPadding;
            docStyle.padding = this.docPadding;

            bodyStyle.width = this.bodyWidth;
            docStyle.width = this.docWidth;

            bodyStyle.height = this.bodyHeight;
            docStyle.height = this.docHeight;

            body.removeChild( this.element );
            nodes = this.previousBody.length;
            for ( i = 0; i < nodes; i++ ) {
                body.appendChild( this.previousBody.shift() );
            }
            $.removeClass( this.element, 'fullpage' );
            THIS[ this.hash ].prevElementParent.insertBefore(
                this.element,
                THIS[ this.hash ].prevNextSibling
            );

            //If we've got a toolbar, we need to enable the user to use css to
            //reset it to its original state
            if ( this.toolbar && this.toolbar.element ) {
                body.removeChild( this.toolbar.element );

                //Make sure the user has some ability to style the toolbar based
                //on the mode
                $.removeClass( this.toolbar.element, 'fullpage' );

                this.toolbar.parentNode.insertBefore(
                    this.toolbar.element,
                    this.toolbar.nextSibling
                );
                delete this.toolbar.parentNode;
                delete this.toolbar.nextSibling;
            }
            this.element.style.width = THIS[ this.hash ].prevElementWidth;
            this.element.style.height = THIS[ this.hash ].prevElementHeight;

            // After exiting fullPage or fullScreen, it can take some time
            // before the browser can actually set the scroll.
            var restoreScrollCounter = 0;
            var restoreScroll = function() {
                $.setPageScroll( _this.pageScroll );
                var pageScroll = $.getPageScroll();
                restoreScrollCounter++;
                if (restoreScrollCounter < 10 &&
                    (pageScroll.x !== _this.pageScroll.x ||
                    pageScroll.y !== _this.pageScroll.y)) {
                    $.requestAnimationFrame( restoreScroll );
                }
            };
            $.requestAnimationFrame( restoreScroll );

            THIS[ this.hash ].fullPage = false;

            // mouse will likely be outside now
            $.delegate( this, onContainerExit )( { } );
        }
        if ( this.navigator && this.viewport ) {
            this.navigator.update( this.viewport );
        }
        this.raiseEvent( 'full-page', { fullPage: fullPage } );
        return this;
    },
    setFullScreen: function( fullScreen ) {
        var _this = this;

        if ( !$.supportsFullScreen ) {
            return this.setFullPage( fullScreen );
        }
        if ( $.isFullScreen() === fullScreen ) {
            return this;
        }
        var fullScreeEventArgs = {
            fullScreen: fullScreen,
            preventDefaultAction: false
        };
        this.raiseEvent( 'pre-full-screen', fullScreeEventArgs );
        if ( fullScreeEventArgs.preventDefaultAction ) {
            return this;
        }
        if ( fullScreen ) {
            this.setFullPage( true );
            // If the full page mode is not actually entered, we need to prevent
            // the full screen mode.
            if ( !this.isFullPage() ) {
                return this;
            }
            this.fullPageStyleWidth = this.element.style.width;
            this.fullPageStyleHeight = this.element.style.height;
            this.element.style.width = '100%';
            this.element.style.height = '100%';

            var onFullScreenChange = function() {
                var isFullScreen = $.isFullScreen();
                if ( !isFullScreen ) {
                    $.removeEvent( document, $.fullScreenEventName, onFullScreenChange );
                    $.removeEvent( document, $.fullScreenErrorEventName, onFullScreenChange );

                    _this.setFullPage( false );
                    if ( _this.isFullPage() ) {
                        _this.element.style.width = _this.fullPageStyleWidth;
                        _this.element.style.height = _this.fullPageStyleHeight;
                    }
                }
                if ( _this.navigator && _this.viewport ) {
                    _this.navigator.update( _this.viewport );
                }
                _this.raiseEvent( 'full-screen', { fullScreen: isFullScreen } );
            };
            $.addEvent( document, $.fullScreenEventName, onFullScreenChange );
            $.addEvent( document, $.fullScreenErrorEventName, onFullScreenChange );

            $.requestFullScreen( document.body );

        } else {
            $.exitFullScreen();
        }
        return this;
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
        this._hideMessage();

        if (options.placeholderFillStyle === undefined) {
            options.placeholderFillStyle = this.placeholderFillStyle;
        }
        if (options.opacity === undefined) {
            options.opacity = this.opacity;
        }
        if (options.preload === undefined) {
            options.preload = this.preload;
        }
        if (options.compositeOperation === undefined) {
            options.compositeOperation = this.compositeOperation;
        }
        if (options.crossOriginPolicy === undefined) {
            options.crossOriginPolicy = options.tileSource.crossOriginPolicy !== undefined ? options.tileSource.crossOriginPolicy : this.crossOriginPolicy;
        }
        if (options.ajaxWithCredentials === undefined) {
            options.ajaxWithCredentials = this.ajaxWithCredentials;
        }
        if (options.makeAjaxRequest === undefined) {
            options.makeAjaxRequest = options.tileSource.makeAjaxRequest;
        }
        if (options.loadTilesWithAjax === undefined) {
            options.loadTilesWithAjax = this.loadTilesWithAjax;
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
                    layout: _this.collectionLayout,
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
            var queueItem, tiledImage, optionsClone;
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
                    placeholderFillStyle: queueItem.options.placeholderFillStyle,
                    opacity: queueItem.options.opacity,
                    preload: queueItem.options.preload,
                    degrees: queueItem.options.degrees,
                    compositeOperation: queueItem.options.compositeOperation,
                    springStiffness: _this.springStiffness,
                    animationTime: _this.animationTime,
                    minZoomImageRatio: _this.minZoomImageRatio,
                    wrapHorizontal: _this.wrapHorizontal,
                    wrapVertical: _this.wrapVertical,
                    immediateRender: _this.immediateRender,
                    blendTime: _this.blendTime,
                    alwaysBlend: _this.alwaysBlend,
                    minPixelRatio: _this.minPixelRatio,
                    smoothTileEdgesMinZoom: _this.smoothTileEdgesMinZoom,
                    iOSDevice: _this.iOSDevice,
                    crossOriginPolicy: queueItem.options.crossOriginPolicy,
                    ajaxWithCredentials: queueItem.options.ajaxWithCredentials,
                    makeAjaxRequest: queueItem.options.makeAjaxRequest,
                    loadTilesWithAjax: queueItem.options.loadTilesWithAjax,
                    ajaxHeaders: queueItem.options.ajaxHeaders,
                    debugMode: _this.debugMode
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
                if (_this.world.getItemCount() === 1 && !_this.preserveViewport) {
                    _this.viewport.goHome(true);
                }
                if (_this.navigator) {
                    optionsClone = $.extend({}, queueItem.options, {
                        replace: false, // navigator already removed the layer, nothing to replace
                        originalTiledImage: tiledImage,
                        tileSource: queueItem.tileSource
                    });
                    _this.navigator.addTiledImage(optionsClone);
                }
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
    // deprecated
    addLayer: function( options ) {
        var _this = this;


        var optionsClone = $.extend({}, options, {
            success: function(event) {
                _this.raiseEvent("add-layer", {
                    options: options,
                    drawer: event.item
                });
            },
            error: function(event) {
                _this.raiseEvent("add-layer-failed", event);
            }
        });
        this.addTiledImage(optionsClone);
        return this;
    },
    // deprecated
    getLayerAtLevel: function( level ) {
        return this.world.getItemAt(level);
    },
    // deprecated
    getLevelOfLayer: function( drawer ) {
        return this.world.getIndexOfItem(drawer);
    },
    // deprecated
    getLayersCount: function() {
        return this.world.getItemCount();
    },
    // deprecated
    setLayerLevel: function( drawer, level ) {
        return this.world.setItemIndex(drawer, level);
    },
    // deprecated
    removeLayer: function( drawer ) {
        return this.world.removeItem(drawer);
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
    _showMessage: function ( message ) {
        this._hideMessage();

        var div = $.makeNeutralElement( "div" );
        div.appendChild( document.createTextNode( message ) );

        this.messageDiv = $.makeCenteredNode( div );

        $.addClass(this.messageDiv, "openseadragon-message");

        this.container.appendChild( this.messageDiv );
    },
    _hideMessage: function () {
        var div = this.messageDiv;
        if (div) {
            div.parentNode.removeChild(div);
            delete this.messageDiv;
        }
    },
    gestureSettingsByDeviceType: function ( type ) {
        switch ( type ) {
            case 'mouse':
                return this.gestureSettingsMouse;
            case 'touch':
                return this.gestureSettingsTouch;
            case 'pen':
                return this.gestureSettingsPen;
            default:
                return this.gestureSettingsUnknown;
        }
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
                crossOriginPolicy: imgOptions.crossOriginPolicy !== undefined ?
                    imgOptions.crossOriginPolicy : viewer.crossOriginPolicy,
                ajaxWithCredentials: viewer.ajaxWithCredentials,
                ajaxHeaders: viewer.ajaxHeaders,
                useCanvas: viewer.useCanvas,
                success: function( event ) {
                    successCallback( event.tileSource );
                }
            });
            tileSource.addHandler( 'open-failed', function( event ) {
                failCallback( event );
            } );
        } else if ($.isPlainObject(tileSource) || tileSource.nodeType) {
            if (tileSource.crossOriginPolicy === undefined &&
                (imgOptions.crossOriginPolicy !== undefined || viewer.crossOriginPolicy !== undefined)) {
                tileSource.crossOriginPolicy = imgOptions.crossOriginPolicy !== undefined ?
                    imgOptions.crossOriginPolicy : viewer.crossOriginPolicy;
            }
            if (tileSource.ajaxWithCredentials === undefined) {
                tileSource.ajaxWithCredentials = viewer.ajaxWithCredentials;
            }
            if (tileSource.useCanvas === undefined) {
                tileSource.useCanvas = viewer.useCanvas;
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
// Default view event handlers.
///////////////////////////////////////////////////////////////////////////////
function onContainerEnter( event ) {
    THIS[ this.hash ].mouseInside = true;

    this.raiseEvent( 'container-enter', {
        position: event.position,
        pointers: event.pointers,
        insideElementPressed: event.insideElementPressed,
        originalEvent: event.originalEvent
    });
}
function onContainerExit( event ) {
    if ( event.pointers < 1 ) {
        THIS[ this.hash ].mouseInside = false;
    }
    this.raiseEvent( 'container-exit', {
        position: event.position,
        pointers: event.pointers,
        insideElementPressed: event.insideElementPressed,
        originalEvent: event.originalEvent
    });
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
    if (viewer.autoResize) {
        var containerSize = _getSafeElemSize(viewer.container);
        var prevContainerSize = THIS[viewer.hash].prevContainerSize;
        if (!containerSize.equals(prevContainerSize)) {
            var viewport = viewer.viewport;
            if (viewer.preserveImageSizeOnResize) {
                var resizeRatio = prevContainerSize.x / containerSize.x;
                var zoom = viewport.getZoom() * resizeRatio;
                var center = viewport.getCenter();
                viewport.resize(containerSize, false);
                viewport.zoomTo(zoom, null, true);
                viewport.panTo(center, true);
            } else {
                // maintain image position
                var oldBounds = viewport.getBounds();
                viewport.resize(containerSize, true);
                viewport.fitBoundsWithConstraints(oldBounds, true);
            }
            THIS[viewer.hash].prevContainerSize = containerSize;
            THIS[viewer.hash].forceRedraw = true;
        }
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
        if( viewer.navigator ){
            viewer.navigator.update( viewer.viewport );
        }
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
        deltaTime,
        adjustedFactor;

    if ( THIS[ this.hash ].zooming && this.viewport) {
        currentTime = $.now();
        deltaTime = currentTime - THIS[ this.hash ].lastZoomTime;
        adjustedFactor = Math.pow( THIS[ this.hash ].zoomFactor, deltaTime / 1000 );

        this.viewport.zoomBy( adjustedFactor );
        this.viewport.applyConstraints();
        THIS[ this.hash ].lastZoomTime = currentTime;
        scheduleZoom( this );
    }
}
}( OpenSeadragon ));
