import * as forge from 'node-forge';
import { has } from './has';

// todo: (schrodit) check back when eliptic curves are supported
// https://github.com/digitalbazaar/forge/pull/925
// const ed25519 = forge.pki.ed25519;
const RSA_BITS = 4096;
const pki = forge.pki;

export interface KeypairPEM {
    /**
     * PEM encoded public key
     */
     publicKey: string,
     /**
      * PEM encoded private key
      */
     privateKey: string,
}

export interface TLS extends KeypairPEM {
    /**
     * PEM encoded cert
     */
    cert: string,
}

export interface Keypair {
    publicKey: Buffer,
    privateKey: Buffer,
}

export interface CSR {
    cn: string,
    altNames?: string[],
    extensions?: Record<string, any>[],
}

export const defaultExtensions = () =>{
    return [
        {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            keyEncipherment: true,
            dataEncipherment: true
        },
        {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            timeStamping: true,
        },
    ]
};

export const generateKey = (): KeypairPEM => {
    const key = pki.rsa.generateKeyPair(RSA_BITS);
    return {
        publicKey: pki.publicKeyToPem(key.publicKey),
        privateKey: pki.privateKeyToPem(key.privateKey),
    }
}

export const createSelfSignedCA = (cn: string) => {
    const keypair = pki.rsa.generateKeyPair(RSA_BITS);

    const cert = pki.createCertificate();
    cert.publicKey = keypair.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear()+10);
    const attrs = [
        {name:'commonName', value: cn}
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keypair.privateKey);

    return {
        cert: pki.certificateToPem(cert),
        publicKey: pki.publicKeyToPem(keypair.publicKey),
        privateKey: pki.privateKeyToPem(keypair.privateKey),
    }
}

export const createClientTLS = (ca: TLS, csr: CSR): TLS => {
    const keypair = pki.rsa.generateKeyPair(RSA_BITS);

    const cert = pki.createCertificate();
    cert.publicKey = keypair.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear()+10);
    const attrs = [
        {name:'commonName', value: csr.cn},
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    const extensions = csr.extensions ?? [];
    if (has(csr.altNames)) {
        extensions.push(
            {
                name: 'subjectAltName',
                altNames: csr.altNames?.map(n => {
                    return {
                        type: 6,
                        value: n
                    };
                }),
                // altNames: [{
                //     type: 6, // URI
                //     value: 'http://example.org/webid#me'
                // }, {
                //     type: 7, // IP
                //     ip: '127.0.0.1'
                // }]
            }
        )
    }
    cert.setExtensions(extensions);

    const caPrivKey = pki.privateKeyFromPem(ca.privateKey);
    cert.sign(caPrivKey);

    return {
        cert: pki.certificateToPem(cert),
        publicKey: pki.publicKeyToPem(keypair.publicKey),
        privateKey: pki.privateKeyToPem(keypair.privateKey),
    }
}
