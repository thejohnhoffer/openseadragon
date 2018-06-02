

(function($){
$.EventSource = function() {
    this.events = {};
};
$.EventSource.prototype = {

    addHandler: function ( eventName, handler, userData ) {
        var events = this.events[ eventName ];
        if ( !events ) {
            this.events[ eventName ] = events = [];
        }
        if ( handler && $.isFunction( handler ) ) {
            events[ events.length ] = { handler: handler, userData: userData || null };
        }
    },
    removeHandler: function ( eventName, handler ) {
        var events = this.events[ eventName ],
            handlers = [],
            i;
        if ( !events ) {
            return;
        }
        if ( $.isArray( events ) ) {
            for ( i = 0; i < events.length; i++ ) {
                if ( events[i].handler !== handler ) {
                    handlers.push( events[ i ] );
                }
            }
            this.events[ eventName ] = handlers;
        }
    },
    removeAllHandlers: function( eventName ) {
        if ( eventName ){
            this.events[ eventName ] = [];
        } else{
            for ( var eventType in this.events ) {
                this.events[ eventType ] = [];
            }
        }
    },
    getHandler: function ( eventName ) {
        var events = this.events[ eventName ];
        if ( !events || !events.length ) {
            return null;
        }
        events = events.length === 1 ?
            [ events[ 0 ] ] :
            Array.apply( null, events );
        return function ( source, args ) {
            var i,
                length = events.length;
            for ( i = 0; i < length; i++ ) {
                if ( events[ i ] ) {
                    args.eventSource = source;
                    args.userData = events[ i ].userData;
                    events[ i ].handler( args );
                }
            }
        };
    },
    raiseEvent: function( eventName, eventArgs ) {
        //uncomment if you want to get a log of all events
        var handler = this.getHandler( eventName );

        if ( handler ) {
            if ( !eventArgs ) {
                eventArgs = {};
            }
            handler( this, eventArgs );
        }
    }
};
}( OpenSeadragon ));
