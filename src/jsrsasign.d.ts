declare module "jsrsasign" {
  export const KEYUTIL: {
    generateKeypair(alg: string, keylen: number): {
      prvKeyObj: unknown;
      pubKeyObj: unknown;
    };
    getPEM(key: unknown, format: string): string;
  };

  export const KJUR: {
    asn1: {
      csr: {
        CSRUtil: {
          newCSRPEM(params: {
            subject: { str: string };
            sbjpubkey: unknown;
            sigalg: string;
            sbjprvkey: unknown;
          }): string;
        };
      };
    };
  };
}
