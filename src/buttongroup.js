

(function( $ ){
$.ButtonGroup = function( options ) {
    $.extend( true, this, {
        buttons: [],
        clickTimeThreshold: $.DEFAULT_SETTINGS.clickTimeThreshold,
        clickDistThreshold: $.DEFAULT_SETTINGS.clickDistThreshold,
        labelText: ""
    }, options );
    // copy the button elements TODO: Why?
    var buttons = this.buttons.concat([]),
        _this = this,
        i;
    this.element = options.element || $.makeNeutralElement( "div" );

    // TODO What if there IS an options.group specified?
    if( !options.group ){
        this.label = $.makeNeutralElement( "label" );
        //TODO: support labels for ButtonGroups
        //this.label.innerHTML = this.labelText;
        this.element.style.display = "inline-block";
        this.element.appendChild( this.label );
        for ( i = 0; i < buttons.length; i++ ) {
            this.element.appendChild( buttons[ i ].element );
        }
    }
    $.setElementTouchActionNone( this.element );
    this.tracker = new $.MouseTracker({
        element: this.element,
        clickTimeThreshold: this.clickTimeThreshold,
        clickDistThreshold: this.clickDistThreshold,
        enterHandler: function ( event ) {
            var i;
            for ( i = 0; i < _this.buttons.length; i++ ) {
                _this.buttons[ i ].notifyGroupEnter();
            }
        },
        exitHandler: function ( event ) {
            var i;
            if ( !event.insideElementPressed ) {
                for ( i = 0; i < _this.buttons.length; i++ ) {
                    _this.buttons[ i ].notifyGroupExit();
                }
            }
        },
    });
};
$.ButtonGroup.prototype = {

    emulateEnter: function() {
        this.tracker.enterHandler( { eventSource: this.tracker } );
    },
    emulateExit: function() {
        this.tracker.exitHandler( { eventSource: this.tracker } );
    }
};
}( OpenSeadragon ));
