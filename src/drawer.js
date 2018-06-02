

(function( $ ){
$.Drawer = function( options ) {

    //backward compatibility for positional args while prefering more
    //idiomatic javascript options object as the only argument
    var args = arguments;

    if( !$.isPlainObject( options ) ){
        options = {
            source: args[ 0 ], // Reference to Viewer tile source.
            viewport: args[ 1 ], // Reference to Viewer viewport.
            element: args[ 2 ] // Parent element.
        };
    }

    this.viewer = options.viewer;
    this.viewport = options.viewport;

    this.container = $.getElement( options.element );


    this.sketchCanvas = null;
    this.sketchContext = null;
    this.element = this.container;

    // We force our container to ltr because our drawing math doesn't work in rtl.
    // This issue only affects our canvas renderer, but we do it always for consistency.
    this.container.dir = 'ltr';

    var viewportSize = this._calculateCanvasSize();
    this.canvas.width = viewportSize.x;
    this.canvas.height = viewportSize.y;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.position = "absolute";

    // explicit left-align
    this.container.style.textAlign = "left";
    this.container.appendChild( this.canvas );
};
$.Drawer.prototype = {
    // deprecated
    needsUpdate: function() {
        return this.viewer.world.needsDraw();
    },
    // deprecated
    numTilesLoaded: function() {
        return this.viewer.tileCache.numTilesLoaded();
    },
    // deprecated
    reset: function() {
        this.viewer.world.resetItems();
        return this;
    },
    // deprecated
    update: function() {
        this.clear();
        this.viewer.world.draw();
        return this;
    },
    destroy: function() {
        //force unloading of current canvas (1x1 will be gc later, trick not necessarily needed)
        this.canvas.width = 1;
        this.canvas.height = 1;
        this.sketchCanvas = null;
        this.sketchContext = null;
    },
    clear: function() {
        this.canvas.innerHTML = "";
        var viewportSize = this._calculateCanvasSize();
        if( this.canvas.width != viewportSize.x ||
            this.canvas.height != viewportSize.y ) {
            this.canvas.width = viewportSize.x;
            this.canvas.height = viewportSize.y;
            if ( this.sketchCanvas !== null ) {
                var sketchCanvasSize = this._calculateSketchCanvasSize();
                this.sketchCanvas.width = sketchCanvasSize.x;
                this.sketchCanvas.height = sketchCanvasSize.y;
            }
        }
        this._clear();
    },
    _clear: function (useSketch, bounds) {
        var context = this._getContext(useSketch);
        if (bounds) {
            context.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
        } else {
            var canvas = context.canvas;
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
    },
    viewportToDrawerRectangle: function(rectangle) {
        var topLeft = this.viewport.pixelFromPoint(rectangle.getTopLeft(), true);
        var size = this.viewport.deltaPixelsFromPoints(rectangle.getSize(), true);

        return new $.Rect(
            topLeft.x * $.pixelDensityRatio,
            topLeft.y * $.pixelDensityRatio,
            size.x * $.pixelDensityRatio,
            size.y * $.pixelDensityRatio
        );
    },
    drawTile: function(tile, drawingHandler, useSketch, scale, translate) {

        var context = this._getContext(useSketch);
        scale = scale || 1;
        tile.drawCanvas(context, drawingHandler, scale, translate);
    },
    _getContext: function( useSketch ) {
        var context = this.context;
        if ( useSketch ) {
            if (this.sketchCanvas === null) {
                this.sketchCanvas = document.createElement( "canvas" );
                var sketchCanvasSize = this._calculateSketchCanvasSize();
                this.sketchCanvas.width = sketchCanvasSize.x;
                this.sketchCanvas.height = sketchCanvasSize.y;
                this.sketchContext = this.sketchCanvas.getContext( "2d" );
            }
            context = this.sketchContext;
        }
        return context;
    },
    // private
    saveContext: function( useSketch ) {
        this._getContext( useSketch ).save();
    },
    // private
    restoreContext: function( useSketch ) {
        this._getContext( useSketch ).restore();
    },
    // private
    setClip: function(rect, useSketch) {
        var context = this._getContext( useSketch );
        context.beginPath();
        context.rect(rect.x, rect.y, rect.width, rect.height);
        context.clip();
    },
    // private
    drawRectangle: function(rect, fillStyle, useSketch) {
        var context = this._getContext( useSketch );
        context.save();
        context.fillStyle = fillStyle;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.restore();
    },
    blendSketch: function(options) {
        var bounds = options.bounds;

        this.context.save();
        if (bounds) {
            // Internet Explorer, Microsoft Edge, and Safari have problems
            // when you call context.drawImage with negative x or y
            // or x + width or y + height greater than the canvas width or height respectively.
            if (bounds.x < 0) {
                bounds.width += bounds.x;
                bounds.x = 0;
            }
            if (bounds.x + bounds.width > this.canvas.width) {
                bounds.width = this.canvas.width - bounds.x;
            }
            if (bounds.y < 0) {
                bounds.height += bounds.y;
                bounds.y = 0;
            }
            if (bounds.y + bounds.height > this.canvas.height) {
                bounds.height = this.canvas.height - bounds.y;
            }
            this.context.drawImage(
                this.sketchCanvas,
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height,
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height
            );
        } else {
            var scale = options.scale || 1;
            var translate = options.translate;
            var position = translate instanceof $.Point ?
                translate : new $.Point(0, 0);

            var widthExt = 0;
            var heightExt = 0;
            if (translate) {
                var widthDiff = this.sketchCanvas.width - this.canvas.width;
                var heightDiff = this.sketchCanvas.height - this.canvas.height;
                widthExt = Math.round(widthDiff / 2);
                heightExt = Math.round(heightDiff / 2);
            }
            this.context.drawImage(
                this.sketchCanvas,
                position.x - widthExt * scale,
                position.y - heightExt * scale,
                (this.canvas.width + 2 * widthExt) * scale,
                (this.canvas.height + 2 * heightExt) * scale,
                -widthExt,
                -heightExt,
                this.canvas.width + 2 * widthExt,
                this.canvas.height + 2 * heightExt
            );
        }
        this.context.restore();
    },
    getCanvasSize: function(sketch) {
        var canvas = this._getContext(sketch).canvas;
        return new $.Point(canvas.width, canvas.height);
    },
    getCanvasCenter: function() {
        return new $.Point(this.canvas.width / 2, this.canvas.height / 2);
    },
    // private
    _offsetForRotation: function(options) {
        var point = options.point ?
            options.point.times($.pixelDensityRatio) :
            this.getCanvasCenter();

        var context = this._getContext(options.useSketch);
        context.save();

        context.translate(point.x, point.y);
        context.translate(-point.x, -point.y);
    },
    // private
    _restoreRotationChanges: function(useSketch) {
        var context = this._getContext(useSketch);
        context.restore();
    },
    // private
    _calculateCanvasSize: function() {
        var pixelDensityRatio = $.pixelDensityRatio;
        var viewportSize = this.viewport.getContainerSize();
        return {
            x: viewportSize.x * pixelDensityRatio,
            y: viewportSize.y * pixelDensityRatio
        };
    },
    // private
    _calculateSketchCanvasSize: function() {
        return this._calculateCanvasSize();
    }
};
}( OpenSeadragon ));
