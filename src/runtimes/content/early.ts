import { getAdapter } from '../../drivers/content/adapters/registry';
import { ChatGPTEarlyLoadGuard } from '../../drivers/content/virtualization/earlyLoadGuard';

const adapter = getAdapter();
if (adapter?.getPlatformId() === 'chatgpt') {
    void new ChatGPTEarlyLoadGuard(adapter).init();
}
