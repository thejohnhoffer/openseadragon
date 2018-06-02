

(function( $ ){
// private class
var TileRecord = function( options ) {
    $.console.assert( options, "[TileCache.cacheTile] options is required" );
    $.console.assert( options.tile, "[TileCache.cacheTile] options.tile is required" );
    $.console.assert( options.tiledImage, "[TileCache.cacheTile] options.tiledImage is required" );
    this.tile = options.tile;
    this.tiledImage = options.tiledImage;
};
// private class
var ImageRecord = function(options) {
    $.console.assert( options, "[ImageRecord] options is required" );
    $.console.assert( options.image, "[ImageRecord] options.image is required" );
    this._image = options.image;
    this._tiles = [];
};
ImageRecord.prototype = {
    destroy: function() {
        this._image = null;
        this._renderedContext = null;
        this._tiles = null;
    },
    getImage: function() {
        return this._image;
    },
    getRenderedContext: function() {
        if (!this._renderedContext) {
            var canvas = document.createElement( 'canvas' );
            canvas.width = this._image.width;
            canvas.height = this._image.height;
            this._renderedContext = canvas.getContext('2d');
            this._renderedContext.drawImage( this._image, 0, 0 );
            //since we are caching the prerendered image on a canvas
            //allow the image to not be held in memory
            this._image = null;
        }
        return this._renderedContext;
    },
    setRenderedContext: function(renderedContext) {
        $.console.error("ImageRecord.setRenderedContext is deprecated. " +
                "The rendered context should be created by the ImageRecord " +
                "itself when calling ImageRecord.getRenderedContext.");
        this._renderedContext = renderedContext;
    },
    addTile: function(tile) {
        $.console.assert(tile, '[ImageRecord.addTile] tile is required');
        this._tiles.push(tile);
    },
    removeTile: function(tile) {
        for (var i = 0; i < this._tiles.length; i++) {
            if (this._tiles[i] === tile) {
                this._tiles.splice(i, 1);
                return;
            }
        }
        $.console.warn('[ImageRecord.removeTile] trying to remove unknown tile', tile);
    },
    getTileCount: function() {
        return this._tiles.length;
    }
};
$.TileCache = function( options ) {
    options = options || {};
    this._maxImageCacheCount = options.maxImageCacheCount || $.DEFAULT_SETTINGS.maxImageCacheCount;
    this._tilesLoaded = [];
    this._imagesLoaded = [];
    this._imagesLoadedCount = 0;
};
$.TileCache.prototype = {
    numTilesLoaded: function() {
        return this._tilesLoaded.length;
    },
    cacheTile: function( options ) {
        $.console.assert( options, "[TileCache.cacheTile] options is required" );
        $.console.assert( options.tile, "[TileCache.cacheTile] options.tile is required" );
        $.console.assert( options.tile.cacheKey, "[TileCache.cacheTile] options.tile.cacheKey is required" );
        $.console.assert( options.tiledImage, "[TileCache.cacheTile] options.tiledImage is required" );

        var cutoff = options.cutoff || 0;
        var insertionIndex = this._tilesLoaded.length;

        var imageRecord = this._imagesLoaded[options.tile.cacheKey];
        if (!imageRecord) {
            $.console.assert( options.image, "[TileCache.cacheTile] options.image is required to create an ImageRecord" );
            imageRecord = this._imagesLoaded[options.tile.cacheKey] = new ImageRecord({
                image: options.image
            });
            this._imagesLoadedCount++;
        }
        imageRecord.addTile(options.tile);
        options.tile.cacheImageRecord = imageRecord;

        // Note that just because we're unloading a tile doesn't necessarily mean
        // we're unloading an image. With repeated calls it should sort itself out, though.
        if ( this._imagesLoadedCount > this._maxImageCacheCount ) {
            var worstTile = null;
            var worstTileIndex = -1;
            var worstTileRecord = null;
            var prevTile, worstTime, worstLevel, prevTime, prevLevel, prevTileRecord;

            for ( var i = this._tilesLoaded.length - 1; i >= 0; i-- ) {
                prevTileRecord = this._tilesLoaded[ i ];
                prevTile = prevTileRecord.tile;

                if ( prevTile.level <= cutoff || prevTile.beingDrawn ) {
                    continue;
                } else if ( !worstTile ) {
                    worstTile = prevTile;
                    worstTileIndex = i;
                    worstTileRecord = prevTileRecord;
                    continue;
                }
                prevTime = prevTile.lastTouchTime;
                worstTime = worstTile.lastTouchTime;
                prevLevel = prevTile.level;
                worstLevel = worstTile.level;

                if ( prevTime < worstTime ||
                   ( prevTime == worstTime && prevLevel > worstLevel ) ) {
                    worstTile = prevTile;
                    worstTileIndex = i;
                    worstTileRecord = prevTileRecord;
                }
            }
            if ( worstTile && worstTileIndex >= 0 ) {
                this._unloadTile(worstTileRecord);
                insertionIndex = worstTileIndex;
            }
        }
        this._tilesLoaded[ insertionIndex ] = new TileRecord({
            tile: options.tile,
            tiledImage: options.tiledImage
        });
    },
    clearTilesFor: function( tiledImage ) {
        $.console.assert(tiledImage, '[TileCache.clearTilesFor] tiledImage is required');
        var tileRecord;
        for ( var i = 0; i < this._tilesLoaded.length; ++i ) {
            tileRecord = this._tilesLoaded[ i ];
            if ( tileRecord.tiledImage === tiledImage ) {
                this._unloadTile(tileRecord);
                this._tilesLoaded.splice( i, 1 );
                i--;
            }
        }
    },
    // private
    getImageRecord: function(cacheKey) {
        $.console.assert(cacheKey, '[TileCache.getImageRecord] cacheKey is required');
        return this._imagesLoaded[cacheKey];
    },
    // private
    _unloadTile: function(tileRecord) {
        $.console.assert(tileRecord, '[TileCache._unloadTile] tileRecord is required');
        var tile = tileRecord.tile;
        var tiledImage = tileRecord.tiledImage;

        tile.unload();
        tile.cacheImageRecord = null;

        var imageRecord = this._imagesLoaded[tile.cacheKey];
        imageRecord.removeTile(tile);
        if (!imageRecord.getTileCount()) {
            imageRecord.destroy();
            delete this._imagesLoaded[tile.cacheKey];
            this._imagesLoadedCount--;
        }
        tiledImage.viewer.raiseEvent("tile-unloaded", {
            tile: tile,
            tiledImage: tiledImage
        });
    }
};
}( OpenSeadragon ));
