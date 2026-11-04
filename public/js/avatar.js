import * as THREE from 'three';
import { LOOKS } from './data.js';

const SKIN_ROUGH = 0.62;
const JUMP_TIME = 0.55;
const JUMP_HEIGHT = 0.55;
const ADULT_SCALE = 1.22;
const ADULT_LEG = 1.25;
const ADULT_ARM = 1.2;
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));
const std = (color, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness });

const geo = {
  head: new THREE.SphereGeometry(0.29, 28, 22),
  hairCap: new THREE.SphereGeometry(0.305, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
  ball: new THREE.SphereGeometry(1, 18, 14),
  torso: new THREE.CapsuleGeometry(0.155, 0.13, 6, 16),
  arm: new THREE.CapsuleGeometry(0.052, 0.17, 5, 10),
  leg: new THREE.CapsuleGeometry(0.066, 0.15, 5, 10),
  brim: new THREE.CylinderGeometry(0.3, 0.3, 0.018, 24),
  smile: new THREE.TorusGeometry(0.045, 0.009, 6, 14, Math.PI),
  strap: new THREE.BoxGeometry(0.035, 0.28, 0.02),
  tie: new THREE.BoxGeometry(0.05, 0.2, 0.02),
  page: new THREE.BoxGeometry(0.17, 0.012, 0.24),
  spine: new THREE.BoxGeometry(0.36, 0.008, 0.25),
  pencil: new THREE.CylinderGeometry(0.009, 0.009, 0.15, 6),
};

function mesh(geometry, material, parent, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export class Avatar {
  constructor(look) {
    this.root = new THREE.Group();
    this.anim = { walk: 0, sit: 0, phase: Math.random() * 6, emote: null, emoteTime: 0, idle: Math.random() * 6, jump: -1 };
    this.moving = false;
    this.seated = false;
    this.adult = false;
    this.setLook(look);
  }

  // 선생님은 어른 모습이다: 키가 크고 머리가 작고, 가방과 모자가 없다.
  setAdult(adult) {
    if (this.adult === adult) return;
    this.adult = adult;
    this.setLook(this.look);
  }

  get heightScale() {
    return this.adult ? ADULT_SCALE : 1;
  }

  setLook(look) {
    this.look = look;
    const adult = this.adult;
    const hip = adult ? 0.05 + 0.31 * ADULT_LEG : 0.36;
    this.armBase = adult ? ADULT_ARM : 1;
    this.wearsHat = !!look.hat && !adult;
    this.root.scale.setScalar(adult ? ADULT_SCALE : 1);
    while (this.root.children.length) this.root.remove(this.root.children[0]);

    const skin = std(LOOKS.skin[look.skin], SKIN_ROUGH);
    const hair = std(LOOKS.hairColor[look.hairColor], 0.72);
    const shirt = std(LOOKS.shirt[look.shirt]);
    const pants = std(adult ? 0x2f3440 : 0x46546b);
    const bag = std(LOOKS.bag[look.bag], 0.6);
    const white = std(0xf7f4ea);
    const shoe = adult ? std(0x3b2a20, 0.5) : white;
    const dark = std(0x241a15, 0.3);
    const blush = std(0xf0987f, 0.8);

    // 다리
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.legL.position.set(-0.085, hip, 0);
    this.legR.position.set(0.085, hip, 0);
    for (const leg of [this.legL, this.legR]) {
      mesh(geo.leg, pants, leg, 0, -0.14, 0);
      mesh(geo.ball, shoe, leg, 0, -0.31, 0.03, 0.085, 0.055, 0.125);
      leg.scale.y = adult ? ADULT_LEG : 1;
      this.root.add(leg);
    }

    // 몸통 (엉덩이를 축으로 숙인다)
    this.body = new THREE.Group();
    this.body.position.y = hip;
    this.root.add(this.body);
    mesh(geo.torso, shirt, this.body, 0, 0.17, 0, 1, 1, 0.82);
    mesh(geo.ball, pants, this.body, 0, 0.02, 0, 0.155, 0.075, 0.13);

    if (adult) {
      // 어른은 가방 대신 넥타이를 맨다.
      mesh(geo.tie, std(0xa8374a, 0.6), this.body, 0, 0.2, 0.128);
    } else {
      // 가방과 끈
      mesh(geo.ball, bag, this.body, 0, 0.21, -0.2, 0.17, 0.2, 0.09);
      mesh(geo.ball, std(0xf0e6cf, 0.7), this.body, 0, 0.145, -0.275, 0.105, 0.07, 0.03);
      for (const side of [-1, 1]) {
        const strap = mesh(geo.strap, bag, this.body, side * 0.1, 0.22, 0.128);
        strap.rotation.x = 0.08;
      }
    }

    // 팔
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.armL.position.set(-0.19, 0.3, 0);
    this.armR.position.set(0.19, 0.3, 0);
    for (const arm of [this.armL, this.armR]) {
      mesh(geo.arm, shirt, arm, 0, -0.1, 0);
      arm.userData.hand = mesh(geo.ball, skin, arm, 0, -0.235, 0, 0.056);
      this.body.add(arm);
    }

    // 머리
    this.head = new THREE.Group();
    this.head.position.y = adult ? 0.6 : 0.62;
    this.head.scale.setScalar(adult ? 0.84 : 1);
    this.body.add(this.head);
    mesh(geo.head, skin, this.head, 0, 0, 0, 1, 0.96, 0.96);
    this.buildHair(look, hair);

    const eyeY = -0.015;
    mesh(geo.ball, dark, this.head, -0.11, eyeY, 0.253, 0.026, 0.033, 0.014);
    mesh(geo.ball, dark, this.head, 0.11, eyeY, 0.253, 0.026, 0.033, 0.014);
    if (!adult) {
      mesh(geo.ball, blush, this.head, -0.17, -0.075, 0.207, 0.04, 0.024, 0.012);
      mesh(geo.ball, blush, this.head, 0.17, -0.075, 0.207, 0.04, 0.024, 0.012);
    }
    const mouth = mesh(geo.smile, std(0x8a3f33, 0.6), this.head, 0, -0.08, 0.265);
    mouth.rotation.z = Math.PI;
    mouth.scale.y = 0.85;

    // 앉았을 때 책상 위에 펴는 공책과 손에 쥔 연필
    this.book = new THREE.Group();
    this.book.position.set(0, 0.635, 0.47);
    mesh(geo.page, white, this.book, -0.085, 0, 0, 1, 1, 1).rotation.z = 0.04;
    mesh(geo.page, white, this.book, 0.085, 0, 0, 1, 1, 1).rotation.z = -0.04;
    mesh(geo.spine, bag, this.book, 0, -0.007, 0);
    this.root.add(this.book);
    this.pencil = mesh(geo.pencil, std(0xe8b23a, 0.5), this.armR, 0, -0.26, 0.05);
    this.pencil.rotation.x = 0.9;

    if (this.wearsHat) {
      const yellow = std(0xf5cd3a, 0.6);
      mesh(geo.hairCap, yellow, this.head, 0, 0.07, -0.01, 1.07, 0.95, 1.08);
      const brim = mesh(geo.brim, yellow, this.head, 0, 0.115, 0.085, 1.16, 1, 1.2);
      brim.rotation.x = 0.1;
    }
    this.root.traverse((o) => { o.frustumCulled = true; });
  }

  buildHair(look, hair) {
    const cap = mesh(geo.hairCap, hair, this.head, 0, 0.005, -0.012);
    cap.rotation.x = -0.38;
    // 양갈래는 어린이 머리라 어른에게는 단발로 보인다.
    const style = this.adult && look.hair === 3 ? 2 : look.hair;
    switch (style) {
      case 1: { // 까까머리: 머리에 붙고 색이 옅다
        const color = new THREE.Color(LOOKS.hairColor[look.hairColor]).lerp(new THREE.Color(LOOKS.skin[look.skin]), 0.35);
        cap.material = std(color, 0.9);
        cap.scale.setScalar(0.965);
        break;
      }
      case 2: // 단발: 머리 뒤를 감싸는 큰 덩어리
        mesh(geo.ball, hair, this.head, 0, -0.04, -0.09, 0.312, 0.3, 0.3);
        mesh(geo.ball, hair, this.head, -0.245, -0.12, 0.02, 0.085, 0.17, 0.11);
        mesh(geo.ball, hair, this.head, 0.245, -0.12, 0.02, 0.085, 0.17, 0.11);
        break;
      case 3: // 양갈래
        for (const side of [-1, 1]) {
          mesh(geo.ball, std(0xd9604f, 0.5), this.head, side * 0.285, -0.02, -0.05, 0.03);
          mesh(geo.ball, hair, this.head, side * 0.335, -0.12, -0.07, 0.075, 0.13, 0.075);
        }
        break;
      case 4: // 똥머리 (모자를 쓰면 가려진다)
        if (!this.wearsHat) mesh(geo.ball, hair, this.head, 0, 0.33, -0.06, 0.1);
        break;
      default:
        break;
    }
  }

  get airborne() {
    return this.anim.jump >= 0;
  }

  // raise, bow, clap, throw, jump
  play(name) {
    if (name === 'jump') {
      if (!this.seated && !this.airborne) this.anim.jump = 0;
      return;
    }
    const durations = { raise: 2.2, bow: 1.5, clap: 1.8, throw: 0.75 };
    this.anim.emote = name;
    this.anim.emoteTime = 0;
    this.anim.emoteLength = durations[name] || 1;
  }

  update(dt) {
    const a = this.anim;
    a.walk = damp(a.walk, this.moving ? 1 : 0, 12, dt);
    a.sit = damp(a.sit, this.seated ? 1 : 0, 9, dt);
    a.idle += dt;
    if (this.moving) a.phase += dt * 10;

    const swing = Math.sin(a.phase) * 0.72 * a.walk;
    let legL = swing;
    let legR = -swing;
    let armLX = -swing * 0.75;
    let armRX = swing * 0.75;
    let armLZ = -0.06;
    let armRZ = 0.06;
    let armLStretch = 1;
    let armRStretch = 1;
    let bodyX = 0;
    let headX = Math.sin(a.idle * 0.8) * 0.018;
    let lift = Math.abs(Math.sin(a.phase)) * 0.03 * a.walk + Math.sin(a.idle * 1.6) * 0.004;

    if (a.sit > 0.01) {
      legL = THREE.MathUtils.lerp(legL, -1.45, a.sit);
      legR = THREE.MathUtils.lerp(legR, -1.45, a.sit);
      lift = THREE.MathUtils.lerp(lift, 0.09, a.sit);
      // 공부하는 자세: 고개를 숙이고 왼손은 공책을 짚고 오른손은 필기한다. 가끔 멈춰 생각한다.
      const writing = Math.sin(a.idle * 0.5 + a.phase) > -0.45 ? 1 : 0;
      armLX = THREE.MathUtils.lerp(armLX, -1.5, a.sit);
      armRX = THREE.MathUtils.lerp(armRX, -1.5 + Math.sin(a.idle * 11) * 0.035 * writing, a.sit);
      armLZ = THREE.MathUtils.lerp(armLZ, 0.32, a.sit);
      armRZ = THREE.MathUtils.lerp(armRZ, -0.34 + Math.sin(a.idle * 7) * 0.05 * writing, a.sit);
      armLStretch = THREE.MathUtils.lerp(1, 1.3, a.sit);
      armRStretch = THREE.MathUtils.lerp(1, 1.3, a.sit);
      headX = THREE.MathUtils.lerp(headX, 0.24 + Math.sin(a.idle * 1.3) * 0.02, a.sit);
    }

    if (a.emote) {
      a.emoteTime += dt;
      const t = a.emoteTime;
      const len = a.emoteLength;
      const env = Math.min(1, t * 6, (len - t) * 6);
      const e = Math.max(0, env);
      switch (a.emote) {
        case 'raise':
          // 머리가 커서 팔을 늘이고 바깥으로 벌려야 손이 보인다.
          armRX = THREE.MathUtils.lerp(armRX, -3, e);
          armRZ = THREE.MathUtils.lerp(armRZ, 0.34 + Math.sin(t * 9) * 0.12, e);
          armRStretch = THREE.MathUtils.lerp(1, 2.1, e);
          lift += Math.abs(Math.sin(t * 4.5)) * 0.018 * e * (1 - a.sit);
          break;
        case 'bow':
          bodyX = 0.75 * Math.sin(Math.min(1, t / len) * Math.PI) * (1 - a.sit * 0.5);
          headX += bodyX * 0.2;
          break;
        case 'clap': {
          const beat = (Math.sin(t * 15) + 1) / 2;
          armLX = THREE.MathUtils.lerp(armLX, -1.35, e);
          armRX = THREE.MathUtils.lerp(armRX, -1.35, e);
          armLZ = THREE.MathUtils.lerp(armLZ, 0.25 + beat * 0.42, e);
          armRZ = THREE.MathUtils.lerp(armRZ, -0.25 - beat * 0.42, e);
          lift += Math.abs(Math.sin(t * 7.5)) * 0.012 * e * (1 - a.sit);
          break;
        }
        case 'throw': {
          const p = t / len;
          const angle = p < 0.35 ? THREE.MathUtils.lerp(0, -2.8, p / 0.35) : THREE.MathUtils.lerp(-2.8, -0.9, Math.min(1, (p - 0.35) / 0.2));
          armRX = THREE.MathUtils.lerp(armRX, angle, e);
          break;
        }
      }
      if (t >= len) a.emote = null;
    }

    if (a.jump >= 0) {
      a.jump += dt / JUMP_TIME;
      if (a.jump >= 1) {
        a.jump = -1;
      } else {
        // 포물선으로 떠오르며 다리를 살짝 굽히고 팔을 벌린다.
        const arc = 4 * a.jump * (1 - a.jump);
        lift += JUMP_HEIGHT * arc;
        legL = THREE.MathUtils.lerp(legL, -0.5, arc);
        legR = THREE.MathUtils.lerp(legR, 0.3, arc);
        if (!a.emote) {
          armLZ = THREE.MathUtils.lerp(armLZ, -0.9, arc);
          armRZ = THREE.MathUtils.lerp(armRZ, 0.9, arc);
        }
      }
    }

    this.legL.rotation.x = legL;
    this.legR.rotation.x = legR;
    this.armL.rotation.set(armLX, 0, armLZ);
    this.armR.rotation.set(armRX, 0, armRZ);
    const stretchL = armLStretch * this.armBase;
    const stretchR = armRStretch * this.armBase;
    this.armL.scale.y = stretchL;
    this.armR.scale.y = stretchR;
    this.armL.userData.hand.scale.y = 0.056 / stretchL;
    this.armR.userData.hand.scale.y = 0.056 / stretchR;
    this.book.visible = a.sit > 0.85;
    this.pencil.visible = a.sit > 0.85 && a.emote !== 'raise' && a.emote !== 'clap' && a.emote !== 'throw';
    this.body.rotation.x = bodyX;
    this.head.rotation.x = headX;
    this.root.position.y = lift + (a.sit > 0.01 ? THREE.MathUtils.lerp(0, 0.03, a.sit) : 0);
  }
}
