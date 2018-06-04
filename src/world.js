
(function( $ ){
$.World = function( options ) {
    var _this = this;


    $.EventSource.call( this );

    this.viewer = options.viewer;
    this._items = [];
    this._needsDraw = false;
    this._autoRefigureSizes = true;
    this._needsSizesFigured = false;
    this._delegatedFigureSizes = function(event) {
        if (_this._autoRefigureSizes) {
            _this._figureSizes();
        } else {
            _this._needsSizesFigured = true;
        }
    };
    this._figureSizes();
};
$.World.prototype = {
    addItem: function( item, options ) {

        options = options || {};
        if (options.index !== undefined) {
            var index = Math.max(0, Math.min(this._items.length, options.index));
            this._items.splice(index, 0, item);
        } else {
            this._items.push( item );
        }
        if (this._autoRefigureSizes) {
            this._figureSizes();
        } else {
            this._needsSizesFigured = true;
        }
        this._needsDraw = true;

        item.addHandler('bounds-change', this._delegatedFigureSizes);
        item.addHandler('clip-change', this._delegatedFigureSizes);

        this.raiseEvent( 'add-item', {
            item: item
        } );
    },
    getItemAt: function( index ) {
        return this._items[ index ];
    },
    getIndexOfItem: function( item ) {
        return $.indexOf( this._items, item );
    },
    getItemCount: function() {
        return this._items.length;
    },
    removeItem: function( item ) {

        var index = $.indexOf(this._items, item );
        if ( index === -1 ) {
            return;
        }
        item.removeHandler('bounds-change', this._delegatedFigureSizes);
        item.removeHandler('clip-change', this._delegatedFigureSizes);
        item.destroy();
        this._items.splice( index, 1 );
        this._figureSizes();
        this._needsDraw = true;
        this._raiseRemoveItem(item);
    },
    removeAll: function() {
        // We need to make sure any pending images are canceled so the world items don't get messed up
        this.viewer._cancelPendingImages();
        var item;
        var i;
        for (i = 0; i < this._items.length; i++) {
            item = this._items[i];
            item.removeHandler('bounds-change', this._delegatedFigureSizes);
            item.removeHandler('clip-change', this._delegatedFigureSizes);
            item.destroy();
        }
        var removedItems = this._items;
        this._items = [];
        this._figureSizes();
        this._needsDraw = true;

        for (i = 0; i < removedItems.length; i++) {
            item = removedItems[i];
            this._raiseRemoveItem(item);
        }
    },
    resetItems: function() {
        for ( var i = 0; i < this._items.length; i++ ) {
            this._items[i].reset();
        }
    },
    update: function() {
        var animated = false;
        for ( var i = 0; i < this._items.length; i++ ) {
            animated = this._items[i].update() || animated;
        }
        return animated;
    },
    draw: function() {
        for ( var i = 0; i < this._items.length; i++ ) {
            this._items[i].draw();
        }
        this._needsDraw = false;
    },
    needsDraw: function() {
        for ( var i = 0; i < this._items.length; i++ ) {
            if ( this._items[i].needsDraw() ) {
                return true;
            }
        }
        return this._needsDraw;
    },
    getHomeBounds: function() {
        return this._homeBounds.clone();
    },
    getContentFactor: function() {
        return this._contentFactor;
    },
    setAutoRefigureSizes: function(value) {
        this._autoRefigureSizes = value;
        if (value & this._needsSizesFigured) {
            this._figureSizes();
            this._needsSizesFigured = false;
        }
    },
    arrange: function(options) {
        options = options || {};
        var rows = options.rows || $.DEFAULT_SETTINGS.collectionRows;
        var columns = options.columns || $.DEFAULT_SETTINGS.collectionColumns;
        var tileSize = options.tileSize || $.DEFAULT_SETTINGS.collectionTileSize;
        var tileMargin = options.tileMargin || $.DEFAULT_SETTINGS.collectionTileMargin;
        var increment = tileSize + tileMargin;
        var wrap;
        if (!options.rows && columns) {
            wrap = columns;
        } else {
            wrap = Math.ceil(this._items.length / rows);
        }
        var x = 0;
        var y = 0;
        var item, box, width, height, position;

        this.setAutoRefigureSizes(false);
        for (var i = 0; i < this._items.length; i++) {
            if (i && (i % wrap) === 0) {
                y += increment;
                x = 0;
            }
            item = this._items[i];
            box = item.getBounds();
            if (box.width > box.height) {
                width = tileSize;
            } else {
                width = tileSize * (box.width / box.height);
            }
            height = width * (box.height / box.width);
            position = new $.Point(x + ((tileSize - width) / 2),
                y + ((tileSize - height) / 2));

            item.setPosition(position, true);
            item.setWidth(width, true);

            x += increment;
        }
        this.setAutoRefigureSizes(true);
    },
    // private
    _figureSizes: function() {
        var oldHomeBounds = this._homeBounds ? this._homeBounds.clone() : null;
        var oldContentSize = this._contentSize ? this._contentSize.clone() : null;
        var oldContentFactor = this._contentFactor || 0;

        if (!this._items.length) {
            this._homeBounds = new $.Rect(0, 0, 1, 1);
            this._contentSize = new $.Point(1, 1);
            this._contentFactor = 1;
        } else {
            var item = this._items[0];
            var bounds = item.getBounds();
            this._contentFactor = item.getContentSize().x / bounds.width;
            var clippedBounds = item.getClippedBounds().getBoundingBox();
            var left = clippedBounds.x;
            var top = clippedBounds.y;
            var right = clippedBounds.x + clippedBounds.width;
            var bottom = clippedBounds.y + clippedBounds.height;
            for (var i = 1; i < this._items.length; i++) {
                item = this._items[i];
                bounds = item.getBounds();
                this._contentFactor = Math.max(this._contentFactor,
                    item.getContentSize().x / bounds.width);
                clippedBounds = item.getClippedBounds().getBoundingBox();
                left = Math.min(left, clippedBounds.x);
                top = Math.min(top, clippedBounds.y);
                right = Math.max(right, clippedBounds.x + clippedBounds.width);
                bottom = Math.max(bottom, clippedBounds.y + clippedBounds.height);
            }
            this._homeBounds = new $.Rect(left, top, right - left, bottom - top);
            this._contentSize = new $.Point(
                this._homeBounds.width * this._contentFactor,
                this._homeBounds.height * this._contentFactor);
        }
        if (this._contentFactor !== oldContentFactor ||
            !this._homeBounds.equals(oldHomeBounds) ||
            !this._contentSize.equals(oldContentSize)) {
            this.raiseEvent('metrics-change', {});
        }
    },
    // private
    _raiseRemoveItem: function(item) {
        this.raiseEvent( 'remove-item', { item: item } );
    }
};
$.extend($.World.prototype, $.EventSource.prototype);

}( OpenSeadragon ));
