

(function($) {
$.Rect = function(x, y, width, height) {
    this.x = typeof (x) === "number" ? x : 0;

    this.y = typeof (y) === "number" ? y : 0;

    this.width = typeof (width) === "number" ? width : 0;

    this.height = typeof (height) === "number" ? height : 0;

};
$.Rect.fromSummits = function(topLeft, topRight, bottomLeft) {
    var width = topLeft.distanceTo(topRight);
    var height = topLeft.distanceTo(bottomLeft);
    var diff = topRight.minus(topLeft);
    var radians = Math.atan(diff.y / diff.x);
    if (diff.x < 0) {
        radians += Math.PI;
    } else if (diff.y < 0) {
        radians += 2 * Math.PI;
    }
    return new $.Rect(
        topLeft.x,
        topLeft.y,
        width,
        height,
        radians / Math.PI * 180);
};
$.Rect.prototype = {
    clone: function() {
        return new $.Rect(
            this.x,
            this.y,
            this.width,
            this.height);
    },
    getAspectRatio: function() {
        return this.width / this.height;
    },
    getTopLeft: function() {
        return new $.Point(
            this.x,
            this.y
        );
    },
    getBottomRight: function() {
        return new $.Point(this.x + this.width, this.y + this.height);
    },
    getTopRight: function() {
        return new $.Point(this.x + this.width, this.y);
    },
    getBottomLeft: function() {
        return new $.Point(this.x, this.y + this.height);
    },
    getCenter: function() {
        return new $.Point(
            this.x + this.width / 2.0,
            this.y + this.height / 2.0
        );
    },
    getSize: function() {
        return new $.Point(this.width, this.height);
    },
    equals: function(other) {
        return (other instanceof $.Rect) &&
            this.x === other.x &&
            this.y === other.y &&
            this.width === other.width &&
            this.height === other.height;
    },
    times: function(factor) {
        return new $.Rect(
            this.x * factor,
            this.y * factor,
            this.width * factor,
            this.height * factor);
    },
    translate: function(delta) {
        return new $.Rect(
            this.x + delta.x,
            this.y + delta.y,
            this.width,
            this.height);
    },
    intersection: function(rect) {
        // Simplified version of Weiler Atherton clipping algorithm
        // https://en.wikipedia.org/wiki/Weiler%E2%80%93Atherton_clipping_algorithm
        // Because we just want the bounding box of the intersection,
        // we can just compute the bounding box of:
        // 1. all the summits of this which are inside rect
        // 2. all the summits of rect which are inside this
        // 3. all the intersections of rect and this
        var EPSILON = 0.0000000001;

        var intersectionPoints = [];

        var thisTopLeft = this.getTopLeft();
        if (rect.containsPoint(thisTopLeft, EPSILON)) {
            intersectionPoints.push(thisTopLeft);
        }
        var thisTopRight = this.getTopRight();
        if (rect.containsPoint(thisTopRight, EPSILON)) {
            intersectionPoints.push(thisTopRight);
        }
        var thisBottomLeft = this.getBottomLeft();
        if (rect.containsPoint(thisBottomLeft, EPSILON)) {
            intersectionPoints.push(thisBottomLeft);
        }
        var thisBottomRight = this.getBottomRight();
        if (rect.containsPoint(thisBottomRight, EPSILON)) {
            intersectionPoints.push(thisBottomRight);
        }
        var rectTopLeft = rect.getTopLeft();
        if (this.containsPoint(rectTopLeft, EPSILON)) {
            intersectionPoints.push(rectTopLeft);
        }
        var rectTopRight = rect.getTopRight();
        if (this.containsPoint(rectTopRight, EPSILON)) {
            intersectionPoints.push(rectTopRight);
        }
        var rectBottomLeft = rect.getBottomLeft();
        if (this.containsPoint(rectBottomLeft, EPSILON)) {
            intersectionPoints.push(rectBottomLeft);
        }
        var rectBottomRight = rect.getBottomRight();
        if (this.containsPoint(rectBottomRight, EPSILON)) {
            intersectionPoints.push(rectBottomRight);
        }
        var thisSegments = this._getSegments();
        var rectSegments = rect._getSegments();
        for (var i = 0; i < thisSegments.length; i++) {
            var thisSegment = thisSegments[i];
            for (var j = 0; j < rectSegments.length; j++) {
                var rectSegment = rectSegments[j];
                var intersect = getIntersection(thisSegment[0], thisSegment[1],
                    rectSegment[0], rectSegment[1]);
                if (intersect) {
                    intersectionPoints.push(intersect);
                }
            }
        }
        // Get intersection point of segments [a,b] and [c,d]
        function getIntersection(a, b, c, d) {
            // http://stackoverflow.com/a/1968345/1440403
            var abVector = b.minus(a);
            var cdVector = d.minus(c);

            var denom = -cdVector.x * abVector.y + abVector.x * cdVector.y;
            if (denom === 0) {
                return null;
            }
            var s = (abVector.x * (a.y - c.y) - abVector.y * (a.x - c.x)) / denom;
            var t = (cdVector.x * (a.y - c.y) - cdVector.y * (a.x - c.x)) / denom;

            if (-EPSILON <= s && s <= 1 - EPSILON &&
                -EPSILON <= t && t <= 1 - EPSILON) {
                return new $.Point(a.x + t * abVector.x, a.y + t * abVector.y);
            }
            return null;
        }
        if (intersectionPoints.length === 0) {
            return null;
        }
        var minX = intersectionPoints[0].x;
        var maxX = intersectionPoints[0].x;
        var minY = intersectionPoints[0].y;
        var maxY = intersectionPoints[0].y;
        for (var k = 1; k < intersectionPoints.length; k++) {
            var point = intersectionPoints[k];
            if (point.x < minX) {
                minX = point.x;
            }
            if (point.x > maxX) {
                maxX = point.x;
            }
            if (point.y < minY) {
                minY = point.y;
            }
            if (point.y > maxY) {
                maxY = point.y;
            }
        }
        return new $.Rect(minX, minY, maxX - minX, maxY - minY);
    },
    // private
    _getSegments: function() {
        var topLeft = this.getTopLeft();
        var topRight = this.getTopRight();
        var bottomLeft = this.getBottomLeft();
        var bottomRight = this.getBottomRight();
        return [[topLeft, topRight],
            [topRight, bottomRight],
            [bottomRight, bottomLeft],
            [bottomLeft, topLeft]];
    },
    getBoundingBox: function() {
        return this.clone();
    },
    getIntegerBoundingBox: function() {
        var boundingBox = this.getBoundingBox();
        var x = Math.floor(boundingBox.x);
        var y = Math.floor(boundingBox.y);
        var width = Math.ceil(boundingBox.width + boundingBox.x - x);
        var height = Math.ceil(boundingBox.height + boundingBox.y - y);
        return new $.Rect(x, y, width, height);
    },
    containsPoint: function(point, epsilon) {
        epsilon = epsilon || 0;

        // See http://stackoverflow.com/a/2752754/1440403 for explanation
        var topLeft = this.getTopLeft();
        var topRight = this.getTopRight();
        var bottomLeft = this.getBottomLeft();
        var topDiff = topRight.minus(topLeft);
        var leftDiff = bottomLeft.minus(topLeft);

        return ((point.x - topLeft.x) * topDiff.x +
            (point.y - topLeft.y) * topDiff.y >= -epsilon) &&

            ((point.x - topRight.x) * topDiff.x +
            (point.y - topRight.y) * topDiff.y <= epsilon) &&

            ((point.x - topLeft.x) * leftDiff.x +
            (point.y - topLeft.y) * leftDiff.y >= -epsilon) &&

            ((point.x - bottomLeft.x) * leftDiff.x +
            (point.y - bottomLeft.y) * leftDiff.y <= epsilon);
    },
    toString: function() {
        return "[" +
            (Math.round(this.x * 100) / 100) + ", " +
            (Math.round(this.y * 100) / 100) + ", " +
            (Math.round(this.width * 100) / 100) + "x" +
            (Math.round(this.height * 100) / 100) + ", " +
            "]";
    }
};
}(OpenSeadragon));
