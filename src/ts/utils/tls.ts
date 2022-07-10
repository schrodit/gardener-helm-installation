import * as forge from 'node-forge';
import {md} from 'node-forge';
import {has} from './has';

// todo: (schrodit) check back when eliptic curves are supported
// https://github.com/digitalbazaar/forge/pull/925
// const ed25519 = forge.pki.ed25519;
const RSA_BITS = 4096;
const pki = forge.pki;

export enum MessageDigest {
    SHA1 = 'sha1',
    SHA256 = 'sha256',
    SHA384 = 'sha384',
}

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
    messageDigest?: MessageDigest,
}

export interface CA extends TLS {
    attributes: forge.pki.CertificateField[]
}

export interface CSR {
    cn: string,
    organization?: string,
    altNames?: string[],
    extensions?: Record<string, any>[],
}

export const defaultExtensions = () => {
    return [
        {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            keyEncipherment: true,
            dataEncipherment: true,
        },
        {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            timeStamping: true,
        },
    ];
};

export const generateKey = (): KeypairPEM => {
    const key = pki.rsa.generateKeyPair(RSA_BITS);
    return {
        publicKey: pki.publicKeyToPem(key.publicKey),
        privateKey: pki.privateKeyToPem(key.privateKey),
    };
};

export const createSelfSignedCA = (cn: string): CA => {
    const keypair = pki.rsa.generateKeyPair(RSA_BITS);

    const cert = pki.createCertificate();
    cert.publicKey = keypair.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear()+10);
    const attrs = [
        {name: 'commonName', value: cn},
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
        {
            name: 'basicConstraints',
            cA: true,
        },
        {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            keyEncipherment: true,
            dataEncipherment: true,
        },
        {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            timeStamping: true,
        },
        {
            name: 'nsCertType',
            client: true,
            server: true,
            email: true,
            objsign: true,
            sslCA: true,
            emailCA: true,
            objCA: true,
        },
    ]);
    cert.sign(keypair.privateKey, md.sha384.create());

    return {
        attributes: attrs,
        cert: pki.certificateToPem(cert),
        publicKey: pki.publicKeyToPem(keypair.publicKey),
        privateKey: pki.privateKeyToPem(keypair.privateKey),
        messageDigest: MessageDigest.SHA384,
    };
};

export const createClientTLS = (ca: CA, csr: CSR): TLS => {
    const keypair = pki.rsa.generateKeyPair(RSA_BITS);

    const cert = pki.createCertificate();
    cert.publicKey = keypair.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear()+10);
    const attrs = [
        {name: 'commonName', value: csr.cn},
    ];
    if (has(csr.organization)) {
        attrs.push({
            name: 'organizationName',
            value: csr.organization!,
        });
    }

    cert.setSubject(attrs);
    cert.setIssuer(ca.attributes);

    const extensions = csr.extensions ?? [];
    if (has(csr.altNames)) {
        extensions.push(
            {
                name: 'subjectAltName',
                altNames: csr.altNames?.map(n => {
                    return {
                        type: 2, // DNS
                        value: n,
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
        );
    }
    cert.setExtensions(extensions);

    const caPrivKey = pki.privateKeyFromPem(ca.privateKey);
    cert.sign(caPrivKey, md.sha384.create());

    return {
        cert: pki.certificateToPem(cert),
        publicKey: pki.publicKeyToPem(keypair.publicKey),
        privateKey: pki.privateKeyToPem(keypair.privateKey),
        messageDigest: MessageDigest.SHA384,
    };
};
