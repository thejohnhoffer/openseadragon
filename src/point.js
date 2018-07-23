

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
    toString: function() {
        return "(" + (Math.round(this.x * 100) / 100) + "," + (Math.round(this.y * 100) / 100) + ")";
    }
};
}( OpenSeadragon ));
