/*
 * Copyright 2020 Google LLC.
 *
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 *
 * Code distributed by Google as part of this project is also subject to an additional IP rights
 * grant found at
 * http://polymer.github.io/PATENTS.txt
 */
package arcs.core.host

import arcs.core.allocator.Allocator
import arcs.core.allocator.Arc
import arcs.core.data.Plan
import arcs.core.storage.StoreManager
import arcs.core.storage.api.DriverAndKeyConfigurator
import arcs.core.storage.driver.RamDisk
import arcs.core.util.Scheduler
import arcs.jvm.host.ExplicitHostRegistry
import arcs.jvm.host.JvmSchedulerProvider
import arcs.jvm.util.testutil.FakeTime
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4
import kotlin.coroutines.EmptyCoroutineContext

// TODO: test errors in lifecycle methods
// TODO: test desync/resync

@RunWith(JUnit4::class)
@OptIn(ExperimentalCoroutinesApi::class)
class LifecycleTest {
    private val schedulerProvider = JvmSchedulerProvider(EmptyCoroutineContext)

    private lateinit var scheduler: Scheduler
    private lateinit var testHost: TestingHost
    private lateinit var hostRegistry: HostRegistry
    private lateinit var storeManager: StoreManager
    private lateinit var entityHandleManager: EntityHandleManager
    private lateinit var allocator: Allocator

    private fun runTest(
        testBody: suspend CoroutineScope.() -> Unit
    ) = runBlocking(EmptyCoroutineContext) { testBody() }

    @Before
    fun setUp() = runBlocking {
        DriverAndKeyConfigurator.configure(null)
        scheduler = schedulerProvider("test")
        testHost = TestingHost(
            schedulerProvider,
            ::SingleReadHandleParticle.toRegistration(),
            ::SingleWriteHandleParticle.toRegistration(),
            ::MultiHandleParticle.toRegistration(),
            ::PausingParticle.toRegistration()
        )
        hostRegistry = ExplicitHostRegistry().also { it.registerHost(testHost) }
        storeManager = StoreManager()
        entityHandleManager = EntityHandleManager(
            time = FakeTime(),
            scheduler = scheduler,
            stores = storeManager
        )
        allocator = Allocator.create(hostRegistry, entityHandleManager)
        testHost.setup()
    }

    @After
    fun tearDown() = runBlocking {
        scheduler.waitForIdle()
        storeManager.waitForIdle()
        entityHandleManager.close()
        RamDisk.clear()
    }

    /**
     * Asserts that a list of values matches a sequence of groups, where a List group must be in
     * order while a Set group may be any order. For example:
     *   assertVariableOrdering(listOf(1, 2, 77, 55, 66, 3, 4),
     *                          listOf(1, 2), setOf(55, 66, 77), listOf(3, 4)) => matches
     * TODO: improve error reporting, move to general testutil?
     */
    fun <T> assertVariableOrdering(actual: List<T>, vararg groups: Collection<T>) {
        val expectedSize = groups.fold(0) { sum, group -> sum + group.size }
        if (expectedSize != actual.size) {
            fail("expected $expectedSize elements but found ${actual.size}: $actual")
        }

        var start = 0
        for (group in groups) {
            val slice = actual.subList(start, start + group.size)
            when (group) {
                is List -> assertThat(slice).isEqualTo(group)
                is Set -> assertThat(slice).containsExactlyElementsIn(group)
                else -> throw IllegalArgumentException(
                    "assertVariableOrdering: only List and Set may be used " +
                        "for the 'groups' argument"
                )
            }
            start += group.size
        }
    }

    private suspend fun startArc(plan: Plan): Arc {
        val arc = allocator.startArcForPlan(plan).waitForStart()
        waitForAllTheThings()
        return arc
    }

    private suspend fun waitForAllTheThings() {
        scheduler.waitForIdle()
        storeManager.waitForIdle()
    }

    @Test
    fun singleReadHandle() = runTest {
        val name = "SingleReadHandleParticle"
        val arc = startArc(SingleReadHandleTestPlan)
        val particle: SingleReadHandleParticle = testHost.getParticle(arc.id, name)
        val data = testHost.singletonForTest<SingleReadHandleParticle_Data>(arc.id, name, "data")
        data.store(SingleReadHandleParticle_Data(5.0))
        waitForAllTheThings()
        arc.stop()
        arc.waitForStop()
        assertThat(particle.events).isEqualTo(listOf(
            "onFirstStart",
            "onStart",
            "data.onReady:null",
            "onReady:null",
            "data.onUpdate:5.0",
            "onUpdate:5.0",
            "onShutdown"
        ))
    }

    @Test
    fun singleWriteHandle() = runTest {
        val name = "SingleWriteHandleParticle"
        val arc = startArc(SingleWriteHandleTestPlan)
        val particle: SingleWriteHandleParticle = testHost.getParticle(arc.id, name)
        val data = testHost.singletonForTest<SingleWriteHandleParticle_Data>(arc.id, name, "data")
        data.store(SingleWriteHandleParticle_Data(12.0))
        waitForAllTheThings()
        arc.stop()
        arc.waitForStop()
        assertThat(particle.events)
            .isEqualTo(listOf("onFirstStart", "onStart", "onReady", "onShutdown"))
    }

    @Test
    fun multiHandle() = runTest {
        val name = "MultiHandleParticle"
        val arc = startArc(MultiHandleTestPlan)
        val particle: MultiHandleParticle = testHost.getParticle(arc.id, name)
        val data = testHost.singletonForTest<MultiHandleParticle_Data>(arc.id, name, "data")
        val list = testHost.collectionForTest<MultiHandleParticle_List>(arc.id, name, "list")
        val result = testHost.collectionForTest<MultiHandleParticle_Result>(arc.id, name, "result")
        val config = testHost.singletonForTest<MultiHandleParticle_Config>(arc.id, name, "config")

        data.store(MultiHandleParticle_Data(3.2))
        waitForAllTheThings()
        list.store(MultiHandleParticle_List("hi"))
        waitForAllTheThings()
        // Write-only handle ops do not trigger any lifecycle APIs.
        result.store(MultiHandleParticle_Result(19.0))
        waitForAllTheThings()
        config.store(MultiHandleParticle_Config(true))
        waitForAllTheThings()
        arc.stop()
        arc.waitForStop()

        assertVariableOrdering(
            particle.events,
            listOf("onFirstStart", "onStart"),
            // Handle onReady events are not guaranteed to be in any specific order.
            setOf("data.onReady:null", "list.onReady:[]", "config.onReady:null"),
            listOf(
                "onReady:null:[]:null",
                "data.onUpdate:3.2",
                "onUpdate:3.2:[]:null",
                "list.onUpdate:[hi]",
                "onUpdate:3.2:[hi]:null",
                "config.onUpdate:true",
                "onUpdate:3.2:[hi]:true",
                "onShutdown"
            )
        )
    }

    @Test
    fun pausing() = runTest {
        val name = "PausingParticle"
        val arc = startArc(PausingTestPlan)

        // Test handles use the same storage proxies as the real handles which will be closed
        // when the arc is paused, so we need to re-create them after unpausing.
        // TODO: allow test handles to persist across arc shutdown?
        val makeHandles = suspend {
            Pair(
                testHost.singletonForTest<PausingParticle_Data>(arc.id, name, "data"),
                testHost.collectionForTest<PausingParticle_List>(arc.id, name, "list")
            )
        }
        val (data1, list1) = makeHandles()
        data1.store(PausingParticle_Data(1.1))
        list1.store(PausingParticle_List("first"))
        waitForAllTheThings()

        testHost.pause()
        testHost.unpause()

        val particle: PausingParticle = testHost.getParticle(arc.id, name)
        val (data2, list2) = makeHandles()
        data2.store(PausingParticle_Data(2.2))
        waitForAllTheThings()
        list2.store(PausingParticle_List("second"))
        waitForAllTheThings()
        arc.stop()
        arc.waitForStop()

        assertVariableOrdering(
            particle.events,
            // No onFirstStart.
            listOf("onStart"),
            // Values stored in the previous session should still be present.
            setOf("data.onReady:1.1", "list.onReady:[first]"),
            listOf(
                "onReady:1.1:[first]",
                "data.onUpdate:2.2",
                "onUpdate:2.2:[first]",
                "list.onUpdate:[first, second]",
                "onUpdate:2.2:[first, second]",
                "onShutdown"
            )
        )
    }
}
