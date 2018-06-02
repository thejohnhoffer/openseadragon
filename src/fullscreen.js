

(function( $ ) {
    var fullScreenApi = {
        supportsFullScreen: false,
        isFullScreen: function() { return false; },
        getFullScreenElement: function() { return null; },
        requestFullScreen: function() {},
        exitFullScreen: function() {},
        cancelFullScreen: function() {},
        fullScreenEventName: '',
        fullScreenErrorEventName: ''
    };
    // check for native support
    if ( document.exitFullscreen ) {
        // W3C standard
        fullScreenApi.supportsFullScreen = true;
        fullScreenApi.getFullScreenElement = function() {
            return document.fullscreenElement;
        };
        fullScreenApi.requestFullScreen = function( element ) {
            return element.requestFullscreen();
        };
        fullScreenApi.exitFullScreen = function() {
            document.exitFullscreen();
        };
        fullScreenApi.fullScreenEventName = "fullscreenchange";
        fullScreenApi.fullScreenErrorEventName = "fullscreenerror";
    } else if ( document.msExitFullscreen ) {
        // IE 11
        fullScreenApi.supportsFullScreen = true;
        fullScreenApi.getFullScreenElement = function() {
            return document.msFullscreenElement;
        };
        fullScreenApi.requestFullScreen = function( element ) {
            return element.msRequestFullscreen();
        };
        fullScreenApi.exitFullScreen = function() {
            document.msExitFullscreen();
        };
        fullScreenApi.fullScreenEventName = "MSFullscreenChange";
        fullScreenApi.fullScreenErrorEventName = "MSFullscreenError";
    } else if ( document.webkitExitFullscreen ) {
        // Recent webkit
        fullScreenApi.supportsFullScreen = true;
        fullScreenApi.getFullScreenElement = function() {
            return document.webkitFullscreenElement;
        };
        fullScreenApi.requestFullScreen = function( element ) {
            return element.webkitRequestFullscreen();
        };
        fullScreenApi.exitFullScreen = function() {
            document.webkitExitFullscreen();
        };
        fullScreenApi.fullScreenEventName = "webkitfullscreenchange";
        fullScreenApi.fullScreenErrorEventName = "webkitfullscreenerror";
    } else if ( document.webkitCancelFullScreen ) {
        // Old webkit
        fullScreenApi.supportsFullScreen = true;
        fullScreenApi.getFullScreenElement = function() {
            return document.webkitCurrentFullScreenElement;
        };
        fullScreenApi.requestFullScreen = function( element ) {
            return element.webkitRequestFullScreen();
        };
        fullScreenApi.exitFullScreen = function() {
            document.webkitCancelFullScreen();
        };
        fullScreenApi.fullScreenEventName = "webkitfullscreenchange";
        fullScreenApi.fullScreenErrorEventName = "webkitfullscreenerror";
    } else if ( document.mozCancelFullScreen ) {
        // Firefox
        fullScreenApi.supportsFullScreen = true;
        fullScreenApi.getFullScreenElement = function() {
            return document.mozFullScreenElement;
        };
        fullScreenApi.requestFullScreen = function( element ) {
            return element.mozRequestFullScreen();
        };
        fullScreenApi.exitFullScreen = function() {
            document.mozCancelFullScreen();
        };
        fullScreenApi.fullScreenEventName = "mozfullscreenchange";
        fullScreenApi.fullScreenErrorEventName = "mozfullscreenerror";
    }
    fullScreenApi.isFullScreen = function() {
        return fullScreenApi.getFullScreenElement() !== null;
    };
    fullScreenApi.cancelFullScreen = function() {
        $.console.error("cancelFullScreen is deprecated. Use exitFullScreen instead.");
        fullScreenApi.exitFullScreen();
    };
    // export api
    $.extend( $, fullScreenApi );

})( OpenSeadragon );
