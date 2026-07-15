import { sanitizeExportFilename } from './saveMessagesDocument';

export type MessagePngFilenamePlan = {
    artifactFilenames: string[];
    zipFilename: string;
    packagedAsZip: boolean;
};

export function planMessagePngFilenames(
    title: string,
    selectedMessageCount: number,
    partCount: number,
): MessagePngFilenamePlan {
    const baseName = sanitizeExportFilename(title);
    let artifactFilenames: string[];

    if (partCount > 1) {
        artifactFilenames = Array.from({ length: partCount }, (_, index) => (
            `${baseName}-part-${String(index + 1).padStart(3, '0')}-of-${partCount}.png`
        ));
    } else if (selectedMessageCount === 1) {
        artifactFilenames = [`${baseName}-message-001.png`];
    } else {
        artifactFilenames = [`${baseName}-messages.png`];
    }

    return {
        artifactFilenames,
        zipFilename: `${baseName}-png.zip`,
        packagedAsZip: partCount > 1,
    };
}
