

(function( $ ){
$.ButtonState = {
    REST: 0,
    GROUP: 1,
    HOVER: 2,
    DOWN: 3
};
$.Button = function( options ) {
    var _this = this;

    $.EventSource.call( this );

    $.extend( true, this, {
        tooltip: null,
        srcRest: null,
        srcGroup: null,
        srcHover: null,
        srcDown: null,
        clickTimeThreshold: $.DEFAULT_SETTINGS.clickTimeThreshold,
        clickDistThreshold: $.DEFAULT_SETTINGS.clickDistThreshold,

        fadeDelay: 0,

        fadeLength: 2000,
        onPress: null,
        onRelease: null,
        onClick: null,
        onEnter: null,
        onExit: null,
        onFocus: null,
        onBlur: null

    }, options );
    this.element = options.element || $.makeNeutralElement("div");

    //if the user has specified the element to bind the control to explicitly
    //then do not add the default control images
    if ( !options.element ) {
        this.imgRest = $.makeTransparentImage( this.srcRest );
        this.imgGroup = $.makeTransparentImage( this.srcGroup );
        this.imgHover = $.makeTransparentImage( this.srcHover );
        this.imgDown = $.makeTransparentImage( this.srcDown );

        this.imgRest.alt =
        this.imgGroup.alt =
        this.imgHover.alt =
        this.imgDown.alt =
            this.tooltip;

        this.element.style.position = "relative";
        $.setElementTouchActionNone( this.element );

        this.imgGroup.style.position =
        this.imgHover.style.position =
        this.imgDown.style.position =
            "absolute";

        this.imgGroup.style.top =
        this.imgHover.style.top =
        this.imgDown.style.top =
            "0px";

        this.imgGroup.style.left =
        this.imgHover.style.left =
        this.imgDown.style.left =
            "0px";

        this.imgHover.style.visibility =
        this.imgDown.style.visibility =
            "hidden";

        if ($.Browser.vendor == $.BROWSERS.FIREFOX && $.Browser.version < 3) {
            this.imgGroup.style.top =
            this.imgHover.style.top =
            this.imgDown.style.top =
                "";
        }
        this.element.appendChild( this.imgRest );
        this.element.appendChild( this.imgGroup );
        this.element.appendChild( this.imgHover );
        this.element.appendChild( this.imgDown );
    }
    this.addHandler("press", this.onPress);
    this.addHandler("release", this.onRelease);
    this.addHandler("click", this.onClick);
    this.addHandler("enter", this.onEnter);
    this.addHandler("exit", this.onExit);
    this.addHandler("focus", this.onFocus);
    this.addHandler("blur", this.onBlur);
    this.currentState = $.ButtonState.GROUP;

    // When the button last began to fade.
    this.fadeBeginTime = null;
    // Whether this button should fade after user stops interacting with the viewport.
    this.shouldFade = false;

    this.element.style.display = "inline-block";
    this.element.style.position = "relative";
    this.element.title = this.tooltip;
    this.tracker = new $.MouseTracker({
        element: this.element,
        clickTimeThreshold: this.clickTimeThreshold,
        clickDistThreshold: this.clickDistThreshold,

        enterHandler: function( event ) {
            if ( event.insideElementPressed ) {
                inTo( _this, $.ButtonState.DOWN );

                _this.raiseEvent( "enter", { originalEvent: event.originalEvent } );
            } else if ( !event.buttonDownAny ) {
                inTo( _this, $.ButtonState.HOVER );
            }
        },
        focusHandler: function ( event ) {
            this.enterHandler( event );

            _this.raiseEvent( "focus", { originalEvent: event.originalEvent } );
        },
        exitHandler: function( event ) {
            outTo( _this, $.ButtonState.GROUP );
            if ( event.insideElementPressed ) {
                _this.raiseEvent( "exit", { originalEvent: event.originalEvent } );
            }
        },
        blurHandler: function ( event ) {
            this.exitHandler( event );

            _this.raiseEvent( "blur", { originalEvent: event.originalEvent } );
        },
        pressHandler: function ( event ) {
            inTo( _this, $.ButtonState.DOWN );

            _this.raiseEvent( "press", { originalEvent: event.originalEvent } );
        },
        releaseHandler: function( event ) {
            if ( event.insideElementPressed && event.insideElementReleased ) {
                outTo( _this, $.ButtonState.HOVER );

                _this.raiseEvent( "release", { originalEvent: event.originalEvent } );
            } else if ( event.insideElementPressed ) {
                outTo( _this, $.ButtonState.GROUP );
            } else {
                inTo( _this, $.ButtonState.HOVER );
            }
        },
        clickHandler: function( event ) {
            if ( event.quick ) {
                _this.raiseEvent("click", { originalEvent: event.originalEvent });
            }
        },
        keyHandler: function( event ){
            //console.log( "%s : handling key %s!", _this.tooltip, event.keyCode);
            if( 13 === event.keyCode ){
                _this.raiseEvent( "click", { originalEvent: event.originalEvent } );
                _this.raiseEvent( "release", { originalEvent: event.originalEvent } );
                return false;
            }
            return true;
        }
    });
    outTo( this, $.ButtonState.REST );
};
$.extend( $.Button.prototype, $.EventSource.prototype, {

    notifyGroupEnter: function() {
        inTo( this, $.ButtonState.GROUP );
    },
    notifyGroupExit: function() {
        outTo( this, $.ButtonState.REST );
    },
    disable: function(){
        this.notifyGroupExit();
        this.element.disabled = true;
        $.setElementOpacity( this.element, 0.2, true );
    },
    enable: function(){
        this.element.disabled = false;
        $.setElementOpacity( this.element, 1.0, true );
        this.notifyGroupEnter();
    }
});
function scheduleFade( button ) {
    $.requestAnimationFrame(function(){
        updateFade( button );
    });
}
function updateFade( button ) {
    var currentTime,
        deltaTime,
        opacity;

    if ( button.shouldFade ) {
        currentTime = $.now();
        deltaTime = currentTime - button.fadeBeginTime;
        opacity = 1.0 - deltaTime / button.fadeLength;
        opacity = Math.min( 1.0, opacity );
        opacity = Math.max( 0.0, opacity );

        if( button.imgGroup ){
            $.setElementOpacity( button.imgGroup, opacity, true );
        }
        if ( opacity > 0 ) {
            // fade again
            scheduleFade( button );
        }
    }
}
function beginFading( button ) {
    button.shouldFade = true;
    button.fadeBeginTime = $.now() + button.fadeDelay;
    window.setTimeout( function(){
        scheduleFade( button );
    }, button.fadeDelay );
}
function stopFading( button ) {
    button.shouldFade = false;
    if( button.imgGroup ){
        $.setElementOpacity( button.imgGroup, 1.0, true );
    }
}
function inTo( button, newState ) {
    if( button.element.disabled ){
        return;
    }
    if ( newState >= $.ButtonState.GROUP &&
         button.currentState == $.ButtonState.REST ) {
        stopFading( button );
        button.currentState = $.ButtonState.GROUP;
    }
    if ( newState >= $.ButtonState.HOVER &&
         button.currentState == $.ButtonState.GROUP ) {
        if( button.imgHover ){
            button.imgHover.style.visibility = "";
        }
        button.currentState = $.ButtonState.HOVER;
    }
    if ( newState >= $.ButtonState.DOWN &&
         button.currentState == $.ButtonState.HOVER ) {
        if( button.imgDown ){
            button.imgDown.style.visibility = "";
        }
        button.currentState = $.ButtonState.DOWN;
    }
}
function outTo( button, newState ) {
    if( button.element.disabled ){
        return;
    }
    if ( newState <= $.ButtonState.HOVER &&
         button.currentState == $.ButtonState.DOWN ) {
        if( button.imgDown ){
            button.imgDown.style.visibility = "hidden";
        }
        button.currentState = $.ButtonState.HOVER;
    }
    if ( newState <= $.ButtonState.GROUP &&
         button.currentState == $.ButtonState.HOVER ) {
        if( button.imgHover ){
            button.imgHover.style.visibility = "hidden";
        }
        button.currentState = $.ButtonState.GROUP;
    }
    if ( newState <= $.ButtonState.REST &&
         button.currentState == $.ButtonState.GROUP ) {
        beginFading( button );
        button.currentState = $.ButtonState.REST;
    }
}
}( OpenSeadragon ));
