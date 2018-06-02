

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
    this._margins = $.extend({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
    }, options.margins || {});
    delete options.margins;

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
        wrapHorizontal: $.DEFAULT_SETTINGS.wrapHorizontal,
        wrapVertical: $.DEFAULT_SETTINGS.wrapVertical,
        defaultZoomLevel: $.DEFAULT_SETTINGS.defaultZoomLevel,
        minZoomLevel: $.DEFAULT_SETTINGS.minZoomLevel,
        maxZoomLevel: $.DEFAULT_SETTINGS.maxZoomLevel,
        homeFillsViewer: $.DEFAULT_SETTINGS.homeFillsViewer

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
        exponential: true,
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
    resetContentSize: function(contentSize) {

        this._setContentBounds(new $.Rect(0, 0, 1, contentSize.y / contentSize.x), contentSize.x);
        return this;
    },
    // deprecated
    setHomeBounds: function(bounds, contentFactor) {
        this._setContentBounds(bounds, contentFactor);
    },
    // Set the viewport's content bounds
    // @param {OpenSeadragon.Rect} bounds - the new bounds in viewport coordinates
    // without rotation
    // @param {Number} contentFactor - how many content units per viewport unit
    // @fires OpenSeadragon.Viewer.event:reset-size
    // @private
    _setContentBounds: function(bounds, contentFactor) {

        this._contentBounds = bounds.clone();
        this._contentSize = this._contentBounds.getSize().times(
            contentFactor);

        this._contentBounds = bounds.getBoundingBox();
        this._contentSize = this._contentBounds.getSize().times(contentFactor);
        this._contentAspectRatio = this._contentSize.x / this._contentSize.y;

        if (this.viewer) {
            this.viewer.raiseEvent('reset-size', {
                contentSize: this._contentSize.clone(),
                contentFactor: contentFactor,
                homeBounds: this._contentBounds.clone(),
                contentBounds: this._contentBounds.clone()
            });
        }
    },
    getHomeZoom: function() {
        if (this.defaultZoomLevel) {
            return this.defaultZoomLevel;
        }
        var aspectFactor = this._contentAspectRatio / this.getAspectRatio();
        var output;
        if (this.homeFillsViewer) { // fill the viewer and clip the image
            output = aspectFactor >= 1 ? aspectFactor : 1;
        } else {
            output = aspectFactor >= 1 ? 1 : aspectFactor;
        }
        return output / this._contentBounds.width;
    },
    getHomeBounds: function() {
        return this.getHomeBounds();
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
        if (this.viewer) {
            this.viewer.raiseEvent('home', {
                immediately: immediately
            });
        }
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
    getMargins: function() {
        return $.extend({}, this._margins); // Make a copy so we are not returning our original
    },
    setMargins: function(margins) {

        this._margins = $.extend({
            left: 0,
            top: 0,
            right: 0,
            bottom: 0
        }, margins);
        this._updateContainerInnerSize();
        if (this.viewer) {
            this.viewer.forceRedraw();
        }
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
        var factor = this._containerInnerSize.x * this.getZoom(current);
        bounds.x -= this._margins.left / factor;
        bounds.y -= this._margins.top / factor;
        bounds.width += (this._margins.left + this._margins.right) / factor;
        bounds.height += (this._margins.top + this._margins.bottom) / factor;
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

        if (this.wrapHorizontal) {
            //do nothing
        } else {
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
        }
        if (this.wrapVertical) {
            //do nothing
        } else {
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
        }
        return newBounds;
    },
    _raiseConstraintsEvent: function(immediately) {
        if (this.viewer) {
            this.viewer.raiseEvent( 'constrain', {
                immediately: immediately
            });
        }
    },
    applyConstraints: function(immediately) {
        var actualZoom = this.getZoom();
        var constrainedZoom = this._applyZoomConstraints(actualZoom);

        if (actualZoom !== constrainedZoom) {
            this.zoomTo(constrainedZoom, this.zoomPoint, immediately);
        }
        var bounds = this.getBounds();
        var constrainedBounds = this._applyBoundaryConstraints(bounds);
        this._raiseConstraintsEvent(immediately);

        if (bounds.x !== constrainedBounds.x ||
            bounds.y !== constrainedBounds.y ||
            immediately) {
            this.fitBounds(constrainedBounds, immediately);
        }
        return this;
    },
    ensureVisible: function(immediately) {
        return this.applyConstraints(immediately);
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
            this._raiseConstraintsEvent(immediately);
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
    fitBoundsWithConstraints: function(bounds, immediately) {
        return this._fitBounds(bounds, {
            immediately: immediately,
            constraints: true
        });
    },
    fitVertically: function(immediately) {
        var box = new $.Rect(
            this._contentBounds.x + (this._contentBounds.width / 2),
            this._contentBounds.y,
            0,
            this._contentBounds.height);
        return this.fitBounds(box, immediately);
    },
    fitHorizontally: function(immediately) {
        var box = new $.Rect(
            this._contentBounds.x,
            this._contentBounds.y + (this._contentBounds.height / 2),
            this._contentBounds.width,
            0);
        return this.fitBounds(box, immediately);
    },
    getConstrainedBounds: function(current) {
        var bounds,
            constrainedBounds;

        bounds = this.getBounds(current);

        constrainedBounds = this._applyBoundaryConstraints(bounds);

        return constrainedBounds;
    },
    panBy: function( delta, immediately ) {
        var center = new $.Point(
            this.centerSpringX.target.value,
            this.centerSpringY.target.value
        );
        return this.panTo( center.plus( delta ), immediately );
    },
    panTo: function( center, immediately ) {
        if ( immediately ) {
            this.centerSpringX.resetTo( center.x );
            this.centerSpringY.resetTo( center.y );
        } else {
            this.centerSpringX.springTo( center.x );
            this.centerSpringY.springTo( center.y );
        }
        if( this.viewer ){
            this.viewer.raiseEvent( 'pan', {
                center: center,
                immediately: immediately
            });
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
        if (this.viewer) {
            this.viewer.raiseEvent('zoom', {
                zoom: zoom,
                refPoint: refPoint,
                immediately: immediately
            });
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
        if( this.viewer ){
            this.viewer.raiseEvent( 'resize', {
                newContainerSize: newContainerSize,
                maintain: maintain
            });
        }
        return this.fitBounds( newBounds, true );
    },
    // private
    _updateContainerInnerSize: function() {
        this._containerInnerSize = new $.Point(
            Math.max(1, this.containerSize.x - (this._margins.left + this._margins.right)),
            Math.max(1, this.containerSize.y - (this._margins.top + this._margins.bottom))
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
        ).plus(
            new $.Point(this._margins.left, this._margins.top)
        );
    },
    pointFromPixel: function(pixel, current) {
        var bounds = this.getBounds(current);
        return pixel.minus(
            new $.Point(this._margins.left, this._margins.top)
        ).divide(
            this._containerInnerSize.x / bounds.width
        ).plus(
            bounds.getTopLeft()
        );
    },
    // private
    _viewportToImageDelta: function( viewerX, viewerY ) {
        var scale = this._contentBounds.width;
        return new $.Point(
            viewerX * this._contentSize.x / scale,
            viewerY * this._contentSize.x / scale);
    },
    viewportToImageCoordinates: function(viewerX, viewerY) {
        if (viewerX instanceof $.Point) {
            //they passed a point instead of individual components
            return this.viewportToImageCoordinates(viewerX.x, viewerX.y);
        }
        if (this.viewer) {
            var item = this.viewer.world.getItemAt(0);
            return item.viewportToImageCoordinates(viewerX, viewerY, true);
        }
        return this._viewportToImageDelta(
            viewerX - this._contentBounds.x,
            viewerY - this._contentBounds.y);
    },
    // private
    _imageToViewportDelta: function( imageX, imageY ) {
        var scale = this._contentBounds.width;
        return new $.Point(
            imageX / this._contentSize.x * scale,
            imageY / this._contentSize.x * scale);
    },
    imageToViewportCoordinates: function(imageX, imageY) {
        if (imageX instanceof $.Point) {
            //they passed a point instead of individual components
            return this.imageToViewportCoordinates(imageX.x, imageX.y);
        }
        if (this.viewer) {
            var item = this.viewer.world.getItemAt(0);
            return item.imageToViewportCoordinates(imageX, imageY, true);
        }
        var point = this._imageToViewportDelta(imageX, imageY);
        point.x += this._contentBounds.x;
        point.y += this._contentBounds.y;
        return point;
    },
    imageToViewportRectangle: function(imageX, imageY, pixelWidth, pixelHeight) {
        var rect = imageX;
        if (!(rect instanceof $.Rect)) {
            //they passed individual components instead of a rectangle
            rect = new $.Rect(imageX, imageY, pixelWidth, pixelHeight);
        }
        if (this.viewer) {
            var item = this.viewer.world.getItemAt(0);
            return item.imageToViewportRectangle(
                imageX, imageY, pixelWidth, pixelHeight, true);
        }
        var coordA = this.imageToViewportCoordinates(rect.x, rect.y);
        var coordB = this._imageToViewportDelta(rect.width, rect.height);
        return new $.Rect(
            coordA.x,
            coordA.y,
            coordB.x,
            coordB.y,
        );
    },
    viewportToImageRectangle: function(viewerX, viewerY, pointWidth, pointHeight) {
        var rect = viewerX;
        if (!(rect instanceof $.Rect)) {
            //they passed individual components instead of a rectangle
            rect = new $.Rect(viewerX, viewerY, pointWidth, pointHeight);
        }
        if (this.viewer) {
            var item = this.viewer.world.getItemAt(0);
            return item.viewportToImageRectangle(
                viewerX, viewerY, pointWidth, pointHeight, true);
        }
        var coordA = this.viewportToImageCoordinates(rect.x, rect.y);
        var coordB = this._viewportToImageDelta(rect.width, rect.height);
        return new $.Rect(
            coordA.x,
            coordA.y,
            coordB.x,
            coordB.y,
        );
    },
    viewerElementToImageCoordinates: function( pixel ) {
        var point = this.pointFromPixel( pixel, true );
        return this.viewportToImageCoordinates( point );
    },
    imageToViewerElementCoordinates: function( pixel ) {
        var point = this.imageToViewportCoordinates( pixel );
        return this.pixelFromPoint( point, true );
    },
    windowToImageCoordinates: function(pixel) {
        var viewerCoordinates = pixel.minus(
                $.getElementPosition(this.viewer.element));
        return this.viewerElementToImageCoordinates(viewerCoordinates);
    },
    imageToWindowCoordinates: function(pixel) {
        var viewerCoordinates = this.imageToViewerElementCoordinates(pixel);
        return viewerCoordinates.plus(
                $.getElementPosition(this.viewer.element));
    },
    viewerElementToViewportCoordinates: function( pixel ) {
        return this.pointFromPixel( pixel, true );
    },
    viewportToViewerElementCoordinates: function( point ) {
        return this.pixelFromPoint( point, true );
    },
    viewerElementToViewportRectangle: function(rectangle) {
        return $.Rect.fromSummits(
            this.pointFromPixel(rectangle.getTopLeft(), true),
            this.pointFromPixel(rectangle.getTopRight(), true),
            this.pointFromPixel(rectangle.getBottomLeft(), true)
        );
    },
    viewportToViewerElementRectangle: function(rectangle) {
        return $.Rect.fromSummits(
            this.pixelFromPoint(rectangle.getTopLeft(), true),
            this.pixelFromPoint(rectangle.getTopRight(), true),
            this.pixelFromPoint(rectangle.getBottomLeft(), true)
        );
    },
    windowToViewportCoordinates: function(pixel) {
        var viewerCoordinates = pixel.minus(
                $.getElementPosition(this.viewer.element));
        return this.viewerElementToViewportCoordinates(viewerCoordinates);
    },
    viewportToWindowCoordinates: function(point) {
        var viewerCoordinates = this.viewportToViewerElementCoordinates(point);
        return viewerCoordinates.plus(
                $.getElementPosition(this.viewer.element));
    },
    viewportToImageZoom: function(viewportZoom) {
        if (this.viewer) {
            var item = this.viewer.world.getItemAt(0);
            return item.viewportToImageZoom(viewportZoom);
        }
        var imageWidth = this._contentSize.x;
        var containerWidth = this._containerInnerSize.x;
        var scale = this._contentBounds.width;
        var viewportToImageZoomRatio = (containerWidth / imageWidth) * scale;
        return viewportZoom * viewportToImageZoomRatio;
    },
    imageToViewportZoom: function(imageZoom) {
        if (this.viewer) {
            var item = this.viewer.world.getItemAt(0);
            return item.imageToViewportZoom(imageZoom);
        }
        var imageWidth = this._contentSize.x;
        var containerWidth = this._containerInnerSize.x;
        var scale = this._contentBounds.width;
        var viewportToImageZoomRatio = (imageWidth / containerWidth) / scale;
        return imageZoom * viewportToImageZoomRatio;
    }
};
}( OpenSeadragon ));
