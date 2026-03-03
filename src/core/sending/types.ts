export type ComposerKind = 'textarea' | 'contenteditable' | 'unknown';

export type ComposerSnapshot = {
    kind: ComposerKind;
    text: string;
};

export type SendErrorCode =
    | 'EMPTY'
    | 'COMPOSER_NOT_FOUND'
    | 'SEND_BUTTON_NOT_FOUND'
    | 'SEND_BUTTON_NOT_READY'
    | 'WRITE_FAILED'
    | 'INTERNAL_ERROR';

