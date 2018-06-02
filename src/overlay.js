

(function($) {

    $.OverlayPlacement = $.Placement;
    $.OverlayRotationMode = $.freezeObject({
        NO_ROTATION: 1,
        EXACT: 2,
        BOUNDING_BOX: 3
    });
    $.Overlay = function(element, location, placement) {
        var options;
        if ($.isPlainObject(element)) {
            options = element;
        } else {
            options = {
                element: element,
                location: location,
                placement: placement
            };
        }
        this.element = options.element;
        this.style = options.element.style;
        this._init(options);
    };
    $.Overlay.prototype = {
        // private
        _init: function(options) {
            this.location = options.location;
            this.placement = options.placement === undefined ?
                $.Placement.TOP_LEFT : options.placement;
            this.onDraw = options.onDraw;
            this.checkResize = options.checkResize === undefined ?
                true : options.checkResize;

            // When this.width is not null, the overlay get scaled horizontally
            this.width = options.width === undefined ? null : options.width;

            // When this.height is not null, the overlay get scaled vertically
            this.height = options.height === undefined ? null : options.height;

            this.rotationMode = options.rotationMode || $.OverlayRotationMode.EXACT;

            // Having a rect as location is a syntactic sugar
            if (this.location instanceof $.Rect) {
                this.width = this.location.width;
                this.height = this.location.height;
                this.location = this.location.getTopLeft();
                this.placement = $.Placement.TOP_LEFT;
            }
            // Deprecated properties kept for backward compatibility.
            this.scales = this.width !== null && this.height !== null;
            this.bounds = new $.Rect(
                this.location.x, this.location.y, this.width, this.height);
            this.position = this.location;
        },
        adjust: function(position, size) {
            var properties = $.Placement.properties[this.placement];
            if (!properties) {
                return;
            }
            if (properties.isHorizontallyCentered) {
                position.x -= size.x / 2;
            } else if (properties.isRight) {
                position.x -= size.x;
            }
            if (properties.isVerticallyCentered) {
                position.y -= size.y / 2;
            } else if (properties.isBottom) {
                position.y -= size.y;
            }
        },
        destroy: function() {
            var element = this.element;
            var style = this.style;

            if (element.parentNode) {
                element.parentNode.removeChild(element);
                //this should allow us to preserve overlays when required between
                //pages
                if (element.prevElementParent) {
                    style.display = 'none';
                    //element.prevElementParent.insertBefore(
                    // element,
                    // element.prevNextSibling
                    //);
                    document.body.appendChild(element);
                }
            }
            // clear the onDraw callback
            this.onDraw = null;

            style.top = "";
            style.left = "";
            style.position = "";

            if (this.width !== null) {
                style.width = "";
            }
            if (this.height !== null) {
                style.height = "";
            }
            var transformOriginProp = $.getCssPropertyWithVendorPrefix(
                'transformOrigin');
            var transformProp = $.getCssPropertyWithVendorPrefix(
                'transform');
            if (transformOriginProp && transformProp) {
                style[transformOriginProp] = "";
                style[transformProp] = "";
            }
        },
        drawHTML: function(container, viewport) {
            var element = this.element;
            if (element.parentNode !== container) {
                //save the source parent for later if we need it
                element.prevElementParent = element.parentNode;
                element.prevNextSibling = element.nextSibling;
                container.appendChild(element);

                // have to set position before calculating size, fix #1116
                this.style.position = "absolute";
                // this.size is used by overlays which don't get scaled in at
                // least one direction when this.checkResize is set to false.
                this.size = $.getElementSize(element);
            }
            var positionAndSize = this._getOverlayPositionAndSize(viewport);

            var position = positionAndSize.position;
            var size = this.size = positionAndSize.size;
            var rotate = positionAndSize.rotate;

            // call the onDraw callback if it exists to allow one to overwrite
            // the drawing/positioning/sizing of the overlay
            if (this.onDraw) {
                this.onDraw(position, size, this.element);
            } else {
                var style = this.style;
                style.left = position.x + "px";
                style.top = position.y + "px";
                if (this.width !== null) {
                    style.width = size.x + "px";
                }
                if (this.height !== null) {
                    style.height = size.y + "px";
                }
                var transformOriginProp = $.getCssPropertyWithVendorPrefix(
                    'transformOrigin');
                var transformProp = $.getCssPropertyWithVendorPrefix(
                    'transform');
                if (transformOriginProp && transformProp) {
                    if (rotate) {
                        style[transformOriginProp] = this._getTransformOrigin();
                        style[transformProp] = "rotate(" + rotate + "deg)";
                    } else {
                        style[transformOriginProp] = "";
                        style[transformProp] = "";
                    }
                }
                if (style.display !== 'none') {
                    style.display = 'block';
                }
            }
        },
        // private
        _getOverlayPositionAndSize: function(viewport) {
            var position = viewport.pixelFromPoint(this.location, true);
            var size = this._getSizeInPixels(viewport);
            this.adjust(position, size);

            var rotate = 0;
            if (viewport.degrees &&
                this.rotationMode !== $.OverlayRotationMode.NO_ROTATION) {
                // BOUNDING_BOX is only valid if both directions get scaled.
                // Get replaced by EXACT otherwise.
                if (this.rotationMode === $.OverlayRotationMode.BOUNDING_BOX &&
                    this.width !== null && this.height !== null) {
                    var rect = new $.Rect(position.x, position.y, size.x, size.y);
                    var boundingBox = this._getBoundingBox(rect, viewport.degrees);
                    position = boundingBox.getTopLeft();
                    size = boundingBox.getSize();
                } else {
                    rotate = viewport.degrees;
                }
            }
            return {
                position: position,
                size: size,
                rotate: rotate
            };
        },
        // private
        _getSizeInPixels: function(viewport) {
            var width = this.size.x;
            var height = this.size.y;
            if (this.width !== null || this.height !== null) {
                var scaledSize = viewport.deltaPixelsFromPointsNoRotate(
                    new $.Point(this.width || 0, this.height || 0), true);
                if (this.width !== null) {
                    width = scaledSize.x;
                }
                if (this.height !== null) {
                    height = scaledSize.y;
                }
            }
            if (this.checkResize &&
                (this.width === null || this.height === null)) {
                var eltSize = this.size = $.getElementSize(this.element);
                if (this.width === null) {
                    width = eltSize.x;
                }
                if (this.height === null) {
                    height = eltSize.y;
                }
            }
            return new $.Point(width, height);
        },
        // private
        _getBoundingBox: function(rect, degrees) {
            var refPoint = this._getPlacementPoint(rect);
            return rect.rotate(degrees, refPoint).getBoundingBox();
        },
        // private
        _getPlacementPoint: function(rect) {
            var result = new $.Point(rect.x, rect.y);
            var properties = $.Placement.properties[this.placement];
            if (properties) {
                if (properties.isHorizontallyCentered) {
                    result.x += rect.width / 2;
                } else if (properties.isRight) {
                    result.x += rect.width;
                }
                if (properties.isVerticallyCentered) {
                    result.y += rect.height / 2;
                } else if (properties.isBottom) {
                    result.y += rect.height;
                }
            }
            return result;
        },
        // private
        _getTransformOrigin: function() {
            var result = "";
            var properties = $.Placement.properties[this.placement];
            if (!properties) {
                return result;
            }
            if (properties.isLeft) {
                result = "left";
            } else if (properties.isRight) {
                result = "right";
            }
            if (properties.isTop) {
                result += " top";
            } else if (properties.isBottom) {
                result += " bottom";
            }
            return result;
        },
        update: function(location, placement) {
            var options = $.isPlainObject(location) ? location : {
                location: location,
                placement: placement
            };
            this._init({
                location: options.location || this.location,
                placement: options.placement !== undefined ?
                    options.placement : this.placement,
                onDraw: options.onDraw || this.onDraw,
                checkResize: options.checkResize || this.checkResize,
                width: options.width !== undefined ? options.width : this.width,
                height: options.height !== undefined ? options.height : this.height,
                rotationMode: options.rotationMode || this.rotationMode
            });
        },
        getBounds: function(viewport) {
            $.console.assert(viewport,
                'A viewport must now be passed to Overlay.getBounds.');
            var width = this.width;
            var height = this.height;
            if (width === null || height === null) {
                var size = viewport.deltaPointsFromPixelsNoRotate(this.size, true);
                if (width === null) {
                    width = size.x;
                }
                if (height === null) {
                    height = size.y;
                }
            }
            var location = this.location.clone();
            this.adjust(location, new $.Point(width, height));
            return this._adjustBoundsForRotation(
                viewport, new $.Rect(location.x, location.y, width, height));
        },
        // private
        _adjustBoundsForRotation: function(viewport, bounds) {
            if (!viewport ||
                viewport.degrees === 0 ||
                this.rotationMode === $.OverlayRotationMode.EXACT) {
                return bounds;
            }
            if (this.rotationMode === $.OverlayRotationMode.BOUNDING_BOX) {
                // If overlay not fully scalable, BOUNDING_BOX falls back to EXACT
                if (this.width === null || this.height === null) {
                    return bounds;
                }
                // It is easier to just compute the position and size and
                // convert to viewport coordinates.
                var positionAndSize = this._getOverlayPositionAndSize(viewport);
                return viewport.viewerElementToViewportRectangle(new $.Rect(
                    positionAndSize.position.x,
                    positionAndSize.position.y,
                    positionAndSize.size.x,
                    positionAndSize.size.y));
            }
            // NO_ROTATION case
            return bounds.rotate(-viewport.degrees,
                this._getPlacementPoint(bounds));
        }
    };
}(OpenSeadragon));
