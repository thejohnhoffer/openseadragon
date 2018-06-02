

(function( $ ){
$.OsmTileSource = function( width, height, tileSize, tileOverlap, tilesUrl ) {
    var options;

    if( $.isPlainObject( width ) ){
        options = width;
    }else{
        options = {
            width: arguments[0],
            height: arguments[1],
            tileSize: arguments[2],
            tileOverlap: arguments[3],
            tilesUrl: arguments[4]
        };
    }
    //apply default setting for standard public OpenStreatMaps service
    //but allow them to be specified so fliks can host there own instance
    //or apply against other services supportting the same standard
    if( !options.width || !options.height ){
        options.width = 65572864;
        options.height = 65572864;
    }
    if( !options.tileSize ){
        options.tileSize = 256;
        options.tileOverlap = 0;
    }
    if( !options.tilesUrl ){
        options.tilesUrl = "http://tile.openstreetmap.org/";
    }
    options.minLevel = 8;

    $.TileSource.apply( this, [ options ] );

};
$.extend( $.OsmTileSource.prototype, $.TileSource.prototype, {

    supports: function( data, url ){
        return (
            data.type &&
            "openstreetmaps" == data.type
        );
    },
    configure: function( data, url ){
        return data;
    },
    getTileUrl: function( level, x, y ) {
        return this.tilesUrl + (level - 8) + "/" + x + "/" + y + ".png";
    }
});
}( OpenSeadragon ));
