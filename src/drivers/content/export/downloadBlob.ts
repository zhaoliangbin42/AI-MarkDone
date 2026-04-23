export type DownloadBlobArgs = {
    filename: string;
    blob: Blob;
};

export function downloadBlob(args: DownloadBlobArgs): void {
    const url = URL.createObjectURL(args.blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = args.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
