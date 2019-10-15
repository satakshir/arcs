/*
 * Copyright 2019 Google LLC.
 *
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 *
 * Code distributed by Google as part of this project is also subject to an additional IP rights
 * grant found at
 * http://polymer.github.io/PATENTS.txt
 */

package arcs.crdt.internal

import kotlin.collections.HashMap
import kotlin.math.max

typealias Version = Int

/** Vector clock implementation. */
class VersionMap(initialData: Map<Actor, Version> = emptyMap()) {
  constructor(initialData: VersionMap) : this(initialData.backingMap)

  private val backingMap = HashMap(initialData)

  /** The number of entries in the [VersionMap]. */
  val size: Int
    get() = backingMap.size

  /** Returns whether or not this [VersionMap] is empty. */
  fun isEmpty(): Boolean = backingMap.isEmpty()

  /** Returns whether or not this [VersionMap] contains items. */
  fun isNotEmpty(): Boolean = !isEmpty()

  /**
   * Gets a the current [Version] for a given [Actor], or [DEFAULT_VERSION] if no value has been
   * set.
   */
  operator fun get(key: Actor): Version = backingMap[key] ?: DEFAULT_VERSION

  /** Sets the current [Version] for a given [Actor]. */
  operator fun set(key: Actor, value: Version) {
    backingMap[key] = value
  }

  /** Returns whether or not this [VersionMap] contains a value for the given [Actor]. */
  operator fun contains(actor: Actor): Boolean = actor in backingMap

  /**
   * Determines whether or not this [VersionMap] 'dominates' another.
   *
   * A [VersionMap] is said to dominate another [VersionMap] if and only if, for all
   * `(a_O: [Actor], v_O: [Version])` entry in the other map, there exists a
   * `(a_T: [Actor], v_T: [Version])` entry in this [VersionMap] such that:
   *
   * `a_T == a_0 && v_T >= v_0`
   */
  infix fun dominates(other: VersionMap): Boolean =
    other.backingMap.all { this[it.key] >= it.value }

  /**
   * Merges this [VersionMap] with another [VersionMap] by taking the maximum version values for the
   * union of all [Actor]s and returns the merged result.
   *
   * **Note:** Does not modify either object.
   */
  infix fun mergeWith(other: VersionMap): VersionMap {
    val result = VersionMap(backingMap)
    other.backingMap.forEach { (actor, version) -> result[actor] = max(version, result[actor]) }
    return result
  }

  override fun equals(other: Any?): Boolean {
    return other is VersionMap &&
      other.backingMap.size == backingMap.size &&
      other.backingMap.all { this[it.key] == it.value }
  }

  // TODO: better method for calculating hashcode. This implementation is just so we have
  //  **something**.
  override fun hashCode(): Int = backingMap.entries.sortedBy { it.key }.joinToString().hashCode()

  companion object {
    /** Default starting version for any actor. */
    const val DEFAULT_VERSION: Version = 0
  }
}