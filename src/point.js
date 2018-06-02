

(function( $ ){
$.Point = function( x, y ) {
    this.x = typeof ( x ) == "number" ? x : 0;

    this.y = typeof ( y ) == "number" ? y : 0;
};
$.Point.prototype = {
    clone: function() {
        return new $.Point(this.x, this.y);
    },
    plus: function( point ) {
        return new $.Point(
            this.x + point.x,
            this.y + point.y
        );
    },
    minus: function( point ) {
        return new $.Point(
            this.x - point.x,
            this.y - point.y
        );
    },
    times: function( factor ) {
        return new $.Point(
            this.x * factor,
            this.y * factor
        );
    },
    divide: function( factor ) {
        return new $.Point(
            this.x / factor,
            this.y / factor
        );
    },
    negate: function() {
        return new $.Point( -this.x, -this.y );
    },
    distanceTo: function( point ) {
        return Math.sqrt(
            Math.pow( this.x - point.x, 2 ) +
            Math.pow( this.y - point.y, 2 )
        );
    },
    squaredDistanceTo: function( point ) {
        return Math.pow( this.x - point.x, 2 ) +
            Math.pow( this.y - point.y, 2 );
    },
    apply: function( func ) {
        return new $.Point( func( this.x ), func( this.y ) );
    },
    equals: function( point ) {
        return (
            point instanceof $.Point
        ) && (
            this.x === point.x
        ) && (
            this.y === point.y
        );
    },
    rotate: function (degrees, pivot) {
        pivot = pivot || new $.Point(0, 0);
        var cos;
        var sin;
        // Avoid float computations when possible
        if (degrees % 90 === 0) {
            var d = $.positiveModulo(degrees, 360);
            switch (d) {
                case 0:
                    cos = 1;
                    sin = 0;
                    break;
                case 90:
                    cos = 0;
                    sin = 1;
                    break;
                case 180:
                    cos = -1;
                    sin = 0;
                    break;
                case 270:
                    cos = 0;
                    sin = -1;
                    break;
            }
        } else {
            var angle = degrees * Math.PI / 180.0;
            cos = Math.cos(angle);
            sin = Math.sin(angle);
        }
        var x = cos * (this.x - pivot.x) - sin * (this.y - pivot.y) + pivot.x;
        var y = sin * (this.x - pivot.x) + cos * (this.y - pivot.y) + pivot.y;
        return new $.Point(x, y);
    },
    toString: function() {
        return "(" + (Math.round(this.x * 100) / 100) + "," + (Math.round(this.y * 100) / 100) + ")";
    }
};
}( OpenSeadragon ));
