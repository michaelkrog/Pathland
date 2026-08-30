package com.pathland.view;

/**
 * the image source (a {@code STRING} property).
 */
public final class ImageSource implements ViewModifier {

    private final String value;

    private ImageSource(String value) {
        this.value = value;
    }

    public static ImageSource of(String value) {
        return new ImageSource(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.IMAGE_SOURCE, value));
    }
}
