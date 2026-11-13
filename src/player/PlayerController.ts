import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, Vec3 } from '../core/events';
import type { InputIntent } from '../core/InputController';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { PLAYER, stepVelocity } from './PlayerMotor';

const SKIN = 0.02; // gap the character controller keeps from surfaces
const GRAVITY = -9.81;
const CENTER_HEIGHT = PLAYER.halfHeight + PLAYER.radius;

/**
 * First-person body: a capsule moved by Rapier's kinematic character controller.
 * Looking is applied every rendered frame; walking runs at the fixed step and the
 * camera is interpolated between the last two steps so motion stays smooth.
 */
export class PlayerController {
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly previous = new THREE.Vector3();
  private readonly current = new THREE.Vector3(); // capsule centre
  private velocity = { x: 0, z: 0 };
  private verticalVelocity = 0;
  private strideDistance = 0;
  private yawValue = 0;
  private pitchValue = 0;
  private speedValue = 0;
  private groundedValue = false;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly bus: EventBus<GameEvents>,
  ) {
    const world = physics.world;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(PLAYER.halfHeight, PLAYER.radius), this.body);
    this.controller = world.createCharacterController(SKIN);
    this.controller.enableAutostep(0.25, 0.1, false);
    this.controller.enableSnapToGround(0.2);
    this.controller.setApplyImpulsesToDynamicBodies(false);
    this.camera.rotation.order = 'YXZ';
  }

  /** Feet position. */
  get position(): Vec3 {
    return { x: this.current.x, y: this.current.y - CENTER_HEIGHT - SKIN, z: this.current.z };
  }
  /** Eye position, where rays for looking and interacting start. */
  get eyePosition(): Vec3 {
    const feet = this.position;
    return { x: feet.x, y: feet.y + PLAYER.eyeHeight, z: feet.z };
  }
  get yaw(): number {
    return this.yawValue;
  }
  get pitch(): number {
    return this.pitchValue;
  }
  get speed(): number {
    return this.speedValue;
  }
  get grounded(): boolean {
    return this.groundedValue;
  }

  /** Mouse look, in pixels. Right turns right, down looks down. */
  applyLook(dxPx: number, dyPx: number): void {
    this.yawValue += dxPx * PLAYER.lookSensitivity;
    this.pitchValue -= dyPx * PLAYER.lookSensitivity;
    this.pitchValue = Math.min(Math.max(this.pitchValue, -PLAYER.pitchLimit), PLAYER.pitchLimit);
    this.applyCameraRotation();
  }

  fixedUpdate(intent: InputIntent, dt: number): void {
    this.previous.copy(this.current);
    this.velocity = stepVelocity(this.velocity, intent, this.yawValue, dt);
    this.verticalVelocity = this.groundedValue ? GRAVITY * dt : this.verticalVelocity + GRAVITY * dt;

    this.controller.computeColliderMovement(this.collider, {
      x: this.velocity.x * dt,
      y: this.verticalVelocity * dt,
      z: this.velocity.z * dt,
    });
    const moved = this.controller.computedMovement();
    this.groundedValue = this.controller.computedGrounded();
    this.current.x += moved.x;
    this.current.y += moved.y;
    this.current.z += moved.z;
    this.body.setNextKinematicTranslation(this.current);

    // Keep only the velocity the world allowed, so the player does not "store" speed against a wall.
    this.velocity = { x: moved.x / dt, z: moved.z / dt };
    const travelled = Math.hypot(moved.x, moved.z);
    this.speedValue = travelled / dt;

    if (this.groundedValue) {
      this.strideDistance += travelled;
      if (this.strideDistance >= PLAYER.strideLength) {
        this.strideDistance -= PLAYER.strideLength;
        this.bus.emit('player:footstep', { position: this.position, sprinting: intent.sprint });
      }
    }
  }

  /** Places the camera between the previous and the current simulation step. */
  interpolate(alpha: number): void {
    const x = this.previous.x + (this.current.x - this.previous.x) * alpha;
    const y = this.previous.y + (this.current.y - this.previous.y) * alpha;
    const z = this.previous.z + (this.current.z - this.previous.z) * alpha;
    this.camera.position.set(x, y - CENTER_HEIGHT - SKIN + PLAYER.eyeHeight, z);
  }

  teleport(x: number, z: number, yaw: number): void {
    this.current.set(x, CENTER_HEIGHT + SKIN, z);
    this.previous.copy(this.current);
    this.body.setTranslation(this.current, true);
    this.body.setNextKinematicTranslation(this.current);
    this.velocity = { x: 0, z: 0 };
    this.verticalVelocity = 0;
    this.speedValue = 0;
    this.strideDistance = 0;
    this.yawValue = yaw;
    this.pitchValue = 0;
    this.applyCameraRotation();
    this.interpolate(1);
  }

  dispose(): void {
    const world = this.physics.world;
    world.removeCharacterController(this.controller);
    world.removeRigidBody(this.body);
  }

  private applyCameraRotation(): void {
    // The camera looks down -z by default; yaw 0 must look down +x.
    this.camera.rotation.set(this.pitchValue, -(this.yawValue + Math.PI / 2), 0);
  }
}
