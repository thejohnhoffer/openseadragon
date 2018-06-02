

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
    $.console.assert(typeof options.springStiffness === "number" && options.springStiffness !== 0,
        "[OpenSeadragon.Spring] options.springStiffness must be a non-zero number");

    $.console.assert(typeof options.animationTime === "number" && options.animationTime >= 0,
        "[OpenSeadragon.Spring] options.animationTime must be a number greater than or equal to 0");

    if (options.exponential) {
        this._exponential = true;
        delete options.exponential;
    }
    $.extend( true, this, options);
    this.current = {
        value: typeof ( this.initial ) == "number" ?
            this.initial :
            (this._exponential ? 0 : 1),
        time: $.now() // always work in milliseconds
    };
    $.console.assert(!this._exponential || this.current.value !== 0,
        "[OpenSeadragon.Spring] value must be non-zero for exponential springs");
    this.start = {
        value: this.current.value,
        time: this.current.time
    };
    this.target = {
        value: this.current.value,
        time: this.current.time
    };
    if (this._exponential) {
        this.start._logValue = Math.log(this.start.value);
        this.target._logValue = Math.log(this.target.value);
        this.current._logValue = Math.log(this.current.value);
    }
};
$.Spring.prototype = {

    resetTo: function( target ) {
        $.console.assert(!this._exponential || target !== 0,
            "[OpenSeadragon.Spring.resetTo] target must be non-zero for exponential springs");

        this.start.value = this.target.value = this.current.value = target;
        this.start.time = this.target.time = this.current.time = $.now();

        if (this._exponential) {
            this.start._logValue = Math.log(this.start.value);
            this.target._logValue = Math.log(this.target.value);
            this.current._logValue = Math.log(this.current.value);
        }
    },
    springTo: function( target ) {
        $.console.assert(!this._exponential || target !== 0,
            "[OpenSeadragon.Spring.springTo] target must be non-zero for exponential springs");

        this.start.value = this.current.value;
        this.start.time = this.current.time;
        this.target.value = target;
        this.target.time = this.start.time + 1000 * this.animationTime;

        if (this._exponential) {
            this.start._logValue = Math.log(this.start.value);
            this.target._logValue = Math.log(this.target.value);
        }
    },
    shiftBy: function( delta ) {
        this.start.value += delta;
        this.target.value += delta;

        if (this._exponential) {
            $.console.assert(this.target.value !== 0 && this.start.value !== 0,
                "[OpenSeadragon.Spring.shiftBy] spring value must be non-zero for exponential springs");

            this.start._logValue = Math.log(this.start.value);
            this.target._logValue = Math.log(this.target.value);
        }
    },
    setExponential: function(value) {
        this._exponential = value;

        if (this._exponential) {
            $.console.assert(this.current.value !== 0 && this.target.value !== 0 && this.start.value !== 0,
                "[OpenSeadragon.Spring.setExponential] spring value must be non-zero for exponential springs");

            this.start._logValue = Math.log(this.start.value);
            this.target._logValue = Math.log(this.target.value);
            this.current._logValue = Math.log(this.current.value);
        }
    },
    update: function() {
        this.current.time = $.now();

        var startValue, targetValue;
        if (this._exponential) {
            startValue = this.start._logValue;
            targetValue = this.target._logValue;
        } else {
            startValue = this.start.value;
            targetValue = this.target.value;
        }
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
        if (this._exponential) {
            this.current.value = Math.exp(currentValue);
        } else {
            this.current.value = currentValue;
        }
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
