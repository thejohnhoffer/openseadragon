

(function ($) {

    $.ImageTileSource = function (options) {
        options = $.extend({
            buildPyramid: true,
            crossOriginPolicy: false,
            ajaxWithCredentials: false,
            useCanvas: true
        }, options);
        $.TileSource.apply(this, [options]);

    };
    $.extend($.ImageTileSource.prototype, $.TileSource.prototype, {
        supports: function (data, url) {
            return data.type && data.type === "image";
        },
        configure: function (options, dataUrl) {
            return options;
        },
        getImageInfo: function (url) {
            var image = this._image = new Image();
            var _this = this;

            if (this.crossOriginPolicy) {
                image.crossOrigin = this.crossOriginPolicy;
            }
            if (this.ajaxWithCredentials) {
                image.useCredentials = this.ajaxWithCredentials;
            }
            $.addEvent(image, 'load', function () {
                _this.width = Object.prototype.hasOwnProperty.call(image, 'naturalWidth') ? image.naturalWidth : image.width;
                _this.height = Object.prototype.hasOwnProperty.call(image, 'naturalHeight') ? image.naturalHeight : image.height;
                _this.aspectRatio = _this.width / _this.height;
                _this.dimensions = new $.Point(_this.width, _this.height);
                _this._tileWidth = _this.width;
                _this._tileHeight = _this.height;
                _this.tileOverlap = 0;
                _this.minLevel = 0;
                _this.levels = _this._buildLevels();
                _this.maxLevel = _this.levels.length - 1;

                _this.ready = true;

                // Note: this event is documented elsewhere, in TileSource
                _this.raiseEvent('ready', {tileSource: _this});
            });
            $.addEvent(image, 'error', function () {
                // Note: this event is documented elsewhere, in TileSource
                _this.raiseEvent('open-failed', {
                    message: "Error loading image at " + url,
                    source: url
                });
            });
            image.src = url;
        },
        getLevelScale: function (level) {
            var levelScale = NaN;
            if (level >= this.minLevel && level <= this.maxLevel) {
                levelScale =
                        this.levels[level].width /
                        this.levels[this.maxLevel].width;
            }
            return levelScale;
        },
        getNumTiles: function (level) {
            var scale = this.getLevelScale(level);
            if (scale) {
                return new $.Point(1, 1);
            } else {
                return new $.Point(0, 0);
            }
        },
        getTileUrl: function (level, x, y) {
            var url = null;
            if (level >= this.minLevel && level <= this.maxLevel) {
                url = this.levels[level].url;
            }
            return url;
        },
        getContext2D: function (level, x, y) {
            var context = null;
            if (level >= this.minLevel && level <= this.maxLevel) {
                context = this.levels[level].context2D;
            }
            return context;
        },
        // private
        //
        // Builds the differents levels of the pyramid if possible
        // (i.e. if canvas API enabled and no canvas tainting issue).
        _buildLevels: function () {
            var levels = [{
                    url: this._image.src,

                    width: Object.prototype.hasOwnProperty.call(this._image, 'naturalWidth') ? this._image.naturalWidth : this._image.width,
                    height: Object.prototype.hasOwnProperty.call(this._image, 'naturalHeight') ? this._image.naturalHeight : this._image.height
                }];
            if (!this.buildPyramid || !$.supportsCanvas || !this.useCanvas) {
                // We don't need the image anymore. Allows it to be GC.
                delete this._image;
                return levels;
            }
            var currentWidth = Object.prototype.hasOwnProperty.call(this._image, 'naturalWidth') ? this._image.naturalWidth : this._image.width;
            var currentHeight = Object.prototype.hasOwnProperty.call(this._image, 'naturalHeight') ? this._image.naturalHeight : this._image.height;

            var bigCanvas = document.createElement("canvas");
            var bigContext = bigCanvas.getContext("2d");

            bigCanvas.width = currentWidth;
            bigCanvas.height = currentHeight;
            bigContext.drawImage(this._image, 0, 0, currentWidth, currentHeight);
            // We cache the context of the highest level because the browser
            // is a lot faster at downsampling something it already has
            // downsampled before.
            levels[0].context2D = bigContext;
            // We don't need the image anymore. Allows it to be GC.
            delete this._image;

            if ($.isCanvasTainted(bigCanvas)) {
                // If the canvas is tainted, we can't compute the pyramid.
                return levels;
            }
            // We build smaller levels until either width or height becomes
            // 1 pixel wide.
            while (currentWidth >= 2 && currentHeight >= 2) {
                currentWidth = Math.floor(currentWidth / 2);
                currentHeight = Math.floor(currentHeight / 2);
                var smallCanvas = document.createElement("canvas");
                var smallContext = smallCanvas.getContext("2d");
                smallCanvas.width = currentWidth;
                smallCanvas.height = currentHeight;
                smallContext.drawImage(bigCanvas, 0, 0, currentWidth, currentHeight);

                levels.splice(0, 0, {
                    context2D: smallContext,
                    width: currentWidth,
                    height: currentHeight
                });
                bigCanvas = smallCanvas;
                bigContext = smallContext;
            }
            return levels;
        }
    });
}(OpenSeadragon));
