/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package app.surfark.browser.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import app.surfark.browser.ZenMode
import org.mozilla.fenix.R
import org.mozilla.fenix.components.menu.compose.MenuGroup
import org.mozilla.fenix.components.menu.compose.MenuItem
import pt.dweep.sideraven.SidebarMenu

/**
 * Surfark Browser's entries in Fenix's Main Menu, drawn by a `SURFARK-HOOK` right after Sideraven's
 * own group. For now that is one entry: Zen mode on or off ([ZenMode]).
 *
 * The entry is offered only in a window that shows a Sidebar, because hiding the Sidebar is half of
 * what Zen mode does; it stays offered while Zen mode is on, so there is always a way back.
 * Nothing is drawn in previews. [onChosen] closes the menu.
 */
@Composable
internal fun SurfarkMenuGroup(onChosen: () -> Unit) {
    if (LocalInspectionMode.current) return
    val context = LocalContext.current
    val link = remember(context) { SidebarMenu.of(context) } ?: return
    val zenMode = remember(context) { ZenMode.get(context) }
    val sidebar by link.sidebar.collectAsState()
    val active by zenMode.active.collectAsState()
    val shown = sidebar
    if (shown == null && !active) return
    MenuGroup {
        MenuItem(
            label = stringResource(if (active) R.string.surfark_zen_mode_leave else R.string.surfark_zen_mode_enter),
            beforeIconPainter = painterResource(if (active) R.drawable.surfark_ic_zen_mode_leave_24 else R.drawable.surfark_ic_zen_mode_24),
            onClick = {
                zenMode.toggle(shown?.mode)
                onChosen()
            },
        )
    }
}
