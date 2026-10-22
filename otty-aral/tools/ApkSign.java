import com.android.apksig.ApkSigner;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** apksig кітапханасымен APK-ға v2 қолтаңба қою (minSdk 24 үшін v1 қажет емес). */
public class ApkSign {
    public static void main(String[] args) throws Exception {
        if (args.length < 5) {
            System.err.println("usage: ApkSign <keystore.p12> <password> <alias> <in.apk> <out.apk>");
            System.exit(2);
        }
        char[] pass = args[1].toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(args[0])) {
            ks.load(in, pass);
        }
        PrivateKey key = (PrivateKey) ks.getKey(args[2], pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(args[2]);
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder(
                "OTTYARAL", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(new File(args[3]))
                .setOutputApk(new File(args[4]))
                .setMinSdkVersion(24)
                .setV1SigningEnabled(false)
                .setV2SigningEnabled(true)
                .build()
                .sign();
        System.out.println("signed: " + args[4]);
    }
}
