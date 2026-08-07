import type { RuntimeClientFailure } from '../../../drivers/shared/clients/clientResult';

export type RuntimeFailureAction = 'retry' | 'reload';

export type RuntimeFailurePresentation = {
    title: string;
    message: string;
    action: RuntimeFailureAction;
    actionLabel: string;
};

type Translate = (key: string, fallback: string) => string;

export function getRuntimeFailurePresentation(
    failure: RuntimeClientFailure,
    translate: Translate,
): RuntimeFailurePresentation {
    if (failure.kind === 'protocol') {
        return {
            title: translate('runtimeRequestFailedTitle', 'AI-MarkDone could not load this data'),
            message: failure.message,
            action: 'retry',
            actionLabel: translate('retryAction', 'Retry'),
        };
    }
    const reloadRequired = failure.kind === 'transport' && failure.code === 'CONTEXT_INVALIDATED';
    return {
        title: translate('runtimeConnectionUnavailableTitle', 'AI-MarkDone is disconnected'),
        message: reloadRequired
            ? translate(
                'runtimeContextInvalidatedMessage',
                'AI-MarkDone was updated or reloaded. Refresh this page to reconnect.',
            )
            : translate(
                'runtimeConnectionUnavailableMessage',
                'AI-MarkDone could not connect to the extension runtime. Retry, or refresh this page if the problem continues.',
            ),
        action: reloadRequired ? 'reload' : 'retry',
        actionLabel: reloadRequired
            ? translate('refreshPageAction', 'Refresh page')
            : translate('retryAction', 'Retry'),
    };
}
