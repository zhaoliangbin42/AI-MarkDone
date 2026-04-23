import JSZip from 'jszip';

export type ZipBlobFile = {
    filename: string;
    blob: Blob;
};

export type ZipBlobsArgs = {
    files: ZipBlobFile[];
};

export async function zipBlobs(args: ZipBlobsArgs): Promise<Blob> {
    const zip = new JSZip();
    for (const file of args.files) {
        zip.file(file.filename, file.blob);
    }
    return zip.generateAsync({
        type: 'blob',
        mimeType: 'application/zip',
        compression: 'STORE',
    });
}
