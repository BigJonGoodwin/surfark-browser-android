/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package pt.dweep.sideraven.benchmark

import android.net.Uri
import androidx.benchmark.macro.MacrobenchmarkScope
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.Until

/** The release-style Sideraven build (`forkRelease`), the app these journeys drive. */
const val SIDERAVEN_PACKAGE = "app.surfark.browser" // SURFARK-HOOK: Surfark Browser's app ID

private const val WAIT_MS = 5_000L

/** Time for a newly opened tab to start loading before the next one opens. */
private const val OPEN_TAB_SETTLE_MS = 1_500L

// The Sidebar exposes its test tags as resource ids, so UiAutomator finds them by name.
private val sidebarRoot = By.res("sidebar.root")
private val tabList = By.res("sidebar.tabList")
private val tabItem = By.res("sidebar.tabItem")

/** Cold start until the Sidebar is drawn. */
fun MacrobenchmarkScope.sideravenStartupJourney() {
    pressHome()
    startActivityAndWait()
    device.wait(Until.hasObject(sidebarRoot), WAIT_MS)
}

/** Opens [urls] as tabs (from links, so they land in the Tab List), then returns to the first. */
fun MacrobenchmarkScope.openTabsJourney(urls: List<Uri>) {
    // Through the shell: a link handed to the running app isn't a new launch, so startActivityAndWait
    // would never see one complete.
    urls.forEach { url ->
        device.executeShellCommand("am start -a android.intent.action.VIEW -d $url -p $packageName")
        device.waitForIdle()
        Thread.sleep(OPEN_TAB_SETTLE_MS)
    }
    device.wait(Until.hasObject(tabItem), WAIT_MS)
}

/** Switches between tabs by tapping rows in the Tab List. */
fun MacrobenchmarkScope.switchTabsJourney(times: Int = 6) {
    repeat(times) { i ->
        val rows = device.findObjects(tabItem)
        if (rows.size < 2) return
        rows[i % rows.size].click()
        device.waitForIdle()
    }
}

/** Flings the Tab List to its end and back. */
fun MacrobenchmarkScope.scrollTabListJourney() {
    val list = device.findObject(tabList) ?: return
    list.setGestureMargin(device.displayWidth / 20)
    list.fling(Direction.DOWN)
    device.waitForIdle()
    list.fling(Direction.UP)
    device.waitForIdle()
}
