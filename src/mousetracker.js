

(function ( $ ) {
    // All MouseTracker instances
    var MOUSETRACKERS = [];

    // dictionary from hash to private properties
    var THIS = {};
    $.MouseTracker = function ( options ) {
        MOUSETRACKERS.push( this );

        var args = arguments;

        if ( !$.isPlainObject( options ) ) {
            options = {
                element: args[ 0 ],
                clickTimeThreshold: args[ 1 ],
                clickDistThreshold: args[ 2 ]
            };
        }
        this.hash = Math.random(); // An unique hash for this tracker.

        this.element = $.getElement( options.element );

        this.clickTimeThreshold = options.clickTimeThreshold || $.DEFAULT_SETTINGS.clickTimeThreshold;

        this.clickDistThreshold = options.clickDistThreshold || $.DEFAULT_SETTINGS.clickDistThreshold;

        this.dblClickTimeThreshold = options.dblClickTimeThreshold || $.DEFAULT_SETTINGS.dblClickTimeThreshold;

        this.dblClickDistThreshold = options.dblClickDistThreshold || $.DEFAULT_SETTINGS.dblClickDistThreshold;

        this.userData = options.userData || null;
        this.stopDelay = options.stopDelay || 50;

        this.enterHandler = options.enterHandler || null;
        this.exitHandler = options.exitHandler || null;
        this.pressHandler = options.pressHandler || null;
        this.nonPrimaryPressHandler = options.nonPrimaryPressHandler || null;
        this.releaseHandler = options.releaseHandler || null;
        this.nonPrimaryReleaseHandler = options.nonPrimaryReleaseHandler || null;
        this.moveHandler = options.moveHandler || null;
        this.scrollHandler = options.scrollHandler || null;
        this.clickHandler = options.clickHandler || null;
        this.dblClickHandler = options.dblClickHandler || null;
        this.dragHandler = options.dragHandler || null;
        this.dragEndHandler = options.dragEndHandler || null;
        this.pinchHandler = options.pinchHandler || null;
        this.stopHandler = options.stopHandler || null;
        this.keyDownHandler = options.keyDownHandler || null;
        this.keyUpHandler = options.keyUpHandler || null;
        this.keyHandler = options.keyHandler || null;
        this.focusHandler = options.focusHandler || null;
        this.blurHandler = options.blurHandler || null;

        //Store private properties in a scope sealed hash map
        var _this = this;
        THIS[ this.hash ] = {
            click: function ( event ) { onClick( _this, event ); },
            dblclick: function ( event ) { onDblClick( _this, event ); },
            keydown: function ( event ) { onKeyDown( _this, event ); },
            keyup: function ( event ) { onKeyUp( _this, event ); },
            keypress: function ( event ) { onKeyPress( _this, event ); },
            focus: function ( event ) { onFocus( _this, event ); },
            blur: function ( event ) { onBlur( _this, event ); },
            wheel: function ( event ) { onWheel( _this, event ); },
            mousewheel: function ( event ) { onMouseWheel( _this, event ); },
            DOMMouseScroll: function ( event ) { onMouseWheel( _this, event ); },
            MozMousePixelScroll: function ( event ) { onMouseWheel( _this, event ); },
            mouseenter: function ( event ) { onMouseEnter( _this, event ); }, // Used on IE8 only
            mouseleave: function ( event ) { onMouseLeave( _this, event ); }, // Used on IE8 only
            mouseover: function ( event ) { onMouseOver( _this, event ); },
            mouseout: function ( event ) { onMouseOut( _this, event ); },
            mousedown: function ( event ) { onMouseDown( _this, event ); },
            mouseup: function ( event ) { onMouseUp( _this, event ); },
            mouseupcaptured: function ( event ) { onMouseUpCaptured( _this, event ); },
            mousemove: function ( event ) { onMouseMove( _this, event ); },
            mousemovecaptured: function ( event ) { onMouseMoveCaptured( _this, event ); },
            touchstart: function ( event ) { onTouchStart( _this, event ); },
            touchend: function ( event ) { onTouchEnd( _this, event ); },
            touchendcaptured: function ( event ) { onTouchEndCaptured( _this, event ); },
            touchmove: function ( event ) { onTouchMove( _this, event ); },
            touchmovecaptured: function ( event ) { onTouchMoveCaptured( _this, event ); },
            touchcancel: function ( event ) { onTouchCancel( _this, event ); },
            gesturestart: function ( event ) { onGestureStart( _this, event ); },
            gesturechange: function ( event ) { onGestureChange( _this, event ); },
            pointerover: function ( event ) { onPointerOver( _this, event ); },
            MSPointerOver: function ( event ) { onPointerOver( _this, event ); },
            pointerout: function ( event ) { onPointerOut( _this, event ); },
            MSPointerOut: function ( event ) { onPointerOut( _this, event ); },
            pointerdown: function ( event ) { onPointerDown( _this, event ); },
            MSPointerDown: function ( event ) { onPointerDown( _this, event ); },
            pointerup: function ( event ) { onPointerUp( _this, event ); },
            MSPointerUp: function ( event ) { onPointerUp( _this, event ); },
            pointermove: function ( event ) { onPointerMove( _this, event ); },
            MSPointerMove: function ( event ) { onPointerMove( _this, event ); },
            pointercancel: function ( event ) { onPointerCancel( _this, event ); },
            MSPointerCancel: function ( event ) { onPointerCancel( _this, event ); },
            pointerupcaptured: function ( event ) { onPointerUpCaptured( _this, event ); },
            pointermovecaptured: function ( event ) { onPointerMoveCaptured( _this, event ); },
            tracking: false,

            // Active pointers lists. Array of GesturePointList objects, one for each pointer device type.
            // GesturePointList objects are added each time a pointer is tracked by a new pointer device type (see getActivePointersListByType()).
            // Active pointers are any pointer being tracked for this element which are in the hit-test area
            // of the element (for hover-capable devices) and/or have contact or a button press initiated in the element.
            activePointersLists: [],

            // Tracking for double-click gesture
            lastClickPos: null,
            dblClickTimeOut: null,

            // Tracking for pinch gesture
            pinchGPoints: [],
            lastPinchDist: 0,
            currentPinchDist: 0,
            lastPinchCenter: null,
            currentPinchCenter: null
        };
        if ( !options.startDisabled ) {
            this.setTracking( true );
        }
    };
    $.MouseTracker.prototype = {

        destroy: function () {
            var i;

            stopTracking( this );
            this.element = null;

            for ( i = 0; i < MOUSETRACKERS.length; i++ ) {
                if ( MOUSETRACKERS[ i ] === this ) {
                    MOUSETRACKERS.splice( i, 1 );
                    break;
                }
            }
            THIS[ this.hash ] = null;
            delete THIS[ this.hash ];
        },
        isTracking: function () {
            return THIS[ this.hash ].tracking;
        },
        setTracking: function ( track ) {
            if ( track ) {
                startTracking( this );
            } else {
                stopTracking( this );
            }
            //chain
            return this;
        },
        getActivePointersListsExceptType: function ( type ) {
            var delegate = THIS[ this.hash ];
            var listArray = [];

            for (var i = 0; i < delegate.activePointersLists.length; ++i) {
                if (delegate.activePointersLists[i].type !== type) {
                    listArray.push(delegate.activePointersLists[i]);
                }
            }
            return listArray;
        },
        getActivePointersListByType: function ( type ) {
            var delegate = THIS[ this.hash ],
                i,
                len = delegate.activePointersLists.length,
                list;

            for ( i = 0; i < len; i++ ) {
                if ( delegate.activePointersLists[ i ].type === type ) {
                    return delegate.activePointersLists[ i ];
                }
            }
            list = new $.MouseTracker.GesturePointList( type );
            delegate.activePointersLists.push( list );
            return list;
        },
        getActivePointerCount: function () {
            var delegate = THIS[ this.hash ],
                i,
                len = delegate.activePointersLists.length,
                count = 0;

            for ( i = 0; i < len; i++ ) {
                count += delegate.activePointersLists[ i ].getLength();
            }
            return count;
        },
        enterHandler: function () { },
        exitHandler: function () { },
        pressHandler: function () { },
        nonPrimaryPressHandler: function () { },
        releaseHandler: function () { },
        nonPrimaryReleaseHandler: function () { },
        moveHandler: function () { },
        scrollHandler: function () { },
        clickHandler: function () { },
        dblClickHandler: function () { },
        dragHandler: function () { },
        dragEndHandler: function () { },
        pinchHandler: function () { },
        stopHandler: function () { },
        keyDownHandler: function () { },
        keyUpHandler: function () { },
        keyHandler: function () { },
        focusHandler: function () { },
        blurHandler: function () { }
    };
    $.MouseTracker.resetAllMouseTrackers = function(){
        for(var i = 0; i < MOUSETRACKERS.length; i++){
            if (MOUSETRACKERS[i].isTracking()){
                MOUSETRACKERS[i].setTracking(false);
                MOUSETRACKERS[i].setTracking(true);
            }
        }
    };
    $.MouseTracker.gesturePointVelocityTracker = (function () {
        var trackerPoints = [],
            intervalId = 0,
            lastTime = 0;

        // Generates a unique identifier for a tracked gesture point
        var _generateGuid = function ( tracker, gPoint ) {
            return tracker.hash.toString() + gPoint.type + gPoint.id.toString();
        };
        // Interval timer callback. Computes velocity for all tracked gesture points.
        var _doTracking = function () {
            var i,
                len = trackerPoints.length,
                trackPoint,
                gPoint,
                now = $.now(),
                elapsedTime,
                distance,
                speed;

            elapsedTime = now - lastTime;
            lastTime = now;

            for ( i = 0; i < len; i++ ) {
                trackPoint = trackerPoints[ i ];
                gPoint = trackPoint.gPoint;
                // Math.atan2 gives us just what we need for a velocity vector, as we can simply
                // use cos()/sin() to extract the x/y velocity components.
                gPoint.direction = Math.atan2( gPoint.currentPos.y - trackPoint.lastPos.y, gPoint.currentPos.x - trackPoint.lastPos.x );
                // speed = distance / elapsed time
                distance = trackPoint.lastPos.distanceTo( gPoint.currentPos );
                trackPoint.lastPos = gPoint.currentPos;
                speed = 1000 * distance / ( elapsedTime + 1 );
                // Simple biased average, favors the most recent speed computation. Smooths out erratic gestures a bit.
                gPoint.speed = 0.75 * speed + 0.25 * gPoint.speed;
            }
        };
        // Public. Add a gesture point to be tracked
        var addPoint = function ( tracker, gPoint ) {
            var guid = _generateGuid( tracker, gPoint );

            trackerPoints.push(
                {
                    guid: guid,
                    gPoint: gPoint,
                    lastPos: gPoint.currentPos
                } );
            // Only fire up the interval timer when there's gesture pointers to track
            if ( trackerPoints.length === 1 ) {
                lastTime = $.now();
                intervalId = window.setInterval( _doTracking, 50 );
            }
        };
        // Public. Stop tracking a gesture point
        var removePoint = function ( tracker, gPoint ) {
            var guid = _generateGuid( tracker, gPoint ),
                i,
                len = trackerPoints.length;
            for ( i = 0; i < len; i++ ) {
                if ( trackerPoints[ i ].guid === guid ) {
                    trackerPoints.splice( i, 1 );
                    // Only run the interval timer if theres gesture pointers to track
                    len--;
                    if ( len === 0 ) {
                        window.clearInterval( intervalId );
                    }
                    break;
                }
            }
        };
        return {
            addPoint: addPoint,
            removePoint: removePoint
        };
    } )();
///////////////////////////////////////////////////////////////////////////////
// Pointer event model and feature detection
///////////////////////////////////////////////////////////////////////////////

    $.MouseTracker.captureElement = document;
    $.MouseTracker.wheelEventName = ( $.Browser.vendor == $.BROWSERS.IE && $.Browser.version > 8 ) ||
                                                ( 'onwheel' in document.createElement( 'div' ) ) ? 'wheel' : // Modern browsers support 'wheel'
                                    document.onmousewheel !== undefined ? 'mousewheel' : // Webkit and IE support at least 'mousewheel'
                                    'DOMMouseScroll'; // Assume old Firefox
    $.MouseTracker.supportsMouseCapture = (function () {
        var divElement = document.createElement( 'div' );
        return $.isFunction( divElement.setCapture ) && $.isFunction( divElement.releaseCapture );
    }());
    $.MouseTracker.subscribeEvents = [ "click", "dblclick", "keydown", "keyup", "keypress", "focus", "blur", $.MouseTracker.wheelEventName ];

    if( $.MouseTracker.wheelEventName == "DOMMouseScroll" ) {
        // Older Firefox
        $.MouseTracker.subscribeEvents.push( "MozMousePixelScroll" );
    }
    // Note: window.navigator.pointerEnable is deprecated on IE 11 and not part of W3C spec.
    if ( window.PointerEvent && ( window.navigator.pointerEnabled || $.Browser.vendor !== $.BROWSERS.IE ) ) {
        // IE11 and other W3C Pointer Event implementations (see http://www.w3.org/TR/pointerevents)
        $.MouseTracker.havePointerEvents = true;
        $.MouseTracker.subscribeEvents.push( "pointerover", "pointerout", "pointerdown", "pointerup", "pointermove", "pointercancel" );
        $.MouseTracker.unprefixedPointerEvents = true;
        if( navigator.maxTouchPoints ) {
            $.MouseTracker.maxTouchPoints = navigator.maxTouchPoints;
        } else {
            $.MouseTracker.maxTouchPoints = 0;
        }
        $.MouseTracker.haveMouseEnter = false;
    } else if ( window.MSPointerEvent && window.navigator.msPointerEnabled ) {
        // IE10
        $.MouseTracker.havePointerEvents = true;
        $.MouseTracker.subscribeEvents.push( "MSPointerOver", "MSPointerOut", "MSPointerDown", "MSPointerUp", "MSPointerMove", "MSPointerCancel" );
        $.MouseTracker.unprefixedPointerEvents = false;
        if( navigator.msMaxTouchPoints ) {
            $.MouseTracker.maxTouchPoints = navigator.msMaxTouchPoints;
        } else {
            $.MouseTracker.maxTouchPoints = 0;
        }
        $.MouseTracker.haveMouseEnter = false;
    } else {
        // Legacy W3C mouse events
        $.MouseTracker.havePointerEvents = false;
        if ( $.Browser.vendor === $.BROWSERS.IE && $.Browser.version < 9 ) {
            $.MouseTracker.subscribeEvents.push( "mouseenter", "mouseleave" );
            $.MouseTracker.haveMouseEnter = true;
        } else {
            $.MouseTracker.subscribeEvents.push( "mouseover", "mouseout" );
            $.MouseTracker.haveMouseEnter = false;
        }
        $.MouseTracker.subscribeEvents.push( "mousedown", "mouseup", "mousemove" );
        if ( 'ontouchstart' in window ) {
            // iOS, Android, and other W3c Touch Event implementations
            // (see http://www.w3.org/TR/touch-events/)
            // (see https://developer.apple.com/library/ios/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html)
            // (see https://developer.apple.com/library/safari/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html)
            $.MouseTracker.subscribeEvents.push( "touchstart", "touchend", "touchmove", "touchcancel" );
        }
        if ( 'ongesturestart' in window ) {
            // iOS (see https://developer.apple.com/library/ios/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html)
            // Subscribe to these to prevent default gesture handling
            $.MouseTracker.subscribeEvents.push( "gesturestart", "gesturechange" );
        }
        $.MouseTracker.mousePointerId = "legacy-mouse";
        $.MouseTracker.maxTouchPoints = 10;
    }
///////////////////////////////////////////////////////////////////////////////
// Classes and typedefs
///////////////////////////////////////////////////////////////////////////////
    $.MouseTracker.GesturePointList = function ( type ) {
        this._gPoints = [];

        this.type = type;

        this.buttons = 0;

        this.contacts = 0;

        this.clicks = 0;

        this.captureCount = 0;
    };
    $.MouseTracker.GesturePointList.prototype = {
        getLength: function () {
            return this._gPoints.length;
        },
        asArray: function () {
            return this._gPoints;
        },
        add: function ( gp ) {
            return this._gPoints.push( gp );
        },
        removeById: function ( id ) {
            var i,
                len = this._gPoints.length;
            for ( i = 0; i < len; i++ ) {
                if ( this._gPoints[ i ].id === id ) {
                    this._gPoints.splice( i, 1 );
                    break;
                }
            }
            return this._gPoints.length;
        },
        getByIndex: function ( index ) {
            if ( index < this._gPoints.length) {
                return this._gPoints[ index ];
            }
            return null;
        },
        getById: function ( id ) {
            var i,
                len = this._gPoints.length;
            for ( i = 0; i < len; i++ ) {
                if ( this._gPoints[ i ].id === id ) {
                    return this._gPoints[ i ];
                }
            }
            return null;
        },
        getPrimary: function ( id ) {
            var i,
                len = this._gPoints.length;
            for ( i = 0; i < len; i++ ) {
                if ( this._gPoints[ i ].isPrimary ) {
                    return this._gPoints[ i ];
                }
            }
            return null;
        },
        addContact: function() {
            ++this.contacts;

            if (this.contacts > 1 && (this.type === "mouse" || this.type === "pen")) {
                this.contacts = 1;
            }
        },
        removeContact: function() {
            --this.contacts;

            if (this.contacts < 0) {
                this.contacts = 0;
            }
        }
    };
///////////////////////////////////////////////////////////////////////////////
// Utility functions
///////////////////////////////////////////////////////////////////////////////
    function clearTrackedPointers( tracker ) {
        var delegate = THIS[ tracker.hash ],
            i,
            pointerListCount = delegate.activePointersLists.length;

        for ( i = 0; i < pointerListCount; i++ ) {
            if ( delegate.activePointersLists[ i ].captureCount > 0 ) {
                $.removeEvent(
                    $.MouseTracker.captureElement,
                    'mousemove',
                    delegate.mousemovecaptured,
                    true
                );
                $.removeEvent(
                    $.MouseTracker.captureElement,
                    'mouseup',
                    delegate.mouseupcaptured,
                    true
                );
                $.removeEvent(
                    $.MouseTracker.captureElement,
                    $.MouseTracker.unprefixedPointerEvents ? 'pointermove' : 'MSPointerMove',
                    delegate.pointermovecaptured,
                    true
                );
                $.removeEvent(
                    $.MouseTracker.captureElement,
                    $.MouseTracker.unprefixedPointerEvents ? 'pointerup' : 'MSPointerUp',
                    delegate.pointerupcaptured,
                    true
                );
                $.removeEvent(
                    $.MouseTracker.captureElement,
                    'touchmove',
                    delegate.touchmovecaptured,
                    true
                );
                $.removeEvent(
                    $.MouseTracker.captureElement,
                    'touchend',
                    delegate.touchendcaptured,
                    true
                );

                delegate.activePointersLists[ i ].captureCount = 0;
            }
        }
        for ( i = 0; i < pointerListCount; i++ ) {
            delegate.activePointersLists.pop();
        }
    }
    function startTracking( tracker ) {
        var delegate = THIS[ tracker.hash ],
            event,
            i;

        if ( !delegate.tracking ) {
            for ( i = 0; i < $.MouseTracker.subscribeEvents.length; i++ ) {
                event = $.MouseTracker.subscribeEvents[ i ];
                $.addEvent(
                    tracker.element,
                    event,
                    delegate[ event ],
                    false
                );
            }
            clearTrackedPointers( tracker );

            delegate.tracking = true;
        }
    }
    function stopTracking( tracker ) {
        var delegate = THIS[ tracker.hash ],
            event,
            i;

        if ( delegate.tracking ) {
            for ( i = 0; i < $.MouseTracker.subscribeEvents.length; i++ ) {
                event = $.MouseTracker.subscribeEvents[ i ];
                $.removeEvent(
                    tracker.element,
                    event,
                    delegate[ event ],
                    false
                );
            }
            clearTrackedPointers( tracker );

            delegate.tracking = false;
        }
    }
    function getCaptureEventParams( tracker, pointerType ) {
        var delegate = THIS[ tracker.hash ];

        if ( pointerType === 'pointerevent' ) {
            return {
                upName: $.MouseTracker.unprefixedPointerEvents ? 'pointerup' : 'MSPointerUp',
                upHandler: delegate.pointerupcaptured,
                moveName: $.MouseTracker.unprefixedPointerEvents ? 'pointermove' : 'MSPointerMove',
                moveHandler: delegate.pointermovecaptured
            };
        } else if ( pointerType === 'mouse' ) {
            return {
                upName: 'mouseup',
                upHandler: delegate.mouseupcaptured,
                moveName: 'mousemove',
                moveHandler: delegate.mousemovecaptured
            };
        } else if ( pointerType === 'touch' ) {
            return {
                upName: 'touchend',
                upHandler: delegate.touchendcaptured,
                moveName: 'touchmove',
                moveHandler: delegate.touchmovecaptured
            };
        } else {
            throw new Error( "MouseTracker.getCaptureEventParams: Unknown pointer type." );
        }
    }
    function capturePointer( tracker, pointerType, pointerCount ) {
        var pointsList = tracker.getActivePointersListByType( pointerType ),
            eventParams;

        pointsList.captureCount += (pointerCount || 1);

        if ( pointsList.captureCount === 1 ) {
            if ( $.Browser.vendor === $.BROWSERS.IE && $.Browser.version < 9 ) {
                tracker.element.setCapture( true );
            } else {
                eventParams = getCaptureEventParams( tracker, $.MouseTracker.havePointerEvents ? 'pointerevent' : pointerType );
                // We emulate mouse capture by hanging listeners on the document object.
                // (Note we listen on the capture phase so the captured handlers will get called first)
                // eslint-disable-next-line no-use-before-define
                if (isInIframe && canAccessEvents(window.top)) {
                    $.addEvent(
                        window.top,
                        eventParams.upName,
                        eventParams.upHandler,
                        true
                    );
                }
                $.addEvent(
                    $.MouseTracker.captureElement,
                    eventParams.upName,
                    eventParams.upHandler,
                    true
                );
                $.addEvent(
                    $.MouseTracker.captureElement,
                    eventParams.moveName,
                    eventParams.moveHandler,
                    true
                );
            }
        }
    }
    function releasePointer( tracker, pointerType, pointerCount ) {
        var pointsList = tracker.getActivePointersListByType( pointerType ),
            eventParams;

        pointsList.captureCount -= (pointerCount || 1);

        if ( pointsList.captureCount === 0 ) {
            if ( $.Browser.vendor === $.BROWSERS.IE && $.Browser.version < 9 ) {
                tracker.element.releaseCapture();
            } else {
                eventParams = getCaptureEventParams( tracker, $.MouseTracker.havePointerEvents ? 'pointerevent' : pointerType );
                // We emulate mouse capture by hanging listeners on the document object.
                // (Note we listen on the capture phase so the captured handlers will get called first)
                // eslint-disable-next-line no-use-before-define
                if (isInIframe && canAccessEvents(window.top)) {
                    $.removeEvent(
                        window.top,
                        eventParams.upName,
                        eventParams.upHandler,
                        true
                    );
                }
                $.removeEvent(
                    $.MouseTracker.captureElement,
                    eventParams.moveName,
                    eventParams.moveHandler,
                    true
                );
                $.removeEvent(
                    $.MouseTracker.captureElement,
                    eventParams.upName,
                    eventParams.upHandler,
                    true
                );
            }
        }
    }
    function getPointerType( event ) {
        var pointerTypeStr;
        if ( $.MouseTracker.unprefixedPointerEvents ) {
            pointerTypeStr = event.pointerType;
        } else {
            // IE10
            // MSPOINTER_TYPE_TOUCH: 0x00000002
            // MSPOINTER_TYPE_PEN: 0x00000003
            // MSPOINTER_TYPE_MOUSE: 0x00000004
            switch( event.pointerType )
            {
                case 0x00000002:
                    pointerTypeStr = 'touch';
                    break;
                case 0x00000003:
                    pointerTypeStr = 'pen';
                    break;
                case 0x00000004:
                    pointerTypeStr = 'mouse';
                    break;
                default:
                    pointerTypeStr = '';
            }
        }
        return pointerTypeStr;
    }
    function getMouseAbsolute( event ) {
        return $.getMousePosition( event );
    }
    function getMouseRelative( event, element ) {
        return getPointRelativeToAbsolute( getMouseAbsolute( event ), element );
    }
    function getPointRelativeToAbsolute( point, element ) {
        var offset = $.getElementOffset( element );
        return point.minus( offset );
    }
    function getCenterPoint( point1, point2 ) {
        return new $.Point( ( point1.x + point2.x ) / 2, ( point1.y + point2.y ) / 2 );
    }
///////////////////////////////////////////////////////////////////////////////
// Device-specific DOM event handlers
///////////////////////////////////////////////////////////////////////////////
    function onClick( tracker, event ) {
        if ( tracker.clickHandler ) {
            $.cancelEvent( event );
        }
    }
    function onDblClick( tracker, event ) {
        if ( tracker.dblClickHandler ) {
            $.cancelEvent( event );
        }
    }
    function onKeyDown( tracker, event ) {
        //$.console.log( "keydown %s %s %s %s %s", event.keyCode, event.charCode, event.ctrlKey, event.shiftKey, event.altKey );
        var propagate;
        if ( tracker.keyDownHandler ) {
            event = $.getEvent( event );
            propagate = tracker.keyDownHandler(
                {
                    eventSource: tracker,
                    keyCode: event.keyCode ? event.keyCode : event.charCode,
                    ctrl: event.ctrlKey,
                    shift: event.shiftKey,
                    alt: event.altKey,
                    meta: event.metaKey,
                    originalEvent: event,
                    preventDefaultAction: false,
                    userData: tracker.userData
                }
            );
            if ( !propagate ) {
                $.cancelEvent( event );
            }
        }
    }
    function onKeyUp( tracker, event ) {
        //$.console.log( "keyup %s %s %s %s %s", event.keyCode, event.charCode, event.ctrlKey, event.shiftKey, event.altKey );
        var propagate;
        if ( tracker.keyUpHandler ) {
            event = $.getEvent( event );
            propagate = tracker.keyUpHandler(
                {
                    eventSource: tracker,
                    keyCode: event.keyCode ? event.keyCode : event.charCode,
                    ctrl: event.ctrlKey,
                    shift: event.shiftKey,
                    alt: event.altKey,
                    meta: event.metaKey,
                    originalEvent: event,
                    preventDefaultAction: false,
                    userData: tracker.userData
                }
            );
            if ( !propagate ) {
                $.cancelEvent( event );
            }
        }
    }
    function onKeyPress( tracker, event ) {
        //$.console.log( "keypress %s %s %s %s %s", event.keyCode, event.charCode, event.ctrlKey, event.shiftKey, event.altKey );
        var propagate;
        if ( tracker.keyHandler ) {
            event = $.getEvent( event );
            propagate = tracker.keyHandler(
                {
                    eventSource: tracker,
                    keyCode: event.keyCode ? event.keyCode : event.charCode,
                    ctrl: event.ctrlKey,
                    shift: event.shiftKey,
                    alt: event.altKey,
                    meta: event.metaKey,
                    originalEvent: event,
                    preventDefaultAction: false,
                    userData: tracker.userData
                }
            );
            if ( !propagate ) {
                $.cancelEvent( event );
            }
        }
    }
    function onFocus( tracker, event ) {
        //console.log( "focus %s", event );
        var propagate;
        if ( tracker.focusHandler ) {
            event = $.getEvent( event );
            propagate = tracker.focusHandler(
                {
                    eventSource: tracker,
                    originalEvent: event,
                    preventDefaultAction: false,
                    userData: tracker.userData
                }
            );
            if ( propagate === false ) {
                $.cancelEvent( event );
            }
        }
    }
    function onBlur( tracker, event ) {
        //console.log( "blur %s", event );
        var propagate;
        if ( tracker.blurHandler ) {
            event = $.getEvent( event );
            propagate = tracker.blurHandler(
                {
                    eventSource: tracker,
                    originalEvent: event,
                    preventDefaultAction: false,
                    userData: tracker.userData
                }
            );
            if ( propagate === false ) {
                $.cancelEvent( event );
            }
        }
    }
    function onWheel( tracker, event ) {
        handleWheelEvent( tracker, event, event );
    }
    function onMouseWheel( tracker, event ) {
        event = $.getEvent( event );

        // Simulate a 'wheel' event
        var simulatedEvent = {
            target: event.target || event.srcElement,
            type: "wheel",
            shiftKey: event.shiftKey || false,
            clientX: event.clientX,
            clientY: event.clientY,
            pageX: event.pageX ? event.pageX : event.clientX,
            pageY: event.pageY ? event.pageY : event.clientY,
            deltaMode: event.type == "MozMousePixelScroll" ? 0 : 1, // 0=pixel, 1=line, 2=page
            deltaX: 0,
            deltaZ: 0
        };
        // Calculate deltaY
        if ( $.MouseTracker.wheelEventName == "mousewheel" ) {
            simulatedEvent.deltaY = -event.wheelDelta / $.DEFAULT_SETTINGS.pixelsPerWheelLine;
        } else {
            simulatedEvent.deltaY = event.detail;
        }
        handleWheelEvent( tracker, simulatedEvent, event );
    }
    function handleWheelEvent( tracker, event, originalEvent ) {
        var nDelta = 0,
            propagate;

        // The nDelta variable is gated to provide smooth z-index scrolling
        // since the mouse wheel allows for substantial deltas meant for rapid
        // y-index scrolling.
        // event.deltaMode: 0=pixel, 1=line, 2=page
        // TODO: Deltas in pixel mode should be accumulated then a scroll value computed after $.DEFAULT_SETTINGS.pixelsPerWheelLine threshold reached
        nDelta = event.deltaY < 0 ? 1 : -1;

        if ( tracker.scrollHandler ) {
            propagate = tracker.scrollHandler(
                {
                    eventSource: tracker,
                    pointerType: 'mouse',
                    position: getMouseRelative( event, tracker.element ),
                    scroll: nDelta,
                    shift: event.shiftKey,
                    isTouchEvent: false,
                    originalEvent: originalEvent,
                    preventDefaultAction: false,
                    userData: tracker.userData
                }
            );
            if ( propagate === false ) {
                $.cancelEvent( originalEvent );
            }
        }
    }
    function isParentChild( parent, child )
    {
       if ( parent === child ) {
           return false;
       }
       while ( child && child !== parent ) {
           child = child.parentNode;
       }
       return child === parent;
    }
    function onMouseEnter( tracker, event ) {
        event = $.getEvent( event );

        handleMouseEnter( tracker, event );
    }
    function onMouseOver( tracker, event ) {
        event = $.getEvent( event );

        if ( event.currentTarget === event.relatedTarget || isParentChild( event.currentTarget, event.relatedTarget ) ) {
            return;
        }
        handleMouseEnter( tracker, event );
    }
    function handleMouseEnter( tracker, event ) {
        var gPoint = {
            id: $.MouseTracker.mousePointerId,
            type: 'mouse',
            isPrimary: true,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        updatePointersEnter( tracker, event, [ gPoint ] );
    }
    function onMouseLeave( tracker, event ) {
        event = $.getEvent( event );

        handleMouseExit( tracker, event );
    }
    function onMouseOut( tracker, event ) {
        event = $.getEvent( event );

        if ( event.currentTarget === event.relatedTarget || isParentChild( event.currentTarget, event.relatedTarget ) ) {
            return;
        }
        handleMouseExit( tracker, event );
    }
    function handleMouseExit( tracker, event ) {
        var gPoint = {
            id: $.MouseTracker.mousePointerId,
            type: 'mouse',
            isPrimary: true,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        updatePointersExit( tracker, event, [ gPoint ] );
    }
    function getStandardizedButton( button ) {
        if ( $.Browser.vendor === $.BROWSERS.IE && $.Browser.version < 9 ) {
            // On IE 8, 0 == none, 1 == left, 2 == right, 3 == left and right, 4 == middle, 5 == left and middle, 6 == right and middle, 7 == all three
            // TODO: Support chorded (multiple) button presses on IE 8?
            if ( button === 1 ) {
                return 0;
            } else if ( button === 2 ) {
                return 2;
            } else if ( button === 4 ) {
                return 1;
            } else {
                return -1;
            }
        } else {
            return button;
        }
    }
    function onMouseDown( tracker, event ) {
        var gPoint;

        event = $.getEvent( event );

        gPoint = {
            id: $.MouseTracker.mousePointerId,
            type: 'mouse',
            isPrimary: true,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        if ( updatePointersDown( tracker, event, [ gPoint ], getStandardizedButton( event.button ) ) ) {
            $.stopEvent( event );
            capturePointer( tracker, 'mouse' );
        }
        if ( tracker.clickHandler || tracker.dblClickHandler || tracker.pressHandler || tracker.dragHandler || tracker.dragEndHandler ) {
            $.cancelEvent( event );
        }
    }
    function onMouseUp( tracker, event ) {
        handleMouseUp( tracker, event );
    }
    function onMouseUpCaptured( tracker, event ) {
        handleMouseUp( tracker, event );
        $.stopEvent( event );
    }
    function handleMouseUp( tracker, event ) {
        var gPoint;

        event = $.getEvent( event );

        gPoint = {
            id: $.MouseTracker.mousePointerId,
            type: 'mouse',
            isPrimary: true,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        if ( updatePointersUp( tracker, event, [ gPoint ], getStandardizedButton( event.button ) ) ) {
            releasePointer( tracker, 'mouse' );
        }
    }
    function onMouseMove( tracker, event ) {
        handleMouseMove( tracker, event );
   }
    function onMouseMoveCaptured( tracker, event ) {
        handleMouseMove( tracker, event );
        $.stopEvent( event );
    }
    function handleMouseMove( tracker, event ) {
        var gPoint;

        event = $.getEvent( event );

        gPoint = {
            id: $.MouseTracker.mousePointerId,
            type: 'mouse',
            isPrimary: true,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        updatePointersMove( tracker, event, [ gPoint ] );
    }
    function abortContacts( tracker, event, pointsList ) {
        var i,
            gPointCount = pointsList.getLength(),
            abortGPoints = [];

        // Check contact count for hoverable pointer types before aborting
        if (pointsList.type === 'touch' || pointsList.contacts > 0) {
            for ( i = 0; i < gPointCount; i++ ) {
                abortGPoints.push( pointsList.getByIndex( i ) );
            }
            if ( abortGPoints.length > 0 ) {
                // simulate touchend/mouseup
                updatePointersUp( tracker, event, abortGPoints, 0 ); // 0 means primary button press/release or touch contact
                // release pointer capture
                pointsList.captureCount = 1;
                releasePointer( tracker, pointsList.type );
                // simulate touchleave/mouseout
                updatePointersExit( tracker, event, abortGPoints );
            }
        }
    }
    function onTouchStart( tracker, event ) {
        var time,
            i,
            j,
            touchCount = event.changedTouches.length,
            gPoints = [],
            parentGPoints,
            pointsList = tracker.getActivePointersListByType( 'touch' );

        time = $.now();

        if ( pointsList.getLength() > event.touches.length - touchCount ) {
            $.console.warn('Tracked touch contact count doesn\'t match event.touches.length. Removing all tracked touch pointers.');
            abortContacts( tracker, event, pointsList );
        }
        for ( i = 0; i < touchCount; i++ ) {
            gPoints.push( {
                id: event.changedTouches[ i ].identifier,
                type: 'touch',
                // isPrimary not set - let the updatePointers functions determine it
                currentPos: getMouseAbsolute( event.changedTouches[ i ] ),
                currentTime: time
            } );
        }
        // simulate touchenter on our tracked element
        updatePointersEnter( tracker, event, gPoints );

        // simulate touchenter on our tracked element's tracked ancestor elements
        for ( i = 0; i < MOUSETRACKERS.length; i++ ) {
            if ( MOUSETRACKERS[ i ] !== tracker && MOUSETRACKERS[ i ].isTracking() && isParentChild( MOUSETRACKERS[ i ].element, tracker.element ) ) {
                parentGPoints = [];
                for ( j = 0; j < touchCount; j++ ) {
                    parentGPoints.push( {
                        id: event.changedTouches[ j ].identifier,
                        type: 'touch',
                        // isPrimary not set - let the updatePointers functions determine it
                        currentPos: getMouseAbsolute( event.changedTouches[ j ] ),
                        currentTime: time
                    } );
                }
                updatePointersEnter( MOUSETRACKERS[ i ], event, parentGPoints );
            }
        }
        if ( updatePointersDown( tracker, event, gPoints, 0 ) ) { // 0 means primary button press/release or touch contact
            $.stopEvent( event );
            capturePointer( tracker, 'touch', touchCount );
        }
        $.cancelEvent( event );
    }
    function onTouchEnd( tracker, event ) {
        handleTouchEnd( tracker, event );
    }
    function onTouchEndCaptured( tracker, event ) {
        handleTouchEnd( tracker, event );
        $.stopEvent( event );
    }
    function handleTouchEnd( tracker, event ) {
        var time,
            i,
            j,
            touchCount = event.changedTouches.length,
            gPoints = [],
            parentGPoints;

        time = $.now();

        for ( i = 0; i < touchCount; i++ ) {
            gPoints.push( {
                id: event.changedTouches[ i ].identifier,
                type: 'touch',
                // isPrimary not set - let the updatePointers functions determine it
                currentPos: getMouseAbsolute( event.changedTouches[ i ] ),
                currentTime: time
            } );
        }
        if ( updatePointersUp( tracker, event, gPoints, 0 ) ) {
            releasePointer( tracker, 'touch', touchCount );
        }
        // simulate touchleave on our tracked element
        updatePointersExit( tracker, event, gPoints );

        // simulate touchleave on our tracked element's tracked ancestor elements
        for ( i = 0; i < MOUSETRACKERS.length; i++ ) {
            if ( MOUSETRACKERS[ i ] !== tracker && MOUSETRACKERS[ i ].isTracking() && isParentChild( MOUSETRACKERS[ i ].element, tracker.element ) ) {
                parentGPoints = [];
                for ( j = 0; j < touchCount; j++ ) {
                    parentGPoints.push( {
                        id: event.changedTouches[ j ].identifier,
                        type: 'touch',
                        // isPrimary not set - let the updatePointers functions determine it
                        currentPos: getMouseAbsolute( event.changedTouches[ j ] ),
                        currentTime: time
                    } );
                }
                updatePointersExit( MOUSETRACKERS[ i ], event, parentGPoints );
            }
        }
        $.cancelEvent( event );
    }
    function onTouchMove( tracker, event ) {
        handleTouchMove( tracker, event );
    }
    function onTouchMoveCaptured( tracker, event ) {
        handleTouchMove( tracker, event );
        $.stopEvent( event );
    }
    function handleTouchMove( tracker, event ) {
        var i,
            touchCount = event.changedTouches.length,
            gPoints = [];

        for ( i = 0; i < touchCount; i++ ) {
            gPoints.push( {
                id: event.changedTouches[ i ].identifier,
                type: 'touch',
                // isPrimary not set - let the updatePointers functions determine it
                currentPos: getMouseAbsolute( event.changedTouches[ i ] ),
                currentTime: $.now()
            } );
        }
        updatePointersMove( tracker, event, gPoints );

        $.cancelEvent( event );
    }
    function onTouchCancel( tracker, event ) {
        var pointsList = tracker.getActivePointersListByType('touch');

        abortContacts( tracker, event, pointsList );
    }
    function onGestureStart( tracker, event ) {
        event.stopPropagation();
        event.preventDefault();
        return false;
    }
    function onGestureChange( tracker, event ) {
        event.stopPropagation();
        event.preventDefault();
        return false;
    }
    function onPointerOver( tracker, event ) {
        var gPoint;

        if ( event.currentTarget === event.relatedTarget || isParentChild( event.currentTarget, event.relatedTarget ) ) {
            return;
        }
        gPoint = {
            id: event.pointerId,
            type: getPointerType( event ),
            isPrimary: event.isPrimary,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        updatePointersEnter( tracker, event, [ gPoint ] );
    }
    function onPointerOut( tracker, event ) {
        var gPoint;

        if ( event.currentTarget === event.relatedTarget || isParentChild( event.currentTarget, event.relatedTarget ) ) {
            return;
        }
        gPoint = {
            id: event.pointerId,
            type: getPointerType( event ),
            isPrimary: event.isPrimary,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        updatePointersExit( tracker, event, [ gPoint ] );
    }
    function onPointerDown( tracker, event ) {
        var gPoint;

        gPoint = {
            id: event.pointerId,
            type: getPointerType( event ),
            isPrimary: event.isPrimary,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        if ( updatePointersDown( tracker, event, [ gPoint ], event.button ) ) {
            $.stopEvent( event );
            capturePointer( tracker, gPoint.type );
        }
        if ( tracker.clickHandler || tracker.dblClickHandler || tracker.pressHandler || tracker.dragHandler || tracker.dragEndHandler || tracker.pinchHandler ) {
            $.cancelEvent( event );
        }
    }
    function onPointerUp( tracker, event ) {
        handlePointerUp( tracker, event );
    }
    function onPointerUpCaptured( tracker, event ) {
        var pointsList = tracker.getActivePointersListByType( getPointerType( event ) );
        if ( pointsList.getById( event.pointerId ) ) {
            handlePointerUp( tracker, event );
        }
        $.stopEvent( event );
    }
    function handlePointerUp( tracker, event ) {
        var gPoint;

        gPoint = {
            id: event.pointerId,
            type: getPointerType( event ),
            isPrimary: event.isPrimary,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        if ( updatePointersUp( tracker, event, [ gPoint ], event.button ) ) {
            releasePointer( tracker, gPoint.type );
        }
    }
    function onPointerMove( tracker, event ) {
        handlePointerMove( tracker, event );
    }
    function onPointerMoveCaptured( tracker, event ) {
        var pointsList = tracker.getActivePointersListByType( getPointerType( event ) );
        if ( pointsList.getById( event.pointerId ) ) {
            handlePointerMove( tracker, event );
        }
        $.stopEvent( event );
    }
    function handlePointerMove( tracker, event ) {
        // Pointer changed coordinates, button state, pressure, tilt, or contact geometry (e.g. width and height)
        var gPoint;

        gPoint = {
            id: event.pointerId,
            type: getPointerType( event ),
            isPrimary: event.isPrimary,
            currentPos: getMouseAbsolute( event ),
            currentTime: $.now()
        };
        updatePointersMove( tracker, event, [ gPoint ] );
    }
    function onPointerCancel( tracker, event ) {
        var gPoint;

        gPoint = {
            id: event.pointerId,
            type: getPointerType( event )
        };
        updatePointersCancel( tracker, event, [ gPoint ] );
    }
///////////////////////////////////////////////////////////////////////////////
// Device-agnostic DOM event handlers
///////////////////////////////////////////////////////////////////////////////
    function startTrackingPointer( pointsList, gPoint ) {
        // If isPrimary is not known for the pointer then set it according to our rules:
        // true if the first pointer in the gesture, otherwise false
        if ( !gPoint.hasOwnProperty( 'isPrimary' ) ) {
            if ( pointsList.getLength() === 0 ) {
                gPoint.isPrimary = true;
            } else {
                gPoint.isPrimary = false;
            }
        }
        gPoint.speed = 0;
        gPoint.direction = 0;
        gPoint.contactPos = gPoint.currentPos;
        gPoint.contactTime = gPoint.currentTime;
        gPoint.lastPos = gPoint.currentPos;
        gPoint.lastTime = gPoint.currentTime;

        return pointsList.add( gPoint );
    }
    function stopTrackingPointer( pointsList, gPoint ) {
        var listLength,
            primaryPoint;

        if ( pointsList.getById( gPoint.id ) ) {
            listLength = pointsList.removeById( gPoint.id );

            // If isPrimary is not known for the pointer and we just removed the primary pointer from the list then we need to set another pointer as primary
            if ( !gPoint.hasOwnProperty( 'isPrimary' ) ) {
                primaryPoint = pointsList.getPrimary();
                if ( !primaryPoint ) {
                    primaryPoint = pointsList.getByIndex( 0 );
                    if ( primaryPoint ) {
                        primaryPoint.isPrimary = true;
                    }
                }
            }
        } else {
            listLength = pointsList.getLength();
        }
        return listLength;
    }
    function updatePointersEnter( tracker, event, gPoints ) {
        var pointsList = tracker.getActivePointersListByType( gPoints[ 0 ].type ),
            i,
            gPointCount = gPoints.length,
            curGPoint,
            updateGPoint,
            propagate;

        for ( i = 0; i < gPointCount; i++ ) {
            curGPoint = gPoints[ i ];
            updateGPoint = pointsList.getById( curGPoint.id );

            if ( updateGPoint ) {
                // Already tracking the pointer...update it
                updateGPoint.insideElement = true;
                updateGPoint.lastPos = updateGPoint.currentPos;
                updateGPoint.lastTime = updateGPoint.currentTime;
                updateGPoint.currentPos = curGPoint.currentPos;
                updateGPoint.currentTime = curGPoint.currentTime;

                curGPoint = updateGPoint;
            } else {
                // Initialize for tracking and add to the tracking list
                curGPoint.captured = false;
                curGPoint.insideElementPressed = false;
                curGPoint.insideElement = true;
                startTrackingPointer( pointsList, curGPoint );
            }
            // Enter
            if ( tracker.enterHandler ) {
                propagate = tracker.enterHandler(
                    {
                        eventSource: tracker,
                        pointerType: curGPoint.type,
                        position: getPointRelativeToAbsolute( curGPoint.currentPos, tracker.element ),
                        buttons: pointsList.buttons,
                        pointers: tracker.getActivePointerCount(),
                        insideElementPressed: curGPoint.insideElementPressed,
                        buttonDownAny: pointsList.buttons !== 0,
                        isTouchEvent: curGPoint.type === 'touch',
                        originalEvent: event,
                        preventDefaultAction: false,
                        userData: tracker.userData
                    }
                );
                if ( propagate === false ) {
                    $.cancelEvent( event );
                }
            }
        }
    }
    function updatePointersExit( tracker, event, gPoints ) {
        var pointsList = tracker.getActivePointersListByType(gPoints[0].type),
            i,
            gPointCount = gPoints.length,
            curGPoint,
            updateGPoint,
            propagate;

        for ( i = 0; i < gPointCount; i++ ) {
            curGPoint = gPoints[ i ];
            updateGPoint = pointsList.getById( curGPoint.id );

            if ( updateGPoint ) {
                // Already tracking the pointer. If captured then update it, else stop tracking it
                if ( updateGPoint.captured ) {
                    updateGPoint.insideElement = false;
                    updateGPoint.lastPos = updateGPoint.currentPos;
                    updateGPoint.lastTime = updateGPoint.currentTime;
                    updateGPoint.currentPos = curGPoint.currentPos;
                    updateGPoint.currentTime = curGPoint.currentTime;
                } else {
                    stopTrackingPointer( pointsList, updateGPoint );
                }
                curGPoint = updateGPoint;
            }
            // Exit
            if ( tracker.exitHandler ) {
                propagate = tracker.exitHandler(
                    {
                        eventSource: tracker,
                        pointerType: curGPoint.type,
                        position: getPointRelativeToAbsolute( curGPoint.currentPos, tracker.element ),
                        buttons: pointsList.buttons,
                        pointers: tracker.getActivePointerCount(),
                        insideElementPressed: updateGPoint ? updateGPoint.insideElementPressed : false,
                        buttonDownAny: pointsList.buttons !== 0,
                        isTouchEvent: curGPoint.type === 'touch',
                        originalEvent: event,
                        preventDefaultAction: false,
                        userData: tracker.userData
                    }
                );

                if ( propagate === false ) {
                    $.cancelEvent( event );
                }
            }
        }
    }
    function updatePointersDown( tracker, event, gPoints, buttonChanged ) {
        var delegate = THIS[ tracker.hash ],
            propagate,
            pointsList = tracker.getActivePointersListByType( gPoints[ 0 ].type ),
            i,
            gPointCount = gPoints.length,
            curGPoint,
            updateGPoint;

        if ( typeof event.buttons !== 'undefined' ) {
            pointsList.buttons = event.buttons;
        } else {
            if ( $.Browser.vendor === $.BROWSERS.IE && $.Browser.version < 9 ) {
                if ( buttonChanged === 0 ) {
                    // Primary
                    pointsList.buttons += 1;
                } else if ( buttonChanged === 1 ) {
                    // Aux
                    pointsList.buttons += 4;
                } else if ( buttonChanged === 2 ) {
                    // Secondary
                    pointsList.buttons += 2;
                } else if ( buttonChanged === 3 ) {
                    // X1 (Back)
                    pointsList.buttons += 8;
                } else if ( buttonChanged === 4 ) {
                    // X2 (Forward)
                    pointsList.buttons += 16;
                } else if ( buttonChanged === 5 ) {
                    // Pen Eraser
                    pointsList.buttons += 32;
                }
            } else {
                if ( buttonChanged === 0 ) {
                    // Primary
                    pointsList.buttons |= 1;
                } else if ( buttonChanged === 1 ) {
                    // Aux
                    pointsList.buttons |= 4;
                } else if ( buttonChanged === 2 ) {
                    // Secondary
                    pointsList.buttons |= 2;
                } else if ( buttonChanged === 3 ) {
                    // X1 (Back)
                    pointsList.buttons |= 8;
                } else if ( buttonChanged === 4 ) {
                    // X2 (Forward)
                    pointsList.buttons |= 16;
                } else if ( buttonChanged === 5 ) {
                    // Pen Eraser
                    pointsList.buttons |= 32;
                }
            }
        }
        // Some pointers may steal control from another pointer without firing the appropriate release events
        // e.g. Touching a screen while click-dragging with certain mice.
        var otherPointsLists = tracker.getActivePointersListsExceptType(gPoints[ 0 ].type);
        for (i = 0; i < otherPointsLists.length; i++) {
            //If another pointer has contact, simulate the release
            abortContacts(tracker, event, otherPointsLists[i]); // No-op if no active pointer
        }
        // Only capture and track primary button, pen, and touch contacts
        if ( buttonChanged !== 0 ) {
            // Aux Press
            if ( tracker.nonPrimaryPressHandler ) {
                propagate = tracker.nonPrimaryPressHandler(
                    {
                        eventSource: tracker,
                        pointerType: gPoints[ 0 ].type,
                        position: getPointRelativeToAbsolute( gPoints[ 0 ].currentPos, tracker.element ),
                        button: buttonChanged,
                        buttons: pointsList.buttons,
                        isTouchEvent: gPoints[ 0 ].type === 'touch',
                        originalEvent: event,
                        preventDefaultAction: false,
                        userData: tracker.userData
                    }
                );
                if ( propagate === false ) {
                    $.cancelEvent( event );
                }
            }
            return false;
        }
        for ( i = 0; i < gPointCount; i++ ) {
            curGPoint = gPoints[ i ];
            updateGPoint = pointsList.getById( curGPoint.id );

            if ( updateGPoint ) {
                // Already tracking the pointer...update it
                updateGPoint.captured = true;
                updateGPoint.insideElementPressed = true;
                updateGPoint.insideElement = true;
                updateGPoint.contactPos = curGPoint.currentPos;
                updateGPoint.contactTime = curGPoint.currentTime;
                updateGPoint.lastPos = updateGPoint.currentPos;
                updateGPoint.lastTime = updateGPoint.currentTime;
                updateGPoint.currentPos = curGPoint.currentPos;
                updateGPoint.currentTime = curGPoint.currentTime;

                curGPoint = updateGPoint;
            } else {
                // Initialize for tracking and add to the tracking list (no pointerover or pointermove event occurred before this)
                curGPoint.captured = true;
                curGPoint.insideElementPressed = true;
                curGPoint.insideElement = true;
                startTrackingPointer( pointsList, curGPoint );
            }
            pointsList.addContact();
            //$.console.log('contacts++ ', pointsList.contacts);

            if ( tracker.dragHandler || tracker.dragEndHandler || tracker.pinchHandler ) {
                $.MouseTracker.gesturePointVelocityTracker.addPoint( tracker, curGPoint );
            }
            if ( pointsList.contacts === 1 ) {
                // Press
                if ( tracker.pressHandler ) {
                    propagate = tracker.pressHandler(
                        {
                            eventSource: tracker,
                            pointerType: curGPoint.type,
                            position: getPointRelativeToAbsolute( curGPoint.contactPos, tracker.element ),
                            buttons: pointsList.buttons,
                            isTouchEvent: curGPoint.type === 'touch',
                            originalEvent: event,
                            preventDefaultAction: false,
                            userData: tracker.userData
                        }
                    );
                    if ( propagate === false ) {
                        $.cancelEvent( event );
                    }
                }
            } else if ( pointsList.contacts === 2 ) {
                if ( tracker.pinchHandler && curGPoint.type === 'touch' ) {
                    // Initialize for pinch
                    delegate.pinchGPoints = pointsList.asArray();
                    delegate.lastPinchDist = delegate.currentPinchDist = delegate.pinchGPoints[ 0 ].currentPos.distanceTo( delegate.pinchGPoints[ 1 ].currentPos );
                    delegate.lastPinchCenter = delegate.currentPinchCenter = getCenterPoint( delegate.pinchGPoints[ 0 ].currentPos, delegate.pinchGPoints[ 1 ].currentPos );
                }
            }
        }
        return true;
    }
    function updatePointersUp( tracker, event, gPoints, buttonChanged ) {
        var delegate = THIS[ tracker.hash ],
            pointsList = tracker.getActivePointersListByType( gPoints[ 0 ].type ),
            propagate,
            releasePoint,
            releaseTime,
            i,
            gPointCount = gPoints.length,
            curGPoint,
            updateGPoint,
            releaseCapture = false,
            wasCaptured = false,
            quick;

        if ( typeof event.buttons !== 'undefined' ) {
            pointsList.buttons = event.buttons;
        } else {
            if ( $.Browser.vendor === $.BROWSERS.IE && $.Browser.version < 9 ) {
                if ( buttonChanged === 0 ) {
                    // Primary
                    pointsList.buttons -= 1;
                } else if ( buttonChanged === 1 ) {
                    // Aux
                    pointsList.buttons -= 4;
                } else if ( buttonChanged === 2 ) {
                    // Secondary
                    pointsList.buttons -= 2;
                } else if ( buttonChanged === 3 ) {
                    // X1 (Back)
                    pointsList.buttons -= 8;
                } else if ( buttonChanged === 4 ) {
                    // X2 (Forward)
                    pointsList.buttons -= 16;
                } else if ( buttonChanged === 5 ) {
                    // Pen Eraser
                    pointsList.buttons -= 32;
                }
            } else {
                if ( buttonChanged === 0 ) {
                    // Primary
                    pointsList.buttons ^= ~1;
                } else if ( buttonChanged === 1 ) {
                    // Aux
                    pointsList.buttons ^= ~4;
                } else if ( buttonChanged === 2 ) {
                    // Secondary
                    pointsList.buttons ^= ~2;
                } else if ( buttonChanged === 3 ) {
                    // X1 (Back)
                    pointsList.buttons ^= ~8;
                } else if ( buttonChanged === 4 ) {
                    // X2 (Forward)
                    pointsList.buttons ^= ~16;
                } else if ( buttonChanged === 5 ) {
                    // Pen Eraser
                    pointsList.buttons ^= ~32;
                }
            }
        }
        // Only capture and track primary button, pen, and touch contacts
        if ( buttonChanged !== 0 ) {
            // Aux Release
            if ( tracker.nonPrimaryReleaseHandler ) {
                propagate = tracker.nonPrimaryReleaseHandler(
                    {
                        eventSource: tracker,
                        pointerType: gPoints[ 0 ].type,
                        position: getPointRelativeToAbsolute(gPoints[0].currentPos, tracker.element),
                        button: buttonChanged,
                        buttons: pointsList.buttons,
                        isTouchEvent: gPoints[ 0 ].type === 'touch',
                        originalEvent: event,
                        preventDefaultAction: false,
                        userData: tracker.userData
                    }
                );
                if ( propagate === false ) {
                    $.cancelEvent( event );
                }
            }
            // A primary mouse button may have been released while the non-primary button was down
            var otherPointsList = tracker.getActivePointersListByType("mouse");
            // Stop tracking the mouse; see https://github.com/openseadragon/openseadragon/pull/1223
            abortContacts(tracker, event, otherPointsList); // No-op if no active pointer

            return false;
        }
        for ( i = 0; i < gPointCount; i++ ) {
            curGPoint = gPoints[ i ];
            updateGPoint = pointsList.getById( curGPoint.id );

            if ( updateGPoint ) {
                // Update the pointer, stop tracking it if not still in this element
                if ( updateGPoint.captured ) {
                    updateGPoint.captured = false;
                    releaseCapture = true;
                    wasCaptured = true;
                }
                updateGPoint.lastPos = updateGPoint.currentPos;
                updateGPoint.lastTime = updateGPoint.currentTime;
                updateGPoint.currentPos = curGPoint.currentPos;
                updateGPoint.currentTime = curGPoint.currentTime;
                if ( !updateGPoint.insideElement ) {
                    stopTrackingPointer( pointsList, updateGPoint );
                }
                releasePoint = updateGPoint.currentPos;
                releaseTime = updateGPoint.currentTime;

                if ( wasCaptured ) {
                    // Pointer was activated in our element but could have been removed in any element since events are captured to our element

                    pointsList.removeContact();
                    //$.console.log('contacts-- ', pointsList.contacts);

                    if ( tracker.dragHandler || tracker.dragEndHandler || tracker.pinchHandler ) {
                        $.MouseTracker.gesturePointVelocityTracker.removePoint( tracker, updateGPoint );
                    }
                    if ( pointsList.contacts === 0 ) {
                        // Release (pressed in our element)
                        if ( tracker.releaseHandler ) {
                            propagate = tracker.releaseHandler(
                                {
                                    eventSource: tracker,
                                    pointerType: updateGPoint.type,
                                    position: getPointRelativeToAbsolute( releasePoint, tracker.element ),
                                    buttons: pointsList.buttons,
                                    insideElementPressed: updateGPoint.insideElementPressed,
                                    insideElementReleased: updateGPoint.insideElement,
                                    isTouchEvent: updateGPoint.type === 'touch',
                                    originalEvent: event,
                                    preventDefaultAction: false,
                                    userData: tracker.userData
                                }
                            );
                            if ( propagate === false ) {
                                $.cancelEvent( event );
                            }
                        }
                        // Drag End
                        if ( tracker.dragEndHandler && !updateGPoint.currentPos.equals( updateGPoint.contactPos ) ) {
                            propagate = tracker.dragEndHandler(
                                {
                                    eventSource: tracker,
                                    pointerType: updateGPoint.type,
                                    position: getPointRelativeToAbsolute( updateGPoint.currentPos, tracker.element ),
                                    speed: updateGPoint.speed,
                                    direction: updateGPoint.direction,
                                    shift: event.shiftKey,
                                    isTouchEvent: updateGPoint.type === 'touch',
                                    originalEvent: event,
                                    preventDefaultAction: false,
                                    userData: tracker.userData
                                }
                            );
                            if ( propagate === false ) {
                                $.cancelEvent( event );
                            }
                        }
                        // Click / Double-Click
                        if ( ( tracker.clickHandler || tracker.dblClickHandler ) && updateGPoint.insideElement ) {
                            quick = releaseTime - updateGPoint.contactTime <= tracker.clickTimeThreshold &&
                                            updateGPoint.contactPos.distanceTo( releasePoint ) <= tracker.clickDistThreshold;

                            // Click
                            if ( tracker.clickHandler ) {
                                propagate = tracker.clickHandler(
                                    {
                                        eventSource: tracker,
                                        pointerType: updateGPoint.type,
                                        position: getPointRelativeToAbsolute( updateGPoint.currentPos, tracker.element ),
                                        quick: quick,
                                        shift: event.shiftKey,
                                        isTouchEvent: updateGPoint.type === 'touch',
                                        originalEvent: event,
                                        preventDefaultAction: false,
                                        userData: tracker.userData
                                    }
                                );
                                if ( propagate === false ) {
                                    $.cancelEvent( event );
                                }
                            }
                            // Double-Click
                            if ( tracker.dblClickHandler && quick ) {
                                pointsList.clicks++;
                                if ( pointsList.clicks === 1 ) {
                                    delegate.lastClickPos = releasePoint;

                                    delegate.dblClickTimeOut = setTimeout( function() {
                                        pointsList.clicks = 0;
                                    }, tracker.dblClickTimeThreshold );
                                } else if ( pointsList.clicks === 2 ) {
                                    clearTimeout( delegate.dblClickTimeOut );
                                    pointsList.clicks = 0;
                                    if ( delegate.lastClickPos.distanceTo( releasePoint ) <= tracker.dblClickDistThreshold ) {
                                        propagate = tracker.dblClickHandler(
                                            {
                                                eventSource: tracker,
                                                pointerType: updateGPoint.type,
                                                position: getPointRelativeToAbsolute( updateGPoint.currentPos, tracker.element ),
                                                shift: event.shiftKey,
                                                isTouchEvent: updateGPoint.type === 'touch',
                                                originalEvent: event,
                                                preventDefaultAction: false,
                                                userData: tracker.userData
                                            }
                                        );
                                        if ( propagate === false ) {
                                            $.cancelEvent( event );
                                        }
                                    }
                                    delegate.lastClickPos = null;
                                }
                            }
                        }
                    } else if ( pointsList.contacts === 2 ) {
                        if ( tracker.pinchHandler && updateGPoint.type === 'touch' ) {
                            // Reset for pinch
                            delegate.pinchGPoints = pointsList.asArray();
                            delegate.lastPinchDist = delegate.currentPinchDist = delegate.pinchGPoints[ 0 ].currentPos.distanceTo( delegate.pinchGPoints[ 1 ].currentPos );
                            delegate.lastPinchCenter = delegate.currentPinchCenter = getCenterPoint( delegate.pinchGPoints[ 0 ].currentPos, delegate.pinchGPoints[ 1 ].currentPos );
                        }
                    }
                } else {
                    // Pointer was activated in another element but removed in our element

                    // Release (pressed in another element)
                    if ( tracker.releaseHandler ) {
                        propagate = tracker.releaseHandler(
                            {
                                eventSource: tracker,
                                pointerType: updateGPoint.type,
                                position: getPointRelativeToAbsolute( releasePoint, tracker.element ),
                                buttons: pointsList.buttons,
                                insideElementPressed: updateGPoint.insideElementPressed,
                                insideElementReleased: updateGPoint.insideElement,
                                isTouchEvent: updateGPoint.type === 'touch',
                                originalEvent: event,
                                preventDefaultAction: false,
                                userData: tracker.userData
                            }
                        );
                        if ( propagate === false ) {
                            $.cancelEvent( event );
                        }
                    }
                }
            }
        }
        return releaseCapture;
    }
    function updatePointersMove( tracker, event, gPoints ) {
        var delegate = THIS[ tracker.hash ],
            pointsList = tracker.getActivePointersListByType( gPoints[ 0 ].type ),
            i,
            gPointCount = gPoints.length,
            curGPoint,
            updateGPoint,
            gPointArray,
            delta,
            propagate;

        if ( typeof event.buttons !== 'undefined' ) {
            pointsList.buttons = event.buttons;
        }
        for ( i = 0; i < gPointCount; i++ ) {
            curGPoint = gPoints[ i ];
            updateGPoint = pointsList.getById( curGPoint.id );

            if ( updateGPoint ) {
                // Already tracking the pointer...update it
                if ( curGPoint.hasOwnProperty( 'isPrimary' ) ) {
                    updateGPoint.isPrimary = curGPoint.isPrimary;
                }
                updateGPoint.lastPos = updateGPoint.currentPos;
                updateGPoint.lastTime = updateGPoint.currentTime;
                updateGPoint.currentPos = curGPoint.currentPos;
                updateGPoint.currentTime = curGPoint.currentTime;
            } else {
                // Initialize for tracking and add to the tracking list (no pointerover or pointerdown event occurred before this)
                curGPoint.captured = false;
                curGPoint.insideElementPressed = false;
                curGPoint.insideElement = true;
                startTrackingPointer( pointsList, curGPoint );
            }
        }
        // Stop (mouse only)
        if ( tracker.stopHandler && gPoints[ 0 ].type === 'mouse' ) {
            clearTimeout( tracker.stopTimeOut );
            tracker.stopTimeOut = setTimeout( function() {
                handlePointerStop( tracker, event, gPoints[ 0 ].type );
            }, tracker.stopDelay );
        }
        if ( pointsList.contacts === 0 ) {
            // Move (no contacts: hovering mouse or other hover-capable device)
            if ( tracker.moveHandler ) {
                propagate = tracker.moveHandler(
                    {
                        eventSource: tracker,
                        pointerType: gPoints[ 0 ].type,
                        position: getPointRelativeToAbsolute( gPoints[ 0 ].currentPos, tracker.element ),
                        buttons: pointsList.buttons,
                        isTouchEvent: gPoints[ 0 ].type === 'touch',
                        originalEvent: event,
                        preventDefaultAction: false,
                        userData: tracker.userData
                    }
                );
                if ( propagate === false ) {
                    $.cancelEvent( event );
                }
            }
        } else if ( pointsList.contacts === 1 ) {
            // Move (1 contact)
            if ( tracker.moveHandler ) {
                updateGPoint = pointsList.asArray()[ 0 ];
                propagate = tracker.moveHandler(
                    {
                        eventSource: tracker,
                        pointerType: updateGPoint.type,
                        position: getPointRelativeToAbsolute( updateGPoint.currentPos, tracker.element ),
                        buttons: pointsList.buttons,
                        isTouchEvent: updateGPoint.type === 'touch',
                        originalEvent: event,
                        preventDefaultAction: false,
                        userData: tracker.userData
                    }
                );
                if ( propagate === false ) {
                    $.cancelEvent( event );
                }
            }
            // Drag
            if ( tracker.dragHandler ) {
                updateGPoint = pointsList.asArray()[ 0 ];
                delta = updateGPoint.currentPos.minus( updateGPoint.lastPos );
                propagate = tracker.dragHandler(
                    {
                        eventSource: tracker,
                        pointerType: updateGPoint.type,
                        position: getPointRelativeToAbsolute( updateGPoint.currentPos, tracker.element ),
                        buttons: pointsList.buttons,
                        delta: delta,
                        speed: updateGPoint.speed,
                        direction: updateGPoint.direction,
                        shift: event.shiftKey,
                        isTouchEvent: updateGPoint.type === 'touch',
                        originalEvent: event,
                        preventDefaultAction: false,
                        userData: tracker.userData
                    }
                );
                if ( propagate === false ) {
                    $.cancelEvent( event );
                }
            }
        } else if ( pointsList.contacts === 2 ) {
            // Move (2 contacts, use center)
            if ( tracker.moveHandler ) {
                gPointArray = pointsList.asArray();
                propagate = tracker.moveHandler(
                    {
                        eventSource: tracker,
                        pointerType: gPointArray[ 0 ].type,
                        position: getPointRelativeToAbsolute( getCenterPoint( gPointArray[ 0 ].currentPos, gPointArray[ 1 ].currentPos ), tracker.element ),
                        buttons: pointsList.buttons,
                        isTouchEvent: gPointArray[ 0 ].type === 'touch',
                        originalEvent: event,
                        preventDefaultAction: false,
                        userData: tracker.userData
                    }
                );
                if ( propagate === false ) {
                    $.cancelEvent( event );
                }
            }
            // Pinch
            if ( tracker.pinchHandler && gPoints[ 0 ].type === 'touch' ) {
                delta = delegate.pinchGPoints[ 0 ].currentPos.distanceTo( delegate.pinchGPoints[ 1 ].currentPos );
                if ( delta != delegate.currentPinchDist ) {
                    delegate.lastPinchDist = delegate.currentPinchDist;
                    delegate.currentPinchDist = delta;
                    delegate.lastPinchCenter = delegate.currentPinchCenter;
                    delegate.currentPinchCenter = getCenterPoint( delegate.pinchGPoints[ 0 ].currentPos, delegate.pinchGPoints[ 1 ].currentPos );
                    propagate = tracker.pinchHandler(
                        {
                            eventSource: tracker,
                            pointerType: 'touch',
                            gesturePoints: delegate.pinchGPoints,
                            lastCenter: getPointRelativeToAbsolute( delegate.lastPinchCenter, tracker.element ),
                            center: getPointRelativeToAbsolute( delegate.currentPinchCenter, tracker.element ),
                            lastDistance: delegate.lastPinchDist,
                            distance: delegate.currentPinchDist,
                            shift: event.shiftKey,
                            originalEvent: event,
                            preventDefaultAction: false,
                            userData: tracker.userData
                        }
                    );
                    if ( propagate === false ) {
                        $.cancelEvent( event );
                    }
                }
            }
        }
    }
    function updatePointersCancel( tracker, event, gPoints ) {
        updatePointersUp( tracker, event, gPoints, 0 );
        updatePointersExit( tracker, event, gPoints );
    }
    function handlePointerStop( tracker, originalMoveEvent, pointerType ) {
        if ( tracker.stopHandler ) {
            tracker.stopHandler( {
                eventSource: tracker,
                pointerType: pointerType,
                position: getMouseRelative( originalMoveEvent, tracker.element ),
                buttons: tracker.getActivePointersListByType( pointerType ).buttons,
                isTouchEvent: pointerType === 'touch',
                originalEvent: originalMoveEvent,
                preventDefaultAction: false,
                userData: tracker.userData
            } );
        }
    }
    var isInIframe = (function() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    })();
    function canAccessEvents (target) {
        try {
            return target.addEventListener && target.removeEventListener;
        } catch (e) {
            return false;
        }
    }
}(OpenSeadragon));
