

(function( $ ){
$.Spring = function( options ) {
    var args = arguments;

    if( typeof ( options ) != 'object' ){
        //allows backward compatible use of ( initialValue, config ) as
        //constructor parameters
        options = {
            initial: args.length && typeof ( args[ 0 ] ) == "number" ?
                args[ 0 ] :
                undefined,

            springStiffness: args.length > 1 ?
                args[ 1 ].springStiffness :
                5.0,

            animationTime: args.length > 1 ?
                args[ 1 ].animationTime :
                1.5
        };
    }

    $.extend( true, this, options);
    this.current = {
        value: typeof ( this.initial ) == "number" ?
            this.initial : 1,
        time: $.now() // always work in milliseconds
    };
    this.start = {
        value: this.current.value,
        time: this.current.time
    };
    this.target = {
        value: this.current.value,
        time: this.current.time
    };
};
$.Spring.prototype = {

    resetTo: function( target ) {

        this.start.value = this.target.value = this.current.value = target;
        this.start.time = this.target.time = this.current.time = $.now();
    },
    springTo: function( target ) {

        this.start.value = this.current.value;
        this.start.time = this.current.time;
        this.target.value = target;
        this.target.time = this.start.time + 1000 * this.animationTime;
    },
    shiftBy: function( delta ) {
        this.start.value += delta;
        this.target.value += delta;
    },
    update: function() {
        this.current.time = $.now();

        var startValue = this.start.value;
        var targetValue = this.target.value;

        var currentValue = (this.current.time >= this.target.time) ?
            targetValue :
            startValue +
                ( targetValue - startValue ) *
                transform(
                    this.springStiffness,
                    ( this.current.time - this.start.time ) /
                    ( this.target.time - this.start.time )
                );

        var oldValue = this.current.value;
        this.current.value = currentValue;

        return oldValue != this.current.value;
    },
    isAtTargetValue: function() {
        return this.current.value === this.target.value;
    }
};
function transform( stiffness, x ) {
    return ( 1.0 - Math.exp( stiffness * -x ) ) /
        ( 1.0 - Math.exp( -stiffness ) );
}
}( OpenSeadragon ));
