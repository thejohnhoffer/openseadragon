

(function( $ ){
$.LegacyTileSource = function( levels ) {
    var options,
        width,
        height;

    if( $.isArray( levels ) ){
        options = {
            type: 'legacy-image-pyramid',
            levels: levels
        };
    }
    //clean up the levels to make sure we support all formats
    options.levels = filterFiles( options.levels );

    if ( options.levels.length > 0 ) {
        width = options.levels[ options.levels.length - 1 ].width;
        height = options.levels[ options.levels.length - 1 ].height;
    }
    else {
        width = 0;
        height = 0;
        $.console.error( "No supported image formats found" );
    }
    $.extend( true, options, {
        width: width,
        height: height,
        tileSize: Math.max( height, width ),
        tileOverlap: 0,
        minLevel: 0,
        maxLevel: options.levels.length > 0 ? options.levels.length - 1 : 0
    } );
    $.TileSource.apply( this, [ options ] );

    this.levels = options.levels;
};
$.extend( $.LegacyTileSource.prototype, $.TileSource.prototype, {
    supports: function( data, url ){
        return (
            data.type &&
            "legacy-image-pyramid" == data.type
        ) || (
            data.documentElement &&
            "legacy-image-pyramid" == data.documentElement.getAttribute('type')
        );
    },
    configure: function( configuration, dataUrl ){
        var options;

        if( !$.isPlainObject(configuration) ){
            options = configureFromXML( this, configuration );

        }else{
            options = configureFromObject( this, configuration );
        }
        return options;

    },
    getLevelScale: function ( level ) {
        var levelScale = NaN;
        if ( this.levels.length > 0 && level >= this.minLevel && level <= this.maxLevel ) {
            levelScale =
                this.levels[ level ].width /
                this.levels[ this.maxLevel ].width;
        }
        return levelScale;
    },
    getNumTiles: function( level ) {
        var scale = this.getLevelScale( level );
        if ( scale ){
            return new $.Point( 1, 1 );
        } else {
            return new $.Point( 0, 0 );
        }
    },
    getTileUrl: function ( level, x, y ) {
        var url = null;
        if ( this.levels.length > 0 && level >= this.minLevel && level <= this.maxLevel ) {
            url = this.levels[ level ].url;
        }
        return url;
    }
} );
function filterFiles( files ){
    var filtered = [],
        file,
        i;
    for( i = 0; i < files.length; i++ ){
        file = files[ i ];
        if( file.height &&
            file.width &&
            file.url ){
            //This is sufficient to serve as a level
            filtered.push({
                url: file.url,
                width: Number( file.width ),
                height: Number( file.height )
            });
        }
        else {
            $.console.error( 'Unsupported image format: %s', file.url ? file.url : '<no URL>' );
        }
    }
    return filtered.sort(function(a, b) {
        return a.height - b.height;
    });
}
function configureFromXML( tileSource, xmlDoc ){
    if ( !xmlDoc || !xmlDoc.documentElement ) {
        throw new Error( $.getString( "Errors.Xml" ) );
    }
    var root = xmlDoc.documentElement,
        rootName = root.tagName,
        conf = null,
        levels = [],
        level,
        i;

    if ( rootName == "image" ) {
        try {
            conf = {
                type: root.getAttribute( "type" ),
                levels: []
            };
            levels = root.getElementsByTagName( "level" );
            for ( i = 0; i < levels.length; i++ ) {
                level = levels[ i ];

                conf.levels.push({
                    url: level.getAttribute( "url" ),
                    width: parseInt( level.getAttribute( "width" ), 10 ),
                    height: parseInt( level.getAttribute( "height" ), 10 )
                });
            }
            return configureFromObject( tileSource, conf );

        } catch ( e ) {
            throw (e instanceof Error) ?
                e :
                new Error( 'Unknown error parsing Legacy Image Pyramid XML.' );
        }
    } else if ( rootName == "collection" ) {
        throw new Error( 'Legacy Image Pyramid Collections not yet supported.' );
    } else if ( rootName == "error" ) {
        throw new Error( 'Error: ' + xmlDoc );
    }
    throw new Error( 'Unknown element ' + rootName );
}
function configureFromObject( tileSource, configuration ){
    return configuration.levels;

}
}( OpenSeadragon ));
