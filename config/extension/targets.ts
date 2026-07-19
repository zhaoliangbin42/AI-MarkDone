export type ExtensionTarget = 'chrome' | 'firefox' | 'safari';

export const extensionTargets = {
    chrome: {
        target: 'chrome',
        manifestVersion: 3,
        distDir: 'dist-chrome',
        actionKey: 'action',
        backgroundKind: 'service_worker',
        hostPermissionPlacement: 'host_permissions',
        webAccessibleResourcesStyle: 'mv3',
        minimumChromeVersion: '111',
    },
    firefox: {
        target: 'firefox',
        manifestVersion: 2,
        distDir: 'dist-firefox',
        actionKey: 'browser_action',
        backgroundKind: 'scripts',
        hostPermissionPlacement: 'permissions',
        webAccessibleResourcesStyle: 'mv2',
        gecko: {
            id: 'ai-markdone@zhaoliangbin.com',
            strictMinVersion: '128.0',
            dataCollectionPermissions: {
                required: ['none'],
            },
        },
    },
    safari: {
        target: 'safari',
        manifestVersion: 2,
        distDir: 'dist-safari',
        actionKey: 'browser_action',
        backgroundKind: 'scripts',
        hostPermissionPlacement: 'permissions',
        webAccessibleResourcesStyle: 'mv2',
        bundle: {
            bundleIdentifier: 'com.Liangbin.aimarkdone',
            productName: 'AI-MarkDone',
        },
    },
} as const satisfies Record<ExtensionTarget, object>;
