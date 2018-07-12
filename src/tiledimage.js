

(function( $ ){
$.TiledImage = function( options ) {

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
        minPixelRatio: $.DEFAULT_SETTINGS.minPixelRatio,
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

};
$.TiledImage.prototype = {
    needsDraw: function() {
        return this._needsDraw;
    },
    // private
    _setFullyLoaded: function(flag) {
        if (flag === this._fullyLoaded) {
            return;
        }
        this._fullyLoaded = flag;
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
            coordB.y
        );
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

        var tiledImageBounds = this._viewportToTiledImageRectangle(
            this.getClippedBounds(true));
        drawArea = drawArea.intersection(tiledImageBounds);
        if (drawArea === null) {
            return;
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

            var optimalRatio = targetZeroRatio;
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
        var leftX = Math.max(0, topLeftBound.x);
        var rightX = Math.min(1, bottomRightBound.x);
        var aspectRatio = 1 / this.source.aspectRatio;
        var topY = Math.max(0, topLeftBound.y);
        var bottomY = Math.min(aspectRatio, bottomRightBound.y);

        var topLeftTile = this.source.getTileAtPoint(level, new $.Point(leftX, topY));
        var bottomRightTile = this.source.getTileAtPoint(level, new $.Point(rightX, bottomY));
        return {
            topLeft: topLeftTile,
            bottomRight: bottomRightTile,
        };
    }
};
$.extend($.TiledImage.prototype, $.EventSource.prototype);

function updateLevel(tiledImage, haveDrawn, drawLevel, level,
    levelVisibility, drawArea, currentTime, best) {
    var topLeftBound = drawArea.getBoundingBox().getTopLeft();
    var bottomRightBound = drawArea.getBoundingBox().getBottomRight();

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
            // Optimisation
            var tileBounds = tiledImage.source.getTileBounds(level, x, y);
            if (drawArea.intersection(tileBounds) === null) {
                // This tile is outside of the viewport, no need to draw it
                continue;
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
                var typedImageData = imageRecord.getTypedImageData();
                setTileLoaded(tiledImage, tile, typedImageData);
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

        ajaxHeaders = tileSource.getTileAjaxHeaders( level, xMod, yMod );
        // Combine tile AJAX headers with tiled image AJAX headers (if applicable)
        if ($.isPlainObject(tiledImage.ajaxHeaders)) {
            ajaxHeaders = $.extend({}, tiledImage.ajaxHeaders, ajaxHeaders);
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
        ajaxHeaders: tile.ajaxHeaders,
        ajaxWithCredentials: tiledImage.ajaxWithCredentials,
        callback: function( typedImageData, errorMsg, tileRequest ){
            onTileLoad( tiledImage, tile, time, typedImageData, errorMsg, tileRequest );
        },
        abort: function() {
            tile.loading = false;
        }
    });
}
function onTileLoad( tiledImage, tile, time, typedImageData, errorMsg, tileRequest ) {
    if ( !typedImageData ) {

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
        setTileLoaded(tiledImage, tile, typedImageData, cutoff, tileRequest);
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
function setTileLoaded(tiledImage, tile, typedImageData, cutoff, tileRequest) {
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
                    typedImageData: typedImageData,
                    tile: tile,
                    cutoff: cutoff,
                    tiledImage: tiledImage
                });
            }
            tiledImage._needsDraw = true;
        }
    }
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

    var zoom = tiledImage.viewport.getZoom(true);
    var imageZoom = tiledImage.viewportToImageZoom(zoom);

    // We only clean the part of the
    // sketch canvas we are going to use for performance reasons.
    var bounds = tiledImage.viewport.viewportToViewerElementRectangle(
        tiledImage.getClippedBounds(true))
        .getIntegerBoundingBox()
        .times($.pixelDensityRatio);
    tiledImage._drawer._clear(true, bounds);

    var usedClip = false;
    if ( tiledImage._clip ) {
        tiledImage._drawer.saveContext();

        var box = tiledImage.imageToViewportRectangle(tiledImage._clip, true);
        var clipRect = tiledImage._drawer.viewportToDrawerRectangle(box);
        tiledImage._drawer.setClip(clipRect);

        usedClip = true;
    }
    for (var i = lastDrawn.length - 1; i >= 0; i--) {
        tile = lastDrawn[ i ];
        tiledImage._drawer.drawTile( tile, sketchScale, sketchTranslate );
        tile.beingDrawn = true;

    }
    if ( usedClip ) {
        tiledImage._drawer.restoreContext();
    }
    tiledImage._drawer.blendSketch({
        bounds: bounds
    });
}
}( OpenSeadragon ));
