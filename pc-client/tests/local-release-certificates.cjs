"use strict";

const { X509Certificate } = require("node:crypto");

const rootCertificatePem = `-----BEGIN CERTIFICATE-----
MIIBpDCCAUmgAwIBAgIQRj5Gq8gq0FND3VDNSKRg0TAKBggqhkjOPQQDAjAwMS4w
LAYDVQQDEyVDYWRkeSBMb2NhbCBBdXRob3JpdHkgLSAyMDI2IEVDQyBSb290MB4X
DTI2MDczMDA4MTQwM1oXDTM2MDYwNzA4MTQwM1owMDEuMCwGA1UEAxMlQ2FkZHkg
TG9jYWwgQXV0aG9yaXR5IC0gMjAyNiBFQ0MgUm9vdDBZMBMGByqGSM49AgEGCCqG
SM49AwEHA0IABOtQelBSjHYpACy3clpZE1GhDevxtp/LsTylf+48lxh3TEaBnXAq
HW/77hHPbK9wMGf8hROP2cv3mmjHHzst1fOjRTBDMA4GA1UdDwEB/wQEAwIBBjAS
BgNVHRMBAf8ECDAGAQH/AgEBMB0GA1UdDgQWBBR4XV6oFOO8zbWBBsE9QbodrMVI
qTAKBggqhkjOPQQDAgNJADBGAiEArO9BkXufEBtCHy4SaACnwuEyxjJu1b7i0qJX
2n8JRroCIQDTIvfi8IFewiDtEAiOH7UEdN5TJBiGn+sF00eK53pASQ==
-----END CERTIFICATE-----`;

const intermediateCertificatePem = `-----BEGIN CERTIFICATE-----
MIIByDCCAW6gAwIBAgIRAJ7KWnS2GsiXxFw64MTotGUwCgYIKoZIzj0EAwIwMDEu
MCwGA1UEAxMlQ2FkZHkgTG9jYWwgQXV0aG9yaXR5IC0gMjAyNiBFQ0MgUm9vdDAe
Fw0yNjA3MzAwODE0MDNaFw0yNjA4MDYwODE0MDNaMDMxMTAvBgNVBAMTKENhZGR5
IExvY2FsIEF1dGhvcml0eSAtIEVDQyBJbnRlcm1lZGlhdGUwWTATBgcqhkjOPQIB
BggqhkjOPQMBBwNCAAQQQMpbm2IYnFcf8gg4GSdrg0UJXbybcj6sPAthYYuIcgqK
z22VLHcPW05uYmzsFAHjSNj5AECoxbNQXyqDWQ+Yo2YwZDAOBgNVHQ8BAf8EBAMC
AQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUwrJ+WGv47zGX1Qg5VGif
bgxVK/4wHwYDVR0jBBgwFoAUeF1eqBTjvM21gQbBPUG6HazFSKkwCgYIKoZIzj0E
AwIDSAAwRQIhAPBHmdRNOp+XjL/Tf7F3NW5M5qDqQMQsMbe4I8Y8OloRAiBvhGyL
3jk9ZO09TxJHmAmmRgUUeWyqYbRlN/2S+oEltA==
-----END CERTIFICATE-----`;

const leafCertificatePem = `-----BEGIN CERTIFICATE-----
MIIBvjCCAWSgAwIBAgIRAOA5v9E3KIMcxYhWfwO3mcwwCgYIKoZIzj0EAwIwMzEx
MC8GA1UEAxMoQ2FkZHkgTG9jYWwgQXV0aG9yaXR5IC0gRUNDIEludGVybWVkaWF0
ZTAeFw0yNjA4MDIwMTEwMTJaFw0yNjA4MDIxMzEwMTJaMAAwWTATBgcqhkjOPQIB
BggqhkjOPQMBBwNCAAS6J/HuH82kOFuXRVRfoRG4bEF40jGXah3zB1NS2QAvj5Fv
XlVkJ4oZ1IP1i0j0nQosB68I7qSaXgaUeVZqnCG5o4GLMIGIMA4GA1UdDwEB/wQE
AwIHgDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwHQYDVR0OBBYEFMVe
5x02YxZYBRKBIKQTqz2rldfBMB8GA1UdIwQYMBaAFMKyflhr+O8xl9UIOVRon24M
VSv+MBcGA1UdEQEB/wQNMAuCCWxvY2FsaG9zdDAKBggqhkjOPQQDAgNIADBFAiB3
K4XI8tCFCe1DG6/r0Afg82uX6aR6LzeXso8664eg5AIhAJwkQAPLj8OJzQmpqwsb
azBg/SNC56w1a3PC1TKzMPQS
-----END CERTIFICATE-----`;

function electronFingerprint(certificate) {
  return `sha256/${Buffer.from(
    certificate.fingerprint256.replaceAll(":", ""),
    "hex"
  ).toString("base64")}`;
}

function electronCertificate(pem, issuerCert) {
  const certificate = new X509Certificate(pem);
  return {
    data: certificate.toString(),
    fingerprint: electronFingerprint(certificate),
    issuerCert
  };
}

function electronLocalhostChain() {
  return electronCertificate(
    leafCertificatePem,
    electronCertificate(intermediateCertificatePem)
  );
}

function tlsLocalhostChain() {
  const intermediate = new X509Certificate(intermediateCertificatePem);
  return {
    raw: new X509Certificate(leafCertificatePem).raw,
    issuerCertificate: { raw: intermediate.raw }
  };
}

function rootTrust() {
  const root = new X509Certificate(rootCertificatePem);
  return {
    schemaVersion: 2,
    origin: "https://localhost:4443",
    rootFingerprint256: root.fingerprint256,
    rootCertificatePem: root.toString(),
    expiresAt: new Date(Date.parse(root.validTo)).toISOString()
  };
}

module.exports = {
  electronLocalhostChain,
  leafCertificatePem,
  rootCertificatePem,
  rootTrust,
  tlsLocalhostChain
};
