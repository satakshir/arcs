/**
 * @license
 * Copyright (c) 2020 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import {Runtime} from '../runtime/runtime.js';
import {Recipe} from '../runtime/recipe/recipe.js';
import {Handle} from '../runtime/recipe/handle.js';
import {Particle} from '../runtime/recipe/particle.js';
import {Type, CollectionType, ReferenceType, SingletonType, TupleType} from '../runtime/type.js';
import {Schema} from '../runtime/schema.js';
import {HandleConnectionSpec, ParticleSpec} from '../runtime/particle-spec.js';
import {assert} from '../platform/assert-web.js';
import {findLongRunningArcId} from './storage-key-recipe-resolver.js';
import {Manifest} from '../runtime/manifest.js';
import {Capabilities} from '../runtime/capabilities.js';
import {CapabilityEnum, DirectionEnum, FateEnum, ManifestProto, PrimitiveTypeEnum} from './manifest-proto.js';
import {Refinement, RefinementExpressionLiteral} from '../runtime/refiner.js';
import {Op} from '../runtime/manifest-ast-nodes.js';
import {Claim, ClaimType} from '../runtime/particle-claim.js';
import {Check, CheckCondition, CheckExpression, CheckType} from '../runtime/particle-check.js';
import {flatMap} from '../runtime/util.js';

export async function encodeManifestToProto(path: string): Promise<Uint8Array> {
  const manifest = await Runtime.parseFile(path);

  if (manifest.imports.length) {
    throw Error('Only single-file manifests are currently supported');
  }
  return encodePayload(await manifestToProtoPayload(manifest));
}

export async function manifestToProtoPayload(manifest: Manifest) {
  return makeManifestProtoPayload(manifest.particles, manifest.recipes);
}

export async function encodePlansToProto(plans: Recipe[]) {
  const specMap = new Map<string, ParticleSpec>();
  for (const spec of flatMap(plans, r => r.particles).map(p => p.spec)) {
    specMap.set(spec.name, spec);
  }
  return encodePayload(await makeManifestProtoPayload([...specMap.values()], plans));
}

async function makeManifestProtoPayload(particles: ParticleSpec[], recipes: Recipe[]) {
  return {
    particleSpecs: await Promise.all(particles.map(p => particleSpecToProtoPayload(p))),
    recipes: await Promise.all(recipes.map(r => recipeToProtoPayload(r))),
  };
}

function encodePayload(payload: {}): Uint8Array {
  const error = ManifestProto.verify(payload);
  if (error) throw Error(error);
  return ManifestProto.encode(ManifestProto.create(payload)).finish();
}

async function particleSpecToProtoPayload(spec: ParticleSpec) {
  const connections = await Promise.all(spec.connections.map(async connectionSpec => handleConnectionSpecToProtoPayload(connectionSpec)));
  const claims = flatMap(spec.connections, connectionSpec => claimsToProtoPayload(spec, connectionSpec));
  const checks = flatMap(spec.connections, connectionSpec => checksToProtoPayload(spec, connectionSpec));

  return {
    name: spec.name,
    location: spec.implFile,
    connections,
    claims,
    checks
  };
}

async function handleConnectionSpecToProtoPayload(spec: HandleConnectionSpec) {
  const directionOrdinal = DirectionEnum.values[spec.direction.replace(/ /g, '_').toUpperCase()];
  if (directionOrdinal === undefined) {
    throw Error(`Handle connection direction ${spec.direction} is not supported`);
  }
  return {
    name: spec.name,
    direction: directionOrdinal,
    type: await typeToProtoPayload(spec.type)
  };
}

// Converts the claims in HandleConnectionSpec.
function claimsToProtoPayload(
  spec: ParticleSpec,
  connectionSpec: HandleConnectionSpec
) {
  if (!connectionSpec.claims) {
    return [];
  }
  const protos: {}[] = [];
  for (const particleClaim of connectionSpec.claims) {
    const accessPath = accessPathProtoPayload(spec, connectionSpec, particleClaim.fieldPath);
    for (const claim of particleClaim.claims) {
      switch (claim.type) {
        case ClaimType.IsTag: {
          let predicate: {} = {label: {semanticTag: claim.tag}};
          if (claim.isNot) {
            predicate = {not: {predicate}};
          }
          protos.push({
            assume: {accessPath, predicate}
          });
          break;
        }
        case ClaimType.DerivesFrom: {
          protos.push({
            derivesFrom: {
              target: accessPath,
              source: {
                particleSpec: spec.name,
                handleConnection: claim.parentHandle.name
              }
            }
          });
          break;
        }
        default:
          throw new Error(`Unknown ClaimType for claim: ${JSON.stringify(claim)}.`);
      }
    }
  }
  return protos;
}

// Converts the checks in HandleConnectionSpec.
function checksToProtoPayload(
  spec: ParticleSpec,
  connectionSpec: HandleConnectionSpec,
) {
  if (!connectionSpec.checks) {
    return [];
  }
  return connectionSpec.checks.map(check => {
    const accessPath = accessPathProtoPayload(spec, connectionSpec, check.fieldPath);
    const predicate = checkExpressionToProtoPayload(check.expression);
    return {accessPath, predicate};
  });
}

function checkExpressionToProtoPayload(
  expression: CheckExpression
) {
  switch (expression.type) {
    case 'and': {
      const children = expression.children.map(child => {
        return checkExpressionToProtoPayload(child);
      });
      return children.reduce((acc, cur) => {
        return (acc == null)
          ? cur
          : {
            and: {
              conjunct0: acc,
              conjunct1: cur
            }
          };
      }, null);
    }
    case 'or': {
      const children = expression.children.map(child => {
        return checkExpressionToProtoPayload(child);
      });
      return children.reduce((acc, cur) => {
        return (acc == null)
          ? cur
          : {
            or: {
              disjunct0: acc,
              disjunct1: cur
            }
          };
      }, null);
    }
    default: {
      const condition = expression as CheckCondition;
      switch (condition.type) {
        case CheckType.HasTag: {
          const tag = {semanticTag: condition.tag};
          if (condition.isNot) {
            return {
              not: {predicate: {label: tag}}
            };
          } else {
            return {label: tag};
          }
        }
        case CheckType.Implication:
          return {
            implies: {
              antecedent: checkExpressionToProtoPayload(condition.antecedent),
              consequent: checkExpressionToProtoPayload(condition.consequent),
            },
          };
        case CheckType.IsFromHandle:
        case CheckType.IsFromOutput:
        case CheckType.IsFromStore:
          throw new Error(`Unsupported CheckType for check: ${JSON.stringify(condition)}.`);
        default:
          throw new Error(`Unknown CheckType for check: ${JSON.stringify(condition)}.`);
      }
    }
  }
}

/** Constructs an AccessPathProto payload. */
function accessPathProtoPayload(
    spec: ParticleSpec,
    connectionSpec: HandleConnectionSpec,
    fieldPath: string[]
) {
  const accessPath: {particleSpec: string, handleConnection: string, selectors?: {field: string}[]} = {
    particleSpec: spec.name,
    handleConnection: connectionSpec.name
  };
  if (fieldPath.length) {
    accessPath.selectors = fieldPath.map(field => ({field}));
  }
  return accessPath;
}

async function recipeToProtoPayload(recipe: Recipe) {
  recipe.normalize();

  const handleToProtoPayload = new Map<Handle, {name: string}>();
  for (const h of recipe.handles) {
    handleToProtoPayload.set(h, await recipeHandleToProtoPayload(h));
  }

  return {
    name: recipe.name,
    arcId: findLongRunningArcId(recipe),
    particles: recipe.particles.map(p => recipeParticleToProtoPayload(p, handleToProtoPayload)),
    handles: [...handleToProtoPayload.values()],
  };
}

function recipeParticleToProtoPayload(particle: Particle, handleMap: Map<Handle, {name: string}>) {
  return {
    specName: particle.name,
    connections: Object.entries(particle.connections).map(
      ([name, connection]) => ({name, handle: handleMap.get(connection.handle).name})
    )
  };
}

async function recipeHandleToProtoPayload(handle: Handle) {
  const fateOrdinal = FateEnum.values[handle.fate.toUpperCase()];
  if (fateOrdinal === undefined) {
    throw Error(`Handle fate ${handle.fate} is not supported`);
  }
  const toName = handle => handle.localName || `handle${handle.recipe.handles.indexOf(handle)}`;
  const handleData = {
    name: toName(handle),
    id: handle.id,
    tags: handle.tags,
    fate: fateOrdinal,
    capabilities: capabilitiesToProtoOrdinals(handle.capabilities),
    type: await typeToProtoPayload(handle.type || handle.mappedType)
  };

  if (handle.storageKey) {
    handleData['storageKey'] = handle.storageKey.toString();
  }

  if (handle.fate === 'join' && handle.joinedHandles) {
    handleData['associatedHandles'] = handle.joinedHandles.map(toName);
  }

  return handleData;
}

export function capabilitiesToProtoOrdinals(capabilities: Capabilities) {
  // We bypass the inteface and grab the underlying set of capability strings for the purpose of
  // serialization. It is rightfully hidden in the Capabilities object, but this use is justified.
  // Tests will continue to ensure we access the right field.
  // tslint:disable-next-line: no-any
  return [...(capabilities as any).capabilities].map(c => {
    const ordinal = CapabilityEnum.values[c.replace(/([A-Z])/g, '_$1').toUpperCase()];
    if (ordinal === undefined) {
      throw Error(`Capability ${c} is not supported`);
    }
    return ordinal;
  });
}

export async function typeToProtoPayload(type: Type) {
  if (type.hasVariable && !type.isResolved()) {
    assert(type.maybeEnsureResolved());
    assert(type.isResolved());
  }
  type = type.resolvedType();
  switch (type.tag) {
    case 'Entity': {
      const entity = {
        entity: {
          schema: await schemaToProtoPayload(type.getEntitySchema()),
        }
      };
      if (type.getEntitySchema().refinement) {
        entity['refinement'] = refinementToProtoPayload(type.getEntitySchema().refinement);
      }
      return entity;
    }
    case 'Collection': return {
      collection: {
        collectionType: await typeToProtoPayload((type as CollectionType<Type>).collectionType)
      }
    };
    case 'Reference': return {
      reference: {
        referredType: await typeToProtoPayload((type as ReferenceType<Type>).referredType)
      }
    };
    case 'Tuple': return {
      tuple: {
        elements: await Promise.all((type as TupleType).innerTypes.map(typeToProtoPayload))
      }
    };
    case 'Singleton': return {
      singleton: {
        singletonType: await typeToProtoPayload((type as SingletonType<Type>).getContainedType())
      }
    };
    case 'Count': return {
      count: {}
    };
    // TODO(b/154733929)
    // case 'TypeVariable': return {
    //   variable: {
    //     name: (type as TypeVariable).variable.name,
    //   }
    // };
    default: throw Error(`Type '${type.tag}' is not supported.`);
  }
}

export async function schemaToProtoPayload(schema: Schema) {
  return {
    names: schema.names,
    fields: objectFromEntries(await Promise.all(Object.entries(schema.fields).map(
      async ([key, value]) => [key, await schemaFieldToProtoPayload(value)]))),
    hash: await schema.hash()
  };
}

type SchemaField = {
  kind: string,
  type: string,
  schema: SchemaField,
  types: SchemaField[],
  model: Type
};

async function schemaFieldToProtoPayload(fieldType: SchemaField) {
  switch (fieldType.kind) {
    case 'schema-primitive': {
      const primitive = PrimitiveTypeEnum.values[fieldType.type.toUpperCase()];
      if (primitive === undefined) {
        throw Error(`Primitive field type ${fieldType.type} is not supported.`);
      }
      return {primitive};
    }
    case 'schema-collection': {
      return {
        collection: {
          collectionType: await schemaFieldToProtoPayload(fieldType.schema)
        }
      };
    }
    case 'schema-tuple': {
      return {
        tuple: {
          elements: await Promise.all(fieldType.types.map(schemaFieldToProtoPayload))
        }
      };
    }
    case 'schema-reference': {
      return {
        reference: {
          referredType: await schemaFieldToProtoPayload(fieldType.schema)
        }
      };
    }
    case 'schema-inline': {
      return typeToProtoPayload(fieldType.model);
    }
    // TODO(b/154947220) support schema-unions
    case 'schema-union':
    default: throw Error(`Schema field kind ${fieldType.kind} is not supported.`);
  }
}

function refinementToProtoPayload(refinement: Refinement): object {
  refinement.normalize();
  const literal = refinement.toLiteral();
  return refinementExpressionLiteralToProtoPayload(literal.expression);
}

function toOpProto(op: Op): number {
  const opEnum = [
    Op.AND, Op.OR,
    Op.LT, Op.GT, Op.LTE, Op.GTE,
    Op.ADD, Op.SUB, Op.MUL, Op.DIV,
    Op.NOT, Op.NEG,
    Op.EQ, Op.NEQ,
  ].indexOf(op);

  if (opEnum === -1) throw Error(`Op type '${op}' is not supported.`);

  return opEnum;
}

function refinementExpressionLiteralToProtoPayload(expr: RefinementExpressionLiteral): object {
  switch (expr.kind) {
    case 'BinaryExpressionNode': return {
      binary: {
        leftExpr: refinementExpressionLiteralToProtoPayload(expr.leftExpr),
        rightExpr: refinementExpressionLiteralToProtoPayload(expr.rightExpr),
        operator: toOpProto(expr.operator)
      }
    };
    case 'UnaryExpressionNode': return {
      unary: {
        expr: refinementExpressionLiteralToProtoPayload(expr.expr),
        operator: toOpProto(expr.operator),
      }
    };
    case 'FieldNamePrimitiveNode': return {
      field: expr.value
    };
    case 'QueryArgumentPrimitiveNode': return {
      queryArgument: expr.value
    };
    case 'NumberPrimitiveNode': return {
      number: expr.value
    };
    case 'BooleanPrimitiveNode': return {
      boolean: expr.value
    };
    case 'TextPrimitiveNode': return {
      text: expr.value
    };
    default:
      throw new Error(`Unknown node type ${expr['kind']}`);
  }
}

// Someday could be replace with Object.fromEntries when it's widely available:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
function objectFromEntries(entries) {
  return entries.reduce((object, [key, value]) => {
    object[key] = value;
    return object;
  }, {});
}
