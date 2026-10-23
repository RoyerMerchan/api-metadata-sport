package com.footlab.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "FootlabVault")
public class FootlabVaultPlugin extends Plugin {
    private static final String ALIAS = "footlab.refresh.v1";
    private SharedPreferences prefs() { return getContext().getSharedPreferences("footlab_vault", Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }
    @PluginMethod public synchronized void set(PluginCall call) {
        String value = call.getString("value");
        if (value == null || value.length() > 4096) { call.reject("Token inválido"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            boolean saved = prefs().edit().putString("cipher", Base64.encodeToString(encrypted, Base64.NO_WRAP)).putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).commit();
            if (!saved) { call.reject("No se pudo guardar la sesión"); return; } call.resolve();
        } catch (Exception error) { call.reject("No se pudo cifrar la sesión"); }
    }
    @PluginMethod public synchronized void get(PluginCall call) {
        String encrypted = prefs().getString("cipher", null); String iv = prefs().getString("iv", null);
        if (encrypted == null || iv == null) { call.resolve(new JSObject()); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            String value = new String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8);
            JSObject result = new JSObject(); result.put("value", value); call.resolve(result);
        } catch (Exception error) { prefs().edit().clear().commit(); call.resolve(new JSObject()); }
    }
    @PluginMethod public synchronized void clear(PluginCall call) { if (prefs().edit().clear().commit()) call.resolve(); else call.reject("No se pudo borrar la sesión"); }
}
