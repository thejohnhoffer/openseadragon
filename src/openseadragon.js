
// Typedefs
function OpenSeadragon( options ){
    return new OpenSeadragon.Viewer( options );
}
(function( $ ){

    $.version = {
        versionStr: '<%= osdVersion.versionStr %>',
        major: parseInt('<%= osdVersion.major %>', 10),
        minor: parseInt('<%= osdVersion.minor %>', 10),
        revision: parseInt('<%= osdVersion.revision %>', 10)
    };
    var class2type = {
            '[object Boolean]': 'boolean',
            '[object Number]': 'number',
            '[object String]': 'string',
            '[object Function]': 'function',
            '[object Array]': 'array',
            '[object Date]': 'date',
            '[object RegExp]': 'regexp',
            '[object Object]': 'object'
        },
        // Save a reference to some core methods
        toString = Object.prototype.toString,
        hasOwn = Object.prototype.hasOwnProperty;
    $.isFunction = function( obj ) {
        return $.type(obj) === "function";
    };
    $.isArray = Array.isArray || function( obj ) {
        return $.type(obj) === "array";
    };
    $.isWindow = function( obj ) {
        return obj && typeof obj === "object" && "setInterval" in obj;
    };
    $.type = function( obj ) {
        return ( obj === null ) || ( obj === undefined ) ?
            String( obj ) :
            class2type[ toString.call(obj) ] || "object";
    };
    $.isPlainObject = function( obj ) {
        // Must be an Object.
        // Because of IE, we also have to check the presence of the constructor property.
        // Make sure that DOM nodes and window objects don't pass through, as well
        if ( !obj || OpenSeadragon.type(obj) !== "object" || obj.nodeType || $.isWindow( obj ) ) {
            return false;
        }
        // Not own constructor property must be Object
        if ( obj.constructor &&
            !hasOwn.call(obj, "constructor") &&
            !hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
            return false;
        }
        // Own properties are enumerated firstly, so to speed up,
        // if last one is own, then all properties are own.

        var lastKey;
        for (var key in obj ) {
            lastKey = key;
        }
        return lastKey === undefined || hasOwn.call( obj, lastKey );
    };
    $.isEmptyObject = function( obj ) {
        for ( var name in obj ) {
            return false;
        }
        return true;
    };
    $.freezeObject = function(obj) {
        if (Object.freeze) {
            $.freezeObject = Object.freeze;
        } else {
            $.freezeObject = function(obj) {
                return obj;
            };
        }
        return $.freezeObject(obj);
    };
    $.supportsCanvas = (function () {
        var canvasElement = document.createElement( 'canvas' );
        return !!( $.isFunction( canvasElement.getContext ) &&
                    canvasElement.getContext( '2d' ) );
    }());
    $.isCanvasTainted = function(canvas) {
        var isTainted = false;
        try {
            // We test if the canvas is tainted by retrieving data from it.
            // An exception will be raised if the canvas is tainted.
            canvas.getContext('2d').getImageData(0, 0, 1, 1);
        } catch (e) {
            isTainted = true;
        }
        return isTainted;
    };
    $.pixelDensityRatio = (function () {
        if ( $.supportsCanvas ) {
            var context = document.createElement('canvas').getContext('2d');
            var devicePixelRatio = window.devicePixelRatio || 1;
            var backingStoreRatio = context.webkitBackingStorePixelRatio ||
                                    context.mozBackingStorePixelRatio ||
                                    context.msBackingStorePixelRatio ||
                                    context.oBackingStorePixelRatio ||
                                    context.backingStorePixelRatio || 1;
            return Math.max(devicePixelRatio, 1) / backingStoreRatio;
        } else {
            return 1;
        }
    }());
}( OpenSeadragon ));
(function( $ ){

    $.extend = function() {
        var options,
            name,
            src,
            copy,
            copyIsArray,
            clone,
            target = arguments[ 0 ] || {},
            length = arguments.length,
            deep = false,
            i = 1;

        // Handle a deep copy situation
        if ( typeof target === "boolean" ) {
            deep = target;
            target = arguments[ 1 ] || {};
            // skip the boolean and the target
            i = 2;
        }
        // Handle case when target is a string or something (possible in deep copy)
        if ( typeof target !== "object" && !OpenSeadragon.isFunction( target ) ) {
            target = {};
        }
        // extend jQuery itself if only one argument is passed
        if ( length === i ) {
            target = this;
            --i;
        }
        for ( ; i < length; i++ ) {
            // Only deal with non-null/undefined values
            options = arguments[ i ];
            if ( options !== null || options !== undefined ) {
                // Extend the base object
                for ( name in options ) {
                    src = target[ name ];
                    copy = options[ name ];

                    // Prevent never-ending loop
                    if ( target === copy ) {
                        continue;
                    }
                    // Recurse if we're merging plain objects or arrays
                    if ( deep && copy && ( OpenSeadragon.isPlainObject( copy ) || ( copyIsArray = OpenSeadragon.isArray( copy ) ) ) ) {
                        if ( copyIsArray ) {
                            copyIsArray = false;
                            clone = src && OpenSeadragon.isArray( src ) ? src : [];

                        } else {
                            clone = src && OpenSeadragon.isPlainObject( src ) ? src : {};
                        }
                        // Never move original objects, clone them
                        target[ name ] = OpenSeadragon.extend( deep, clone, copy );

                    // Don't bring in undefined values
                    } else if ( copy !== undefined ) {
                        target[ name ] = copy;
                    }
                }
            }
        }
        // Return the modified object
        return target;
    };
    var isIOSDevice = function () {
        if (typeof navigator !== 'object') {
            return false;
        }
        var userAgent = navigator.userAgent;
        if (typeof userAgent !== 'string') {
            return false;
        }
        return userAgent.indexOf('iPhone') !== -1 ||
               userAgent.indexOf('iPad') !== -1 ||
               userAgent.indexOf('iPod') !== -1;
    };
    $.extend( $, {
        DEFAULT_SETTINGS: {
            //DATA SOURCE DETAILS
            xmlPath: null,
            tileSources: null,
            tileHost: null,
            initialPage: 0,
            crossOriginPolicy: false,
            ajaxWithCredentials: false,
            loadTilesWithAjax: false,
            ajaxHeaders: {},
            //PAN AND ZOOM SETTINGS AND CONSTRAINTS
            panHorizontal: true,
            panVertical: true,
            constrainDuringPan: false,
            wrapHorizontal: false,
            wrapVertical: false,
            visibilityRatio: 0.5, //-> how much of the viewer can be negative space
            minPixelRatio: 0.5, //->closer to 0 draws tiles meant for a higher zoom at this zoom
            defaultZoomLevel: 0,
            minZoomLevel: null,
            maxZoomLevel: null,
            homeFillsViewer: false,

            //UI RESPONSIVENESS AND FEEL
            clickTimeThreshold: 300,
            clickDistThreshold: 5,
            dblClickTimeThreshold: 300,
            dblClickDistThreshold: 20,
            springStiffness: 6.5,
            animationTime: 1.2,
            gestureSettingsMouse: {
                scrollToZoom: true,
                clickToZoom: true,
                dblClickToZoom: false,
                pinchToZoom: false,
                zoomToRefPoint: true,
                flickEnabled: false,
                flickMinSpeed: 120,
                flickMomentum: 0.25,
                pinchRotate: false
            },
            gestureSettingsTouch: {
                scrollToZoom: false,
                clickToZoom: false,
                dblClickToZoom: true,
                pinchToZoom: true,
                zoomToRefPoint: true,
                flickEnabled: true,
                flickMinSpeed: 120,
                flickMomentum: 0.25,
                pinchRotate: false
            },
            gestureSettingsPen: {
                scrollToZoom: false,
                clickToZoom: true,
                dblClickToZoom: false,
                pinchToZoom: false,
                zoomToRefPoint: true,
                flickEnabled: false,
                flickMinSpeed: 120,
                flickMomentum: 0.25,
                pinchRotate: false
            },
            gestureSettingsUnknown: {
                scrollToZoom: false,
                clickToZoom: false,
                dblClickToZoom: true,
                pinchToZoom: true,
                zoomToRefPoint: true,
                flickEnabled: true,
                flickMinSpeed: 120,
                flickMomentum: 0.25,
                pinchRotate: false
            },
            zoomPerClick: 2,
            zoomPerScroll: 1.2,
            zoomPerSecond: 1.0,
            blendTime: 0,
            alwaysBlend: false,
            immediateRender: false,
            minZoomImageRatio: 0.9, //-> closer to 0 allows zoom out to infinity
            maxZoomPixelRatio: 1.1, //-> higher allows 'over zoom' into pixels
            smoothTileEdgesMinZoom: 1.1, //-> higher than maxZoomPixelRatio disables it
            iOSDevice: isIOSDevice(),
            pixelsPerWheelLine: 40,
            pixelsPerArrowPress: 40,
            autoResize: true,
            preserveImageSizeOnResize: false, // requires autoResize=true
            minScrollDeltaTime: 50,

            preserveViewport: false, //SEQUENCE
            navPrevNextWrap: false, //SEQUENCE
            mouseNavEnabled: true, //GENERAL MOUSE INTERACTIVITY

            //VIEWPORT NAVIGATOR SETTINGS
            showNavigator: false,
            navigatorId: null,
            navigatorPosition: null,
            navigatorSizeRatio: 0.2,
            navigatorMaintainSizeRatio: false,
            navigatorTop: null,
            navigatorLeft: null,
            navigatorHeight: null,
            navigatorWidth: null,
            navigatorAutoResize: true,
            navigatorAutoFade: true,
            navigatorRotate: true,

            // INITIAL ROTATION
            degrees: 0,

            // APPEARANCE
            opacity: 1,
            preload: false,
            compositeOperation: null,
            placeholderFillStyle: null,

            //REFERENCE STRIP SETTINGS
            show: false,

            //COLLECTION VISUALIZATION SETTINGS
            collectionRows: 3, //or columns depending on layout
            collectionColumns: 0, //columns in horizontal layout, rows in vertical layout
            collectionLayout: 'horizontal', //vertical
            collectionMode: false,
            collectionTileSize: 800,
            collectionTileMargin: 80,

            //PERFORMANCE SETTINGS
            imageLoaderLimit: 0,
            maxImageCacheCount: 200,
            timeout: 30000,
            useCanvas: true, // Use canvas element for drawing if available

            //INTERFACE RESOURCE SETTINGS
            prefixUrl: "/images/",
            navImages: {
                zoomIn: {
                    REST: 'zoomin_rest.png',
                    GROUP: 'zoomin_grouphover.png',
                    HOVER: 'zoomin_hover.png',
                    DOWN: 'zoomin_pressed.png'
                },
                zoomOut: {
                    REST: 'zoomout_rest.png',
                    GROUP: 'zoomout_grouphover.png',
                    HOVER: 'zoomout_hover.png',
                    DOWN: 'zoomout_pressed.png'
                },
                home: {
                    REST: 'home_rest.png',
                    GROUP: 'home_grouphover.png',
                    HOVER: 'home_hover.png',
                    DOWN: 'home_pressed.png'
                },
                fullpage: {
                    REST: 'fullpage_rest.png',
                    GROUP: 'fullpage_grouphover.png',
                    HOVER: 'fullpage_hover.png',
                    DOWN: 'fullpage_pressed.png'
                },
                rotateleft: {
                    REST: 'rotateleft_rest.png',
                    GROUP: 'rotateleft_grouphover.png',
                    HOVER: 'rotateleft_hover.png',
                    DOWN: 'rotateleft_pressed.png'
                },
                rotateright: {
                    REST: 'rotateright_rest.png',
                    GROUP: 'rotateright_grouphover.png',
                    HOVER: 'rotateright_hover.png',
                    DOWN: 'rotateright_pressed.png'
                },
                previous: {
                    REST: 'previous_rest.png',
                    GROUP: 'previous_grouphover.png',
                    HOVER: 'previous_hover.png',
                    DOWN: 'previous_pressed.png'
                },
                next: {
                    REST: 'next_rest.png',
                    GROUP: 'next_grouphover.png',
                    HOVER: 'next_hover.png',
                    DOWN: 'next_pressed.png'
                }
            },
            //DEVELOPER SETTINGS
            debugMode: false,
            debugGridColor: ['#437AB2', '#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E', '#E6AB02', '#A6761D', '#666666']
        },
        SIGNAL: "----seadragon----",
        delegate: function( object, method ) {
            return function(){
                var args = arguments;
                if ( args === undefined ){
                    args = [];
                }
                return method.apply( object, args );
            };
        },
        BROWSERS: {
            UNKNOWN: 0,
            IE: 1,
            FIREFOX: 2,
            SAFARI: 3,
            CHROME: 4,
            OPERA: 5
        },
        getElement: function( element ) {
            if ( typeof ( element ) == "string" ) {
                element = document.getElementById( element );
            }
            return element;
        },
        getElementPosition: function( element ) {
            var result = new $.Point(),
                isFixed,
                offsetParent;

            element = $.getElement( element );
            isFixed = $.getElementStyle( element ).position == "fixed";
            offsetParent = getOffsetParent( element, isFixed );

            while ( offsetParent ) {
                result.x += element.offsetLeft;
                result.y += element.offsetTop;

                if ( isFixed ) {
                    result = result.plus( $.getPageScroll() );
                }
                element = offsetParent;
                isFixed = $.getElementStyle( element ).position == "fixed";
                offsetParent = getOffsetParent( element, isFixed );
            }
            return result;
        },
        getElementOffset: function( element ) {
            element = $.getElement( element );

            var doc = element && element.ownerDocument,
                docElement,
                win,
                boundingRect = { top: 0, left: 0 };
            if ( !doc ) {
                return new $.Point();
            }
            docElement = doc.documentElement;

            if ( typeof element.getBoundingClientRect !== typeof undefined ) {
                boundingRect = element.getBoundingClientRect();
            }
            win = ( doc == doc.window ) ?
                doc :
                ( doc.nodeType === 9 ) ?
                    doc.defaultView || doc.parentWindow :
                    false;

            return new $.Point(
                boundingRect.left + ( win.pageXOffset || docElement.scrollLeft ) - ( docElement.clientLeft || 0 ),
                boundingRect.top + ( win.pageYOffset || docElement.scrollTop ) - ( docElement.clientTop || 0 )
            );
        },
        getElementSize: function( element ) {
            element = $.getElement( element );

            return new $.Point(
                element.clientWidth,
                element.clientHeight
            );
        },
        getElementStyle:
            document.documentElement.currentStyle ?
            function( element ) {
                element = $.getElement( element );
                return element.currentStyle;
            } :
            function( element ) {
                element = $.getElement( element );
                return window.getComputedStyle( element, "" );
            },
        getCssPropertyWithVendorPrefix: function(property) {
            var memo = {};
            $.getCssPropertyWithVendorPrefix = function(property) {
                if (memo[property] !== undefined) {
                    return memo[property];
                }
                var style = document.createElement('div').style;
                var result = null;
                if (style[property] !== undefined) {
                    result = property;
                } else {
                    var prefixes = ['Webkit', 'Moz', 'MS', 'O',
                        'webkit', 'moz', 'ms', 'o'];
                    var suffix = $.capitalizeFirstLetter(property);
                    for (var i = 0; i < prefixes.length; i++) {
                        var prop = prefixes[i] + suffix;
                        if (style[prop] !== undefined) {
                            result = prop;
                            break;
                        }
                    }
                }
                memo[property] = result;
                return result;
            };
            return $.getCssPropertyWithVendorPrefix(property);
        },
        capitalizeFirstLetter: function(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        },
        positiveModulo: function(number, modulo) {
            var result = number % modulo;
            if (result < 0) {
                result += modulo;
            }
            return result;
        },
        pointInElement: function( element, point ) {
            element = $.getElement( element );
            var offset = $.getElementOffset( element ),
                size = $.getElementSize( element );
            return point.x >= offset.x && point.x < offset.x + size.x && point.y < offset.y + size.y && point.y >= offset.y;
        },
        getEvent: function( event ) {
            if( event ){
                $.getEvent = function( event ) {
                    return event;
                };
            } else {
                $.getEvent = function() {
                    return window.event;
                };
            }
            return $.getEvent( event );
        },
        getMousePosition: function( event ) {
            if ( typeof ( event.pageX ) == "number" ) {
                $.getMousePosition = function( event ){
                    var result = new $.Point();

                    event = $.getEvent( event );
                    result.x = event.pageX;
                    result.y = event.pageY;

                    return result;
                };
            } else if ( typeof ( event.clientX ) == "number" ) {
                $.getMousePosition = function( event ){
                    var result = new $.Point();

                    event = $.getEvent( event );
                    result.x =
                        event.clientX +
                        document.body.scrollLeft +
                        document.documentElement.scrollLeft;
                    result.y =
                        event.clientY +
                        document.body.scrollTop +
                        document.documentElement.scrollTop;

                    return result;
                };
            } else {
                throw new Error(
                    "Unknown event mouse position, no known technique."
                );
            }
            return $.getMousePosition( event );
        },
        getPageScroll: function() {
            var docElement = document.documentElement || {},
                body = document.body || {};
            if ( typeof ( window.pageXOffset ) == "number" ) {
                $.getPageScroll = function(){
                    return new $.Point(
                        window.pageXOffset,
                        window.pageYOffset
                    );
                };
            } else if ( body.scrollLeft || body.scrollTop ) {
                $.getPageScroll = function(){
                    return new $.Point(
                        document.body.scrollLeft,
                        document.body.scrollTop
                    );
                };
            } else if ( docElement.scrollLeft || docElement.scrollTop ) {
                $.getPageScroll = function(){
                    return new $.Point(
                        document.documentElement.scrollLeft,
                        document.documentElement.scrollTop
                    );
                };
            } else {
                // We can't reassign the function yet, as there was no scroll.
                return new $.Point(0, 0);
            }
            return $.getPageScroll();
        },
        setPageScroll: function( scroll ) {
            if ( typeof ( window.scrollTo ) !== "undefined" ) {
                $.setPageScroll = function( scroll ) {
                    window.scrollTo( scroll.x, scroll.y );
                };
            } else {
                var originalScroll = $.getPageScroll();
                if ( originalScroll.x === scroll.x &&
                    originalScroll.y === scroll.y ) {
                    // We are already correctly positioned and there
                    // is no way to detect the correct method.
                    return;
                }
                document.body.scrollLeft = scroll.x;
                document.body.scrollTop = scroll.y;
                var currentScroll = $.getPageScroll();
                if ( currentScroll.x !== originalScroll.x &&
                    currentScroll.y !== originalScroll.y ) {
                    $.setPageScroll = function( scroll ) {
                        document.body.scrollLeft = scroll.x;
                        document.body.scrollTop = scroll.y;
                    };
                    return;
                }
                document.documentElement.scrollLeft = scroll.x;
                document.documentElement.scrollTop = scroll.y;
                currentScroll = $.getPageScroll();
                if ( currentScroll.x !== originalScroll.x &&
                    currentScroll.y !== originalScroll.y ) {
                    $.setPageScroll = function( scroll ) {
                        document.documentElement.scrollLeft = scroll.x;
                        document.documentElement.scrollTop = scroll.y;
                    };
                    return;
                }
                // We can't find anything working, so we do nothing.
                $.setPageScroll = function( scroll ) {
                };
            }
            return $.setPageScroll( scroll );
        },
        getWindowSize: function() {
            var docElement = document.documentElement || {},
                body = document.body || {};
            if ( typeof ( window.innerWidth ) == 'number' ) {
                $.getWindowSize = function(){
                    return new $.Point(
                        window.innerWidth,
                        window.innerHeight
                    );
                };
            } else if ( docElement.clientWidth || docElement.clientHeight ) {
                $.getWindowSize = function(){
                    return new $.Point(
                        document.documentElement.clientWidth,
                        document.documentElement.clientHeight
                    );
                };
            } else if ( body.clientWidth || body.clientHeight ) {
                $.getWindowSize = function(){
                    return new $.Point(
                        document.body.clientWidth,
                        document.body.clientHeight
                    );
                };
            } else {
                throw new Error("Unknown window size, no known technique.");
            }
            return $.getWindowSize();
        },
        makeCenteredNode: function( element ) {
            // Convert a possible ID to an actual HTMLElement
            element = $.getElement( element );

            var wrappers = [
                $.makeNeutralElement( 'div' ),
                $.makeNeutralElement( 'div' ),
                $.makeNeutralElement( 'div' )
            ];

            // It feels like we should be able to pass style dicts to makeNeutralElement:
            $.extend(wrappers[0].style, {
                display: "table",
                height: "100%",
                width: "100%"
            });
            $.extend(wrappers[1].style, {
                display: "table-row"
            });
            $.extend(wrappers[2].style, {
                display: "table-cell",
                verticalAlign: "middle",
                textAlign: "center"
            });
            wrappers[0].appendChild(wrappers[1]);
            wrappers[1].appendChild(wrappers[2]);
            wrappers[2].appendChild(element);

            return wrappers[0];
        },
        makeNeutralElement: function( tagName ) {
            var element = document.createElement( tagName ),
                style = element.style;

            style.background = "transparent none";
            style.border = "none";
            style.margin = "0px";
            style.padding = "0px";
            style.position = "static";

            return element;
        },
        now: function( ) {
            if (Date.now) {
                $.now = Date.now;
            } else {
                $.now = function() {
                    return new Date().getTime();
                };
            }
            return $.now();
        },
        makeTransparentImage: function( src ) {
            $.makeTransparentImage = function( src ){
                var img = $.makeNeutralElement( "img" );

                img.src = src;

                return img;
            };
            if ( $.Browser.vendor == $.BROWSERS.IE && $.Browser.version < 7 ) {
                $.makeTransparentImage = function( src ){
                    var img = $.makeNeutralElement( "img" ),
                        element = null;

                    element = $.makeNeutralElement("span");
                    element.style.display = "inline-block";

                    img.onload = function() {
                        element.style.width = element.style.width || img.width + "px";
                        element.style.height = element.style.height || img.height + "px";

                        img.onload = null;
                        img = null; // to prevent memory leaks in IE
                    };
                    img.src = src;
                    element.style.filter =
                        "progid:DXImageTransform.Microsoft.AlphaImageLoader(src='" +
                        src +
                        "', sizingMethod='scale')";

                    return element;
                };
            }
            return $.makeTransparentImage( src );
        },
        setElementOpacity: function( element, opacity, usesAlpha ) {
            var ieOpacity,
                ieFilter;

            element = $.getElement( element );

            if ( usesAlpha && !$.Browser.alpha ) {
                opacity = Math.round( opacity );
            }
            if ( $.Browser.opacity ) {
                element.style.opacity = opacity < 1 ? opacity : "";
            } else {
                if ( opacity < 1 ) {
                    ieOpacity = Math.round( 100 * opacity );
                    ieFilter = "alpha(opacity=" + ieOpacity + ")";
                    element.style.filter = ieFilter;
                } else {
                    element.style.filter = "";
                }
            }
        },
        setElementTouchActionNone: function( element ) {
            element = $.getElement( element );
            if ( typeof element.style.touchAction !== 'undefined' ) {
                element.style.touchAction = 'none';
            } else if ( typeof element.style.msTouchAction !== 'undefined' ) {
                element.style.msTouchAction = 'none';
            }
        },
        addClass: function( element, className ) {
            element = $.getElement( element );

            if (!element.className) {
                element.className = className;
            } else if ( ( ' ' + element.className + ' ' ).
                indexOf( ' ' + className + ' ' ) === -1 ) {
                element.className += ' ' + className;
            }
        },
        indexOf: function( array, searchElement, fromIndex ) {
            if ( Array.prototype.indexOf ) {
                this.indexOf = function( array, searchElement, fromIndex ) {
                    return array.indexOf( searchElement, fromIndex );
                };
            } else {
                this.indexOf = function( array, searchElement, fromIndex ) {
                    var i,
                        pivot = ( fromIndex ) ? fromIndex : 0,
                        length;
                    if ( !array ) {
                        throw new TypeError( );
                    }
                    length = array.length;
                    if ( length === 0 || pivot >= length ) {
                        return -1;
                    }
                    if ( pivot < 0 ) {
                        pivot = length - Math.abs( pivot );
                    }
                    for ( i = pivot; i < length; i++ ) {
                        if ( array[i] === searchElement ) {
                            return i;
                        }
                    }
                    return -1;
                };
            }
            return this.indexOf( array, searchElement, fromIndex );
        },
        removeClass: function( element, className ) {
            var oldClasses,
                newClasses = [],
                i;

            element = $.getElement( element );
            oldClasses = element.className.split( /\s+/ );
            for ( i = 0; i < oldClasses.length; i++ ) {
                if ( oldClasses[ i ] && oldClasses[ i ] !== className ) {
                    newClasses.push( oldClasses[ i ] );
                }
            }
            element.className = newClasses.join(' ');
        },
        addEvent: (function () {
            if ( window.addEventListener ) {
                return function ( element, eventName, handler, useCapture ) {
                    element = $.getElement( element );
                    element.addEventListener( eventName, handler, useCapture );
                };
            } else if ( window.attachEvent ) {
                return function ( element, eventName, handler, useCapture ) {
                    element = $.getElement( element );
                    element.attachEvent( 'on' + eventName, handler );
                };
            } else {
                throw new Error( "No known event model." );
            }
        }()),
        removeEvent: (function () {
            if ( window.removeEventListener ) {
                return function ( element, eventName, handler, useCapture ) {
                    element = $.getElement( element );
                    element.removeEventListener( eventName, handler, useCapture );
                };
            } else if ( window.detachEvent ) {
                return function( element, eventName, handler, useCapture ) {
                    element = $.getElement( element );
                    element.detachEvent( 'on' + eventName, handler );
                };
            } else {
                throw new Error( "No known event model." );
            }
        }()),
        cancelEvent: function( event ) {
            event = $.getEvent( event );

            if ( event.preventDefault ) {
                $.cancelEvent = function( event ){
                    // W3C for preventing default
                    event.preventDefault();
                };
            } else {
                $.cancelEvent = function( event ){
                    event = $.getEvent( event );
                    // legacy for preventing default
                    event.cancel = true;
                    // IE for preventing default
                    event.returnValue = false;
                };
            }
            $.cancelEvent( event );
        },
        stopEvent: function( event ) {
            event = $.getEvent( event );

            if ( event.stopPropagation ) {
                // W3C for stopping propagation
                $.stopEvent = function( event ){
                    event.stopPropagation();
                };
            } else {
                // IE for stopping propagation
                $.stopEvent = function( event ){
                    event = $.getEvent( event );
                    event.cancelBubble = true;
                };
            }
            $.stopEvent( event );
        },
        createCallback: function( object, method ) {
            //TODO: This pattern is painful to use and debug. It's much cleaner
            // to use pinning plus anonymous functions. Get rid of this
            // pattern!
            var initialArgs = [],
                i;
            for ( i = 2; i < arguments.length; i++ ) {
                initialArgs.push( arguments[ i ] );
            }
            return function() {
                var args = initialArgs.concat( [] ),
                    i;
                for ( i = 0; i < arguments.length; i++ ) {
                    args.push( arguments[ i ] );
                }
                return method.apply( object, args );
            };
        },
        getUrlParameter: function( key ) {
            // eslint-disable-next-line no-use-before-define
            var value = URLPARAMS[ key ];
            return value ? value : null;
        },
        getUrlProtocol: function( url ) {
            var match = url.match(/^([a-z]+:)\/\//i);
            if ( match === null ) {
                // Relative URL, retrive the protocol from window.location
                return window.location.protocol;
            }
            return match[1].toLowerCase();
        },
        createAjaxRequest: function( local ) {
            // IE11 does not support window.ActiveXObject so we just try to
            // create one to see if it is supported.
            // See: http://msdn.microsoft.com/en-us/library/ie/dn423948%28v=vs.85%29.aspx
            var supportActiveX;
            try {
                supportActiveX = !!new window.ActiveXObject( "Microsoft.XMLHTTP" );
            } catch( e ) {
                supportActiveX = false;
            }
            if ( supportActiveX ) {
                if ( window.XMLHttpRequest ) {
                    $.createAjaxRequest = function( local ) {
                        if ( local ) {
                            return new window.ActiveXObject( "Microsoft.XMLHTTP" );
                        }
                        return new XMLHttpRequest();
                    };
                } else {
                    $.createAjaxRequest = function() {
                        return new window.ActiveXObject( "Microsoft.XMLHTTP" );
                    };
                }
            } else if ( window.XMLHttpRequest ) {
                $.createAjaxRequest = function() {
                    return new XMLHttpRequest();
                };
            } else {
                throw new Error( "Browser doesn't support XMLHttpRequest." );
            }
            return $.createAjaxRequest( local );
        },
        makeAjaxRequest: function( url, onSuccess, onError ) {
            var withCredentials;
            var headers;
            var responseType;

            // Note that our preferred API is that you pass in a single object; the named
            // arguments are for legacy support.
            if( $.isPlainObject( url ) ){
                onSuccess = url.success;
                onError = url.error;
                withCredentials = url.withCredentials;
                headers = url.headers;
                responseType = url.responseType || null;
                url = url.url;
            }
            var protocol = $.getUrlProtocol( url );
            var request = $.createAjaxRequest( protocol === "file:" );

            if ( !$.isFunction( onSuccess ) ) {
                throw new Error( "makeAjaxRequest requires a success callback" );
            }
            request.onreadystatechange = function() {
                // 4 = DONE (https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Properties)
                if ( request.readyState == 4 ) {
                    request.onreadystatechange = function(){};
                    // With protocols other than http/https, a successful request status is in
                    // the 200's on Firefox and 0 on other browsers
                    if ( (request.status >= 200 && request.status < 300) ||
                        ( request.status === 0 &&
                          protocol !== "http:" &&
                          protocol !== "https:" )) {
                        onSuccess( request );
                    } else {

                        if ( $.isFunction( onError ) ) {
                            onError( request );
                        }
                    }
                }
            };
            try {
                request.open( "GET", url, true );

                if (responseType) {
                    request.responseType = responseType;
                }
                if (headers) {
                    for (var headerName in headers) {
                        if (headers.hasOwnProperty(headerName) && headers[headerName]) {
                            request.setRequestHeader(headerName, headers[headerName]);
                        }
                    }
                }
                if (withCredentials) {
                    request.withCredentials = true;
                }
                request.send(null);
            } catch (e) {

                request.onreadystatechange = function(){};
                if (window.XDomainRequest) { // IE9 or IE8 might as well try to use XDomainRequest
                    var xdr = new XDomainRequest();
                    if (xdr) {
                        xdr.onload = function (e) {
                            if ( $.isFunction( onSuccess ) ) {
                                onSuccess({ // Faking an xhr object
                                    responseText: xdr.responseText,
                                    status: 200, // XDomainRequest doesn't support status codes, so we just fake one! :/
                                    statusText: 'OK'
                                });
                            }
                        };
                        xdr.onerror = function (e) {
                            if ($.isFunction(onError)) {
                                onError({ // Faking an xhr object
                                    responseText: xdr.responseText,
                                    status: 444, // 444 No Response
                                    statusText: 'An error happened. Due to an XDomainRequest deficiency we can not extract any information about this error. Upgrade your browser.'
                                });
                            }
                        };
                        try {
                            xdr.open('GET', url);
                            xdr.send();
                        } catch (e2) {
                            if ( $.isFunction( onError ) ) {
                                onError( request, e );
                            }
                        }
                    }
                } else {
                    if ( $.isFunction( onError ) ) {
                        onError( request, e );
                    }
                }
            }
            return request;
        },
        jsonp: function( options ){
            var script,
                url = options.url,
                head = document.head ||
                    document.getElementsByTagName( "head" )[ 0 ] ||
                    document.documentElement,
                jsonpCallback = options.callbackName || 'openseadragon' + $.now(),
                previous = window[ jsonpCallback ],
                replace = "$1" + jsonpCallback + "$2",
                callbackParam = options.param || 'callback',
                callback = options.callback;

            url = url.replace( /(\=)\?(&|$)|\?\?/i, replace );
            // Add callback manually
            url += (/\?/.test( url ) ? "&" : "?") + callbackParam + "=" + jsonpCallback;

            // Install callback
            window[ jsonpCallback ] = function( response ) {
                if ( !previous ){
                    try{
                        delete window[ jsonpCallback ];
                    }catch(e){
                        //swallow
                    }
                } else {
                    window[ jsonpCallback ] = previous;
                }
                if( callback && $.isFunction( callback ) ){
                    callback( response );
                }
            };
            script = document.createElement( "script" );

            //TODO: having an issue with async info requests
            if( undefined !== options.async || false !== options.async ){
                script.async = "async";
            }
            if ( options.scriptCharset ) {
                script.charset = options.scriptCharset;
            }
            script.src = url;

            // Attach handlers for all browsers
            script.onload = script.onreadystatechange = function( _, isAbort ) {
                if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {
                    // Handle memory leak in IE
                    script.onload = script.onreadystatechange = null;

                    // Remove the script
                    if ( head && script.parentNode ) {
                        head.removeChild( script );
                    }
                    // Dereference the script
                    script = undefined;
                }
            };
            // Use insertBefore instead of appendChild to circumvent an IE6 bug.
            // This arises when a base node is used (#2709 and #4378).
            head.insertBefore( script, head.firstChild );

        },
        createFromDZI: function() {
            throw "OpenSeadragon.createFromDZI is deprecated, use Viewer.open.";
        },
        parseXml: function( string ) {
            if ( window.DOMParser ) {
                $.parseXml = function( string ) {
                    var xmlDoc = null,
                        parser;

                    parser = new DOMParser();
                    xmlDoc = parser.parseFromString( string, "text/xml" );
                    return xmlDoc;
                };
            } else if ( window.ActiveXObject ) {
                $.parseXml = function( string ) {
                    var xmlDoc = null;

                    xmlDoc = new window.ActiveXObject( "Microsoft.XMLDOM" );
                    xmlDoc.async = false;
                    xmlDoc.loadXML( string );
                    return xmlDoc;
                };
            } else {
                throw new Error( "Browser doesn't support XML DOM." );
            }
            return $.parseXml( string );
        },
        parseJSON: function(string) {
            if (window.JSON && window.JSON.parse) {
                $.parseJSON = window.JSON.parse;
            } else {
                // Should only be used by IE8 in non standards mode
                $.parseJSON = function(string) {
                    //eslint-disable-next-line no-eval
                    return eval('(' + string + ')');
                };
            }
            return $.parseJSON(string);
        },
        imageFormatSupported: function( extension ) {
            extension = extension ? extension : "";
            // eslint-disable-next-line no-use-before-define
            return !!FILEFORMATS[ extension.toLowerCase() ];
        }
    });
    $.Browser = {
        vendor: $.BROWSERS.UNKNOWN,
        version: 0,
        alpha: true
    };
    var FILEFORMATS = {
            "bmp": false,
            "jpeg": true,
            "jpg": true,
            "png": true,
            "tif": false,
            "wdp": false
        },
        URLPARAMS = {};
    (function() {
        //A small auto-executing routine to determine the browser vendor,
        //version and supporting feature sets.
        var ver = navigator.appVersion,
            ua = navigator.userAgent,
            regex;

        switch( navigator.appName ){
            case "Microsoft Internet Explorer":
                if( !!window.attachEvent &&
                    !!window.ActiveXObject ) {
                    $.Browser.vendor = $.BROWSERS.IE;
                    $.Browser.version = parseFloat(
                        ua.substring(
                            ua.indexOf( "MSIE" ) + 5,
                            ua.indexOf( ";", ua.indexOf( "MSIE" ) ) )
                        );
                }
                break;
            case "Netscape":
                if (window.addEventListener) {
                    if ( ua.indexOf( "Firefox" ) >= 0 ) {
                        $.Browser.vendor = $.BROWSERS.FIREFOX;
                        $.Browser.version = parseFloat(
                            ua.substring( ua.indexOf( "Firefox" ) + 8 )
                        );
                    } else if ( ua.indexOf( "Safari" ) >= 0 ) {
                        $.Browser.vendor = ua.indexOf( "Chrome" ) >= 0 ?
                            $.BROWSERS.CHROME :
                            $.BROWSERS.SAFARI;
                        $.Browser.version = parseFloat(
                            ua.substring(
                                ua.substring( 0, ua.indexOf( "Safari" ) ).lastIndexOf( "/" ) + 1,
                                ua.indexOf( "Safari" )
                            )
                        );
                    } else {
                        regex = new RegExp( "Trident/.*rv:([0-9]{1,}[.0-9]{0,})");
                        if ( regex.exec( ua ) !== null ) {
                            $.Browser.vendor = $.BROWSERS.IE;
                            $.Browser.version = parseFloat( RegExp.$1 );
                        }
                    }
                }
                break;
            case "Opera":
                $.Browser.vendor = $.BROWSERS.OPERA;
                $.Browser.version = parseFloat( ver );
                break;
        }
            // ignore '?' portion of query string
        var query = window.location.search.substring( 1 ),
            parts = query.split('&'),
            part,
            sep,
            i;

        for ( i = 0; i < parts.length; i++ ) {
            part = parts[ i ];
            sep = part.indexOf( '=' );

            if ( sep > 0 ) {
                URLPARAMS[ part.substring( 0, sep ) ] =
                    decodeURIComponent( part.substring( sep + 1 ) );
            }
        }
        //determine if this browser supports image alpha transparency
        $.Browser.alpha = !(
            (
                $.Browser.vendor == $.BROWSERS.IE &&
                $.Browser.version < 9
            ) || (
                $.Browser.vendor == $.BROWSERS.CHROME &&
                $.Browser.version < 2
            )
        );

        //determine if this browser supports element.style.opacity
        $.Browser.opacity = !(
            $.Browser.vendor == $.BROWSERS.IE &&
            $.Browser.version < 9
        );

    })();
    //TODO: $.console is often used inside a try/catch block which generally
    // prevents allowings errors to occur with detection until a debugger
    // is attached. Although I've been guilty of the same anti-pattern
    // I eventually was convinced that errors should naturally propogate in
    // all but the most special cases.

    var nullfunction = function( msg ){
            //document.location.hash = msg;
        };
    $.console = window.console || {
        log: nullfunction,
        debug: nullfunction,
        info: nullfunction,
        warn: nullfunction,
        error: nullfunction,
        assert: nullfunction
    };
    // Adding support for HTML5's requestAnimationFrame as suggested by acdha.
    // Implementation taken from matt synder's post here:
    // http://mattsnider.com/cross-browser-and-legacy-supported-requestframeanimation/
    (function( w ) {
        // most browsers have an implementation
        var requestAnimationFrame = w.requestAnimationFrame ||
            w.mozRequestAnimationFrame ||
            w.webkitRequestAnimationFrame ||
            w.msRequestAnimationFrame;

        var cancelAnimationFrame = w.cancelAnimationFrame ||
            w.mozCancelAnimationFrame ||
            w.webkitCancelAnimationFrame ||
            w.msCancelAnimationFrame;

        // polyfill, when necessary
        if ( requestAnimationFrame && cancelAnimationFrame ) {
            // We can't assign these window methods directly to $ because they
            // expect their "this" to be "window", so we call them in wrappers.
            $.requestAnimationFrame = function(){
                return requestAnimationFrame.apply( w, arguments );
            };
            $.cancelAnimationFrame = function(){
                return cancelAnimationFrame.apply( w, arguments );
            };
        } else {
            var aAnimQueue = [],
                processing = [],
                iRequestId = 0,
                iIntervalId;

            // create a mock requestAnimationFrame function
            $.requestAnimationFrame = function( callback ) {
                aAnimQueue.push( [ ++iRequestId, callback ] );

                if ( !iIntervalId ) {
                    iIntervalId = setInterval( function() {
                        if ( aAnimQueue.length ) {
                            var time = $.now();
                            // Process all of the currently outstanding frame
                            // requests, but none that get added during the
                            // processing.
                            // Swap the arrays so we don't have to create a new
                            // array every frame.
                            var temp = processing;
                            processing = aAnimQueue;
                            aAnimQueue = temp;
                            while ( processing.length ) {
                                processing.shift()[ 1 ]( time );
                            }
                        } else {
                            // don't continue the interval, if unnecessary
                            clearInterval( iIntervalId );
                            iIntervalId = undefined;
                        }
                    }, 1000 / 50); // estimating support for 50 frames per second
                }
                return iRequestId;
            };
            // create a mock cancelAnimationFrame function
            $.cancelAnimationFrame = function( requestId ) {
                // find the request ID and remove it
                var i, j;
                for ( i = 0, j = aAnimQueue.length; i < j; i += 1 ) {
                    if ( aAnimQueue[ i ][ 0 ] === requestId ) {
                        aAnimQueue.splice( i, 1 );
                        return;
                    }
                }
                // If it's not in the queue, it may be in the set we're currently
                // processing (if cancelAnimationFrame is called from within a
                // requestAnimationFrame callback).
                for ( i = 0, j = processing.length; i < j; i += 1 ) {
                    if ( processing[ i ][ 0 ] === requestId ) {
                        processing.splice( i, 1 );
                        return;
                    }
                }
            };
        }
    })( window );
    function getOffsetParent( element, isFixed ) {
        if ( isFixed && element != document.body ) {
            return document.body;
        } else {
            return element.offsetParent;
        }
    }
}(OpenSeadragon));
// Universal Module Definition, supports CommonJS, AMD and simple script tag
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // expose as amd module
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // expose as commonjs module
        module.exports = factory();
    } else {
        // expose as window.OpenSeadragon
        root.OpenSeadragon = factory();
    }
}(this, function () {
    return OpenSeadragon;
}));
