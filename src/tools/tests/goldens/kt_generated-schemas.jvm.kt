/* ktlint-disable */
@file:Suppress("PackageName", "TopLevelName")

package arcs.golden

//
// GENERATED CODE -- DO NOT EDIT
//
// Current implementation doesn't support optional field detection

import arcs.core.data.*
import arcs.core.data.util.ReferencablePrimitive
import arcs.core.data.util.toReferencable
import arcs.core.entity.Reference
import arcs.core.entity.SchemaRegistry
import arcs.core.entity.Tuple1
import arcs.core.entity.Tuple2
import arcs.core.entity.Tuple3
import arcs.core.entity.Tuple4
import arcs.core.entity.Tuple5
import arcs.core.entity.toPrimitiveValue
import arcs.sdk.*

typealias KotlinPrimitivesGolden_Data_Ref = AbstractKotlinPrimitivesGolden.KotlinPrimitivesGolden_Data_Ref
typealias KotlinPrimitivesGolden_Data = AbstractKotlinPrimitivesGolden.KotlinPrimitivesGolden_Data

abstract class AbstractKotlinPrimitivesGolden : BaseParticle() {
    override val handles: Handles = Handles()


    @Suppress("UNCHECKED_CAST")
    class KotlinPrimitivesGolden_Data_Ref(
        val_: String = "",
        entityId: String? = null,
        creationTimestamp: Long = RawEntity.UNINITIALIZED_TIMESTAMP,
        expirationTimestamp:  Long = RawEntity.UNINITIALIZED_TIMESTAMP
    ) : EntityBase(
    "KotlinPrimitivesGolden_Data_Ref",
    SCHEMA,
    entityId,
    creationTimestamp,
    expirationTimestamp
) {

        var val_: String
            get() = super.getSingletonValue("val") as String? ?: ""
            private set(_value) = super.setSingletonValue("val", _value)

        init {
            this.val_ = val_
        }
        /**
         * Use this method to create a new, distinctly identified copy of the entity.
         * Storing the copy will result in a new copy of the data being stored.
         */
        fun copy(val_: String = this.val_) = KotlinPrimitivesGolden_Data_Ref(val_ = val_)
        /**
         * Use this method to create a new version of an existing entity.
         * Storing the mutation will overwrite the existing entity in the set, if it exists.
         */
        fun mutate(val_: String = this.val_) = KotlinPrimitivesGolden_Data_Ref(
            val_ = val_,
            entityId = entityId,
            creationTimestamp = creationTimestamp,
            expirationTimestamp = expirationTimestamp
        )

        companion object : EntitySpec<KotlinPrimitivesGolden_Data_Ref> {

            override val SCHEMA = Schema(
                setOf(),
                SchemaFields(
                    singletons = mapOf("val" to FieldType.Text),
                    collections = emptyMap()
                ),
                "485712110d89359a3e539dac987329cd2649d889",
                refinement = { _ -> true },
                query = null
            )

            private val nestedEntitySpecs: Map<String, EntitySpec<out Entity>> =
                emptyMap()

            init {
                SchemaRegistry.register(SCHEMA)
            }

            override fun deserialize(data: RawEntity) = KotlinPrimitivesGolden_Data_Ref().apply {
                deserialize(data, nestedEntitySpecs)
            }
        }
    }

    @Suppress("UNCHECKED_CAST")
    class KotlinPrimitivesGolden_Data(
        num: Double = 0.0,
        txt: String = "",
        lnk: String = "",
        flg: Boolean = false,
        ref: Reference<KotlinPrimitivesGolden_Data_Ref>? = null,
        bt: Byte = 0.toByte(),
        shrt: Short = 0.toShort(),
        nt: Int = 0,
        lng: Long = 0L,
        chr: Char = ' ',
        flt: Float = 0.0f,
        dbl: Double = 0.0,
        entityId: String? = null,
        creationTimestamp: Long = RawEntity.UNINITIALIZED_TIMESTAMP,
        expirationTimestamp:  Long = RawEntity.UNINITIALIZED_TIMESTAMP
    ) : EntityBase("KotlinPrimitivesGolden_Data", SCHEMA, entityId, creationTimestamp, expirationTimestamp) {

        var num: Double
            get() = super.getSingletonValue("num") as Double? ?: 0.0
            private set(_value) = super.setSingletonValue("num", _value)
        var txt: String
            get() = super.getSingletonValue("txt") as String? ?: ""
            private set(_value) = super.setSingletonValue("txt", _value)
        var lnk: String
            get() = super.getSingletonValue("lnk") as String? ?: ""
            private set(_value) = super.setSingletonValue("lnk", _value)
        var flg: Boolean
            get() = super.getSingletonValue("flg") as Boolean? ?: false
            private set(_value) = super.setSingletonValue("flg", _value)
        var ref: Reference<KotlinPrimitivesGolden_Data_Ref>?
            get() = super.getSingletonValue("ref") as Reference<KotlinPrimitivesGolden_Data_Ref>?
            private set(_value) = super.setSingletonValue("ref", _value)
        var bt: Byte
            get() = super.getSingletonValue("bt") as Byte? ?: 0.toByte()
            private set(_value) = super.setSingletonValue("bt", _value)
        var shrt: Short
            get() = super.getSingletonValue("shrt") as Short? ?: 0.toShort()
            private set(_value) = super.setSingletonValue("shrt", _value)
        var nt: Int
            get() = super.getSingletonValue("nt") as Int? ?: 0
            private set(_value) = super.setSingletonValue("nt", _value)
        var lng: Long
            get() = super.getSingletonValue("lng") as Long? ?: 0L
            private set(_value) = super.setSingletonValue("lng", _value)
        var chr: Char
            get() = super.getSingletonValue("chr") as Char? ?: ' '
            private set(_value) = super.setSingletonValue("chr", _value)
        var flt: Float
            get() = super.getSingletonValue("flt") as Float? ?: 0.0f
            private set(_value) = super.setSingletonValue("flt", _value)
        var dbl: Double
            get() = super.getSingletonValue("dbl") as Double? ?: 0.0
            private set(_value) = super.setSingletonValue("dbl", _value)

        init {
            this.num = num
            this.txt = txt
            this.lnk = lnk
            this.flg = flg
            this.ref = ref
            this.bt = bt
            this.shrt = shrt
            this.nt = nt
            this.lng = lng
            this.chr = chr
            this.flt = flt
            this.dbl = dbl
        }
        /**
         * Use this method to create a new, distinctly identified copy of the entity.
         * Storing the copy will result in a new copy of the data being stored.
         */
        fun copy(
            num: Double = this.num,
            txt: String = this.txt,
            lnk: String = this.lnk,
            flg: Boolean = this.flg,
            ref: Reference<KotlinPrimitivesGolden_Data_Ref>? = this.ref,
            bt: Byte = this.bt,
            shrt: Short = this.shrt,
            nt: Int = this.nt,
            lng: Long = this.lng,
            chr: Char = this.chr,
            flt: Float = this.flt,
            dbl: Double = this.dbl
        ) = KotlinPrimitivesGolden_Data(
            num = num,
            txt = txt,
            lnk = lnk,
            flg = flg,
            ref = ref,
            bt = bt,
            shrt = shrt,
            nt = nt,
            lng = lng,
            chr = chr,
            flt = flt,
            dbl = dbl
        )
        /**
         * Use this method to create a new version of an existing entity.
         * Storing the mutation will overwrite the existing entity in the set, if it exists.
         */
        fun mutate(
            num: Double = this.num,
            txt: String = this.txt,
            lnk: String = this.lnk,
            flg: Boolean = this.flg,
            ref: Reference<KotlinPrimitivesGolden_Data_Ref>? = this.ref,
            bt: Byte = this.bt,
            shrt: Short = this.shrt,
            nt: Int = this.nt,
            lng: Long = this.lng,
            chr: Char = this.chr,
            flt: Float = this.flt,
            dbl: Double = this.dbl
        ) = KotlinPrimitivesGolden_Data(
            num = num,
            txt = txt,
            lnk = lnk,
            flg = flg,
            ref = ref,
            bt = bt,
            shrt = shrt,
            nt = nt,
            lng = lng,
            chr = chr,
            flt = flt,
            dbl = dbl,
            entityId = entityId,
            creationTimestamp = creationTimestamp,
            expirationTimestamp = expirationTimestamp
        )

        companion object : EntitySpec<KotlinPrimitivesGolden_Data> {

            override val SCHEMA = Schema(
                setOf(),
                SchemaFields(
                    singletons = mapOf(
                        "num" to FieldType.Number,
                        "txt" to FieldType.Text,
                        "lnk" to FieldType.Text,
                        "flg" to FieldType.Boolean,
                        "ref" to FieldType.EntityRef("485712110d89359a3e539dac987329cd2649d889"),
                        "bt" to FieldType.Byte,
                        "shrt" to FieldType.Short,
                        "nt" to FieldType.Int,
                        "lng" to FieldType.Long,
                        "chr" to FieldType.Char,
                        "flt" to FieldType.Float,
                        "dbl" to FieldType.Double
                    ),
                    collections = emptyMap()
                ),
                "61f24d18077a4170179ff84731a1757ac2e622c1",
                refinement = { _ -> true },
                query = null
            )

            private val nestedEntitySpecs: Map<String, EntitySpec<out Entity>> =
                mapOf("485712110d89359a3e539dac987329cd2649d889" to KotlinPrimitivesGolden_Data_Ref)

            init {
                SchemaRegistry.register(SCHEMA)
            }

            override fun deserialize(data: RawEntity) = KotlinPrimitivesGolden_Data().apply {
                deserialize(data, nestedEntitySpecs)
            }
        }
    }

    class Handles : HandleHolderBase(
        "KotlinPrimitivesGolden",
        mapOf("data" to KotlinPrimitivesGolden_Data)
    ) {
        val data: ReadSingletonHandle<KotlinPrimitivesGolden_Data> by handles
    }
}
