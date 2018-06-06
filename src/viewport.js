

(function( $ ){
$.Viewport = function( options ) {
    //backward compatibility for positional args while prefering more
    //idiomatic javascript options object as the only argument
    var args = arguments;
    if (args.length && args[0] instanceof $.Point) {
        options = {
            containerSize: args[0],
            contentSize: args[1],
            config: args[2]
        };
    }
    //options.config and the general config argument are deprecated
    //in favor of the more direct specification of optional settings
    //being passed directly on the options object
    if ( options.config ){
        $.extend( true, options, options.config );
        delete options.config;
    }

    $.extend( true, this, {
        //required settings
        containerSize: null,
        contentSize: null,

        //internal state properties
        zoomPoint: null,
        viewer: null,

        //configurable options
        springStiffness: $.DEFAULT_SETTINGS.springStiffness,
        animationTime: $.DEFAULT_SETTINGS.animationTime,
        minZoomImageRatio: $.DEFAULT_SETTINGS.minZoomImageRatio,
        maxZoomPixelRatio: $.DEFAULT_SETTINGS.maxZoomPixelRatio,
        visibilityRatio: $.DEFAULT_SETTINGS.visibilityRatio,
        defaultZoomLevel: $.DEFAULT_SETTINGS.defaultZoomLevel,
        minZoomLevel: $.DEFAULT_SETTINGS.minZoomLevel,
        maxZoomLevel: $.DEFAULT_SETTINGS.maxZoomLevel,

    }, options );
    this._updateContainerInnerSize();

    this.centerSpringX = new $.Spring({
        initial: 0,
        springStiffness: this.springStiffness,
        animationTime: this.animationTime
    });
    this.centerSpringY = new $.Spring({
        initial: 0,
        springStiffness: this.springStiffness,
        animationTime: this.animationTime
    });
    this.zoomSpring = new $.Spring({
        initial: 1,
        springStiffness: this.springStiffness,
        animationTime: this.animationTime
    });
    this._oldCenterX = this.centerSpringX.current.value;
    this._oldCenterY = this.centerSpringY.current.value;
    this._oldZoom = this.zoomSpring.current.value;

    this._setContentBounds(new $.Rect(0, 0, 1, 1), 1);

    this.goHome(true);
    this.update();
};
$.Viewport.prototype = {
    // @private
    _setContentBounds: function(bounds, contentFactor) {

        this._contentBounds = bounds.clone();
        this._contentSize = this._contentBounds.getSize().times(
            contentFactor);

        this._contentBounds = bounds.getBoundingBox();
        this._contentSize = this._contentBounds.getSize().times(contentFactor);
        this._contentAspectRatio = this._contentSize.x / this._contentSize.y;

    },
    getHomeZoom: function() {
        if (this.defaultZoomLevel) {
            return this.defaultZoomLevel;
        }
        var aspectFactor = this._contentAspectRatio / this.getAspectRatio();
        var output = aspectFactor >= 1 ? 1 : aspectFactor;
        return output / this._contentBounds.width;
    },
    getHomeBounds: function() {
        var center = this._contentBounds.getCenter();
        var width = 1.0 / this.getHomeZoom();
        var height = width / this.getAspectRatio();

        return new $.Rect(
            center.x - (width / 2.0),
            center.y - (height / 2.0),
            width,
            height
        );
    },
    goHome: function(immediately) {
        return this.fitBounds(this.getHomeBounds(), immediately);
    },
    getMinZoom: function() {
        var homeZoom = this.getHomeZoom(),
            zoom = this.minZoomLevel ?
            this.minZoomLevel :
                this.minZoomImageRatio * homeZoom;

        return zoom;
    },
    getMaxZoom: function() {
        var zoom = this.maxZoomLevel;
        if (!zoom) {
            zoom = this._contentSize.x * this.maxZoomPixelRatio / this._containerInnerSize.x;
            zoom /= this._contentBounds.width;
        }
        return Math.max( zoom, this.getHomeZoom() );
    },
    getAspectRatio: function() {
        return this._containerInnerSize.x / this._containerInnerSize.y;
    },
    getContainerSize: function() {
        return new $.Point(
            this.containerSize.x,
            this.containerSize.y
        );
    },
    getBounds: function(current) {
        var center = this.getCenter(current);
        var width = 1.0 / this.getZoom(current);
        var height = width / this.getAspectRatio();

        return new $.Rect(
            center.x - (width / 2.0),
            center.y - (height / 2.0),
            width,
            height
        );
    },
    getBoundsWithMargins: function(current) {
        var bounds = this.getBounds(current);
        return bounds;
    },
    getCenter: function( current ) {
        var centerCurrent = new $.Point(
                this.centerSpringX.current.value,
                this.centerSpringY.current.value
            ),
            centerTarget = new $.Point(
                this.centerSpringX.target.value,
                this.centerSpringY.target.value
            ),
            oldZoomPixel,
            zoom,
            width,
            height,
            bounds,
            newZoomPixel,
            deltaZoomPixels,
            deltaZoomPoints;

        if ( current ) {
            return centerCurrent;
        } else if ( !this.zoomPoint ) {
            return centerTarget;
        }
        oldZoomPixel = this.pixelFromPoint(this.zoomPoint, true);

        zoom = this.getZoom();
        width = 1.0 / zoom;
        height = width / this.getAspectRatio();
        bounds = new $.Rect(
            centerCurrent.x - width / 2.0,
            centerCurrent.y - height / 2.0,
            width,
            height
        );

        newZoomPixel = this._pixelFromPoint(this.zoomPoint, bounds);
        deltaZoomPixels = newZoomPixel.minus( oldZoomPixel );
        deltaZoomPoints = deltaZoomPixels.divide( this._containerInnerSize.x * zoom );

        return centerTarget.plus( deltaZoomPoints );
    },
    getZoom: function( current ) {
        if ( current ) {
            return this.zoomSpring.current.value;
        } else {
            return this.zoomSpring.target.value;
        }
    },
    // private
    _applyZoomConstraints: function(zoom) {
        return Math.max(
            Math.min(zoom, this.getMaxZoom()),
            this.getMinZoom());
    },
    _applyBoundaryConstraints: function(bounds) {
        var newBounds = new $.Rect(
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height);

        var horizontalThreshold = this.visibilityRatio * newBounds.width;
        var boundsRight = newBounds.x + newBounds.width;
        var contentRight = this._contentBounds.x + this._contentBounds.width;
        var leftDx = this._contentBounds.x - boundsRight + horizontalThreshold;
        var rightDx = contentRight - newBounds.x - horizontalThreshold;

        if (horizontalThreshold > this._contentBounds.width) {
            newBounds.x += (leftDx + rightDx) / 2;
        } else if (rightDx < 0) {
            newBounds.x += rightDx;
        } else if (leftDx > 0) {
            newBounds.x += leftDx;
        }

        var verticalThreshold = this.visibilityRatio * newBounds.height;
        var boundsBottom = newBounds.y + newBounds.height;
        var contentBottom = this._contentBounds.y + this._contentBounds.height;
        var topDy = this._contentBounds.y - boundsBottom + verticalThreshold;
        var bottomDy = contentBottom - newBounds.y - verticalThreshold;

        if (verticalThreshold > this._contentBounds.height) {
            newBounds.y += (topDy + bottomDy) / 2;
        } else if (bottomDy < 0) {
            newBounds.y += bottomDy;
        } else if (topDy > 0) {
            newBounds.y += topDy;
        }

        return newBounds;
    },
    applyConstraints: function(immediately) {
        var actualZoom = this.getZoom();
        var constrainedZoom = this._applyZoomConstraints(actualZoom);

        if (actualZoom !== constrainedZoom) {
            this.zoomTo(constrainedZoom, this.zoomPoint, immediately);
        }
        var bounds = this.getBounds();
        var constrainedBounds = this._applyBoundaryConstraints(bounds);

        if (bounds.x !== constrainedBounds.x ||
            bounds.y !== constrainedBounds.y ||
            immediately) {
            this.fitBounds(constrainedBounds, immediately);
        }
        return this;
    },
    _fitBounds: function(bounds, options) {
        options = options || {};
        var immediately = options.immediately || false;
        var constraints = options.constraints || false;

        var aspect = this.getAspectRatio();
        var center = bounds.getCenter();

        // Compute width and height of bounding box.
        var newBounds = new $.Rect(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height)
            .getBoundingBox();

        if (newBounds.getAspectRatio() >= aspect) {
            newBounds.height = newBounds.width / aspect;
        } else {
            newBounds.width = newBounds.height * aspect;
        }
        // Compute x and y from width, height and center position
        newBounds.x = center.x - newBounds.width / 2;
        newBounds.y = center.y - newBounds.height / 2;
        var newZoom = 1.0 / newBounds.width;

        if (constraints) {
            var newBoundsAspectRatio = newBounds.getAspectRatio();
            var newConstrainedZoom = this._applyZoomConstraints(newZoom);

            if (newZoom !== newConstrainedZoom) {
                newZoom = newConstrainedZoom;
                newBounds.width = 1.0 / newZoom;
                newBounds.x = center.x - newBounds.width / 2;
                newBounds.height = newBounds.width / newBoundsAspectRatio;
                newBounds.y = center.y - newBounds.height / 2;
            }
            newBounds = this._applyBoundaryConstraints(newBounds);
            center = newBounds.getCenter();
        }
        if (immediately) {
            this.panTo(center, true);
            return this.zoomTo(newZoom, null, true);
        }
        this.panTo(this.getCenter(true), true);
        this.zoomTo(this.getZoom(true), null, true);

        var oldBounds = this.getBounds();
        var oldZoom = this.getZoom();

        if (oldZoom === 0 || Math.abs(newZoom / oldZoom - 1) < 0.00000001) {
            this.zoomTo(newZoom, true);
            return this.panTo(center, immediately);
        }
        var referencePoint = newBounds.getTopLeft().times(newZoom)
            .minus(oldBounds.getTopLeft().times(oldZoom))
            .divide(newZoom - oldZoom);

        return this.zoomTo(newZoom, referencePoint, immediately);
    },
    fitBounds: function(bounds, immediately) {
        return this._fitBounds(bounds, {
            immediately: immediately,
            constraints: false
        });
    },
    panTo: function( center, immediately ) {
        if ( immediately ) {
            this.centerSpringX.resetTo( center.x );
            this.centerSpringY.resetTo( center.y );
        } else {
            this.centerSpringX.springTo( center.x );
            this.centerSpringY.springTo( center.y );
        }
        return this;
    },
    zoomBy: function(factor, refPoint, immediately) {
        return this.zoomTo(
            this.zoomSpring.target.value * factor, refPoint, immediately);
    },
    zoomTo: function(zoom, refPoint, immediately) {
        var _this = this;

        this.zoomPoint = refPoint instanceof $.Point &&
            !isNaN(refPoint.x) &&
            !isNaN(refPoint.y) ?
            refPoint :
            null;

        if (immediately) {
            this._adjustCenterSpringsForZoomPoint(function() {
                _this.zoomSpring.resetTo(zoom);
            });
        } else {
            this.zoomSpring.springTo(zoom);
        }
        return this;
    },
    resize: function( newContainerSize, maintain ) {
        var oldBounds = this.getBounds(),
            newBounds = oldBounds,
            widthDeltaFactor;

        this.containerSize.x = newContainerSize.x;
        this.containerSize.y = newContainerSize.y;

        this._updateContainerInnerSize();

        if ( maintain ) {
            // TODO: widthDeltaFactor will always be 1; probably not what's intended
            widthDeltaFactor = newContainerSize.x / this.containerSize.x;
            newBounds.width = oldBounds.width * widthDeltaFactor;
            newBounds.height = newBounds.width / this.getAspectRatio();
        }
        return this.fitBounds( newBounds, true );
    },
    // private
    _updateContainerInnerSize: function() {
        this._containerInnerSize = new $.Point(
            Math.max(1, this.containerSize.x),
            Math.max(1, this.containerSize.y)
        );
    },
    update: function() {
        var _this = this;
        this._adjustCenterSpringsForZoomPoint(function() {
            _this.zoomSpring.update();
        });
        this.centerSpringX.update();
        this.centerSpringY.update();

        var changed = this.centerSpringX.current.value !== this._oldCenterX ||
            this.centerSpringY.current.value !== this._oldCenterY ||
            this.zoomSpring.current.value !== this._oldZoom;

        this._oldCenterX = this.centerSpringX.current.value;
        this._oldCenterY = this.centerSpringY.current.value;
        this._oldZoom = this.zoomSpring.current.value;

        return changed;
    },
    _adjustCenterSpringsForZoomPoint: function(zoomSpringHandler) {
        if (this.zoomPoint) {
            var oldZoomPixel = this.pixelFromPoint(this.zoomPoint, true);
            zoomSpringHandler();
            var newZoomPixel = this.pixelFromPoint(this.zoomPoint, true);

            var deltaZoomPixels = newZoomPixel.minus(oldZoomPixel);
            var deltaZoomPoints = this.deltaPointsFromPixels(
                deltaZoomPixels, true);

            this.centerSpringX.shiftBy(deltaZoomPoints.x);
            this.centerSpringY.shiftBy(deltaZoomPoints.y);

            if (this.zoomSpring.isAtTargetValue()) {
                this.zoomPoint = null;
            }
        } else {
            zoomSpringHandler();
        }
    },
    deltaPixelsFromPoints: function(deltaPoints, current) {
        return deltaPoints.times(
            this._containerInnerSize.x * this.getZoom(current)
        );
    },
    deltaPointsFromPixels: function(deltaPixels, current) {
        return deltaPixels.divide(
            this._containerInnerSize.x * this.getZoom(current)
        );
    },
    pixelFromPoint: function(point, current) {
        return this._pixelFromPoint(point, this.getBounds(current));
    },
    // private
    _pixelFromPoint: function(point, bounds) {
        return point.minus(
            bounds.getTopLeft()
        ).times(
            this._containerInnerSize.x / bounds.width
        );
    },
    viewportToViewerElementRectangle: function(rectangle) {
        return $.Rect.fromSummits(
            this.pixelFromPoint(rectangle.getTopLeft(), true),
            this.pixelFromPoint(rectangle.getTopRight(), true),
            this.pixelFromPoint(rectangle.getBottomLeft(), true)
        );
    },
    riewportToViewerElementRectangle: function(rectangle) {
        return $.Rect.fromSummits(
            this.pixelFromPoint(rectangle.getTopLeft(), true),
            this.pixelFromPoint(rectangle.getTopRight(), true),
            this.pixelFromPoint(rectangle.getBottomLeft(), true)
        );
    }
};
}( OpenSeadragon ));
