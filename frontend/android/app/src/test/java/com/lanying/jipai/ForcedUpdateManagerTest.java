package com.lanying.jipai;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import org.junit.Test;

public class ForcedUpdateManagerTest {
    @Test
    public void identifiesOnlyHigherRemoteVersionsAsUpdates() {
        assertTrue(ForcedUpdateManager.isNewerVersion(2, 1));
        assertFalse(ForcedUpdateManager.isNewerVersion(1, 1));
        assertFalse(ForcedUpdateManager.isNewerVersion(1, 2));
    }

    @Test
    public void acceptsOnlyLowercaseSha256Digests() {
        assertTrue(ForcedUpdateManager.isValidSha256("a".repeat(64)));
        assertFalse(ForcedUpdateManager.isValidSha256("A".repeat(64)));
        assertFalse(ForcedUpdateManager.isValidSha256("not-a-digest"));
    }

    @Test
    public void hashesDownloadedBytesBeforeInstallation() throws Exception {
        ByteArrayInputStream content = new ByteArrayInputStream("hello".getBytes(StandardCharsets.UTF_8));

        assertEquals(
                "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
                ForcedUpdateManager.sha256ForStream(content)
        );
    }

    @Test
    public void leavesUpdateManifestDisabledWithoutLocalBuildConfiguration() {
        assertEquals("", BuildConfig.ANDROID_UPDATE_MANIFEST_URL);
    }
}
