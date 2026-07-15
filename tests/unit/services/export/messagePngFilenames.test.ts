import { describe, expect, it } from 'vitest';
import { planMessagePngFilenames } from '../../../../src/services/export/messagePngFilenames';

describe('planMessagePngFilenames', () => {
    it('preserves the single-message name and uses one long-image name or minimal-part names otherwise', () => {
        expect(planMessagePngFilenames('A/B:C* D?', 1, 1)).toEqual({
            artifactFilenames: ['A_B_C__D_-message-001.png'],
            zipFilename: 'A_B_C__D_-png.zip',
            packagedAsZip: false,
        });
        expect(planMessagePngFilenames('A/B:C* D?', 3, 1).artifactFilenames).toEqual([
            'A_B_C__D_-messages.png',
        ]);
        expect(planMessagePngFilenames('A/B:C* D?', 3, 2)).toEqual({
            artifactFilenames: [
                'A_B_C__D_-part-001-of-2.png',
                'A_B_C__D_-part-002-of-2.png',
            ],
            zipFilename: 'A_B_C__D_-png.zip',
            packagedAsZip: true,
        });
    });
});
