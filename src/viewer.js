

(function( $ ){
// dictionary from hash to private properties
var THIS = {};
var nextHash = 1;

$.Viewer = function( options ) {
    var args = arguments,
        _this = this,
        i;

    //backward compatibility for positional args while prefering more
    //idiomatic javascript options object as the only argument
    if( !$.isPlainObject( options ) ){
        options = {
            id: args[ 0 ],
            xmlPath: args.length > 1 ? args[ 1 ] : undefined,
            prefixUrl: args.length > 2 ? args[ 2 ] : undefined,
            controls: args.length > 3 ? args[ 3 ] : undefined,
            overlays: args.length > 4 ? args[ 4 ] : undefined
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

        // Overlays list. An overlay allows to add html on top of the viewer.
        overlays: [],
        // Container inside the canvas where overlays are drawn.
        overlaysContainer: null,

        //private state properties
        previousBody: [],

        //This was originally initialized in the constructor and so could never
        //have anything in it. now it can because we allow it to be specified
        //in the options and is only empty by default if not specified. Also
        //this array was returned from get_controls which I find confusing
        //since this object has a controls property which is treated in other
        //functions like clearControls. I'm removing the accessors.
        customControls: [],

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

        //interface button controls
        buttons: null,

        //TODO: this is defunct so safely remove it
        profiler: null

    }, $.DEFAULT_SETTINGS, options );
    if ( typeof ( this.hash) === "undefined" ) {
        throw new Error("A hash must be defined, either by specifying options.id or options.hash.");
    }
    if ( typeof ( THIS[ this.hash ] ) !== "undefined" ) {
        // We don't want to throw an error here, as the user might have discarded
        // the previous viewer with the same hash and now want to recreate it.
        $.console.warn("Hash " + this.hash + " has already been used.");
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
    this.currentOverlays = [];

    this._lastScrollTime = $.now(); // variable used to help normalize the scroll event speed of different devices

    //Inherit some behaviors and properties
    $.EventSource.call( this );

    this.addHandler( 'open-failed', function ( event ) {
        var msg = $.getString( "Errors.OpenFailed", event.eventSource, event.message);
        _this._showMessage( msg );
    });
    $.ControlDock.call( this, options );

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
    //the container is created through applying the ControlDock constructor above
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

    this.innerTracker = new $.MouseTracker({
        element: this.canvas,
        startDisabled: !this.mouseNavEnabled,
        clickTimeThreshold: this.clickTimeThreshold,
        clickDistThreshold: this.clickDistThreshold,
        dblClickTimeThreshold: this.dblClickTimeThreshold,
        dblClickDistThreshold: this.dblClickDistThreshold,
        keyDownHandler: $.delegate( this, onCanvasKeyDown ),
        keyHandler: $.delegate( this, onCanvasKeyPress ),
        clickHandler: $.delegate( this, onCanvasClick ),
        dblClickHandler: $.delegate( this, onCanvasDblClick ),
        dragHandler: $.delegate( this, onCanvasDrag ),
        dragEndHandler: $.delegate( this, onCanvasDragEnd ),
        enterHandler: $.delegate( this, onCanvasEnter ),
        exitHandler: $.delegate( this, onCanvasExit ),
        pressHandler: $.delegate( this, onCanvasPress ),
        releaseHandler: $.delegate( this, onCanvasRelease ),
        nonPrimaryPressHandler: $.delegate( this, onCanvasNonPrimaryPress ),
        nonPrimaryReleaseHandler: $.delegate( this, onCanvasNonPrimaryRelease ),
        scrollHandler: $.delegate( this, onCanvasScroll ),
        pinchHandler: $.delegate( this, onCanvasPinch )
    });
    this.outerTracker = new $.MouseTracker({
        element: this.container,
        startDisabled: !this.mouseNavEnabled,
        clickTimeThreshold: this.clickTimeThreshold,
        clickDistThreshold: this.clickDistThreshold,
        dblClickTimeThreshold: this.dblClickTimeThreshold,
        dblClickDistThreshold: this.dblClickDistThreshold,
        enterHandler: $.delegate( this, onContainerEnter ),
        exitHandler: $.delegate( this, onContainerExit )
    });
    if( this.toolbar ){
        this.toolbar = new $.ControlDock({ element: this.toolbar });
    }
    this.bindStandardControls();

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
    // Overlay container
    this.overlaysContainer = $.makeNeutralElement( "div" );
    this.canvas.appendChild( this.overlaysContainer );

    // Now that we have a drawer, see if it supports rotate. If not we need to remove the rotate buttons
    if (!this.drawer.canRotate()) {
        // Disable/remove the rotate left/right buttons since they aren't supported
        if (this.rotateLeft) {
            i = this.buttons.buttons.indexOf(this.rotateLeft);
            this.buttons.buttons.splice(i, 1);
            this.buttons.element.removeChild(this.rotateLeft.element);
        }
        if (this.rotateRight) {
            i = this.buttons.buttons.indexOf(this.rotateRight);
            this.buttons.buttons.splice(i, 1);
            this.buttons.element.removeChild(this.rotateRight.element);
        }
    }
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
    // Sequence mode
    if (this.sequenceMode) {
        this.bindSequenceControls();
    }
    // Open initial tilesources
    if (this.tileSources) {
        this.open( this.tileSources );
    }
    // Add custom controls
    for ( i = 0; i < this.customControls.length; i++ ) {
        this.addControl(
            this.customControls[ i ].id,
            {anchor: this.customControls[ i ].anchor}
        );
    }
    // Initial fade out
    $.requestAnimationFrame( function(){
        beginControlsAutoHide( _this );
    } );
};
$.extend( $.Viewer.prototype, $.EventSource.prototype, $.ControlDock.prototype, {

    isOpen: function () {
        return !!this.world.getItemCount();
    },
    // deprecated
    openDzi: function ( dzi ) {
        $.console.error( "[Viewer.openDzi] this function is deprecated; use Viewer.open() instead." );
        return this.open( dzi );
    },
    // deprecated
    openTileSource: function ( tileSource ) {
        $.console.error( "[Viewer.openTileSource] this function is deprecated; use Viewer.open() instead." );
        return this.open( tileSource );
    },
    open: function (tileSources, initialPage) {
        var _this = this;

        this.close();

        if (!tileSources) {
            return;
        }
        if (this.sequenceMode && $.isArray(tileSources)) {
            if (this.referenceStrip) {
                this.referenceStrip.destroy();
                this.referenceStrip = null;
            }
            if (typeof initialPage != 'undefined' && !isNaN(initialPage)) {
              this.initialPage = initialPage;
            }
            this.tileSources = tileSources;
            this._sequenceIndex = Math.max(0, Math.min(this.tileSources.length - 1, this.initialPage));
            if (this.tileSources.length) {
                this.open(this.tileSources[this._sequenceIndex]);

                if ( this.showReferenceStrip ){
                    this.addReferenceStrip();
                }
            }
            this._updateSequenceButtons( this._sequenceIndex );
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
                    // Global overlays
                    if( _this.overlays && !_this.preserveOverlays ){
                        for ( var i = 0; i < _this.overlays.length; i++ ) {
                            _this.currentOverlays[ i ] = getOverlayObject( _this, _this.overlays[ i ] );
                        }
                    }
                    _this._drawOverlays();
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
                $.console.error('[Viewer.open] setting indexes here is not supported; use addTiledImage instead');
                delete options.index;
            }
            if (options.collectionImmediately === undefined) {
                options.collectionImmediately = true;
            }
            var originalSuccess = options.success;
            options.success = function(event) {
                successes++;

                // TODO: now that options has other things besides tileSource, the overlays
                // should probably be at the options level, not the tileSource level.
                if (options.tileSource.overlays) {
                    for (var i = 0; i < options.tileSource.overlays.length; i++) {
                        _this.addOverlay(options.tileSource.overlays[i]);
                    }
                }
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
        if (!this.preserveOverlays) {
            this.clearOverlays();
            this.overlaysContainer.innerHTML = "";
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

        this.clearOverlays();
        this.overlaysContainer.innerHTML = "";

        //TODO: implement this...
        //this.unbindSequenceControls()
        //this.unbindStandardControls()

        if (this.referenceStrip) {
            this.referenceStrip.destroy();
            this.referenceStrip = null;
        }
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
        // destroy the mouse trackers
        if (this.innerTracker){
            this.innerTracker.destroy();
        }
        if (this.outerTracker){
            this.outerTracker.destroy();
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
        return this.innerTracker.isTracking();
    },
    setMouseNavEnabled: function( enabled ){
        this.innerTracker.setTracking( enabled );
        this.outerTracker.setTracking( enabled );

        this.raiseEvent( 'mouse-enabled', { enabled: enabled } );
        return this;
    },
    areControlsEnabled: function () {
        var enabled = this.controls.length,
            i;
        for( i = 0; i < this.controls.length; i++ ){
            enabled = enabled && this.controls[ i ].isVisibile();
        }
        return enabled;
    },
    setControlsEnabled: function( enabled ) {
        if( enabled ){
            abortControlsAutoHide( this );
        } else {
            beginControlsAutoHide( this );
        }
        this.raiseEvent( 'controls-enabled', { enabled: enabled } );
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
        $.console.assert(options, "[Viewer.addTiledImage] options is required");
        $.console.assert(options.tileSource, "[Viewer.addTiledImage] options.tileSource is required");
        $.console.assert(!options.replace || (options.index > -1 && options.index < this.world.getItemCount()),
            "[Viewer.addTiledImage] if options.replace is used, options.index must be a valid index in Viewer.world");

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
                    fitBoundsPlacement: queueItem.options.fitBoundsPlacement,
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
        $.console.assert(options, "[Viewer.addSimpleImage] options is required");
        $.console.assert(options.url, "[Viewer.addSimpleImage] options.url is required");

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

        $.console.error( "[Viewer.addLayer] this function is deprecated; use Viewer.addTiledImage() instead." );

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
        $.console.error( "[Viewer.getLayerAtLevel] this function is deprecated; use World.getItemAt() instead." );
        return this.world.getItemAt(level);
    },
    // deprecated
    getLevelOfLayer: function( drawer ) {
        $.console.error( "[Viewer.getLevelOfLayer] this function is deprecated; use World.getIndexOfItem() instead." );
        return this.world.getIndexOfItem(drawer);
    },
    // deprecated
    getLayersCount: function() {
        $.console.error( "[Viewer.getLayersCount] this function is deprecated; use World.getItemCount() instead." );
        return this.world.getItemCount();
    },
    // deprecated
    setLayerLevel: function( drawer, level ) {
        $.console.error( "[Viewer.setLayerLevel] this function is deprecated; use World.setItemIndex() instead." );
        return this.world.setItemIndex(drawer, level);
    },
    // deprecated
    removeLayer: function( drawer ) {
        $.console.error( "[Viewer.removeLayer] this function is deprecated; use World.removeItem() instead." );
        return this.world.removeItem(drawer);
    },
    forceRedraw: function() {
        THIS[ this.hash ].forceRedraw = true;
        return this;
    },
    bindSequenceControls: function(){
        //////////////////////////////////////////////////////////////////////////
        // Image Sequence Controls
        //////////////////////////////////////////////////////////////////////////
        var onFocusHandler = $.delegate( this, onFocus ),
            onBlurHandler = $.delegate( this, onBlur ),
            onNextHandler = $.delegate( this, onNext ),
            onPreviousHandler = $.delegate( this, onPrevious ),
            navImages = this.navImages,
            useGroup = true;

        if( this.showSequenceControl ){
            if( this.previousButton || this.nextButton ){
                //if we are binding to custom buttons then layout and
                //grouping is the responsibility of the page author
                useGroup = false;
            }
            this.previousButton = new $.Button({
                element: this.previousButton ? $.getElement( this.previousButton ) : null,
                clickTimeThreshold: this.clickTimeThreshold,
                clickDistThreshold: this.clickDistThreshold,
                tooltip: $.getString( "Tooltips.PreviousPage" ),
                srcRest: resolveUrl( this.prefixUrl, navImages.previous.REST ),
                srcGroup: resolveUrl( this.prefixUrl, navImages.previous.GROUP ),
                srcHover: resolveUrl( this.prefixUrl, navImages.previous.HOVER ),
                srcDown: resolveUrl( this.prefixUrl, navImages.previous.DOWN ),
                onRelease: onPreviousHandler,
                onFocus: onFocusHandler,
                onBlur: onBlurHandler
            });
            this.nextButton = new $.Button({
                element: this.nextButton ? $.getElement( this.nextButton ) : null,
                clickTimeThreshold: this.clickTimeThreshold,
                clickDistThreshold: this.clickDistThreshold,
                tooltip: $.getString( "Tooltips.NextPage" ),
                srcRest: resolveUrl( this.prefixUrl, navImages.next.REST ),
                srcGroup: resolveUrl( this.prefixUrl, navImages.next.GROUP ),
                srcHover: resolveUrl( this.prefixUrl, navImages.next.HOVER ),
                srcDown: resolveUrl( this.prefixUrl, navImages.next.DOWN ),
                onRelease: onNextHandler,
                onFocus: onFocusHandler,
                onBlur: onBlurHandler
            });
            if( !this.navPrevNextWrap ){
                this.previousButton.disable();
            }
            if (!this.tileSources || !this.tileSources.length) {
                this.nextButton.disable();
            }
            if( useGroup ){
                this.paging = new $.ButtonGroup({
                    buttons: [
                        this.previousButton,
                        this.nextButton
                    ],
                    clickTimeThreshold: this.clickTimeThreshold,
                    clickDistThreshold: this.clickDistThreshold
                });
                this.pagingControl = this.paging.element;

                if( this.toolbar ){
                    this.toolbar.addControl(
                        this.pagingControl,
                        {anchor: $.ControlAnchor.BOTTOM_RIGHT}
                    );
                }else{
                    this.addControl(
                        this.pagingControl,
                        {anchor: this.sequenceControlAnchor || $.ControlAnchor.TOP_LEFT}
                    );
                }
            }
        }
        return this;
    },
    bindStandardControls: function(){
        //////////////////////////////////////////////////////////////////////////
        // Navigation Controls
        //////////////////////////////////////////////////////////////////////////
        var beginZoomingInHandler = $.delegate( this, beginZoomingIn ),
            endZoomingHandler = $.delegate( this, endZooming ),
            doSingleZoomInHandler = $.delegate( this, doSingleZoomIn ),
            beginZoomingOutHandler = $.delegate( this, beginZoomingOut ),
            doSingleZoomOutHandler = $.delegate( this, doSingleZoomOut ),
            onHomeHandler = $.delegate( this, onHome ),
            onFullScreenHandler = $.delegate( this, onFullScreen ),
            onRotateLeftHandler = $.delegate( this, onRotateLeft ),
            onRotateRightHandler = $.delegate( this, onRotateRight ),
            onFocusHandler = $.delegate( this, onFocus ),
            onBlurHandler = $.delegate( this, onBlur ),
            navImages = this.navImages,
            buttons = [],
            useGroup = true;

        if ( this.showNavigationControl ) {
            if( this.zoomInButton || this.zoomOutButton ||
                this.homeButton || this.fullPageButton ||
                this.rotateLeftButton || this.rotateRightButton ) {
                //if we are binding to custom buttons then layout and
                //grouping is the responsibility of the page author
                useGroup = false;
            }
            if ( this.showZoomControl ) {
                buttons.push( this.zoomInButton = new $.Button({
                    element: this.zoomInButton ? $.getElement( this.zoomInButton ) : null,
                    clickTimeThreshold: this.clickTimeThreshold,
                    clickDistThreshold: this.clickDistThreshold,
                    tooltip: $.getString( "Tooltips.ZoomIn" ),
                    srcRest: resolveUrl( this.prefixUrl, navImages.zoomIn.REST ),
                    srcGroup: resolveUrl( this.prefixUrl, navImages.zoomIn.GROUP ),
                    srcHover: resolveUrl( this.prefixUrl, navImages.zoomIn.HOVER ),
                    srcDown: resolveUrl( this.prefixUrl, navImages.zoomIn.DOWN ),
                    onPress: beginZoomingInHandler,
                    onRelease: endZoomingHandler,
                    onClick: doSingleZoomInHandler,
                    onEnter: beginZoomingInHandler,
                    onExit: endZoomingHandler,
                    onFocus: onFocusHandler,
                    onBlur: onBlurHandler
                }));
                buttons.push( this.zoomOutButton = new $.Button({
                    element: this.zoomOutButton ? $.getElement( this.zoomOutButton ) : null,
                    clickTimeThreshold: this.clickTimeThreshold,
                    clickDistThreshold: this.clickDistThreshold,
                    tooltip: $.getString( "Tooltips.ZoomOut" ),
                    srcRest: resolveUrl( this.prefixUrl, navImages.zoomOut.REST ),
                    srcGroup: resolveUrl( this.prefixUrl, navImages.zoomOut.GROUP ),
                    srcHover: resolveUrl( this.prefixUrl, navImages.zoomOut.HOVER ),
                    srcDown: resolveUrl( this.prefixUrl, navImages.zoomOut.DOWN ),
                    onPress: beginZoomingOutHandler,
                    onRelease: endZoomingHandler,
                    onClick: doSingleZoomOutHandler,
                    onEnter: beginZoomingOutHandler,
                    onExit: endZoomingHandler,
                    onFocus: onFocusHandler,
                    onBlur: onBlurHandler
                }));
            }
            if ( this.showHomeControl ) {
                buttons.push( this.homeButton = new $.Button({
                    element: this.homeButton ? $.getElement( this.homeButton ) : null,
                    clickTimeThreshold: this.clickTimeThreshold,
                    clickDistThreshold: this.clickDistThreshold,
                    tooltip: $.getString( "Tooltips.Home" ),
                    srcRest: resolveUrl( this.prefixUrl, navImages.home.REST ),
                    srcGroup: resolveUrl( this.prefixUrl, navImages.home.GROUP ),
                    srcHover: resolveUrl( this.prefixUrl, navImages.home.HOVER ),
                    srcDown: resolveUrl( this.prefixUrl, navImages.home.DOWN ),
                    onRelease: onHomeHandler,
                    onFocus: onFocusHandler,
                    onBlur: onBlurHandler
                }));
            }
            if ( this.showFullPageControl ) {
                buttons.push( this.fullPageButton = new $.Button({
                    element: this.fullPageButton ? $.getElement( this.fullPageButton ) : null,
                    clickTimeThreshold: this.clickTimeThreshold,
                    clickDistThreshold: this.clickDistThreshold,
                    tooltip: $.getString( "Tooltips.FullPage" ),
                    srcRest: resolveUrl( this.prefixUrl, navImages.fullpage.REST ),
                    srcGroup: resolveUrl( this.prefixUrl, navImages.fullpage.GROUP ),
                    srcHover: resolveUrl( this.prefixUrl, navImages.fullpage.HOVER ),
                    srcDown: resolveUrl( this.prefixUrl, navImages.fullpage.DOWN ),
                    onRelease: onFullScreenHandler,
                    onFocus: onFocusHandler,
                    onBlur: onBlurHandler
                }));
            }
            if ( this.showRotationControl ) {
                buttons.push( this.rotateLeftButton = new $.Button({
                    element: this.rotateLeftButton ? $.getElement( this.rotateLeftButton ) : null,
                    clickTimeThreshold: this.clickTimeThreshold,
                    clickDistThreshold: this.clickDistThreshold,
                    tooltip: $.getString( "Tooltips.RotateLeft" ),
                    srcRest: resolveUrl( this.prefixUrl, navImages.rotateleft.REST ),
                    srcGroup: resolveUrl( this.prefixUrl, navImages.rotateleft.GROUP ),
                    srcHover: resolveUrl( this.prefixUrl, navImages.rotateleft.HOVER ),
                    srcDown: resolveUrl( this.prefixUrl, navImages.rotateleft.DOWN ),
                    onRelease: onRotateLeftHandler,
                    onFocus: onFocusHandler,
                    onBlur: onBlurHandler
                }));
                buttons.push( this.rotateRightButton = new $.Button({
                    element: this.rotateRightButton ? $.getElement( this.rotateRightButton ) : null,
                    clickTimeThreshold: this.clickTimeThreshold,
                    clickDistThreshold: this.clickDistThreshold,
                    tooltip: $.getString( "Tooltips.RotateRight" ),
                    srcRest: resolveUrl( this.prefixUrl, navImages.rotateright.REST ),
                    srcGroup: resolveUrl( this.prefixUrl, navImages.rotateright.GROUP ),
                    srcHover: resolveUrl( this.prefixUrl, navImages.rotateright.HOVER ),
                    srcDown: resolveUrl( this.prefixUrl, navImages.rotateright.DOWN ),
                    onRelease: onRotateRightHandler,
                    onFocus: onFocusHandler,
                    onBlur: onBlurHandler
                }));
            }
            if ( useGroup ) {
                this.buttons = new $.ButtonGroup({
                    buttons: buttons,
                    clickTimeThreshold: this.clickTimeThreshold,
                    clickDistThreshold: this.clickDistThreshold
                });
                this.navControl = this.buttons.element;
                this.addHandler( 'open', $.delegate( this, lightUp ) );

                if( this.toolbar ){
                    this.toolbar.addControl(
                        this.navControl,
                        {anchor: this.navigationControlAnchor || $.ControlAnchor.TOP_LEFT}
                    );
                } else {
                    this.addControl(
                        this.navControl,
                        {anchor: this.navigationControlAnchor || $.ControlAnchor.TOP_LEFT}
                    );
                }
            }
        }
        return this;
    },
    currentPage: function() {
        return this._sequenceIndex;
    },
    goToPage: function( page ){
        if( this.tileSources && page >= 0 && page < this.tileSources.length ){
            this._sequenceIndex = page;

            this._updateSequenceButtons( page );

            this.open( this.tileSources[ page ] );

            if( this.referenceStrip ){
                this.referenceStrip.setFocus( page );
            }
            this.raiseEvent( 'page', { page: page } );
        }
        return this;
    },
    addOverlay: function( element, location, placement, onDraw ) {
        var options;
        if( $.isPlainObject( element ) ){
            options = element;
        } else {
            options = {
                element: element,
                location: location,
                placement: placement,
                onDraw: onDraw
            };
        }
        element = $.getElement( options.element );

        if ( getOverlayIndex( this.currentOverlays, element ) >= 0 ) {
            // they're trying to add a duplicate overlay
            return this;
        }
        var overlay = getOverlayObject( this, options);
        this.currentOverlays.push(overlay);
        overlay.drawHTML( this.overlaysContainer, this.viewport );
        this.raiseEvent( 'add-overlay', {
            element: element,
            location: options.location,
            placement: options.placement
        });
        return this;
    },
    updateOverlay: function( element, location, placement ) {
        var i;

        element = $.getElement( element );
        i = getOverlayIndex( this.currentOverlays, element );

        if ( i >= 0 ) {
            this.currentOverlays[ i ].update( location, placement );
            THIS[ this.hash ].forceRedraw = true;

            this.raiseEvent( 'update-overlay', {
                element: element,
                location: location,
                placement: placement
            });
        }
        return this;
    },
    removeOverlay: function( element ) {
        var i;

        element = $.getElement( element );
        i = getOverlayIndex( this.currentOverlays, element );

        if ( i >= 0 ) {
            this.currentOverlays[ i ].destroy();
            this.currentOverlays.splice( i, 1 );
            THIS[ this.hash ].forceRedraw = true;

            this.raiseEvent( 'remove-overlay', {
                element: element
            });
        }
        return this;
    },
    clearOverlays: function() {
        while ( this.currentOverlays.length > 0 ) {
            this.currentOverlays.pop().destroy();
        }
        THIS[ this.hash ].forceRedraw = true;

        this.raiseEvent( 'clear-overlay', {} );
        return this;
    },
    getOverlayById: function( element ) {
        var i;

        element = $.getElement( element );
        i = getOverlayIndex( this.currentOverlays, element );

        if (i >= 0) {
            return this.currentOverlays[i];
        } else {
            return null;
        }
    },
    _updateSequenceButtons: function( page ) {
            if ( this.nextButton ) {
                if(!this.tileSources || this.tileSources.length - 1 === page) {
                    //Disable next button
                    if ( !this.navPrevNextWrap ) {
                        this.nextButton.disable();
                    }
                } else {
                    this.nextButton.enable();
                }
            }
            if ( this.previousButton ) {
                if ( page > 0 ) {
                    //Enable previous button
                    this.previousButton.enable();
                } else {
                    if ( !this.navPrevNextWrap ) {
                        this.previousButton.disable();
                    }
                }
            }
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
    // private
    _drawOverlays: function() {
        var i,
            length = this.currentOverlays.length;
        for ( i = 0; i < length; i++ ) {
            this.currentOverlays[ i ].drawHTML( this.overlaysContainer, this.viewport );
        }
    },
    _cancelPendingImages: function() {
        this._loadQueue = [];
    },
    removeReferenceStrip: function() {
        this.showReferenceStrip = false;

        if (this.referenceStrip) {
            this.referenceStrip.destroy();
            this.referenceStrip = null;
        }
    },
    addReferenceStrip: function() {
        this.showReferenceStrip = true;

        if (this.sequenceMode) {
            if (this.referenceStrip) {
                return;
            }
            if (this.tileSources.length && this.tileSources.length > 1) {
                this.referenceStrip = new $.ReferenceStrip({
                    id: this.referenceStripElement,
                    position: this.referenceStripPosition,
                    sizeRatio: this.referenceStripSizeRatio,
                    scroll: this.referenceStripScroll,
                    height: this.referenceStripHeight,
                    width: this.referenceStripWidth,
                    tileSources: this.tileSources,
                    prefixUrl: this.prefixUrl,
                    viewer: this
                });
                this.referenceStrip.setFocus( this._sequenceIndex );
            }
        } else {
            $.console.warn('Attempting to display a reference strip while "sequenceMode" is off.');
        }
    }
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
function getOverlayObject( viewer, overlay ) {
    if ( overlay instanceof $.Overlay ) {
        return overlay;
    }
    var element = null;
    if ( overlay.element ) {
        element = $.getElement( overlay.element );
    } else {
        var id = overlay.id ?
            overlay.id :
            "openseadragon-overlay-" + Math.floor( Math.random() * 10000000 );

        element = $.getElement( overlay.id );
        if ( !element ) {
            element = document.createElement( "a" );
            element.href = "#/overlay/" + id;
        }
        element.id = id;
        $.addClass( element, overlay.className ?
            overlay.className :
            "openseadragon-overlay"
        );
    }
    var location = overlay.location;
    var width = overlay.width;
    var height = overlay.height;
    if (!location) {
        var x = overlay.x;
        var y = overlay.y;
        if (overlay.px !== undefined) {
            var rect = viewer.viewport.imageToViewportRectangle(new $.Rect(
                overlay.px,
                overlay.py,
                width || 0,
                height || 0));
            x = rect.x;
            y = rect.y;
            width = width !== undefined ? rect.width : undefined;
            height = height !== undefined ? rect.height : undefined;
        }
        location = new $.Point(x, y);
    }
    var placement = overlay.placement;
    if (placement && $.type(placement) === "string") {
        placement = $.Placement[overlay.placement.toUpperCase()];
    }
    return new $.Overlay({
        element: element,
        location: location,
        placement: placement,
        onDraw: overlay.onDraw,
        checkResize: overlay.checkResize,
        width: width,
        height: height,
        rotationMode: overlay.rotationMode
    });
}
function getOverlayIndex( overlays, element ) {
    var i;
    for ( i = overlays.length - 1; i >= 0; i-- ) {
        if ( overlays[ i ].element === element ) {
            return i;
        }
    }
    return -1;
}
///////////////////////////////////////////////////////////////////////////////
// Schedulers provide the general engine for animation
///////////////////////////////////////////////////////////////////////////////
function scheduleUpdate( viewer, updateFunc ){
    return $.requestAnimationFrame( function(){
        updateFunc( viewer );
    } );
}
//provides a sequence in the fade animation
function scheduleControlsFade( viewer ) {
    $.requestAnimationFrame( function(){
        updateControlsFade( viewer );
    });
}
//initiates an animation to hide the controls
function beginControlsAutoHide( viewer ) {
    if ( !viewer.autoHideControls ) {
        return;
    }
    viewer.controlsShouldFade = true;
    viewer.controlsFadeBeginTime =
        $.now() +
        viewer.controlsFadeDelay;

    window.setTimeout( function(){
        scheduleControlsFade( viewer );
    }, viewer.controlsFadeDelay );
}
//determines if fade animation is done or continues the animation
function updateControlsFade( viewer ) {
    var currentTime,
        deltaTime,
        opacity,
        i;
    if ( viewer.controlsShouldFade ) {
        currentTime = $.now();
        deltaTime = currentTime - viewer.controlsFadeBeginTime;
        opacity = 1.0 - deltaTime / viewer.controlsFadeLength;

        opacity = Math.min( 1.0, opacity );
        opacity = Math.max( 0.0, opacity );

        for ( i = viewer.controls.length - 1; i >= 0; i--) {
            if (viewer.controls[ i ].autoFade) {
                viewer.controls[ i ].setOpacity( opacity );
            }
        }
        if ( opacity > 0 ) {
            // fade again
            scheduleControlsFade( viewer );
        }
    }
}
//stop the fade animation on the controls and show them
function abortControlsAutoHide( viewer ) {
    var i;
    viewer.controlsShouldFade = false;
    for ( i = viewer.controls.length - 1; i >= 0; i-- ) {
        viewer.controls[ i ].setOpacity( 1.0 );
    }
}
///////////////////////////////////////////////////////////////////////////////
// Default view event handlers.
///////////////////////////////////////////////////////////////////////////////
function onFocus(){
    abortControlsAutoHide( this );
}
function onBlur(){
    beginControlsAutoHide( this );

}
function onCanvasKeyDown( event ) {
    var canvasKeyDownEventArgs = {
      originalEvent: event.originalEvent,
      preventDefaultAction: event.preventDefaultAction,
      preventVerticalPan: event.preventVerticalPan,
      preventHorizontalPan: event.preventHorizontalPan
    };
    this.raiseEvent('canvas-key', canvasKeyDownEventArgs);

    if ( !canvasKeyDownEventArgs.preventDefaultAction && !event.ctrl && !event.alt && !event.meta ) {
        switch( event.keyCode ){
            case 38://up arrow
                if (!canvasKeyDownEventArgs.preventVerticalPan) {
                  if ( event.shift ) {
                    this.viewport.zoomBy(1.1);
                  } else {
                    this.viewport.panBy(this.viewport.deltaPointsFromPixels(new $.Point(0, -this.pixelsPerArrowPress)));
                  }
                  this.viewport.applyConstraints();
                }
                return false;
            case 40://down arrow
                if (!canvasKeyDownEventArgs.preventVerticalPan) {
                  if ( event.shift ) {
                    this.viewport.zoomBy(0.9);
                  } else {
                    this.viewport.panBy(this.viewport.deltaPointsFromPixels(new $.Point(0, this.pixelsPerArrowPress)));
                  }
                  this.viewport.applyConstraints();
                }
                return false;
            case 37://left arrow
                if (!canvasKeyDownEventArgs.preventHorizontalPan) {
                  this.viewport.panBy(this.viewport.deltaPointsFromPixels(new $.Point(-this.pixelsPerArrowPress, 0)));
                  this.viewport.applyConstraints();
                }
                return false;
            case 39://right arrow
                if (!canvasKeyDownEventArgs.preventHorizontalPan) {
                  this.viewport.panBy(this.viewport.deltaPointsFromPixels(new $.Point(this.pixelsPerArrowPress, 0)));
                  this.viewport.applyConstraints();
                }
                return false;
            default:
                //console.log( 'navigator keycode %s', event.keyCode );
                return true;
        }
    } else {
        return true;
    }
}
function onCanvasKeyPress( event ) {
    var canvasKeyPressEventArgs = {
      originalEvent: event.originalEvent,
      preventDefaultAction: event.preventDefaultAction,
      preventVerticalPan: event.preventVerticalPan,
      preventHorizontalPan: event.preventHorizontalPan
    };
    // This event is documented in onCanvasKeyDown
    this.raiseEvent('canvas-key', canvasKeyPressEventArgs);

    if ( !canvasKeyPressEventArgs.preventDefaultAction && !event.ctrl && !event.alt && !event.meta ) {
        switch( event.keyCode ){
            case 43://=|+
            case 61://=|+
                this.viewport.zoomBy(1.1);
                this.viewport.applyConstraints();
                return false;
            case 45://-|_
                this.viewport.zoomBy(0.9);
                this.viewport.applyConstraints();
                return false;
            case 48://0|)
                this.viewport.goHome();
                this.viewport.applyConstraints();
                return false;
            case 119://w
            case 87://W
                if (!canvasKeyPressEventArgs.preventVerticalPan) {
                    if ( event.shift ) {
                        this.viewport.zoomBy(1.1);
                    } else {
                        this.viewport.panBy(this.viewport.deltaPointsFromPixels(new $.Point(0, -40)));
                    }
                    this.viewport.applyConstraints();
                  }
                  return false;
            case 115://s
            case 83://S
                if (!canvasKeyPressEventArgs.preventVerticalPan) {
                  if ( event.shift ) {
                    this.viewport.zoomBy(0.9);
                  } else {
                    this.viewport.panBy(this.viewport.deltaPointsFromPixels(new $.Point(0, 40)));
                  }
                  this.viewport.applyConstraints();
                }
                return false;
            case 97://a
                if (!canvasKeyPressEventArgs.preventHorizontalPan) {
                  this.viewport.panBy(this.viewport.deltaPointsFromPixels(new $.Point(-40, 0)));
                  this.viewport.applyConstraints();
                }
                return false;
            case 100://d
                if (!canvasKeyPressEventArgs.preventHorizontalPan) {
                  this.viewport.panBy(this.viewport.deltaPointsFromPixels(new $.Point(40, 0)));
                  this.viewport.applyConstraints();
                }
                return false;
            default:
                //console.log( 'navigator keycode %s', event.keyCode );
                return true;
        }
    } else {
        return true;
    }
}
function onCanvasClick( event ) {
    var gestureSettings;

    var haveKeyboardFocus = document.activeElement == this.canvas;

    // If we don't have keyboard focus, request it.
    if ( !haveKeyboardFocus ) {
        this.canvas.focus();
    }
    var canvasClickEventArgs = {
        tracker: event.eventSource,
        position: event.position,
        quick: event.quick,
        shift: event.shift,
        originalEvent: event.originalEvent,
        preventDefaultAction: event.preventDefaultAction
    };
    this.raiseEvent( 'canvas-click', canvasClickEventArgs);

    if ( !canvasClickEventArgs.preventDefaultAction && this.viewport && event.quick ) {
        gestureSettings = this.gestureSettingsByDeviceType( event.pointerType );
        if ( gestureSettings.clickToZoom ) {
            this.viewport.zoomBy(
                event.shift ? 1.0 / this.zoomPerClick : this.zoomPerClick,
                gestureSettings.zoomToRefPoint ? this.viewport.pointFromPixel( event.position, true ) : null
            );
            this.viewport.applyConstraints();
        }
    }
}
function onCanvasDblClick( event ) {
    var gestureSettings;

    var canvasDblClickEventArgs = {
        tracker: event.eventSource,
        position: event.position,
        shift: event.shift,
        originalEvent: event.originalEvent,
        preventDefaultAction: event.preventDefaultAction
    };
    this.raiseEvent( 'canvas-double-click', canvasDblClickEventArgs);

    if ( !canvasDblClickEventArgs.preventDefaultAction && this.viewport ) {
        gestureSettings = this.gestureSettingsByDeviceType( event.pointerType );
        if ( gestureSettings.dblClickToZoom ) {
            this.viewport.zoomBy(
                event.shift ? 1.0 / this.zoomPerClick : this.zoomPerClick,
                gestureSettings.zoomToRefPoint ? this.viewport.pointFromPixel( event.position, true ) : null
            );
            this.viewport.applyConstraints();
        }
    }
}
function onCanvasDrag( event ) {
    var gestureSettings;

    var canvasDragEventArgs = {
        tracker: event.eventSource,
        position: event.position,
        delta: event.delta,
        speed: event.speed,
        direction: event.direction,
        shift: event.shift,
        originalEvent: event.originalEvent,
        preventDefaultAction: event.preventDefaultAction
    };
    this.raiseEvent( 'canvas-drag', canvasDragEventArgs);

    if ( !canvasDragEventArgs.preventDefaultAction && this.viewport ) {
        gestureSettings = this.gestureSettingsByDeviceType( event.pointerType );
        if( !this.panHorizontal ){
            event.delta.x = 0;
        }
        if( !this.panVertical ){
            event.delta.y = 0;
        }
        if( this.constrainDuringPan ){
            var delta = this.viewport.deltaPointsFromPixels( event.delta.negate() );

            this.viewport.centerSpringX.target.value += delta.x;
            this.viewport.centerSpringY.target.value += delta.y;

            var bounds = this.viewport.getBounds();
            var constrainedBounds = this.viewport.getConstrainedBounds();

            this.viewport.centerSpringX.target.value -= delta.x;
            this.viewport.centerSpringY.target.value -= delta.y;

            if (bounds.x != constrainedBounds.x) {
                event.delta.x = 0;
            }
            if (bounds.y != constrainedBounds.y) {
                event.delta.y = 0;
            }
        }
        this.viewport.panBy( this.viewport.deltaPointsFromPixels( event.delta.negate() ), gestureSettings.flickEnabled && !this.constrainDuringPan);
    }
}
function onCanvasDragEnd( event ) {
    if (!event.preventDefaultAction && this.viewport) {
        var gestureSettings = this.gestureSettingsByDeviceType(event.pointerType);
        if (gestureSettings.flickEnabled &&
            event.speed >= gestureSettings.flickMinSpeed) {
            var amplitudeX = 0;
            if (this.panHorizontal) {
                amplitudeX = gestureSettings.flickMomentum * event.speed *
                    Math.cos(event.direction);
            }
            var amplitudeY = 0;
            if (this.panVertical) {
                amplitudeY = gestureSettings.flickMomentum * event.speed *
                    Math.sin(event.direction);
            }
            var center = this.viewport.pixelFromPoint(
                this.viewport.getCenter(true));
            var target = this.viewport.pointFromPixel(
                new $.Point(center.x - amplitudeX, center.y - amplitudeY));
            this.viewport.panTo(target, false);
        }
        this.viewport.applyConstraints();
    }
    this.raiseEvent('canvas-drag-end', {
        tracker: event.eventSource,
        position: event.position,
        speed: event.speed,
        direction: event.direction,
        shift: event.shift,
        originalEvent: event.originalEvent
    });
}
function onCanvasEnter( event ) {
    this.raiseEvent( 'canvas-enter', {
        tracker: event.eventSource,
        pointerType: event.pointerType,
        position: event.position,
        buttons: event.buttons,
        pointers: event.pointers,
        insideElementPressed: event.insideElementPressed,
        buttonDownAny: event.buttonDownAny,
        originalEvent: event.originalEvent
    });
}
function onCanvasExit( event ) {
    if (window.location != window.parent.location){
        $.MouseTracker.resetAllMouseTrackers();
    }
    this.raiseEvent( 'canvas-exit', {
        tracker: event.eventSource,
        pointerType: event.pointerType,
        position: event.position,
        buttons: event.buttons,
        pointers: event.pointers,
        insideElementPressed: event.insideElementPressed,
        buttonDownAny: event.buttonDownAny,
        originalEvent: event.originalEvent
    });
}
function onCanvasPress( event ) {
    this.raiseEvent( 'canvas-press', {
        tracker: event.eventSource,
        pointerType: event.pointerType,
        position: event.position,
        insideElementPressed: event.insideElementPressed,
        insideElementReleased: event.insideElementReleased,
        originalEvent: event.originalEvent
    });
}
function onCanvasRelease( event ) {
    this.raiseEvent( 'canvas-release', {
        tracker: event.eventSource,
        pointerType: event.pointerType,
        position: event.position,
        insideElementPressed: event.insideElementPressed,
        insideElementReleased: event.insideElementReleased,
        originalEvent: event.originalEvent
    });
}
function onCanvasNonPrimaryPress( event ) {
    this.raiseEvent( 'canvas-nonprimary-press', {
        tracker: event.eventSource,
        position: event.position,
        pointerType: event.pointerType,
        button: event.button,
        buttons: event.buttons,
        originalEvent: event.originalEvent
    });
}
function onCanvasNonPrimaryRelease( event ) {
    this.raiseEvent( 'canvas-nonprimary-release', {
        tracker: event.eventSource,
        position: event.position,
        pointerType: event.pointerType,
        button: event.button,
        buttons: event.buttons,
        originalEvent: event.originalEvent
    });
}
function onCanvasPinch( event ) {
    var gestureSettings,
        centerPt,
        lastCenterPt,
        panByPt;

    if ( !event.preventDefaultAction && this.viewport ) {
        gestureSettings = this.gestureSettingsByDeviceType( event.pointerType );
        if ( gestureSettings.pinchToZoom ) {
            centerPt = this.viewport.pointFromPixel( event.center, true );
            lastCenterPt = this.viewport.pointFromPixel( event.lastCenter, true );
            panByPt = lastCenterPt.minus( centerPt );
            if( !this.panHorizontal ) {
                panByPt.x = 0;
            }
            if( !this.panVertical ) {
                panByPt.y = 0;
            }
            this.viewport.zoomBy( event.distance / event.lastDistance, centerPt, true );
            if ( gestureSettings.zoomToRefPoint ) {
                this.viewport.panBy(panByPt, true);
            }
            this.viewport.applyConstraints();
        }
        if ( gestureSettings.pinchRotate ) {
            // Pinch rotate
            var angle1 = Math.atan2(event.gesturePoints[0].currentPos.y - event.gesturePoints[1].currentPos.y,
                event.gesturePoints[0].currentPos.x - event.gesturePoints[1].currentPos.x);
            var angle2 = Math.atan2(event.gesturePoints[0].lastPos.y - event.gesturePoints[1].lastPos.y,
                event.gesturePoints[0].lastPos.x - event.gesturePoints[1].lastPos.x);
            this.viewport.setRotation(this.viewport.getRotation() + ((angle1 - angle2) * (180 / Math.PI)));
        }
    }
    this.raiseEvent('canvas-pinch', {
        tracker: event.eventSource,
        gesturePoints: event.gesturePoints,
        lastCenter: event.lastCenter,
        center: event.center,
        lastDistance: event.lastDistance,
        distance: event.distance,
        shift: event.shift,
        originalEvent: event.originalEvent
    });
    //cancels event
    return false;
}
function onCanvasScroll( event ) {
    var gestureSettings,
        factor,
        thisScrollTime,
        deltaScrollTime;
    thisScrollTime = $.now();
    deltaScrollTime = thisScrollTime - this._lastScrollTime;
    if (deltaScrollTime > this.minScrollDeltaTime) {
        this._lastScrollTime = thisScrollTime;

        if ( !event.preventDefaultAction && this.viewport ) {
            gestureSettings = this.gestureSettingsByDeviceType( event.pointerType );
            if ( gestureSettings.scrollToZoom ) {
                factor = Math.pow( this.zoomPerScroll, event.scroll );
                this.viewport.zoomBy(
                    factor,
                    gestureSettings.zoomToRefPoint ? this.viewport.pointFromPixel( event.position, true ) : null
                );
                this.viewport.applyConstraints();
            }
        }
        this.raiseEvent( 'canvas-scroll', {
            tracker: event.eventSource,
            position: event.position,
            scroll: event.scroll,
            shift: event.shift,
            originalEvent: event.originalEvent
        });
        if (gestureSettings && gestureSettings.scrollToZoom) {
            //cancels event
            return false;
        }
    }
    else {
        gestureSettings = this.gestureSettingsByDeviceType( event.pointerType );
        if (gestureSettings && gestureSettings.scrollToZoom) {
            return false; // We are swallowing this event
        }
    }
}
function onContainerEnter( event ) {
    THIS[ this.hash ].mouseInside = true;
    abortControlsAutoHide( this );

    this.raiseEvent( 'container-enter', {
        tracker: event.eventSource,
        position: event.position,
        buttons: event.buttons,
        pointers: event.pointers,
        insideElementPressed: event.insideElementPressed,
        buttonDownAny: event.buttonDownAny,
        originalEvent: event.originalEvent
    });
}
function onContainerExit( event ) {
    if ( event.pointers < 1 ) {
        THIS[ this.hash ].mouseInside = false;
        if ( !THIS[ this.hash ].animating ) {
            beginControlsAutoHide( this );
        }
    }
    this.raiseEvent( 'container-exit', {
        tracker: event.eventSource,
        position: event.position,
        buttons: event.buttons,
        pointers: event.pointers,
        insideElementPressed: event.insideElementPressed,
        buttonDownAny: event.buttonDownAny,
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
    if( viewer.referenceStrip ){
        animated = viewer.referenceStrip.update( viewer.viewport ) || animated;
    }
    if ( !THIS[ viewer.hash ].animating && animated ) {
        viewer.raiseEvent( "animation-start" );
        abortControlsAutoHide( viewer );
    }
    if ( animated || THIS[ viewer.hash ].forceRedraw || viewer.world.needsDraw() ) {
        drawWorld( viewer );
        viewer._drawOverlays();
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

        if ( !THIS[ viewer.hash ].mouseInside ) {
            beginControlsAutoHide( viewer );
        }
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
// Navigation Controls
///////////////////////////////////////////////////////////////////////////////
function resolveUrl( prefix, url ) {
    return prefix ? prefix + url : url;
}
function beginZoomingIn() {
    THIS[ this.hash ].lastZoomTime = $.now();
    THIS[ this.hash ].zoomFactor = this.zoomPerSecond;
    THIS[ this.hash ].zooming = true;
    scheduleZoom( this );
}
function beginZoomingOut() {
    THIS[ this.hash ].lastZoomTime = $.now();
    THIS[ this.hash ].zoomFactor = 1.0 / this.zoomPerSecond;
    THIS[ this.hash ].zooming = true;
    scheduleZoom( this );
}
function endZooming() {
    THIS[ this.hash ].zooming = false;
}
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
function doSingleZoomIn() {
    if ( this.viewport ) {
        THIS[ this.hash ].zooming = false;
        this.viewport.zoomBy(
            this.zoomPerClick / 1.0
        );
        this.viewport.applyConstraints();
    }
}
function doSingleZoomOut() {
    if ( this.viewport ) {
        THIS[ this.hash ].zooming = false;
        this.viewport.zoomBy(
            1.0 / this.zoomPerClick
        );
        this.viewport.applyConstraints();
    }
}
function lightUp() {
    this.buttons.emulateEnter();
    this.buttons.emulateExit();
}
function onHome() {
    if ( this.viewport ) {
        this.viewport.goHome();
    }
}
function onFullScreen() {
    if ( this.isFullPage() && !$.isFullScreen() ) {
        // Is fullPage but not fullScreen
        this.setFullPage( false );
    } else {
        this.setFullScreen( !this.isFullPage() );
    }
    // correct for no mouseout event on change
    if ( this.buttons ) {
        this.buttons.emulateExit();
    }
    this.fullPageButton.element.focus();
    if ( this.viewport ) {
        this.viewport.applyConstraints();
    }
}
function onRotateLeft() {
    if ( this.viewport ) {
        var currRotation = this.viewport.getRotation();
        if (currRotation === 0) {
            currRotation = 270;
        }
        else {
            currRotation -= 90;
        }
        this.viewport.setRotation(currRotation);
    }
}
function onRotateRight() {
    if ( this.viewport ) {
        var currRotation = this.viewport.getRotation();
        if (currRotation === 270) {
            currRotation = 0;
        }
        else {
            currRotation += 90;
        }
        this.viewport.setRotation(currRotation);
    }
}
function onPrevious(){
    var previous = this._sequenceIndex - 1;
    if(this.navPrevNextWrap && previous < 0){
        previous += this.tileSources.length;
    }
    this.goToPage( previous );
}
function onNext(){
    var next = this._sequenceIndex + 1;
    if(this.navPrevNextWrap && next >= this.tileSources.length){
        next = 0;
    }
    this.goToPage( next );
}
}( OpenSeadragon ));
