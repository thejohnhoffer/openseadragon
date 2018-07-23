

(function( $ ){
$.TileSource = function( width, height, tileSize, tileOverlap, minLevel, maxLevel ) {
    var _this = this;

    var args = arguments,
        options,
        i;

    if( $.isPlainObject( width ) ){
        options = width;
    }else{
        options = {
            width: args[0],
            height: args[1],
            tileSize: args[2],
            tileOverlap: args[3],
            minLevel: args[4],
            maxLevel: args[5]
        };
    }
    //Tile sources supply some events, namely 'ready' when they must be configured
    //by asynchronously fetching their configuration data.
    $.EventSource.call( this );

    //we allow options to override anything we dont treat as
    //required via idiomatic options or which is functionally
    //set depending on the state of the readiness of this tile
    //source
    $.extend( true, this, options );

    if (!this.success) {
        //Any functions that are passed as arguments are bound to the ready callback
        for ( i = 0; i < arguments.length; i++ ) {
            if ( $.isFunction( arguments[ i ] ) ) {
                this.success = arguments[ i ];
                //only one callback per constructor
                break;
            }
        }
    }
    if (this.success) {
        this.addHandler( 'ready', function ( event ) {
            _this.success( event );
        } );
    }


    if( 'string' == $.type( arguments[ 0 ] ) ){
        this.url = arguments[0];
    }
    if (this.url) {
        //in case the getImageInfo method is overriden and/or implies an
        //async mechanism set some safe defaults first
        this.aspectRatio = 1;
        this.dimensions = new $.Point( 10, 10 );
        this._tileWidth = 0;
        this._tileHeight = 0;
        this.tileOverlap = 0;
        this.minLevel = 0;
        this.maxLevel = 0;
        this.ready = false;
        //configuration via url implies the extending class
        //implements and 'configure'
        this.getImageInfo( this.url );

    } else {
        //explicit configuration via positional args in constructor
        //or the more idiomatic 'options' object
        this.ready = true;
        this.aspectRatio = (options.width && options.height) ?
            (options.width / options.height) : 1;
        this.dimensions = new $.Point( options.width, options.height );

        if ( this.tileSize ){
            this._tileWidth = this._tileHeight = this.tileSize;
            delete this.tileSize;
        } else {
            if( this.tileWidth ){
                // We were passed tileWidth in options, but we want to rename it
                // with a leading underscore to make clear that it is not safe to directly modify it
                this._tileWidth = this.tileWidth;
                delete this.tileWidth;
            } else {
                this._tileWidth = 0;
            }
            if( this.tileHeight ){
                // See note above about renaming this.tileWidth
                this._tileHeight = this.tileHeight;
                delete this.tileHeight;
            } else {
                this._tileHeight = 0;
            }
        }
        this.tileOverlap = options.tileOverlap ? options.tileOverlap : 0;
        this.minLevel = options.minLevel ? options.minLevel : 0;
        this.maxLevel = ( undefined !== options.maxLevel && null !== options.maxLevel ) ?
            options.maxLevel : (
                ( options.width && options.height ) ? Math.ceil(
                    Math.log( Math.max( options.width, options.height ) ) /
                    Math.log( 2 )
                ) : 0
            );
        if( this.success && $.isFunction( this.success ) ){
            this.success( this );
        }
    }
};
$.TileSource.prototype = {
    getTileSize: function( level ) {
        return this._tileWidth;
    },
    getTileWidth: function( level ) {
        if (!this._tileWidth) {
            return this.getTileSize(level);
        }
        return this._tileWidth;
    },
    getTileHeight: function( level ) {
        if (!this._tileHeight) {
            return this.getTileSize(level);
        }
        return this._tileHeight;
    },
    getLevelScale: function( level ) {
        // see https://github.com/openseadragon/openseadragon/issues/22
        // we use the tilesources implementation of getLevelScale to generate
        // a memoized re-implementation
        var levelScaleCache = {},
            i;
        for( i = 0; i <= this.maxLevel; i++ ){
            levelScaleCache[ i ] = 1 / Math.pow(2, this.maxLevel - i);
        }
        this.getLevelScale = function( _level ){
            return levelScaleCache[ _level ];
        };
        return this.getLevelScale( level );
    },
    getNumTiles: function( level ) {
        var scale = this.getLevelScale( level ),
            x = Math.ceil( scale * this.dimensions.x / this.getTileWidth(level) ),
            y = Math.ceil( scale * this.dimensions.y / this.getTileHeight(level) );

        return new $.Point( x, y );
    },
    getPixelRatio: function( level ) {
        var imageSizeScaled = this.dimensions.times( this.getLevelScale( level ) ),
            rx = 1.0 / imageSizeScaled.x,
            ry = 1.0 / imageSizeScaled.y;

        return new $.Point(rx, ry);
    },
    getClosestLevel: function() {
        var i,
            tiles;

        for (i = this.minLevel + 1; i <= this.maxLevel; i++){
            tiles = this.getNumTiles(i);
            if (tiles.x > 1 || tiles.y > 1) {
                break;
            }
        }
        return i - 1;
    },
    getTileAtPoint: function(level, point) {

        var widthScaled = this.dimensions.x * this.getLevelScale(level);
        var pixelX = point.x * widthScaled;
        var pixelY = point.y * widthScaled;

        var x = Math.floor(pixelX / this.getTileWidth(level));
        var y = Math.floor(pixelY / this.getTileHeight(level));

        // When point.x == 1 or point.y == 1 / this.aspectRatio we want to
        // return the last tile of the row/column
        if (point.x >= 1) {
            x = this.getNumTiles(level).x - 1;
        }
        var EPSILON = 1e-15;
        if (point.y >= 1 / this.aspectRatio - EPSILON) {
            y = this.getNumTiles(level).y - 1;
        }
        return new $.Point(x, y);
    },
    getTileBounds: function( level, x, y, isSource ) {
        var dimensionsScaled = this.dimensions.times( this.getLevelScale( level ) ),
            tileWidth = this.getTileWidth(level),
            tileHeight = this.getTileHeight(level),
            px = ( x === 0 ) ? 0 : tileWidth * x - this.tileOverlap,
            py = ( y === 0 ) ? 0 : tileHeight * y - this.tileOverlap,
            sx = tileWidth + ( x === 0 ? 1 : 2 ) * this.tileOverlap,
            sy = tileHeight + ( y === 0 ? 1 : 2 ) * this.tileOverlap,
            scale = 1.0 / dimensionsScaled.x;

        sx = Math.min( sx, dimensionsScaled.x - px );
        sy = Math.min( sy, dimensionsScaled.y - py );

        if (isSource) {
            return new $.Rect(0, 0, sx, sy);
        }
        return new $.Rect( px * scale, py * scale, sx * scale, sy * scale );
    },
    getImageInfo: function( url ) {
        var _this = this,
            callback,
            readySource,
            options,
            urlParts,
            filename,
            lastDot;

        if( url ) {
            urlParts = url.split( '/' );
            filename = urlParts[ urlParts.length - 1 ];
            lastDot = filename.lastIndexOf( '.' );
            if ( lastDot > -1 ) {
                urlParts[ urlParts.length - 1 ] = filename.slice( 0, lastDot );
            }
        }
        callback = function( data ){
            if( typeof (data) === "string" ) {
                data = $.parseXml( data );
            }
            var $TileSource = $.TileSource.determineType( _this, data, url );
            if ( !$TileSource ) {
                _this.raiseEvent( 'open-failed', { message: "Unable to load TileSource", source: url } );
                return;
            }
            options = $TileSource.prototype.configure.apply( _this, [ data, url ]);
            if (options.ajaxWithCredentials === undefined) {
                options.ajaxWithCredentials = _this.ajaxWithCredentials;
            }
            readySource = new $TileSource( options );
            _this.ready = true;

            _this.raiseEvent( 'ready', { tileSource: readySource } );
        };
        // request info via xhr asynchronously.
        $.makeAjaxRequest( {
            url: url,
            withCredentials: this.ajaxWithCredentials,
            headers: this.ajaxHeaders,
            success: function( xhr ) {
                var data = processResponse( xhr );
                callback( data );
            },
            error: function ( xhr, exc ) {
                var msg;
                try {
                    msg = "HTTP " + xhr.status + " attempting to load TileSource";
                } catch ( e ) {
                    var formattedExc;
                    if ( typeof ( exc ) == "undefined" || !exc.toString ) {
                        formattedExc = "Unknown error";
                    } else {
                        formattedExc = exc.toString();
                    }
                    msg = formattedExc + " attempting to load TileSource";
                }
                _this.raiseEvent( 'open-failed', {
                    message: msg,
                    source: url
                });
            }
        });
    },
    supports: function( data, url ) {
        return false;
    },
    configure: function( data, url ) {
        throw new Error( "Method not implemented." );
    },
    getTileUrl: function( level, x, y ) {
        throw new Error( "Method not implemented." );
    },
    getTileAjaxHeaders: function( level, x, y ) {
        return {};
    },
    tileExists: function( level, x, y ) {
        var numTiles = this.getNumTiles( level );
        return level >= this.minLevel &&
               level <= this.maxLevel &&
               x >= 0 &&
               y >= 0 &&
               x < numTiles.x &&
               y < numTiles.y;
    }
};
$.extend( true, $.TileSource.prototype, $.EventSource.prototype );

function processResponse( xhr ){
    var responseText = xhr.responseText,
        status = xhr.status,
        statusText,
        data;

    if ( !xhr ) {
        throw new Error( $.getString( "Errors.Security" ) );
    } else if ( xhr.status !== 200 && xhr.status !== 0 ) {
        status = xhr.status;
        statusText = ( status == 404 ) ?
            "Not Found" :
            xhr.statusText;
        throw new Error( $.getString( "Errors.Status", status, statusText ) );
    }
    if( responseText.match(/\s*<.*/) ){
        try{
        data = ( xhr.responseXML && xhr.responseXML.documentElement ) ?
            xhr.responseXML :
            $.parseXml( responseText );
        } catch (e){
            data = xhr.responseText;
        }
    }else if( responseText.match(/\s*[\{\[].*/) ){
        try{
          data = $.parseJSON(responseText);
        } catch(e){
          data = responseText;
        }
    }else{
        data = responseText;
    }
    return data;
}
$.TileSource.determineType = function( tileSource, data, url ){
    var property;
    for( property in OpenSeadragon ){
        if( property.match(/.+TileSource$/) &&
            $.isFunction( OpenSeadragon[ property ] ) &&
            $.isFunction( OpenSeadragon[ property ].prototype.supports ) &&
            OpenSeadragon[ property ].prototype.supports.call( tileSource, data, url )
        ){
            return OpenSeadragon[ property ];
        }
    }
};
}( OpenSeadragon ));
