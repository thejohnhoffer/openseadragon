

(function( $ ){
$.ControlAnchor = {
    NONE: 0,
    TOP_LEFT: 1,
    TOP_RIGHT: 2,
    BOTTOM_RIGHT: 3,
    BOTTOM_LEFT: 4,
    ABSOLUTE: 5
};
$.Control = function ( element, options, container ) {
    var parent = element.parentNode;
    if (typeof options === 'number')
    {
        $.console.error("Passing an anchor directly into the OpenSeadragon.Control constructor is deprecated; " +
                        "please use an options object instead. " +
                        "Support for this deprecated variant is scheduled for removal in December 2013");
         options = {anchor: options};
    }
    options.attachToViewer = (typeof options.attachToViewer === 'undefined') ? true : options.attachToViewer;

    this.autoFade = (typeof options.autoFade === 'undefined') ? true : options.autoFade;

    this.element = element;

    this.anchor = options.anchor;

    this.container = container;

    if ( this.anchor == $.ControlAnchor.ABSOLUTE ) {
        this.wrapper = $.makeNeutralElement( "div" );
        this.wrapper.style.position = "absolute";
        this.wrapper.style.top = typeof (options.top) == "number" ? (options.top + 'px') : options.top;
        this.wrapper.style.left = typeof (options.left) == "number" ? (options.left + 'px') : options.left;
        this.wrapper.style.height = typeof (options.height) == "number" ? (options.height + 'px') : options.height;
        this.wrapper.style.width = typeof (options.width) == "number" ? (options.width + 'px') : options.width;
        this.wrapper.style.margin = "0px";
        this.wrapper.style.padding = "0px";

        this.element.style.position = "relative";
        this.element.style.top = "0px";
        this.element.style.left = "0px";
        this.element.style.height = "100%";
        this.element.style.width = "100%";
    } else {
        this.wrapper = $.makeNeutralElement( "div" );
        this.wrapper.style.display = "inline-block";
        if ( this.anchor == $.ControlAnchor.NONE ) {
            // IE6 fix
            this.wrapper.style.width = this.wrapper.style.height = "100%";
        }
    }
    this.wrapper.appendChild( this.element );

    if (options.attachToViewer ) {
        if ( this.anchor == $.ControlAnchor.TOP_RIGHT ||
             this.anchor == $.ControlAnchor.BOTTOM_RIGHT ) {
            this.container.insertBefore(
                this.wrapper,
                this.container.firstChild
            );
        } else {
            this.container.appendChild( this.wrapper );
        }
    } else {
        parent.appendChild( this.wrapper );
    }
};
$.Control.prototype = {

    destroy: function() {
        this.wrapper.removeChild( this.element );
        this.container.removeChild( this.wrapper );
    },
    isVisible: function() {
        return this.wrapper.style.display != "none";
    },
    setVisible: function( visible ) {
        this.wrapper.style.display = visible ?
            ( this.anchor == $.ControlAnchor.ABSOLUTE ? 'block' : 'inline-block' ) :
            "none";
    },
    setOpacity: function( opacity ) {
        if ( this.element[ $.SIGNAL ] && $.Browser.vendor == $.BROWSERS.IE ) {
            $.setElementOpacity( this.element, opacity, true );
        } else {
            $.setElementOpacity( this.wrapper, opacity, true );
        }
    }
};
}( OpenSeadragon ));
