

(function( $ ){
$.DziTileSource = function( width, height, tileSize, tileOverlap, tilesUrl, fileFormat, displayRects, minLevel, maxLevel ) {
    var i,
        rect,
        level,
        options;

    if( $.isPlainObject( width ) ){
        options = width;
    }else{
        options = {
            width: arguments[ 0 ],
            height: arguments[ 1 ],
            tileSize: arguments[ 2 ],
            tileOverlap: arguments[ 3 ],
            tilesUrl: arguments[ 4 ],
            fileFormat: arguments[ 5 ],
            displayRects: arguments[ 6 ],
            minLevel: arguments[ 7 ],
            maxLevel: arguments[ 8 ]
        };
    }
    this._levelRects = {};
    this.tilesUrl = options.tilesUrl;
    this.fileFormat = options.fileFormat;
    this.displayRects = options.displayRects;

    if ( this.displayRects ) {
        for ( i = this.displayRects.length - 1; i >= 0; i-- ) {
            rect = this.displayRects[ i ];
            for ( level = rect.minLevel; level <= rect.maxLevel; level++ ) {
                if ( !this._levelRects[ level ] ) {
                    this._levelRects[ level ] = [];
                }
                this._levelRects[ level ].push( rect );
            }
        }
    }
    $.TileSource.apply( this, [ options ] );

};
$.extend( $.DziTileSource.prototype, $.TileSource.prototype, {

    supports: function( data, url ){
        var ns;
        if ( data.Image ) {
            ns = data.Image.xmlns;
        } else if ( data.documentElement) {
            if ("Image" == data.documentElement.localName || "Image" == data.documentElement.tagName) {
                ns = data.documentElement.namespaceURI;
            }
        }
        ns = (ns || '').toLowerCase();

        return (ns.indexOf('schemas.microsoft.com/deepzoom/2008') !== -1 ||
            ns.indexOf('schemas.microsoft.com/deepzoom/2009') !== -1);
    },
    configure: function( data, url ){
        var options;

        if( !$.isPlainObject(data) ){
            options = configureFromXML( this, data );

        }else{
            options = configureFromObject( this, data );
        }
        if (url && !options.tilesUrl) {
            options.tilesUrl = url.replace(
                    /([^\/]+?)(\.(dzi|xml|js)?(\?[^\/]*)?)?\/?$/, '$1_files/');

            if (url.search(/\.(dzi|xml|js)\?/) != -1) {
                options.queryParams = url.match(/\?.*/);
            }else{
                options.queryParams = '';
            }
        }
        return options;
    },
    getTileUrl: function( level, x, y ) {
        return [ this.tilesUrl, level, '/', x, '_', y, '.', this.fileFormat, this.queryParams ].join( '' );
    },
    tileExists: function( level, x, y ) {
        var rects = this._levelRects[ level ],
            rect,
            scale,
            xMin,
            yMin,
            xMax,
            yMax,
            i;

        if ( !rects || !rects.length ) {
            return true;
        }
        for ( i = rects.length - 1; i >= 0; i-- ) {
            rect = rects[ i ];

            if ( level < rect.minLevel || level > rect.maxLevel ) {
                continue;
            }
            scale = this.getLevelScale( level );
            xMin = rect.x * scale;
            yMin = rect.y * scale;
            xMax = xMin + rect.width * scale;
            yMax = yMin + rect.height * scale;

            xMin = Math.floor( xMin / this._tileWidth );
            yMin = Math.floor( yMin / this._tileWidth ); // DZI tiles are square, so we just use _tileWidth
            xMax = Math.ceil( xMax / this._tileWidth );
            yMax = Math.ceil( yMax / this._tileWidth );

            if ( xMin <= x && x < xMax && yMin <= y && y < yMax ) {
                return true;
            }
        }
        return false;
    }
});
function configureFromXML( tileSource, xmlDoc ){
    if ( !xmlDoc || !xmlDoc.documentElement ) {
        throw new Error( $.getString( "Errors.Xml" ) );
    }
    var root = xmlDoc.documentElement,
        rootName = root.localName || root.tagName,
        ns = xmlDoc.documentElement.namespaceURI,
        configuration = null,
        displayRects = [],
        dispRectNodes,
        dispRectNode,
        rectNode,
        sizeNode,
        i;

    if ( rootName == "Image" ) {
        try {
            sizeNode = root.getElementsByTagName("Size" )[ 0 ];
            if (sizeNode === undefined) {
                sizeNode = root.getElementsByTagNameNS(ns, "Size" )[ 0 ];
            }
            configuration = {
                Image: {
                    xmlns: "http://schemas.microsoft.com/deepzoom/2008",
                    Url: root.getAttribute( "Url" ),
                    Format: root.getAttribute( "Format" ),
                    DisplayRect: null,
                    Overlap: parseInt( root.getAttribute( "Overlap" ), 10 ),
                    TileSize: parseInt( root.getAttribute( "TileSize" ), 10 ),
                    Size: {
                        Height: parseInt( sizeNode.getAttribute( "Height" ), 10 ),
                        Width: parseInt( sizeNode.getAttribute( "Width" ), 10 )
                    }
                }
            };
            if ( !$.imageFormatSupported( configuration.Image.Format ) ) {
                throw new Error(
                    $.getString( "Errors.ImageFormat", configuration.Image.Format.toUpperCase() )
                );
            }
            dispRectNodes = root.getElementsByTagName("DisplayRect" );
            if (dispRectNodes === undefined) {
                dispRectNodes = root.getElementsByTagNameNS(ns, "DisplayRect" )[ 0 ];
            }
            for ( i = 0; i < dispRectNodes.length; i++ ) {
                dispRectNode = dispRectNodes[ i ];
                rectNode = dispRectNode.getElementsByTagName("Rect" )[ 0 ];
                if (rectNode === undefined) {
                    rectNode = dispRectNode.getElementsByTagNameNS(ns, "Rect" )[ 0 ];
                }
                displayRects.push({
                    Rect: {
                        X: parseInt( rectNode.getAttribute( "X" ), 10 ),
                        Y: parseInt( rectNode.getAttribute( "Y" ), 10 ),
                        Width: parseInt( rectNode.getAttribute( "Width" ), 10 ),
                        Height: parseInt( rectNode.getAttribute( "Height" ), 10 ),
                        MinLevel: parseInt( dispRectNode.getAttribute( "MinLevel" ), 10 ),
                        MaxLevel: parseInt( dispRectNode.getAttribute( "MaxLevel" ), 10 )
                    }
                });
            }
            if( displayRects.length ){
                configuration.Image.DisplayRect = displayRects;
            }
            return configureFromObject( tileSource, configuration );

        } catch ( e ) {
            throw (e instanceof Error) ?
                e :
                new Error( $.getString("Errors.Dzi") );
        }
    } else if ( rootName == "Collection" ) {
        throw new Error( $.getString( "Errors.Dzc" ) );
    } else if ( rootName == "Error" ) {
        var messageNode = root.getElementsByTagName("Message")[0];
        var message = messageNode.firstChild.nodeValue;
        throw new Error(message);
    }
    throw new Error( $.getString( "Errors.Dzi" ) );
}
function configureFromObject( tileSource, configuration ){
    var imageData = configuration.Image,
        tilesUrl = imageData.Url,
        fileFormat = imageData.Format,
        sizeData = imageData.Size,
        dispRectData = imageData.DisplayRect || [],
        width = parseInt( sizeData.Width, 10 ),
        height = parseInt( sizeData.Height, 10 ),
        tileSize = parseInt( imageData.TileSize, 10 ),
        tileOverlap = parseInt( imageData.Overlap, 10 ),
        displayRects = [],
        rectData,
        i;

    //TODO: need to figure out out to better handle image format compatibility
    // which actually includes additional file formats like xml and pdf
    // and plain text for various tilesource implementations to avoid low
    // level errors.
    //
    // For now, just don't perform the check.
    //

    for ( i = 0; i < dispRectData.length; i++ ) {
        rectData = dispRectData[ i ].Rect;

        displayRects.push( new $.DisplayRect(
            parseInt( rectData.X, 10 ),
            parseInt( rectData.Y, 10 ),
            parseInt( rectData.Width, 10 ),
            parseInt( rectData.Height, 10 ),
            parseInt( rectData.MinLevel, 10 ),
            parseInt( rectData.MaxLevel, 10 )
        ));
    }
    return $.extend(true, {
        width: width,
        height: height,
        tileSize: tileSize,
        tileOverlap: tileOverlap,
        minLevel: null,
        maxLevel: null,
        tilesUrl: tilesUrl,
        fileFormat: fileFormat,
        displayRects: displayRects
    }, configuration );
}
}( OpenSeadragon ));
