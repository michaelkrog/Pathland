package com.pathland.demo;

import com.pathland.view.FontSize;
import com.pathland.view.FontWeight;
import com.pathland.view.FontWeightMod;
import com.pathland.view.Padding;
import com.pathland.view.Text;
import com.pathland.view.VStack;
import com.pathland.view.View;

/**
 * The Home content area of the {@code SplitNavDemo}: a titled welcome pane with a short
 * description. Router-free and self-contained (the sidebar owns all navigation), so it is
 * instantiated inline in the route table as {@code new HomeView()}.
 */
public final class HomeView implements View {

    @Override
    public View body() {
        return VStack.of(
                Text.of("Home").modifiers(FontSize.of(24), FontWeightMod.of(FontWeight.BOLD)),
                Text.of("A master-detail (split) navigation demo: the menu on the left "
                        + "drives the content area on the right.").modifier(Padding.of(8))
        ).modifier(Padding.of(24));
    }
}