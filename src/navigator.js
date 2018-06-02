

(function( $ ){
$.Navigator = function( options ){
    var viewer = options.viewer,
        _this = this;

    //We may need to create a new element and id if they did not
    //provide the id for the existing element
    if( !options.id ){
        options.id = 'navigator-' + $.now();
        this.element = $.makeNeutralElement( "div" );
    } else {
        this.element = document.getElementById( options.id );
    }
    this.element.id = options.id;
    this.element.className += ' navigator';

    options = $.extend( true, {
        sizeRatio: $.DEFAULT_SETTINGS.navigatorSizeRatio
    }, options, {
        element: this.element,
        tabIndex: -1, // No keyboard navigation, omit from tab order
        //These need to be overridden to prevent recursion since
        //the navigator is a viewer and a viewer has a navigator
        showNavigator: false,
        mouseNavEnabled: false,
        immediateRender: true,
        blendTime: 0,
        animationTime: 0,
        autoResize: options.autoResize,
        // prevent resizing the navigator from adding unwanted space around the image
        minZoomImageRatio: 1.0
    });
    options.minPixelRatio = this.minPixelRatio = viewer.minPixelRatio;

    this.borderWidth = 2;
    //At some browser magnification levels the display regions lines up correctly, but at some there appears to
    //be a one pixel gap.
    this.fudge = new $.Point(1, 1);
    this.totalBorderWidths = new $.Point(this.borderWidth * 2, this.borderWidth * 2).minus(this.fudge);

    this.displayRegion = $.makeNeutralElement( "div" );
    this.displayRegion.id = this.element.id + '-displayregion';
    this.displayRegion.className = 'displayregion';

    (function( style, borderWidth ){
        style.position = 'relative';
        style.top = '0px';
        style.left = '0px';
        style.fontSize = '0px';
        style.overflow = 'hidden';
        style.border = borderWidth + 'px solid #900';
        style.margin = '0px';
        style.padding = '0px';
        //TODO: IE doesnt like this property being set
        //try{ style.outline = '2px auto #909'; }catch(e){}
        style.background = 'transparent';

        // We use square bracket notation on the statement below, because float is a keyword.
        // This is important for the Google Closure compiler, if nothing else.

        style['float'] = 'left'; //Webkit

        style.cssFloat = 'left'; //Firefox
        style.styleFloat = 'left'; //IE
        style.zIndex = 999999999;
        style.cursor = 'default';
    }( this.displayRegion.style, this.borderWidth ));
    this.displayRegionContainer = $.makeNeutralElement("div");
    this.displayRegionContainer.id = this.element.id + '-displayregioncontainer';
    this.displayRegionContainer.className = "displayregioncontainer";
    this.displayRegionContainer.style.width = "100%";
    this.displayRegionContainer.style.height = "100%";

    this.oldContainerSize = new $.Point( 0, 0 );

    $.Viewer.apply( this, [ options ] );

    this.displayRegionContainer.appendChild(this.displayRegion);
    this.element.getElementsByTagName('div')[0].appendChild(this.displayRegionContainer);

    function rotate(degrees) {
        _setTransformRotate(_this.displayRegionContainer, degrees);
        _setTransformRotate(_this.displayRegion, -degrees);
        _this.viewport.setRotation(degrees);
    }
    if (options.navigatorRotate) {
        var degrees = options.viewer.viewport ?
            options.viewer.viewport.getRotation() :
            options.viewer.degrees || 0;
        rotate(degrees);
        options.viewer.addHandler("rotate", function (args) {
            rotate(args.degrees);
        });
    }
    // Remove the base class' (Viewer's) innerTracker and replace it with our own
    this.innerTracker.destroy();
    this.innerTracker = new $.MouseTracker({
        element: this.element,
        dragHandler: $.delegate( this, onCanvasDrag ),
        clickHandler: $.delegate( this, onCanvasClick ),
        releaseHandler: $.delegate( this, onCanvasRelease ),
        scrollHandler: $.delegate( this, onCanvasScroll )
    });
    this.addHandler("reset-size", function() {
        if (_this.viewport) {
            _this.viewport.goHome(true);
        }
    });
    viewer.world.addHandler("item-index-change", function(event) {
        window.setTimeout(function(){
            var item = _this.world.getItemAt(event.previousIndex);
            _this.world.setItemIndex(item, event.newIndex);
        }, 1);
    });
    viewer.world.addHandler("remove-item", function(event) {
        var theirItem = event.item;
        var myItem = _this._getMatchingItem(theirItem);
        if (myItem) {
            _this.world.removeItem(myItem);
        }
    });
    this.update(viewer.viewport);
};
$.extend( $.Navigator.prototype, $.EventSource.prototype, $.Viewer.prototype, {

    updateSize: function () {
        if ( this.viewport ) {
            var containerSize = new $.Point(
                    (this.container.clientWidth === 0 ? 1 : this.container.clientWidth),
                    (this.container.clientHeight === 0 ? 1 : this.container.clientHeight)
                );

            if ( !containerSize.equals( this.oldContainerSize ) ) {
                this.viewport.resize( containerSize, true );
                this.viewport.goHome(true);
                this.oldContainerSize = containerSize;
                this.drawer.clear();
                this.world.draw();
            }
        }
    },
    update: function( viewport ) {
        var bounds,
            topleft,
            bottomright;

        if (viewport && this.viewport) {
            bounds = viewport.getBoundsNoRotate(true);
            topleft = this.viewport.pixelFromPointNoRotate(bounds.getTopLeft(), false);
            bottomright = this.viewport.pixelFromPointNoRotate(bounds.getBottomRight(), false)
                .minus( this.totalBorderWidths );

            //update style for navigator-box
            var style = this.displayRegion.style;
            style.display = this.world.getItemCount() ? 'block' : 'none';

            style.top = Math.round( topleft.y ) + 'px';
            style.left = Math.round( topleft.x ) + 'px';

            var width = Math.abs( topleft.x - bottomright.x );
            var height = Math.abs( topleft.y - bottomright.y );
            // make sure width and height are non-negative so IE doesn't throw
            style.width = Math.round( Math.max( width, 0 ) ) + 'px';
            style.height = Math.round( Math.max( height, 0 ) ) + 'px';
        }
    },
    // overrides Viewer.addTiledImage
    addTiledImage: function(options) {
        var _this = this;

        var original = options.originalTiledImage;
        delete options.original;

        var optionsClone = $.extend({}, options, {
            success: function(event) {
                var myItem = event.item;
                myItem._originalForNavigator = original;
                _this._matchBounds(myItem, original, true);

                function matchBounds() {
                    _this._matchBounds(myItem, original);
                }
                function matchOpacity() {
                    _this._matchOpacity(myItem, original);
                }
                function matchCompositeOperation() {
                    _this._matchCompositeOperation(myItem, original);
                }
                original.addHandler('bounds-change', matchBounds);
                original.addHandler('clip-change', matchBounds);
                original.addHandler('opacity-change', matchOpacity);
                original.addHandler('composite-operation-change', matchCompositeOperation);
            }
        });
        return $.Viewer.prototype.addTiledImage.apply(this, [optionsClone]);
    },
    // private
    _getMatchingItem: function(theirItem) {
        var count = this.world.getItemCount();
        var item;
        for (var i = 0; i < count; i++) {
            item = this.world.getItemAt(i);
            if (item._originalForNavigator === theirItem) {
                return item;
            }
        }
        return null;
    },
    // private
    _matchBounds: function(myItem, theirItem, immediately) {
        var bounds = theirItem.getBoundsNoRotate();
        myItem.setPosition(bounds.getTopLeft(), immediately);
        myItem.setWidth(bounds.width, immediately);
        myItem.setRotation(theirItem.getRotation(), immediately);
        myItem.setClip(theirItem.getClip());
    },
    // private
    _matchOpacity: function(myItem, theirItem) {
        myItem.setOpacity(theirItem.opacity);
    },
    // private
    _matchCompositeOperation: function(myItem, theirItem) {
        myItem.setCompositeOperation(theirItem.compositeOperation);
    }
});
function onCanvasClick( event ) {
    if ( event.quick && this.viewer.viewport ) {
        this.viewer.viewport.panTo(this.viewport.pointFromPixel(event.position));
        this.viewer.viewport.applyConstraints();
    }
}
function onCanvasDrag( event ) {
    if ( this.viewer.viewport ) {
        if( !this.panHorizontal ){
            event.delta.x = 0;
        }
        if( !this.panVertical ){
            event.delta.y = 0;
        }
        this.viewer.viewport.panBy(
            this.viewport.deltaPointsFromPixels(
                event.delta
            )
        );
        if( this.viewer.constrainDuringPan ){
            this.viewer.viewport.applyConstraints();
        }
    }
}
function onCanvasRelease( event ) {
    if ( event.insideElementPressed && this.viewer.viewport ) {
        this.viewer.viewport.applyConstraints();
    }
}
function onCanvasScroll( event ) {
    this.viewer.raiseEvent( 'navigator-scroll', {
        tracker: event.eventSource,
        position: event.position,
        scroll: event.scroll,
        shift: event.shift,
        originalEvent: event.originalEvent
    });
    //dont scroll the page up and down if the user is scrolling
    //in the navigator
    return false;
}
function _setTransformRotate (element, degrees) {
    element.style.webkitTransform = "rotate(" + degrees + "deg)";
    element.style.mozTransform = "rotate(" + degrees + "deg)";
    element.style.msTransform = "rotate(" + degrees + "deg)";
    element.style.oTransform = "rotate(" + degrees + "deg)";
    element.style.transform = "rotate(" + degrees + "deg)";
}
}( OpenSeadragon ));
