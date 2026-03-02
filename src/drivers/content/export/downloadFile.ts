export type DownloadTextArgs = {
    filename: string;
    content: string;
    mime?: string;
};

export function downloadText(args: DownloadTextArgs): void {
    const mime = args.mime || 'text/plain;charset=utf-8';
    const blob = new Blob([args.content], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = args.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

