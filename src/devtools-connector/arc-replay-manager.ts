/**
 * @license
 * Copyright (c) 2019 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import {ArcDevtoolsChannel, DevtoolsMessage} from './abstract-devtools-channel.js';
import {PECOuterPort} from '../runtime/api-channel.js';
import {PropagatedException} from '../runtime/arc-exceptions.js';
import {Arc} from '../runtime/arc.js';
import {MessagePort} from '../runtime/message-channel.js';
import {Handle} from '../runtime/recipe/handle.js';
import {Particle} from '../runtime/recipe/particle.js';
import {Content} from '../runtime/slot-consumer.js';
import {StorageProviderBase} from '../runtime/storage/storage-provider-base.js';
import {Type} from '../runtime/type.js';

import {Modality} from '../runtime/modality.js';
import {SlotComposer} from '../runtime/slot-composer.js';
import {PlanningModalityHandler} from '../planning/arcs-planning.js';

// Copy from the shell code.
const DomSlotComposer = class extends SlotComposer {
  constructor(options: {}) {
    super({
      modalityName: Modality.Name.Dom,
      modalityHandler: PlanningModalityHandler.domHandler,
      ...options
    });
  }
};


export class ArcReplayManager {
  private arc: Arc;
  private host: ReplayExecutionHost;
  private element: HTMLElement;
  
  constructor(arc: Arc, arcDevtoolsChannel: ArcDevtoolsChannel) {
    this.arc = arc;
    arcDevtoolsChannel.listen('replay-start', () => this.start());
    arcDevtoolsChannel.listen('replay-step', (msg: DevtoolsMessage) => this.host.step(msg));
    arcDevtoolsChannel.listen('replay-stop', () => this.stop());
  }

  private async start() {
    console.log('Replay invoked for', this.arc.id);
    const elems = this.createRenderingSurface();
    this.element = elems.outer;

    const ports = this.arc.createPorts(this.arc.id);
    if (ports.length !== 1) {
      throw new Error('ArcReplayManager does not currently support more than one port')
    }

    const slotComposer = new DomSlotComposer({
      containers: {
        root: elems.inner
      }
    });
    await slotComposer.initializeRecipe(this.arc, this.arc.activeRecipe.particles);
    this.host = new ReplayExecutionHost(this.arc, ports[0], slotComposer);
  }

  private stop() {
    console.log('Replay stopped for', this.arc.id);
    this.host.close();
    this.element.parentElement.removeChild(this.element);
  }

  private createRenderingSurface(): {outer: HTMLElement, inner: HTMLElement} {
    const outer = document.createElement('div');
    outer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10001;
      background: rgba(0,0,0,.5);`;

    const inner = document.createElement('div');
    inner.style.cssText = `
      position: absolute;
      top: 24px;
      left: 24px;
      right: 24px;
      bottom: 24px;
      border: 1px solid rgba(0,0,0,.3);
      z-index: 10002;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,.5);`;

    outer.appendChild(inner);

    document.body.appendChild(outer);
    return {outer, inner};
  }
}

class ReplayExecutionHost extends PECOuterPort {

  private slotComposer: SlotComposer;
  private arc: Arc;

  constructor(arc: Arc, port: MessagePort, slotComposer: SlotComposer) {
    super(port, arc, false);
    this.slotComposer = slotComposer;
    this.arc = arc;
  }

  step(msg: DevtoolsMessage) {
    console.log(`Sending ${msg.messageBody.name}`, msg.messageBody.body);

    void this.send(msg.messageBody.name, msg.messageBody.body); 

    //this.InstantiateParticle(particle, particle.id.toString(), particle.spec, stores);
    //this.DefineHandle(store, store.type.resolvedType(), name);
    //this.UIEvent(particle, slotName, event);
    //this.StartRender(particle, slotName, providedSlots, contentTypes);
    //this.StopRender(particle, slotName);
    //this.InnerArcRender(transformationParticle, transformationSlotName, hostedSlotId, content);
    //this.AwaitIdle(this.nextIdentifier++);
    //this.Stop();
  }

  // Here we receive the incoming message json/
  async _processMessage(e) {
    console.log(`Received ${e.data.messageType}:`, e.data.messageBody);

    // Special casing for Rendering.
    if (e.data.messageType === 'Render') {
      const msg = e.data.messageBody;
      this.slotComposer.renderSlot(
        this.arc.activeRecipe.particles.find(p => p.id.toString() === msg.particle),
        msg.slotName,
        msg.content);  
    }
  }

  onRender(particle: Particle, slotName: string, content: Content) {    
  }

  onInitializeProxy(handle: StorageProviderBase, callback: number) {
  }

  onSynchronizeProxy(handle: StorageProviderBase, callback: number) {
  }

  onHandleGet(handle: StorageProviderBase, callback: number) {
  }

  onHandleToList(handle: StorageProviderBase, callback: number) {
  }

  onHandleSet(handle: StorageProviderBase, data: {}, particleId: string, barrier: string) {
  }

  onHandleClear(handle: StorageProviderBase, particleId: string, barrier: string) {
  }

  onHandleStore(handle: StorageProviderBase, callback: number, data: {value: {}, keys: string[]}, particleId: string) {
  }

  onHandleRemove(handle: StorageProviderBase, callback: number, data: {id: string, keys: string[]}, particleId) {
  }

  onHandleRemoveMultiple(handle: StorageProviderBase, callback: number, data: [], particleId: string) {
  }

  onHandleStream(handle: StorageProviderBase, callback: number, pageSize: number, forward: boolean) {
  }

  onStreamCursorNext(handle: StorageProviderBase, callback: number, cursorId: number) {
  }

  onStreamCursorClose(handle: StorageProviderBase, cursorId: number) {
  }

  onIdle(version: number, relevance: Map<Particle, number[]>) {
  }

  onGetBackingStore(callback: number, storageKey: string, type: Type) {
  }

  onConstructInnerArc(callback: number, particle: Particle) {
  }

  onArcCreateHandle(callback: number, arc: Arc, type: Type, name: string) {
  }

  onArcMapHandle(callback: number, arc: Arc, handle: Handle) {
  }

  onArcCreateSlot(callback: number, arc: Arc, transformationParticle: Particle, transformationSlotName: string, handleId: string) {
  }

  onArcLoadRecipe(arc: Arc, recipe: string, callback: number) {
  }

  onReportExceptionInHost(exception: PropagatedException) {
  }

  onServiceRequest(particle: Particle, request: {}, callback: number) {
  }
}