
(function( $ ){
// private class
var TileRecord = function( options ) {
    this.tile = options.tile;
    this.tiledImage = options.tiledImage;
};
// private class
var ImageRecord = function(options) {
    this._typedImageData = options.typedImageData;
    this._tiles = [];
};
ImageRecord.prototype = {
    destroy: function() {
        this._typedImageData = null;
        this._renderedContext = null;
        this._tiles = null;
    },
    getTypedImageData: function() {
        return this._typedImageData;
    },
    getClampedArray: function() {
        var min = this._typedImageData.min;
        var max = this._typedImageData.max;
        var width = this._typedImageData.width;
        var height = this._typedImageData.height;
        var typedArray = this._typedImageData.data;

        // Unpack image data into 8-bit RGBA
        var pixelSize = width * height;
        var rgbaSize = 4 * pixelSize;
        var nChannels = typedArray.length / pixelSize;
        var rgbaArray = new Uint8ClampedArray(rgbaSize);
      
        var toByte = function(v) {
            return Math.round(255 * (v - min) / (max - min));
        };
        for (var i = 0; i < rgbaSize; i++) {
            var color = i % 4;
            // Alpha is unless explicitly given
            if (nChannels != 4 && color == 3) {
                rgbaArray[i] = 255;
                continue;
            }
            // Map input channels to colors
            if (nChannels == 1 || color < nChannels) {
                var px = Math.floor(i / 4);
                var chan = color % nChannels;
                var value = typedArray[px + chan];
                rgbaArray[i] = toByte(value);
            }
        }

        return new Uint8ClampedArray(rgbaArray);
    },
    getImageData: function() {
        var width = this._typedImageData.width;
        var height = this._typedImageData.height;
        return new ImageData(this.getClampedArray(), width, height);
    },
    getRenderedContext: function() {
        if (!this._renderedContext) {
            var canvas = document.createElement( 'canvas' );
            var imageData = this.getImageData();
            canvas.width = this._typedImageData.width;
            canvas.height = this._typedImageData.height;
            this._renderedContext = canvas.getContext('2d');
            this._renderedContext.putImageData(imageData, 0, 0);
            //since we are caching the prerendered array on a canvas
            //allow the array to not be held in memory
            this._typedImageData = null;
        }
        return this._renderedContext;
    },
    addTile: function(tile) {
        this._tiles.push(tile);
    },
    removeTile: function(tile) {
        for (var i = 0; i < this._tiles.length; i++) {
            if (this._tiles[i] === tile) {
                this._tiles.splice(i, 1);
                return;
            }
        }
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
    cacheTile: function( options ) {

        var cutoff = options.cutoff || 0;
        var insertionIndex = this._tilesLoaded.length;

        var imageRecord = this._imagesLoaded[options.tile.cacheKey];
        if (!imageRecord) {
            imageRecord = this._imagesLoaded[options.tile.cacheKey] = new ImageRecord({
                typedImageData: options.typedImageData
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
        return this._imagesLoaded[cacheKey];
    },
    // private
    _unloadTile: function(tileRecord) {
        var tile = tileRecord.tile;

        tile.unload();
        tile.cacheImageRecord = null;

        var imageRecord = this._imagesLoaded[tile.cacheKey];
        imageRecord.removeTile(tile);
        if (!imageRecord.getTileCount()) {
            imageRecord.destroy();
            delete this._imagesLoaded[tile.cacheKey];
            this._imagesLoadedCount--;
        }
    }
};
}( OpenSeadragon ));
