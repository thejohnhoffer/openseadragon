

(function( $ ){
$.TiledImage = function( options ) {
    var _this = this;


    $.EventSource.call( this );

    this._tileCache = options.tileCache;
    delete options.tileCache;

    this._drawer = options.drawer;
    delete options.drawer;

    this._imageLoader = options.imageLoader;
    delete options.imageLoader;

    if (options.clip instanceof $.Rect) {
        this._clip = options.clip.clone();
    }
    delete options.clip;

    var x = options.x || 0;
    delete options.x;
    var y = options.y || 0;
    delete options.y;

    // Ratio of zoomable image height to width.
    this.normHeight = options.source.dimensions.y / options.source.dimensions.x;
    this.contentAspectX = options.source.dimensions.x / options.source.dimensions.y;

    var scale = 1;
    if ( options.width ) {
        scale = options.width;
        delete options.width;

        if ( options.height ) {
            delete options.height;
        }
    } else if ( options.height ) {
        scale = options.height / this.normHeight;
        delete options.height;
    }


    $.extend( true, this, {
        //internal state properties
        viewer: null,
        tilesMatrix: {}, // A '3d' dictionary [level][x][y] --> Tile.
        coverage: {}, // A '3d' dictionary [level][x][y] --> Boolean; shows what areas have been drawn.
        loadingCoverage: {}, // A '3d' dictionary [level][x][y] --> Boolean; shows what areas are loaded or are being loaded/blended.
        lastDrawn: [], // An unordered list of Tiles drawn last frame.
        lastResetTime: 0, // Last time for which the tiledImage was reset.
        _midDraw: false, // Is the tiledImage currently updating the viewport?
        _needsDraw: true, // Does the tiledImage need to update the viewport again?
        _hasOpaqueTile: false, // Do we have even one fully opaque tile?
        _tilesLoading: 0, // The number of pending tile requests.
        //configurable settings
        springStiffness: $.DEFAULT_SETTINGS.springStiffness,
        animationTime: $.DEFAULT_SETTINGS.animationTime,
        minZoomImageRatio: $.DEFAULT_SETTINGS.minZoomImageRatio,
        wrapHorizontal: $.DEFAULT_SETTINGS.wrapHorizontal,
        wrapVertical: $.DEFAULT_SETTINGS.wrapVertical,
        immediateRender: $.DEFAULT_SETTINGS.immediateRender,
        blendTime: $.DEFAULT_SETTINGS.blendTime,
        alwaysBlend: $.DEFAULT_SETTINGS.alwaysBlend,
        minPixelRatio: $.DEFAULT_SETTINGS.minPixelRatio,
        smoothTileEdgesMinZoom: $.DEFAULT_SETTINGS.smoothTileEdgesMinZoom,
        iOSDevice: $.DEFAULT_SETTINGS.iOSDevice,
        crossOriginPolicy: $.DEFAULT_SETTINGS.crossOriginPolicy,
        ajaxWithCredentials: $.DEFAULT_SETTINGS.ajaxWithCredentials,
    }, options );

    this._fullyLoaded = false;

    this._xSpring = new $.Spring({
        initial: x,
        springStiffness: this.springStiffness,
        animationTime: this.animationTime
    });
    this._ySpring = new $.Spring({
        initial: y,
        springStiffness: this.springStiffness,
        animationTime: this.animationTime
    });
    this._scaleSpring = new $.Spring({
        initial: scale,
        springStiffness: this.springStiffness,
        animationTime: this.animationTime
    });
    this._updateForScale();

    // We need a callback to give image manipulation a chance to happen
    this._drawingHandler = function(args) {
        _this.viewer.raiseEvent('tile-drawing', $.extend({
            tiledImage: _this
        }, args));
    };
};
$.extend($.TiledImage.prototype, $.EventSource.prototype, {
    needsDraw: function() {
        return this._needsDraw;
    },
    getFullyLoaded: function() {
        return this._fullyLoaded;
    },
    // private
    _setFullyLoaded: function(flag) {
        if (flag === this._fullyLoaded) {
            return;
        }
        this._fullyLoaded = flag;
        this.raiseEvent('fully-loaded-change', {
            fullyLoaded: this._fullyLoaded
        });
    },
    reset: function() {
        this._tileCache.clearTilesFor(this);
        this.lastResetTime = $.now();
        this._needsDraw = true;
    },
    update: function() {
        var xUpdated = this._xSpring.update();
        var yUpdated = this._ySpring.update();
        var scaleUpdated = this._scaleSpring.update();

        if (xUpdated || yUpdated || scaleUpdated) {
            this._updateForScale();
            this._needsDraw = true;
            return true;
        }
        return false;
    },
    draw: function() {
        this._midDraw = true;
        this._updateViewport();
        this._midDraw = false;
    },
    destroy: function() {
        this.reset();
    },
    getBounds: function(current) {
        return current ?
            new $.Rect(
                this._xSpring.current.value,
                this._ySpring.current.value,
                this._worldWidthCurrent,
                this._worldHeightCurrent) :
            new $.Rect(
                this._xSpring.target.value,
                this._ySpring.target.value,
                this._worldWidthTarget,
                this._worldHeightTarget);
    },
    // deprecated
    getWorldBounds: function() {
        return this.getBounds();
    },
    getClippedBounds: function(current) {
        var bounds = this.getBounds(current);
        if (this._clip) {
            var worldWidth = current ?
                this._worldWidthCurrent : this._worldWidthTarget;
            var ratio = worldWidth / this.source.dimensions.x;
            var clip = this._clip.times(ratio);
            bounds = new $.Rect(
                bounds.x + clip.x,
                bounds.y + clip.y,
                clip.width,
                clip.height);
        }
        return bounds;
    },
    getContentSize: function() {
        return new $.Point(this.source.dimensions.x, this.source.dimensions.y);
    },
    // private
    _viewportToImageDelta: function( viewerX, viewerY, current ) {
        var scale = (current ? this._scaleSpring.current.value : this._scaleSpring.target.value);
        return new $.Point(viewerX * (this.source.dimensions.x / scale),
            viewerY * ((this.source.dimensions.y * this.contentAspectX) / scale));
    },
    viewportToImageCoordinates: function(viewerX, viewerY, current) {
        var point;
        if (viewerX instanceof $.Point) {
            //they passed a point instead of individual components
            current = viewerY;
            point = viewerX;
        } else {
            point = new $.Point(viewerX, viewerY);
        }
        return current ?
            this._viewportToImageDelta(
                point.x - this._xSpring.current.value,
                point.y - this._ySpring.current.value) :
            this._viewportToImageDelta(
                point.x - this._xSpring.target.value,
                point.y - this._ySpring.target.value);
    },
    // private
    _imageToViewportDelta: function( imageX, imageY, current ) {
        var scale = (current ? this._scaleSpring.current.value : this._scaleSpring.target.value);
        return new $.Point((imageX / this.source.dimensions.x) * scale,
            (imageY / this.source.dimensions.y / this.contentAspectX) * scale);
    },
    imageToViewportCoordinates: function(imageX, imageY, current) {
        if (imageX instanceof $.Point) {
            //they passed a point instead of individual components
            current = imageY;
            imageY = imageX.y;
            imageX = imageX.x;
        }
        var point = this._imageToViewportDelta(imageX, imageY);
        if (current) {
            point.x += this._xSpring.current.value;
            point.y += this._ySpring.current.value;
        } else {
            point.x += this._xSpring.target.value;
            point.y += this._ySpring.target.value;
        }
        return point;
    },
    imageToViewportRectangle: function(imageX, imageY, pixelWidth, pixelHeight, current) {
        var rect = imageX;
        if (rect instanceof $.Rect) {
            //they passed a rect instead of individual components
            current = imageY;
        } else {
            rect = new $.Rect(imageX, imageY, pixelWidth, pixelHeight);
        }
        var coordA = this.imageToViewportCoordinates(rect.getTopLeft(), current);
        var coordB = this._imageToViewportDelta(rect.width, rect.height, current);

        return new $.Rect(
            coordA.x,
            coordA.y,
            coordB.x,
            coordB.y,
        );
    },
    viewportToImageRectangle: function( viewerX, viewerY, pointWidth, pointHeight, current ) {
        var rect = viewerX;
        if (viewerX instanceof $.Rect) {
            //they passed a rect instead of individual components
            current = viewerY;
        } else {
            rect = new $.Rect(viewerX, viewerY, pointWidth, pointHeight);
        }
        var coordA = this.viewportToImageCoordinates(rect.getTopLeft(), current);
        var coordB = this._viewportToImageDelta(rect.width, rect.height, current);

        return new $.Rect(
            coordA.x,
            coordA.y,
            coordB.x,
            coordB.y,
        );
    },
    viewerElementToImageCoordinates: function( pixel ) {
        var point = this.viewport.pointFromPixel( pixel, true );
        return this.viewportToImageCoordinates( point );
    },
    imageToViewerElementCoordinates: function( pixel ) {
        var point = this.imageToViewportCoordinates( pixel );
        return this.viewport.pixelFromPoint( point, true );
    },
    windowToImageCoordinates: function( pixel ) {
        var viewerCoordinates = pixel.minus(
                OpenSeadragon.getElementPosition( this.viewer.element ));
        return this.viewerElementToImageCoordinates( viewerCoordinates );
    },
    imageToWindowCoordinates: function( pixel ) {
        var viewerCoordinates = this.imageToViewerElementCoordinates( pixel );
        return viewerCoordinates.plus(
                OpenSeadragon.getElementPosition( this.viewer.element ));
    },
    // private
    // Convert rectangle in viewport coordinates to this tiled image point
    // coordinates (x in [0, 1] and y in [0, aspectRatio])
    _viewportToTiledImageRectangle: function(rect) {
        var scale = this._scaleSpring.current.value;
        return new $.Rect(
            (rect.x - this._xSpring.current.value) / scale,
            (rect.y - this._ySpring.current.value) / scale,
            rect.width / scale,
            rect.height / scale);
    },
    viewportToImageZoom: function( viewportZoom ) {
        var ratio = this._scaleSpring.current.value *
                this.viewport._containerInnerSize.x / this.source.dimensions.x;
        return ratio * viewportZoom;
    },
    imageToViewportZoom: function( imageZoom ) {
        var ratio = this._scaleSpring.current.value *
                this.viewport._containerInnerSize.x / this.source.dimensions.x;
        return imageZoom / ratio;
    },
    setPosition: function(position, immediately) {
        var sameTarget = (this._xSpring.target.value === position.x &&
            this._ySpring.target.value === position.y);

        if (immediately) {
            if (sameTarget && this._xSpring.current.value === position.x &&
                    this._ySpring.current.value === position.y) {
                return;
            }
            this._xSpring.resetTo(position.x);
            this._ySpring.resetTo(position.y);
            this._needsDraw = true;
        } else {
            if (sameTarget) {
                return;
            }
            this._xSpring.springTo(position.x);
            this._ySpring.springTo(position.y);
            this._needsDraw = true;
        }
        if (!sameTarget) {
            this._raiseBoundsChange();
        }
    },
    setWidth: function(width, immediately) {
        this._setScale(width, immediately);
    },
    setHeight: function(height, immediately) {
        this._setScale(height / this.normHeight, immediately);
    },
    fitBounds: function(bounds, anchor, immediately) {
        var aspectRatio = this.contentAspectX;
        var xOffset = 0;
        var yOffset = 0;
        var displayedWidthRatio = 1;
        var displayedHeightRatio = 1;
        if (this._clip) {
            aspectRatio = this._clip.getAspectRatio();
            displayedWidthRatio = this._clip.width / this.source.dimensions.x;
            displayedHeightRatio = this._clip.height / this.source.dimensions.y;
            if (bounds.getAspectRatio() > aspectRatio) {
                xOffset = this._clip.x / this._clip.height * bounds.height;
                yOffset = this._clip.y / this._clip.height * bounds.height;
            } else {
                xOffset = this._clip.x / this._clip.width * bounds.width;
                yOffset = this._clip.y / this._clip.width * bounds.width;
            }
        }
        if (bounds.getAspectRatio() > aspectRatio) {
            // We will have margins on the X axis
            var height = bounds.height / displayedHeightRatio;
            var marginLeft = 0;
            this.setPosition(
                new $.Point(bounds.x - xOffset + marginLeft, bounds.y - yOffset),
                immediately);
            this.setHeight(height, immediately);
        } else {
            // We will have margins on the Y axis
            var width = bounds.width / displayedWidthRatio;
            var marginTop = 0;
            this.setPosition(
                new $.Point(bounds.x - xOffset, bounds.y - yOffset + marginTop),
                immediately);
            this.setWidth(width, immediately);
        }
    },
    getClip: function() {
        if (this._clip) {
            return this._clip.clone();
        }
        return null;
    },
    setClip: function(newClip) {

        if (newClip instanceof $.Rect) {
            this._clip = newClip.clone();
        } else {
            this._clip = null;
        }
        this._needsDraw = true;

        this.raiseEvent('clip-change');
    },
    // private
    _setScale: function(scale, immediately) {
        var sameTarget = (this._scaleSpring.target.value === scale);
        if (immediately) {
            if (sameTarget && this._scaleSpring.current.value === scale) {
                return;
            }
            this._scaleSpring.resetTo(scale);
            this._updateForScale();
            this._needsDraw = true;
        } else {
            if (sameTarget) {
                return;
            }
            this._scaleSpring.springTo(scale);
            this._updateForScale();
            this._needsDraw = true;
        }
        if (!sameTarget) {
            this._raiseBoundsChange();
        }
    },
    // private
    _updateForScale: function() {
        this._worldWidthTarget = this._scaleSpring.target.value;
        this._worldHeightTarget = this.normHeight * this._scaleSpring.target.value;
        this._worldWidthCurrent = this._scaleSpring.current.value;
        this._worldHeightCurrent = this.normHeight * this._scaleSpring.current.value;
    },
    // private
    _raiseBoundsChange: function() {
        this.raiseEvent('bounds-change');
    },
    // private
    _isBottomItem: function() {
        return this.viewer.world.getItemAt(0) === this;
    },
    // private
    _getLevelsInterval: function() {
        var lowestLevel = Math.max(
            this.source.minLevel,
            Math.floor(Math.log(this.minZoomImageRatio) / Math.log(2))
        );
        var currentZeroRatio = this.viewport.deltaPixelsFromPoints(
            this.source.getPixelRatio(0), true).x *
            this._scaleSpring.current.value;
        var highestLevel = Math.min(
            Math.abs(this.source.maxLevel),
            Math.abs(Math.floor(
                Math.log(currentZeroRatio / this.minPixelRatio) / Math.log(2)
            ))
        );

        // Calculations for the interval of levels to draw
        // can return invalid intervals; fix that here if necessary
        lowestLevel = Math.min(lowestLevel, highestLevel);
        return {
            lowestLevel: lowestLevel,
            highestLevel: highestLevel
        };
    },
    _updateViewport: function() {
        this._needsDraw = false;
        this._tilesLoading = 0;
        this.loadingCoverage = {};
        // Reset tile's internal drawn state
        while (this.lastDrawn.length > 0) {
            var tile = this.lastDrawn.pop();
            tile.beingDrawn = false;
        }
        var viewport = this.viewport;
        var drawArea = this._viewportToTiledImageRectangle(
            viewport.getBoundsWithMargins(true));

        if (!this.wrapHorizontal && !this.wrapVertical) {
            var tiledImageBounds = this._viewportToTiledImageRectangle(
                this.getClippedBounds(true));
            drawArea = drawArea.intersection(tiledImageBounds);
            if (drawArea === null) {
                return;
            }
        }
        var levelsInterval = this._getLevelsInterval();
        var lowestLevel = levelsInterval.lowestLevel;
        var highestLevel = levelsInterval.highestLevel;
        var bestTile = null;
        var haveDrawn = false;
        var currentTime = $.now();

        // Update any level that will be drawn
        for (var level = highestLevel; level >= lowestLevel; level--) {
            var drawLevel = false;

            //Avoid calculations for draw if we have already drawn this
            var currentRenderPixelRatio = viewport.deltaPixelsFromPoints(
                this.source.getPixelRatio(level),
                true
            ).x * this._scaleSpring.current.value;

            if (level === lowestLevel ||
                (!haveDrawn && currentRenderPixelRatio >= this.minPixelRatio)) {
                drawLevel = true;
                haveDrawn = true;
            } else if (!haveDrawn) {
                continue;
            }
            //Perform calculations for draw if we haven't drawn this
            var targetRenderPixelRatio = viewport.deltaPixelsFromPoints(
                this.source.getPixelRatio(level),
                false
            ).x * this._scaleSpring.current.value;

            var targetZeroRatio = viewport.deltaPixelsFromPoints(
                this.source.getPixelRatio(
                    Math.max(
                        this.source.getClosestLevel(),
                        0
                    )
                ),
                false
            ).x * this._scaleSpring.current.value;

            var optimalRatio = this.immediateRender ? 1 : targetZeroRatio;
            var levelVisibility = optimalRatio / Math.abs(
                optimalRatio - targetRenderPixelRatio
            );

            // Update the level and keep track of 'best' tile to load
            bestTile = updateLevel(
                this,
                haveDrawn,
                drawLevel,
                level,
                levelVisibility,
                drawArea,
                currentTime,
                bestTile
            );

            // Stop the loop if lower-res tiles would all be covered by
            // already drawn tiles
            if (providesCoverage(this.coverage, level)) {
                break;
            }
        }
        // Perform the actual drawing
        drawTiles(this, this.lastDrawn);

        // Load the new 'best' tile
        if (bestTile && !bestTile.context2D) {
            loadTile(this, bestTile, currentTime);
            this._needsDraw = true;
            this._setFullyLoaded(false);
        } else {
            this._setFullyLoaded(this._tilesLoading === 0);
        }
    },
    // private
    _getCornerTiles: function(level, topLeftBound, bottomRightBound) {
        var leftX;
        var rightX;
        if (this.wrapHorizontal) {
            leftX = $.positiveModulo(topLeftBound.x, 1);
            rightX = $.positiveModulo(bottomRightBound.x, 1);
        } else {
            leftX = Math.max(0, topLeftBound.x);
            rightX = Math.min(1, bottomRightBound.x);
        }
        var topY;
        var bottomY;
        var aspectRatio = 1 / this.source.aspectRatio;
        if (this.wrapVertical) {
            topY = $.positiveModulo(topLeftBound.y, aspectRatio);
            bottomY = $.positiveModulo(bottomRightBound.y, aspectRatio);
        } else {
            topY = Math.max(0, topLeftBound.y);
            bottomY = Math.min(aspectRatio, bottomRightBound.y);
        }
        var topLeftTile = this.source.getTileAtPoint(level, new $.Point(leftX, topY));
        var bottomRightTile = this.source.getTileAtPoint(level, new $.Point(rightX, bottomY));
        var numTiles = this.source.getNumTiles(level);

        if (this.wrapHorizontal) {
            topLeftTile.x += numTiles.x * Math.floor(topLeftBound.x);
            bottomRightTile.x += numTiles.x * Math.floor(bottomRightBound.x);
        }
        if (this.wrapVertical) {
            topLeftTile.y += numTiles.y * Math.floor(topLeftBound.y / aspectRatio);
            bottomRightTile.y += numTiles.y * Math.floor(bottomRightBound.y / aspectRatio);
        }
        return {
            topLeft: topLeftTile,
            bottomRight: bottomRightTile,
        };
    }
});
function updateLevel(tiledImage, haveDrawn, drawLevel, level,
    levelVisibility, drawArea, currentTime, best) {
    var topLeftBound = drawArea.getBoundingBox().getTopLeft();
    var bottomRightBound = drawArea.getBoundingBox().getBottomRight();

    if (tiledImage.viewer) {
        tiledImage.viewer.raiseEvent('update-level', {
            tiledImage: tiledImage,
            havedrawn: haveDrawn,
            level: level,
            visibility: levelVisibility,
            drawArea: drawArea,
            topleft: topLeftBound,
            bottomright: bottomRightBound,
            currenttime: currentTime,
            best: best
        });
    }
    resetCoverage(tiledImage.coverage, level);
    resetCoverage(tiledImage.loadingCoverage, level);

    //OK, a new drawing so do your calculations
    var cornerTiles = tiledImage._getCornerTiles(level, topLeftBound, bottomRightBound);
    var topLeftTile = cornerTiles.topLeft;
    var bottomRightTile = cornerTiles.bottomRight;
    var numberOfTiles = tiledImage.source.getNumTiles(level);

    var viewportCenter = tiledImage.viewport.pixelFromPoint(
        tiledImage.viewport.getCenter());
    for (var x = topLeftTile.x; x <= bottomRightTile.x; x++) {
        for (var y = topLeftTile.y; y <= bottomRightTile.y; y++) {
            // Optimisation disabled with wrapping because getTileBounds does not
            // work correctly with x and y outside of the number of tiles
            if (!tiledImage.wrapHorizontal && !tiledImage.wrapVertical) {
                var tileBounds = tiledImage.source.getTileBounds(level, x, y);
                if (drawArea.intersection(tileBounds) === null) {
                    // This tile is outside of the viewport, no need to draw it
                    continue;
                }
            }
            best = updateTile(
                tiledImage,
                drawLevel,
                haveDrawn,
                x, y,
                level,
                levelVisibility,
                viewportCenter,
                numberOfTiles,
                currentTime,
                best
            );

        }
    }
    return best;
}
function updateTile( tiledImage, haveDrawn, drawLevel, x, y, level, levelVisibility, viewportCenter, numberOfTiles, currentTime, best){
    var tile = getTile(
            x, y,
            level,
            tiledImage,
            tiledImage.source,
            tiledImage.tilesMatrix,
            currentTime,
            numberOfTiles,
            tiledImage._worldWidthCurrent,
            tiledImage._worldHeightCurrent
        ),
        drawTile = drawLevel;

    if( tiledImage.viewer ){
        tiledImage.viewer.raiseEvent( 'update-tile', {
            tiledImage: tiledImage,
            tile: tile
        });
    }
    setCoverage( tiledImage.coverage, level, x, y, false );

    var loadingCoverage = tile.loaded || tile.loading || isCovered(tiledImage.loadingCoverage, level, x, y);
    setCoverage(tiledImage.loadingCoverage, level, x, y, loadingCoverage);

    if ( !tile.exists ) {
        return best;
    }
    if ( haveDrawn && !drawTile ) {
        if ( isCovered( tiledImage.coverage, level, x, y ) ) {
            setCoverage( tiledImage.coverage, level, x, y, true );
        } else {
            drawTile = true;
        }
    }
    if ( !drawTile ) {
        return best;
    }
    positionTile(
        tile,
        tiledImage.source.tileOverlap,
        tiledImage.viewport,
        viewportCenter,
        levelVisibility,
        tiledImage
    );

    if (!tile.loaded) {
        if (tile.context2D) {
            setTileLoaded(tiledImage, tile);
        } else {
            var imageRecord = tiledImage._tileCache.getImageRecord(tile.cacheKey);
            if (imageRecord) {
                var image = imageRecord.getImage();
                setTileLoaded(tiledImage, tile, image);
            }
        }
    }
    if ( tile.loaded ) {
        var needsDraw = blendTile(
            tiledImage,
            tile,
            x, y,
            level,
            currentTime
        );

        if ( needsDraw ) {
            tiledImage._needsDraw = true;
        }
    } else if ( tile.loading ) {
        // the tile is already in the download queue
        tiledImage._tilesLoading++;
    } else if (!loadingCoverage) {
        best = compareTiles( best, tile );
    }
    return best;
}
function getTile(
    x, y,
    level,
    tiledImage,
    tileSource,
    tilesMatrix,
    time,
    numTiles,
    worldWidth,
    worldHeight
) {
    var xMod,
        yMod,
        bounds,
        sourceBounds,
        exists,
        url,
        ajaxHeaders,
        context2D,
        tile;

    if ( !tilesMatrix[ level ] ) {
        tilesMatrix[ level ] = {};
    }
    if ( !tilesMatrix[ level ][ x ] ) {
        tilesMatrix[ level ][ x ] = {};
    }
    if ( !tilesMatrix[ level ][ x ][ y ] ) {
        xMod = ( numTiles.x + ( x % numTiles.x ) ) % numTiles.x;
        yMod = ( numTiles.y + ( y % numTiles.y ) ) % numTiles.y;
        bounds = tileSource.getTileBounds( level, xMod, yMod );
        sourceBounds = tileSource.getTileBounds( level, xMod, yMod, true );
        exists = tileSource.tileExists( level, xMod, yMod );
        url = tileSource.getTileUrl( level, xMod, yMod );

        // Headers are only applicable if loadTilesWithAjax is set
        if (tiledImage.loadTilesWithAjax) {
            ajaxHeaders = tileSource.getTileAjaxHeaders( level, xMod, yMod );
            // Combine tile AJAX headers with tiled image AJAX headers (if applicable)
            if ($.isPlainObject(tiledImage.ajaxHeaders)) {
                ajaxHeaders = $.extend({}, tiledImage.ajaxHeaders, ajaxHeaders);
            }
        } else {
            ajaxHeaders = null;
        }
        context2D = tileSource.getContext2D ?
            tileSource.getContext2D(level, xMod, yMod) : undefined;

        bounds.x += ( x - xMod ) / numTiles.x;
        bounds.y += (worldHeight / worldWidth) * (( y - yMod ) / numTiles.y);

        tile = new $.Tile(
            level,
            x,
            y,
            bounds,
            exists,
            url,
            context2D,
            tiledImage.loadTilesWithAjax,
            ajaxHeaders,
            sourceBounds
        );

        if (xMod === numTiles.x - 1) {
            tile.isRightMost = true;
        }
        if (yMod === numTiles.y - 1) {
            tile.isBottomMost = true;
        }
        tilesMatrix[ level ][ x ][ y ] = tile;
    }
    tile = tilesMatrix[ level ][ x ][ y ];
    tile.lastTouchTime = time;

    return tile;
}
function loadTile( tiledImage, tile, time ) {
    tile.loading = true;
    var customAjax;

    // Bind tiledImage if filtering Ajax
    if ($.isFunction(tiledImage.makeAjaxRequest)) {
      customAjax = tiledImage.makeAjaxRequest;
    }
    tiledImage._imageLoader.addJob({
        src: tile.url,
        makeAjaxRequest: customAjax,
        loadWithAjax: tile.loadWithAjax,
        ajaxHeaders: tile.ajaxHeaders,
        crossOriginPolicy: tiledImage.crossOriginPolicy,
        ajaxWithCredentials: tiledImage.ajaxWithCredentials,
        callback: function( image, errorMsg, tileRequest ){
            onTileLoad( tiledImage, tile, time, image, errorMsg, tileRequest );
        },
        abort: function() {
            tile.loading = false;
        }
    });
}
function onTileLoad( tiledImage, tile, time, image, errorMsg, tileRequest ) {
    if ( !image ) {

        tiledImage.viewer.raiseEvent("tile-load-failed", {
            tile: tile,
            tiledImage: tiledImage,
            time: time,
            message: errorMsg,
            tileRequest: tileRequest
        });
        tile.loading = false;
        tile.exists = false;
        return;
    }
    if ( time < tiledImage.lastResetTime ) {
        tile.loading = false;
        return;
    }
    var finish = function() {
        var cutoff = tiledImage.source.getClosestLevel();
        setTileLoaded(tiledImage, tile, image, cutoff, tileRequest);
    };
    // Check if we're mid-update; this can happen on IE8 because image load events for
    // cached images happen immediately there
    if ( !tiledImage._midDraw ) {
        finish();
    } else {
        // Wait until after the update, in case caching unloads any tiles
        window.setTimeout( finish, 1);
    }
}
function setTileLoaded(tiledImage, tile, image, cutoff, tileRequest) {
    var increment = 0;

    function getCompletionCallback() {
        increment++;
        return completionCallback;
    }
    function completionCallback() {
        increment--;
        if (increment === 0) {
            tile.loading = false;
            tile.loaded = true;
            if (!tile.context2D) {
                tiledImage._tileCache.cacheTile({
                    image: image,
                    tile: tile,
                    cutoff: cutoff,
                    tiledImage: tiledImage
                });
            }
            tiledImage._needsDraw = true;
        }
    }
    tiledImage.viewer.raiseEvent("tile-loaded", {
        tile: tile,
        tiledImage: tiledImage,
        tileRequest: tileRequest,
        image: image,
        getCompletionCallback: getCompletionCallback
    });
    // In case the completion callback is never called, we at least force it once.
    getCompletionCallback()();
}
function positionTile( tile, overlap, viewport, viewportCenter, levelVisibility, tiledImage ){
    var boundsTL = tile.bounds.getTopLeft();

    boundsTL.x *= tiledImage._scaleSpring.current.value;
    boundsTL.y *= tiledImage._scaleSpring.current.value;
    boundsTL.x += tiledImage._xSpring.current.value;
    boundsTL.y += tiledImage._ySpring.current.value;

    var boundsSize = tile.bounds.getSize();

    boundsSize.x *= tiledImage._scaleSpring.current.value;
    boundsSize.y *= tiledImage._scaleSpring.current.value;

    var positionC = viewport.pixelFromPoint(boundsTL, true),
        positionT = viewport.pixelFromPoint(boundsTL, false),
        sizeC = viewport.deltaPixelsFromPoints(boundsSize, true),
        sizeT = viewport.deltaPixelsFromPoints(boundsSize, false),
        tileCenter = positionT.plus( sizeT.divide( 2 ) ),
        tileSquaredDistance = viewportCenter.squaredDistanceTo( tileCenter );

    if ( !overlap ) {
        sizeC = sizeC.plus( new $.Point( 1, 1 ) );
    }
    if (tile.isRightMost && tiledImage.wrapHorizontal) {
        sizeC.x += 0.75; // Otherwise Firefox and Safari show seams
    }
    if (tile.isBottomMost && tiledImage.wrapVertical) {
        sizeC.y += 0.75; // Otherwise Firefox and Safari show seams
    }
    tile.position = positionC;
    tile.size = sizeC;
    tile.squaredDistance = tileSquaredDistance;
    tile.visibility = levelVisibility;
}
function blendTile( tiledImage, tile, x, y, level, currentTime ){

    if ( !tile.blendStart ) {
        tile.blendStart = currentTime;
    }

    tiledImage.lastDrawn.push( tile );

    setCoverage( tiledImage.coverage, level, x, y, true );
    tiledImage._hasOpaqueTile = true;
    return false;
}
function providesCoverage( coverage, level, x, y ) {
    var rows,
        cols,
        i, j;

    if ( !coverage[ level ] ) {
        return false;
    }
    if ( x === undefined || y === undefined ) {
        rows = coverage[ level ];
        for ( i in rows ) {
            if ( rows.hasOwnProperty( i ) ) {
                cols = rows[ i ];
                for ( j in cols ) {
                    if ( cols.hasOwnProperty( j ) && !cols[ j ] ) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    return (
        coverage[ level ][ x] === undefined ||
        coverage[ level ][ x ][ y ] === undefined ||
        coverage[ level ][ x ][ y ] === true
    );
}
function isCovered( coverage, level, x, y ) {
    if ( x === undefined || y === undefined ) {
        return providesCoverage( coverage, level + 1 );
    } else {
        return (
             providesCoverage( coverage, level + 1, 2 * x, 2 * y ) &&
             providesCoverage( coverage, level + 1, 2 * x, 2 * y + 1 ) &&
             providesCoverage( coverage, level + 1, 2 * x + 1, 2 * y ) &&
             providesCoverage( coverage, level + 1, 2 * x + 1, 2 * y + 1 )
        );
    }
}
function setCoverage( coverage, level, x, y, covers ) {
    if ( !coverage[ level ] ) {
        return;
    }
    if ( !coverage[ level ][ x ] ) {
        coverage[ level ][ x ] = {};
    }
    coverage[ level ][ x ][ y ] = covers;
}
function resetCoverage( coverage, level ) {
    coverage[ level ] = {};
}
function compareTiles( previousBest, tile ) {
    if ( !previousBest ) {
        return tile;
    }
    if ( tile.visibility > previousBest.visibility ) {
        return tile;
    } else if ( tile.visibility == previousBest.visibility ) {
        if ( tile.squaredDistance < previousBest.squaredDistance ) {
            return tile;
        }
    }
    return previousBest;
}
function drawTiles( tiledImage, lastDrawn ) {
    if (lastDrawn.length === 0) {
        return;
    }
    var tile = lastDrawn[0];
    var useSketch;

    if (tile) {
        useSketch = !tiledImage._isBottomItem() && tile._hasTransparencyChannel();
    }
    var sketchScale;
    var sketchTranslate;

    var zoom = tiledImage.viewport.getZoom(true);
    var imageZoom = tiledImage.viewportToImageZoom(zoom);

    if (lastDrawn.length > 1 &&
        imageZoom > tiledImage.smoothTileEdgesMinZoom &&
        !tiledImage.iOSDevice &&
        tiledImage.getRotation(true) % 360 === 0) {
        // When zoomed in a lot (>100%) the tile edges are visible.
        // So we have to composite them at ~100% and scale them up together.
        // Note: Disabled on iOS devices per default as it causes a native crash
        useSketch = true;
        sketchScale = tile.getScaleForEdgeSmoothing();
        sketchTranslate = tile.getTranslationForEdgeSmoothing(sketchScale,
            tiledImage._drawer.getCanvasSize(false),
            tiledImage._drawer.getCanvasSize(true));
    }
    var bounds;
    if (useSketch) {
        if (!sketchScale) {
            // Except when edge smoothing, we only clean the part of the
            // sketch canvas we are going to use for performance reasons.
            bounds = tiledImage.viewport.viewportToViewerElementRectangle(
                tiledImage.getClippedBounds(true))
                .getIntegerBoundingBox()
                .times($.pixelDensityRatio);
        }
        tiledImage._drawer._clear(true, bounds);
    }
    var usedClip = false;
    if ( tiledImage._clip ) {
        tiledImage._drawer.saveContext(useSketch);

        var box = tiledImage.imageToViewportRectangle(tiledImage._clip, true);
        var clipRect = tiledImage._drawer.viewportToDrawerRectangle(box);
        if (sketchScale) {
            clipRect = clipRect.times(sketchScale);
        }
        if (sketchTranslate) {
            clipRect = clipRect.translate(sketchTranslate);
        }
        tiledImage._drawer.setClip(clipRect, useSketch);

        usedClip = true;
    }
    for (var i = lastDrawn.length - 1; i >= 0; i--) {
        tile = lastDrawn[ i ];
        tiledImage._drawer.drawTile( tile, tiledImage._drawingHandler, useSketch, sketchScale, sketchTranslate );
        tile.beingDrawn = true;

        if( tiledImage.viewer ){
            tiledImage.viewer.raiseEvent( 'tile-drawn', {
                tiledImage: tiledImage,
                tile: tile
            });
        }
    }
    if ( usedClip ) {
        tiledImage._drawer.restoreContext( useSketch );
    }
    if (useSketch) {
        tiledImage._drawer.blendSketch({
            scale: sketchScale,
            translate: sketchTranslate,
            bounds: bounds
        });
    }
}
}( OpenSeadragon ));
