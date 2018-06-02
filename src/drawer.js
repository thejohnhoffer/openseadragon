

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
    this.debugGridColor = typeof options.debugGridColor === 'string' ? [options.debugGridColor] : options.debugGridColor || $.DEFAULT_SETTINGS.debugGridColor;
    this.useCanvas = $.supportsCanvas && ( this.viewer ? this.viewer.useCanvas : true );

    this.container = $.getElement( options.element );

    this.canvas = $.makeNeutralElement( this.useCanvas ? "canvas" : "div" );

    this.context = this.useCanvas ? this.canvas.getContext( "2d" ) : null;
    this.sketchCanvas = null;
    this.sketchContext = null;
    this.element = this.container;

    // We force our container to ltr because our drawing math doesn't work in rtl.
    // This issue only affects our canvas renderer, but we do it always for consistency.
    this.container.dir = 'ltr';

    // check canvas available width and height, set canvas width and height such that the canvas backing store is set to the proper pixel density
    if (this.useCanvas) {
        var viewportSize = this._calculateCanvasSize();
        this.canvas.width = viewportSize.x;
        this.canvas.height = viewportSize.y;
    }
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.position = "absolute";
    $.setElementOpacity( this.canvas, this.opacity, true );

    // explicit left-align
    this.container.style.textAlign = "left";
    this.container.appendChild( this.canvas );
};
$.Drawer.prototype = {
    setOpacity: function( opacity ) {
        var world = this.viewer.world;
        for (var i = 0; i < world.getItemCount(); i++) {
            world.getItemAt( i ).setOpacity( opacity );
        }
        return this;
    },
    getOpacity: function() {
        var world = this.viewer.world;
        var maxOpacity = 0;
        for (var i = 0; i < world.getItemCount(); i++) {
            var opacity = world.getItemAt( i ).getOpacity();
            if ( opacity > maxOpacity ) {
                maxOpacity = opacity;
            }
        }
        return maxOpacity;
    },
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
    canRotate: function() {
        return this.useCanvas;
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
        if ( this.useCanvas ) {
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
        }
    },
    _clear: function (useSketch, bounds) {
        if (!this.useCanvas) {
            return;
        }
        var context = this._getContext(useSketch);
        if (bounds) {
            context.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
        } else {
            var canvas = context.canvas;
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
    },
    viewportToDrawerRectangle: function(rectangle) {
        var topLeft = this.viewport.pixelFromPointNoRotate(rectangle.getTopLeft(), true);
        var size = this.viewport.deltaPixelsFromPointsNoRotate(rectangle.getSize(), true);

        return new $.Rect(
            topLeft.x * $.pixelDensityRatio,
            topLeft.y * $.pixelDensityRatio,
            size.x * $.pixelDensityRatio,
            size.y * $.pixelDensityRatio
        );
    },
    drawTile: function(tile, drawingHandler, useSketch, scale, translate) {

        if (this.useCanvas) {
            var context = this._getContext(useSketch);
            scale = scale || 1;
            tile.drawCanvas(context, drawingHandler, scale, translate);
        } else {
            tile.drawHTML( this.canvas );
        }
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

                // If the viewport is not currently rotated, the sketchCanvas
                // will have the same size as the main canvas. However, if
                // the viewport get rotated later on, we will need to resize it.
                if (this.viewport.getRotation() === 0) {
                    var self = this;
                    this.viewer.addHandler('rotate', function resizeSketchCanvas() {
                        if (self.viewport.getRotation() === 0) {
                            return;
                        }
                        self.viewer.removeHandler('rotate', resizeSketchCanvas);
                        var sketchCanvasSize = self._calculateSketchCanvasSize();
                        self.sketchCanvas.width = sketchCanvasSize.x;
                        self.sketchCanvas.height = sketchCanvasSize.y;
                    });
                }
            }
            context = this.sketchContext;
        }
        return context;
    },
    // private
    saveContext: function( useSketch ) {
        if (!this.useCanvas) {
            return;
        }
        this._getContext( useSketch ).save();
    },
    // private
    restoreContext: function( useSketch ) {
        if (!this.useCanvas) {
            return;
        }
        this._getContext( useSketch ).restore();
    },
    // private
    setClip: function(rect, useSketch) {
        if (!this.useCanvas) {
            return;
        }
        var context = this._getContext( useSketch );
        context.beginPath();
        context.rect(rect.x, rect.y, rect.width, rect.height);
        context.clip();
    },
    // private
    drawRectangle: function(rect, fillStyle, useSketch) {
        if (!this.useCanvas) {
            return;
        }
        var context = this._getContext( useSketch );
        context.save();
        context.fillStyle = fillStyle;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.restore();
    },
    blendSketch: function(opacity, scale, translate, compositeOperation) {
        var options = opacity;
        if (!$.isPlainObject(options)) {
            options = {
                opacity: opacity,
                scale: scale,
                translate: translate,
                compositeOperation: compositeOperation
            };
        }
        if (!this.useCanvas || !this.sketchCanvas) {
            return;
        }
        opacity = options.opacity;
        compositeOperation = options.compositeOperation;
        var bounds = options.bounds;

        this.context.save();
        this.context.globalAlpha = opacity;
        if (compositeOperation) {
            this.context.globalCompositeOperation = compositeOperation;
        }
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
            scale = options.scale || 1;
            translate = options.translate;
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
    // private
    drawDebugInfo: function(tile, count, i, tiledImage) {
        if ( !this.useCanvas ) {
            return;
        }
        var colorIndex = this.viewer.world.getIndexOfItem(tiledImage) % this.debugGridColor.length;
        var context = this.context;
        context.save();
        context.lineWidth = 2 * $.pixelDensityRatio;
        context.font = 'small-caps bold ' + (13 * $.pixelDensityRatio) + 'px arial';
        context.strokeStyle = this.debugGridColor[colorIndex];
        context.fillStyle = this.debugGridColor[colorIndex];

        if ( this.viewport.degrees !== 0 ) {
            this._offsetForRotation({degrees: this.viewport.degrees});
        }
        if (tiledImage.getRotation(true) % 360 !== 0) {
            this._offsetForRotation({
                degrees: tiledImage.getRotation(true),
                point: tiledImage.viewport.pixelFromPointNoRotate(
                    tiledImage._getRotationPoint(true), true)
            });
        }
        context.strokeRect(
            tile.position.x * $.pixelDensityRatio,
            tile.position.y * $.pixelDensityRatio,
            tile.size.x * $.pixelDensityRatio,
            tile.size.y * $.pixelDensityRatio
        );

        var tileCenterX = (tile.position.x + (tile.size.x / 2)) * $.pixelDensityRatio;
        var tileCenterY = (tile.position.y + (tile.size.y / 2)) * $.pixelDensityRatio;

        // Rotate the text the right way around.
        context.translate( tileCenterX, tileCenterY );
        context.rotate( Math.PI / 180 * -this.viewport.degrees );
        context.translate( -tileCenterX, -tileCenterY );

        if( tile.x === 0 && tile.y === 0 ){
            context.fillText(
                "Zoom: " + this.viewport.getZoom(),
                tile.position.x * $.pixelDensityRatio,
                (tile.position.y - 30) * $.pixelDensityRatio
            );
            context.fillText(
                "Pan: " + this.viewport.getBounds().toString(),
                tile.position.x * $.pixelDensityRatio,
                (tile.position.y - 20) * $.pixelDensityRatio
            );
        }
        context.fillText(
            "Level: " + tile.level,
            (tile.position.x + 10) * $.pixelDensityRatio,
            (tile.position.y + 20) * $.pixelDensityRatio
        );
        context.fillText(
            "Column: " + tile.x,
            (tile.position.x + 10) * $.pixelDensityRatio,
            (tile.position.y + 30) * $.pixelDensityRatio
        );
        context.fillText(
            "Row: " + tile.y,
            (tile.position.x + 10) * $.pixelDensityRatio,
            (tile.position.y + 40) * $.pixelDensityRatio
        );
        context.fillText(
            "Order: " + i + " of " + count,
            (tile.position.x + 10) * $.pixelDensityRatio,
            (tile.position.y + 50) * $.pixelDensityRatio
        );
        context.fillText(
            "Size: " + tile.size.toString(),
            (tile.position.x + 10) * $.pixelDensityRatio,
            (tile.position.y + 60) * $.pixelDensityRatio
        );
        context.fillText(
            "Position: " + tile.position.toString(),
            (tile.position.x + 10) * $.pixelDensityRatio,
            (tile.position.y + 70) * $.pixelDensityRatio
        );

        if ( this.viewport.degrees !== 0 ) {
            this._restoreRotationChanges();
        }
        if (tiledImage.getRotation(true) % 360 !== 0) {
            this._restoreRotationChanges();
        }
        context.restore();
    },
    // private
    debugRect: function(rect) {
        if ( this.useCanvas ) {
            var context = this.context;
            context.save();
            context.lineWidth = 2 * $.pixelDensityRatio;
            context.strokeStyle = this.debugGridColor[0];
            context.fillStyle = this.debugGridColor[0];

            context.strokeRect(
                rect.x * $.pixelDensityRatio,
                rect.y * $.pixelDensityRatio,
                rect.width * $.pixelDensityRatio,
                rect.height * $.pixelDensityRatio
            );

            context.restore();
        }
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
        context.rotate(Math.PI / 180 * options.degrees);
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
        var canvasSize = this._calculateCanvasSize();
        if (this.viewport.getRotation() === 0) {
            return canvasSize;
        }
        // If the viewport is rotated, we need a larger sketch canvas in order
        // to support edge smoothing.
        var sketchCanvasSize = Math.ceil(Math.sqrt(
            canvasSize.x * canvasSize.x +
            canvasSize.y * canvasSize.y));
        return {
            x: sketchCanvasSize,
            y: sketchCanvasSize
        };
    }
};
}( OpenSeadragon ));
