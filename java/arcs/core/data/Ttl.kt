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

package arcs.core.data

import arcs.core.util.Time

/** A class containing retention policy information. */
sealed class Ttl(count: Int, val isInfinite: Boolean = false) {
    val minutes: Int = count * when (this) {
        is Minutes -> 1
        is Hours -> 60
        is Days -> 60 * 24
        is Infinite -> 1
    }
    init {
        require(count > 0 || isInfinite) {
            "must be either positive count on infinite, " +
                "but got count=$count and isInfinite=$isInfinite"
        }
    }

    override fun equals(other: Any?): Boolean =
        other is Ttl && minutes == other.minutes

    override fun hashCode(): Int = minutes.hashCode()

    fun calculateExpiration(time: Time): Long =
        if (isInfinite) RawEntity.UNINITIALIZED_TIMESTAMP
        else time.currentTimeMillis + (minutes * 60 * 1000)

    data class Minutes(val count: Int) : Ttl(count)
    data class Hours(val count: Int) : Ttl(count)
    data class Days(val count: Int) : Ttl(count)
    object Infinite : Ttl(TTL_INFINITE.toInt(), true)

    companion object {
        const val TTL_INFINITE = -1.0
    }
}
