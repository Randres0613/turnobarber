package com.turnobarber.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.Toast;
import android.graphics.Color;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    private static final long CUSTOM_SPLASH_DURATION_MS = 1400L;
    private static final long CUSTOM_SPLASH_FADE_MS = 250L;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(
                new TurnoBarberAndroidBridge(this),
                "TurnoBarberAndroid"
            );
        }

        showTurnoBarberSplash();
    }

    private void showTurnoBarberSplash() {
        final FrameLayout content = findViewById(android.R.id.content);
        if (content == null) {
            return;
        }

        final FrameLayout splashOverlay = new FrameLayout(this);
        splashOverlay.setBackgroundColor(Color.rgb(23, 32, 51));
        splashOverlay.setAlpha(1f);

        final ImageView splashImage = new ImageView(this);
        splashImage.setImageResource(R.drawable.splash_final);
        splashImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
        splashImage.setAdjustViewBounds(false);
        splashImage.setBackgroundColor(Color.rgb(23, 32, 51));

        splashOverlay.addView(
            splashImage,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        content.addView(
            splashOverlay,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            splashOverlay.animate()
                .alpha(0f)
                .setDuration(CUSTOM_SPLASH_FADE_MS)
                .withEndAction(() -> {
                    if (splashOverlay.getParent() != null) {
                        content.removeView(splashOverlay);
                    }
                })
                .start();
        }, CUSTOM_SPLASH_DURATION_MS);
    }

    private static final class TurnoBarberAndroidBridge {

        private final MainActivity activity;

        TurnoBarberAndroidBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public boolean saveFile(String dataUrl, String filename, String mimeType) {
            if (dataUrl == null || dataUrl.isEmpty()) {
                showToast("No fue posible preparar el archivo.");
                return false;
            }

            try {
                String base64Data = dataUrl;
                int commaIndex = base64Data.indexOf(',');
                if (commaIndex >= 0) {
                    base64Data = base64Data.substring(commaIndex + 1);
                }

                byte[] fileData = Base64.decode(base64Data, Base64.DEFAULT);
                String safeFilename = sanitizeFilename(filename);
                String safeMimeType = (mimeType == null || mimeType.trim().isEmpty())
                    ? "application/octet-stream"
                    : mimeType.trim();

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    return saveToDownloads(fileData, safeFilename, safeMimeType);
                }

                return saveToAppDownloads(fileData, safeFilename);
            } catch (Exception error) {
                android.util.Log.e("TurnoBarber360", "Error guardando archivo", error);
                showToast("No fue posible guardar el archivo.");
                return false;
            }
        }

        private boolean saveToDownloads(byte[] fileData, String filename, String mimeType) {
            ContentResolver resolver = activity.getContentResolver();
            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;

            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(
                MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/TurnoBarber 360"
            );
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri fileUri = resolver.insert(collection, values);
            if (fileUri == null) {
                showToast("No fue posible crear el archivo.");
                return false;
            }

            try (OutputStream outputStream = resolver.openOutputStream(fileUri)) {
                if (outputStream == null) {
                    throw new IllegalStateException("No se pudo abrir el archivo.");
                }

                outputStream.write(fileData);
                outputStream.flush();

                ContentValues completedValues = new ContentValues();
                completedValues.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(fileUri, completedValues, null, null);

                showToast("Archivo guardado en Descargas/TurnoBarber 360");
                return true;
            } catch (Exception error) {
                resolver.delete(fileUri, null, null);
                android.util.Log.e("TurnoBarber360", "Error escribiendo en Descargas", error);
                showToast("No fue posible guardar el archivo.");
                return false;
            }
        }

        private boolean saveToAppDownloads(byte[] fileData, String filename) {
            File downloadsDirectory = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadsDirectory == null) {
                showToast("No fue posible acceder al almacenamiento.");
                return false;
            }

            File appDirectory = new File(downloadsDirectory, "TurnoBarber 360");
            if (!appDirectory.exists() && !appDirectory.mkdirs()) {
                showToast("No fue posible crear la carpeta de archivos.");
                return false;
            }

            File outputFile = new File(appDirectory, filename);

            try (FileOutputStream outputStream = new FileOutputStream(outputFile)) {
                outputStream.write(fileData);
                outputStream.flush();
                showToast("Archivo guardado en el almacenamiento de TurnoBarber 360");
                return true;
            } catch (Exception error) {
                android.util.Log.e("TurnoBarber360", "Error guardando archivo local", error);
                showToast("No fue posible guardar el archivo.");
                return false;
            }
        }

        private String sanitizeFilename(String filename) {
            String result = filename == null ? "archivo" : filename.trim();
            result = result.replaceAll("[\\/:*?\"<>|\\p{Cntrl}]", "_");

            if (result.isEmpty() || result.equals(".") || result.equals("..")) {
                result = "archivo";
            }

            if (result.length() > 150) {
                result = result.substring(0, 150);
            }

            return result;
        }

        private void showToast(final String message) {
            activity.runOnUiThread(() ->
                Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
            );
        }
    }
}
