/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package app.surfark.browser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pt.dweep.sideraven.FullScreen
import pt.dweep.sideraven.InMemorySettingsBackend
import pt.dweep.sideraven.InMemorySidebarModeStore
import pt.dweep.sideraven.SidebarMode

/** Zen mode: what it sets, what it remembers, and what it leaves alone. */
class ZenModeTest {
    private val store = InMemorySidebarModeStore()
    private val memory = InMemorySettingsBackend()
    private val zenMode = ZenMode(store, memory)

    @Test
    fun `WHEN Zen mode is entered THEN the Sidebar auto-hides and both system bars are hidden`() {
        store.chosenMode.set(SidebarMode.Persistent)

        zenMode.enter(SidebarMode.Persistent)

        assertTrue(zenMode.active.value)
        assertEquals(SidebarMode.AutoHide, store.chosenMode.value)
        assertEquals(FullScreen.Both, store.fullScreen.value)
    }

    @Test
    fun `WHEN Zen mode is left THEN the previous Sidebar Mode and Full screen setting come back`() {
        store.chosenMode.set(SidebarMode.Collapsed)
        store.fullScreen.set(FullScreen.StatusBar)

        zenMode.toggle(SidebarMode.Collapsed)
        zenMode.toggle(SidebarMode.AutoHide)

        assertFalse(zenMode.active.value)
        assertEquals(SidebarMode.Collapsed, store.chosenMode.value)
        assertEquals(FullScreen.StatusBar, store.fullScreen.value)
    }

    @Test
    fun `GIVEN the user never chose a Sidebar Mode WHEN Zen mode is left THEN the mode that was on screen comes back`() {
        assertNull(store.chosenMode.value)

        zenMode.enter(SidebarMode.Persistent)
        zenMode.leave()

        assertEquals(SidebarMode.Persistent, store.chosenMode.value)
        assertEquals(FullScreen.Off, store.fullScreen.value)
    }

    @Test
    fun `GIVEN the layout already matched Zen mode WHEN it is entered and left THEN nothing changes`() {
        store.chosenMode.set(SidebarMode.AutoHide)
        store.fullScreen.set(FullScreen.Both)

        zenMode.enter(SidebarMode.AutoHide)
        zenMode.leave()

        assertEquals(SidebarMode.AutoHide, store.chosenMode.value)
        assertEquals(FullScreen.Both, store.fullScreen.value)
    }

    @Test
    fun `GIVEN the user changed a setting during Zen mode WHEN it is left THEN their newer choice stays`() {
        store.chosenMode.set(SidebarMode.Persistent)
        zenMode.enter(SidebarMode.Persistent)

        store.chosenMode.set(SidebarMode.Collapsed)
        store.fullScreen.set(FullScreen.StatusBar)
        zenMode.leave()

        assertEquals(SidebarMode.Collapsed, store.chosenMode.value)
        assertEquals(FullScreen.StatusBar, store.fullScreen.value)
    }

    @Test
    fun `WHEN enter or leave is repeated THEN the remembered layout is not overwritten`() {
        store.chosenMode.set(SidebarMode.Persistent)

        zenMode.enter(SidebarMode.Persistent)
        zenMode.enter(SidebarMode.AutoHide)
        zenMode.leave()
        zenMode.leave()

        assertEquals(SidebarMode.Persistent, store.chosenMode.value)
        assertEquals(FullScreen.Off, store.fullScreen.value)
    }

    @Test
    fun `GIVEN the app was closed in Zen mode WHEN it starts again THEN Zen mode is still on and can be left`() {
        store.chosenMode.set(SidebarMode.Collapsed)
        zenMode.enter(SidebarMode.Collapsed)

        val afterRestart = ZenMode(store, memory)

        assertTrue(afterRestart.active.value)
        afterRestart.leave()
        assertEquals(SidebarMode.Collapsed, store.chosenMode.value)
        assertEquals(FullScreen.Off, store.fullScreen.value)
    }
}
