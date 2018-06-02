

(function( $ ){
$.Tile = function(level, x, y, bounds, exists, url, context2D, loadWithAjax, ajaxHeaders, sourceBounds) {
    this.level = level;

    this.x = x;

    this.y = y;

    this.bounds = bounds;

    this.sourceBounds = sourceBounds;

    this.exists = exists;

    this.url = url;

    this.context2D = context2D;

    this.loadWithAjax = loadWithAjax;

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

    this.image = null;
    this.style = null;

    this.position = null;

    this.size = null;

    this.blendStart = null;

    this.opacity = null;

    this.squaredDistance = null;

    this.visibility = null;
    this.beingDrawn = false;
    this.lastTouchTime = 0;
    this.isRightMost = false;
    this.isBottomMost = false;
};
$.Tile.prototype = {

    toString: function() {
        return this.level + "/" + this.x + "_" + this.y;
    },
    // private
    _hasTransparencyChannel: function() {
        return !!this.context2D || this.url.match('.png');
    },
    drawHTML: function( container ) {
        if (!this.cacheImageRecord) {
            $.console.warn(
                '[Tile.drawHTML] attempting to draw tile %s when it\'s not cached',
                this.toString());
            return;
        }
        if ( !this.loaded ) {
            $.console.warn(
                "Attempting to draw tile %s when it's not yet loaded.",
                this.toString()
            );
            return;
        }
        //EXPERIMENTAL - trying to figure out how to scale the container
        // content during animation of the container size.

        if ( !this.element ) {
            this.element = $.makeNeutralElement( "div" );
            this.imgElement = this.cacheImageRecord.getImage().cloneNode();
            this.imgElement.style.msInterpolationMode = "nearest-neighbor";
            this.imgElement.style.width = "100%";
            this.imgElement.style.height = "100%";

            this.style = this.element.style;
            this.style.position = "absolute";
        }
        if ( this.element.parentNode != container ) {
            container.appendChild( this.element );
        }
        if ( this.imgElement.parentNode != this.element ) {
            this.element.appendChild( this.imgElement );
        }
        this.style.top = this.position.y + "px";
        this.style.left = this.position.x + "px";
        this.style.height = this.size.y + "px";
        this.style.width = this.size.x + "px";

        $.setElementOpacity( this.element, this.opacity );
    },
    drawCanvas: function( context, drawingHandler, scale, translate ) {
        var position = this.position.times($.pixelDensityRatio),
            size = this.size.times($.pixelDensityRatio),
            rendered;

        if (!this.context2D && !this.cacheImageRecord) {
            $.console.warn(
                '[Tile.drawCanvas] attempting to draw tile %s when it\'s not cached',
                this.toString());
            return;
        }
        rendered = this.context2D || this.cacheImageRecord.getRenderedContext();

        if ( !this.loaded || !rendered ){
            $.console.warn(
                "Attempting to draw tile %s when it's not yet loaded.",
                this.toString()
            );

            return;
        }
        context.save();

        context.globalAlpha = this.opacity;

        if (typeof scale === 'number' && scale !== 1) {
            // draw tile at a different scale
            position = position.times(scale);
            size = size.times(scale);
        }
        if (translate instanceof $.Point) {
            // shift tile position slightly
            position = position.plus(translate);
        }
        //if we are supposed to be rendering fully opaque rectangle,
        //ie its done fading or fading is turned off, and if we are drawing
        //an image with an alpha channel, then the only way
        //to avoid seeing the tile underneath is to clear the rectangle
        if (context.globalAlpha === 1 && this._hasTransparencyChannel()) {
            //clearing only the inside of the rectangle occupied
            //by the png prevents edge flikering
            context.clearRect(
                position.x + 1,
                position.y + 1,
                size.x - 2,
                size.y - 2
            );
        }
        // This gives the application a chance to make image manipulation
        // changes as we are rendering the image
        drawingHandler({context: context, tile: this, rendered: rendered});
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
    getScaleForEdgeSmoothing: function() {
        var context;
        if (this.cacheImageRecord) {
            context = this.cacheImageRecord.getRenderedContext();
        } else if (this.context2D) {
            context = this.context2D;
        } else {
            $.console.warn(
                '[Tile.drawCanvas] attempting to get tile scale %s when tile\'s not cached',
                this.toString());
            return 1;
        }
        return context.canvas.width / (this.size.x * $.pixelDensityRatio);
    },
    getTranslationForEdgeSmoothing: function(scale, canvasSize, sketchCanvasSize) {
        // The translation vector must have positive values, otherwise the image goes a bit off
        // the sketch canvas to the top and left and we must use negative coordinates to repaint it
        // to the main canvas. In that case, some browsers throw:
        // INDEX_SIZE_ERR: DOM Exception 1: Index or size was negative, or greater than the allowed value.
        var x = Math.max(1, Math.ceil((sketchCanvasSize.x - canvasSize.x) / 2));
        var y = Math.max(1, Math.ceil((sketchCanvasSize.y - canvasSize.y) / 2));
        return new $.Point(x, y).minus(
            this.position
                .times($.pixelDensityRatio)
                .times(scale || 1)
                .apply(function(x) {
                    return x % 1;
                })
        );
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
