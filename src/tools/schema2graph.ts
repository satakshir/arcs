/**
 * @license
 * Copyright (c) 2019 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import {Schema} from '../runtime/schema.js';
import {Type} from '../runtime/type.js';
import {ParticleSpec, HandleConnectionSpec} from '../runtime/particle-spec.js';
import {upperFirst} from './kotlin-generation-utils.js';
import {AtLeastAsSpecific} from '../runtime/refiner.js';

// Describes a source from where the Schema has been collected.
export class SchemaSource {
  constructor(
    readonly particleSpec: ParticleSpec,
    readonly connection: HandleConnectionSpec,
    // Path consisting of field names and tuples indices describing where the schema was found.
    //
    // Example for a schema Address:
    // Type: [Address]                                      Path: []
    // Type: Person {home: &Place {address: &Address {}}}   Path: ['home', 'address']
    // Type: (&Person {}, &Address {})                      Path: ['1']
    readonly path: string[]
  ) {}

  child(leaf: string) {
    return new SchemaSource(this.particleSpec, this.connection, [...this.path, leaf]);
  }

  // Full name is used to described this particular occurence of the schema.
  get fullName() {
    return `${this.particleSpec.name}_${upperFirst(this.connection.name)}` +
       this.path.map(p => `_${upperFirst(p)}`).join('');
  }
}

export class SchemaNode {
  constructor(
    readonly schema: Schema,
    readonly particleSpec: ParticleSpec,
    readonly allSchemaNodes: SchemaNode[]
  ) {}

  readonly sources: SchemaSource[] = [];

  // All schemas that can be sliced to this one.
  descendants = new Set<SchemaNode>();

  // Immediate descendants and ancestors. Initially null as state indicators during the two
  // build phases, but will be set to empty arrays if no parents or children are present.
  parents: SchemaNode[] = null;
  children: SchemaNode[] = null;

  // Maps reference fields to the node for their contained schema. This is also used to
  // ensure that nested schemas are generated before the references that rely on them.
  refs = new Map<string, SchemaNode>();

  // A name of the code generated class representing this schema.
  get entityClassName() {
    if (this.sources.length === 1) {
      // If there is just one source, use its full name.
      return this.sources[0].fullName;
    }
    // If there are multiple occurences use a generated name to which we will generate aliases.
    const index = this.allSchemaNodes.filter(n => n.sources.length > 1).indexOf(this) + 1;
    return `${this.particleSpec.name}Internal${index}`;
  }

  // This will return the most "human friendly" name for the schema. This is the name (actual class
  // name or alias) that should be used when typing a handle exposed to the particle. It will never
  // return internal names, e.g. Internal$N.
  // Note: Right now this will always return source.fullName, but it is a stepping stone towards
  // renaming the generated entities to use schema names when possible.
  humanName(connection: HandleConnectionSpec): string {
    const sourcesFromConnection = this.sources.filter(s => s.connection === connection);
    const minPathLength = Math.min(...sourcesFromConnection.map(s => s.path.length));
    const bestSource = sourcesFromConnection.find(s => s.path.length === minPathLength);
    return bestSource.fullName;
  }

  // This method is a temporary workaround. To fully support tuples we need to enhance the spec
  // definition for Kotlin handles.
  // TODO(b/157598151): Update HandleSpec from hardcoded single EntitySpec to
  //                    allowing multiple EntitySpecs for handles of tuples.
  static singleSchemaHumanName(connection: HandleConnectionSpec, nodes: SchemaNode[]): string {
    const topLevelNodes = SchemaNode.findTopLevelNodes(connection, nodes);
    const humanNames = topLevelNodes.map(n => n.humanName(connection));
    return humanNames.sort()[0];
  }

  // Returns all "top-level" schema nodes for the given connection.
  // There will be a single one for handles of entities or references to entities,
  // but arbitrary many for handles of tuples.
  private static findTopLevelNodes(connection: HandleConnectionSpec, nodes: SchemaNode[]): SchemaNode[] {
    const sourcesFromConnection = nodes
        .map(n => n.sources)
        .reduce((curr, acc) => [...acc, ...curr], [])
        .filter(s => s.connection === connection);
    const minPathLength = Math.min(...sourcesFromConnection.map(s => s.path.length));
    const bestSources = sourcesFromConnection.filter(s => s.path.length === minPathLength);
    return nodes.filter(n => n.sources.some(s => bestSources.includes(s)));
  }
}

function* topLevelSchemas(type: Type, path: string[] = []):
    IterableIterator<{schema: Schema, path: string[]}> {
  if (type.getContainedType()) {
    yield* topLevelSchemas(type.getContainedType(), path);
  } else if (type.getContainedTypes()) {
    const inner = type.getContainedTypes();
    for (let i = 0; i < inner.length; i++) {
      yield* topLevelSchemas(inner[i], [...path, `${i}`]);
    }
  } else if (type.getEntitySchema()) {
    yield {schema: type.getEntitySchema(), path};
  }
}

// Builds a directed type lattice graph from the set of schemas defined in a particle's connections,
// including schemas nested in references, with one node per unique schema found. The graph's edges
// indicate "slicability", such that a child node's schema can be sliced to any of its parents.
// For example, the schema '* {Text t, URL u}' is slicable to both '* {Text t}' and '* {URL u}'.
//
// The graph has a second set of edges via the refs field, which connects nodes whose schemas have
// references to other nodes which hold those references' nested schemas. These are used to ensure
// classes are generated in the order needed to satisfy their reference field type definitions.
export class SchemaGraph {
  nodes: SchemaNode[] = [];
  startNodes: SchemaNode[];

  constructor(readonly particleSpec: ParticleSpec) {
    // First pass to establish a node for each unique schema, with the descendants field populated.
    for (const connection of this.particleSpec.connections) {
      for (const {schema, path} of topLevelSchemas(connection.type)) {
        this.createNodes(schema, this.particleSpec, new SchemaSource(this.particleSpec, connection, path));
      }
    }

    // Both the second pass and the walk() method need to start from nodes with no parents.
    this.startNodes = this.nodes.filter(n => !n.parents);

    // Second pass to set up the class names, aliases, parents and children.
    for (const node of this.startNodes) {
      node.parents = [];
      this.process(node);
    }
  }

  private createNodes(schema: Schema, particleSpec: ParticleSpec, source: SchemaSource) {
    let node = this.nodes.find(n => schema.equals(n.schema));
    if (node) {
      node.sources.push(source);
    } else {
      // This is a new schema. Check for slicability against all previous schemas
      // (in both directions) to establish the descendancy mappings.
      node = new SchemaNode(schema, particleSpec, this.nodes);
      node.sources.push(source);
      for (const previous of this.nodes) {
        for (const [a, b] of [[node, previous], [previous, node]]) {
          if (b.schema.isEquivalentOrMoreSpecific(a.schema) === AtLeastAsSpecific.YES) {
            if (b.descendants.has(a)) {
              throw new Error(`Cannot add ${b} to ${a}.descendants as it would create a cycle.`);
            }
            a.descendants.add(b);  // b can be sliced to a
            b.parents = [];        // non-null to indicate this has parents; will be filled later
          }
        }
      }

      this.nodes.push(node);
    }

    // Recurse on any nested schemas in reference-typed fields. We need to do this even if we've
    // seen this schema before, to ensure any nested schemas end up aliased appropriately.
    for (const [field, descriptor] of Object.entries(schema.fields)) {
      let nestedSchema: Schema | undefined;
      if (descriptor.kind === 'schema-reference') {
        nestedSchema = descriptor.schema.model.entitySchema;
      } else if (descriptor.kind === 'schema-collection' && descriptor.schema.kind === 'schema-reference') {
        nestedSchema = descriptor.schema.schema.model.entitySchema;
      }
      if (nestedSchema) {
        // We have a reference field. Generate a node for its nested schema and connect it into the
        // refs map to indicate that this node requires nestedNode's class to be generated first.
        const nestedNode = this.createNodes(nestedSchema, particleSpec, source.child(field));
        node.refs.set(field, nestedNode);
      }
    }
    return node;
  }

  private process(node: SchemaNode) {
    if (node.children) return;  // already visited

    // Set up children links: collect descendants of descendants.
    const transitiveDescendants = new Set<SchemaNode>();
    for (const d of node.descendants) {
      for (const td of d.descendants) {
        transitiveDescendants.add(td);
      }
    }

    // children = (all descendants) - (descendants of descendants)
    node.children = [...node.descendants].filter(x => !transitiveDescendants.has(x));

    // Set up parent links on child nodes.
    for (const child of node.children) {
      child.parents.push(node);
      this.process(child);
    }
  }

  // Traverses the graph to yield schemas in the order in which they should be generated.
  // The traversal is primarily breadth-first, but some nodes may be pushed back due to
  // unsatisfied constraints.
  * walk(): IterableIterator<SchemaNode> {
    const queue: SchemaNode[] = [...this.startNodes];
    const seen = new Set<SchemaNode>();
    while (queue.length > 0) {
      const node = queue.shift();
      if (seen.has(node)) {
        continue;
      }

      // We can only process this node if all its parents and reference fields have
      // themselves been processed. If not, push it to the back of the queue.
      if (node.parents.some(p => !seen.has(p)) ||
          [...node.refs.values()].some(r => !seen.has(r))) {
        queue.push(node);
        continue;
      }

      queue.push(...node.children);
      seen.add(node);
      yield node;
    }
  }
}
