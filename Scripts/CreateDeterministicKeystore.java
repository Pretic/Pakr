import java.io.OutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.Date;

import sun.security.x509.AlgorithmId;
import sun.security.x509.CertificateAlgorithmId;
import sun.security.x509.CertificateSerialNumber;
import sun.security.x509.CertificateValidity;
import sun.security.x509.CertificateVersion;
import sun.security.x509.CertificateX509Key;
import sun.security.x509.X500Name;
import sun.security.x509.X509CertImpl;
import sun.security.x509.X509CertInfo;

public final class CreateDeterministicKeystore {
    private static final String SIGNATURE_ALGORITHM = "SHA256withRSA";

    private CreateDeterministicKeystore() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 5) {
            throw new IllegalArgumentException(
                "Usage: CreateDeterministicKeystore <out> <alias> <storePass> <keyPass> <seed> [dname]"
            );
        }

        Path out = Path.of(args[0]);
        String alias = args[1];
        char[] storePass = args[2].toCharArray();
        char[] keyPass = args[3].toCharArray();
        String seed = args[4];
        String dname = args.length > 5 ? args[5] : "CN=PakrPre Auto Development Signing,O=PakrPre,C=US";

        SecureRandom random = deterministicRandom(seed);
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048, random);
        KeyPair pair = generator.generateKeyPair();

        X509Certificate certificate = selfSignedCertificate(pair, random, dname);
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        keyStore.load(null, storePass);
        PrivateKey privateKey = pair.getPrivate();
        keyStore.setKeyEntry(alias, privateKey, keyPass, new Certificate[] { certificate });

        Files.createDirectories(out.toAbsolutePath().getParent());
        try (OutputStream stream = Files.newOutputStream(out)) {
            keyStore.store(stream, storePass);
        }
    }

    private static SecureRandom deterministicRandom(String seed) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(seed.getBytes(StandardCharsets.UTF_8));
        SecureRandom random = SecureRandom.getInstance("SHA1PRNG", "SUN");
        random.setSeed(digest);
        return random;
    }

    private static X509Certificate selfSignedCertificate(KeyPair pair, SecureRandom random, String dname) throws Exception {
        Date notBefore = Date.from(Instant.parse("2024-01-01T00:00:00Z"));
        Date notAfter = Date.from(Instant.parse("2124-01-01T00:00:00Z"));
        X500Name owner = new X500Name(dname);
        X509CertInfo info = new X509CertInfo();

        info.set(X509CertInfo.VERSION, new CertificateVersion(CertificateVersion.V3));
        info.set(X509CertInfo.SERIAL_NUMBER, new CertificateSerialNumber(new BigInteger(160, random).abs()));
        info.set(X509CertInfo.SUBJECT, owner);
        info.set(X509CertInfo.ISSUER, owner);
        info.set(X509CertInfo.VALIDITY, new CertificateValidity(notBefore, notAfter));
        info.set(X509CertInfo.KEY, new CertificateX509Key(pair.getPublic()));
        info.set(X509CertInfo.ALGORITHM_ID, new CertificateAlgorithmId(AlgorithmId.get(SIGNATURE_ALGORITHM)));

        X509CertImpl certificate = new X509CertImpl(info);
        certificate.sign(pair.getPrivate(), SIGNATURE_ALGORITHM);
        return certificate;
    }
}
