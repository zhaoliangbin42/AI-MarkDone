import { browserInfo } from '../browser';

export const pageHeaderIconCapability = {
    get canInject(): boolean {
        return browserInfo.target !== 'safari';
    },
};
