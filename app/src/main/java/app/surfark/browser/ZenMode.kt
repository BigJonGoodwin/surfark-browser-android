/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package app.surfark.browser

import android.content.Context
import android.os.StrictMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pt.dweep.sideraven.FullScreen
import pt.dweep.sideraven.PreferencesSettingsBackend
import pt.dweep.sideraven.PreferencesSidebarModeStore
import pt.dweep.sideraven.SettingsBackend
import pt.dweep.sideraven.SidebarMode
import pt.dweep.sideraven.SidebarModeStore

/**
 * Zen mode: one tap gives the page the whole screen, a second tap puts everything back.
 *
 * It is not a new display mode of its own. Sideraven already has the two settings that matter:
 * the Sidebar Mode (Auto-Hide keeps the Sidebar off screen until it is pulled in) and Full screen
 * (hides Android's status and navigation bars). Zen mode sets both at once and remembers what
 * they were, so leaving it restores exactly the previous layout. Because it only writes
 * Sideraven's own settings, everything that already follows them (the Sidebar, the system bars,
 * split-screen windows) reacts without any further hook.
 *
 * What it remembers is kept in [memory] (its own small preference file on a device), so Zen mode
 * survives the app being closed and can still be left afterwards.
 *
 * If the user changes one of the two settings by hand while Zen mode is on, leaving Zen mode
 * keeps their newer choice for that setting instead of overwriting it.
 */
class ZenMode(
    private val store: SidebarModeStore,
    private val memory: SettingsBackend,
) {
    private val state = MutableStateFlow(memory.getBoolean(KEY_ACTIVE, false))

    /** Whether Zen mode is on. */
    val active: StateFlow<Boolean> = state.asStateFlow()

    /** Turns Zen mode on if it is off and off if it is on. [shownMode]: the Sidebar Mode on screen now. */
    fun toggle(shownMode: SidebarMode?) {
        if (state.value) leave() else enter(shownMode)
    }

    /**
     * Hides the Sidebar and the system bars, remembering the layout to come back to.
     * [shownMode] is the Sidebar Mode on screen; it is what "previous" means when the user has
     * never chosen a mode themselves (Sideraven then shows a default that depends on the screen).
     */
    fun enter(shownMode: SidebarMode?) {
        if (state.value) return
        memory.putString(KEY_PREVIOUS_MODE, (store.chosenMode.value ?: shownMode)?.name.orEmpty())
        memory.putString(KEY_PREVIOUS_FULL_SCREEN, store.fullScreen.value.name)
        store.chosenMode.set(SidebarMode.AutoHide)
        store.fullScreen.set(FullScreen.Both)
        setActive(true)
    }

    /** Brings back the layout from before [enter], except for a setting the user changed since. */
    fun leave() {
        if (!state.value) return
        val previousMode = memory.getString(KEY_PREVIOUS_MODE)?.let { stored -> SidebarMode.entries.firstOrNull { it.name == stored } }
        val previousFullScreen =
            memory.getString(KEY_PREVIOUS_FULL_SCREEN)?.let { stored -> FullScreen.entries.firstOrNull { it.name == stored } } ?: FullScreen.Off
        if (store.chosenMode.value == SidebarMode.AutoHide && previousMode != null) store.chosenMode.set(previousMode)
        if (store.fullScreen.value == FullScreen.Both) store.fullScreen.set(previousFullScreen)
        setActive(false)
    }

    private fun setActive(active: Boolean) {
        memory.putBoolean(KEY_ACTIVE, active)
        state.value = active
    }

    companion object {
        private const val PREFS = "surfark_browser"
        private const val KEY_ACTIVE = "zen_mode_active"
        private const val KEY_PREVIOUS_MODE = "zen_mode_previous_sidebar_mode"
        private const val KEY_PREVIOUS_FULL_SCREEN = "zen_mode_previous_full_screen"

        @Volatile private var instance: ZenMode? = null

        /** The app's one Zen mode, over Sideraven's settings and Surfark's own preference file. */
        fun get(context: Context): ZenMode =
            instance ?: synchronized(this) {
                instance ?: create(context.applicationContext).also { instance = it }
            }

        private fun create(context: Context): ZenMode {
            // The first read of a small preference file can land on the main thread; debug builds
            // treat that as fatal unless it is allowed for the moment (Sideraven does the same).
            val old = StrictMode.allowThreadDiskReads()
            try {
                val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                return ZenMode(PreferencesSidebarModeStore.get(context), PreferencesSettingsBackend(prefs))
            } finally {
                StrictMode.setThreadPolicy(old)
            }
        }
    }
}
