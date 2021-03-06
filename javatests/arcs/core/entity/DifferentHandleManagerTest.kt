package arcs.core.entity

import arcs.core.host.EntityHandleManager
import arcs.core.storage.StoreManager
import arcs.core.storage.StoreWriteBack
import arcs.core.storage.testutil.WriteBackForTesting
import arcs.jvm.host.JvmSchedulerProvider
import kotlin.coroutines.EmptyCoroutineContext
import org.junit.After
import org.junit.Before
import org.junit.Ignore
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4

@Suppress("EXPERIMENTAL_API_USAGE")
@RunWith(JUnit4::class)
class DifferentHandleManagerTest : HandleManagerTestBase() {
    private var i = 0

    @Before
    override fun setUp() {
        super.setUp()
        val stores = StoreManager()
        i++
        StoreWriteBack.writeBackFactoryOverride = WriteBackForTesting
        schedulerProvider = JvmSchedulerProvider(EmptyCoroutineContext)
        readHandleManager = EntityHandleManager(
            arcId = "testArc",
            hostId = "testHost",
            time = fakeTime,
            scheduler = schedulerProvider("reader-#$i"),
            stores = stores
        )
        writeHandleManager = EntityHandleManager(
            arcId = "testArc",
            hostId = "testHost",
            time = fakeTime,
            scheduler = schedulerProvider("writer-#$i"),
            stores = stores
        )
    }

    @After
    override fun tearDown() = super.tearDown()

    @Ignore("b/156435662 - Deflake")
    @Test
    override fun collection_referenceLiveness() {
        super.collection_referenceLiveness()
    }

    @Ignore("b/157189120 - Deflake")
    @Test
    override fun collection_clearingElementsFromA_clearsThemFromB() {
        super.collection_clearingElementsFromA_clearsThemFromB()
    }

    @Ignore("b/157266634 - Deflake")
    @Test
    override fun collection_noTTL() {
        super.collection_noTTL()
    }

    @Ignore("b/157266865 - Deflake")
    @Test
    override fun singleton_referenceLiveness() {
        super.singleton_referenceLiveness()
    }

    @Ignore("b/157266455 - Deflake")
    @Test
    override fun singleton_clearOnAClearDataWrittenByB() {
        super.singleton_clearOnAClearDataWrittenByB()
    }

    @Ignore("b/157266985 - Deflake")
    @Test
    override fun singleton_dereferenceEntity() {
        super.singleton_dereferenceEntity()
    }

    @Ignore("b/157269790 - Deflake")
    @Test
    override fun collection_addingToA_showsUpInB() {
        super.collection_addingToA_showsUpInB()
    }
}
