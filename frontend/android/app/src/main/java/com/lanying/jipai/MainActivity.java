package com.lanying.jipai;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private ForcedUpdateManager forcedUpdateManager;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        forcedUpdateManager = new ForcedUpdateManager(this);
        forcedUpdateManager.checkForUpdate();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (forcedUpdateManager != null) {
            forcedUpdateManager.onResume();
        }
    }

    @Override
    public void onDestroy() {
        if (forcedUpdateManager != null) {
            forcedUpdateManager.onDestroy();
        }
        super.onDestroy();
    }
}
