package se.tjeneritz.imposter;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PredictiveBackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
