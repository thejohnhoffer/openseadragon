

(function( $ ){
$.Tile = function(level, x, y, bounds, exists, url, context2D, ajaxHeaders, sourceBounds) {
    this.level = level;

    this.x = x;

    this.y = y;

    this.bounds = bounds;

    this.sourceBounds = sourceBounds;

    this.exists = exists;

    this.url = url;

    this.context2D = context2D;

    this.ajaxHeaders = ajaxHeaders;

    if (this.ajaxHeaders) {
        this.cacheKey = this.url + "+" + JSON.stringify(this.ajaxHeaders);
    } else {
        this.cacheKey = this.url;
    }
    this.loaded = false;

    this.loading = false;
    this.element = null;

    this.imgElement = null;

    this.style = null;

    this.position = null;

    this.size = null;

    this.blendStart = null;


    this.squaredDistance = null;

    this.visibility = null;
    this.beingDrawn = false;
    this.lastTouchTime = 0;
    this.isRightMost = false;
    this.isBottomMost = false;
};
$.Tile.prototype = {

    // private
    _hasTransparencyChannel: function() {
        return !!this.context2D || this.url.match('.png');
    },
    drawCanvas: function( context ) {
        var position = this.position.times($.pixelDensityRatio),
            size = this.size.times($.pixelDensityRatio),
            rendered;

        if (!this.context2D && !this.cacheImageRecord) {
            return;
        }
        rendered = this.context2D || this.cacheImageRecord.getRenderedContext();

        if ( !this.loaded || !rendered ){

            return;
        }
        context.save();

        //if we are supposed to be rendering fully opaque rectangle,
        //ie its done fading or fading is turned off, and if we are drawing
        //an image with an alpha channel, then the only way
        //to avoid seeing the tile underneath is to clear the rectangle
        if (this._hasTransparencyChannel()) {
            //clearing only the inside of the rectangle occupied
            //by the png prevents edge flikering
            context.clearRect(
                position.x,
                position.y,
                size.x,
                size.y
            );
        }
        var sourceWidth, sourceHeight;
        if (this.sourceBounds) {
            sourceWidth = Math.min(this.sourceBounds.width, rendered.canvas.width);
            sourceHeight = Math.min(this.sourceBounds.height, rendered.canvas.height);
        } else {
            sourceWidth = rendered.canvas.width;
            sourceHeight = rendered.canvas.height;
        }
        context.drawImage(
            rendered.canvas,
            0,
            0,
            sourceWidth,
            sourceHeight,
            position.x,
            position.y,
            size.x,
            size.y
        );

        context.restore();
    },
    unload: function() {
        if ( this.imgElement && this.imgElement.parentNode ) {
            this.imgElement.parentNode.removeChild( this.imgElement );
        }
        if ( this.element && this.element.parentNode ) {
            this.element.parentNode.removeChild( this.element );
        }
        this.element = null;
        this.imgElement = null;
        this.loaded = false;
        this.loading = false;
    }
};
}( OpenSeadragon ));
