package arcs.core.host

import arcs.core.data.EntityType
import arcs.core.data.Plan
import arcs.core.data.Ttl
import arcs.core.entity.DummyEntity
import arcs.core.entity.EntityBaseSpec
import arcs.core.entity.ReadWriteSingletonHandle
import arcs.core.host.api.HandleHolder
import arcs.core.storage.driver.RamDisk
import arcs.core.storage.driver.RamDiskDriverProvider
import arcs.core.storage.keys.RamDiskStorageKey
import arcs.core.storage.referencemode.ReferenceModeStorageKey
import arcs.jvm.host.JvmSchedulerProvider
import arcs.jvm.util.testutil.FakeTime
import arcs.sdk.BaseParticle
import arcs.sdk.HandleHolderBase
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4

@RunWith(JUnit4::class)
@OptIn(ExperimentalCoroutinesApi::class)
open class AbstractArcHostTest {

    class TestParticle : BaseParticle() {
        override val handles: HandleHolder =
            HandleHolderBase("TestParticle", mapOf("foo" to EntityBaseSpec(DummyEntity.SCHEMA)))
    }

    class MyTestHost(
        schedulerProvider: SchedulerProvider,
        vararg particles: ParticleRegistration
    ) : AbstractArcHost(schedulerProvider, *particles) {
        override val platformTime = FakeTime()

        fun getFooHandle(): ReadWriteSingletonHandle<DummyEntity> =
            getArcHostContext("arcId")!!.particles["Foobar"]!!.handles["foo"]!!
                as ReadWriteSingletonHandle<DummyEntity>
    }

    @Before
    fun setUp() {
        RamDisk.clear()
        RamDiskStorageKey.registerKeyCreator()
        RamDiskDriverProvider()
    }

    @Test
    fun pause_Unpause() = runBlocking {
        val schedulerProvider = JvmSchedulerProvider(coroutineContext)
        val host = MyTestHost(schedulerProvider)
        val partition = Plan.Partition("arcId", "arcHost", listOf())
        val partition2 = Plan.Partition("arcId2", "arcHost", listOf())
        val partition3 = Plan.Partition("arcId3", "arcHost", listOf())
        host.startArc(partition)
        assertThat(host.lookupArcHostStatus(partition)).isEqualTo(ArcState.Running)

        host.pause()

        assertThat(host.lookupArcHostStatus(partition)).isEqualTo(ArcState.Stopped)
        // Start while in pause, should only start after unpause().
        host.startArc(partition2)
        assertThat(host.lookupArcHostStatus(partition2)).isEqualTo(ArcState.NeverStarted)
        // Resurrect while in pause, should only start after unpause().
        host.onResurrected("arcId3", listOf())
        assertThat(host.lookupArcHostStatus(partition3)).isEqualTo(ArcState.NeverStarted)

        host.unpause()

        assertThat(host.lookupArcHostStatus(partition)).isEqualTo(ArcState.Running)
        assertThat(host.lookupArcHostStatus(partition2)).isEqualTo(ArcState.Running)
        assertThat(host.lookupArcHostStatus(partition3)).isEqualTo(ArcState.Running)

        schedulerProvider.cancelAll()
    }

    // Regression test for b/152713120.
    @Test
    fun ttlUsed() = runBlocking {
        val schedulerProvider = JvmSchedulerProvider(coroutineContext)
        val host = MyTestHost(schedulerProvider, ::TestParticle.toRegistration())
        val handleConnection = Plan.HandleConnection(
            ReferenceModeStorageKey(
                backingKey = RamDiskStorageKey("backing"),
                storageKey = RamDiskStorageKey("container")
            ),
            HandleMode.ReadWrite,
            EntityType(DummyEntity.SCHEMA),
            Ttl.Minutes(2)
        )
        val particle = Plan.Particle(
            "Foobar",
            "arcs.core.host.AbstractArcHostTest.TestParticle",
            mapOf("foo" to handleConnection)
        )
        val partition = Plan.Partition("arcId", "arcHost", listOf(particle))
        host.startArc(partition)

        // Verify that the created handle use the TTL config to set an expiry time.
        val entity = DummyEntity()
        host.getFooHandle().store(entity)
        // Should expire in 2 minutes.
        val expectedExpiry = 2 * 60 * 1000 + FakeTime().currentTimeMillis
        assertThat(entity.expirationTimestamp).isEqualTo(expectedExpiry)

        schedulerProvider.cancelAll()
    }
}
