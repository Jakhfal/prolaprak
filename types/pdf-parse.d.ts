
declare module "pdf-parse" {
    function pdfParse(
        data: Buffer | Uint8Array
    ): Promise<{
        numpages: number;
        numrender: number;
        info: Record<string, unknown>;
        metadata: unknown;
        version: string;
        text: string;
    }>;

    export default pdfParse;
}
