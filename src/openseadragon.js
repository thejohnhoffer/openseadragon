
// Typedefs
function OpenSeadragon( options ){
    return new OpenSeadragon.Viewer( options );
}
(function( $ ){

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
    $.pixelDensityRatio = (function () {
        var devicePixelRatio = window.devicePixelRatio || 1;
        return Math.max(devicePixelRatio, 1);
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
    $.extend( $, {
        DEFAULT_SETTINGS: {
            //DATA SOURCE DETAILS
            tileSources: null,
            ajaxWithCredentials: false,
            ajaxHeaders: {},

            //PAN AND ZOOM SETTINGS AND CONSTRAINTS
            visibilityRatio: 0.5, //-> how much of the viewer can be negative space
            minPixelRatio: 0.5, //->closer to 0 draws tiles meant for a higher zoom at this zoom
            defaultZoomLevel: 0,
            minZoomLevel: null,
            maxZoomLevel: null,

            //UI RESPONSIVENESS AND FEEL
            springStiffness: 6.5,
            animationTime: 1.2,

            minZoomImageRatio: 0.9, //-> closer to 0 allows zoom out to infinity
            maxZoomPixelRatio: 1.1, //-> higher allows 'over zoom' into pixels
            smoothTileEdgesMinZoom: 1.1, //-> higher than maxZoomPixelRatio disables it

            //COLLECTION VISUALIZATION SETTINGS
            collectionRows: 3,
            collectionColumns: 0,
            collectionMode: false,
            collectionTileSize: 800,
            collectionTileMargin: 80,

            //PERFORMANCE SETTINGS
            imageLoaderLimit: 0,
            maxImageCacheCount: 200,
            timeout: 30000
        },
        delegate: function( object, method ) {
            return function(){
                var args = arguments;
                if ( args === undefined ){
                    args = [];
                }
                return method.apply( object, args );
            };
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
            offsetParent = getOffsetParent( element, isFixed );

            while ( offsetParent ) {
                result.x += element.offsetLeft;
                result.y += element.offsetTop;

                if ( isFixed ) {
                    result = result.plus( $.getPageScroll() );
                }
                element = offsetParent;
                offsetParent = getOffsetParent( element, isFixed );
            }
            return result;
        },
        getPageScroll: function() {
            $.getPageScroll = function(){
                return new $.Point(
                    window.pageXOffset,
                    window.pageYOffset
                );
            };
            return $.getPageScroll();
        },
        setPageScroll: function( scroll ) {
            $.setPageScroll = function( scroll ) {
                window.scrollTo( scroll.x, scroll.y );
            };
            return $.setPageScroll( scroll );
        },
        getWindowSize: function() {
            $.getWindowSize = function(){
                return new $.Point(
                    window.innerWidth,
                    window.innerHeight
                );
            };
            return $.getWindowSize();
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
            $.now = Date.now;
            return $.now();
        },
        indexOf: function( array, searchElement, fromIndex ) {
            this.indexOf = function( array, searchElement, fromIndex ) {
                return array.indexOf( searchElement, fromIndex );
            };
            return this.indexOf( array, searchElement, fromIndex );
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
            $.createAjaxRequest = function() {
                return new XMLHttpRequest();
            };
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
                if ( request.readyState == 4 ) {
                    request.onreadystatechange = function(){};
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
                var xdr = new XDomainRequest();
                if (xdr) {
                    xdr.onload = function (e) {
                        if ( $.isFunction( onSuccess ) ) {
                            onSuccess({
                                responseText: xdr.responseText,
                                status: 200,
                                statusText: 'OK'
                            });
                        }
                    };
                    xdr.onerror = function (e) {
                        if ($.isFunction(onError)) {
                            onError({ // Faking an xhr object
                                responseText: xdr.responseText,
                                status: 444, // 444 No Response
                                statusText: 'An error happened.'
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
            }
            return request;
        },
        parseXml: function( string ) {
            $.parseXml = function( string ) {
                var xmlDoc = null,
                    parser;

                parser = new DOMParser();
                xmlDoc = parser.parseFromString( string, "text/xml" );
                return xmlDoc;
            };
        },
        parseJSON: function(string) {
            $.parseJSON = window.JSON.parse;
            return $.parseJSON(string);
        }
    });
    // Adding support for HTML5's requestAnimationFrame as suggested by acdha.
    // Implementation taken from matt synder's post here:
    (function( w ) {
        var requestAnimationFrame = w.requestAnimationFrame;
        var cancelAnimationFrame = w.cancelAnimationFrame;

        $.requestAnimationFrame = function(){
            return requestAnimationFrame.apply( w, arguments );
        };
        $.cancelAnimationFrame = function(){
            return cancelAnimationFrame.apply( w, arguments );
        };
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
