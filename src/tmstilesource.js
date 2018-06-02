

(function( $ ){
$.TmsTileSource = function( width, height, tileSize, tileOverlap, tilesUrl ) {
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
    // TMS has integer multiples of 256 for width/height and adds buffer
    // if necessary -> account for this!
    var bufferedWidth = Math.ceil(options.width / 256) * 256,
        bufferedHeight = Math.ceil(options.height / 256) * 256,
        max;

    // Compute number of zoomlevels in this tileset
    if (bufferedWidth > bufferedHeight) {
        max = bufferedWidth / 256;
    } else {
        max = bufferedHeight / 256;
    }
    options.maxLevel = Math.ceil(Math.log(max) / Math.log(2)) - 1;
    options.tileSize = 256;
    options.width = bufferedWidth;
    options.height = bufferedHeight;

    $.TileSource.apply( this, [ options ] );

};
$.extend( $.TmsTileSource.prototype, $.TileSource.prototype, {

    supports: function( data, url ){
        return ( data.type && "tiledmapservice" == data.type );
    },
    configure: function( data, url ){
        return data;
    },
    getTileUrl: function( level, x, y ) {
        // Convert from Deep Zoom definition to TMS zoom definition
        var yTiles = this.getNumTiles( level ).y - 1;

        return this.tilesUrl + level + "/" + x + "/" + (yTiles - y) + ".png";
    }
});
}( OpenSeadragon ));
