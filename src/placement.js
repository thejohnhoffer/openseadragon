

(function($) {

    $.Placement = $.freezeObject({
        CENTER: 0,
        TOP_LEFT: 1,
        TOP: 2,
        TOP_RIGHT: 3,
        RIGHT: 4,
        BOTTOM_RIGHT: 5,
        BOTTOM: 6,
        BOTTOM_LEFT: 7,
        LEFT: 8,
        properties: {
            0: {
                isLeft: false,
                isHorizontallyCentered: true,
                isRight: false,
                isTop: false,
                isVerticallyCentered: true,
                isBottom: false
            },
            1: {
                isLeft: true,
                isHorizontallyCentered: false,
                isRight: false,
                isTop: true,
                isVerticallyCentered: false,
                isBottom: false
            },
            2: {
                isLeft: false,
                isHorizontallyCentered: true,
                isRight: false,
                isTop: true,
                isVerticallyCentered: false,
                isBottom: false
            },
            3: {
                isLeft: false,
                isHorizontallyCentered: false,
                isRight: true,
                isTop: true,
                isVerticallyCentered: false,
                isBottom: false
            },
            4: {
                isLeft: false,
                isHorizontallyCentered: false,
                isRight: true,
                isTop: false,
                isVerticallyCentered: true,
                isBottom: false
            },
            5: {
                isLeft: false,
                isHorizontallyCentered: false,
                isRight: true,
                isTop: false,
                isVerticallyCentered: false,
                isBottom: true
            },
            6: {
                isLeft: false,
                isHorizontallyCentered: true,
                isRight: false,
                isTop: false,
                isVerticallyCentered: false,
                isBottom: true
            },
            7: {
                isLeft: true,
                isHorizontallyCentered: false,
                isRight: false,
                isTop: false,
                isVerticallyCentered: false,
                isBottom: true
            },
            8: {
                isLeft: true,
                isHorizontallyCentered: false,
                isRight: false,
                isTop: false,
                isVerticallyCentered: true,
                isBottom: false
            }
        }
    });
}(OpenSeadragon));
